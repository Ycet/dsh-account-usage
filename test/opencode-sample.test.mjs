import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

// 采样器的首次延迟/间隔是模块级常量，必须在导入前设定；采样目录是运行期读取，逐用例覆盖即可。
process.env.DSH_ACCOUNT_USAGE_SAMPLE_FIRST_DELAY_MS = "5";
process.env.DSH_ACCOUNT_USAGE_SAMPLE_INTERVAL_MS = "3600000";

const USAGE_OK = {
  usage: {
    rolling: { status: "ok", percent: 3, resetsAt: "2026-11-14T07:03:52.000Z" },
    weekly: { status: "ok", percent: 45, resetsAt: "2026-11-16T00:00:00.000Z" },
    monthly: { status: "ok", percent: 75, resetsAt: "2026-11-20T06:26:11.000Z" }
  }
};

function makeCtx() {
  return {
    credentials: {
      resolve: async (ref) => (ref === "OPENCODE_GO_API_KEY" ? { value: "test-go-key" } : undefined)
    },
    effect: (register) => register(),
    webServer: { register: () => () => {} },
    logger: { warn() {} }
  };
}

function stubUsageFetch() {
  const previous = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify(USAGE_OK), { status: 200 });
  return () => {
    globalThis.fetch = previous;
  };
}

/** 轮询等待采样文件出现（最多 ~1s）。 */
async function waitForFile(path) {
  for (let i = 0; i < 50; i += 1) {
    try {
      return JSON.parse(await readFile(path, "utf8"));
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
  }
  return null;
}

test("后台采样器把每月窗口百分比按时间落盘", async () => {
  const dir = await mkdtemp(join(tmpdir(), "dsh-au-sample-"));
  process.env.DSH_ACCOUNT_USAGE_DATA_DIR = dir;
  const restore = stubUsageFetch();
  try {
    const { apply } = await import("../index.js");
    apply(makeCtx());
    const stored = await waitForFile(join(dir, "opencode-samples.v1.json"));
    assert.ok(stored, "应写出采样文件");
    assert.equal(stored.version, 1);
    assert.equal(stored.samples.length, 1);
    assert.equal(stored.samples[0].percent, 75);
    assert.equal(stored.samples[0].resetsAt, "2026-11-20T06:26:11.000Z");
    assert.equal(typeof stored.samples[0].t, "number");
  } finally {
    restore();
    await rm(dir, { recursive: true, force: true });
  }
});

test("DSH_ACCOUNT_USAGE_SAMPLING=off 时不采样、不写盘", async () => {
  const dir = await mkdtemp(join(tmpdir(), "dsh-au-nosample-"));
  process.env.DSH_ACCOUNT_USAGE_DATA_DIR = dir;
  process.env.DSH_ACCOUNT_USAGE_SAMPLING = "off";
  let calls = 0;
  const previous = globalThis.fetch;
  globalThis.fetch = async () => {
    calls += 1;
    return new Response(JSON.stringify(USAGE_OK), { status: 200 });
  };
  try {
    const { apply } = await import("../index.js?nosample");
    apply(makeCtx());
    await new Promise((resolve) => setTimeout(resolve, 120));
    assert.equal(calls, 0, "关闭采样后不应发起任何上游请求");
    assert.equal(await waitForFile(join(dir, "opencode-samples.v1.json")), null);
  } finally {
    delete process.env.DSH_ACCOUNT_USAGE_SAMPLING;
    globalThis.fetch = previous;
    await rm(dir, { recursive: true, force: true });
  }
});
