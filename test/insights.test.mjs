// 使用统计账本的纯函数测试（0.5.0）：
// 折叠会话事件、只增不减的合并语义、账本聚合。
import assert from "node:assert/strict";
import test from "node:test";

import {
  aggregateLedger,
  emptyLedger,
  foldSessionEvents,
  localDateKeyOf,
  localYearOf,
  mergeLedger,
  usageTokens
} from "../lib/insights.js";

const TZ = -480; // UTC+8

function at(iso) {
  return Date.parse(iso);
}

test("usageTokens 优先 totalTokens，缺失时按 input+output+缓存回退", () => {
  assert.equal(usageTokens({ totalTokens: 1234, inputTokens: 10, outputTokens: 5 }), 1234);
  assert.equal(usageTokens({ inputTokens: 10, outputTokens: 5, cacheReadTokens: 100, cacheWriteTokens: 20 }), 135);
  assert.equal(usageTokens({ totalTokens: 0, inputTokens: 10 }), 0);
  assert.equal(usageTokens({ inputTokens: -5, outputTokens: 3 }), 3);
  assert.equal(usageTokens(null), 0);
  assert.equal(usageTokens({}), 0);
});

test("localDateKeyOf / localYearOf 按时区偏移折算本地日", () => {
  const ms = at("2026-11-04T17:30:00Z");
  assert.equal(localDateKeyOf(ms, TZ), "2026-11-05");
  assert.equal(localDateKeyOf(ms, 0), "2026-11-04");
  assert.equal(localYearOf(at("2025-12-31T17:00:00Z"), TZ), "2026");
  assert.equal(localYearOf(at("2025-12-31T17:00:00Z"), 0), "2025");
});

test("foldSessionEvents 按本地日累加 token，并记录首末时间", () => {
  const events = [
    { type: "turn/start", time: at("2026-11-04T01:00:00Z"), data: { turn: 1 } },
    { type: "assistant/message", time: at("2026-11-04T01:00:10Z"), data: { usage: { totalTokens: 100 } } },
    { type: "assistant/message", time: at("2026-11-04T02:00:00Z"), data: { usage: { totalTokens: 50 } } },
    // 跨本地日（UTC 17:30 = 本地次日 01:30）
    { type: "assistant/message", time: at("2026-11-04T17:30:00Z"), data: { usage: { inputTokens: 7, outputTokens: 3 } } },
    // 没有 usage 的消息不计
    { type: "assistant/message", time: at("2026-11-04T03:00:00Z"), data: {} },
    { type: "turn/end", time: at("2026-11-04T02:30:00Z"), data: { turn: 1 } }
  ];
  const folded = foldSessionEvents(events, { offsetMin: TZ });
  assert.deepEqual(folded.days, { "2026-11-04": 150, "2026-11-05": 10 });
  assert.equal(folded.firstTime, at("2026-11-04T01:00:00Z"));
  assert.equal(folded.lastTime, at("2026-11-04T17:30:00Z"));
  assert.deepEqual(folded.longestTurnMsByYear, { "2026": 90 * 60 * 1000 });
});

test("foldSessionEvents 取按年最长回合，缺失 turn/end 的回合忽略", () => {
  const events = [
    { type: "turn/start", time: at("2026-11-04T01:00:00Z"), data: { turn: 1 } },
    { type: "turn/end", time: at("2026-11-04T01:10:00Z"), data: { turn: 1 } },
    { type: "turn/start", time: at("2026-11-04T02:00:00Z"), data: { turn: 2 } },
    { type: "turn/end", time: at("2026-11-04T02:30:00Z"), data: { turn: 2 } },
    // 没有 end 的回合
    { type: "turn/start", time: at("2026-11-04T03:00:00Z"), data: { turn: 3 } },
    // 跨年：2025-12-31 本地开始，2026-01-01 结束 → 计入 2025 年
    { type: "turn/start", time: at("2025-12-31T15:00:00Z"), data: { turn: 4 } },
    { type: "turn/end", time: at("2025-12-31T16:00:00Z"), data: { turn: 4 } }
  ];
  const folded = foldSessionEvents(events, { offsetMin: TZ });
  assert.equal(folded.longestTurnMsByYear["2026"], 30 * 60 * 1000);
  assert.equal(folded.longestTurnMsByYear["2025"], 60 * 60 * 1000);
});

test("foldSessionEvents trackTurns=false 时只算 token（子代理）", () => {
  const events = [
    { type: "turn/start", time: at("2026-11-04T01:00:00Z"), data: { turn: 1 } },
    { type: "assistant/message", time: at("2026-11-04T01:00:10Z"), data: { usage: { totalTokens: 42 } } },
    { type: "turn/end", time: at("2026-11-04T01:30:00Z"), data: { turn: 1 } }
  ];
  const folded = foldSessionEvents(events, { offsetMin: TZ, trackTurns: false });
  assert.deepEqual(folded.days, { "2026-11-04": 42 });
  assert.deepEqual(folded.longestTurnMsByYear, {});
});

test("mergeLedger revision 未变时复用账本，不重读会话", async () => {
  const previous = {
    version: 1,
    updatedAt: 1,
    sessions: {
      a: { revision: "r1", days: { "2026-11-04": 100 }, longestTurnMsByYear: {}, firstTime: 1, lastTime: 2 }
    }
  };
  let reads = 0;
  const { ledger, stats } = await mergeLedger(
    previous,
    [{ header: { id: "a" }, revision: "r1" }],
    async () => {
      reads += 1;
      return { days: {}, longestTurnMsByYear: {} };
    },
    { now: 99 }
  );
  assert.equal(reads, 0);
  assert.equal(ledger.sessions.a.days["2026-11-04"], 100);
  assert.equal(ledger.sessions.a.retained, false);
  assert.equal(ledger.sessions.a.lastSeenAt, 99);
  assert.equal(stats.counted, 1);
});

test("mergeLedger revision 变化时重读并替换该会话", async () => {
  const previous = {
    version: 1,
    updatedAt: 1,
    sessions: { a: { revision: "r1", days: { "2026-11-04": 100 }, longestTurnMsByYear: {} } }
  };
  const { ledger, stats } = await mergeLedger(
    previous,
    [{ header: { id: "a" }, revision: "r2" }],
    async () => ({ days: { "2026-11-05": 7 }, longestTurnMsByYear: { "2026": 1000 } }),
    { now: 99 }
  );
  assert.equal(stats.read, 1);
  assert.deepEqual(ledger.sessions.a.days, { "2026-11-05": 7 });
  assert.equal(ledger.sessions.a.revision, "r2");
  assert.equal(ledger.sessions.a.longestTurnMsByYear["2026"], 1000);
});

test("mergeLedger 会话从列表消失时保留账本（已归档清理 / 已删除）", async () => {
  const previous = {
    version: 1,
    updatedAt: 1,
    sessions: {
      gone: { revision: "r1", days: { "2026-11-01": 500 }, longestTurnMsByYear: { "2026": 2000 } },
      alive: { revision: "r1", days: { "2026-11-02": 300 }, longestTurnMsByYear: {} }
    }
  };
  const { ledger, stats } = await mergeLedger(
    previous,
    [{ header: { id: "alive" }, revision: "r1" }],
    async () => ({ days: {}, longestTurnMsByYear: {} }),
    { now: 99 }
  );
  assert.equal(stats.retained, 1);
  assert.equal(ledger.sessions.gone.retained, true);
  assert.deepEqual(ledger.sessions.gone.days, { "2026-11-01": 500 });
  // 聚合后累计值不下降
  const aggregated = aggregateLedger(ledger);
  assert.equal(aggregated.days["2026-11-01"], 500);
  assert.equal(aggregated.days["2026-11-02"], 300);
  assert.equal(aggregated.sessions.retained, 1);
});

test("mergeLedger 单会话读取失败时保留旧值并计入 skipped", async () => {
  const previous = {
    version: 1,
    updatedAt: 1,
    sessions: { a: { revision: "r1", days: { "2026-11-04": 10 }, longestTurnMsByYear: {} } }
  };
  const { ledger, stats } = await mergeLedger(
    previous,
    [{ header: { id: "a" }, revision: "r2" }],
    async () => {
      throw new Error("boom");
    },
    { now: 99 }
  );
  assert.equal(stats.skipped, 1);
  assert.deepEqual(ledger.sessions.a.days, { "2026-11-04": 10 });
  assert.equal(ledger.skipped, 1);
});

test("mergeLedger 尊重中止信号，未处理的会话按保留处理", async () => {
  const previous = {
    version: 1,
    updatedAt: 1,
    sessions: { b: { revision: "r1", days: { "2026-11-02": 3 }, longestTurnMsByYear: {} } }
  };
  const abort = new AbortController();
  abort.abort();
  const { ledger } = await mergeLedger(
    previous,
    [
      { header: { id: "a" }, revision: "r1" },
      { header: { id: "b" }, revision: "r1" }
    ],
    async () => ({ days: {}, longestTurnMsByYear: {} }),
    { now: 99, signal: abort.signal }
  );
  // 中止后不再读新会话，旧账本原样保留
  assert.equal(ledger.sessions.a, undefined);
  assert.deepEqual(ledger.sessions.b.days, { "2026-11-02": 3 });
});

test("aggregateLedger 合并按日与按年数据并给出年份列表", () => {
  const ledger = {
    version: 1,
    updatedAt: 123,
    skipped: 2,
    sessions: {
      a: {
        revision: "r1",
        days: { "2025-12-31": 10, "2026-11-04": 100 },
        longestTurnMsByYear: { "2025": 5000, "2026": 1000 }
      },
      b: {
        revision: "r2",
        days: { "2026-11-04": 50 },
        longestTurnMsByYear: { "2026": 9000 },
        retained: true
      }
    }
  };
  const aggregated = aggregateLedger(ledger);
  assert.deepEqual(aggregated.days, { "2025-12-31": 10, "2026-11-04": 150 });
  assert.deepEqual(aggregated.longestTurnMsByYear, { "2025": 5000, "2026": 9000 });
  assert.deepEqual(aggregated.years, [2025, 2026]);
  assert.deepEqual(aggregated.sessions, { counted: 2, retained: 1 });
  assert.equal(aggregated.updatedAt, 123);
  assert.equal(aggregated.skipped, 2);
});

test("emptyLedger 给出可直接合并的空账本", async () => {
  const ledger = emptyLedger(7);
  assert.deepEqual(ledger, { version: 1, updatedAt: 7, skipped: 0, sessions: {} });
  const { ledger: merged } = await mergeLedger(
    ledger,
    [{ header: { id: "x" }, revision: "r1" }],
    async () => ({ days: { "2026-11-04": 1 }, longestTurnMsByYear: {} }),
    { now: 8 }
  );
  assert.equal(aggregateLedger(merged).days["2026-11-04"], 1);
});
