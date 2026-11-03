import assert from "node:assert/strict";
import test from "node:test";
import {
  platformWindowQuery,
  splitDateWindows,
  enumerateDateKeys,
  bucketLocalDate,
  parseFunctionAmount,
  parseFunctionCost,
  mergeToolUsage
} from "../lib/aggregate.js";

const TZ = 28800; // UTC+8
const BUCKET_NOV_2 = 1793548800; // 2026-11-02 00:00 UTC+8
const BUCKET_NOV_3 = 1793635200; // 2026-11-03 00:00 UTC+8

function amountFixture() {
  return {
    functions: ["tool-search", "tool-fetch"],
    function_series: [
      {
        model: "tool-fetch",
        buckets: [
          { time: BUCKET_NOV_2, usage: { FUNCTION_CALL: 0 } },
          { time: BUCKET_NOV_3, usage: { FUNCTION_CALL: 19 } }
        ]
      },
      {
        model: "tool-search",
        buckets: [
          { time: BUCKET_NOV_2, usage: { FUNCTION_CALL: 0 } },
          { time: BUCKET_NOV_3, usage: { FUNCTION_CALL: 249 } }
        ]
      }
    ]
  };
}

function costFixture() {
  return {
    data: [
      {
        currency: "CNY",
        functions: ["tool-search", "tool-fetch"],
        function_series: [
          {
            model: "tool-fetch",
            buckets: [
              { time: BUCKET_NOV_2, cost: "0" },
              { time: BUCKET_NOV_3, cost: "0.0950000000000000" }
            ]
          },
          {
            model: "tool-search",
            buckets: [
              { time: BUCKET_NOV_2, cost: "0" },
              { time: BUCKET_NOV_3, cost: "1.2450000000000000" }
            ]
          }
        ]
      }
    ]
  };
}

test("platformWindowQuery matches the platform's 31-day window epoch seconds", () => {
  const query = platformWindowQuery("2026-10-04", "2026-11-03", TZ);
  assert.deepEqual(query, { start: 1791043200, end: 1793721600, tz: 28800 });
  assert.equal((query.end - query.start) / 86400, 31);
});

test("platformWindowQuery floors half-hour zones to whole-hour tz", () => {
  const query = platformWindowQuery("2026-11-01", "2026-11-03", 19800);
  assert.equal(query.tz, 18000);
  assert.equal(query.start, Date.UTC(2026, 10, 1) / 1000 - 18000);
  assert.equal(query.end, Date.UTC(2026, 10, 4) / 1000 - 18000);
});

test("splitDateWindows never exceeds 31 days and keeps inclusive endpoints", () => {
  const windows = splitDateWindows("2026-09-01", "2026-11-03");
  assert.equal(windows.length, 3);
  assert.deepEqual(windows[0], { from: "2026-09-01", to: "2026-10-01" });
  assert.deepEqual(windows[1], { from: "2026-10-02", to: "2026-11-01" });
  assert.deepEqual(windows[2], { from: "2026-11-02", to: "2026-11-03" });
  for (const window of windows) {
    const days = enumerateDateKeys(window.from, window.to).length;
    assert.ok(days >= 1 && days <= 31, `window ${window.from}..${window.to} has ${days} days`);
  }
});

test("enumerateDateKeys and bucketLocalDate are timezone-consistent", () => {
  assert.deepEqual(enumerateDateKeys("2026-11-01", "2026-11-03"), ["2026-11-01", "2026-11-02", "2026-11-03"]);
  assert.equal(bucketLocalDate(BUCKET_NOV_3, TZ), "2026-11-03");
  assert.equal(bucketLocalDate(BUCKET_NOV_2, TZ), "2026-11-02");
  assert.equal(enumerateDateKeys("2026-13-01", "2026-13-02").length, 0);
});

test("parseFunctionAmount aggregates per function and bucket", () => {
  const parsed = parseFunctionAmount(amountFixture(), TZ);
  assert.equal(parsed.get("2026-11-03").get("tool-search"), 249);
  assert.equal(parsed.get("2026-11-03").get("tool-fetch"), 19);
  assert.equal(parsed.get("2026-11-02").get("tool-search"), 0);
  assert.equal(parseFunctionAmount(null, TZ).size, 0);
});

test("parseFunctionCost picks CNY and parses string costs", () => {
  const parsed = parseFunctionCost(costFixture(), TZ);
  assert.equal(parsed.currency, "CNY");
  assert.equal(parsed.byDate.get("2026-11-03").get("tool-search"), 1.245);
  assert.equal(parsed.byDate.get("2026-11-03").get("tool-fetch"), 0.095);
  const empty = parseFunctionCost(null, TZ);
  assert.equal(empty.currency, null);
  assert.equal(empty.byDate.size, 0);
});

test("mergeToolUsage zero-fills days and preserves platform function order", () => {
  const amountMaps = [parseFunctionAmount(amountFixture(), TZ)];
  const costResults = [parseFunctionCost(costFixture(), TZ)];
  const merged = mergeToolUsage(amountMaps, costResults, "2026-11-01", "2026-11-03", [
    "tool-search",
    "tool-fetch"
  ]);
  assert.equal(merged.costAvailable, true);
  assert.equal(merged.currency, "CNY");
  assert.deepEqual(merged.functions.map((fn) => fn.id), ["tool-search", "tool-fetch"]);
  assert.equal(merged.functions[0].calls, 249);
  assert.equal(merged.functions[0].cost, 1.245);
  assert.equal(merged.functions[0].days.length, 3);
  assert.deepEqual(merged.functions[0].days[0], { date: "2026-11-01", calls: 0, cost: 0 });
  assert.deepEqual(merged.totals, { calls: 268, cost: 1.34 });
});

test("mergeToolUsage degrades costs when the cost endpoint is unavailable", () => {
  const merged = mergeToolUsage([parseFunctionAmount(amountFixture(), TZ)], [null], "2026-11-01", "2026-11-03", [
    "tool-search",
    "tool-fetch"
  ]);
  assert.equal(merged.costAvailable, false);
  assert.equal(merged.functions[0].calls, 249);
  assert.equal(merged.functions[0].cost, null);
  assert.equal(merged.functions[0].days[1].cost, null);
  assert.deepEqual(merged.totals, { calls: 268, cost: null });
});
