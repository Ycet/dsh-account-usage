// 「概览」标签页 Host 路由的集成测试（0.5.0）：
// 用假的 sessionPersistence 驱动 /api/account-usage/insights，
// 验证扫描落盘、账本聚合，以及「会话被删除后消耗仍然保留」。
import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const ROUTE = "/api/account-usage/insights";

/** 构造假 ctx；persistence 为 undefined 时模拟旧版 DSH（服务缺失）。 */
function makeCtx(persistence) {
  const routes = new Map();
  const ctx = {
    credentials: { resolve: async () => undefined },
    get: (name) => (name === "sessionPersistence" ? persistence : undefined),
    effect: (register) => register(),
    webServer: {
      register({ path, handler }) {
        routes.set(path, handler);
        return () => {};
      }
    },
    logger: { warn() {} }
  };
  return { ctx, routes };
}

/** 假 persistence：list 返回快照，open 返回该会话的事件。 */
function makePersistence(sessions) {
  return {
    state: sessions,
    async list() {
      return Object.entries(this.state).map(([id, item]) => ({ header: item.header, revision: item.revision }));
    },
    async open(id) {
      const item = this.state[id];
      if (item === undefined) throw new Error("missing session " + id);
      return {
        read: async () => ({ events: item.events }),
        close: async () => {}
      };
    }
  };
}

async function callInsights(routes, query = "") {
  let body = null;
  let status = null;
  const handler = routes.get(ROUTE);
  assert.equal(typeof handler, "function", "应注册 " + ROUTE);
  await handler({ url: ROUTE + query }, {
    writeHead(value) {
      status = value;
    },
    end(value) {
      body = JSON.parse(value);
    }
  });
  assert.equal(status, 200);
  return body;
}

/** 等后台扫描结束（宿主内部是 detached 的异步任务）。 */
async function waitForScan(routes, timeoutMs = 3000) {
  const started = Date.now();
  for (;;) {
    const body = await callInsights(routes);
    if (body.scanning !== true) return body;
    if (Date.now() - started > timeoutMs) throw new Error("scan did not finish in time");
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}

async function withTempDataDir(run) {
  const dir = await mkdtemp(join(tmpdir(), "dsh-au-insights-"));
  const previous = process.env.DSH_ACCOUNT_USAGE_DATA_DIR;
  process.env.DSH_ACCOUNT_USAGE_DATA_DIR = dir;
  try {
    await run(dir);
  } finally {
    if (previous === undefined) delete process.env.DSH_ACCOUNT_USAGE_DATA_DIR;
    else process.env.DSH_ACCOUNT_USAGE_DATA_DIR = previous;
    await rm(dir, { recursive: true, force: true });
  }
}

/** 每次用带随机 query 的 import 拿到全新的模块实例（模块级账本状态才会重置）。 */
async function freshApply(ctx) {
  const url = new URL("../index.js", import.meta.url);
  url.searchParams.set("fresh", String(Date.now()) + Math.random());
  const mod = await import(url.href);
  mod.apply(ctx);
}

function eventsWithUsage(iso, tokens) {
  const time = Date.parse(iso);
  return [
    { type: "turn/start", seq: 0, time, data: { turn: 1 } },
    { type: "assistant/message", seq: 1, time: time + 1000, data: { usage: { totalTokens: tokens } } },
    { type: "turn/end", seq: 2, time: time + 61 * 1000, data: { turn: 1 } }
  ];
}

test("insights 路由：扫描会话日志、落盘账本并返回按日聚合", async () => {
  await withTempDataDir(async (dir) => {
    const persistence = makePersistence({
      s1: { header: { id: "s1", origin: undefined }, revision: "r1", events: eventsWithUsage("2026-11-04T02:00:00Z", 1000) },
      s2: { header: { id: "s2", origin: "subagent" }, revision: "r1", events: eventsWithUsage("2026-11-04T03:00:00Z", 500) }
    });
    const { ctx, routes } = makeCtx(persistence);
    await freshApply(ctx);

    const first = await callInsights(routes);
    assert.equal(first.ok, true);
    assert.equal(first.scanning, true, "首次请求应触发后台扫描");

    const done = await waitForScan(routes);
    assert.equal(done.scanning, false);
    // 两个会话同一天 → 合并
    const dayKey = Object.keys(done.days)[0];
    assert.equal(done.days[dayKey], 1500);
    assert.equal(done.sessions.counted, 2);
    // 子代理不参与「最长任务用时」
    const year = String(new Date(Date.parse("2026-11-04T02:00:00Z")).getFullYear());
    assert.equal(done.longestTurnMsByYear[year], 61 * 1000);

    const ledger = JSON.parse(await readFile(join(dir, "usage-ledger.v1.json"), "utf8"));
    assert.equal(ledger.version, 2);
    assert.deepEqual(Object.keys(ledger.sessions).sort(), ["s1", "s2"]);
  });
});

test("insights 路由：会话被删除后账本保留，累计值不下降", async () => {
  await withTempDataDir(async () => {
    const persistence = makePersistence({
      keep: { header: { id: "keep" }, revision: "r1", events: eventsWithUsage("2026-11-04T02:00:00Z", 800) },
      gone: { header: { id: "gone" }, revision: "r1", events: eventsWithUsage("2026-11-03T02:00:00Z", 200) }
    });
    const { ctx, routes } = makeCtx(persistence);
    await freshApply(ctx);
    const first = await waitForScan(routes);
    const firstTotal = Object.values(first.days).reduce((sum, value) => sum + value, 0);
    assert.equal(firstTotal, 1000);

    // 模拟删除：gone 从列表消失
    delete persistence.state.gone;
    const second = await callInsights(routes, "?force=1");
    assert.equal(second.scanning, true, "force 应立即再扫一次");
    const after = await waitForScan(routes);
    const afterTotal = Object.values(after.days).reduce((sum, value) => sum + value, 0);
    assert.equal(afterTotal, 1000, "已删除会话的消耗必须保留");
    assert.equal(after.sessions.retained, 1);
  });
});

/** 子代理会话：先重放父会话历史，再写一条 inherited 的 end-seed，最后才是自己的新增。 */
function seededSubagentEvents(replayIso, replayTokens, ownIso, ownTokens) {
  const replayTime = Date.parse(replayIso);
  const ownTime = Date.parse(ownIso);
  return [
    { type: "assistant/message", seq: 1, time: replayTime, data: { usage: { totalTokens: replayTokens } } },
    { type: "session/end-seed", seq: 2, time: replayTime + 1000, data: { inherited: true } },
    { type: "assistant/message", seq: 3, time: ownTime, data: { usage: { totalTokens: ownTokens } } }
  ];
}

test("insights 路由：子代理继承的父会话重放不计入 token", async () => {
  await withTempDataDir(async () => {
    const persistence = makePersistence({
      parent: { header: { id: "parent" }, revision: "r1", events: eventsWithUsage("2026-11-16T02:00:00Z", 900) },
      child: {
        header: { id: "child", origin: "subagent" },
        revision: "r1",
        events: seededSubagentEvents("2026-11-16T02:00:00Z", 900, "2026-11-17T02:00:00Z", 7)
      }
    });
    const { ctx, routes } = makeCtx(persistence);
    await freshApply(ctx);
    const done = await waitForScan(routes);
    const total = Object.values(done.days).reduce((sum, value) => sum + value, 0);
    assert.equal(total, 907, "只算父会话 900 + 子会话新增 7，重放的 900 不能重复计入");
    assert.equal(done.days["2026-11-17"], 7);
  });
});

test("insights 路由：旧版账本（version 1）会被重算，同时保留已删除会话", async () => {
  await withTempDataDir(async (dir) => {
    // 预置一份 version 1 的账本：live 的旧值是虚高的（含继承重放），gone 的日志已经不在。
    await writeFile(
      join(dir, "usage-ledger.v1.json"),
      JSON.stringify({
        version: 1,
        updatedAt: 1,
        skipped: 0,
        sessions: {
          live: { revision: "r1", days: { "2026-11-16": 999 }, longestTurnMsByYear: {}, firstTime: null, lastTime: null },
          gone: { revision: "r1", days: { "2026-11-01": 500 }, longestTurnMsByYear: {}, firstTime: null, lastTime: null }
        }
      }),
      "utf8"
    );

    const persistence = makePersistence({
      live: { header: { id: "live" }, revision: "r1", events: eventsWithUsage("2026-11-17T02:00:00Z", 7) }
    });
    const { ctx, routes } = makeCtx(persistence);
    await freshApply(ctx);
    const done = await waitForScan(routes);

    assert.equal(done.days["2026-11-16"], undefined, "旧版虚高值必须被丢弃");
    assert.equal(done.days["2026-11-17"], 7, "会话必须按新口径重读");
    assert.equal(done.days["2026-11-01"], 500, "已删除会话的旧累计必须保留");
    assert.equal(done.sessions.retained, 1);

    const ledger = JSON.parse(await readFile(join(dir, "usage-ledger.v1.json"), "utf8"));
    assert.equal(ledger.version, 2);
  });
});

test("insights 路由：服务缺失时返回 unsupported", async () => {
  await withTempDataDir(async () => {
    const { ctx, routes } = makeCtx(undefined);
    await freshApply(ctx);
    const body = await callInsights(routes);
    assert.equal(body.ok, false);
    assert.equal(body.code, "unsupported");
  });
});

// ---- 0.6.0：路由返回活跃会话数（每日计数 / 每周每月去重） -----------------------

test("insights 路由：返回 sessionsByDay / sessionsByWeek / sessionsByMonth", async () => {
  await withTempDataDir(async () => {
    // 两个会话同一天活跃（11-04），另有一个会话在另一天（11-06，同一周）。
    const persistence = makePersistence({
      s1: { header: { id: "s1" }, revision: "r1", events: eventsWithUsage("2026-11-04T02:00:00Z", 1000) },
      s2: { header: { id: "s2", origin: "subagent" }, revision: "r1", events: eventsWithUsage("2026-11-04T03:00:00Z", 500) },
      s3: { header: { id: "s3" }, revision: "r1", events: eventsWithUsage("2026-11-06T02:00:00Z", 300) }
    });
    const { ctx, routes } = makeCtx(persistence);
    await freshApply(ctx);

    await callInsights(routes);
    const done = await waitForScan(routes);

    // 每日：11-04 有两个会话（含子代理），11-06 一个。
    assert.equal(done.sessionsByDay["2026-11-04"], 2);
    assert.equal(done.sessionsByDay["2026-11-06"], 1);
    // 每周：11-04 与 11-06 同属 11-02 那一周，去重后共 3 个会话。
    const weekKeys = Object.keys(done.sessionsByWeek);
    assert.equal(weekKeys.length, 1, "两天同周应只产出一个周键");
    assert.match(weekKeys[0], /^\d{4}-\d{2}-\d{2}$/);
    assert.equal(done.sessionsByWeek[weekKeys[0]], 3);
    // 每月：2026-11 去重后 3 个会话。
    assert.equal(done.sessionsByMonth["2026-11"], 3);
    assert.deepEqual(Object.keys(done.sessionsByMonth).sort(), ["2026-11"]);
  });
});
