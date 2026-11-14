import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const USAGE_OK = {
  usage: {
    rolling: { status: "ok", percent: 3, resetsAt: "2026-11-14T07:03:52.000Z" },
    weekly: { status: "ok", percent: 45, resetsAt: "2026-11-16T00:00:00.000Z" },
    monthly: { status: "ok", percent: 75, resetsAt: "2026-11-20T06:26:11.000Z" }
  }
};

const CSV_OK = [
  "date,model,provider,requests,input_tokens,output_tokens,cache_read_tokens,cache_write_tokens,cost_micro_cents",
  "2026-10-21,deepseek-v4.1-flash,opencode,588,100,50,20,5,3000000000",
  "2026-10-22,glm-5.3-flash,opencode,12,10,5,0,0,3000000000",
  "2026-11-10,deepseek-v4.1-flash,opencode,300,80,40,10,0,4500000000"
].join("\n");

/**
 * 构造一个只注册路由的假 ctx；consoleCookie 为 undefined 时模拟「未配置 Cookie」。
 * 采样器在测试里不需要跑（首次采样延迟被调到很大）。
 */
function makeCtx({ consoleCookie } = {}) {
  const routes = new Map();
  const ctx = {
    credentials: {
      resolve: async (ref) => {
        if (ref === "OPENCODE_GO_API_KEY") return { value: "test-go-key" };
        if (ref === "OPENCODE_CONSOLE_COOKIE" && consoleCookie !== undefined) return { value: consoleCookie };
        return undefined;
      }
    },
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

async function callHistory(routes, query = "") {
  let body = null;
  let status = null;
  const handler = routes.get("/api/account-usage/opencode-history");
  assert.equal(typeof handler, "function", "应注册 /api/account-usage/opencode-history");
  await handler({ url: `/api/account-usage/opencode-history${query}` }, {
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

/** 安装一个按 URL 分派的 fetch 假实现，并返回调用记录。 */
function stubFetch(handlers) {
  const previous = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, options) => {
    const href = String(url);
    calls.push({ href, options });
    for (const [fragment, handler] of Object.entries(handlers)) {
      if (href.includes(fragment)) return handler(href, options);
    }
    return new Response(JSON.stringify({ _tag: "NotFound" }), { status: 404 });
  };
  return {
    calls,
    restore() {
      globalThis.fetch = previous;
    }
  };
}

// 每个用例独立的采样目录，避免写到真实 ~/.dsh
async function withTempDataDir(run) {
  const dir = await mkdtemp(join(tmpdir(), "dsh-au-history-"));
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

test("未配置 Console Cookie：退回本地采样但仍返回完整周期序列", async () => {
  await withTempDataDir(async () => {
    // 首次导入时读一次环境变量，这里用查询字符串让采样目录生效
    const { apply } = await import("../index.js");
    const { ctx, routes } = makeCtx();
    apply(ctx);
    const stub = stubFetch({
      "/zen/go/v1/usage": async () => new Response(JSON.stringify(USAGE_OK), { status: 200 })
    });
    try {
      const body = await callHistory(routes);
      assert.equal(body.ok, true);
      assert.equal(body.source, "sampling");
      assert.equal(body.period.start, "2026-10-20");
      assert.equal(body.period.end, "2026-11-20");
      assert.equal(body.now.currentPercent, 75);
      assert.equal(body.days.length, 32);
      assert.equal(body.forecast.sufficient, true);
      assert.equal(body.forecast.projectedEndPercent, 93);
      assert.equal(body.console.configured, false);
      assert.equal(body.console.status, "unconfigured");
      // 没配置 Cookie 时不应该访问任何控制台接口
      assert.equal(stub.calls.some((call) => call.href.includes("/console/api/")), false);
    } finally {
      stub.restore();
    }
  });
});

test("Console Cookie 被拒绝：降级为采样数据并标记 expired", async () => {
  await withTempDataDir(async () => {
    const { apply } = await import("../index.js");
    const { ctx, routes } = makeCtx({ consoleCookie: "session=abc" });
    apply(ctx);
    const stub = stubFetch({
      "/zen/go/v1/usage": async () => new Response(JSON.stringify(USAGE_OK), { status: 200 }),
      "/console/api/": async () =>
        new Response(JSON.stringify({ _tag: "Forbidden" }), { status: 403 })
    });
    try {
      const body = await callHistory(routes);
      assert.equal(body.ok, true);
      assert.equal(body.source, "sampling");
      assert.equal(body.console.configured, true);
      assert.equal(body.console.status, "expired");
      assert.equal(body.models, null);
      assert.equal(body.totals, null);
      // 只有三条白名单 URL，且都带上了 Cookie + 只读 GET
      const consoleCalls = stub.calls.filter((call) => call.href.includes("/console/api/"));
      // 一条 orgs（取工作区 id）+ 三条数据接口
      assert.equal(consoleCalls.length, 4);
      assert.ok(consoleCalls.some((call) => call.href.endsWith("/console/api/orgs")));
      for (const call of consoleCalls) {
        assert.equal(call.options.headers.Cookie, "session=abc");
        assert.equal(call.options.method, undefined);
      }
    } finally {
      stub.restore();
    }
  });
});

test("官方日榜可用：按占比折算百分比并给出请求数、模型占比与合计", async () => {
  await withTempDataDir(async () => {
    const { apply } = await import("../index.js");
    const { ctx, routes } = makeCtx({ consoleCookie: "session=good" });
    apply(ctx);
    const stub = stubFetch({
      "/zen/go/v1/usage": async () => new Response(JSON.stringify(USAGE_OK), { status: 200 }),
      "/console/api/orgs": async () =>
        new Response(JSON.stringify({ orgs: [{ id: "org_abc", name: "personal" }] }), { status: 200 }),
      "/console/api/go/status": async () =>
        new Response(
          JSON.stringify({
            usage: {
              periodStart: "2026-10-20T06:26:11.000Z",
              monthly: { usedMicroCents: 7500000000, limitMicroCents: 10000000000 }
            }
          }),
          { status: 200 }
        ),
      "/console/api/activity/go": async () =>
        new Response(JSON.stringify({ days: [] }), { status: 200 }),
      "/console/api/v2/usage/export": async () =>
        new Response(CSV_OK, { status: 200, headers: { "content-type": "text/csv" } })
    });
    try {
      const body = await callHistory(routes);
      assert.equal(body.ok, true);
      assert.equal(body.source, "console");
      assert.equal(body.precision, 0.1);
      assert.equal(body.console.status, "ok");
      // 请求数按日进入序列
      const day = body.days.find((item) => item.date === "2026-10-21");
      assert.equal(day.requests, 588);
      assert.equal(day.recorded, true);
      // 26 天累计费用 10.5e9 微美分 → 按官方 75% 折算：10-21 占总费用 3/10.5
      assert.ok(day.cumulativePercent > 0 && day.cumulativePercent < 75);
      // 末点锚定官方实时百分比
      const today = body.days.find((item) => item.date === body.now.date);
      assert.equal(today.cumulativePercent, 75);
      // 模型占比与合计
      assert.equal(body.models.length, 2);
      assert.equal(body.models[0].model, "deepseek-v4.1-flash");
      assert.equal(body.totals.requests, 900);
      assert.ok(body.totals.tokens > 0);
      // 诊断只回传表头，不包含 Cookie
      assert.match(body.console.diagnostics.csvHeader, /^date,model/);
      assert.equal(body.console.diagnostics.orgsStatus, 200);
      assert.equal(body.console.diagnostics.orgIdPresent, true);
      // 三条数据接口都必须带上工作区头
      for (const call of stub.calls.filter((item) => item.href.includes("/console/api/") && !item.href.endsWith("/orgs"))) {
        assert.equal(call.options.headers["x-org-id"], "org_abc");
      }
      assert.equal(JSON.stringify(body).includes("session=good"), false);
    } finally {
      stub.restore();
    }
  });
});

test("实时接口超时：只要有采样就仍然出图（周期来自样本的重置时间）", async () => {
  await withTempDataDir(async (dir) => {
    const { mkdir, writeFile } = await import("node:fs/promises");
    await mkdir(dir, { recursive: true });
    const now = Date.now();
    await writeFile(
      join(dir, "opencode-samples.v1.json"),
      JSON.stringify({
        version: 1,
        samples: [
          { t: now - 3 * 86400000, percent: 68, resetsAt: "2026-11-20T06:26:11.000Z" },
          { t: now - 3600000, percent: 75, resetsAt: "2026-11-20T06:26:11.000Z" }
        ]
      })
    );
    // 重新导入以丢弃上一次测试的内存态（sampleStore / usageSnapshot 都是模块级）
    const { apply } = await import(`../index.js?fresh=${Date.now()}`);
    const { ctx, routes } = makeCtx();
    apply(ctx);
    const stub = stubFetch({
      "/zen/go/v1/usage": async () => {
        throw new Error("timeout");
      }
    });
    try {
      const body = await callHistory(routes);
      assert.equal(body.ok, true);
      assert.equal(body.period.resetsAt, "2026-11-20T06:26:11.000Z");
      // 接口挂掉时用最后一个样本的百分比锚定末点
      assert.equal(body.now.currentPercent, 75);
      assert.equal(body.sampledSince !== null, true);
      assert.ok(body.days.some((day) => day.recorded === true));
    } finally {
      stub.restore();
    }
  });
});

test("refresh=1 绕过控制台缓存并重新请求", async () => {
  await withTempDataDir(async () => {
    const { apply } = await import("../index.js");
    const { ctx, routes } = makeCtx({ consoleCookie: "session=fresh" });
    apply(ctx);
    let exportHits = 0;
    const stub = stubFetch({
      "/zen/go/v1/usage": async () => new Response(JSON.stringify(USAGE_OK), { status: 200 }),
      "/console/api/go/status": async () => new Response("{}", { status: 200 }),
      "/console/api/activity/go": async () => new Response("{}", { status: 200 }),
      "/console/api/v2/usage/export": async () => {
        exportHits += 1;
        return new Response(CSV_OK, { status: 200 });
      }
    });
    try {
      await callHistory(routes);
      const afterFirst = exportHits;
      await callHistory(routes);
      // 缓存命中：不重复请求（可能因 Cookie 相同而命中）
      assert.equal(exportHits, afterFirst);
      await callHistory(routes, "?refresh=1");
      assert.equal(exportHits, afterFirst + 1);
    } finally {
      stub.restore();
    }
  });
});

test("粘贴形式五花八门也能归一化：整行 cookie: / 整段 Request Headers / 带引号", async () => {
  const { normalizeConsoleCookie } = await import("../index.js");
  assert.equal(normalizeConsoleCookie("session=abc; other=1"), "session=abc; other=1");
  assert.equal(normalizeConsoleCookie("  session=abc  "), "session=abc");
  assert.equal(normalizeConsoleCookie("cookie: session=abc; x=1"), "session=abc; x=1");
  assert.equal(normalizeConsoleCookie("Cookie:session=abc"), "session=abc");
  assert.equal(normalizeConsoleCookie('"session=abc"'), "session=abc");
  assert.equal(normalizeConsoleCookie("session=abc;"), "session=abc");
  assert.equal(
    normalizeConsoleCookie("accept: */*\ncookie: session=abc; y=2\nreferer: https://opencode.ai/"),
    "session=abc; y=2"
  );
  assert.equal(normalizeConsoleCookie(""), undefined);
  assert.equal(normalizeConsoleCookie("   "), undefined);
  assert.equal(normalizeConsoleCookie(null), undefined);
});

test("凭据里存的是带前缀的粘贴内容时，发出去的 Cookie 头仍然合法", async () => {
  await withTempDataDir(async () => {
    const { apply } = await import(`../index.js?freshCookie=${Date.now()}`);
    const { ctx, routes } = makeCtx({ consoleCookie: "cookie: session=norm; a=1" });
    apply(ctx);
    const stub = stubFetch({
      "/zen/go/v1/usage": async () => new Response(JSON.stringify(USAGE_OK), { status: 200 }),
      "/console/api/": async () => new Response(JSON.stringify({ _tag: "Forbidden" }), { status: 403 })
    });
    try {
      await callHistory(routes);
      const consoleCalls = stub.calls.filter((call) => call.href.includes("/console/api/"));
      assert.equal(consoleCalls.length, 4);
      for (const call of consoleCalls) {
        assert.equal(call.options.headers.Cookie, "session=norm; a=1");
      }
    } finally {
      stub.restore();
    }
  });
});
