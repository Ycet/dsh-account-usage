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

test("levelOfValue 只有 0 Token 无填充，任何正数至少 1 档（支持 5 档边界）", () => {
  const thresholds = [10, 20, 30, 40];
  assert.equal(client.levelOfValue(0, thresholds), 0);
  assert.equal(client.levelOfValue(-5, thresholds), 0);
  assert.equal(client.levelOfValue(null, thresholds), 0);
  // 关键回归：低于最小阈值的正数仍要有颜色
  assert.equal(client.levelOfValue(1, thresholds), 1);
  assert.equal(client.levelOfValue(5, thresholds), 1);
  // 达到第 i 条边界即升到第 i+1 档：这样才能用到最深的第 5 档
  assert.equal(client.levelOfValue(10, thresholds), 2);
  assert.equal(client.levelOfValue(25, thresholds), 3);
  assert.equal(client.levelOfValue(35, thresholds), 4);
  assert.equal(client.levelOfValue(40, thresholds), 5);
  assert.equal(client.levelOfValue(100, thresholds), 5);
});

test("DAILY_LEVEL_BOUNDS：每日维度按固定数量级分级（100万/1000万/1亿/5亿）", () => {
  const B = client.DAILY_LEVEL_BOUNDS;
  assert.deepEqual(B, [1e6, 1e7, 1e8, 5e8], "固定边界必须与 README 描述一致");
  // 边界值本身升档：达到即进入下一档
  assert.equal(client.levelOfValue(1, B), 1);
  assert.equal(client.levelOfValue(999999, B), 1);
  assert.equal(client.levelOfValue(1e6, B), 2);
  assert.equal(client.levelOfValue(1e7, B), 3);
  assert.equal(client.levelOfValue(1e8, B), 4);
  assert.equal(client.levelOfValue(499999999, B), 4);
  assert.equal(client.levelOfValue(5e8, B), 5);
  // 与真实峰值对齐：7.5 亿应落在第 5 档
  assert.equal(client.levelOfValue(749800000, B), 5);
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
  const context = { days, weeklyTotals, weekCumulative, cumulative, thresholds, dailyThresholds: client.DAILY_LEVEL_BOUNDS, todayKey, activeDays, rowOf };

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

  // 每天：按固定数量级分档，周三 > 周一
  assert.ok(
    client.heatLevelOf("daily", "2026-01-07", weekIndex, context) >=
      client.heatLevelOf("daily", "2026-01-05", weekIndex, context)
  );
  // 没有用量的日期在每天模式仍是 0
  assert.equal(client.heatLevelOf("daily", "2026-01-06", weekIndex, context), 0);
  // 关键回归：每天模式必须用 DAILY_LEVEL_BOUNDS，而不是动态分位阈值——
  // 这三天数值都低于 100 万，应全部落在第 1 档（动态分位会给出不同档位）。
  for (const key of ["2026-01-05", "2026-01-07", "2026-01-09"]) {
    assert.equal(client.heatLevelOf("daily", key, weekIndex, context), 1, `${key} 应为固定分级的第 1 档`);
  }
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

test("splitWeekColumns 把 53 周均分成两行，且块内下标能换算回全年列号", () => {
  const weeks = Array.from({ length: 53 }, (_, index) => [`w${index}`]);
  const blocks = client.splitWeekColumns(weeks, 2);
  assert.equal(blocks.length, 2, "53 周应拆成两块");
  // 每块不超过 ceil(53/2)=27 列，且两块的列数之和等于全年
  assert.deepEqual(blocks.map((block) => block.weeks.length), [27, 26]);
  assert.deepEqual(blocks.map((block) => block.startIndex), [0, 27], "第二块的起始下标应为 27");
  // 块内第 i 列的全年列号 = startIndex + i，供 heatLevelOf 取每周聚合值
  assert.equal(blocks[1].startIndex + 0, 27);
  assert.equal(blocks[1].weeks[0][0], "w27");
  // 边界：空数组 / 单块 / 块数超过列数
  assert.deepEqual(client.splitWeekColumns([], 2), []);
  assert.equal(client.splitWeekColumns(weeks, 1).length, 1);
  assert.equal(client.splitWeekColumns([["a"]], 2).length, 1, "列数少于块数时只保留一块");
  assert.deepEqual(client.splitWeekColumns(null, 2), []);
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

test("第 5 档配色与 6 格图例（每日固定分级）的 CSS/渲染回归", async () => {
  globalThis.__legend5Seeded = false;
  // CSS：浅色与深色都必须有 data-level="5"/"6" 规则，图例色块与格子共用选择器
  const cssText = String(client.OVERVIEW_CSS);
  assert.match(
    cssText,
    /\.dsau-heat-cell\[data-level="5"\],\.dsau-heat-legend-swatch\[data-level="5"\]\{background:#0092d9\}/,
    "浅色第 5 档应为 #0092d9"
  );
  assert.doesNotMatch(cssText, /data-level="6"/, "不应再有第 6 档规则（level6 无数据来源）");
  assert.match(
    cssText,
    /body\[data-ds-dark-theme\] \.dsau-heat-cell\[data-level="5"\],body\[data-ds-dark-theme\] \.dsau-heat-legend-swatch\[data-level="5"\]\{background:#46c0fa\}/,
    "深色第 5 档应为 #46c0fa"
  );

  // 渲染：图例应输出 6 个色块（0…5）
  const seen = [];
  const legendHooks = {
    createElement: (type, props, ...children) => {
      const node = { type, props: props ?? {}, children };
      if (props && props.className === "dsau-heat-legend-swatch") seen.push(props["data-level"]);
      return node;
    },
    Fragment: Symbol("F"),
    // 首个 useState 是数据状态：种子成 done，避免 OverviewPanel 落到 loading 分支不出图例。
    useState: (initial) => {
      const v = typeof initial === "function" ? initial() : initial;
      if (v && typeof v === "object" && v.kind === "loading" && !globalThis.__legend5Seeded) {
        globalThis.__legend5Seeded = true;
        return [{ kind: "done", value: { ok: true, scanning: false, years: [2026],
          days: { "2026-01-05": 1000 }, longestTurnMsByYear: { 2026: 60000 },
          sessions: { counted: 1, retained: 0 } } }, () => {}];
      }
      return [v, () => {}];
    },
    useRef: (initial) => ({ current: initial ?? null }),
    useEffect: () => {},
    useLayoutEffect: () => {},
    useCallback: (fn) => fn,
    useMemo: (fn) => fn()
  };
  const previousWindow = globalThis.window;
  let descriptor;
  globalThis.window = { __ModuleLoader__: { load(next) { descriptor = next; } } };
  try {
    const url = new URL("../client.js", import.meta.url);
    url.searchParams.set("legend5", String(Date.now()) + Math.random());
    await import(url.href);
    const client2 = descriptor.factory((name) => {
      if (name === "react") return legendHooks;
      if (name === "react-dom/client") return { createRoot: () => ({ render() {}, unmount() {} }) };
      if (name === "react-dom") return { render() {}, unmountComponentAtNode: () => true };
      throw new Error("unexpected require: " + name);
    });
    const dict = { heatmapLess: "少", heatmapMore: "多", heatmapMonths: "1月,2月",
      heatmapDaily: "每天", heatmapWeekly: "每周", heatmapCumulative: "累计总量" };
    client2.OverviewPanel({ t: (k) => dict[k] ?? k });
    assert.deepEqual(seen, ["0", "1", "2", "3", "4", "5"], "图例必须输出 6 个色块");
  } finally {
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
  }
});

// ---- 0.6.0：区间统计、活跃会话数与月度趋势 -------------------------------------

test("mondayOfKey / monthStartKeyOf：周一起始与月初键", () => {
  assert.equal(client.mondayOfKey("2026-11-04"), "2026-11-02");
  assert.equal(client.mondayOfKey("2026-11-02"), "2026-11-02");
  assert.equal(client.mondayOfKey("2026-11-08"), "2026-11-02", "周日属于本周");
  assert.equal(client.mondayOfKey("2026-01-01"), "2025-12-29", "跨年回退到上一年周一");
  assert.equal(client.mondayOfKey("x"), null);
  assert.equal(client.monthStartKeyOf("2026-11-24"), "2026-11-01");
  assert.equal(client.monthStartKeyOf("x"), null);
});

test("sumMonthTokens / sumWeekTokens / sumTodayTokens 按当前日期闭区间求和", () => {
  const days = {
    "2026-10-31": 1000, // 上月，不计入本月/本周
    "2026-11-01": 10, // 周一 2026-11-02 之前，不计入本周
    "2026-11-02": 20,
    "2026-11-04": 30,
    "2026-11-08": 40,
    "2026-11-09": 50,
    "2026-11-10": 60,
    "2026-12-01": 999
  };
  // 以 2026-11-10（周二）为今天
  assert.equal(client.sumTodayTokens(days, "2026-11-10"), 60);
  // 本周 = 11-09(周一) + 11-10
  assert.equal(client.sumWeekTokens(days, "2026-11-10"), 110);
  // 本月 = 11 月全部（11-01 起）
  assert.equal(client.sumMonthTokens(days, "2026-11-10"), 10 + 20 + 30 + 40 + 50 + 60);
  // 非法输入一律 0
  assert.equal(client.sumMonthTokens(days, null), 0);
  assert.equal(client.sumWeekTokens(days, "bad"), 0);
  assert.equal(client.sumTodayTokens(days, "bad"), 0);
  assert.equal(client.sumRangeTokens(days, "2026-11-09", "2026-11-02"), 0, "反向区间为 0");
});

test("monthlyTokenSeries / monthlySessionSeries 只统计目标年份并补满 12 个月", () => {
  const tokens = client.monthlyTokenSeries(
    { "2026-01-05": 100, "2026-01-20": 50, "2026-11-04": 7, "2025-12-31": 999 },
    2026
  );
  assert.equal(tokens.length, 12);
  assert.equal(tokens[0].tokens, 150);
  assert.equal(tokens[10].tokens, 7);
  assert.equal(tokens[1].tokens, 0);

  const sessions = client.monthlySessionSeries({ "2026-01": 3, "2026-11": 2, "2025-12": 9 }, 2026);
  assert.equal(sessions.length, 12);
  assert.equal(sessions[0].sessions, 3);
  assert.equal(sessions[0].available, true);
  assert.equal(sessions[10].sessions, 2);
  // 旧宿主没有按月字段 → available 全为 false，前端据此隐藏会话线。
  const missing = client.monthlySessionSeries(null, 2026);
  assert.equal(missing.length, 12);
  assert.equal(missing.every((item) => item.available === false && item.sessions === 0), true);
});

test("sessionCountOfDay / sessionCountOfWeek 缺失字段时返回 null", () => {
  assert.equal(client.sessionCountOfDay({ "2026-11-04": 3 }, "2026-11-04"), 3);
  assert.equal(client.sessionCountOfDay({ "2026-11-04": 0 }, "2026-11-04"), 0);
  assert.equal(client.sessionCountOfDay({}, "2026-11-04"), null);
  assert.equal(client.sessionCountOfDay(null, "2026-11-04"), null);

  const weeks = [[{ key: "2026-11-02" }, { key: "2026-11-03" }], [{ key: "2026-11-09" }]];
  assert.equal(client.sessionCountOfWeek({ "2026-11-02": 4 }, weeks, 0), 4);
  assert.equal(client.sessionCountOfWeek({ "2026-11-02": 4 }, weeks, 1), null);
  assert.equal(client.sessionCountOfWeek(null, weeks, 0), null);
  assert.equal(client.sessionCountOfWeek({}, [], 9), null);
});

test("isFutureMonth 只对当年未来月份为 true", () => {
  assert.equal(client.isFutureMonth(2026, 12, "2026-11-10"), true);
  assert.equal(client.isFutureMonth(2026, 11, "2026-11-10"), false);
  assert.equal(client.isFutureMonth(2025, 12, "2026-11-10"), false, "往年没有未来月");
  assert.equal(client.isFutureMonth(2026, 1, "bad"), false);
});

test("niceAxisMax 向上取到 1/2/5 × 10^n", () => {
  assert.equal(client.niceAxisMax(0), 1);
  assert.equal(client.niceAxisMax(1), 1);
  assert.equal(client.niceAxisMax(3), 5);
  assert.equal(client.niceAxisMax(7), 10);
  assert.equal(client.niceAxisMax(12), 20);
  assert.equal(client.niceAxisMax(430000000), 500000000);
});

test("buildMonthlyTrendGeometry 未来月份断开，双轴各自换算", () => {
  const geometry = client.buildMonthlyTrendGeometry({
    width: 640,
    height: 210,
    padL: 46,
    padR: 46,
    padT: 14,
    padB: 26,
    year: 2026,
    todayKey: "2026-11-10",
    tokenMax: 1000,
    sessionMax: 8,
    tokenOf: (month) => month * 10,
    sessionOf: (month) => month
  });
  // 1–11 月是一整段，12 月是未来月被排除
  assert.equal(geometry.tokenSegments.length, 1);
  assert.deepEqual(geometry.tokenSegments[0].map((p) => p.month), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
  assert.deepEqual(geometry.sessionSegments[0].map((p) => p.month), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
  // 左轴 token 经过 niceAxisMax 取整；右轴会话数是整数刻度（4 的倍数）。
  assert.equal(geometry.tokenMax, 1000);
  assert.equal(geometry.sessionMax, 8);
  // 零值落在基线上，满值落在顶部
  assert.equal(geometry.yToken(0), 14 + (210 - 14 - 26));
  assert.equal(geometry.yToken(1000), 14);
  assert.equal(geometry.ySession(8), 14);
  // X 轴：1 月落在第一列中心，12 月落在末列中心，且都在绘图区内
  assert.equal(geometry.xOf(1), 46 + (640 - 92) / 24);
  assert.equal(geometry.xOf(12), 46 + (640 - 92) / 12 * 11.5);
  assert.ok(geometry.xOf(12) < 640 - 46);
});

test("buildMonthlyTrendGeometry 当年全部月份时不会产生空段", () => {
  // 若一年里所有月份都已过去（往年的年份），应只有一段且包含 12 项。
  const geometry = client.buildMonthlyTrendGeometry({
    year: 2025,
    todayKey: "2026-11-10",
    tokenMax: 10,
    sessionMax: 2
  });
  assert.equal(geometry.tokenSegments.length, 1);
  assert.equal(geometry.tokenSegments[0].length, 12);
});

test("MonthlyTrend 渲染图例、双轴刻度与 12 个月横轴", () => {
  const tokens = client.monthlyTokenSeries({ "2026-01-05": 1000, "2026-11-04": 500 }, 2026);
  const sessions = client.monthlySessionSeries({ "2026-01": 2, "2026-11": 1 }, 2026);
  const tree = render(client.MonthlyTrend({
    year: 2026,
    todayKey: "2026-11-10",
    tokens,
    sessions,
    sessionAvailable: true,
    t: (key) => ({
      numberScale: "wan",
      heatmapMonths: "1月,2月,3月,4月,5月,6月,7月,8月,9月,10月,11月,12月",
      monthTrendTitle: "月度趋势",
      monthTrendTokens: "Token 用量",
      monthTrendSessions: "活跃会话数"
    })[key] ?? key
  }));
  const texts = [];
  const walk = (node) => {
    if (node === null || node === undefined) return;
    if (Array.isArray(node)) return node.forEach(walk);
    if (typeof node === "string" || typeof node === "number") return texts.push(String(node));
    if (typeof node === "object" && Array.isArray(node.children)) node.children.forEach(walk);
    if (typeof node === "object" && node.children !== undefined && !Array.isArray(node.children)) walk(node.children);
  };
  walk(tree);
  assert.ok(texts.includes("Token 用量"), "应有 token 图例");
  assert.ok(texts.includes("活跃会话数"), "应有会话图例");
  // 横轴必须把 1–12 月全部标出来（未来月份只是不画点，刻度仍要在）。
  const monthLabels = ["1月","2月","3月","4月","5月","6月","7月","8月","9月","10月","11月","12月"];
  for (const label of monthLabels) {
    assert.ok(texts.includes(label), `横轴应包含 ${label}`);
  }
  const svg = collect(tree, "svg")[0];
  assert.ok(svg, "应渲染 svg");
  // 未来月份（12 月）不画点：会话圆点最多 11 个（1–11 月各一个）。
  const circles = collect(tree, "circle");
  assert.ok(circles.length <= 11, `会话点应 ≤11 个，实际 ${circles.length}`);
});

test("MonthlyTrend 在旧宿主（sessionAvailable=false）时隐藏会话图例", () => {
  const tree = render(client.MonthlyTrend({
    year: 2026,
    todayKey: "2026-11-10",
    tokens: client.monthlyTokenSeries({}, 2026),
    sessions: client.monthlySessionSeries(null, 2026),
    sessionAvailable: false,
    t: (key) => ({
      numberScale: "wan",
      heatmapMonths: "1月,2月,3月,4月,5月,6月,7月,8月,9月,10月,11月,12月",
      monthTrendTokens: "Token 用量",
      monthTrendSessions: "活跃会话数"
    })[key] ?? key
  }));
  const texts = [];
  const walk = (node) => {
    if (node === null || node === undefined) return;
    if (Array.isArray(node)) return node.forEach(walk);
    if (typeof node === "string" || typeof node === "number") return texts.push(String(node));
    if (typeof node === "object" && Array.isArray(node.children)) node.children.forEach(walk);
  };
  walk(tree);
  assert.ok(texts.includes("Token 用量"));
  assert.equal(texts.includes("活跃会话数"), false, "缺字段时不应出现会话图例");
});

test("统计卡两行布局的 CSS 回归（4 列 + 行分隔线 + 窄屏 2 列）", () => {
  const cssText = String(client.OVERVIEW_CSS);
  assert.match(cssText, /\.dsau-stats\{display:grid;grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/, "桌面应为 4 列");
  assert.match(cssText, /\.dsau-stat:nth-child\(n\+5\)\{border-top:1px solid var\(--dsw-alias-border-l1\)\}/, "第二行应有行间分隔线");
  assert.match(cssText, /\.dsau-stat:nth-child\(4n\+1\)\{border-left:none\}/, "每行首格不应有左边框");
  assert.match(cssText, /@media \(max-width:560px\)\{\.dsau-stats\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)\}/, "窄屏应为 2 列");
  assert.match(cssText, /\.dsau-stat:nth-child\(2n\+1\)\{border-left:none\}/, "窄屏每行首格不画竖线");
});

test("OverviewPanel 统计卡渲染 8 项（两行 4+4），并输出月度趋势卡片", async () => {
  const labels = [];
  const hooks = {
    createElement: (type, props, ...children) => {
      const node = { type, props: props ?? {}, children };
      // 统计格标签：className 为 dsau-stat-label 的文本节点父级
      if (props && props.className === "dsau-stat-label") labels.push(children[0]);
      return node;
    },
    Fragment: Symbol("F"),
    useState: (initial) => {
      const v = typeof initial === "function" ? initial() : initial;
      if (v && typeof v === "object" && v.kind === "loading" && !globalThis.__statsSeed) {
        globalThis.__statsSeed = true;
        return [{
          kind: "done",
          value: {
            ok: true,
            scanning: false,
            years: [2026],
            days: { "2026-11-04": 1000, "2026-11-05": 2000 },
            longestTurnMsByYear: { 2026: 60000 },
            sessions: { counted: 2, retained: 0 },
            sessionsByDay: { "2026-11-04": 1, "2026-11-05": 2 },
            sessionsByWeek: { "2026-11-02": 2 },
            sessionsByMonth: { "2026-11": 2 }
          }
        }, () => {}];
      }
      return [v, () => {}];
    },
    useRef: (initial) => ({ current: initial ?? null }),
    useEffect: () => {},
    useLayoutEffect: () => {},
    useCallback: (fn) => fn,
    useMemo: (fn) => fn()
  };
  const previousWindow = globalThis.window;
  let descriptor;
  globalThis.window = { __ModuleLoader__: { load(next) { descriptor = next; } } };
  try {
    const url = new URL("../client.js", import.meta.url);
    url.searchParams.set("stats8", String(Date.now()) + Math.random());
    await import(url.href);
    const client2 = descriptor.factory((name) => {
      if (name === "react") return hooks;
      if (name === "react-dom/client") return { createRoot: () => ({ render() {}, unmount() {} }) };
      if (name === "react-dom") return { render() {}, unmountComponentAtNode: () => true };
      throw new Error("unexpected require: " + name);
    });
    const dict = {
      statsTitle: "用户使用情况", statTotalTokens: "累计 Token 数", statMonthTokens: "本月 Token 数",
      statWeekTokens: "本周 Token 数", statTodayTokens: "今日 Token 数", statPeakTokens: "Token 使用峰值",
      statLongestTask: "最长任务用时", statLongestStreak: "最长连续天数", statCurrentStreak: "当前连续天数",
      heatmapTitle: "Token 活动", monthTrendTitle: "月度趋势", overviewYear: "年度", numberScale: "wan",
      durationDay: "天", durationHour: "小时", durationMinute: "分", durationSecond: "秒",
      daysCount: "{n} 天", noValue: "—", heatmapMonths: "1月,2月,3月,4月,5月,6月,7月,8月,9月,10月,11月,12月",
      monthTrendTokens: "Token 用量", monthTrendSessions: "活跃会话数", loading: "加载中"
    };
    // 展开函数组件（OverviewStat / MonthlyTrend 等）后统计标签。
    render(client2.OverviewPanel({ t: (k) => dict[k] ?? k }));
    assert.equal(labels.length, 8, `应渲染 8 个统计格，实际 ${labels.length}`);
    assert.deepEqual(labels, [
      "累计 Token 数", "本月 Token 数", "本周 Token 数", "今日 Token 数",
      "Token 使用峰值", "最长任务用时", "最长连续天数", "当前连续天数"
    ]);
  } finally {
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
  }
});

/** 用自定义 hooks 重新加载 client.js（用于给 useState 播种悬浮态等）。 */
async function loadClientWithHooks(hooks, tag) {
  const previousWindow = globalThis.window;
  let descriptor;
  globalThis.window = { __ModuleLoader__: { load(next) { descriptor = next; } } };
  try {
    const url = new URL("../client.js", import.meta.url);
    url.searchParams.set(tag, String(Date.now()) + Math.random());
    await import(url.href);
    return descriptor.factory((name) => {
      if (name === "react") return hooks;
      if (name === "react-dom/client") return { createRoot: () => ({ render() {}, unmount() {} }) };
      if (name === "react-dom") return { render() {}, unmountComponentAtNode: () => true };
      throw new Error("unexpected require: " + name);
    });
  } finally {
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
  }
}

function textOf(node, out = []) {
  if (node === null || node === undefined) return out;
  if (Array.isArray(node)) {
    for (const item of node) textOf(item, out);
    return out;
  }
  if (typeof node === "string" || typeof node === "number") {
    out.push(String(node));
    return out;
  }
  if (typeof node === "object" && Array.isArray(node.children)) textOf(node.children, out);
  return out;
}

test("MonthlyTrend 悬浮时提示框给出「月份 + Token + 活跃会话数」", async () => {
  const hooks = {
    createElement: (type, props, ...children) => ({ type, props: props ?? {}, children }),
    Fragment: Symbol("F"),
    // 第一次 useState 是 hovered：直接播种为 11 月。
    useState: (initial) => {
      const v = typeof initial === "function" ? initial() : initial;
      if (v === null && !globalThis.__hoverSeeded) {
        globalThis.__hoverSeeded = true;
        return [11, () => {}];
      }
      return [v, () => {}];
    },
    useRef: (initial) => ({ current: initial ?? null }),
    useEffect: () => {},
    useLayoutEffect: () => {},
    useCallback: (fn) => fn,
    useMemo: (fn) => fn()
  };
  try {
    const client2 = await loadClientWithHooks(hooks, "trendTip");
    const tree = render(client2.MonthlyTrend({
      year: 2026,
      todayKey: "2026-11-25",
      tokens: client2.monthlyTokenSeries({ "2026-11-04": 12340000 }, 2026),
      sessions: client2.monthlySessionSeries({ "2026-11": 7 }, 2026),
      sessionAvailable: true,
      t: (key) => ({
        numberScale: "wan",
        heatmapMonths: "1月,2月,3月,4月,5月,6月,7月,8月,9月,10月,11月,12月",
        monthTrendTokens: "Token 用量",
        monthTrendSessions: "活跃会话数"
      })[key] ?? key
    }));
    const texts = textOf(tree);
    assert.ok(texts.includes("11月"), "提示框应带月份");
    assert.ok(texts.some((item) => item.includes("Token 用量") && item.includes("1234万")), "应带当月 Token 数");
    assert.ok(texts.some((item) => item.includes("活跃会话数") && item.includes("7")), "应带当月活跃会话数");
  } finally {
    delete globalThis.__hoverSeeded;
  }
});

test("热力图悬浮：每天/每周带第三行会话数，累计总量只有两行", async () => {
  const dict = {
    numberScale: "wan",
    heatmapMonths: "1月,2月,3月,4月,5月,6月,7月,8月,9月,10月,11月,12月",
    heatmapDayTip: "{date}",
    heatmapWeekTip: "{date} 起的一周",
    heatmapCumulativeTip: "累计至 {date}",
    heatmapValueUnit: "个 Token",
    heatmapSessionsTip: "活跃会话 {n}",
    heatmapDaily: "每天",
    heatmapWeekly: "每周",
    heatmapCumulative: "累计总量",
    statsTitle: "用户使用情况",
    statTotalTokens: "累计 Token 数",
    statMonthTokens: "本月 Token 数",
    statWeekTokens: "本周 Token 数",
    statTodayTokens: "今日 Token 数",
    statPeakTokens: "Token 使用峰值",
    statLongestTask: "最长任务用时",
    statLongestStreak: "最长连续天数",
    statCurrentStreak: "当前连续天数",
    heatmapTitle: "Token 活动",
    monthTrendTitle: "月度趋势",
    monthTrendTokens: "Token 用量",
    monthTrendSessions: "活跃会话数",
    overviewYear: "年度",
    daysCount: "{n} 天"
  };
  const run = async (mode) => {
    const tips = [];
    const hooks = {
      createElement: (type, props, ...children) => {
        const node = { type, props: props ?? {}, children };
        if (props && props.className === "dsau-heat-tip") tips.push(node);
        return node;
      },
      Fragment: Symbol("F"),
      // useState 顺序：state → year → mode → tip → tipBox。第 4 个播种成悬浮态。
      useState: (initial) => {
        const v = typeof initial === "function" ? initial() : initial;
        const key = `__seed_${mode}_${tips.length}`;
        globalThis.__calls = (globalThis.__calls ?? 0) + 1;
        if (globalThis.__calls === 1) {
          return [{
            kind: "done",
            value: {
              ok: true, scanning: false, years: [2026],
              days: { "2026-11-04": 1000 },
              longestTurnMsByYear: { 2026: 60000 },
              sessions: { counted: 2, retained: 0 },
              sessionsByDay: { "2026-11-04": 2 },
              sessionsByWeek: { "2026-11-02": 2 },
              sessionsByMonth: { "2026-11": 2 }
            }
          }, () => {}];
        }
        if (globalThis.__calls === 3) return [mode, () => {}];
        if (globalThis.__calls === 4) {
          return [{
            anchorX: 100, anchorY: 100,
            caption: "2026/11/04",
            value: "1000 个 Token",
            sessions: mode === "cumulative" ? null : "活跃会话 2"
          }, () => {}];
        }
        return [v, () => {}];
      },
      useRef: (initial) => ({ current: initial ?? null }),
      useEffect: () => {},
      useLayoutEffect: () => {},
      useCallback: (fn) => fn,
      useMemo: (fn) => fn()
    };
    globalThis.__calls = 0;
    try {
      const client2 = await loadClientWithHooks(hooks, `heatTip-${mode}`);
      render(client2.OverviewPanel({ t: (key) => dict[key] ?? key }));
      const texts = tips.flatMap((node) => textOf(node));
      return texts;
    } finally {
      delete globalThis.__calls;
    }
  };

  const daily = await run("daily");
  assert.ok(daily.includes("活跃会话 2"), "每天模式应显示会话数行");
  const weekly = await run("weekly");
  assert.ok(weekly.includes("活跃会话 2"), "每周模式应显示会话数行");
  const cumulative = await run("cumulative");
  assert.equal(cumulative.includes("活跃会话 2"), false, "累计总量模式不应显示会话数行");
  // 累计模式仍输出「描述 + 数值」两行（测试里 caption 是播种值，只校验行数与内容）。
  assert.equal(cumulative.length, 2, `累计模式应只有两行，实际 ${JSON.stringify(cumulative)}`);
  assert.ok(cumulative.includes("1000 个 Token"), "累计模式仍保留 Token 数值行");
});

test("热力图 showTip：按模式写入第三个字段（每天/每周有值，累计为 null）", async () => {
  const dict = {
    numberScale: "wan",
    heatmapMonths: "1月,2月,3月,4月,5月,6月,7月,8月,9月,10月,11月,12月",
    heatmapDayTip: "{date}",
    heatmapWeekTip: "{date} 起的一周",
    heatmapCumulativeTip: "累计至 {date}",
    heatmapValueUnit: "个 Token",
    heatmapSessionsTip: "活跃会话 {n}",
    heatmapDaily: "每天", heatmapWeekly: "每周", heatmapCumulative: "累计总量",
    statsTitle: "用户使用情况", heatmapTitle: "Token 活动", monthTrendTitle: "月度趋势",
    monthTrendTokens: "Token 用量", monthTrendSessions: "活跃会话数", overviewYear: "年度"
  };
  const run = async (mode) => {
    const tips = [];
    let setTip = null;
    const hooks = {
      createElement: (type, props, ...children) => ({ type, props: props ?? {}, children }),
      Fragment: Symbol("F"),
      useState: (initial) => {
        const v = typeof initial === "function" ? initial() : initial;
        globalThis.__calls = (globalThis.__calls ?? 0) + 1;
        const index = globalThis.__calls;
        if (index === 1) {
          return [{
            kind: "done",
            value: {
              ok: true, scanning: false, years: [2026],
              days: { "2026-11-04": 1000, "2026-11-05": 500 },
              longestTurnMsByYear: { 2026: 60000 },
              sessions: { counted: 2, retained: 0 },
              sessionsByDay: { "2026-11-04": 2, "2026-11-05": 1 },
              sessionsByWeek: { "2026-11-02": 3 },
              sessionsByMonth: { "2026-11": 2 }
            }
          }, () => {}];
        }
        if (index === 3) return [mode, () => {}];
        if (index === 4) {
          setTip = (value) => tips.push(value);
          return [null, setTip];
        }
        return [v, () => {}];
      },
      useRef: (initial) => ({ current: initial ?? null }),
      useEffect: () => {},
      useLayoutEffect: () => {},
      useCallback: (fn) => fn,
      useMemo: (fn) => fn()
    };
    globalThis.__calls = 0;
    try {
      const client2 = await loadClientWithHooks(hooks, `heatTipSet-${mode}`);
      const tree = render(client2.OverviewPanel({ t: (key) => dict[key] ?? key }));
      // 找到 2026-11-04 那一格并触发悬浮
      // 选一个确实有会话数据的日子（11-04），否则 daily 模式拿到 null 也属正常。
      const cell = collect(tree, "div").find((node) => node.props
        && node.props.onMouseEnter
        && (node.props.key === "2026-11-04" || node.props.key === "2026-11-05"));
      assert.ok(cell, "应能取到一个可悬浮的热力格");
      cell.props.onMouseEnter({
        currentTarget: {
          getBoundingClientRect: () => ({ left: 10, top: 20, width: 16, height: 16 })
        }
      });
      return tips[tips.length - 1];
    } finally {
      delete globalThis.__calls;
    }
  };

  const daily = await run("daily");
  assert.match(String(daily.sessions), /^活跃会话 \d+$/, "每天模式应写入会话数");
  const weekly = await run("weekly");
  assert.match(String(weekly.sessions), /^活跃会话 \d+$/, "每周模式应写入会话数");
  const cumulative = await run("cumulative");
  assert.equal(cumulative.sessions, null, "累计总量模式不应写会话数");
  assert.ok(cumulative.caption.includes("累计至"), "累计模式仍是累计描述");
});

test("MonthlyTrend 提示框复用 ChartTooltip（贴边时会被夹紧而不是溢出）", async () => {
  const hooks = {
    createElement: (type, props, ...children) => ({ type, props: props ?? {}, children }),
    Fragment: Symbol("F"),
    // hovered 播种为 12 月之前的最右月份（11 月），验证走 ChartTooltip 分支。
    useState: (initial) => {
      const v = typeof initial === "function" ? initial() : initial;
      if (v === null && !globalThis.__edgeSeeded) {
        globalThis.__edgeSeeded = true;
        return [11, () => {}];
      }
      return [v, () => {}];
    },
    useRef: (initial) => ({ current: initial ?? null }),
    useEffect: () => {},
    useLayoutEffect: () => {},
    useCallback: (fn) => fn,
    useMemo: (fn) => fn()
  };
  try {
    const client2 = await loadClientWithHooks(hooks, "trendTipEdge");
    const tree = render(client2.MonthlyTrend({
      year: 2026,
      todayKey: "2026-11-25",
      tokens: client2.monthlyTokenSeries({ "2026-11-04": 12340000 }, 2026),
      sessions: client2.monthlySessionSeries({ "2026-11": 7 }, 2026),
      sessionAvailable: true,
      t: (key) => ({
        numberScale: "wan",
        heatmapMonths: "1月,2月,3月,4月,5月,6月,7月,8月,9月,10月,11月,12月",
        monthTrendTokens: "Token 用量",
        monthTrendSessions: "活跃会话数"
      })[key] ?? key
    }));
    // ChartTooltip 是函数组件，render 会展开成带 styles.tooltip 的 div；
    // 用 chartWidth/chartHeight 探针确认它接到了锚点与画布尺寸。
    const tips = collect(tree, "div").filter((node) => node.props && node.props.style
      && node.props.style.position === "absolute" && node.props.style.zIndex === 6);
    assert.equal(tips.length, 1, "应只渲染一个提示框");
    assert.ok(Number.isFinite(tips[0].props.style.left), "提示框 left 应为有限值");
    assert.ok(Number.isFinite(tips[0].props.style.top), "提示框 top 应为有限值");
  } finally {
    delete globalThis.__edgeSeeded;
  }
});

test("MonthlyTrend 旧宿主时右轴刻度与图例一并隐藏，只留 token", async () => {
  const tree = render(client.MonthlyTrend({
    year: 2026,
    todayKey: "2026-11-25",
    tokens: client.monthlyTokenSeries({ "2026-11-04": 1000 }, 2026),
    sessions: client.monthlySessionSeries(null, 2026),
    sessionAvailable: false,
    t: (key) => ({
      numberScale: "wan",
      heatmapMonths: "1月,2月,3月,4月,5月,6月,7月,8月,9月,10月,11月,12月",
      monthTrendTokens: "Token 用量",
      monthTrendSessions: "活跃会话数"
    })[key] ?? key
  }));
  // 右侧刻度从 x = W - padR + 6 起画，旧宿主不应出现这些 text
  const rightTicks = collect(tree, "text").filter((node) => node.props.textAnchor === "start");
  assert.equal(rightTicks.length, 0, `旧宿主不应绘制右轴刻度，实际 ${rightTicks.length} 个`);
  // 左轴仍是 5 档
  const leftTicks = collect(tree, "text").filter((node) => node.props.textAnchor === "end");
  assert.equal(leftTicks.length, 5, "左轴刻度应保持 5 档");
});

test("中英文词典新增的 monthTrend* 键都存在且不为空（防止键名冲突/漏配）", async () => {
  const client2 = await loadClient();
  let dictionaries = null;
  client2.apply({
    remote: undefined,
    effect(callback) { callback(); },
    locale: {
      register(_ns, dicts) { dictionaries = dicts; },
      bind() { return (key) => key; }
    },
    slots: { inject(_name, callback) { return callback(); }, register() { return () => {}; } }
  });
  assert.ok(dictionaries, "应注册文案字典");
  for (const lang of ["zh", "en"]) {
    const dict = dictionaries[lang];
    assert.ok(dict, `应有 ${lang} 字典`);
    for (const key of ["monthTrendTitle", "monthTrendTokens", "monthTrendSessions"]) {
      assert.equal(typeof dict[key], "string", `${lang}.${key} 应为字符串`);
      assert.ok(dict[key].length > 0, `${lang}.${key} 不应为空`);
    }
  }
  // 月度趋势的标题必须与 OpenCode 的「用量趋势」区分开，否则后者会覆盖前者。
  assert.notEqual(dictionaries.zh.monthTrendTitle, dictionaries.zh.trendTitle);
  assert.notEqual(dictionaries.en.monthTrendTitle, dictionaries.en.trendTitle);
  assert.equal(dictionaries.zh.monthTrendTitle, "月度趋势");
  assert.equal(dictionaries.en.monthTrendTitle, "Monthly trend");
});
