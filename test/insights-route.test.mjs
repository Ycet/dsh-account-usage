// 「概览」标签页 Host 路由的集成测试（0.5.0）：
// 用假的 sessionPersistence 驱动 /api/account-usage/insights，
// 验证扫描落盘、账本聚合，以及「会话被删除后消耗仍然保留」。
import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
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
    assert.equal(ledger.version, 1);
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

test("insights 路由：服务缺失时返回 unsupported", async () => {
  await withTempDataDir(async () => {
    const { ctx, routes } = makeCtx(undefined);
    await freshApply(ctx);
    const body = await callInsights(routes);
    assert.equal(body.ok, false);
    assert.equal(body.code, "unsupported");
  });
});
