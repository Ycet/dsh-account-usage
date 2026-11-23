// 区间日历与合计口径的纯函数测试（0.5.0）。
// 加载器伪造与 client-menu.test.mjs 保持一致：只取 factory 导出的纯函数，
// 不渲染组件（因此不需要完整的 React 桩）。
import assert from "node:assert/strict";
import test from "node:test";

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
      createElement: (...args) => ({ type: args[0], props: args[1], children: args.slice(2) }),
      Fragment: Symbol("Fragment")
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

/** 中文界面字典（只取日历相关键）。 */
const zhT = (key) =>
  ({
    rangeWeekdays: "日,一,二,三,四,五,六",
    rangeMonthNames: "1月,2月,3月,4月,5月,6月,7月,8月,9月,10月,11月,12月",
    rangeMonthTitle: "{year}年{month}"
  })[key] ?? key;

/** 英文界面字典（只取日历相关键）。 */
const enT = (key) =>
  ({
    rangeWeekdays: "Su,Mo,Tu,We,Th,Fr,Sa",
    rangeMonthNames:
      "January,February,March,April,May,June,July,August,September,October,November,December",
    rangeMonthTitle: "{month} {year}"
  })[key] ?? key;

const client = await loadClientBundle();

test("isDateKey 只接受真实存在的 YYYY-MM-DD", () => {
  assert.equal(client.isDateKey("2026-11-19"), true);
  assert.equal(client.isDateKey("2026-02-28"), true);
  assert.equal(client.isDateKey("2026-02-30"), false);
  assert.equal(client.isDateKey("2026-13-01"), false);
  assert.equal(client.isDateKey("2026-1-1"), false);
  assert.equal(client.isDateKey(""), false);
  assert.equal(client.isDateKey(null), false);
});

test("addMonths 跨年归一", () => {
  assert.deepEqual(client.addMonths(2026, 11, -1), { year: 2026, month: 10 });
  assert.deepEqual(client.addMonths(2026, 12, 1), { year: 2027, month: 1 });
  assert.deepEqual(client.addMonths(2026, 1, -1), { year: 2025, month: 12 });
  assert.deepEqual(client.addMonths(2026, 11, -13), { year: 2025, month: 10 });
});

test("buildMonthGrid 周日起始、前后补空、整周对齐", () => {
  // 2026-10-01 是周四 → 首行 4 个空位（周日、一、二、三 各一格）
  const oct = client.buildMonthGrid(2026, 10);
  assert.equal(oct.weeks.length, 5);
  assert.deepEqual(
    oct.weeks[0].map((cell) => (cell === null ? null : cell.day)),
    [null, null, null, null, 1, 2, 3]
  );
  assert.deepEqual(
    oct.weeks[4].map((cell) => (cell === null ? null : cell.day)),
    [25, 26, 27, 28, 29, 30, 31]
  );
  assert.equal(oct.weeks[0][4].key, "2026-10-01");

  // 2026-11-01 是周日 → 首行从 1 号开始
  const nov = client.buildMonthGrid(2026, 11);
  assert.equal(nov.weeks.length, 5);
  assert.deepEqual(
    nov.weeks[0].map((cell) => (cell === null ? null : cell.day)),
    [1, 2, 3, 4, 5, 6, 7]
  );

  // 2026 不是闰年：2 月 28 天且正好 4 周
  const feb = client.buildMonthGrid(2026, 2);
  assert.equal(feb.weeks.length, 4);
  assert.equal(feb.weeks[3][6].key, "2026-02-28");

  // 每行恒为 7 格
  for (const week of nov.weeks) assert.equal(week.length, 7);
});

test("weekdayLabels 按界面语言取表头，异常时回退英文缩写", () => {
  assert.deepEqual(client.weekdayLabels(zhT), ["日", "一", "二", "三", "四", "五", "六"]);
  assert.deepEqual(client.weekdayLabels(enT), ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"]);
  assert.deepEqual(client.weekdayLabels(() => "not-a-list"), ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"]);
});

test("formatMonthTitle 中英文月标题", () => {
  assert.equal(client.formatMonthTitle(2026, 10, zhT), "2026年10月");
  assert.equal(client.formatMonthTitle(2026, 11, zhT), "2026年11月");
  assert.equal(client.formatMonthTitle(2026, 10, enT), "October 2026");
  assert.equal(client.formatMonthTitle(2026, 11, enT), "November 2026");
});

test("normalizeRange 反向选择也会排序，非法输入返回 null", () => {
  assert.deepEqual(client.normalizeRange("2026-11-19", "2026-11-01"), {
    from: "2026-11-01",
    to: "2026-11-19"
  });
  assert.deepEqual(client.normalizeRange("2026-11-01", "2026-11-01"), {
    from: "2026-11-01",
    to: "2026-11-01"
  });
  assert.equal(client.normalizeRange("2026-11-01", ""), null);
  assert.equal(client.normalizeRange(null, "2026-11-01"), null);
});

test("isFutureDate 只把今天之后的日期判为不可选", () => {
  assert.equal(client.isFutureDate("2026-11-20", "2026-11-19"), true);
  assert.equal(client.isFutureDate("2026-11-19", "2026-11-19"), false);
  assert.equal(client.isFutureDate("2026-11-01", "2026-11-19"), false);
  assert.equal(client.isFutureDate("bogus", "2026-11-19"), false);
});

test("monthOfDateKey / shiftMonthKey 处理跨月与月末溢出", () => {
  assert.deepEqual(client.monthOfDateKey("2026-11-19"), { year: 2026, month: 11 });
  assert.deepEqual(client.monthOfDateKey("bad", "2026-10-05"), { year: 2026, month: 10 });
  assert.equal(client.shiftMonthKey("2026-11-19", -1), "2026-10-19");
  // 1/31 加一个月夹到 2 月末
  assert.equal(client.shiftMonthKey("2026-01-31", 1), "2026-02-28");
  assert.equal(client.shiftMonthKey("2026-12-15", 1), "2027-01-15");
});

test("startOfWeekKey / endOfWeekKey 以周日为一周起点", () => {
  assert.equal(client.startOfWeekKey("2026-11-19"), "2026-11-15");
  assert.equal(client.endOfWeekKey("2026-11-19"), "2026-11-21");
  assert.equal(client.startOfWeekKey("2026-11-15"), "2026-11-15");
});

test("previewRange 只选起点时用悬停日做预览", () => {
  assert.deepEqual(client.previewRange({ from: "2026-11-05", to: null }, "2026-11-10"), {
    from: "2026-11-05",
    to: "2026-11-10"
  });
  assert.deepEqual(client.previewRange({ from: "2026-11-05", to: null }, "2026-11-01"), {
    from: "2026-11-01",
    to: "2026-11-05"
  });
  assert.deepEqual(client.previewRange({ from: "2026-11-01", to: "2026-11-19" }, "2026-11-10"), {
    from: "2026-11-01",
    to: "2026-11-19"
  });
  assert.deepEqual(client.previewRange({ from: "2026-11-05", to: null }, null), { from: null, to: null });
});

test("bandKind 起点画右半、终点画左半、中间整格", () => {
  assert.equal(client.bandKind("2026-11-01", "2026-11-19", "2026-11-01"), "start");
  assert.equal(client.bandKind("2026-11-01", "2026-11-19", "2026-11-10"), "middle");
  assert.equal(client.bandKind("2026-11-01", "2026-11-19", "2026-11-19"), "end");
  assert.equal(client.bandKind("2026-11-01", "2026-11-19", "2026-10-31"), null);
  assert.equal(client.bandKind("2026-11-01", "2026-11-19", "2026-11-20"), null);
  // 单日区间不画带
  assert.equal(client.bandKind("2026-11-05", "2026-11-05", "2026-11-05"), null);
  // 缺少终点（只选了起点）时由 previewRange 决定，bandKind 自身返回 null
  assert.equal(client.bandKind("2026-11-05", null, "2026-11-10"), null);
});

test("combinedTotals 把工具消耗并入消费金额与请求次数", () => {
  const ok = client.combinedTotals({
    totals: { cost: 1.57, requests: 339, tokens: 1140020 },
    tools: { ok: true, costAvailable: true, totals: { calls: 376, cost: 1.88 } }
  });
  assert.equal(ok.toolsOk, true);
  assert.equal(ok.cost, 3.45);
  assert.equal(ok.requests, 715);
  assert.equal(ok.tokens, 1140020);
  assert.equal(ok.costPartial, false);
  assert.equal(ok.requestsPartial, false);
  assert.equal(ok.modelCost, 1.57);
  assert.equal(ok.toolCost, 1.88);
});

test("combinedTotals 工具接口失败时退回模型口径并标记降级", () => {
  const failed = client.combinedTotals({
    totals: { cost: 1.57, requests: 339, tokens: 10 },
    tools: { ok: false, code: "internal" }
  });
  assert.equal(failed.toolsOk, false);
  assert.equal(failed.cost, 1.57);
  assert.equal(failed.requests, 339);
  assert.equal(failed.costPartial, true);
  assert.equal(failed.requestsPartial, true);
});

test("combinedTotals 仅费用接口缺失时仍并入调用次数", () => {
  const partial = client.combinedTotals({
    totals: { cost: 1.57, requests: 339, tokens: 10 },
    tools: { ok: true, costAvailable: false, totals: { calls: 376, cost: null } }
  });
  assert.equal(partial.toolsOk, true);
  assert.equal(partial.cost, 1.57);
  assert.equal(partial.costPartial, true);
  assert.equal(partial.requests, 715);
  assert.equal(partial.requestsPartial, false);
});

test("combinedTotals 缺字段时返回 null 而不是 NaN", () => {
  const empty = client.combinedTotals({});
  assert.equal(empty.cost, null);
  assert.equal(empty.requests, null);
  assert.equal(empty.tokens, null);
  assert.equal(client.combinedTotals(null).cost, null);
});

// ---- 渲染冒烟：面板与触发框能正常产出元素树（不依赖真实 React） ----------

/** 带 hooks 的 React 桩：只满足渲染路径，不做状态更新。 */
const hooksReactStub = {
  createElement: (...args) => ({ type: args[0], props: args[1] ?? {}, children: args.slice(2) }),
  Fragment: Symbol("Fragment"),
  useState: (initial) => [typeof initial === "function" ? initial() : initial, () => {}],
  useRef: (initial) => ({ current: initial ?? null }),
  useEffect: () => {},
  useLayoutEffect: () => {},
  useCallback: (fn) => fn,
  useMemo: (fn) => fn()
};

async function loadClientWithHooks() {
  const previousWindow = globalThis.window;
  let descriptor;
  globalThis.window = { __ModuleLoader__: { load(next) { descriptor = next; } } };
  try {
    const url = new URL("../client.js", import.meta.url);
    url.searchParams.set("hooks", String(Date.now()) + Math.random());
    await import(url.href);
    assert.ok(descriptor, "client bundle should register with ModuleLoader");
    return descriptor.factory((name) => {
      if (name === "react") return hooksReactStub;
      if (name === "react-dom/client") return { createRoot: () => ({ render() {}, unmount() {} }) };
      if (name === "react-dom") return { render() {}, unmountComponentAtNode: () => true };
      throw new Error("unexpected require: " + name);
    });
  } finally {
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
  }
}

/** 展开函数组件（React 桩不会自己渲染），再收集指定 type 的节点。 */
function render(node) {
  if (node === null || node === undefined) return null;
  if (Array.isArray(node)) return node.map(render);
  if (typeof node !== "object") return node;
  if (typeof node.type === "function") {
    return render(node.type({ ...node.props, children: node.children }));
  }
  return { ...node, children: Array.isArray(node.children) ? node.children.map(render) : node.children };
}

/** 深度收集元素树里指定 type 的节点。 */
function collect(node, type, out = []) {
  if (node === null || node === undefined) return out;
  if (Array.isArray(node)) {
    for (const item of node) collect(item, type, out);
    return out;
  }
  if (typeof node !== "object") return out;
  if (node.type === type) out.push(node);
  if (Array.isArray(node.children)) collect(node.children, type, out);
  return out;
}

test("CalendarPanel 渲染双月表头与日期格，端点/区间/今日标记正确", () => {
  const grids = [client.buildMonthGrid(2026, 10), client.buildMonthGrid(2026, 11)];
  const tree = render(client.CalendarPanel({
    panelRef: { current: null },
    panelStyle: { position: "fixed", left: 0, top: 0 },
    grids,
    staged: { from: "2026-11-01", to: "2026-11-19" },
    hoverKey: null,
    focusedKey: "2026-11-19",
    todayKey: "2026-11-19",
    canNext: false,
    onPrev: () => {},
    onNext: () => {},
    onPick: () => {},
    onHover: () => {},
    onKeyDown: () => {},
    label: "自定义区间",
    t: zhT
  }));

  // 表头：两个月份 × 7 个星期标签
  assert.equal(collect(tree, "div").filter((node) => node.props.className === "dsau-cal-wd").length, 14);
  // 标题：2026年10月 / 2026年11月
  const titles = collect(tree, "p")
    .filter((node) => node.props.className === "dsau-cal-title")
    .map((node) => node.children[0]);
  assert.deepEqual(titles, ["2026年10月", "2026年11月"]);

  // 日期按钮：10 月 31 天 + 11 月 30 天
  const days = collect(tree, "button").filter((node) => node.props.className === "dsau-cal-day");
  assert.equal(days.length, 61);
  const byKey = new Map(days.map((node) => [node.props["data-focus-key"], node]));
  // 端点：深色圆
  assert.equal(byKey.get("2026-11-01").props["data-edge"], "1");
  assert.equal(byKey.get("2026-11-19").props["data-edge"], "1");
  // 区间内：逐日高亮（含 11-02..11-18）
  assert.equal(byKey.get("2026-11-02").props["data-in-range"], "1");
  assert.equal(byKey.get("2026-11-18").props["data-in-range"], "1");
  // 区间外：不高亮
  assert.equal(byKey.get("2026-10-31").props["data-in-range"], "0");
  assert.equal(byKey.get("2026-11-20").props["data-in-range"], "0");
  // 区间带：起点格右半、中间整格、终点格左半，区间外不画
  const cells = collect(tree, "div").filter((node) => node.props.className === "dsau-cal-cell");
  const bandOf = (key) => {
    const hit = cells.find((node) => {
      const inner = collect(node.children, "button");
      return inner.length > 0 && inner[0].props["data-focus-key"] === key;
    });
    return hit === undefined ? undefined : hit.props["data-band"];
  };
  assert.equal(bandOf("2026-11-01"), "start");
  assert.equal(bandOf("2026-11-02"), "middle");
  assert.equal(bandOf("2026-11-18"), "middle");
  assert.equal(bandOf("2026-11-19"), "end");
  assert.equal(bandOf("2026-10-31"), undefined);
  assert.equal(bandOf("2026-11-20"), undefined);
  // 今天之后置灰（20 号之后）
  assert.equal(byKey.get("2026-11-20").props["data-disabled"], "1");
  assert.equal(byKey.get("2026-11-19").props["data-disabled"], "0");
  // 今日恰为端点 → 右下角圆点；今日非端点 → 无圆点
  const dotCount = (node) =>
    collect(node.children, "span").filter((child) => child.props.className === "dsau-cal-dot").length;
  assert.equal(dotCount(byKey.get("2026-11-19")), 1);
  assert.equal(dotCount(byKey.get("2026-11-18")), 0);
  assert.equal(dotCount(byKey.get("2026-11-01")), 0);
  // 下个月按钮在当前月被禁用
  const navs = collect(tree, "button").filter((node) => node.props.className === "dsau-cal-nav");
  assert.equal(navs.length, 2);
  assert.equal(navs[1].props.disabled, true);
});

test("RangeSelector 在未展开时渲染只读触发框与应用按钮", async () => {
  const withHooks = await loadClientWithHooks();
  const tree = render(withHooks.RangeSelector({
    range: { from: "2026-11-01", to: "2026-11-19" },
    onApply: () => {},
    t: zhT
  }));
  const buttons = collect(tree, "button");
  const trigger = buttons.find((node) => node.props.className === "dsau-trigger");
  assert.ok(trigger, "should render the range trigger");
  assert.equal(trigger.props["aria-expanded"], "false");
  assert.equal(trigger.props["aria-haspopup"], "dialog");
  // 触发框内容 = 2026/11/01 → 2026/11/19
  const texts = [];
  const walk = (node) => {
    if (node === null || node === undefined) return;
    if (Array.isArray(node)) return node.forEach(walk);
    if (typeof node === "string" || typeof node === "number") return texts.push(String(node));
    if (typeof node === "object" && Array.isArray(node.children)) node.children.forEach(walk);
  };
  walk(trigger.children);
  assert.ok(texts.includes("2026/11/01"));
  assert.ok(texts.includes("2026/11/19"));
  // 未展开时不渲染日历面板
  assert.equal(collect(tree, "div").filter((node) => node.props.className === "dsau-cal").length, 0);
  // 0.5.0：没有「应用」按钮——关闭日历即按所选区间筛选，触发框是这一行里唯一的按钮
  const row = collect(tree, "div").find((node) => node.props.className === "dsau-range-row");
  const rowButtons = collect(row.children, "button");
  assert.equal(rowButtons.length, 1);
  assert.equal(rowButtons[0].props.className, "dsau-trigger");
});

test("DeepSeekPanel 拆成用量 / 模型用量明细 / 网页搜索与抓取三张卡片，标签栏吸附", async () => {
  const withHooks = await loadClientWithHooks();
  const tree = render(withHooks.DeepSeekPanel({ credApi: null, t: zhT }));

  // 卡片标题按新顺序排列（前两张是原有的令牌与余额卡片；t 桩直接回显键名）
  const titles = collect(tree, "p")
    .filter((node) => node.props.style !== undefined && node.props.style.fontSize === 13 && node.props.style.fontWeight === 600)
    .map((node) => node.children[0]);
  assert.deepEqual(titles, ["moduleToken", "moduleBalance", "moduleUsage", "moduleModels", "moduleTools"]);

  // 标签栏使用 sticky 吸附（标签栏在 AccountPage 里，单独渲染一次）
  const pageTree = render(withHooks.AccountPage({ credApi: null, t: zhT, embedded: true }));
  const tabs = collect(pageTree, "div").find(
    (node) => node.props.style !== undefined && node.props.style.position === "sticky"
  );
  assert.ok(tabs, "tab row should be sticky");
  assert.equal(tabs.props.style.top, 0);
  assert.equal(tabs.props.style.background, "var(--dsw-alias-bg-layer-2)");

  // 「用量」卡片里包含时间维度筛选（预设下拉 + 只读区间触发框）
  const select = collect(tree, "select")[0];
  assert.ok(select, "usage card should host the preset select");
  const trigger = collect(tree, "button").find((node) => node.props.className === "dsau-trigger");
  assert.ok(trigger, "usage card should host the range trigger");
  // 旧的 <input type="date"> 已移除
  assert.equal(collect(tree, "input").filter((node) => node.props.type === "date").length, 0);
});

test("ensureCalendarStyles 遇到旧样式表会覆盖内容（热更新后样式不落后于 JS）", () => {
  const previousDocument = globalThis.document;
  const appended = [];
  const staleStyle = { textContent: ".dsau-old{color:red}" };
  globalThis.document = {
    head: { appendChild: (el) => appended.push(el) },
    createElement: () => ({ dataset: {}, textContent: "" }),
    querySelector: (selector) => (String(selector).includes("dsh-account-usage/calendar.css") ? staleStyle : null)
  };
  try {
    client.ensureCalendarStyles();
    // 旧样式表被就地覆盖成当前 CSS，而不是被跳过
    assert.equal(staleStyle.textContent, client.CALENDAR_CSS);
    assert.equal(appended.length, 0, "不应重复插入 style 元素");
    // 内容已经一致时再调用不产生副作用
    client.ensureCalendarStyles();
    assert.equal(staleStyle.textContent, client.CALENDAR_CSS);
    assert.equal(appended.length, 0);
  } finally {
    if (previousDocument === undefined) delete globalThis.document;
    else globalThis.document = previousDocument;
  }
});

test("ensureCalendarStyles 在没有样式表时插入一份", () => {
  const previousDocument = globalThis.document;
  const appended = [];
  globalThis.document = {
    head: { appendChild: (el) => appended.push(el) },
    createElement: () => ({ dataset: {}, textContent: "" }),
    querySelector: () => null
  };
  try {
    client.ensureCalendarStyles();
    assert.equal(appended.length, 1);
    assert.equal(appended[0].textContent, client.CALENDAR_CSS);
    assert.equal(appended[0].dataset.pluginCss, "dsh-account-usage/calendar.css");
  } finally {
    if (previousDocument === undefined) delete globalThis.document;
    else globalThis.document = previousDocument;
  }
});

test("Token 图用三种蓝色区分 命中/未命中/输出，堆叠与图例顺序一致", async () => {
  const withHooks = await loadClientWithHooks();
  const colors = withHooks.TOKEN_COLORS;
  // 三段颜色必须互不相同，且命中比未命中浅、输出最深
  assert.notEqual(colors.hit, colors.miss);
  assert.notEqual(colors.miss, colors.out);
  assert.equal(colors.hit, "var(--dsw-static-blue-300)");
  assert.equal(colors.miss, "var(--dsw-static-blue-400)");
  assert.equal(colors.out, "var(--dsw-static-blue-600)");

  const days = [
    { date: "2026-11-04", models: { m: { cacheHitTokens: 6400, cacheMissTokens: 285854, responseTokens: 5191 } } }
  ];
  const chart = render(withHooks.TokenChart({ days, model: "m", currency: "CNY", t: zhT }));
  const fills = collect(chart, "rect")
    .map((node) => node.props.fill)
    .filter((fill) => fill === colors.hit || fill === colors.miss || fill === colors.out);
  // 自下而上：命中 → 未命中 → 输出
  assert.deepEqual(fills, [colors.hit, colors.miss, colors.out]);

  const legend = render(withHooks.TokenLegend({ t: zhT }));
  const legendColors = collect(legend, "span")
    .map((node) => (node.props.style === undefined ? null : node.props.style.background))
    .filter(Boolean);
  assert.deepEqual(legendColors, [colors.hit, colors.miss, colors.out]);
});

test("Token 图 tooltip 一行 = 色块 + 名称 + 数值", async () => {
  const withHooks = await loadClientWithHooks();
  const row = withHooks.tokenTooltipRow("var(--dsw-static-blue-300)", "输入（命中缓存）", "6,400");
  const spans = collect(row, "span");
  assert.equal(spans.length, 3);
  assert.equal(spans[0].props.style.background, "var(--dsw-static-blue-300)");
  assert.equal(spans[1].children[0], "输入（命中缓存）");
  assert.equal(spans[2].children[0], "6,400");
  assert.equal(spans[2].props.style.marginLeft, "auto");
});

test("monthSpanOf 按自然月计数（口径与宿主 monthsBetween 一致）", async () => {
  const client = await loadClientBundle();
  assert.equal(client.MAX_RANGE_MONTHS, 3);
  // 同月、跨月、恰好 3 个月、跨年
  assert.equal(client.monthSpanOf("2026-11-05", "2026-11-20"), 1);
  assert.equal(client.monthSpanOf("2026-09-01", "2026-11-20"), 3);
  assert.equal(client.monthSpanOf("2026-08-31", "2026-11-20"), 4);
  assert.equal(client.monthSpanOf("2025-12-15", "2026-02-01"), 3);
  // 顺序无关
  assert.equal(client.monthSpanOf("2026-11-20", "2026-09-01"), 3);
  // 非法输入返回 0（不抛错）
  assert.equal(client.monthSpanOf("", "2026-11-20"), 0);
  assert.equal(client.monthSpanOf("2026-11-20", null), 0);
});

test("withinMonthLimit 只限制超出方向，3 个自然月边界精确", async () => {
  const client = await loadClientBundle();
  const anchor = "2026-09-05";
  // 往后：11/30 是本年第 3 个月的最后一天，12/01 越界
  assert.equal(client.withinMonthLimit("2026-11-30", anchor, 3), true);
  assert.equal(client.withinMonthLimit("2026-12-01", anchor, 3), false);
  // 往前：7/01 是第 3 个月的第一天，6/30 越界
  assert.equal(client.withinMonthLimit("2026-07-01", anchor, 3), true);
  assert.equal(client.withinMonthLimit("2026-06-30", anchor, 3), false);
  // 同一天恒成立
  assert.equal(client.withinMonthLimit(anchor, anchor, 3), true);
  // 非法输入放行（交给别处校验），不误禁用
  assert.equal(client.withinMonthLimit("bad", anchor, 3), true);
});

test("clampRangeToMonths 保持 to 不动、把 from 后移到上限内", async () => {
  const client = await loadClientBundle();
  const clamped = client.clampRangeToMonths("2026-08-01", "2026-11-20", 3);
  assert.equal(clamped.to, "2026-11-20", "终点不应被改动");
  assert.equal(clamped.from, "2026-09-01", "起点应后移到第 3 个月月初");
  assert.equal(client.monthSpanOf(clamped.from, clamped.to), 3);
  // 已满足上限时原样返回
  const ok = client.clampRangeToMonths("2026-09-10", "2026-11-20", 3);
  assert.deepEqual(ok, { from: "2026-09-10", to: "2026-11-20" });
  // 起点晚于终点时会被 normalizeRange 摆正后再判断
  const swapped = client.clampRangeToMonths("2026-11-20", "2026-08-01", 3);
  assert.equal(swapped.from, "2026-09-01");
  assert.equal(swapped.to, "2026-11-20");
  // 非法输入原样返回，不抛错
  assert.deepEqual(client.clampRangeToMonths("bad", "2026-11-20", 3), { from: "bad", to: "2026-11-20" });
});

test("区间上限的样式与文案：越界规则已就位、裁剪提示已移除", async () => {
  const client = await loadClientBundle();
  assert.equal(client.MAX_RANGE_MONTHS, 3);
  // 越界日期的指针语义来自 CALENDAR_CSS；裁剪提示条已从界面移除
  assert.ok(client.CALENDAR_CSS.includes('.dsau-cal-day[data-limit=\"1\"]'), "应有越界日期样式");
  assert.equal(client.OVERVIEW_CSS.includes("rangeClipped"), false);
  assert.equal(client.CALENDAR_CSS.includes("rangeClipped"), false);
});

test("越界日期带 data-limit 与原生 title，且不可点击", async () => {
  const client = await loadClientBundle();
  const t = (key) =>
    ({
      rangeLimitTooltip: "最多可选 {n} 个自然月",
      rangeWeekdays: "日,一,二,三,四,五,六",
      rangeMonthTitle: "{year}年{month}",
      rangeMonthNames: "1月,2月,3月,4月,5月,6月,7月,8月,9月,10月,11月,12月"
    })[key] ?? key;
  const grid = client.buildMonthGrid(2026, 12);
  const tree = client.CalendarMonth({
    grid,
    staged: { from: "2026-09-05", to: null },
    hoverKey: null,
    focusedKey: null,
    todayKey: "2026-12-31",
    onPick: () => {},
    onHover: () => {},
    t
  });
  const buttons = collect(tree, "button");
  const over = buttons.filter((node) => node.props["data-limit"] === "1");
  assert.ok(over.length > 0, "应有被限制的日期");
  assert.equal(over[0].props.title, "最多可选 3 个自然月");
  assert.equal(over[0].props["aria-disabled"], "true");
  assert.equal(over[0].props.onClick, undefined, "越界日期不应可点击");
  // 12 月的所有日期都越界（9 月锚点 + 3 个月 = 到 11 月为止）
  assert.equal(over.length, 31);
});

test("requestAccountTab / consumeAccountTabRequest 是一次性通道", async () => {
  const client = await loadClientBundle();
  // 1) 面板尚未挂载（无订阅者）：请求保留为待消费标记
  assert.equal(client.consumeAccountTabRequest(), null);
  client.requestAccountTab("deepseek");
  assert.equal(client.consumeAccountTabRequest(), "deepseek");
  assert.equal(client.consumeAccountTabRequest(), null, "消费一次即清空");
  // 2) 面板已挂载（有订阅者）：当场送达，且不残留标记，
  //    否则重新挂载时会把用过的请求再消费一遍，跳转就变成了两次
  const live = [];
  const off = client.subscribeAccountTabRequest((tab) => live.push(tab));
  client.requestAccountTab("deepseek");
  assert.deepEqual(live, ["deepseek"]);
  assert.equal(client.consumeAccountTabRequest(), null, "已送达的请求不应残留");
  // 3) 退订后重新回到「待消费」语义
  off();
  client.requestAccountTab("opencode");
  assert.deepEqual(live, ["deepseek"], "退订后不再收到");
  assert.equal(client.consumeAccountTabRequest(), "opencode");
  // 4) 非法输入被忽略，不影响已有标记
  client.requestAccountTab("deepseek");
  client.requestAccountTab("");
  assert.equal(client.consumeAccountTabRequest(), "deepseek");
  assert.equal(client.consumeAccountTabRequest(), null);
});
