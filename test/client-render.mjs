/**
 * dsh-account-usage — 客户端 bundle 预检（无需浏览器、无需重启宿主）。
 *
 * 在 Node 中模拟 window.__ModuleLoader__ 捕获 client.js 的工厂，用 mock
 * ctx 执行 apply()，取回 settings.section 的注册项，并用 react-dom/server
 * 真实渲染账户页组件——捕获组件体中的语法/运行时错误（useEffect 在 SSR
 * 中不执行，初始渲染显示加载态即可）。
 *
 * 运行：node test/client-render.mjs
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToString } from "react-dom/server";
import { readFileSync } from "node:fs";

const clientSource = readFileSync(new URL("../client.js", import.meta.url), "utf8");

/** 捕获 client.js 在顶层执行的 window.__ModuleLoader__.load 注册。 */
let registered = null;
globalThis.window = {
  __ModuleLoader__: {
    load(record) {
      registered = record;
    }
  },
  setInterval() {
    return 0;
  },
  clearInterval() {}
};
(0, eval)(clientSource);

function loadClientExports() {
  assert.ok(registered !== null, "client.js must call window.__ModuleLoader__.load");
  assert.equal(registered.id, "dsh-account-usage");
  const exportsObj = registered.factory((specifier) => {
    if (specifier === "react") return React;
    throw new Error(`client bundle requires an unexpected specifier: ${specifier}`);
  });
  assert.equal(typeof exportsObj.apply, "function");
  assert.ok(Array.isArray(exportsObj.inject));
  return exportsObj;
}

function makeClientCtx() {
  const registrations = [];
  const dicts = {};
  const ctx = {
    effect(fn) {
      return fn();
    },
    locale: {
      register(ns, d) {
        dicts[ns] = d;
      },
      bind(ns) {
        return (key) => dicts[ns]?.zh?.[key] ?? key;
      },
      getSnapshot() {
        return { revision: 1 };
      },
      subscribe() {
        return () => {};
      }
    },
    get(name) {
      if (name === "connection") {
        return {
          api: {
            credentials: {
              // 真实信封：unary 返回 { rpcId, result: { ok, value } }
              describe: async () => ({
                result: {
                  ok: true,
                  value: {
                    credentials: {
                      DEEPSEEK_PLATFORM_TOKEN: { configured: true, source: "file", writable: true }
                    }
                  }
                }
              }),
              set: async () => ({ result: { ok: true, value: {} } }),
              unset: async () => ({ result: { ok: true, value: {} } })
            }
          }
        };
      }
      return undefined;
    },
    slots: {
      inject(slotName, callback) {
        registrations.push({ slotName, entry: callback() });
        return () => {};
      },
      register(options, component) {
        return { options, component };
      }
    }
  };
  return { ctx, registrations };
}

test("client bundle registers and exports the plugin face", () => {
  const mod = loadClientExports();
  assert.deepEqual(mod.inject, ["slots", "locale", "connection"]);
  assert.equal(mod.NS, "settings.accountUsage");
  assert.equal(typeof mod.unwrapRpc, "function");
});

test("unwrapRpc decodes the connection.api unary envelope", () => {
  const mod = loadClientExports();
  // 成功信封
  assert.deepEqual(
    mod.unwrapRpc({ rpcId: "x", result: { ok: true, value: { credentials: { A: { configured: true } } } } }),
    { ok: true, value: { credentials: { A: { configured: true } } } }
  );
  // 失败信封（ok:false + error 分支）
  assert.deepEqual(mod.unwrapRpc({ rpcId: "x", result: { ok: false, error: { message: "nope" } } }), {
    ok: false,
    error: { message: "nope" }
  });
  // 畸形响应 → null（调用方按失败处理）
  assert.equal(mod.unwrapRpc(null), null);
  assert.equal(mod.unwrapRpc({ ok: true, value: {} }), null);
  assert.equal(mod.unwrapRpc({ result: null }), null);
});

test("apply registers an account settings.section and the page renders", () => {
  const mod = loadClientExports();
  const { ctx, registrations } = makeClientCtx();
  mod.apply(ctx);
  const section = registrations.find((r) => r.slotName === "settings.section");
  assert.ok(section, "must register settings.section");
  assert.equal(section.entry.options.id, "account");
  assert.equal(section.entry.options.name, "settings.section");
  assert.equal(typeof section.entry.options.label, "function");
  assert.equal(section.entry.options.label(), "账户");
  assert.equal(typeof section.entry.options.inject, "function");

  const injected = section.entry.options.inject();
  assert.equal(typeof injected.t, "function");
  assert.ok(injected.credApi !== null);

  const element = React.createElement(section.entry.component, injected);
  const html = renderToString(element);
  // 初始渲染（SSR 不执行 useEffect）：标题 + 加载态 + 两个面板骨架
  assert.ok(html.includes("账户"), "renders the page title");
  assert.ok(html.includes("DeepSeek 平台"), "renders the DeepSeek panel");
  assert.ok(html.includes("OpenCode Go"), "renders the OpenCode panel");
  assert.ok(html.includes("查询中"), "renders the loading state");
  assert.ok(html.includes("时间维度"), "renders the range selector");
  // 时间维度：预设集成进单个下拉菜单，自定义日期行保留
  assert.ok(html.includes("<select"), "renders the range dropdown");
  assert.ok(html.includes("近7天"), "preset options live inside the dropdown");
  assert.ok(html.includes("自定义区间"), "renders the custom range row");
  assert.ok(html.includes("type=\"date\""), "custom date inputs remain");
});

test("render does not crash when connection is absent (headless-ish client)", () => {
  const mod = loadClientExports();
  const { ctx, registrations } = makeClientCtx();
  ctx.get = () => undefined; // 无 connection → credApi null，页面应优雅降级
  mod.apply(ctx);
  const section = registrations.find((r) => r.slotName === "settings.section");
  const injected = section.entry.options.inject();
  assert.equal(injected.credApi, null);
  const html = renderToString(React.createElement(section.entry.component, injected));
  assert.ok(html.includes("OpenCode Go"));
});

test("TokenChart renders stacked segments with legend labels", () => {
  const mod = loadClientExports();
  const t = (k) => ({ legendMiss: "未命中输入", legendHit: "命中输入", legendOut: "输出", tokenChartEmpty: "空" })[k] ?? k;
  const days = [
    { date: "2026-08-13", models: { "deepseek-v4-flash": { cacheMissTokens: 300, cacheHitTokens: 200, responseTokens: 400 } } },
    { date: "2026-08-14", models: { "deepseek-v4-flash": { cacheMissTokens: 50, cacheHitTokens: 0, responseTokens: 60 } } },
    { date: "2026-08-15", models: {} }
  ];
  const html = renderToString(
    React.createElement(mod.TokenChart, { days, model: "deepseek-v4-flash", currency: "CNY", t })
  );
  assert.ok(html.includes("<svg"), "renders the token chart");
  // 堆叠分段：三种颜色各至少出现一次（有值的日期）
  assert.ok(html.includes("var(--dsw-alias-state-business-primary)"), "miss segment color");
  assert.ok(html.includes("var(--dsw-alias-state-success-primary)"), "hit segment color");
  assert.ok(html.includes("var(--dsw-alias-state-warn-primary)"), "output segment color");
  assert.ok(html.includes("2026-08-13"), "x-axis date labels");
});

test("BarChart renders per-day bars without native title tooltips", () => {
  const mod = loadClientExports();
  const t = (k) => ({ chartEmpty: "空" })[k] ?? k;
  const days = [
    { date: "2026-08-13", cost: 1.5, models: { "deepseek-v4-flash": { cost: 1.5 }, "deepseek-v4-pro": { cost: 0 } } },
    { date: "2026-08-14", cost: 2.5, models: { "deepseek-v4-flash": { cost: 2.5 } } }
  ];
  const html = renderToString(React.createElement(mod.BarChart, { days, currency: "CNY", t }));
  assert.ok(html.includes("<svg"), "renders the cost chart");
  // 原生 <title>（带悬浮延迟）已被移除
  assert.ok(!html.includes("<title"), "no native tooltip titles");
  assert.ok(html.includes("2026-08-13"), "x-axis date labels");
});
