import assert from "node:assert/strict";
import test from "node:test";
import {
  periodRangeOf,
  shiftMonthKey,
  isDateKey,
  dateKeyOf,
  compactSamples,
  lastPercentByDate,
  parseConsoleMeters,
  parseConsoleActivity,
  parseConsoleOrgIds,
  parseUsageCsv,
  rollupCsvDaily,
  rollupCsvModels,
  microCentsToUsd,
  buildDailySeries,
  forecastSeries,
  percentGridMax
} from "../lib/aggregate.js";

const DAY = 86400000;

test("periodRangeOf 由月度重置时间倒推一个自然月", () => {
  const range = periodRangeOf("2026-11-20T06:26:11.000Z");
  assert.equal(range.end, "2026-11-20");
  assert.equal(range.start, "2026-10-20");
  assert.equal(range.resetsAt, "2026-11-20T06:26:11.000Z");
});

test("periodRangeOf 对非法入参返回空区间，不抛异常", () => {
  assert.deepEqual(periodRangeOf(null).start, null);
  assert.deepEqual(periodRangeOf("not-a-date").end, null);
  assert.deepEqual(periodRangeOf(undefined).start, null);
});

test("shiftMonthKey 收拢到目标月最后一天，避免 3/31 滚动到 3/3", () => {
  assert.equal(shiftMonthKey("2026-03-31"), "2026-02-28");
  assert.equal(shiftMonthKey("2026-01-15"), "2025-12-15");
  assert.equal(shiftMonthKey("2024-03-31"), "2024-02-29");
  assert.equal(shiftMonthKey("bad"), null);
});

test("isDateKey / dateKeyOf 只接受真实日期", () => {
  assert.equal(isDateKey("2026-02-30"), false);
  assert.equal(isDateKey("2026-02-28"), true);
  assert.equal(dateKeyOf("2026-11-02T23:00:00.000Z"), "2026-11-02");
  // 13 位毫秒与 10 位秒都要能识别
  assert.equal(dateKeyOf(Date.UTC(2026, 10, 2, 12)), "2026-11-02");
  assert.equal(dateKeyOf(Math.floor(Date.UTC(2026, 10, 2, 12) / 1000)), "2026-11-02");
  assert.equal(dateKeyOf(null), null);
});

test("parseUsageCsv 按别名识别列并归一化数值", () => {
  const csv = [
    "Date,Model,Provider,Requests,Input Tokens,Output Tokens,Cache Read Tokens,Cache Write Tokens,Cost Micro Cents",
    '2026-11-02,deepseek-v4.1-flash,opencode,588,100,50,20,5,12345678',
    '2026-11-02,"glm-5.3-flash",opencode,12,10,5,0,0,1000',
    "2026-11-03,deepseek-v4.1-flash,opencode,,80,40,10,0,5000000"
  ].join("\r\n");
  const parsed = parseUsageCsv(csv);
  assert.equal(parsed.rows.length, 3);
  assert.equal(parsed.columns.model, 1);
  // 空单元格按 0 处理，不产生 NaN
  assert.equal(parsed.rows[2].requests, 0);
  assert.equal(parsed.rows[0].costMicroCents, 12345678);
});

test("parseUsageCsv 没有日期列时返回 null（触发降级而不是瞎猜）", () => {
  assert.equal(parseUsageCsv("model,requests\na,1"), null);
  assert.equal(parseUsageCsv(""), null);
  assert.equal(parseUsageCsv(null), null);
});

test("parseUsageCsv 兼容 BOM 与多种缓存写入列", () => {
  const csv = "\uFEFFdate,model,cache_write_5m_tokens,cache_write_1h_tokens\n2026-11-02,a,7,3";
  const parsed = parseUsageCsv(csv);
  assert.equal(parsed.rows[0].cacheWrite, 10);
});

test("rollupCsvDaily / rollupCsvModels 汇总每日与按模型数据", () => {
  const parsed = parseUsageCsv(
    [
      "date,model,provider,requests,input_tokens,output_tokens,cache_read_tokens,cache_write_tokens,cost_micro_cents",
      "2026-11-02,deepseek-v4.1-flash,opencode,588,100,50,20,5,300",
      "2026-11-02,glm-5.3-flash,opencode,12,10,5,0,0,100",
      "2026-11-03,deepseek-v4.1-flash,opencode,300,80,40,10,0,200"
    ].join("\n")
  );
  const daily = rollupCsvDaily(parsed.rows);
  assert.equal(daily.get("2026-11-02").requests, 600);
  assert.equal(daily.get("2026-11-02").tokens, 100 + 50 + 20 + 5 + 10 + 5);
  assert.equal(daily.get("2026-11-02").costMicroCents, 400);

  const models = rollupCsvModels(parsed.rows);
  assert.equal(models[0].model, "deepseek-v4.1-flash");
  assert.equal(models[0].requests, 888);
  assert.equal(models.length, 2);
  assert.ok(Math.abs(models.reduce((sum, m) => sum + m.share, 0) - 1) < 1e-9);
});

test("microCentsToUsd 按 1 USD = 1e8 micro-cents 换算", () => {
  assert.equal(microCentsToUsd(100000000), 1);
  assert.equal(microCentsToUsd(null), null);
});

test("parseConsoleMeters 支持 usage 包裹、微美分折算与周期起点", () => {
  const meters = parseConsoleMeters({
    usage: {
      periodStart: "2026-10-20T06:26:11.000Z",
      rolling: { percent: 3, resetsAt: "2026-11-14T07:03:52.000Z" },
      weekly: { percent: 45, resetsAt: "2026-11-16T00:00:00.000Z" },
      monthly: { usedMicroCents: 7500000000, limitMicroCents: 10000000000, resetsAt: "2026-11-20T06:26:11.000Z" }
    }
  });
  assert.equal(meters.rolling.resetsAt, "2026-11-14T07:03:52.000Z");
  assert.equal(meters.monthly.percent, 75);
  assert.equal(meters.monthly.usedMicroCents, 7500000000);
  assert.equal(meters.periodStart, "2026-10-20");
  assert.equal(meters.periodEnd, "2026-11-20");
  assert.equal(meters.limitMicroCents, 10000000000);
});

test("parseConsoleMeters 结构不识别时返回全 null，不抛异常", () => {
  const meters = parseConsoleMeters({ _tag: "Forbidden" });
  assert.equal(meters.rolling, null);
  assert.equal(meters.monthly, null);
  assert.equal(meters.periodStart, null);
  assert.equal(parseConsoleMeters(null).limitMicroCents, null);
});

test("parseConsoleActivity 兼容 data.days / 别名字段 / 时间戳", () => {
  const days = parseConsoleActivity({
    data: {
      days: [
        { date: "2026-11-02", cost: 50000000, requests: 100 },
        { day: "2026-11-03", costMicroCents: 10000000, totalTokens: 1234 },
        { startAt: Math.floor(Date.UTC(2026, 10, 4, 8) / 1000), amount: 1, count: 2 }
      ]
    }
  });
  assert.equal(days.length, 3);
  assert.equal(days[0].date, "2026-11-02");
  assert.equal(days[0].costMicroCents, 50000000);
  assert.equal(days[1].tokens, 1234);
  assert.equal(days[2].date, "2026-11-04");
  assert.equal(days[2].requests, 2);
});

test("parseConsoleActivity 同一天多行累加，无法识别返回空数组", () => {
  const days = parseConsoleActivity({
    days: [
      { date: "2026-11-02", cost: 10 },
      { date: "2026-11-02", cost: 5 }
    ]
  });
  assert.equal(days.length, 1);
  assert.equal(days[0].costMicroCents, 15);
  assert.deepEqual(parseConsoleActivity({ nothing: true }), []);
  assert.deepEqual(parseConsoleActivity(null), []);
});

test("compactSamples 最近 72 小时保留原始样本，更早按天折叠", () => {
  const now = Date.UTC(2026, 10, 14, 12);
  const samples = [
    { t: now - 40 * DAY, percent: 10 },
    { t: now - 40 * DAY + 3600000, percent: 11 },
    { t: now - 39 * DAY, percent: 12 },
    { t: now - 3600000, percent: 70 },
    { t: now - 1800000, percent: 71 },
    { t: now - 400 * DAY, percent: 1 }
  ];
  const kept = compactSamples(samples, now);
  // 40 天前同一天只留最后一条；39 天前一条；72 小时内两条；400 天前被裁掉
  assert.equal(kept.length, 4);
  assert.equal(kept[0].percent, 11);
  assert.equal(kept[1].percent, 12);
  assert.equal(kept[3].percent, 71);
});

test("lastPercentByDate 取当天最后一条且限定区间", () => {
  const map = lastPercentByDate(
    [
      // 两个时刻在本地时区（+08:00）同属 11-02
      { t: Date.UTC(2026, 10, 2, 1), percent: 40 },
      { t: Date.UTC(2026, 10, 2, 4), percent: 42 },
      { t: Date.UTC(2026, 9, 1, 0), percent: 1 }
    ],
    "2026-10-20",
    "2026-11-20"
  );
  assert.equal(map.get("2026-11-02"), 42);
  assert.equal(map.has("2026-10-01"), false);
});

test("buildDailySeries 采样模式：缺口保持 null，只锚定今天，跨缺口不给日增量", () => {
  const series = buildDailySeries({
    periodStart: "2026-11-01",
    periodEnd: "2026-11-10",
    todayKey: "2026-11-05",
    anchorPercent: 50,
    samples: [
      { t: Date.UTC(2026, 10, 1, 3), percent: 10 },
      { t: Date.UTC(2026, 10, 2, 3), percent: 20 },
      // 11-03 / 11-04 没有样本（DSH 未运行）
      { t: Date.UTC(2026, 10, 5, 3), percent: 45 }
    ]
  });
  assert.equal(series.source, "sampling");
  const byDate = new Map(series.days.map((d) => [d.date, d]));
  assert.equal(byDate.get("2026-11-01").recorded, true);
  assert.equal(byDate.get("2026-11-02").deltaPercent, 10);
  // 缺口日不插值
  assert.equal(byDate.get("2026-11-03").recorded, false);
  assert.equal(byDate.get("2026-11-03").cumulativePercent, null);
  // 缺口后第一天不给日增量
  assert.equal(byDate.get("2026-11-05").deltaPercent, null);
  // 今天被实时值锚定
  assert.equal(byDate.get("2026-11-05").cumulativePercent, 50);
  assert.equal(byDate.get("2026-11-05").sealed, true);
  // 未来的日期不进入历史序列
  assert.equal(byDate.get("2026-11-08").recorded, false);
});

test("buildDailySeries 官方日榜模式：按占比折算并带上当日请求数", () => {
  const series = buildDailySeries({
    periodStart: "2026-11-01",
    periodEnd: "2026-11-04",
    todayKey: "2026-11-04",
    anchorPercent: 60,
    limitMicroCents: 10000000000,
    consoleDays: [
      { date: "2026-11-01", costMicroCents: 3000000000, requests: 100, tokens: 1000 },
      { date: "2026-11-02", costMicroCents: 3000000000, requests: 200, tokens: 2000 }
    ]
  });
  assert.equal(series.source, "console");
  const byDate = new Map(series.days.map((d) => [d.date, d]));
  // 两天费用相同 → 各占累计费用的 50%，× 官方实时 60% = 30% / 60%
  assert.equal(byDate.get("2026-11-01").cumulativePercent, 30);
  assert.equal(byDate.get("2026-11-01").requests, 100);
  assert.equal(byDate.get("2026-11-02").cumulativePercent, 60);
  assert.equal(byDate.get("2026-11-02").deltaPercent, 30);
  // 没有记录的日期按 0 用量计（官方口径），末点被实时值锚定
  assert.equal(byDate.get("2026-11-03").cumulativePercent, 60);
  assert.equal(byDate.get("2026-11-04").cumulativePercent, 60);
  assert.equal(byDate.get("2026-11-04").sealed, true);
});

test("buildDailySeries 无法构成周期时返回空序列", () => {
  assert.deepEqual(buildDailySeries({ periodStart: null, periodEnd: null }).days, []);
  // 超过 32 天的异常周期直接放弃，避免横轴被拉爆
  assert.deepEqual(buildDailySeries({ periodStart: "2026-01-01", periodEnd: "2026-03-01" }).days, []);
});

test("forecastSeries 用日均线性外推到周期末", () => {
  const forecast = forecastSeries(
    { days: [{ date: "2026-11-11", cumulativePercent: 66, recorded: true }] },
    { periodStart: "2026-11-01", periodEnd: "2026-11-11", todayKey: "2026-11-06" }
  );
  // 已过 5 天、用掉 66% → 日均 13.2%，剩余 5 天
  assert.equal(forecast.sufficient, true);
  assert.equal(forecast.pacePercentPerDay, 13.2);
  assert.equal(forecast.projectedEndPercent, 132);
});

test("forecastSeries 周期刚开始或没有数据时标记数据不足", () => {
  const tooEarly = forecastSeries(
    { days: [{ date: "2026-11-01", cumulativePercent: 1, recorded: true }] },
    { periodStart: "2026-11-01", periodEnd: "2026-11-30", todayKey: "2026-11-01" }
  );
  assert.equal(tooEarly.sufficient, false);
  assert.equal(tooEarly.projectedEndPercent, null);
  assert.equal(forecastSeries({ days: [] }, {}).sufficient, false);
});

test("percentGridMax 按 100/150/50 档位取纵轴上限", () => {
  assert.equal(percentGridMax([50, 90]), 100);
  assert.equal(percentGridMax([50, 120]), 150);
  assert.equal(percentGridMax([50, 170]), 200);
  assert.equal(percentGridMax([]), 100);
});

test("parseConsoleOrgIds 从组织列表里取到控制台需要的 x-org-id", () => {
  assert.equal(parseConsoleOrgIds({ orgs: [{ id: "org_1" }, { id: "org_2" }] }).orgId, "org_1");
  assert.equal(parseConsoleOrgIds({ data: [{ orgID: "o1", workspaceID: "w1" }] }).workspaceId, "w1");
  assert.equal(parseConsoleOrgIds([{ organizationId: "o2" }]).orgKey, "organizationId");
  // 顶层活跃组织优先
  assert.equal(parseConsoleOrgIds({ activeOrgId: "act", orgs: [{ id: "x" }] }).orgId, "act");
  // 识别不到时返回 null，不猜
  assert.equal(parseConsoleOrgIds({ nope: 1 }).orgId, null);
  assert.equal(parseConsoleOrgIds(null).orgId, null);
  assert.equal(parseConsoleOrgIds("str").orgId, null);
});
