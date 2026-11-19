// 「概览」标签页的纯函数与渲染冒烟测试（0.5.0）。
import assert from "node:assert/strict";
import test from "node:test";

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

async function loadClient() {
  const previousWindow = globalThis.window;
  let descriptor;
  globalThis.window = { __ModuleLoader__: { load(next) { descriptor = next; } } };
  try {
    const url = new URL("../client.js", import.meta.url);
    url.searchParams.set("overview", String(Date.now()) + Math.random());
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

const client = await loadClient();

/** 展开函数组件并收集指定 type 的节点。 */
function render(node) {
  if (node === null || node === undefined) return null;
  if (Array.isArray(node)) return node.map(render);
  if (typeof node !== "object") return node;
  if (typeof node.type === "function") return render(node.type({ ...node.props, children: node.children }));
  return { ...node, children: Array.isArray(node.children) ? node.children.map(render) : node.children };
}

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

const ZH = (key) =>
  ({
    numberScale: "wan",
    durationDay: "天",
    durationHour: "小时",
    durationMinute: "分",
    durationSecond: "秒",
    daysCount: "{n} 天",
    heatmapMonths: "1月,2月,3月,4月,5月,6月,7月,8月,9月,10月,11月,12月",
    heatmapDayTip: "{date}",
    heatmapWeekTip: "{date} 起的一周",
    heatmapCumulativeTip: "累计至 {date}",
    heatmapValueUnit: "个 Token",
    statTotalTokens: "累计 Token 数",
    statPeakTokens: "Token 使用峰值",
    statLongestTask: "最长任务用时",
    statLongestStreak: "最长连续天数",
    statCurrentStreak: "当前连续天数"
  })[key] ?? key;

test("dayKeysOfYear 覆盖平年 365 与闰年 366", () => {
  assert.equal(client.dayKeysOfYear(2026).length, 365);
  assert.equal(client.dayKeysOfYear(2024).length, 366);
  assert.equal(client.dayKeysOfYear(2024)[59], "2024-02-29");
  assert.equal(client.dayKeysOfYear(2026)[0], "2026-01-01");
  assert.equal(client.dayKeysOfYear(2026)[364], "2026-12-31");
});

test("sumYearTokens / peakOfYear / longestStreakOfYear 只统计当年", () => {
  const days = {
    "2025-12-31": 999,
    "2026-01-01": 100,
    "2026-01-02": 50,
    "2026-01-03": 0,
    "2026-01-04": 30,
    "2026-01-05": 20,
    "2026-11-04": 400,
    "2027-01-01": 888
  };
  assert.equal(client.sumYearTokens(days, 2026), 600);
  assert.deepEqual(client.peakOfYear(days, 2026), { date: "2026-11-04", tokens: 400 });
  assert.equal(client.longestStreakOfYear(days, 2026), 2);
  assert.deepEqual(client.peakOfYear({}, 2026), { date: null, tokens: 0 });
  assert.equal(client.longestStreakOfYear({}, 2026), 0);
});

test("currentStreakOfDays 今天没用过时从昨天开始数", () => {
  const days = { "2026-11-16": 5, "2026-11-17": 5, "2026-11-18": 5 };
  assert.equal(client.currentStreakOfDays(days, "2026-11-19"), 3);
  assert.equal(client.currentStreakOfDays({ ...days, "2026-11-19": 1 }, "2026-11-19"), 4);
  assert.equal(client.currentStreakOfDays({ "2026-11-18": 5 }, "2026-11-19"), 1);
  assert.equal(client.currentStreakOfDays({}, "2026-11-19"), 0);
  assert.equal(client.currentStreakOfDays(days, "bad"), 0);
});

test("buildYearWeeks 按周分列，首尾补齐且标出跨年格", () => {
  const grid = client.buildYearWeeks(2026);
  assert.equal(grid.year, 2026);
  assert.equal(grid.weeks.length, 53);
  for (const week of grid.weeks) assert.equal(week.length, 7);
  // 2026-01-01 是周四，一周从周一起 → 首周从 2025-12-29（周一）开始
  assert.equal(grid.weeks[0][0].key, "2025-12-29");
  assert.equal(grid.weeks[0][0].inYear, false);
  assert.equal(grid.weeks[0][3].key, "2026-01-01");
  assert.equal(grid.weeks[0][3].inYear, true);
  // 每一列都以周一开头、以周日结尾
  for (const week of grid.weeks) {
    assert.equal(new Date(week[0].key + "T00:00:00").getDay(), 1, `${week[0].key} 应为周一`);
    assert.equal(new Date(week[6].key + "T00:00:00").getDay(), 0, `${week[6].key} 应为周日`);
  }
  // 末格补到该列末尾的周日 2027-01-03
  const last = grid.weeks[grid.weeks.length - 1];
  assert.equal(last[6].key, "2027-01-03");
  assert.equal(last[6].inYear, false);
  const inYearCount = grid.weeks.flat().filter((cell) => cell.inYear).length;
  assert.equal(inYearCount, 365);
});

test("weekTotalsOf / cumulativeByDay 与每天数据一致", () => {
  const days = { "2026-01-01": 10, "2026-01-02": 5, "2026-01-08": 7, "2025-12-28": 100 };
  const grid = client.buildYearWeeks(2026);
  const weekly = client.weekTotalsOf(days, grid.weeks);
  // 首周含 2025-12-28（不计入）与 2026-01-01、01-02
  assert.equal(weekly[0], 15);
  assert.equal(weekly[1], 7);
  assert.equal(weekly.reduce((sum, value) => sum + value, 0), 22);
  const cumulative = client.cumulativeByDay(days, grid.weeks);
  assert.equal(cumulative["2026-01-01"], 10);
  assert.equal(cumulative["2026-01-02"], 15);
  assert.equal(cumulative["2026-12-31"], 22);
  assert.equal(cumulative["2025-12-28"], undefined);
});

test("quantileThresholds 空集合返回全 0，非空时严格递增", () => {
  assert.deepEqual(client.quantileThresholds([]), [0, 0, 0]);
  assert.deepEqual(client.quantileThresholds([0, 0, 0]), [0, 0, 0]);
  const thresholds = client.quantileThresholds([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  // 三条边界切出四档，最高档（本集合里的最大值）必须真的可达
  assert.equal(thresholds.length, 3);
  for (let i = 1; i < thresholds.length; i += 1) assert.ok(thresholds[i] > thresholds[i - 1]);
  // 大量相同值也要保持递增，避免整张图同色
  const flat = client.quantileThresholds([5, 5, 5, 5, 5]);
  for (let i = 1; i < flat.length; i += 1) assert.ok(flat[i] > flat[i - 1]);
});

test("quantileThresholds 在数量级上分档，1M 与 1亿 落在不同档", () => {
  // 真实用量跨 4 个数量级：万 → 亿。线性分位会把 1M 压成「无色」，log 分位不会。
  const values = [50000, 120000, 800000, 1500000, 6000000, 20000000, 90000000, 300000000];
  const thresholds = client.quantileThresholds(values);
  for (let i = 1; i < thresholds.length; i += 1) assert.ok(thresholds[i] > thresholds[i - 1]);
  // 1M 量级与 1亿 量级必须落在不同色阶
  assert.ok(
    client.levelOfValue(1500000, thresholds) < client.levelOfValue(300000000, thresholds),
    "1.5M 与 3亿 不应同档"
  );
  // 四档都要用得上：最小值仍有着色，最大值必须落在最深一档
  assert.equal(client.levelOfValue(50000, thresholds), 1);
  assert.equal(client.levelOfValue(300000000, thresholds), 4);
});

test("levelOfValue 只有 0 Token 无填充，任何正数至少 1 档", () => {
  const thresholds = [10, 20, 30];
  assert.equal(client.levelOfValue(0, thresholds), 0);
  assert.equal(client.levelOfValue(-5, thresholds), 0);
  assert.equal(client.levelOfValue(null, thresholds), 0);
  // 关键回归：低于最小阈值的正数仍要有颜色
  assert.equal(client.levelOfValue(1, thresholds), 1);
  assert.equal(client.levelOfValue(5, thresholds), 1);
  // 达到第 i 条边界即升到第 i+1 档：这样才能用到最深的第 4 档
  assert.equal(client.levelOfValue(10, thresholds), 2);
  assert.equal(client.levelOfValue(25, thresholds), 3);
  assert.equal(client.levelOfValue(35, thresholds), 4);
  assert.equal(client.levelOfValue(100, thresholds), 4);
});

test("heatLevelOf：每天按当日值；每周与累计总量都自下而上按「有用量的天数」填充", () => {
  const weeks = client.buildYearWeeks(2026).weeks;
  // 以周一为一周起点：2026-01-05 是周一(行0)、01-07 周三(行2)、01-09 周五(行4)，
  // 这一周为 01-05(周一) … 01-11(周日)，共 3 天有用量
  const days = {
    "2026-01-05": 100,
    "2026-01-07": 300,
    "2026-01-09": 200
  };
  const weeklyTotals = client.weekTotalsOf(days, weeks);
  const cumulative = client.cumulativeByDay(days, weeks);
  const todayKey = "2026-11-19";
  const activeDays = client.weekActiveDaysOf(days, weeks);
  const weekCumulative = client.weekCumulativeOf(weeks, cumulative, todayKey);
  const weekIndex = weeks.findIndex((cells) => cells.some((cell) => cell.key === "2026-01-05"));
  const thresholds = client.quantileThresholds(weeklyTotals.filter((v) => v > 0));
  const rowMap = new Map();
  for (const cells of weeks) cells.forEach((cell, index) => rowMap.set(cell.key, index));
  const rowOf = (key) => rowMap.get(key) ?? null;
  const context = { days, weeklyTotals, weekCumulative, cumulative, thresholds, todayKey, activeDays, rowOf };

  assert.equal(activeDays[weekIndex], 3, "该周应统计到 3 个有用量的天");

  // 每周：整列同色，且只填末尾 3 格（自下而上），其余留白
  const level = client.heatLevelOf("weekly", "2026-01-11", weekIndex, context);
  assert.ok(level > 0, "最底一格（周日）应着色");
  // 行 4/5/6（周五/周六/周日）= 最底 3 格，应着色
  for (const key of ["2026-01-09", "2026-01-10", "2026-01-11"]) {
    assert.equal(client.heatLevelOf("weekly", key, weekIndex, context), level, `${key} 应同色`);
  }
  // 行 0–3（周一至周四）在上方，应留白
  for (const key of ["2026-01-05", "2026-01-06", "2026-01-07", "2026-01-08"]) {
    assert.equal(client.heatLevelOf("weekly", key, weekIndex, context), 0, `${key} 应留白`);
  }

  // 累计总量：同样自下而上填 3 格，颜色取该周末（周日）的累计值
  const cumLevel = client.heatLevelOf("cumulative", "2026-01-11", weekIndex, context);
  assert.ok(cumLevel > 0);
  assert.equal(client.heatLevelOf("cumulative", "2026-01-09", weekIndex, context), cumLevel);
  assert.equal(client.heatLevelOf("cumulative", "2026-01-05", weekIndex, context), 0, "顶部应留白");

  // 每天：按当日用量分档，周三 > 周一
  assert.ok(
    client.heatLevelOf("daily", "2026-01-07", weekIndex, context) >=
      client.heatLevelOf("daily", "2026-01-05", weekIndex, context)
  );
  // 没有用量的日期在每天模式仍是 0
  assert.equal(client.heatLevelOf("daily", "2026-01-06", weekIndex, context), 0);
});

test("formatTokenCount 中文用万/亿，英文用 K/M/B", () => {
  assert.equal(client.formatTokenCount(1910000000, "wan"), "19.1亿");
  assert.equal(client.formatTokenCount(180000000, "wan"), "1.8亿");
  assert.equal(client.formatTokenCount(123456, "wan"), "12.3万");
  assert.equal(client.formatTokenCount(9999, "wan"), "9,999");
  assert.equal(client.formatTokenCount(1910000000, "short"), "1.91B");
  assert.equal(client.formatTokenCount(1500000, "short"), "1.5M");
  assert.equal(client.formatTokenCount(2500, "short"), "2.5K");
  assert.equal(client.formatTokenCount(999, "short"), "999");
  assert.equal(client.formatTokenCount(null, "short"), "—");
});

test("formatDurationMs 按量级取两种单位", () => {
  const units = { day: "天", hour: "小时", minute: "分", second: "秒" };
  assert.equal(client.formatDurationMs(7020000, units), "1小时57分");
  assert.equal(client.formatDurationMs(32 * 86400000, units), "32天");
  assert.equal(client.formatDurationMs(2 * 86400000 + 3 * 3600000, units), "2天3小时");
  assert.equal(client.formatDurationMs(45000, units), "45秒");
  assert.equal(client.formatDurationMs(0, units), "0秒");
  assert.equal(client.formatDurationMs(null, units), "—");
});

test("OverviewPanel 渲染标题、年度下拉与刷新按钮（加载态不抛错）", () => {
  const tree = render(client.OverviewPanel({ t: ZH }));
  const texts = [];
  const walk = (node) => {
    if (node === null || node === undefined) return;
    if (Array.isArray(node)) return node.forEach(walk);
    if (typeof node === "string" || typeof node === "number") return texts.push(String(node));
    if (typeof node === "object" && Array.isArray(node.children)) node.children.forEach(walk);
  };
  walk(tree);
  assert.ok(texts.includes("overviewTitle"), "should render the panel title");
  // 年度下拉是受控 select，默认当年
  const select = collect(tree, "select")[0];
  assert.ok(select, "should render the year select");
  assert.equal(select.props.value, String(new Date().getFullYear()));
  assert.equal(select.props["aria-label"], "overviewYear");
});

test("AccountPage 默认落在「概览」标签，且它排在最左", () => {
  const tree = render(client.AccountPage({ credApi: null, t: ZH, embedded: true }));
  const tabs = collect(tree, "div").find(
    (node) => node.props.style !== undefined && node.props.style.position === "sticky"
  );
  assert.ok(tabs, "tab row should exist");
  const buttons = collect(tabs, "button");
  assert.equal(buttons.length, 3);
  const labels = buttons.map((node) => node.children[0]);
  assert.deepEqual(labels, ["tabOverview", "tabDeepseek", "tabOpencode"]);
  // 默认标签用 active 样式（有下边框主色）
  assert.equal(buttons[0].props.style.borderBottom, "2px solid var(--dsw-alias-state-business-primary)");
  assert.notEqual(buttons[1].props.style.borderBottom, "2px solid var(--dsw-alias-state-business-primary)");
});

test("clampTipPosition 把提示框夹在视口内，右边贴边不溢出", () => {
  // 锚点在视口最右：框右边缘不得超过 viewport - margin
  const right = client.clampTipPosition(1190, 300, 180, 29, 1200, 8);
  assert.equal(right.left + 180, 1192);
  assert.equal(right.left, 1012);
  // 锚点在视口最左：左边距不小于 margin
  const left = client.clampTipPosition(2, 300, 180, 29, 1200, 8);
  assert.equal(left.left, 8);
  // 居中情况：以锚点为中心
  const middle = client.clampTipPosition(600, 300, 180, 29, 1200, 8);
  assert.equal(middle.left, 510);
  assert.equal(middle.top, 300 - 29 - 6);
});

test("clampTipPosition 上方空间不足时翻到锚点下方", () => {
  const flipped = client.clampTipPosition(600, 10, 180, 40, 1200, 8);
  assert.equal(flipped.top, 34);
  // 参数缺失时退化不抛错
  const degraded = client.clampTipPosition(null, null, null, null, null);
  assert.equal(degraded.left, 8);
  assert.equal(degraded.top, 24);
});

test("热力图提示框使用 fixed 定位，不再被滚动容器裁切", () => {
  const css = client.CALENDAR_CSS; // 确认导出可用
  assert.equal(typeof css, "string");
  // overview 样式通过 ensureOverviewStyles 注入；这里校验固定定位与 z-index 已就位
  const fake = { textContent: "" };
  const appended = [];
  const previousDocument = globalThis.document;
  globalThis.document = {
    head: { appendChild: (el) => appended.push(el) },
    createElement: () => ({ dataset: {}, textContent: "" }),
    querySelector: () => fake
  };
  try {
    client.ensureOverviewStyles();
    assert.ok(fake.textContent.includes(".dsau-heat-tip{position:fixed"), "tooltip 应使用 fixed 定位");
    assert.ok(fake.textContent.includes("z-index:20"), "tooltip 应有足够层级");
    assert.ok(fake.textContent.includes(".dsau-stat-value{"), "统计卡字号规则应存在");
    // 提示框为两行结构：描述行 + 加粗的数值行
    assert.ok(fake.textContent.includes(".dsau-heat-tip-caption{"), "提示框应有描述行样式");
    assert.ok(fake.textContent.includes(".dsau-heat-tip-value{"), "提示框应有数值行样式");
  } finally {
    if (previousDocument === undefined) delete globalThis.document;
    else globalThis.document = previousDocument;
  }
});

test("thinMonthAnchors 在列宽不足时抽稀月份标签", () => {
  // 53 列 / 12 个月：正常间隔 4 列，全部保留
  const even = [];
  for (let i = 0; i < 12; i += 1) even.push({ month: i + 1, weekIndex: i * 4 });
  assert.equal(client.thinMonthAnchors(even, 4).length, 12);
  // 间隔不足 4 列时跳过拥挤的月份
  const tight = [
    { month: 1, weekIndex: 0 },
    { month: 2, weekIndex: 2 },
    { month: 3, weekIndex: 5 },
    { month: 4, weekIndex: 6 },
    { month: 5, weekIndex: 9 }
  ];
  assert.deepEqual(
    client.thinMonthAnchors(tight, 4).map((item) => item.month),
    [1, 3, 5]
  );
  // 非法输入不抛错
  assert.deepEqual(client.thinMonthAnchors(null), []);
  assert.deepEqual(client.thinMonthAnchors([null, { month: 1, weekIndex: 0 }]).length, 1);
});

test("中英文词典都提供月份与统计文案（不出现裸键名）", () => {
  const css = client.OVERVIEW_CSS;
  assert.ok(css.includes(".dsau-heat-month"), "月份标签样式应存在");
  // 通过渲染中文面板确认月份标签取到的是本地化文案而不是键名
  const tree = render(client.OverviewPanel({ t: (key) => ({ heatmapMonths: "1月,2月,3月,4月,5月,6月,7月,8月,9月,10月,11月,12月" })[key] ?? key }));
  const texts = [];
  const walk = (node) => {
    if (node === null || node === undefined) return;
    if (Array.isArray(node)) return node.forEach(walk);
    if (typeof node === "string" || typeof node === "number") return texts.push(String(node));
    if (typeof node === "object" && Array.isArray(node.children)) node.children.forEach(walk);
  };
  walk(tree);
  assert.equal(texts.includes("heatmapMonths"), false, "不应把键名直接渲染到界面");
});

test("weekLastKeyOf / weekCumulativeOf：取该列最后一个不晚于今天的日期", () => {
  const weeks = client.buildYearWeeks(2026).weeks;
  const days = { "2026-01-05": 100, "2026-01-07": 300 };
  const cumulative = client.cumulativeByDay(days, weeks);
  const weekIndex = weeks.findIndex((cells) => cells.some((cell) => cell.key === "2026-01-05"));

  // 今天在这一周之后：代表日应是该周最后一个属于本年的日期（周日 01-11）
  const lastKeys = client.weekLastKeyOf(weeks, "2026-11-19");
  assert.equal(lastKeys[weekIndex], "2026-01-11");

  // 今天正好卡在该周中间：代表日不能超过今天，累计值也只算到那天
  const clipped = client.weekLastKeyOf(weeks, "2026-01-07");
  assert.equal(clipped[weekIndex], "2026-01-07");
  const cum = client.weekCumulativeOf(weeks, cumulative, "2026-01-07");
  assert.equal(cum[weekIndex], 400, "只累加 01-05 与 01-07");
  // 放宽到今天之后，累计值包含 01-09（该周没有 01-09 的数据，仍是 400）
  assert.equal(client.weekCumulativeOf(weeks, cumulative, "2026-11-19")[weekIndex], 400);

  // 累计值按列单调不减：后一列的累计值不会小于前一列
  const cumAll = client.weekCumulativeOf(weeks, cumulative, "2026-11-19");
  for (let i = 1; i < cumAll.length; i += 1) {
    assert.ok(cumAll[i] >= cumAll[i - 1], `第 ${i} 列的累计值不应小于前一列`);
  }
});
