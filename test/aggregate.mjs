/**
 * dsh-account-usage — 聚合/解析函数测试。
 * fixture 结构取自 platform.deepseek.com 与 opencode.ai 的真实响应形状
 * （见社区监控工具与实测端点），无网络依赖，直接运行：
 *
 *   node test/aggregate.mjs
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  toFinite,
  orNull,
  localDate,
  parseDateParam,
  monthsBetween,
  findCumulativeCost,
  parseSummary,
  parseAmount,
  parseCost,
  mergeMonths,
  pickWindow,
  canonicalModel,
  roundCost
} from "../lib/aggregate.js";

// ---- fixtures ---------------------------------------------------------------

const summaryBizData = {
  normal_wallets: [{ balance: "88.5", currency: "CNY" }],
  bonus_wallets: [{ balance: "12.25", currency: "CNY" }],
  total_costs: [{ currency: "CNY", amount: "456.78" }]
};

const amountBizData = {
  days: [
    {
      date: "2026-08-13",
      data: [
        {
          model: "deepseek-chat",
          count: 3,
          usage: [
            { type: "PROMPT_TOKEN", amount: "1000" },
            { type: "PROMPT_CACHE_HIT_TOKEN", amount: "200" },
            { type: "PROMPT_CACHE_MISS_TOKEN", amount: "300" },
            { type: "RESPONSE_TOKEN", amount: "400" },
            { type: "REQUEST", amount: "5" }
          ]
        },
        {
          model: "deepseek-reasoner",
          usage: [
            { type: "PROMPT_TOKEN", amount: "500" },
            { type: "RESPONSE_TOKEN", amount: "600" }
          ]
        },
        {
          // 平台会返回全零的遗留模型行，解析层保留，路由层过滤
          model: "deepseek-chat & deepseek-reasoner",
          usage: [{ type: "REQUEST", amount: "0" }]
        }
      ]
    },
    {
      date: "2026-08-14",
      data: [
        {
          model: "deepseek-chat",
          usage: [
            { type: "PROMPT_TOKEN", amount: "50" },
            { type: "RESPONSE_TOKEN", amount: "60" }
          ]
        }
      ]
    },
    {
      // 未来日期（平台返回整月数据）：聚合阶段过滤，解析阶段保留
      date: "2026-09-30",
      data: [{ model: "deepseek-chat", usage: [{ type: "PROMPT_TOKEN", amount: "1" }] }]
    }
  ]
};

const costBizData = {
  days: [
    {
      date: "2026-08-13",
      data: [
        {
          model: "deepseek-chat",
          usage: [
            { type: "COST", amount: "1.5" },
            { type: "CACHE_COST", amount: "0.25" },
            // 费用接口同样携带 REQUEST 类型（值为 0），必须被排除
            { type: "REQUEST", amount: "999" }
          ]
        },
        { model: "deepseek-reasoner", usage: [{ type: "COST", amount: "2.0" }] }
      ]
    },
    { date: "2026-08-14", data: [{ model: "deepseek-chat", usage: [{ type: "COST", amount: "0.5" }] }] }
  ]
};

// ---- tests -------------------------------------------------------------------

test("toFinite / orNull / roundCost", () => {
  assert.equal(toFinite("12.5"), 12.5);
  assert.equal(toFinite(7), 7);
  assert.ok(Number.isNaN(toFinite("abc")));
  assert.ok(Number.isNaN(toFinite(undefined)));
  assert.equal(orNull(NaN), null);
  assert.equal(orNull(3), 3);
  assert.equal(roundCost(1.23456789), 1.234568);
});

test("localDate / parseDateParam", () => {
  assert.match(localDate(new Date(2026, 7, 14)), /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(localDate(new Date(2026, 7, 14)), "2026-08-14");
  const d = parseDateParam("2026-08-14");
  assert.ok(d instanceof Date);
  assert.equal(localDate(d), "2026-08-14");
  assert.equal(parseDateParam("2026-13-01"), null);
  assert.equal(parseDateParam("nope"), null);
});

test("monthsBetween spans inclusive months", () => {
  const out = monthsBetween(new Date(2026, 6, 20), new Date(2026, 8, 5));
  assert.deepEqual(out, [
    { year: 2026, month: 7 },
    { year: 2026, month: 8 },
    { year: 2026, month: 9 }
  ]);
  const acrossYear = monthsBetween(new Date(2025, 10, 1), new Date(2026, 0, 31));
  assert.deepEqual(acrossYear, [
    { year: 2025, month: 11 },
    { year: 2025, month: 12 },
    { year: 2026, month: 1 }
  ]);
});

test("findCumulativeCost prefers total-prefixed cost keys", () => {
  assert.deepEqual(findCumulativeCost({ total_cost: 5 }), { key: "total_cost", value: 5 });
  assert.deepEqual(
    findCumulativeCost({ nested: { a: 1, cumulative_cost_amount: "9" } }),
    { key: "cumulative_cost_amount", value: 9 }
  );
  assert.equal(findCumulativeCost({ no_cost_here: 1, other: { x: 2 } }), null);
});

test("parseSummary maps wallets and finds cumulative cost", () => {
  const s = parseSummary(summaryBizData);
  assert.equal(s.toppedUp, 88.5);
  assert.equal(s.granted, 12.25);
  assert.equal(s.currency, "CNY");
  assert.equal(s.cumulativeCost, 456.78);
  assert.equal(s.cumulativeCostKey, "total_costs[0].amount");
});

test("parseSummary tolerates empty payloads", () => {
  const s = parseSummary(null);
  assert.equal(s.toppedUp, null);
  assert.equal(s.granted, null);
  assert.equal(s.cumulativeCost, null);
  assert.equal(s.currency, null);
});

test("parseSummary falls back to heuristic when total_costs is absent", () => {
  const s = parseSummary({ normal_wallets: [], total_cost: "99.5" });
  assert.equal(s.cumulativeCost, 99.5);
  assert.equal(s.cumulativeCostKey, "total_cost");
});

test("parseAmount sums token types and request counts, canonicalizes models", () => {
  const map = parseAmount(amountBizData);
  assert.ok(map instanceof Map);
  assert.equal(map.size, 3);
  const day13 = map.get("2026-08-13");
  const flash = day13.get("deepseek-v4-flash"); // deepseek-chat → v4-flash
  const pro = day13.get("deepseek-v4-pro"); // deepseek-reasoner → v4-pro
  assert.equal(flash.prompt, 1000);
  assert.equal(flash.cacheHit, 200);
  assert.equal(flash.cacheMiss, 300);
  assert.equal(flash.response, 400);
  // 3（mu.count）+ 5（REQUEST 用量类型，实测结构）= 8
  assert.equal(flash.requests, 8);
  assert.equal(pro.prompt, 500);
  assert.equal(pro.response, 600);
  assert.equal(pro.requests, 0);
  // 全零遗留模型行照常解析（过滤在路由层）
  const legacy = day13.get("deepseek-chat & deepseek-reasoner");
  assert.equal(legacy.requests, 0);
});

test("parseAmount returns null for foreign shapes", () => {
  assert.equal(parseAmount(null), null);
  assert.equal(parseAmount({}), null);
});

test("parseCost sums per-model cost per day", () => {
  const map = parseCost(costBizData);
  const day13 = map.get("2026-08-13");
  assert.equal(day13.get("deepseek-v4-flash"), 1.75);
  assert.equal(day13.get("deepseek-v4-pro"), 2);
  assert.equal(map.get("2026-08-14").get("deepseek-v4-flash"), 0.5);
});

test("mergeMonths combines amount + cost into day and model aggregates", () => {
  const { dayAgg, modelAgg } = mergeMonths([parseAmount(amountBizData)], [parseCost(costBizData)]);
  const day13 = dayAgg.get("2026-08-13");
  assert.equal(day13.cost, 3.75);
  assert.equal(day13.requests, 8);
  assert.equal(day13.prompt, 1500);
  assert.equal(day13.cacheHit, 200);
  assert.equal(day13.cacheMiss, 300);
  assert.equal(day13.response, 1000);
  const flash = modelAgg.get("deepseek-v4-flash");
  assert.equal(flash.cost, 2.25);
  assert.equal(flash.requests, 8);
  // 1050 + 未来日期(09-30)的 1 个 prompt token —— 日期过滤在路由层进行，merge 不裁剪
  assert.equal(flash.prompt, 1051);
  assert.equal(flash.response, 460);
  const pro = modelAgg.get("deepseek-v4-pro");
  assert.equal(pro.cost, 2);
  assert.equal(pro.prompt, 500);
  assert.equal(pro.response, 600);
});

test("mergeMonths tolerates missing month maps", () => {
  const { dayAgg } = mergeMonths([null, parseAmount(amountBizData)], [null, parseCost(costBizData)]);
  assert.ok(dayAgg.get("2026-08-13").cost === 3.75);
});

test("mergeMonths builds per-day per-model details (dayModelAgg)", () => {
  const { dayModelAgg } = mergeMonths([parseAmount(amountBizData)], [parseCost(costBizData)]);
  const day13 = dayModelAgg.get("2026-08-13");
  assert.ok(day13 instanceof Map);
  const flash = day13.get("deepseek-v4-flash");
  assert.equal(flash.cost, 1.75);
  assert.equal(flash.requests, 8);
  assert.equal(flash.cacheHit, 200);
  assert.equal(flash.cacheMiss, 300);
  assert.equal(flash.response, 400);
  const pro = day13.get("deepseek-v4-pro");
  assert.equal(pro.cost, 2);
  assert.equal(pro.prompt, 500);
  assert.equal(pro.response, 600);
  // keepDate 过滤同样作用于 dayModelAgg（未来日期不产生明细）
  const filtered = mergeMonths([parseAmount(amountBizData)], [parseCost(costBizData)], (d) => d <= "2026-08-14");
  assert.equal(filtered.dayModelAgg.has("2026-09-30"), false);
  assert.equal(filtered.dayModelAgg.get("2026-08-14").get("deepseek-v4-flash").cost, 0.5);
});

test("mergeMonths keepDate predicate filters days AND model totals together", () => {
  const { dayAgg, modelAgg } = mergeMonths(
    [parseAmount(amountBizData)],
    [parseCost(costBizData)],
    (date) => date <= "2026-08-14"
  );
  assert.ok(dayAgg.get("2026-08-13") !== undefined);
  assert.ok(dayAgg.get("2026-08-14") !== undefined);
  assert.equal(dayAgg.has("2026-09-30"), false);
  const flash = modelAgg.get("deepseek-v4-flash");
  // 未来日期(09-30)的 1 个 prompt token 不得进入模型汇总
  assert.equal(flash.prompt, 1050);
  assert.equal(flash.response, 460);
});

test("pickWindow is defensive", () => {
  assert.deepEqual(pickWindow({ status: "ok", percent: 9, resetsAt: "2026-08-14T07:20:04Z" }), {
    status: "ok",
    percent: 9,
    resetsAt: "2026-08-14T07:20:04Z"
  });
  assert.deepEqual(pickWindow({ status: "ok", percent: "9", resetsAt: null }), {
    status: "ok",
    percent: 9,
    resetsAt: null
  });
  assert.equal(pickWindow(null), null);
  assert.deepEqual(pickWindow({ percent: "x" }), { status: null, percent: null, resetsAt: null });
});

test("canonicalModel passes unknown names through", () => {
  assert.equal(canonicalModel("some-future-model"), "some-future-model");
  assert.equal(canonicalModel("deepseek-chat"), "deepseek-v4-flash");
  assert.equal(canonicalModel("deepseek-v4-pro"), "deepseek-v4-pro");
});
