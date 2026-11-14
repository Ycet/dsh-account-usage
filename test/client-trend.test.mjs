import assert from "node:assert/strict";
import test from "node:test";

/** 与 client-menu.test.mjs 相同的加载器伪造，额外提供最小可用的 hooks 桩。 */
async function loadClientBundle() {
  const previousWindow = globalThis.window;
  let descriptor;
  globalThis.window = {
    __ModuleLoader__: {
      load(next) {
        descriptor = next;
      }
    }
  };
  try {
    const url = new URL("../client.js", import.meta.url);
    url.searchParams.set("test", String(Date.now()) + Math.random());
    await import(url.href);
    assert.ok(descriptor, "client bundle should register with ModuleLoader");
    const ReactStub = {
      createElement: (...args) => ({ type: args[0], props: args[1] ?? {}, children: args.slice(2) }),
      Fragment: Symbol("Fragment"),
      useState: (initial) => [typeof initial === "function" ? initial() : initial, () => {}],
      useRef: (initial) => ({ current: initial ?? null }),
      useEffect: () => {},
      useLayoutEffect: () => {},
      useCallback: (fn) => fn,
      useMemo: (fn) => fn()
    };
    return descriptor.factory((name) => {
      if (name === "react") return ReactStub;
      if (name === "react-dom/client") return { createRoot: () => ({ render() {}, unmount() {} }) };
      if (name === "react-dom") return { render() {}, unmountComponentAtNode: () => true };
      throw new Error("unexpected require: " + name);
    });
  } finally {
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
  }
}

const t = (key) => key;

/** 深度遍历 createElement 生成的元素树。 */
function walk(node, visit) {
  if (node === null || typeof node !== "object") return;
  if (Array.isArray(node)) {
    for (const item of node) walk(item, visit);
    return;
  }
  visit(node);
  for (const child of node.children ?? []) walk(child, visit);
}

function findAll(root, predicate) {
  const hits = [];
  walk(root, (node) => {
    if (predicate(node)) hits.push(node);
  });
  return hits;
}

/** 构造一份接近宿主返回的历史序列。 */
function sampleTrendData({ sufficient = true } = {}) {
  const day = (date, percent, recorded = true) => ({
    date,
    cumulativePercent: percent,
    deltaPercent: null,
    requests: null,
    tokens: null,
    recorded
  });
  return {
    source: "sampling",
    precision: 1,
    period: { start: "2026-10-20", end: "2026-10-25", resetsAt: "2026-10-25T06:26:11.000Z" },
    now: { date: "2026-10-24", currentPercent: 70 },
    today: "2026-10-24",
    days: [
      day("2026-10-20", 10),
      day("2026-10-21", 25),
      day("2026-10-22", null, false),
      day("2026-10-23", 60),
      day("2026-10-24", 70),
      day("2026-10-25", null, false)
    ],
    forecast: {
      pacePercentPerDay: 17.5,
      projectedEndPercent: sufficient ? 110 : null,
      elapsedDays: 4,
      remainingDays: 1,
      sufficient
    },
    gridMax: 150,
    models: null,
    totals: null,
    sampledSince: "2026-10-20",
    console: { configured: false, status: "unconfigured" }
  };
}

test("客户端新导出存在且有界", async () => {
  const client = await loadClientBundle();
  for (const name of ["fmtCompactCount", "fmtPercent", "OpenCodeTrendChart", "OpenCodeModelsCard", "OpenCodeTrendCard"]) {
    assert.equal(typeof client[name] ?? "function", "function", `应导出 ${name}`);
  }
});

test("fmtCompactCount / fmtPercent 按截图口径格式化", async () => {
  const { fmtCompactCount, fmtPercent } = await loadClientBundle();
  assert.equal(fmtCompactCount(17236), "17,236");
  assert.equal(fmtCompactCount(3784000000), "3.784B");
  assert.equal(fmtCompactCount(1234567), "1.23M");
  assert.equal(fmtCompactCount(null), "—");
  assert.equal(fmtPercent(40.9, 0.1), "40.9%");
  assert.equal(fmtPercent(40.9, 1), "41%");
  assert.equal(fmtPercent(null, 1), "—");
});

test("parseLocalDateKey 按本地日历日解析，不落进 UTC 零点", async () => {
  const { parseLocalDateKey } = await loadClientBundle();
  const date = parseLocalDateKey("2026-11-02");
  assert.equal(date.getFullYear(), 2026);
  assert.equal(date.getMonth(), 10);
  assert.equal(date.getDate(), 2);
  assert.equal(parseLocalDateKey("bad"), null);
});

test("趋势图绘制历史折线、缺口断开，并画出预测虚线与终点标注", async () => {
  const { OpenCodeTrendChart } = await loadClientBundle();
  const tree = OpenCodeTrendChart({ data: sampleTrendData(), t });
  const svg = findAll(tree, (node) => node.type === "svg");
  assert.equal(svg.length, 1, "应渲染一个 svg");
  const dashed = findAll(tree, (node) => node.props && node.props.strokeDasharray === "5 4");
  assert.equal(dashed.length, 1, "预测线应为虚线");
  const hatch = findAll(tree, (node) => typeof node.props?.fill === "string" && node.props.fill.startsWith("url(#"));
  assert.equal(hatch.length, 1, "预测区应有斜线填充");
  // 60% 与 10/25 两点之间存在缺口（10-22 未记录）→ 历史应被切成两段折线
  const lines = findAll(
    tree,
    (node) => node.type === "path" && node.props && node.props.stroke === "var(--dsw-alias-state-success-primary)"
  );
  assert.equal(lines.length, 2, "缺口应把历史折线切成两段");
  // 悬浮热区：每天一个
  const hits = findAll(tree, (node) => node.type === "rect" && node.props && node.props.pointerEvents === "all");
  assert.equal(hits.length, 6);
  assert.equal(findAll(tree, (node) => node.type === "p").length, 0, "未悬浮时不渲染 tooltip");
});

test("预测数据不足时不画预测线", async () => {
  const { OpenCodeTrendChart } = await loadClientBundle();
  const tree = OpenCodeTrendChart({ data: sampleTrendData({ sufficient: false }), t });
  assert.equal(findAll(tree, (node) => node.props && node.props.strokeDasharray === "5 4").length, 0);
  assert.equal(findAll(tree, (node) => typeof node.props?.fill === "string" && node.props.fill.startsWith("url(#")).length, 0);
});

test("模型卡在有数据时渲染占比，无数据时返回 null", async () => {
  const { OpenCodeModelsCard } = await loadClientBundle();
  const data = {
    precision: 0.1,
    models: [
      { model: "deepseek-v4.1-flash", provider: "opencode", requests: 15690, tokens: 3443000000, share: 0.91 },
      { model: "glm-5.3-flash", provider: "opencode", requests: 1546, tokens: 341000000, share: 0.09 }
    ],
    totals: { requests: 17236, tokens: 3784000000 }
  };
  const tree = OpenCodeModelsCard({ data, t });
  assert.ok(tree, "有模型时应渲染");
  const texts = findAll(tree, (node) => node.type === "span").map((node) => node.children?.[0]);
  assert.ok(texts.includes("deepseek-v4.1-flash"));
  assert.ok(texts.includes("91.0%"));
  assert.equal(OpenCodeModelsCard({ data: { models: [] }, t }), null);
  assert.equal(OpenCodeModelsCard({ data: { models: null }, t }), null);
});

test("中英文文案都补齐了趋势相关的键", async () => {
  const client = await loadClientBundle();
  let dictionaries = null;
  client.apply({
    remote: undefined,
    effect(callback) {
      callback();
    },
    locale: {
      register(_ns, dicts) {
        dictionaries = dicts;
      },
      bind() {
        return (key) => key;
      }
    },
    slots: { inject(_name, callback) { return callback(); }, register() { return () => {}; } }
  });
  assert.ok(dictionaries, "应注册文案字典");
  const keys = [
    "trendTitle",
    "trendCurrent",
    "trendPace",
    "trendPaceUnit",
    "trendProjected",
    "trendUsed",
    "trendDayDelta",
    "trendRequests",
    "trendNotRecorded",
    "trendLegendUsage",
    "trendLegendForecast",
    "trendLegendLimit",
    "trendSourceSampling",
    "trendSourceConsole",
    "trendSince",
    "cookieConfigure",
    "cookieUpdate",
    "cookieHint",
    "cookiePlaceholder",
    "cookieSave",
    "cookieClear",
    "cookieSaved",
    "cookieSaveFailed",
    "cookieConfigured",
    "cookieMissing",
    "consoleExpired",
    "consoleUnavailable",
    "modelsTitle",
    "modelsTokens",
    "modelsSource"
  ];
  for (const key of keys) {
    assert.equal(typeof dictionaries.zh[key], "string", `zh 缺少 ${key}`);
    assert.equal(typeof dictionaries.en[key], "string", `en 缺少 ${key}`);
    assert.notEqual(dictionaries.zh[key].trim(), "", `zh ${key} 不应为空`);
    assert.notEqual(dictionaries.en[key].trim(), "", `en ${key} 不应为空`);
  }
});

test("趋势卡在加载态与成功态都能渲染", async () => {
  const client = await loadClientBundle();
  // 加载态：fetch 尚未返回
  const previousFetch = globalThis.fetch;
  globalThis.fetch = () => new Promise(() => {});
  try {
    const loading = client.OpenCodeTrendCard({ t, credApi: null });
    assert.ok(loading, "加载态应渲染卡片");
  } finally {
    globalThis.fetch = previousFetch;
  }
});
