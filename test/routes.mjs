/**
 * dsh-account-usage — 宿主路由端到端冒烟测试（模拟 ctx + 模拟 fetch，无网络依赖）。
 *
 * 覆盖：
 *   - 无令牌 / 令牌过期 / 业务错误 → 统一 {ok:false, code, message} 信封
 *   - 概要路由：钱包/累计消费/本月消费解析
 *   - 用量路由：按月聚合、区间过滤、未来日期过滤、跨月裁剪、按模型汇总
 *   - OpenCode 路由：key 来源、三窗口解析、无 key 错误
 *
 * 运行（需先在本包根目录创建 node_modules junction 指向
 * $DSH_HOME/profiles/node_modules，用于解析 @deepseek-ai 依赖）：
 *
 *   node test/routes.mjs
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { localDate } from "../lib/aggregate.js";

/**
 * 每个用例使用全新模块实例（动态 import + 唯一查询串），避免模块级
 * 平台缓存（30s TTL）在用例之间串扰。
 */
let freshCounter = 0;
async function freshApply() {
  const mod = await import(`../index.js?f=${freshCounter++}`);
  return mod.apply;
}

// ---- 动态 fixture（相对"今天"，避免断言依赖真实日期） --------------------------

function d(n) {
  const base = new Date();
  base.setHours(12, 0, 0, 0);
  base.setDate(base.getDate() + n);
  return localDate(base);
}

const D_1 = d(-1);
const D_2 = d(-2);
const D_FUTURE = d(10);

function amountBizData() {
  return {
    days: [
      {
        date: D_2,
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
            model: "deepseek-chat & deepseek-reasoner",
            usage: [{ type: "REQUEST", amount: "0" }]
          }
        ]
      },
      {
        date: D_1,
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
        date: D_FUTURE,
        data: [{ model: "deepseek-chat", usage: [{ type: "PROMPT_TOKEN", amount: "1" }] }]
      }
    ]
  };
}

function costBizData() {
  return {
    days: [
      {
        date: D_2,
        data: [
          {
            model: "deepseek-chat",
            usage: [
              { type: "COST", amount: "1.5" },
              { type: "CACHE_COST", amount: "0.25" }
            ]
          },
          { model: "deepseek-reasoner", usage: [{ type: "COST", amount: "2.0" }] }
        ]
      },
      { date: D_1, data: [{ model: "deepseek-chat", usage: [{ type: "COST", amount: "0.5" }] }] }
    ]
  };
}

const summaryBizData = {
  normal_wallets: [{ balance: "88.5", currency: "CNY" }],
  bonus_wallets: [{ balance: "12.25", currency: "CNY" }],
  total_costs: [{ currency: "CNY", amount: "456.78" }]
};

const opencodeBody = {
  usage: {
    rolling: { status: "ok", percent: 3, resetsAt: "2026-08-15T14:11:18.359Z" },
    weekly: { status: "ok", percent: 1, resetsAt: "2026-08-17T00:00:00.359Z" },
    monthly: { status: "ok", percent: 0, resetsAt: "2026-09-15T03:39:01.359Z" }
  }
};

// ---- 模拟环境 ----------------------------------------------------------------

function ok(body) {
  return { status: 200, ok: true, json: async () => body };
}

/**
 * 模拟上游 fetch：平台端点按 token 与路径返回 fixture；记录调用供断言。
 * @param {{token?: string, calls?: Array<string>, force401?: boolean}} opts
 */
function makeMockFetch(opts = {}) {
  const calls = opts.calls ?? [];
  return async (url, init) => {
    const u = new URL(url);
    if (u.origin === "https://platform.deepseek.com") {
      calls.push(u.pathname);
      const auth = String(init?.headers?.Authorization ?? "");
      if (!auth.includes(opts.token ?? "") || opts.token === undefined) {
        return { status: 401, ok: false, json: async () => ({ code: 0 }) };
      }
      if (opts.force401) {
        return { status: 401, ok: false, json: async () => ({ code: 0 }) };
      }
      if (u.pathname.endsWith("/users/get_user_summary")) {
        return ok({ code: 0, data: { biz_code: 0, biz_data: summaryBizData } });
      }
      if (u.pathname.endsWith("/users/get_user_info")) {
        return ok({ code: 0, data: { biz_code: 0, biz_data: { user_info: { total_cost: "999.9" } } } });
      }
      if (u.pathname.endsWith("/usage/amount")) {
        return ok({ code: 0, data: { biz_code: 0, biz_data: amountBizData() } });
      }
      if (u.pathname.endsWith("/usage/cost")) {
        return ok({ code: 0, data: { biz_code: 0, biz_data: costBizData() } });
      }
      return { status: 404, ok: false, json: async () => ({ code: 404 }) };
    }
    if (u.origin === "https://opencode.ai") {
      calls.push(u.pathname);
      return ok(opencodeBody);
    }
    throw new Error(`unexpected host ${u.origin}`);
  };
}

function makeCtx(credentials, applyFn) {
  const routes = new Map();
  const ctx = {
    credentials: {
      resolve: async (ref) =>
        credentials !== null && credentials !== undefined && credentials[ref] !== undefined
          ? { value: credentials[ref] }
          : undefined
    },
    // 插件现在经 ctx.get("credentials") 可选访问（宿主零硬依赖）
    get(name) {
      return name === "credentials" ? this.credentials : undefined;
    },
    webServer: {
      register(route) {
        routes.set(route.path, route);
        return () => {};
      }
    },
    effect(fn) {
      const disposer = fn();
      return disposer;
    },
    logger: { warn() {} }
  };
  applyFn(ctx);
  return { ctx, routes };
}

function callRoute(route, url) {
  return new Promise((resolve, reject) => {
    const res = {
      writeHead(status) {
        this.status = status;
      },
      end(body) {
        resolve({ status: this.status, body: JSON.parse(body) });
      }
    };
    Promise.resolve(route.handler({ url }, res)).catch(reject);
  });
}

// ---- tests -------------------------------------------------------------------

test("summary route: no token → no-token envelope", async () => {
  const realFetch = globalThis.fetch;
  globalThis.fetch = makeMockFetch({ token: "t" });
  try {
    const { routes } = makeCtx({}, await freshApply());
    const out = await callRoute(routes.get("/api/account-usage/deepseek-summary"), "/");
    assert.equal(out.status, 200);
    assert.equal(out.body.ok, false);
    assert.equal(out.body.code, "no-token");
  } finally {
    globalThis.fetch = realFetch;
  }
});

test("summary route: parses wallets, cumulative cost, monthly figures", async () => {
  const realFetch = globalThis.fetch;
  globalThis.fetch = makeMockFetch({ token: "tok" });
  try {
    const { routes } = makeCtx({ DEEPSEEK_PLATFORM_TOKEN: "tok" }, await freshApply());
    const out = await callRoute(routes.get("/api/account-usage/deepseek-summary"), "/");
    assert.equal(out.status, 200);
    assert.equal(out.body.ok, true);
    assert.equal(out.body.balance.toppedUp, 88.5);
    assert.equal(out.body.balance.granted, 12.25);
    assert.equal(out.body.balance.currency, "CNY");
    assert.equal(out.body.cumulativeCost, 456.78);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test("summary route: expired token → token-expired envelope", async () => {
  const realFetch = globalThis.fetch;
  globalThis.fetch = makeMockFetch({ token: "tok", force401: true });
  try {
    const { routes } = makeCtx({ DEEPSEEK_PLATFORM_TOKEN: "tok" }, await freshApply());
    const out = await callRoute(routes.get("/api/account-usage/deepseek-summary"), "/");
    assert.equal(out.body.ok, false);
    assert.equal(out.body.code, "token-expired");
  } finally {
    globalThis.fetch = realFetch;
  }
});

test("usage route: aggregates days, filters future dates, maps models", async () => {
  const realFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = makeMockFetch({ token: "tok", calls });
  try {
    const { routes } = makeCtx({ DEEPSEEK_PLATFORM_TOKEN: "tok" }, await freshApply());
    const from = d(-10);
    const to = d(0);
    const out = await callRoute(
      routes.get("/api/account-usage/deepseek-usage"),
      `/api/account-usage/deepseek-usage?from=${from}&to=${to}`
    );
    assert.equal(out.body.ok, true);
    assert.equal(out.body.range.from, from);
    assert.equal(out.body.range.to, to);
    assert.equal(out.body.range.clipped, false);
    // 每日：未来日期被过滤，仅剩两个历史日
    assert.equal(out.body.days.length, 2);
    assert.equal(out.body.days[0].date, D_2);
    assert.deepEqual(
      { cost: out.body.days[0].cost, requests: out.body.days[0].requests },
      { cost: 3.75, requests: 8 }
    );
    // 每日分模型明细（费用图 tooltip / token 图数据源）
    const dayModels0 = out.body.days[0].models;
    assert.equal(dayModels0["deepseek-v4-flash"].cost, 1.75);
    assert.equal(dayModels0["deepseek-v4-flash"].cacheMissTokens, 300);
    assert.equal(dayModels0["deepseek-v4-pro"].cost, 2);
    assert.equal(dayModels0["deepseek-v4-pro"].responseTokens, 600);
    const dayModels1 = out.body.days[1].models;
    assert.equal(dayModels1["deepseek-v4-flash"].cost, 0.5);
    // 未来日期不在区间内 → 无该日明细
    assert.equal(out.body.days.some((d) => d.date === D_FUTURE), false);
    // 总计：cost 4.25、requests 8（3 count + 5 REQUEST）、tokens 3110
    assert.equal(out.body.totals.cost, 4.25);
    assert.equal(out.body.totals.requests, 8);
    assert.equal(out.body.totals.tokens, 3110);
    // 模型行：v4-flash 与 v4-pro（含别名映射），按费用降序；全零遗留行被过滤
    const models = out.body.models;
    assert.equal(models.length, 2);
    assert.ok(models.every((m) => m.model !== "deepseek-chat & deepseek-reasoner"));
    assert.equal(models[0].model, "deepseek-v4-flash");
    assert.equal(models[0].cost, 2.25);
    assert.equal(models[0].requests, 8);
    assert.equal(models[0].promptTokens, 1050);
    assert.equal(models[1].model, "deepseek-v4-pro");
    assert.equal(models[1].cost, 2);
    assert.equal(models[1].responseTokens, 600);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test("usage route: month range beyond cap → clipped and bounded fetches", async () => {
  // 全新模块实例（?fresh 查询串）以获得空的平台缓存：此前测试已缓存当月，
  // 同一实例下会少一次真实 fetch。
  const fresh = await import("../index.js?fresh");
  const realFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = makeMockFetch({ token: "tok", calls });
  try {
    const routes = new Map();
    const ctx = {
      credentials: {
        resolve: async (ref) => (ref === "DEEPSEEK_PLATFORM_TOKEN" ? { value: "tok" } : undefined)
      },
      get(name) {
        return name === "credentials" ? this.credentials : undefined;
      },
      webServer: {
        register(route) {
          routes.set(route.path, route);
          return () => {};
        }
      },
      effect(fn) {
        return fn();
      },
      logger: { warn() {} }
    };
    fresh.apply(ctx);
    const from = d(-150);
    const to = d(0);
    const out = await callRoute(
      routes.get("/api/account-usage/deepseek-usage"),
      `/api/account-usage/deepseek-usage?from=${from}&to=${to}`
    );
    assert.equal(out.body.ok, true);
    assert.equal(out.body.range.clipped, true);
    // 裁剪后 from 为最近 3 个月中最早一月的 1 号
    assert.match(out.body.range.from, /-01$/);
    // 只拉取 3 个月份（amount × 3 + cost × 3）
    const amountCalls = calls.filter((p) => p.endsWith("/usage/amount"));
    const costCalls = calls.filter((p) => p.endsWith("/usage/cost"));
    assert.equal(amountCalls.length, 3);
    assert.equal(costCalls.length, 3);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test("usage route: invalid dates → defaults to recent 30 days", async () => {
  const realFetch = globalThis.fetch;
  globalThis.fetch = makeMockFetch({ token: "tok" });
  try {
    const { routes } = makeCtx({ DEEPSEEK_PLATFORM_TOKEN: "tok" }, await freshApply());
    const out = await callRoute(
      routes.get("/api/account-usage/deepseek-usage"),
      "/api/account-usage/deepseek-usage?from=abc&to=xyz"
    );
    assert.equal(out.body.ok, true);
    assert.equal(out.body.range.to, d(0));
  } finally {
    globalThis.fetch = realFetch;
  }
});

test("opencode route: resolves key from credentials and parses windows", async () => {
  const realFetch = globalThis.fetch;
  globalThis.fetch = makeMockFetch();
  try {
    const { routes } = makeCtx({ OPENCODE_GO_API_KEY: "sk-test" }, await freshApply());
    const out = await callRoute(routes.get("/api/account-usage/opencode"), "/");
    assert.equal(out.body.ok, true);
    assert.equal(out.body.keySource, "credentials");
    assert.equal(out.body.usage.rolling.percent, 3);
    assert.equal(out.body.usage.weekly.percent, 1);
    assert.equal(out.body.usage.monthly.resetsAt, "2026-09-15T03:39:01.359Z");
  } finally {
    globalThis.fetch = realFetch;
  }
});

test("opencode route: no key → no-key envelope", async () => {
  const realFetch = globalThis.fetch;
  globalThis.fetch = makeMockFetch();
  try {
    const { routes } = makeCtx({}, await freshApply());
    const out = await callRoute(routes.get("/api/account-usage/opencode"), "/");
    assert.equal(out.body.ok, false);
    assert.equal(out.body.code, "no-key");
  } finally {
    globalThis.fetch = realFetch;
  }
});

test("opencode route: upstream 401 → unauthorized envelope", async () => {
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    status: 401,
    ok: false,
    json: async () => ({})
  });
  try {
    const { routes } = makeCtx({ OPENCODE_GO_API_KEY: "sk-bad" }, await freshApply());
    const out = await callRoute(routes.get("/api/account-usage/opencode"), "/");
    assert.equal(out.body.ok, false);
    assert.equal(out.body.code, "unauthorized");
  } finally {
    globalThis.fetch = realFetch;
  }
});

test("opencode route caches successful results within TTL", async () => {
  const realFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = makeMockFetch({ calls });
  try {
    const { routes } = makeCtx({ OPENCODE_GO_API_KEY: "sk-test" }, await freshApply());
    const r1 = await callRoute(routes.get("/api/account-usage/opencode"), "/");
    assert.equal(r1.body.ok, true);
    const r2 = await callRoute(routes.get("/api/account-usage/opencode"), "/");
    assert.equal(r2.body.ok, true);
    assert.equal(r2.body.usage.rolling.percent, r1.body.usage.rolling.percent);
    // TTL 内第二次调用直接命中缓存，上游只请求一次
    assert.equal(calls.filter((p) => p.endsWith("/usage")).length, 1);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test("routes degrade gracefully when the credentials service is absent", async () => {
  const realFetch = globalThis.fetch;
  globalThis.fetch = makeMockFetch({ token: "tok" });
  try {
    const { routes } = makeCtx(null, await freshApply());
    const s = await callRoute(routes.get("/api/account-usage/deepseek-summary"), "/");
    assert.equal(s.body.ok, false);
    assert.equal(s.body.code, "no-token");
    const o = await callRoute(routes.get("/api/account-usage/opencode"), "/");
    assert.equal(o.body.ok, false);
    assert.equal(o.body.code, "no-key");
  } finally {
    globalThis.fetch = realFetch;
  }
});
