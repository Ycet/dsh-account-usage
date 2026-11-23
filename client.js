// Client half of the @ycet/dsh-account-usage plugin.
// Hand-written browser bundle in the lazy-CJS format the client module loader
// expects: it only REGISTERS the factory; the body runs at materialization.
// Its content is normally embedded below the native cards of the official
// settings "Account & balance" page; when that page is unavailable (signed out
// or an older DSH), it falls back to its own settings.section entry. All data
// arrives from same-origin routes registered by the host half; secrets never
// enter the browser.
window.__ModuleLoader__.load({
  id: "@ycet/dsh-account-usage",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
    const React = require("react");
    // 嵌入官方「账号与余额」页需要在插件自己的 DOM 容器里挂一个 React 根。
    // DSH 0.2.2 提供 react-dom/client；旧运行时退回 ReactDOM.render。
    let ReactDOMClient = null;
    let ReactDOM = null;
    try {
      ReactDOMClient = require("react-dom/client");
    } catch {
      ReactDOMClient = null;
    }
    try {
      ReactDOM = require("react-dom");
    } catch {
      ReactDOM = null;
    }
    const canEmbedReact =
      (ReactDOMClient !== null && typeof ReactDOMClient.createRoot === "function") ||
      (ReactDOM !== null && typeof ReactDOM.render === "function");

    const NS = "settings.accountUsage";
    const inject = ["slots", "locale", "remote", "remote.credentials"];

    // ---- 账户导航图标（来源：assets/icons/我的.svg） ----
    // DSH 设置面板对每个分区条目默认渲染“设置”齿轮图标；为让本插件显示自己的
    // 图标，本条目在注册选项里带一个 `icon`（React 元素）。路径数据取自 DSH
    // 设计系统自带图标 IconUserOutline16（@deepseek-ai/dsh-client-ui-primitives，
    // 即 assets/icons/我的.svg 同款），按 16×16 渲染，fill=currentColor 使其
    // 随导航文字颜色适配浅色/深色主题。SVG 文件随插件打包发布（package.json
    // files 含 assets），其他安装者同样可以使用该图标。路径常量同时被下方
    // 的运行时兜底注入复用（React 元素与 DOM 注入共用同一份矢量数据）。
    const ACCOUNT_ICON_D1 = "M11.0307 5.46369C11.0305 3.78995 9.6734 2.43357 7.99961 2.43357C6.32601 2.43379 4.96972 3.79009 4.96949 5.46369C4.96949 7.13748 6.32587 8.49455 7.99961 8.49477C9.67354 8.49477 11.0307 7.13762 11.0307 5.46369ZM12.3163 5.46369C12.3163 7.84777 10.3837 9.78042 7.99961 9.78042C5.61572 9.7802 3.68288 7.84763 3.68288 5.46369C3.6831 3.07993 5.61586 1.14718 7.99961 1.14695C10.3836 1.14695 12.3161 3.0798 12.3163 5.46369Z";
    const ACCOUNT_ICON_D2 = "M8.00002 10.3316C11.7343 10.3316 14.1864 11.8997 15.0387 14.4445L14.4292 14.6483L13.8197 14.8531C13.1955 12.9893 11.3673 11.6182 8.00002 11.6182C4.63277 11.6182 2.80455 12.9893 2.18031 14.8531L1.5708 14.6483L0.961304 14.4445C1.81368 11.8997 4.26579 10.3316 8.00002 10.3316Z";
    const ACCOUNT_ICON = React.createElement(
      "svg",
      { viewBox: "0 0 16 16", width: 16, height: 16, fill: "none", "aria-hidden": true, focusable: "false", "data-dsh-account-injected": "1", style: { display: "block" } },
      React.createElement("path", { fill: "currentColor", d: ACCOUNT_ICON_D1 }),
      React.createElement("path", { fill: "currentColor", d: ACCOUNT_ICON_D2 })
    );

    const zh = {
      nav: "账户",
      title: "账户",
      tabOverview: "概览",
      overviewTitle: "概览",
      overviewYear: "年度",
      overviewScanning: "统计中…",
      overviewEmpty: "暂无使用记录",
      overviewUnsupported: "当前 DSH 版本不支持使用统计",
      statsTitle: "用户使用情况",
      statTotalTokens: "累计 Token 数",
      statPeakTokens: "Token 使用峰值",
      statLongestTask: "最长任务用时",
      statLongestStreak: "最长连续天数",
      statCurrentStreak: "当前连续天数",
      heatmapTitle: "Token 活动",
      heatmapDaily: "每天",
      heatmapWeekly: "每周",
      heatmapCumulative: "累计总量",
      heatmapMonths: "1月,2月,3月,4月,5月,6月,7月,8月,9月,10月,11月,12月",
      heatmapDayTip: "{date}",
      heatmapWeekTip: "{date} 起的一周",
      heatmapCumulativeTip: "累计至 {date}",
      heatmapValueUnit: "个 Token",
      heatmapLess: "少",
      heatmapMore: "多",
      numberScale: "wan",
      durationDay: "天",
      durationHour: "小时",
      durationMinute: "分",
      durationSecond: "秒",
      daysCount: "{n} 天",
      noValue: "—",
      tabDeepseek: "deepseek",
      tabOpencode: "opencode go",
      deepseekPanel: "DeepSeek 平台",
      opencodePanel: "OpenCode Go",
      moduleToken: "会话令牌",
      moduleBalance: "账户余额",
      moduleUsage: "用量",
      moduleModels: "模型用量明细",
      moduleTools: "网页搜索与抓取",
      tokenTitle: "平台会话令牌",
      tokenConfigured: "已配置",
      tokenMissing: "未配置 —— 用量与余额将不可用",
      tokenSourceEnv: "来源：环境变量",
      tokenPlaceholder: "粘贴 userToken（platform.deepseek.com）",
      tokenSave: "保存",
      tokenClear: "清除",
      tokenHint: "登录 platform.deepseek.com 后，在 DevTools → Console 执行 JSON.parse(localStorage.getItem('userToken')).value 即可获得；令牌仅写入本机凭据库。",
      tokenSaveFailed: "保存失败（凭据通道不可用）",
      tokenUnavailable: "凭据通道不可用，请手动写入 ~/.dsh/.credentials.yaml 的 DEEPSEEK_PLATFORM_TOKEN",
      summaryToppedUp: "充值余额",
      summaryGranted: "赠送余额",
      summaryCumulative: "累计消费金额",
      rangeTitle: "时间维度",
      rangeToday: "今天",
      range7d: "近7天",
      range30d: "近30天",
      rangeThisMonth: "本月",
      rangeLastMonth: "上月",
      rangeCustom: "自定义",
      rangeCustomRow: "自定义区间",
      // 越界日期的原生 title 提示（0.5.1：区间上限前置到日历）。
      rangeLimitTooltip: "最多可选 {n} 个自然月",
      // 区间日历（0.5.0）：月名与星期按当前界面语言取字典，不依赖浏览器 locale。
      rangeSelectDates: "选择日期",
      rangeMonthNames: "1月,2月,3月,4月,5月,6月,7月,8月,9月,10月,11月,12月",
      rangeMonthTitle: "{year}年{month}",
      rangeWeekdays: "日,一,二,三,四,五,六",
      rangePrevMonth: "上个月",
      rangeNextMonth: "下个月",
      rangeSeparator: "→",
      totalsCost: "消费金额",
      totalsRequests: "API 请求次数",
      totalsTokens: "tokens",
      // 合计口径（0.5.0）：消费金额与请求次数 = 模型 + 工具。
      totalsCostHint: "模型 {model} + 工具 {tools}",
      totalsRequestsHint: "模型 {model} + 工具 {tools}",
      totalsToolsUnavailable: "工具数据不可用",
      totalsToolsCostUnavailable: "工具费用不可用",
      chartTitle: "消费金额柱状图",
      chartEmpty: "所选区间内暂无消费数据",
      tooltipTotal: "总消耗",
      tokenChartTitle: "Token 消耗柱状图",
      tokenChartEmpty: "所选区间内暂无 token 数据",
      legendMiss: "输入（未命中缓存）",
      legendHit: "输入（命中缓存）",
      legendOut: "输出",
      modelTableTitle: "模型明细表",
      modelsEmpty: "暂无模型数据",
      toolsSearch: "网页搜索",
      toolsFetch: "网页抓取",
      toolsCalls: "调用次数",
      toolsCost: "消费",
      toolsEmpty: "所选区间内暂无网页搜索/抓取调用",
      toolsUnavailable: "网页搜索/抓取用量暂不可用",
      toolsCostChart: "调用类型消费",
      toolsCostEmpty: "所选区间内暂无工具消费数据",
      toolsRequests: "API 请求次数",
      toolsTotalCost: "工具消费总额",
      colModel: "模型",
      colRequests: "请求次数",
      colInput: "输入(未命中)",
      colCacheHit: "缓存命中",
      colCacheMiss: "缓存未命中",
      colOutput: "输出",
      colCost: "费用",
      keySourceCredentials: "Key 来源：DSH 凭据",
      keySourceAuthJson: "Key 来源：opencode auth.json",
      keyMissing: "未找到 OpenCode Go API Key（OPENCODE_GO_API_KEY）",
      rolling: "5 小时滚动",
      weekly: "每周",
      monthly: "每月",
      limit: "限额参考",
      reset: "重置",
      countdownHour: "小时",
      countdownMinute: "分钟",
      countdownDay: "天",
      countdownAfter: "后重置",
      countdownNow: "即将重置",
      refresh: "刷新",
      jump: "跳转",
      loading: "查询中…",
      loadFailed: "加载失败",
      unknown: "未知",
      noToken: "未配置平台令牌：请在下方粘贴 userToken，或写入 ~/.dsh/.credentials.yaml 的 DEEPSEEK_PLATFORM_TOKEN",
      tokenExpired: "平台令牌已过期：请重新登录 platform.deepseek.com 并更新 userToken",
      noKey: "未找到 OpenCode Go API Key",
      unauthorized: "OpenCode Go API Key 无效或已过期（401）",
      goSubscriptionRequired: "当前 Key 所属工作区未开通 OpenCode Go，或订阅尚未生效。请在 OpenCode 控制台核对订阅，并确认 DSH 使用该工作区的 Go API Key。",
      networkError: "网络请求失败，请稍后重试",
      badJson: "接口响应解析失败",
      httpError: "接口返回 HTTP {status}",
      menuBalance: "余额：",
      menuBalanceTitle: "DeepSeek 平台余额",
      menuOpenAccount: "打开账户设置",
      trendTitle: "用量趋势（当前订阅周期）",
      trendEmpty: "暂无趋势数据",
      trendCurrent: "当前已用",
      trendPace: "日均消耗",
      trendPaceUnit: "%/天",
      trendProjected: "预计期末",
      trendInsufficient: "周期刚开始",
      trendUsed: "已用",
      trendDayDelta: "当日",
      trendRequests: "请求数",
      trendNotRecorded: "未记录",
      trendLegendUsage: "已用",
      trendLegendForecast: "预测",
      trendLegendLimit: "月度上限",
      trendSourceSampling: "来源：本地采样",
      trendSourceConsole: "来源：OpenCode 官方日榜",
      trendSince: "自",
      cookieConfigure: "配置 Console Cookie",
      cookieUpdate: "更新 Console Cookie",
      cookieHint: "控制台日榜只认浏览器登录态：在 opencode.ai 控制台按 F12 → Network → 刷新页面 → 点任意一条 console/api 请求 → Headers 里的 Request Headers 找到 cookie 那一行，复制冒号后的整段值贴到下面（连 cookie: 前缀一起粘也认）。它只保存在本机 DSH 凭据里、由宿主读取，不会出现在浏览器界面、日志或任何响应中；会话过期后需要重新粘贴。",
      cookiePlaceholder: "粘贴 cookie 的值（整行 cookie: ... 也认）",
      cookieSave: "保存",
      cookieClear: "清除",
      cookieSaved: "已保存，正在重新拉取官方日榜",
      cookieSaveFailed: "保存失败，请重试",
      cookieConfigured: "已配置 Console Cookie，日榜数据来自官方控制台",
      cookieMissing: "未配置 Console Cookie，当前使用本地采样",
      consoleExpired: "Console Cookie 已失效或被拒绝，已回退到本地采样数据",
      consoleUnavailable: "Console 日榜暂不可用，已回退到本地采样数据",
      consoleCookieLooksShort: "这条 Cookie 只有 {pairs} 段，很可能不含 HttpOnly 的会话 Cookie：请从 Network → Request Headers 复制整行，而不是 document.cookie",
      modelsTitle: "本周期模型用量",
      modelsTokens: "Tokens",
      modelsSource: "数据来自 OpenCode 官方日榜 CSV（本周期合计）"
    };

    const en = {
      nav: "Account",
      title: "Account",
      tabOverview: "Overview",
      overviewTitle: "Overview",
      overviewYear: "Year",
      overviewScanning: "Scanning…",
      overviewEmpty: "No usage recorded yet",
      overviewUnsupported: "This DSH version does not support usage insights",
      statsTitle: "Usage summary",
      statTotalTokens: "Total tokens",
      statPeakTokens: "Peak tokens",
      statLongestTask: "Longest task",
      statLongestStreak: "Longest streak",
      statCurrentStreak: "Current streak",
      heatmapTitle: "Token activity",
      heatmapDaily: "Daily",
      heatmapWeekly: "Weekly",
      heatmapCumulative: "Cumulative",
      heatmapMonths: "Jan,Feb,Mar,Apr,May,Jun,Jul,Aug,Sep,Oct,Nov,Dec",
      heatmapDayTip: "{date}",
      heatmapWeekTip: "Week of {date}",
      heatmapCumulativeTip: "Cumulative to {date}",
      heatmapValueUnit: "tokens",
      heatmapLess: "Less",
      heatmapMore: "More",
      numberScale: "short",
      durationDay: "d",
      durationHour: "h",
      durationMinute: "m",
      durationSecond: "s",
      daysCount: "{n} d",
      noValue: "—",
      tabDeepseek: "deepseek",
      tabOpencode: "opencode go",
      deepseekPanel: "DeepSeek Platform",
      opencodePanel: "OpenCode Go",
      moduleToken: "Session Token",
      moduleBalance: "Account Balance",
      moduleUsage: "Usage",
      moduleModels: "Model usage details",
      moduleTools: "Web Search & Fetch",
      tokenTitle: "Platform session token",
      tokenConfigured: "Configured",
      tokenMissing: "Not configured — balance and usage are unavailable",
      tokenSourceEnv: "Source: environment",
      tokenPlaceholder: "Paste userToken (platform.deepseek.com)",
      tokenSave: "Save",
      tokenClear: "Clear",
      tokenHint: "Log in to platform.deepseek.com, then run JSON.parse(localStorage.getItem('userToken')).value in DevTools → Console. The token is written to your local credential store only.",
      tokenSaveFailed: "Save failed (credentials channel unavailable)",
      tokenUnavailable: "Credentials channel unavailable — write DEEPSEEK_PLATFORM_TOKEN into ~/.dsh/.credentials.yaml manually",
      summaryToppedUp: "Top-up balance",
      summaryGranted: "Granted balance",
      summaryCumulative: "Cumulative spend",
      rangeTitle: "Time range",
      rangeToday: "Today",
      range7d: "7 days",
      range30d: "30 days",
      rangeThisMonth: "This month",
      rangeLastMonth: "Last month",
      rangeCustom: "Custom",
      rangeCustomRow: "Custom range",
      rangeLimitTooltip: "Up to {n} calendar months",
      rangeSelectDates: "Select dates",
      rangeMonthNames: "January,February,March,April,May,June,July,August,September,October,November,December",
      rangeMonthTitle: "{month} {year}",
      rangeWeekdays: "Su,Mo,Tu,We,Th,Fr,Sa",
      rangePrevMonth: "Previous month",
      rangeNextMonth: "Next month",
      rangeSeparator: "→",
      totalsCost: "Spend",
      totalsRequests: "API requests",
      totalsTokens: "tokens",
      totalsCostHint: "Model {model} + tools {tools}",
      totalsRequestsHint: "Model {model} + tools {tools}",
      totalsToolsUnavailable: "tool data unavailable",
      totalsToolsCostUnavailable: "tool cost unavailable",
      chartTitle: "Spend chart",
      chartEmpty: "No spend data in the selected range",
      tooltipTotal: "Total",
      tokenChartTitle: "Token usage chart",
      tokenChartEmpty: "No token data in the selected range",
      legendMiss: "Input (cache miss)",
      legendHit: "Input (cache hit)",
      legendOut: "Output",
      modelTableTitle: "Per-model table",
      modelsEmpty: "No model data",
      toolsSearch: "Web search",
      toolsFetch: "Web fetch",
      toolsCalls: "Calls",
      toolsCost: "Cost",
      toolsEmpty: "No web search/fetch calls in the selected range",
      toolsUnavailable: "Web search/fetch usage is temporarily unavailable",
      toolsCostChart: "Cost by call type",
      toolsCostEmpty: "No tool cost data in the selected range",
      toolsRequests: "API requests",
      toolsTotalCost: "Total tool cost",
      colModel: "Model",
      colRequests: "Requests",
      colInput: "Input (miss)",
      colCacheHit: "Cache hit",
      colCacheMiss: "Cache miss",
      colOutput: "Output",
      colCost: "Cost",
      keySourceCredentials: "Key source: DSH credentials",
      keySourceAuthJson: "Key source: opencode auth.json",
      keyMissing: "No OpenCode Go API key found (OPENCODE_GO_API_KEY)",
      rolling: "5h rolling",
      weekly: "Weekly",
      monthly: "Monthly",
      limit: "Limit (ref.)",
      reset: "resets",
      countdownHour: "h",
      countdownMinute: "min",
      countdownDay: "d",
      countdownAfter: " until reset",
      countdownNow: "resets now",
      refresh: "Refresh",
      jump: "Open",
      loading: "Loading…",
      loadFailed: "Load failed",
      unknown: "unknown",
      noToken: "Platform token missing: paste your userToken below or set DEEPSEEK_PLATFORM_TOKEN in ~/.dsh/.credentials.yaml",
      tokenExpired: "Platform token expired: log in to platform.deepseek.com again and update userToken",
      noKey: "No OpenCode Go API key found",
      unauthorized: "OpenCode Go API key is invalid or expired (401)",
      goSubscriptionRequired: "The workspace for this key has no active OpenCode Go subscription. Check the subscription in OpenCode Console and use a Go API key from that workspace in DSH.",
      networkError: "Network request failed, try again later",
      badJson: "Failed to parse the endpoint response",
      httpError: "Endpoint returned HTTP {status}",
      menuBalance: "Balance: ",
      menuBalanceTitle: "DeepSeek platform balance",
      menuOpenAccount: "Open account settings",
      trendTitle: "Usage trend (current period)",
      trendEmpty: "No trend data yet",
      trendCurrent: "Used",
      trendPace: "Daily pace",
      trendPaceUnit: "%/day",
      trendProjected: "Projected at reset",
      trendInsufficient: "Period just started",
      trendUsed: "Used",
      trendDayDelta: "That day",
      trendRequests: "Requests",
      trendNotRecorded: "not recorded",
      trendLegendUsage: "Usage",
      trendLegendForecast: "Forecast",
      trendLegendLimit: "Monthly limit",
      trendSourceSampling: "Source: local sampling",
      trendSourceConsole: "Source: OpenCode Console daily report",
      trendSince: "recording since",
      cookieConfigure: "Configure Console cookie",
      cookieUpdate: "Update Console cookie",
      cookieHint: "The Console report only accepts a browser session. On the opencode.ai console open DevTools → Network, pick any console request, and paste the cookie request-header value below. It is stored in this machine's DSH credentials and read only by the host — it never reaches the browser UI, logs, or any response. Paste a fresh value after the session expires.",
      cookiePlaceholder: "Paste the cookie value (a whole cookie: ... line also works)",
      cookieSave: "Save",
      cookieClear: "Clear",
      cookieSaved: "Saved, refetching the Console report",
      cookieSaveFailed: "Save failed, try again",
      cookieConfigured: "Console cookie configured; the report comes from the official console",
      cookieMissing: "No Console cookie configured; using local sampling",
      consoleExpired: "The Console cookie expired or was rejected; falling back to local sampling",
      consoleUnavailable: "The Console report is unavailable right now; falling back to local sampling",
      consoleCookieLooksShort: "This cookie has only {pairs} pair(s) and probably lacks the HttpOnly session cookie: copy the whole request-header line from Network, not document.cookie",
      modelsTitle: "Models this period",
      modelsTokens: "Tokens",
      modelsSource: "From the official OpenCode Console daily CSV (current period totals)"
    };

    const styles = {
      wrap: { maxWidth: 720, display: "flex", flexDirection: "column", gap: 18, padding: "8px 0" },
      panelTitle: { fontSize: 16, fontWeight: 600, margin: 0, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 },
      section: { display: "flex", flexDirection: "column", gap: 12 },
      hint: { color: "var(--dsw-alias-label-tertiary)", fontSize: 13, lineHeight: 1.6, margin: 0 },
      // 区间控件的行内标签：定宽 + 不收缩，保证两个控件左边缘对齐。
      rangeLabel: { color: "var(--dsw-alias-label-tertiary)", fontSize: 13, lineHeight: 1.6, margin: 0, minWidth: 88, flexShrink: 0 },
      error: { color: "var(--dsw-alias-state-error-primary)", fontSize: 13, lineHeight: 1.6, margin: 0 },
      ok: { color: "var(--dsw-alias-state-success-primary)", fontSize: 12, lineHeight: 1.6, margin: 0 },
      card: { border: "1px solid var(--dsw-alias-border-l2)", background: "var(--dsw-alias-bg-layer-3)", borderRadius: 10, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 8 },
      moduleCard: { border: "1px solid var(--dsw-alias-border-l2)", background: "var(--dsw-alias-bg-layer-3)", borderRadius: 10, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 12 },
      moduleHeader: { display: "flex", alignItems: "center", gap: 8, borderBottom: "1px solid var(--dsw-alias-border-l2)", paddingBottom: 8 },
      moduleBar: { width: 3, height: 14, borderRadius: 2, background: "var(--dsw-alias-state-business-primary)", flexShrink: 0 },
      moduleTitle: { margin: 0, fontSize: 13, fontWeight: 600, color: "var(--dsw-alias-label-primary)" },
      moduleChevron: { marginLeft: "auto", color: "var(--dsw-alias-label-tertiary)", display: "flex", alignItems: "center" },
      statGridItem: { display: "flex", flexDirection: "column", gap: 4 },
      cardsGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 8 },
      statLabel: { color: "var(--dsw-alias-label-tertiary)", fontSize: 12, margin: 0 },
      statValue: { fontSize: 18, fontWeight: 600, margin: 0 },
      statHint: { color: "var(--dsw-alias-label-tertiary)", fontSize: 11, lineHeight: 1.5, margin: 0, fontVariantNumeric: "tabular-nums" },
      row: { display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--dsw-alias-label-secondary)", gap: 8 },
      button: { border: "1px solid var(--dsw-alias-border-l2)", color: "var(--dsw-alias-label-primary)", font: "inherit", cursor: "pointer", background: "transparent", borderRadius: 6, padding: "5px 12px" },
      buttonActive: { border: "1px solid var(--dsw-alias-state-business-primary)", color: "var(--dsw-alias-state-business-primary)", font: "inherit", cursor: "pointer", background: "transparent", borderRadius: 6, padding: "5px 12px" },
      buttonsRow: { display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" },
      input: { flex: 1, minWidth: 200, border: "1px solid var(--dsw-alias-border-l2)", background: "var(--dsw-alias-bg-layer-1)", color: "var(--dsw-alias-label-primary)", font: "inherit", borderRadius: 6, padding: "5px 10px" },
      tokenRow: { display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" },
      barTrack: { height: 8, borderRadius: 4, background: "var(--dsw-alias-bg-layer-1)", overflow: "hidden" },
      barFill: { height: "100%", borderRadius: 4, background: "var(--dsw-alias-state-business-primary)", transition: "width .2s ease" },
      badge: { border: "1px solid var(--dsw-alias-border-l2)", color: "var(--dsw-alias-label-secondary)", fontSize: 11, borderRadius: 999, padding: "2px 8px" },
      badgeOk: { border: "1px solid var(--dsw-alias-state-success-primary)", color: "var(--dsw-alias-state-success-primary)", fontSize: 11, borderRadius: 999, padding: "2px 8px" },
      table: { width: "100%", borderCollapse: "collapse", fontSize: 12 },
      th: { textAlign: "left", color: "var(--dsw-alias-label-tertiary)", fontWeight: 500, padding: "4px 8px", borderBottom: "1px solid var(--dsw-alias-border-l2)", whiteSpace: "nowrap" },
      td: { color: "var(--dsw-alias-label-primary)", padding: "5px 8px", borderBottom: "1px solid var(--dsw-alias-border-l1)" },
      tdNum: { color: "var(--dsw-alias-label-primary)", padding: "5px 8px", borderBottom: "1px solid var(--dsw-alias-border-l1)", textAlign: "right", fontVariantNumeric: "tabular-nums" },
      thNum: { textAlign: "right", color: "var(--dsw-alias-label-tertiary)", fontWeight: 500, padding: "4px 8px", borderBottom: "1px solid var(--dsw-alias-border-l2)", whiteSpace: "nowrap" },
      toolGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12 },
      toolCard: { border: "1px solid var(--dsw-alias-border-l2)", background: "var(--dsw-alias-bg-layer-3)", borderRadius: 10, padding: "12px 14px", display: "flex", flexDirection: "column", gap: 8 },
      toolStatGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 },
      toolStatItem: { display: "flex", flexDirection: "column", gap: 2 },
      toolStatLabel: { margin: 0, color: "var(--dsw-alias-label-tertiary)", fontSize: 12 },
      toolStatValue: { margin: 0, color: "var(--dsw-alias-label-primary)", fontSize: 20, fontWeight: 600, fontVariantNumeric: "tabular-nums" },
      toolStatSub: { margin: 0, color: "var(--dsw-alias-label-tertiary)", fontSize: 11, fontVariantNumeric: "tabular-nums" },
      toolCardHead: { display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 },
      toolCardTitle: { margin: 0, color: "var(--dsw-alias-label-primary)", fontSize: 13, fontWeight: 600 },
      toolCardTotal: { margin: 0, color: "var(--dsw-alias-label-secondary)", fontSize: 12, fontVariantNumeric: "tabular-nums" },
      chartWrap: { position: "relative" },
      tooltip: { position: "absolute", zIndex: 6, background: "var(--dsw-alias-bg-layer-3)", border: "1px solid var(--dsw-alias-border-l2)", borderRadius: 8, padding: "6px 10px", fontSize: 12, lineHeight: 1.6, whiteSpace: "nowrap", pointerEvents: "none", boxShadow: "0 4px 16px rgb(0 0 0 / 0.25)" },
      tooltipTitle: { margin: 0, fontWeight: 600, color: "var(--dsw-alias-label-primary)", fontSize: 12 },
      tooltipRow: { margin: 0, color: "var(--dsw-alias-label-secondary)", fontSize: 12, fontVariantNumeric: "tabular-nums" },
      // Token 图 tooltip：表头（日期 + 总量）与「色块 + 名称 + 右对齐数值」明细行
      tooltipHead: { display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 16, margin: 0, fontWeight: 600, fontSize: 12, lineHeight: 1.6, color: "var(--dsw-alias-label-primary)" },
      tooltipHeadValue: { fontWeight: 600, fontVariantNumeric: "tabular-nums" },
      tooltipSwatchRow: { display: "flex", alignItems: "center", gap: 6, margin: 0, fontSize: 12, lineHeight: 1.6, color: "var(--dsw-alias-label-secondary)" },
      tooltipSwatch: { display: "inline-block", width: 10, height: 10, flex: "none", borderRadius: 2 },
      tooltipValue: { marginLeft: "auto", color: "var(--dsw-alias-label-primary)", fontVariantNumeric: "tabular-nums" },
      chip: { border: "1px solid var(--dsw-alias-border-l2)", color: "var(--dsw-alias-label-primary)", font: "inherit", cursor: "pointer", background: "transparent", borderRadius: 999, padding: "4px 12px", fontSize: 12 },
      chipActive: { border: "1px solid var(--dsw-alias-state-business-primary)", color: "var(--dsw-alias-state-business-primary)", font: "inherit", cursor: "pointer", background: "transparent", borderRadius: 999, padding: "4px 12px", fontSize: 12 },
      legendRow: { display: "flex", flexWrap: "wrap", gap: 14, alignItems: "center" },
      swatch: { display: "inline-block", width: 10, height: 10, borderRadius: 3, marginRight: 5, verticalAlign: -1 },
      legendItem: { display: "inline-flex", alignItems: "center", color: "var(--dsw-alias-label-tertiary)", fontSize: 12 },
      trendSummary: { display: "flex", flexWrap: "wrap", gap: 24 },
      trendSummaryItem: { display: "flex", flexDirection: "column", gap: 2 },
      trendSummaryValue: { margin: 0, fontSize: 20, fontWeight: 600, fontVariantNumeric: "tabular-nums", color: "var(--dsw-alias-label-primary)" },
      cookieBox: { border: "1px solid var(--dsw-alias-border-l2)", background: "var(--dsw-alias-bg-layer-3)", borderRadius: 10, padding: "10px 12px", display: "flex", flexDirection: "column", gap: 8 },
      modelList: { display: "flex", flexDirection: "column", gap: 10 },
      modelRow: { display: "flex", flexDirection: "column", gap: 4 },
      modelRowHead: { display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 },
      modelName: { color: "var(--dsw-alias-label-primary)", fontSize: 13, fontWeight: 600 },
      modelShare: { color: "var(--dsw-alias-label-secondary)", fontSize: 13, fontVariantNumeric: "tabular-nums" },
      modelBarTrack: { height: 6, borderRadius: 3, background: "var(--dsw-alias-bg-layer-1)", overflow: "hidden" },
      modelBarFill: { height: "100%", borderRadius: 3, background: "var(--dsw-alias-state-success-primary)", opacity: 0.75 },
      modelTotals: { display: "flex", flexWrap: "wrap", gap: 24, marginTop: 12, paddingTop: 10, borderTop: "1px solid var(--dsw-alias-border-l2)" },
      modelTotalItem: { display: "flex", flexDirection: "column", gap: 2 },
      // 标签栏吸附：设置面板内容区（.VOzbGW_options，overflow-y:auto）滚动时
      // 让 deepseek / opencode go 两个标签停在内容区顶部；背景取面板同色以遮挡滚动内容。
      tabsRow: { display: "flex", gap: 4, borderBottom: "1px solid var(--dsw-alias-border-l2)", marginBottom: 4, position: "sticky", top: 0, zIndex: 5, background: "var(--dsw-alias-bg-layer-2)", paddingTop: 8 },
      tab: { border: "none", background: "transparent", color: "var(--dsw-alias-label-secondary)", font: "inherit", fontSize: 14, padding: "8px 14px", cursor: "pointer", borderBottom: "2px solid transparent", marginBottom: -1 },
      tabActive: { border: "none", background: "transparent", color: "var(--dsw-alias-label-primary)", font: "inherit", fontSize: 14, fontWeight: 600, padding: "8px 14px", cursor: "pointer", borderBottom: "2px solid var(--dsw-alias-state-business-primary)", marginBottom: -1 }
    };

    const OPENCODE_LIMITS = { rolling: "$12", weekly: "$30", monthly: "$60" };
    /** 「跳转」目标：官方对应页面（新标签页打开）。 */
    const DEEPSEEK_USAGE_PAGE_URL = "https://platform.deepseek.com/usage";
    const OPENCODE_GO_PAGE_URL = "https://opencode.ai/console/";
    const PLATFORM_TOKEN_REF = "DEEPSEEK_PLATFORM_TOKEN";

    // ---- helpers -----------------------------------------------------------

    function fmtMoney(v, currency) {
      if (v === null || v === undefined || Number.isNaN(v)) return "—";
      const sym = currency === "CNY" ? "¥" : currency === "USD" ? "$" : "";
      const s = v !== 0 && Math.abs(v) < 0.01 ? v.toFixed(4) : v.toFixed(2);
      return sym + s;
    }

    function fmtCount(v) {
      if (v === null || v === undefined || Number.isNaN(v)) return "—";
      return Math.round(v).toLocaleString();
    }

    // ---- 网页搜索 / 抓取工具与账户菜单余额助手 --------------------------------

    /** 平台函数名 → 文案键；未知函数原样展示。 */
    const TOOL_I18N = { "tool-search": "toolsSearch", "tool-fetch": "toolsFetch" };

    function toolLabelOf(id, t) {
      const key = TOOL_I18N[id];
      return key === undefined ? String(id) : t(key);
    }

    /** 工具系列色（与主题变量联动）。 */
    const TOOL_COLORS = [
      "var(--dsw-alias-state-business-primary)",
      "var(--dsw-alias-state-warn-primary)",
      "var(--dsw-alias-state-success-primary)"
    ];

    function toolColorOf(index) {
      return TOOL_COLORS[index % TOOL_COLORS.length];
    }

    /** `YYYY-MM-DD` → `M/D`（图表横轴短标签）。 */
    function fmtShortDate(date) {
      const m = /^\d{4}-(\d{2})-(\d{2})$/.exec(date);
      return m === null ? date : `${Number(m[1])}/${Number(m[2])}`;
    }

    /** 平台「可用余额」= 充值余额 + 赠送余额；无法取值返回 null。 */
    function balanceTotalOf(body) {
      if (body === null || typeof body !== "object" || body.ok !== true) return null;
      const balance = body.balance !== null && typeof body.balance === "object" ? body.balance : {};
      const values = [balance.toppedUp, balance.granted].filter(
        (v) => typeof v === "number" && Number.isFinite(v)
      );
      if (values.length === 0) return null;
      return values.reduce((sum, v) => sum + v, 0);
    }

    /** 账户菜单余额文案：`余额：¥3.29`；失败/无值显示 `余额：—`。 */
    function balanceTextOf(body, t) {
      const total = balanceTotalOf(body);
      if (total === null) return t("menuBalance") + "—";
      const currency =
        body !== null && typeof body === "object" && body.balance !== null && typeof body.balance === "object"
          ? body.balance.currency
          : null;
      return t("menuBalance") + fmtMoney(total, currency);
    }

    function fmtReset(resetsAt, t) {
      if (!resetsAt) return t("unknown");
      const d = new Date(resetsAt);
      if (Number.isNaN(d.getTime())) return resetsAt;
      return d.toLocaleString();
    }

    /**
     * 配额窗口重置倒计时。kind: "rolling"（5小时窗口 → X小时X分钟）、
     * "daily"/"weekly"/"monthly"（→ X天X小时）。已过重置时间返回"即将重置"。
     */
    function fmtCountdown(resetsAt, kind, t) {
      if (!resetsAt) return null;
      const ms = new Date(resetsAt).getTime() - Date.now();
      if (Number.isNaN(ms)) return null;
      if (ms <= 0) return t("countdownNow");
      const totalMin = Math.floor(ms / 60000);
      const days = Math.floor(totalMin / 1440);
      const hours = Math.floor((totalMin % 1440) / 60);
      const mins = totalMin % 60;
      if (kind === "rolling") {
        return `${hours}${t("countdownHour")}${mins}${t("countdownMinute")}${t("countdownAfter")}`;
      }
      return `${days}${t("countdownDay")}${hours}${t("countdownHour")}${t("countdownAfter")}`;
    }

    function fmtDate(d) {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${y}-${m}-${day}`;
    }

    function todayDate() {
      return fmtDate(new Date());
    }

    function addDays(dateStr, n) {
      const d = new Date(dateStr + "T00:00:00");
      d.setDate(d.getDate() + n);
      return fmtDate(d);
    }

    // ---- 区间日历纯函数（0.5.0） ---------------------------------------------
    // 全部不触碰 DOM，方便单测锁定「周日起始」「跨年」「反向区间」等边界。

    /** `YYYY-MM-DD` 的合法性（同时挡住 2026-02-30 这类不存在的日期）。 */
    function isDateKey(value) {
      if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
      const d = new Date(value + "T00:00:00");
      return !Number.isNaN(d.getTime()) && fmtDate(d) === value;
    }

    /** 月份加减：delta 可为负；返回 { year, month }（month 为 1-12）。 */
    function addMonths(year, month, delta) {
      const index = (Number(year) || 0) * 12 + ((Number(month) || 1) - 1) + (Number(delta) || 0);
      return { year: Math.floor(index / 12), month: (index % 12) + 1 };
    }

    /**
     * 构造单月网格：周日起始，前后用 null 补齐成整周。
     * @returns {{ year:number, month:number, weeks: Array<Array<{key:string,day:number}|null>> }}
     */
    function buildMonthGrid(year, month) {
      const first = new Date(year, month - 1, 1);
      const daysInMonth = new Date(year, month, 0).getDate();
      const lead = first.getDay(); // 0=周日
      const cells = [];
      for (let i = 0; i < lead; i += 1) cells.push(null);
      for (let day = 1; day <= daysInMonth; day += 1) {
        cells.push({ key: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`, day });
      }
      while (cells.length % 7 !== 0) cells.push(null);
      const weeks = [];
      for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
      return { year, month, weeks };
    }

    /** 星期表头（7 项），来自当前语言字典。 */
    function weekdayLabels(t) {
      const raw = typeof t === "function" ? t("rangeWeekdays") : "";
      const list = String(raw).split(",").map((s) => s.trim());
      if (list.length === 7) return list;
      return ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
    }

    /** 月标题：按语言模板拼装（zh → 2026年10月，en → October 2026）。 */
    function formatMonthTitle(year, month, t) {
      const names = String(typeof t === "function" ? t("rangeMonthNames") : "").split(",");
      const name = (names[month - 1] || String(month)).trim();
      const template = typeof t === "function" ? t("rangeMonthTitle") : "{month} {year}";
      return String(template).replace("{year}", String(year)).replace("{month}", name);
    }

    /** 两端排序：反向选择也返回 from <= to。非法输入返回 null。 */
    function normalizeRange(a, b) {
      if (!isDateKey(a) || !isDateKey(b)) return null;
      return a <= b ? { from: a, to: b } : { from: b, to: a };
    }

    /** 是否晚于今天（日历里置灰不可选）。 */
    function isFutureDate(key, todayKey) {
      if (!isDateKey(key) || !isDateKey(todayKey)) return false;
      return key > todayKey;
    }

    /** `YYYY-MM-DD` → 所在月 { year, month }；非法输入回落到今天。 */
    function monthOfDateKey(key, fallbackKey) {
      const base = isDateKey(key) ? key : isDateKey(fallbackKey) ? fallbackKey : todayDate();
      const m = /^(\d{4})-(\d{2})/.exec(base);
      return { year: Number(m[1]), month: Number(m[2]) };
    }

    /** 同月内平移：日期溢出时夹到当月最后一天（1/31 + 1 月 → 2/28）。 */
    function shiftMonthKey(key, delta) {
      if (!isDateKey(key)) return key;
      const base = monthOfDateKey(key);
      const next = addMonths(base.year, base.month, delta);
      const daysInMonth = new Date(next.year, next.month, 0).getDate();
      const day = Math.min(Number(key.slice(8, 10)), daysInMonth);
      return `${next.year}-${String(next.month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }

    /** 所在周的周日 / 周六（周日起始，与日历表头一致）。 */
    function startOfWeekKey(key) {
      if (!isDateKey(key)) return key;
      return addDays(key, -new Date(key + "T00:00:00").getDay());
    }

    function endOfWeekKey(key) {
      if (!isDateKey(key)) return key;
      return addDays(key, 6 - new Date(key + "T00:00:00").getDay());
    }

    /**
     * 区间带形状：起点格只画右半、终点格只画左半、中间整格。
     * 首尾相同（单日区间）或输入非法时返回 null（不画带）。
     * @returns {"start"|"middle"|"end"|null}
     */
    function bandKind(from, to, key) {
      if (!isDateKey(from) || !isDateKey(to) || from >= to) return null;
      if (key === from) return "start";
      if (key === to) return "end";
      if (key > from && key < to) return "middle";
      return null;
    }

    /**
     * 日历实际展示的区间：两端齐全用已选区间；只选了起点时用「起点 ↔ 悬停日」做预览。
     * @returns {{ from: string|null, to: string|null }}
     */
    function previewRange(staged, hoverKey) {
      const from = staged !== null && typeof staged === "object" && isDateKey(staged.from) ? staged.from : null;
      const to = staged !== null && typeof staged === "object" && isDateKey(staged.to) ? staged.to : null;
      if (from !== null && to !== null) return { from, to };
      if (from !== null && isDateKey(hoverKey)) {
        return hoverKey < from ? { from: hoverKey, to: from } : { from, to: hoverKey };
      }
      return { from: null, to: null };
    }

    /**
     * 用量合计口径（0.5.0）：消费金额与请求次数 = 模型 + 工具。
     * 工具数据缺失时按 0 累加，并用 partial 标记让界面显示降级提示。
     */
    function combinedTotals(usage) {
      const body = usage !== null && typeof usage === "object" ? usage : {};
      const totals = body.totals !== null && typeof body.totals === "object" ? body.totals : {};
      const tools = body.tools !== null && typeof body.tools === "object" ? body.tools : null;
      const toolsOk = tools !== null && tools.ok === true;
      const toolTotals = toolsOk && tools.totals !== null && typeof tools.totals === "object" ? tools.totals : null;
      const toolCalls = toolTotals !== null && typeof toolTotals.calls === "number" ? toolTotals.calls : null;
      const toolCost =
        toolsOk && tools.costAvailable === true && toolTotals !== null && typeof toolTotals.cost === "number"
          ? toolTotals.cost
          : null;
      const modelCost = typeof totals.cost === "number" ? totals.cost : null;
      const modelRequests = typeof totals.requests === "number" ? totals.requests : null;
      return {
        modelCost,
        modelRequests,
        toolCost,
        toolCalls,
        toolsOk,
        tokens: typeof totals.tokens === "number" ? totals.tokens : null,
        cost: modelCost === null ? null : modelCost + (toolCost === null ? 0 : toolCost),
        requests: modelRequests === null ? null : modelRequests + (toolCalls === null ? 0 : toolCalls),
        costPartial: toolCost === null,
        requestsPartial: toolCalls === null
      };
    }

    // ---- 「概览」标签页：年度聚合、热力图网格与格式化（0.5.0） ----------------
    // 全部纯函数，便于单测锁定跨年、闰年、分位阈值等边界。

    /** `YYYY-MM-DD` → 年份（非法返回 null）。 */
    function yearOfDayKey(key) {
      if (!isDateKey(key)) return null;
      return Number(key.slice(0, 4));
    }

    /** 某年的全部日期 key（含闰年 2 月 29 日）。 */
    function dayKeysOfYear(year) {
      const keys = [];
      const cursor = new Date(year, 0, 1);
      while (cursor.getFullYear() === year) {
        keys.push(fmtDate(cursor));
        cursor.setDate(cursor.getDate() + 1);
      }
      return keys;
    }

    /** 年度 token 合计。 */
    function sumYearTokens(days, year) {
      let total = 0;
      for (const key of dayKeysOfYear(year)) {
        const value = days !== null && typeof days === "object" ? days[key] : undefined;
        if (typeof value === "number" && value > 0) total += value;
      }
      return total;
    }

    /** 年度峰值：{ date, tokens }；无数据时 tokens 为 0。 */
    function peakOfYear(days, year) {
      let best = { date: null, tokens: 0 };
      for (const key of dayKeysOfYear(year)) {
        const value = days !== null && typeof days === "object" ? days[key] : undefined;
        if (typeof value !== "number" || !(value > 0)) continue;
        if (value > best.tokens) best = { date: key, tokens: value };
      }
      return best;
    }

    /** 年度内最长连续「有消耗」天数。 */
    function longestStreakOfYear(days, year) {
      let best = 0;
      let run = 0;
      for (const key of dayKeysOfYear(year)) {
        const value = days !== null && typeof days === "object" ? days[key] : undefined;
        if (typeof value === "number" && value > 0) {
          run += 1;
          if (run > best) best = run;
        } else {
          run = 0;
        }
      }
      return best;
    }

    /**
     * 当前连续天数：从今天往回数；今天还没用量时从昨天开始数（避免早上打开就显示 0）。
     * @param {Record<string, number>} days
     * @param {string} todayKey
     */
    function currentStreakOfDays(days, todayKey) {
      if (!isDateKey(todayKey)) return 0;
      const has = (key) => {
        const value = days !== null && typeof days === "object" ? days[key] : undefined;
        return typeof value === "number" && value > 0;
      };
      let cursor = has(todayKey) ? todayKey : addDays(todayKey, -1);
      let streak = 0;
      while (has(cursor)) {
        streak += 1;
        cursor = addDays(cursor, -1);
      }
      return streak;
    }

    /**
     * 年度热力图网格：按周分列（周日起始），首尾补齐成整周。
     * @returns {{ year:number, weeks: Array<Array<{ key:string, inYear:boolean, day:number }>> }}
     */
    /**
     * 构造整年网格：**以周一为一周起点**（与「每周」统计口径一致），
     * 前后用上一年的末尾与下一年的开头补满整周。
     * 每列 = 一周，列内行号 0 = 周一 … 6 = 周日。
     */
    function buildYearWeeks(year) {
      const first = new Date(year, 0, 1);
      const last = new Date(year, 11, 31);
      // getDay()：0=周日 … 6=周六；换算成「距离本周周一的天数」= (d + 6) % 7。
      const start = new Date(first);
      start.setDate(start.getDate() - ((first.getDay() + 6) % 7));
      const end = new Date(last);
      end.setDate(end.getDate() + (6 - ((last.getDay() + 6) % 7)));
      const weeks = [];
      const cursor = new Date(start);
      while (cursor <= end) {
        const cells = [];
        for (let i = 0; i < 7; i += 1) {
          const key = fmtDate(cursor);
          cells.push({ key, inYear: cursor.getFullYear() === year, day: cursor.getDate() });
          cursor.setDate(cursor.getDate() + 1);
        }
        weeks.push(cells);
      }
      return { year, weeks };
    }

    /**
     * 月份刻度抽稀：列宽不足时跳过挤在一起的月份，返回实际要显示的月份。
     * @param {{ month:number, weekIndex:number }[]} anchors 每个月的起始列
     * @param {number} minGap 两个标签之间最少的列数
     */
    function thinMonthAnchors(anchors, minGap = 4) {
      const list = Array.isArray(anchors) ? anchors : [];
      const gap = typeof minGap === "number" && minGap >= 1 ? minGap : 4;
      const out = [];
      for (const anchor of list) {
        if (anchor === null || typeof anchor !== "object") continue;
        const previous = out[out.length - 1];
        if (previous !== undefined && anchor.weekIndex - previous.weekIndex < gap) continue;
        out.push(anchor);
      }
      return out;
    }

    /** 每周合计（只统计属于本年的天）。 */
    function weekTotalsOf(days, weeks) {
      return weeks.map((cells) => {
        let total = 0;
        for (const cell of cells) {
          if (!cell.inYear) continue;
          const value = days !== null && typeof days === "object" ? days[cell.key] : undefined;
          if (typeof value === "number" && value > 0) total += value;
        }
        return total;
      });
    }

    /** 每天 → 从年初起算的累计值（不属于本年的天为 0）。 */
    function cumulativeByDay(days, weeks) {
      const out = {};
      let acc = 0;
      for (const cells of weeks) {
        for (const cell of cells) {
          if (!cell.inYear) continue;
          const value = days !== null && typeof days === "object" ? days[cell.key] : undefined;
          if (typeof value === "number" && value > 0) acc += value;
          out[cell.key] = acc;
        }
      }
      return out;
    }

    /** 每周「有用量的天数」（只算属于本年的天）——决定该列从下往上填几格。 */
    function weekActiveDaysOf(days, weeks) {
      return weeks.map((cells) => {
        let count = 0;
        for (const cell of cells) {
          if (!cell.inYear) continue;
          const value = days !== null && typeof days === "object" ? days[cell.key] : undefined;
          if (typeof value === "number" && value > 0) count += 1;
        }
        return count;
      });
    }

    /**
     * 每周「最后一个有效日期」：属于本年、且不晚于今天。
     * 累计值的取值口径与提示框的日期都用它，两者才对得上。
     */
    function weekLastKeyOf(weeks, todayKey) {
      return weeks.map((cells) => {
        let last = null;
        for (const cell of cells) {
          if (!cell.inYear) continue;
          if (typeof todayKey === "string" && cell.key > todayKey) break;
          last = cell.key;
        }
        return last;
      });
    }

    /**
     * 每周的累计口径数值：取「该周最后一天（不晚于今天）」的累计值，
     * 让同一列共用一种颜色，并保证从左到右单调不减。
     * 整周都排在未来时该列没有代表日，沿用上一列的累计值（而不是回落成 0），
     * 这样色阶阈值和列间比较都不会出现「末尾突然掉回去」。
     */
    function weekCumulativeOf(weeks, cumulative, todayKey) {
      let carried = 0;
      return weekLastKeyOf(weeks, todayKey).map((lastKey) => {
        if (lastKey === null) return carried;
        const value = cumulative !== null && typeof cumulative === "object" ? cumulative[lastKey] : undefined;
        if (typeof value === "number") carried = value;
        return carried;
      });
    }

    /**
     * 色阶阈值：在 log10 空间取 P25/P50/P75 三条边界，再换算回 Token 数值，严格递增。
     * 用量跨 4 个数量级（万 → 亿），线性分位会把 1M 量级的日子全压进「无色」档，
     * 所以必须按数量级分档；三条边界恰好切出四档，配合 levelOfValue
     * 「正数至少一档」，只有 0 Token 无填充。
     */
    function quantileThresholds(values) {
      const positive = (Array.isArray(values) ? values : []).filter((v) => typeof v === "number" && v > 0);
      if (positive.length === 0) return [0, 0, 0];
      // 在 log10 空间取分位：用量常跨 4 个数量级（万 → 亿），线性分位会把
      // 「几万」和「几百万」压进同一档，导致大量日子看不出差别。
      const logs = positive.map((v) => Math.log10(v + 1)).sort((a, b) => a - b);
      const pick = (p) => logs[Math.min(logs.length - 1, Math.max(0, Math.ceil(p * logs.length) - 1))];
      // 三条边界切出四档：< b0 为第 1 档、b0…b1 为第 2 档、b1…b2 为第 3 档、≥ b2 为第 4 档。
      // 边界取 p75 而不是 p99，最高档才总是可达（否则最大值自己也进不了第 4 档）。
      // 保持严格递增：数据全是同一个值时三条边界会相等，那样四档就退化成一档。
      const out = [];
      for (const x of [pick(0.25), pick(0.5), pick(0.75)]) {
        const next = Math.max(Math.round(Math.pow(10, x) - 1), (out[out.length - 1] ?? -1) + 1);
        out.push(next);
      }
      return out;
    }

    /**
     * 把一整年的周列按顺序切成若干块。
     * 设置面板里热力图只有约 530px 可用，53 列挤在一行每格不足 7px；
     * 切成两行后每格约 16px，才能画出与官方参考图一致的圆角方块。
     * 返回 [{ startIndex, weeks }]，startIndex 是该块第一列在全年里的下标，
     * 供 heatLevelOf / tooltip 继续用「全年列号」取每周聚合值。
     */
    function splitWeekColumns(weeks, blockCount) {
      const list = Array.isArray(weeks) ? weeks : [];
      const count = Math.max(1, Math.floor(Number(blockCount) || 1));
      if (list.length === 0) return [];
      // 尽量均分：余数补给前面的块，避免最后一行只有一两列。
      const perBlock = Math.ceil(list.length / count);
      const blocks = [];
      for (let start = 0; start < list.length; start += perBlock) {
        blocks.push({ startIndex: start, weeks: list.slice(start, start + perBlock) });
      }
      return blocks;
    }

    /**
     * 每日模式的固定分级边界（token 数）：100 万 / 1000 万 / 1 亿 / 5 亿。
     * 固定十进制数量级的好处：颜色含义永远稳定（不随当年数据漂移）、
     * 与 tooltip 的「万 / 亿」格式天然对齐。每周与累计两个模式仍用动态分位：
     * 累计值单调递增，固定边界会让整年变成渐变条。
     */
    const DAILY_LEVEL_BOUNDS = [1e6, 1e7, 1e8, 5e8];

    /**
     * 数值 → 0（无填充）…5（最深）。
     * 只要 value > 0 就至少落在第 1 档——颜色分级只用来区分「多与少」，
     * 「有没有」由 0 Token 这一档单独表达。
     * thresholds 传 [1e6, 1e7, 1e8, 5e8] 时即每日固定分级；每周/累计传动态分位。
     */
    function levelOfValue(value, thresholds) {
      if (typeof value !== "number" || !(value > 0)) return 0;
      const list = Array.isArray(thresholds) ? thresholds : [];
      let level = 1;
      // 越过第 i+1 条边界就升一档：越过 b0 为 2 档、b1 为 3 档、b2 为 4 档、b3 为 5 档。
      for (let i = 0; i < list.length; i += 1) {
        if (value >= list[i]) level = i + 2;
      }
      return Math.min(level, 5);
    }

    /**
     * 热力图单格色阶：把三种模式统一成「取值 → 0…5」。
     * 每周与累计总量都采用「自下而上填充」：一列从最底格往上连续着色，
     * 填满几格 = 那一周有几天用过（Codex / 官方平台的做法），一眼看出用了几天。
     * - daily：按当天用量着色，只有 0 Token 留白；
     * 列内自下而上 = 周日 → 周一，「底部」是本周的最后一天（周日）。
     * - weekly：整列同色（取该周合计），从底部起填「当周有用量的天数」格；
     * - cumulative：整列同色（取截至该周末的累计值），同样从底部起填「当周有用量的天数」格。
     */
    function heatLevelOf(mode, key, weekIndex, context) {
      const { days, weeklyTotals, weekCumulative, thresholds, activeDays, dailyThresholds } = context;
      const raw = days !== null && typeof days === "object" ? days[key] : undefined;
      const own = typeof raw === "number" && raw > 0 ? raw : 0;
      if (mode === "weekly" || mode === "cumulative") {
        // 行号 0 = 周日 … 6 = 周六；「自下而上」即只保留末尾 count 行。
        const row = typeof context.rowOf === "function" ? context.rowOf(key) : null;
        const count = Array.isArray(activeDays) ? activeDays[weekIndex] ?? 0 : 0;
        if (typeof row !== "number" || count <= 0 || row < 7 - count) return 0;
        const series = mode === "weekly" ? weeklyTotals : weekCumulative;
        const value = Array.isArray(series) ? series[weekIndex] ?? 0 : 0;
        return levelOfValue(typeof value === "number" ? value : 0, thresholds);
      }
      // 每日模式：固定十进制数量级分级（100万/1000万/1亿/5亿），颜色含义不随数据漂移。
      return levelOfValue(own, dailyThresholds ?? thresholds);
    }

    /** 去掉小数末尾多余的 0：19.10 → 19.1，20.00 → 20。 */
    function trimTrailingZero(text) {
      return String(text).includes(".") ? String(text).replace(/\.?0+$/, "") : String(text);
    }

    /**
     * 提示框定位：以锚点为中心水平居中，并夹在视口内；上方不够时翻到锚点下方。
     * 纯函数，便于单测锁定贴边行为。
     * @returns {{ left:number, top:number }}
     */
    function clampTipPosition(anchorX, anchorY, boxW, boxH, viewportW, margin = 8) {
      const w = typeof boxW === "number" && boxW > 0 ? boxW : 0;
      const h = typeof boxH === "number" && boxH > 0 ? boxH : 0;
      const vw = typeof viewportW === "number" && viewportW > 0 ? viewportW : 0;
      const m = typeof margin === "number" && margin >= 0 ? margin : 8;
      const maxLeft = Math.max(m, vw - w - m);
      const left = Math.round(Math.min(Math.max((anchorX ?? 0) - w / 2, m), maxLeft));
      let top = Math.round((anchorY ?? 0) - h - 6);
      if (top < m) top = Math.round((anchorY ?? 0) + 24);
      return { left, top };
    }

    /** token 数紧凑展示：中文 万/亿，英文 K/M/B。 */
    function formatTokenCount(value, scale) {
      if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return "—";
      if (scale === "wan") {
        if (value >= 1e8) return `${trimTrailingZero((value / 1e8).toFixed(2))}亿`;
        if (value >= 1e4) return `${trimTrailingZero((value / 1e4).toFixed(1))}万`;
        return Math.round(value).toLocaleString();
      }
      if (value >= 1e9) return `${trimTrailingZero((value / 1e9).toFixed(2))}B`;
      if (value >= 1e6) return `${trimTrailingZero((value / 1e6).toFixed(1))}M`;
      if (value >= 1e3) return `${trimTrailingZero((value / 1e3).toFixed(1))}K`;
      return Math.round(value).toLocaleString();
    }

    /**
     * 时长展示：`X天Y小时` / `X小时Y分` / `X分` / `X秒`。
     * @param {number} ms
     * @param {{ day:string, hour:string, minute:string, second:string }} units
     */
    function formatDurationMs(ms, units) {
      if (typeof ms !== "number" || !Number.isFinite(ms) || ms < 0) return "—";
      const u = units !== null && typeof units === "object" ? units : {};
      const day = typeof u.day === "string" ? u.day : "d";
      const hour = typeof u.hour === "string" ? u.hour : "h";
      const minute = typeof u.minute === "string" ? u.minute : "m";
      const second = typeof u.second === "string" ? u.second : "s";
      const totalSeconds = Math.floor(ms / 1000);
      const days = Math.floor(totalSeconds / 86400);
      const hours = Math.floor((totalSeconds % 86400) / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = totalSeconds % 60;
      if (days > 0) return hours > 0 ? `${days}${day}${hours}${hour}` : `${days}${day}`;
      if (hours > 0) return minutes > 0 ? `${hours}${hour}${minutes}${minute}` : `${hours}${hour}`;
      if (minutes > 0) return `${minutes}${minute}`;
      return `${seconds}${second}`;
    }

    /** 预设时间范围：{ id, from, to }。 */
    function presets() {
      const now = new Date();
      const today = fmtDate(now);
      const thisMonth = { from: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`, to: today };
      const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
      const lastMonth = {
        from: `${lastMonthEnd.getFullYear()}-${String(lastMonthEnd.getMonth() + 1).padStart(2, "0")}-01`,
        to: fmtDate(lastMonthEnd)
      };
      // 不再提供「近 90 天」：90 天实测有 338/365 会跨 4 个自然月，
      // 与 MAX_RANGE_MONTHS=3 的上限冲突，选择时会被日历置灰逻辑挡住。
      return [
        { id: "today", from: today, to: today },
        { id: "7d", from: addDays(today, -6), to: today },
        { id: "30d", from: addDays(today, -29), to: today },
        { id: "thisMonth", from: thisMonth.from, to: thisMonth.to },
        { id: "lastMonth", from: lastMonth.from, to: lastMonth.to }
      ];
    }

    /**
     * 单次查询允许的最大自然月数（与宿主 index.js 的 MAX_MONTHS 默认值一致）。
     * 宿主侧仍保留 DSH_ACCOUNT_USAGE_MAX_MONTHS 环境变量作为服务端防御；
     * 前端无法得知它被改成多少，因此这里硬编码 3，保证正常操作永不触发宿主裁剪。
     */
    const MAX_RANGE_MONTHS = 3;

    /** `YYYY-MM-DD` → 连续的年月序号；非法输入返回 null。 */
    function monthIndexKey(key) {
      if (!isDateKey(key)) return null;
      return Number(key.slice(0, 4)) * 12 + (Number(key.slice(5, 7)) - 1);
    }

    /**
     * 区间覆盖的自然月数量（含首尾），口径与宿主 lib/aggregate.js 的 monthsBetween 一致。
     * 例：2026-09-01~2026-11-20 → 3；2026-08-31~2026-11-20 → 4。非法输入返回 0。
     */
    function monthSpanOf(fromKey, toKey) {
      const a = monthIndexKey(fromKey);
      const b = monthIndexKey(toKey);
      if (a === null || b === null) return 0;
      return Math.abs(a - b) + 1;
    }

    /**
     * 该日期与锚点组成的区间是否仍在 maxMonths 个自然月内（跨度对称：
     * 往前选与往后选用同一判据）。任一日期非法时返回 true（放行，交给别处校验）。
     */
    function withinMonthLimit(key, anchorKey, maxMonths) {
      const span = monthSpanOf(key, anchorKey);
      if (span === 0) return true;
      return span <= (Number.isFinite(maxMonths) ? maxMonths : MAX_RANGE_MONTHS);
    }

    /**
     * 静默收紧：保持 to 不动、把 from 后移，直到自然月数 ≤ maxMonths。
     * 收紧后 from 落在「to 所在月往前推 maxMonths-1 个月」的 1 号。
     * 已满足或输入非法时原样返回。
     */
    function clampRangeToMonths(fromKey, toKey, maxMonths) {
      const limit = Number.isFinite(maxMonths) ? maxMonths : MAX_RANGE_MONTHS;
      if (!isDateKey(fromKey) || !isDateKey(toKey)) return { from: fromKey, to: toKey };
      const normalized = normalizeRange(fromKey, toKey);
      if (normalized === null) return { from: fromKey, to: toKey };
      if (monthSpanOf(normalized.from, normalized.to) <= limit) return normalized;
      const endIndex = monthIndexKey(normalized.to);
      const startIndex = endIndex - (Math.max(1, Math.floor(limit)) - 1);
      const year = Math.floor(startIndex / 12);
      const month = (startIndex % 12) + 1;
      return { from: `${year}-${String(month).padStart(2, "0")}-01`, to: normalized.to };
    }

    async function fetchJson(path) {
      const res = await fetch(path, { headers: { Accept: "application/json" } });
      let body = null;
      try {
        body = await res.json();
      } catch {
        /* non-JSON response */
      }
      if (body === null || typeof body !== "object") throw new Error("HTTP " + res.status);
      return body;
    }

    function errorText(body, t) {
      if (body === null || body.ok !== false) return t("loadFailed");
      const code = body.code;
      if (code === "no-token") return t("noToken");
      if (code === "token-expired") return t("tokenExpired");
      if (code === "no-key") return t("noKey");
      if (code === "unauthorized") return t("unauthorized");
      if (code === "go-subscription-required") return t("goSubscriptionRequired");
      if (code === "network") return t("networkError");
      if (code === "bad-json") return t("badJson");
      if (typeof code === "string" && code.startsWith("http-")) {
        return t("httpError").replace("{status}", code.slice(5));
      }
      return typeof body.message === "string" && body.message !== "" ? body.message : t("loadFailed");
    }

    /**
     * 账户页原先消费 connection.api 的 { rpcId, result } 信封，且 describe
     * 的成功值嵌在 value.credentials。rc.1 的 remote.credentials 直接返回
     * RemoteResult，describe 的 value 则是按凭据引用索引的记录。此适配层
     * 恢复旧面板契约，令令牌编辑和账户页不必各自处理传输层差异。
     */
    function createCredentialApi(remote) {
      const credentials = remote && remote.credentials;
      if (
        !credentials ||
        typeof credentials.describe !== "function" ||
        typeof credentials.set !== "function" ||
        typeof credentials.unset !== "function"
      ) return null;

      const invoke = (method, args, mapResult) =>
        Promise.resolve()
          .then(() => credentials[method](...args))
          .then((result) => ({ result: mapResult ? mapResult(result) : result }));

      return {
        describe({ refs }) {
          return invoke("describe", [refs], (result) => {
            if (!result || result.ok !== true) return result;
            return { ...result, value: { credentials: result.value } };
          });
        },
        set({ ref, value }) {
          return invoke("set", [ref, value]);
        },
        unset({ ref }) {
          return invoke("unset", [ref]);
        }
      };
    }

    /**
     * 凭据适配器返回 { result: { ok, value|error } } 信封；解出 result
     * 分支，信封缺失返回 null（调用方按失败处理）。
     */
    function unwrapRpc(r) {
      if (r === null || typeof r !== "object" || r.result === null || typeof r.result !== "object") return null;
      return r.result;
    }

    // ---- components --------------------------------------------------------

    function RefreshButton({ onClick, t }) {
      return React.createElement("button", { style: styles.button, onClick }, t("refresh"));
    }

    /** 「跳转」按钮：在新浏览器标签页打开官方用量页面。 */
    function JumpButton({ url, t }) {
      return React.createElement("button", {
        style: styles.button,
        onClick: () => window.open(url, "_blank", "noopener,noreferrer")
      }, t("jump"));
    }

    /** 分组卡片：标题栏（3px 主题色竖条 + 标题 + 底部分隔线）+ 内容区。
     * collapsible 时标题栏可点击折叠/展开；collapsed 为受控状态（由父组件管理）。 */
    function ModuleCard({ title, children, collapsible, collapsed, onToggle }) {
      // 折叠时标题栏不显示底部横线（borderBottom + 其留白一并移除）
      const headerStyle = collapsible
        ? collapsed
          ? { ...styles.moduleHeader, cursor: "pointer", borderBottom: "none", paddingBottom: 0 }
          : { ...styles.moduleHeader, cursor: "pointer" }
        : styles.moduleHeader;
      const header = React.createElement("div", {
        style: headerStyle,
        onClick: collapsible ? onToggle : undefined,
        role: collapsible ? "button" : undefined,
        "aria-expanded": collapsible ? !collapsed : undefined
      },
        React.createElement("span", { style: styles.moduleBar }),
        React.createElement("p", { style: styles.moduleTitle }, title),
        collapsible
          ? React.createElement("span", { style: styles.moduleChevron },
            React.createElement("svg", {
              width: 12,
              height: 12,
              viewBox: "0 0 16 16",
              fill: "none",
              style: { transition: "transform .15s ease", transform: collapsed ? "rotate(-90deg)" : "none", display: "block" },
              "aria-hidden": true
            },
              React.createElement("path", { d: "M4 6l4 4 4-4", stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round", strokeLinejoin: "round" })
            )
          )
          : null
      );
      return React.createElement("div", { style: styles.moduleCard },
        header,
        collapsible && collapsed ? null : children
      );
    }

    /** 无边框统计项（模块卡片内使用，避免“卡中卡”）。 */
    /** 统计格：主数值 + 可选副行（0.5.0 起用于标注「模型 + 工具」的构成）。 */
    function StatGridItem({ label, value, hint }) {
      return React.createElement("div", { style: styles.statGridItem },
        React.createElement("p", { style: styles.statLabel }, label),
        React.createElement("p", { style: styles.statValue }, value),
        hint === null || hint === undefined || hint === ""
          ? null
          : React.createElement("p", { style: styles.statHint }, hint)
      );
    }

    /** 图表共用参数。 */
    const CHART_W = 640;
    const CHART_H = 170;
    const CHART_PAD_L = 8;
    const CHART_PAD_R = 8;
    const CHART_PAD_B = 22;
    const CHART_PAD_T = 14;

    /**
     * tooltip 悬浮层：像素级左右钳制，保证单行 tooltip 在图表/视口左右边缘
     * 完整可见；图表容器顶部空间不足时翻转至绘图区基线下方弹出，避免被页面
     * 上边缘截断。anchorIndex 为悬浮列索引（0..count-1），wrapRef 指向
     * position:relative 的图表容器（chartWrap）。
     * 折线/面积图可直接传 anchorX（SVG viewBox 坐标），跳过柱状图列中心换算。
     */
    function ChartTooltip({ anchorIndex, anchorX, count, wrapRef, chartWidth = CHART_W, chartHeight = CHART_H, children }) {
      const tipRef = React.useRef(null);
      const [pos, setPos] = React.useState(null);
      React.useLayoutEffect(() => {
        const tip = tipRef.current;
        const wrap = wrapRef.current;
        if (!tip || !wrap) return;
        const wrapRect = wrap.getBoundingClientRect();
        const tipW = tip.offsetWidth;
        const tipH = tip.offsetHeight;
        if (tipW <= 0 || tipH <= 0) return;
        // 列中心（SVG viewBox 坐标系 → 容器像素，含左内边距）
        const slot = (chartWidth - CHART_PAD_L - CHART_PAD_R) / count;
        const x = anchorX !== undefined
          ? anchorX
          : CHART_PAD_L + (anchorIndex + 0.5) * slot;
        const centerX = wrapRect.width * (x / chartWidth);
        let left = Math.round(centerX - tipW / 2);
        // 视口钳制：左右各留 8px 安全边距，再收拢回容器内
        const vpLeft = wrapRect.left + left;
        const vpRight = vpLeft + tipW;
        if (vpLeft < 8) left += 8 - vpLeft;
        if (vpRight > window.innerWidth - 8) left -= vpRight - (window.innerWidth - 8);
        left = Math.max(0, Math.min(left, Math.max(0, wrapRect.width - tipW)));
        // 纵向：默认在图表上方弹出；顶部空间不足则翻到绘图区基线下方
        const aboveTop = -tipH - 6;
        const flip = wrapRect.top + aboveTop < 8;
        const top = flip
          ? ((chartHeight - CHART_PAD_B) / chartHeight) * wrapRect.height + 6
          : aboveTop;
        setPos({ left, top });
      }, [anchorIndex, anchorX, count, wrapRef, chartWidth, chartHeight]);
      const style = {
        ...styles.tooltip,
        left: pos ? pos.left : -9999,
        top: pos ? pos.top : -9999
      };
      return React.createElement("div", { ref: tipRef, style }, children);
    }

    /**
     * 消费金额柱状图：悬浮立即显示 tooltip（总消耗 + 各模型消耗）。
     * 不再使用原生 <title>（有悬浮延迟）。
     */
    function BarChart({ days, currency, t }) {
      const [hovered, setHovered] = React.useState(null);
      const wrapRef = React.useRef(null);
      if (!days || days.length === 0) {
        return React.createElement("p", { style: styles.hint }, t("chartEmpty"));
      }
      let max = 0;
      for (const d of days) if (d.cost > max) max = d.cost;
      const innerW = CHART_W - CHART_PAD_L - CHART_PAD_R;
      const slot = innerW / days.length;
      const bw = Math.max(1, Math.min(28, slot * 0.7));
      const bars = days.map((d, i) => {
        const h = max > 0 ? (d.cost / max) * (CHART_H - CHART_PAD_T - CHART_PAD_B) : 0;
        const x = CHART_PAD_L + i * slot + (slot - bw) / 2;
        const height = Math.max(h, d.cost > 0 ? 1 : 0);
        return React.createElement("g", {
          key: d.date,
          style: { cursor: "pointer" },
          onMouseEnter: () => setHovered(i),
          onMouseLeave: () => setHovered(null)
        },
          // 透明热区：整根柱（含柱体上方空白、零值日）都可悬浮
          React.createElement("rect", {
            x,
            y: CHART_PAD_T,
            width: bw,
            height: CHART_H - CHART_PAD_T - CHART_PAD_B,
            fill: "transparent",
            pointerEvents: "all"
          }),
          React.createElement("rect", {
            x,
            y: CHART_H - CHART_PAD_B - height,
            width: bw,
            height,
            rx: 1.5,
            fill: "var(--dsw-alias-state-business-primary)",
            opacity: d.cost > 0 ? 0.95 : 0.25
          })
        );
      });
      let tooltip = null;
      if (hovered !== null) {
        const d = days[hovered];
        const perModel = d.models || {};
        // 仅展示当日消费金额大于 0 的模型，并按费用降序排列
        const rows = Object.keys(perModel)
          .map((name) => ({ name, cost: perModel[name].cost }))
          .filter((m) => m.cost > 0)
          .sort((a, b) => b.cost - a.cost)
          .map((m) =>
            React.createElement("p", { key: m.name, style: styles.tooltipRow },
              `${m.name}: ${fmtMoney(m.cost, currency)}`
            )
          );
        tooltip = React.createElement(ChartTooltip, { anchorIndex: hovered, count: days.length, wrapRef },
          React.createElement("p", { style: styles.tooltipTitle }, d.date),
          React.createElement("p", { style: styles.tooltipRow }, `${t("tooltipTotal")}: ${fmtMoney(d.cost, currency)}`),
          rows.length > 0 ? rows : React.createElement("p", { style: styles.tooltipRow }, "—")
        );
      }
      return React.createElement("div", { ref: wrapRef, style: styles.chartWrap },
        React.createElement("svg", { width: "100%", viewBox: `0 0 ${CHART_W} ${CHART_H}`, style: { display: "block" } },
          React.createElement("text", { x: CHART_PAD_L, y: CHART_H - 6, style: { fill: "var(--dsw-alias-label-tertiary)", fontSize: 10 } }, days[0].date),
          React.createElement("text", { x: CHART_W - CHART_PAD_R, y: CHART_H - 6, textAnchor: "end", style: { fill: "var(--dsw-alias-label-tertiary)", fontSize: 10 } }, days[days.length - 1].date),
          bars
        ),
        tooltip
      );
    }

    /**
     * Token 柱状图分类色：输入（命中缓存）浅蓝 → 输入（未命中缓存）中蓝 → 输出 深蓝，
     * 与官方开放平台的用量图一致；取 DSH 静态蓝色梯度，深浅色主题下都稳定。
     */
    const TOKEN_COLORS = {
      hit: "var(--dsw-static-blue-300)",
      miss: "var(--dsw-static-blue-400)",
      out: "var(--dsw-static-blue-600)"
    };

    /**
     * 分模型 token 柱状图（与官方平台一致：每日堆叠柱，分段为
     * 未命中输入 / 命中输入 / 输出）。悬浮立即显示分段明细。
     */
    function TokenChart({ days, model, currency, t }) {
      const [hovered, setHovered] = React.useState(null);
      const wrapRef = React.useRef(null);
      if (!days || days.length === 0) {
        return React.createElement("p", { style: styles.hint }, t("tokenChartEmpty"));
      }
      const series = days.map((d) => {
        const m = d.models && d.models[model] ? d.models[model] : null;
        return {
          date: d.date,
          miss: m ? m.cacheMissTokens : 0,
          hit: m ? m.cacheHitTokens : 0,
          out: m ? m.responseTokens : 0
        };
      });
      let max = 0;
      for (const s of series) {
        const total = s.miss + s.hit + s.out;
        if (total > max) max = total;
      }
      const innerW = CHART_W - CHART_PAD_L - CHART_PAD_R;
      const slot = innerW / series.length;
      const bw = Math.max(1, Math.min(28, slot * 0.7));
      const segs = (s) => [
        { key: "hit", v: s.hit, color: TOKEN_COLORS.hit },
        { key: "miss", v: s.miss, color: TOKEN_COLORS.miss },
        { key: "out", v: s.out, color: TOKEN_COLORS.out }
      ];
      const bars = series.map((s, i) => {
        const x = CHART_PAD_L + i * slot + (slot - bw) / 2;
        const rects = [];
        let acc = 0;
        for (const seg of segs(s)) {
          if (seg.v <= 0) continue;
          const h = max > 0 ? (seg.v / max) * (CHART_H - CHART_PAD_T - CHART_PAD_B) : 0;
          const height = Math.max(h, 1);
          rects.push(React.createElement("rect", {
            key: seg.key,
            x,
            y: CHART_H - CHART_PAD_B - acc - height,
            width: bw,
            height,
            fill: seg.color,
            opacity: 0.95
          }));
          acc += height;
        }
        return React.createElement("g", {
          key: s.date,
          style: { cursor: "pointer" },
          onMouseEnter: () => setHovered(i),
          onMouseLeave: () => setHovered(null)
        },
          rects,
          // 透明热区（置于最上层）：柱宽 × 全绘图区高，柱体上方空白、
          // 零 token 日整列都可悬浮
          React.createElement("rect", {
            x,
            y: CHART_PAD_T,
            width: bw,
            height: CHART_H - CHART_PAD_T - CHART_PAD_B,
            fill: "transparent",
            pointerEvents: "all"
          })
        );
      });
      let tooltip = null;
      if (hovered !== null) {
        const s = series[hovered];
        tooltip = React.createElement(ChartTooltip, { anchorIndex: hovered, count: series.length, wrapRef },
          // 表头：日期 + 当日总量
          React.createElement("div", { style: styles.tooltipHead },
            React.createElement("span", null, s.date),
            React.createElement("span", { style: styles.tooltipHeadValue }, fmtCount(s.hit + s.miss + s.out))
          ),
          tokenTooltipRow(TOKEN_COLORS.hit, t("legendHit"), s.hit),
          tokenTooltipRow(TOKEN_COLORS.miss, t("legendMiss"), s.miss),
          tokenTooltipRow(TOKEN_COLORS.out, t("legendOut"), s.out)
        );
      }
      return React.createElement("div", { ref: wrapRef, style: styles.chartWrap },
        React.createElement("svg", { width: "100%", viewBox: `0 0 ${CHART_W} ${CHART_H}`, style: { display: "block" } },
          React.createElement("text", { x: CHART_PAD_L, y: CHART_H - 6, style: { fill: "var(--dsw-alias-label-tertiary)", fontSize: 10 } }, series[0].date),
          React.createElement("text", { x: CHART_W - CHART_PAD_R, y: CHART_H - 6, textAnchor: "end", style: { fill: "var(--dsw-alias-label-tertiary)", fontSize: 10 } }, series[series.length - 1].date),
          bars
        ),
        tooltip
      );
    }

    /** Token 图 tooltip 的一行：色块 + 名称 + 右对齐数值（对齐官方平台用量图）。 */
    function tokenTooltipRow(color, label, value) {
      return React.createElement("div", { style: styles.tooltipSwatchRow },
        React.createElement("span", { style: { ...styles.tooltipSwatch, background: color } }),
        React.createElement("span", null, label),
        React.createElement("span", { style: styles.tooltipValue }, value)
      );
    }

    /** Token 图图例：顺序与堆叠一致（命中 → 未命中 → 输出）。 */
    function TokenLegend({ t }) {
      const items = [
        { key: "hit", color: TOKEN_COLORS.hit, label: t("legendHit") },
        { key: "miss", color: TOKEN_COLORS.miss, label: t("legendMiss") },
        { key: "out", color: TOKEN_COLORS.out, label: t("legendOut") }
      ];
      return React.createElement("div", { style: styles.legendRow },
        items.map((item) =>
          React.createElement("span", { key: item.key, style: { color: "var(--dsw-alias-label-secondary)", fontSize: 12 } },
            React.createElement("span", { style: { ...styles.swatch, background: item.color } }),
            item.label
          )
        )
      );
    }

    // ---- 网页搜索 / 网页抓取（调用类型）图表 ----------------------------------

    /** 取一个「好看」的坐标轴最大值（1/2/3/5/7 × 10^n）。 */
    function niceMaxOf(value) {
      if (!(value > 0)) return 1;
      const exp = Math.floor(Math.log10(value));
      const base = Math.pow(10, exp);
      const n = value / base;
      const steps = [1, 2, 3, 5, 7, 10];
      let step = steps[steps.length - 1];
      for (const candidate of steps) {
        if (n <= candidate) {
          step = candidate;
          break;
        }
      }
      return step * base;
    }

    /** 折线平滑路径（控制点取相邻点水平 1/3，避免尖角）。 */
    function smoothPathOf(points) {
      if (!Array.isArray(points) || points.length === 0) return "";
      if (points.length === 1) return `M${points[0].x},${points[0].y}`;
      let d = `M${points[0].x},${points[0].y}`;
      for (let i = 1; i < points.length; i += 1) {
        const p0 = points[i - 1];
        const p1 = points[i];
        const dx = (p1.x - p0.x) / 3;
        d += ` C${p0.x + dx},${p0.y} ${p1.x - dx},${p1.y} ${p1.x},${p1.y}`;
      }
      return d;
    }

    /**
     * 调用类型消费堆叠柱状图：按日堆叠 tool-search / tool-fetch 费用，
     * 悬浮显示当日合计与分工具费用（对应官方「调用类型」费用视图）。
     */
    function ToolCostChart({ functions, currency, t }) {
      const [hovered, setHovered] = React.useState(null);
      const wrapRef = React.useRef(null);
      const dates = functions.length > 0 && Array.isArray(functions[0].days)
        ? functions[0].days.map((day) => day.date)
        : [];
      if (dates.length === 0) return React.createElement("p", { style: styles.hint }, t("toolsCostEmpty"));
      const rows = dates.map((date) => {
        const segments = functions.map((fn, index) => {
          const day = Array.isArray(fn.days) ? fn.days.find((item) => item.date === date) : undefined;
          const cost = day !== undefined && typeof day.cost === "number" ? day.cost : 0;
          return { id: fn.id, label: toolLabelOf(fn.id, t), color: toolColorOf(index), cost };
        });
        return { date, segments, total: segments.reduce((sum, segment) => sum + segment.cost, 0) };
      });
      let max = 0;
      for (const row of rows) if (row.total > max) max = row.total;
      if (!(max > 0)) return React.createElement("p", { style: styles.hint }, t("toolsCostEmpty"));
      const innerW = CHART_W - CHART_PAD_L - CHART_PAD_R;
      const slot = innerW / rows.length;
      const bw = Math.max(1, Math.min(28, slot * 0.7));
      const plotH = CHART_H - CHART_PAD_T - CHART_PAD_B;
      const bars = rows.map((row, index) => {
        const x = CHART_PAD_L + index * slot + (slot - bw) / 2;
        let acc = 0;
        const rects = [];
        for (const segment of row.segments) {
          if (!(segment.cost > 0)) continue;
          const height = Math.max((segment.cost / max) * plotH, 1);
          rects.push(
            React.createElement("rect", {
              key: segment.id,
              x,
              y: CHART_H - CHART_PAD_B - acc - height,
              width: bw,
              height,
              fill: segment.color,
              opacity: 0.95
            })
          );
          acc += height;
        }
        return React.createElement("g", {
          key: row.date,
          style: { cursor: "pointer" },
          onMouseEnter: () => setHovered(index),
          onMouseLeave: () => setHovered(null)
        },
          rects,
          React.createElement("rect", {
            x,
            y: CHART_PAD_T,
            width: bw,
            height: plotH,
            fill: "transparent",
            pointerEvents: "all"
          })
        );
      });
      let tooltip = null;
      if (hovered !== null) {
        const row = rows[hovered];
        const detail = row.segments
          .filter((segment) => segment.cost > 0)
          .sort((a, b) => b.cost - a.cost)
          .map((segment) =>
            React.createElement("p", { key: segment.id, style: styles.tooltipRow },
              `${segment.label}: ${fmtMoney(segment.cost, currency)}`
            )
          );
        tooltip = React.createElement(ChartTooltip, {
          anchorIndex: hovered,
          count: rows.length,
          wrapRef
        },
          React.createElement("p", { style: styles.tooltipTitle }, row.date),
          React.createElement("p", { style: styles.tooltipRow }, `${t("tooltipTotal")}: ${fmtMoney(row.total, currency)}`),
          detail.length > 0 ? detail : null
        );
      }
      return React.createElement("div", { ref: wrapRef, style: styles.chartWrap },
        React.createElement("svg", {
          width: "100%",
          viewBox: `0 0 ${CHART_W} ${CHART_H}`,
          style: { display: "block" }
        },
          React.createElement("text", {
            x: CHART_PAD_L,
            y: CHART_H - 6,
            style: { fill: "var(--dsw-alias-label-tertiary)", fontSize: 10 }
          }, fmtShortDate(rows[0].date)),
          React.createElement("text", {
            x: CHART_W - CHART_PAD_R,
            y: CHART_H - 6,
            textAnchor: "end",
            style: { fill: "var(--dsw-alias-label-tertiary)", fontSize: 10 }
          }, fmtShortDate(rows[rows.length - 1].date)),
          bars
        ),
        tooltip
      );
    }

    /**
     * 单工具请求次数面积图：平滑折线 + 渐变面积 + 悬浮竖线/圆点，
     * 对应官方「API 请求次数」视图。tooltip 同时展示当日调用次数与费用。
     */
    function ToolAreaChart({ tool, index, currency, t }) {
      const [hovered, setHovered] = React.useState(null);
      const wrapRef = React.useRef(null);
      const svgRef = React.useRef(null);
      const days = tool !== null && tool !== undefined && Array.isArray(tool.days) ? tool.days : [];
      if (days.length === 0) return React.createElement("p", { style: styles.hint }, t("tokenChartEmpty"));
      const values = days.map((day) => (typeof day.calls === "number" && Number.isFinite(day.calls) ? day.calls : 0));
      const maxRaw = Math.max(0, ...values);
      const max = niceMaxOf(maxRaw);
      // 工具面积图使用更窄的 viewBox（520×200），在设置面板双列卡片里
      // 缩放后字号/线宽仍可读；柱状图继续使用 640×170。
      const AREA_W = 520;
      const AREA_H = 200;
      const AREA_PAD_L = 46;
      const AREA_PAD_R = 12;
      const AREA_PAD_T = 14;
      const innerW = AREA_W - AREA_PAD_L - AREA_PAD_R;
      const plotH = AREA_H - AREA_PAD_T - CHART_PAD_B;
      const baseY = AREA_H - CHART_PAD_B;
      const xOf = (i) => (days.length <= 1 ? AREA_PAD_L + innerW / 2 : AREA_PAD_L + (i / (days.length - 1)) * innerW);
      const yOf = (v) => baseY - (v / max) * plotH;
      const points = values.map((value, i) => ({ x: xOf(i), y: yOf(value) }));
      const linePath = smoothPathOf(points);
      const firstPoint = points[0];
      const lastPoint = points[points.length - 1];
      const areaPath = days.length <= 1
        ? `M${firstPoint.x},${baseY} L${firstPoint.x},${firstPoint.y} L${firstPoint.x},${baseY} Z`
        : `${linePath} L${lastPoint.x},${baseY} L${firstPoint.x},${baseY} Z`;
      const color = toolColorOf(index);
      const gradientId = `dsh-tool-area-grad-${index}`;
      const onMove = (event) => {
        const svg = svgRef.current;
        if (!svg) return;
        const rect = svg.getBoundingClientRect();
        if (!(rect.width > 0)) return;
        const localX = ((event.clientX - rect.left) / rect.width) * AREA_W;
        const ratio = days.length <= 1 ? 0 : (localX - AREA_PAD_L) / innerW;
        const clamped = Math.min(1, Math.max(0, ratio));
        setHovered(Math.round(clamped * (days.length - 1)));
      };
      const ticks = [max, max / 2, 0];
      const tickText = (value) =>
        Number.isInteger(value) ? fmtCount(value) : Math.abs(value) < 10 ? value.toFixed(1) : fmtCount(value);
      const tickLabels = ticks.map((value, i) =>
        React.createElement("text", {
          key: `tick-${i}`,
          x: AREA_PAD_L - 8,
          y: yOf(value) + 3,
          textAnchor: "end",
          style: { fill: "var(--dsw-alias-label-tertiary)", fontSize: 13 }
        }, tickText(value))
      );
      const gridLines = ticks.map((value, i) =>
        React.createElement("line", {
          key: `grid-${i}`,
          x1: AREA_PAD_L,
          x2: AREA_W - AREA_PAD_R,
          y1: yOf(value),
          y2: yOf(value),
          stroke: "var(--dsw-alias-border-l2)",
          strokeWidth: 1,
          opacity: 0.55
        })
      );
      const xLabelIndexes = [];
      const labelCandidates = days.length === 1 ? [0] : [0, Math.floor((days.length - 1) / 2), days.length - 1];
      for (const dayIndex of labelCandidates) {
        if (!xLabelIndexes.includes(dayIndex)) xLabelIndexes.push(dayIndex);
      }
      const xLabels = xLabelIndexes.map((dayIndex, i) => {
        const isFirst = i === 0;
        const isLast = i === xLabelIndexes.length - 1;
        return React.createElement("text", {
          key: `xlabel-${dayIndex}`,
          x: isFirst ? AREA_PAD_L : isLast ? AREA_W - AREA_PAD_R : xOf(dayIndex),
          y: AREA_H - 6,
          textAnchor: isFirst ? "start" : isLast ? "end" : "middle",
          style: { fill: "var(--dsw-alias-label-tertiary)", fontSize: 12 }
        }, fmtShortDate(days[dayIndex].date));
      });
      let hoverMarks = null;
      if (hovered !== null && hovered >= 0 && hovered < points.length) {
        const point = points[hovered];
        hoverMarks = React.createElement(React.Fragment, null,
          React.createElement("line", {
            x1: point.x,
            x2: point.x,
            y1: AREA_PAD_T,
            y2: baseY,
            stroke: "var(--dsw-alias-label-tertiary)",
            strokeWidth: 1,
            strokeDasharray: "3 3",
            opacity: 0.7,
            pointerEvents: "none"
          }),
          React.createElement("circle", {
            cx: point.x,
            cy: point.y,
            r: 3.5,
            fill: color,
            stroke: "var(--dsw-alias-bg-layer-3)",
            strokeWidth: 1.5,
            pointerEvents: "none"
          })
        );
      }
      // 单日区间（如「今天」）没有线段可画，用圆点标记该日数值。
      const singlePoint = days.length === 1
        ? React.createElement("circle", {
            cx: firstPoint.x,
            cy: firstPoint.y,
            r: 3,
            fill: color,
            pointerEvents: "none"
          })
        : null;
      let tooltip = null;
      if (hovered !== null && hovered >= 0 && hovered < days.length) {
        const day = days[hovered];
        const cost = typeof day.cost === "number" && Number.isFinite(day.cost) ? fmtMoney(day.cost, currency) : "—";
        tooltip = React.createElement(ChartTooltip, {
          anchorIndex: hovered,
          anchorX: xOf(hovered),
          count: days.length,
          wrapRef,
          chartWidth: AREA_W,
          chartHeight: AREA_H
        },
          React.createElement("p", { style: styles.tooltipTitle }, day.date),
          React.createElement("p", { style: styles.tooltipRow }, `${t("toolsCalls")}: ${fmtCount(day.calls)}`),
          React.createElement("p", { style: styles.tooltipRow }, `${t("toolsCost")}: ${cost}`)
        );
      }
      return React.createElement("div", { ref: wrapRef, style: styles.chartWrap },
        React.createElement("svg", {
          ref: svgRef,
          width: "100%",
          viewBox: `0 0 ${AREA_W} ${AREA_H}`,
          style: { display: "block" }
        },
          React.createElement("defs", null,
            React.createElement("linearGradient", {
              id: gradientId,
              x1: "0",
              y1: "0",
              x2: "0",
              y2: "1"
            },
              React.createElement("stop", { offset: "0%", stopColor: color, stopOpacity: 0.42 }),
              React.createElement("stop", { offset: "100%", stopColor: color, stopOpacity: 0.02 })
            )
          ),
          gridLines,
          tickLabels,
          xLabels,
          React.createElement("path", { d: areaPath, fill: `url(#${gradientId})`, stroke: "none" }),
          React.createElement("path", {
            d: linePath,
            fill: "none",
            stroke: color,
            strokeWidth: 2,
            strokeLinecap: "round",
            strokeLinejoin: "round"
          }),
          hoverMarks,
          singlePoint,
          React.createElement("rect", {
            x: AREA_PAD_L,
            y: AREA_PAD_T,
            width: innerW,
            height: plotH,
            fill: "transparent",
            style: { cursor: "crosshair" },
            onMouseMove: onMove,
            onMouseLeave: () => setHovered(null)
          })
        ),
        tooltip
      );
    }

    /** 网页搜索 / 网页抓取模块：统计 + 调用类型费用图 + 分工具请求图。 */
    function ToolUsageSection({ tools, currency, t }) {
      if (tools === null || tools === undefined) return React.createElement("p", { style: styles.hint }, t("toolsEmpty"));
      if (tools.ok !== true) {
        return React.createElement(React.Fragment, null,
          React.createElement("p", { style: styles.error }, t("toolsUnavailable")),
          typeof tools.message === "string" && tools.message !== ""
            ? React.createElement("p", { style: styles.hint }, tools.message)
            : null
        );
      }
      const functions = Array.isArray(tools.functions)
        ? tools.functions.filter((fn) => fn !== null && typeof fn === "object" && Array.isArray(fn.days))
        : [];
      const totalCalls = tools.totals !== null && typeof tools.totals === "object" && typeof tools.totals.calls === "number"
        ? tools.totals.calls
        : functions.reduce((sum, fn) => sum + (typeof fn.calls === "number" ? fn.calls : 0), 0);
      if (functions.length === 0 || totalCalls === 0) {
        return React.createElement("p", { style: styles.hint }, t("toolsEmpty"));
      }
      const currencyOf = typeof tools.currency === "string" && tools.currency !== "" ? tools.currency : currency;
      const costAvailable = tools.costAvailable === true;
      const totalCost = tools.totals !== null && typeof tools.totals === "object" && typeof tools.totals.cost === "number"
        ? tools.totals.cost
        : null;
      const summary = React.createElement("div", { style: styles.toolStatGrid },
        // 0.5.0：先给出所有工具调用的消费合计，再逐个工具列出明细。
        React.createElement("div", { key: "__total__", style: styles.toolStatItem },
          React.createElement("p", { style: styles.toolStatLabel }, t("toolsTotalCost")),
          React.createElement("p", { style: styles.toolStatValue },
            costAvailable && totalCost !== null ? fmtMoney(totalCost, currencyOf) : "—"
          )
        ),
        functions.map((fn) =>
          React.createElement("div", { key: fn.id, style: styles.toolStatItem },
            React.createElement("p", { style: styles.toolStatLabel }, toolLabelOf(fn.id, t)),
            React.createElement("p", { style: styles.toolStatValue }, `${fmtCount(fn.calls)} ${t("toolsCalls")}`),
            React.createElement("p", { style: styles.toolStatSub },
              `${t("toolsCost")}: ${costAvailable ? fmtMoney(fn.cost, currencyOf) : "—"}`
            )
          )
        )
      );
      const costChart = costAvailable && totalCost !== null && totalCost > 0
        ? React.createElement("div", { style: styles.toolCard },
          React.createElement("div", { style: styles.toolCardHead },
            React.createElement("p", { style: styles.toolCardTitle }, t("toolsCostChart")),
            React.createElement("p", { style: styles.toolCardTotal }, fmtMoney(totalCost, currencyOf))
          ),
          React.createElement(ToolCostChart, { functions, currency: currencyOf, t })
        )
        : null;
      const charts = React.createElement("div", { style: styles.toolGrid },
        functions.map((fn, index) =>
          React.createElement("div", { key: fn.id, style: styles.toolCard },
            React.createElement("div", { style: styles.toolCardHead },
              React.createElement("p", { style: styles.toolCardTitle }, toolLabelOf(fn.id, t)),
              React.createElement("p", { style: styles.toolCardTotal },
                `${t("toolsRequests")}: ${fmtCount(fn.calls)}`
              )
            ),
            React.createElement(ToolAreaChart, { tool: fn, index, currency: currencyOf, t })
          )
        )
      );
      return React.createElement("div", { style: styles.section }, summary, costChart, charts);
    }

    function ModelTable({ models, currency, t }) {
      if (!models || models.length === 0) {
        return React.createElement("p", { style: styles.hint }, t("modelsEmpty"));
      }
      const th = [t("colModel"), t("colRequests"), t("colInput"), t("colCacheHit"), t("colCacheMiss"), t("colOutput"), t("colCost")];
      const headers = th.map((label, i) =>
        i === 0
          ? React.createElement("th", { key: label, style: styles.th }, label)
          : React.createElement("th", { key: label, style: styles.thNum }, label)
      );
      const rows = models.map((m) => {
        const cells = [
          m.model,
          fmtCount(m.requests),
          fmtCount(m.promptTokens),
          fmtCount(m.cacheHitTokens),
          fmtCount(m.cacheMissTokens),
          fmtCount(m.responseTokens),
          fmtMoney(m.cost, currency)
        ];
        return React.createElement("tr", { key: m.model },
          cells.map((c, i) =>
            i === 0
              ? React.createElement("td", { key: i, style: styles.td }, c)
              : React.createElement("td", { key: i, style: styles.tdNum }, c)
          )
        );
      });
      return React.createElement("table", { style: styles.table },
        React.createElement("thead", null, React.createElement("tr", null, headers)),
        React.createElement("tbody", null, rows)
      );
    }

    function WindowCard({ name, limit, windowData, countdown, t }) {
      const percent = windowData && typeof windowData.percent === "number" ? windowData.percent : null;
      const pct = percent === null ? 0 : Math.max(0, Math.min(100, percent));
      const barColor = pct < 50
        ? "var(--dsw-alias-state-business-primary)"
        : pct < 90
          ? "#eab308"
          : "var(--dsw-alias-state-error-primary)";
      return React.createElement("div", { style: styles.card },
        React.createElement("div", { style: styles.row },
          React.createElement("strong", { style: { fontSize: 14 } }, name),
          React.createElement("span", { style: { color: "var(--dsw-alias-label-tertiary)" } }, `${t("limit")}: ${limit}`)
        ),
        React.createElement("div", { style: styles.barTrack },
          React.createElement("div", { style: { ...styles.barFill, width: pct + "%", background: barColor } })
        ),
        React.createElement("div", { style: styles.row },
          React.createElement("span", null, percent === null ? t("unknown") : percent + "%"),
          React.createElement("span", null, `${t("reset")}: ${fmtReset(windowData && windowData.resetsAt, t)}${countdown ? ` · ${countdown}` : ""}`)
        )
      );
    }

    const PRESET_LABEL_KEYS = {
      today: "rangeToday",
      "7d": "range7d",
      "30d": "range30d",
      thisMonth: "rangeThisMonth",
      lastMonth: "rangeLastMonth"
    };

    // ---- 区间日历（0.5.0） ---------------------------------------------------
    // 样式走注入式作用域样式表（沿用 MENU_CSS 的做法）：日历需要 :hover、
    // :focus-visible 与窄屏媒体查询，纯内联样式表达不了。类名统一 .dsau- 前缀，
    // 并用 data-plugin-css 标记保证幂等。

    const CALENDAR_STYLE_ID = "dsh-account-usage/calendar.css";

    const CALENDAR_CSS = [
      ".dsau-range-row{position:relative;display:flex;flex-wrap:wrap;align-items:center;gap:6px}",
      ".dsau-trigger{display:inline-flex;align-items:center;gap:8px;height:34px;padding:0 12px;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font:inherit;font-size:14px;line-height:20px;font-variant-numeric:tabular-nums;cursor:pointer}",
      ".dsau-trigger:hover{background:var(--dsw-alias-interactive-bg-hover)}",
      ".dsau-trigger:focus-visible{outline:none;border-color:var(--dsw-alias-state-business-primary);box-shadow:0 0 0 2px color-mix(in srgb, var(--dsw-alias-state-business-primary) 28%, transparent)}",
      ".dsau-trigger[data-open=\"1\"]{border-color:var(--dsw-alias-state-business-primary)}",
      ".dsau-trigger-sep{padding:0 2px;color:var(--dsw-alias-label-tertiary)}",
      ".dsau-trigger-empty{color:var(--dsw-alias-label-tertiary)}",
      ".dsau-trigger-icon{display:inline-flex;flex:none;align-items:center;justify-content:center;width:14px;height:14px;color:var(--dsw-alias-label-tertiary)}",
      // 预设下拉：原生 <select> 的边框在切换选项后偶尔不重绘（只剩圆角），
      // 因此把外观（边框/圆角/底色/箭头）画在外层 span 上，select 只负责交互。
      ".dsau-select{position:relative;display:inline-flex;align-items:center;height:34px;padding:0 30px 0 12px;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary)}",
      ".dsau-select:hover{background:var(--dsw-alias-interactive-bg-hover)}",
      ".dsau-select:focus-within{border-color:var(--dsw-alias-state-business-primary);box-shadow:0 0 0 2px color-mix(in srgb, var(--dsw-alias-state-business-primary) 28%, transparent)}",
      ".dsau-select-input{appearance:none;-webkit-appearance:none;margin:0;padding:0;border:0;outline:none;background:transparent;color:inherit;font:inherit;font-size:14px;line-height:20px;height:32px;cursor:pointer}",
      ".dsau-select-input option{background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary)}",
      ".dsau-select-icon{position:absolute;right:9px;top:50%;display:inline-flex;align-items:center;justify-content:center;width:12px;height:12px;transform:translateY(-50%);color:var(--dsw-alias-label-tertiary);pointer-events:none}",
      ".dsau-cal{position:fixed;z-index:1200;box-sizing:border-box;padding:16px;border-radius:12px;background:var(--dsw-alias-bg-layer-2);box-shadow:var(--dsw-elevation-panel);color:var(--dsw-alias-label-primary);font-size:14px;line-height:20px;outline:none}",
      ".dsau-cal-head{display:flex;align-items:center;gap:4px;height:36px}",
      ".dsau-cal-nav{display:inline-flex;flex:none;align-items:center;justify-content:center;width:28px;height:28px;padding:0;border:none;border-radius:var(--dsw-radius-sm);background:transparent;color:var(--dsw-alias-label-tertiary);cursor:pointer}",
      ".dsau-cal-nav:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}",
      ".dsau-cal-nav:focus-visible{outline:2px solid var(--dsw-alias-state-business-primary);outline-offset:1px}",
      ".dsau-cal-nav:disabled{color:var(--dsw-alias-label-caption);color:color-mix(in srgb, var(--dsw-alias-label-primary) 15%, transparent);cursor:default}",
      ".dsau-cal-titles{display:flex;flex:1;min-width:0;gap:24px}",
      ".dsau-cal-title{flex:1;min-width:0;margin:0;text-align:center;font-size:15px;font-weight:600;line-height:22px;color:var(--dsw-alias-label-primary)}",
      ".dsau-cal-months{display:flex;gap:24px}",
      ".dsau-cal-month{width:266px;flex:none}",
      ".dsau-cal-weekdays,.dsau-cal-week{display:grid;grid-template-columns:repeat(7,38px)}",
      ".dsau-cal-wd{display:flex;align-items:center;justify-content:center;height:28px;font-size:14px;line-height:20px;color:var(--dsw-alias-label-primary)}",
      ".dsau-cal-cell{position:relative;display:flex;align-items:center;justify-content:center;height:38px;padding:0}",
      ".dsau-cal-cell::before{content:\"\";position:absolute;top:50%;height:32px;transform:translateY(-50%);background:var(--dsw-alias-interactive-bg-hover-solid);opacity:0;pointer-events:none}",
      ".dsau-cal-cell[data-band=\"start\"]::before{left:50%;right:0;opacity:1}",
      ".dsau-cal-cell[data-band=\"middle\"]::before{left:0;right:0;opacity:1}",
      ".dsau-cal-cell[data-band=\"end\"]::before{left:0;right:50%;opacity:1}",
      ".dsau-cal-day{position:relative;z-index:1;display:inline-flex;align-items:center;justify-content:center;width:32px;height:32px;padding:0;border:none;border-radius:50%;background:transparent;color:var(--dsw-alias-label-primary);font:inherit;font-size:15px;line-height:20px;font-variant-numeric:tabular-nums;cursor:pointer}",
      ".dsau-cal-day[data-in-range=\"1\"]{background:transparent}",
      ".dsau-cal-day[data-hover=\"1\"]{background:color-mix(in srgb, var(--dsw-alias-label-primary) 7%, transparent)}",
      ".dsau-cal-day[data-today=\"1\"]{background:color-mix(in srgb, var(--dsw-alias-label-primary) 10%, transparent)}",
      ".dsau-cal-day[data-today=\"1\"][data-hover=\"1\"]{background:color-mix(in srgb, var(--dsw-alias-label-primary) 14%, transparent)}",
      ".dsau-cal-day[data-disabled=\"1\"]{color:var(--dsw-alias-label-caption);color:color-mix(in srgb, var(--dsw-alias-label-primary) 22%, transparent);cursor:default}",
      // 越界（超出 3 个自然月）与未来日期同为不可选，但指针给出「不能选」的语义。
      ".dsau-cal-day[data-limit=\"1\"]{cursor:not-allowed}",
      ".dsau-cal-day[data-edge=\"1\"]{background:var(--dsw-alias-brand-primary);color:var(--dsw-alias-label-primary-foreground)}",
      ".dsau-cal-day:focus-visible{outline:none;box-shadow:0 0 0 2px var(--dsw-alias-state-business-primary)}",
      ".dsau-cal-dot{position:absolute;right:2px;bottom:2px;width:4px;height:4px;border-radius:50%;background:var(--dsw-alias-label-primary-foreground)}"
    ].join("\n");

    /** 「概览」标签页样式：统计卡、热力图、模式切换。 */
    const OVERVIEW_STYLE_ID = "dsh-account-usage/overview.css";

    const OVERVIEW_CSS = [
      ".dsau-stats{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));align-items:start;row-gap:6px}",
      ".dsau-stat{display:flex;flex-direction:column;align-items:center;gap:1px;padding:0 6px;min-width:0;text-align:center;justify-content:flex-start}",
      ".dsau-stat+.dsau-stat{border-left:1px solid var(--dsw-alias-border-l1)}",
      ".dsau-stat-value{margin:0;font-size:16px;font-weight:600;line-height:24px;color:var(--dsw-alias-label-primary);font-variant-numeric:tabular-nums;white-space:nowrap}",
      ".dsau-stat-label{margin:0;font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary);max-width:100%;overflow-wrap:break-word}",
      ".dsau-stat-hint{margin:0;font-size:11px;line-height:16px;color:var(--dsw-alias-label-tertiary);font-variant-numeric:tabular-nums;white-space:nowrap}",
      "@media (max-width:560px){.dsau-stats{grid-template-columns:repeat(2,minmax(0,1fr));gap:12px 0}.dsau-stat+.dsau-stat{border-left:none}}",
      ".dsau-heat{position:relative;display:flex;flex-direction:column;gap:10px}",
      // 单元格为圆角小方块，行列间距一致（参考官方样式的 16px 方块 + 4px 间隔比例）。
      ".dsau-heat-block{display:flex;flex-direction:column;gap:4px}",
      ".dsau-heat-grid,.dsau-heat-months{display:grid;grid-auto-flow:column;grid-template-rows:repeat(7,auto);gap:4px}",
      ".dsau-heat-months{grid-template-rows:auto}",
      // 0 Token = 中性浅灰（与参考图最左侧一致）；未来/非本年格子完全透明。
      // 色阶同时作用于热力格与图例色块，避免两处各写一套。
      ".dsau-heat-cell,.dsau-heat-legend-swatch{background:#e5e5e5}",
      ".dsau-heat-cell{aspect-ratio:1;border-radius:3px}",
      ".dsau-heat-cell[data-hidden=\"1\"]{background:transparent}",
      // 四级色阶取自参考图实测：浅蓝 → 亮青蓝，逐档加深。
      // 浅色：level1 #6fe6ff / level2 #4ed1ff / level3 #1cbcfd / level4 #00a7eb / level5 #0092d9。
      // 整体比旧阶（#94dcff…#0071ad）更亮更明快：OKLCH L 0.88→0.61、C 0.135→0.170（旧 0.087→0.126），
      // 相邻 WCAG 对比度 1.21–1.26，靠高饱和度拉开观感差距。
      ".dsau-heat-cell[data-level=\"1\"],.dsau-heat-legend-swatch[data-level=\"1\"]{background:#6fe6ff}",
      ".dsau-heat-cell[data-level=\"2\"],.dsau-heat-legend-swatch[data-level=\"2\"]{background:#4ed1ff}",
      ".dsau-heat-cell[data-level=\"3\"],.dsau-heat-legend-swatch[data-level=\"3\"]{background:#1cbcfd}",
      ".dsau-heat-cell[data-level=\"4\"],.dsau-heat-legend-swatch[data-level=\"4\"]{background:#00a7eb}",
      // 第 5 档（≥5 亿极值档）：继续降明度，保证最深档一眼可辨。
      ".dsau-heat-cell[data-level=\"5\"],.dsau-heat-legend-swatch[data-level=\"5\"]{background:#0092d9}",
      // 深色主题：空格子用中性深灰，四级色阶保持同一色相但由暗到亮，
      // 让「越亮 = 用量越高」的方向感与浅色主题一致。
      "body[data-ds-dark-theme] .dsau-heat-cell,body[data-ds-dark-theme] .dsau-heat-legend-swatch{background:#3a3b3d}",
      "body[data-ds-dark-theme] .dsau-heat-cell[data-hidden=\"1\"]{background:transparent}",
      "body[data-ds-dark-theme] .dsau-heat-cell[data-level=\"1\"],body[data-ds-dark-theme] .dsau-heat-legend-swatch[data-level=\"1\"]{background:#16445a}",
      "body[data-ds-dark-theme] .dsau-heat-cell[data-level=\"2\"],body[data-ds-dark-theme] .dsau-heat-legend-swatch[data-level=\"2\"]{background:#1e6180}",
      "body[data-ds-dark-theme] .dsau-heat-cell[data-level=\"3\"],body[data-ds-dark-theme] .dsau-heat-legend-swatch[data-level=\"3\"]{background:#277fa8}",
      "body[data-ds-dark-theme] .dsau-heat-cell[data-level=\"4\"],body[data-ds-dark-theme] .dsau-heat-legend-swatch[data-level=\"4\"]{background:#339fd1}",
      // 深色第 5 档：L 0.77 提亮到近似天蓝，保持「档位越高越亮」且相邻对比度 ≥1.45。
      "body[data-ds-dark-theme] .dsau-heat-cell[data-level=\"5\"],body[data-ds-dark-theme] .dsau-heat-legend-swatch[data-level=\"5\"]{background:#46c0fa}",
      // 图例：少 [灰][四档蓝] 多，右对齐在网格下方。
      ".dsau-heat-legend{display:flex;align-items:center;justify-content:flex-end;gap:4px;margin-top:2px;font-size:12px;line-height:18px;color:var(--dsw-alias-label-tertiary)}",
      ".dsau-heat-legend-swatch{width:14px;height:14px;border-radius:3px;flex:none}",
      ".dsau-heat-legend-label{padding:0 2px}",
      ".dsau-heat-month{grid-row:1;justify-self:start;font-size:12px;line-height:18px;color:var(--dsw-alias-label-tertiary);white-space:nowrap;pointer-events:none}",
      // 提示框：官方平台样式为两行（描述 + 带单位的数值），沿用主题令牌适配深浅色。
      ".dsau-heat-tip{position:fixed;z-index:20;pointer-events:none;display:flex;flex-direction:column;gap:2px;background:var(--dsw-alias-bg-layer-3);border:1px solid var(--dsw-alias-border-l2);border-radius:8px;padding:6px 10px;font-size:12px;line-height:1.5;white-space:nowrap;box-shadow:0 4px 16px rgb(0 0 0 / 0.25);color:var(--dsw-alias-label-primary)}",
      ".dsau-heat-tip-caption{color:var(--dsw-alias-label-secondary)}",
      ".dsau-heat-tip-value{font-weight:600}",
      ".dsau-heat-mode{border:none;background:transparent;padding:0 2px;font:inherit;font-size:13px;line-height:20px;color:var(--dsw-alias-label-tertiary);cursor:pointer}",
      ".dsau-heat-mode:hover{color:var(--dsw-alias-label-secondary)}",
      ".dsau-heat-mode[data-active=\"1\"]{color:var(--dsw-alias-label-primary);font-weight:600}",
      ".dsau-heat-mode:focus-visible{outline:2px solid var(--dsw-alias-state-business-primary);outline-offset:2px;border-radius:2px}"
    ].join("\n");

    /**
     * 注入（或校正）一张插件样式表；非浏览器环境（单测/SSR）直接跳过。
     * 注意：客户端热更新只替换 JS、不会清掉已注入的 <style>，所以发现旧样式表
     * 内容与当前常量不一致时必须覆盖，否则新类名拿不到规则。
     */
    function ensureStyleElement(id, css) {
      if (typeof document === "undefined" || document.head === null || document.head === undefined) return;
      const selector = 'style[data-plugin-css="' + id + '"]';
      const existing = document.querySelector(selector);
      if (existing !== null && existing !== undefined) {
        if (existing.textContent !== css) existing.textContent = css;
        return;
      }
      const style = document.createElement("style");
      style.dataset.plugin = "dsh-account-usage";
      style.dataset.pluginCss = id;
      style.textContent = css;
      document.head.appendChild(style);
    }

    function ensureCalendarStyles() {
      ensureStyleElement(CALENDAR_STYLE_ID, CALENDAR_CSS);
    }

    function ensureOverviewStyles() {
      ensureStyleElement(OVERVIEW_STYLE_ID, OVERVIEW_CSS);
    }

    /**
     * 日历几何：必须与 CALENDAR_CSS 里的尺寸一致，仅用于浮层定位与翻转判断。
     * 单月 7×38=266，双月 +24 间距，左右各 16 内边距；纵向 = 上下 16 + 标题 36 + 表头 28 + 周数×38。
     */
    const CAL_GEOMETRY = {
      cellH: 38,
      widthDouble: 266 * 2 + 24 + 16 * 2,
      widthSingle: 266 + 16 * 2,
      chromeHeight: 16 * 2 + 36 + 28
    };

    function calendarWidth(layout) {
      return layout === "single" ? CAL_GEOMETRY.widthSingle : CAL_GEOMETRY.widthDouble;
    }

    function calendarHeight(weekRows) {
      return CAL_GEOMETRY.chromeHeight + Math.max(1, weekRows) * CAL_GEOMETRY.cellH;
    }

    /** 窄屏（<640px）只显示一个月。 */
    function currentCalendarLayout() {
      if (typeof window === "undefined" || typeof window.innerWidth !== "number") return "double";
      return window.innerWidth < 640 ? "single" : "double";
    }

    /** `YYYY-MM-DD` → `YYYY/MM/DD`（与官方平台的显示格式一致）。 */
    function fmtSlashDate(key) {
      return isDateKey(key) ? key.replace(/-/g, "/") : "";
    }

    function calendarChevron(direction) {
      return React.createElement("svg", {
        width: 14, height: 14, viewBox: "0 0 16 16", fill: "none", "aria-hidden": true, focusable: "false", style: { display: "block" }
      },
        React.createElement("path", {
          d: direction === "prev" ? "M10 3.5 5.5 8l4.5 4.5" : "M6 3.5 10.5 8 6 12.5",
          stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round", strokeLinejoin: "round"
        })
      );
    }

    /** 预设下拉的下拉箭头。 */
    function selectChevron() {
      return React.createElement("svg", {
        width: 12, height: 12, viewBox: "0 0 16 16", fill: "none", "aria-hidden": true, focusable: "false", style: { display: "block" }
      },
        React.createElement("path", {
          d: "M3.5 6 8 10.5 12.5 6",
          stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round", strokeLinejoin: "round"
        })
      );
    }

    function calendarGlyph() {
      return React.createElement("svg", {
        width: 14, height: 14, viewBox: "0 0 16 16", fill: "none", "aria-hidden": true, focusable: "false", style: { display: "block" }
      },
        React.createElement("rect", { x: 2, y: 3.5, width: 12, height: 10.5, rx: 1.5, stroke: "currentColor", strokeWidth: 1.2 }),
        React.createElement("path", { d: "M2 6.5h12M5.5 2v3M10.5 2v3", stroke: "currentColor", strokeWidth: 1.2, strokeLinecap: "round" })
      );
    }

    /** 单月网格：表头 + 若干周行；空格渲染成占位单元格。 */
    function CalendarMonth({ grid, staged, hoverKey, focusedKey, todayKey, onPick, onHover, t }) {
      const preview = previewRange(staged, hoverKey);
      const weekdays = weekdayLabels(t);
      const from = staged !== null && typeof staged === "object" && isDateKey(staged.from) ? staged.from : null;
      const to = staged !== null && typeof staged === "object" && isDateKey(staged.to) ? staged.to : null;
      // 只选了一端时，另一端受「最多 3 个自然月」约束：超出方向的日期置灰。
      // 两端都选满时不再限制（区间已确定，hover 预览用不上）。
      const limitAnchor = from !== null && to === null ? from : null;
      const limitTip = t("rangeLimitTooltip").replace("{n}", String(MAX_RANGE_MONTHS));
      const rows = grid.weeks.map((week, weekIndex) =>
        React.createElement("div", { key: weekIndex, className: "dsau-cal-week" },
          week.map((cell, cellIndex) => {
            if (cell === null) return React.createElement("div", { key: cellIndex, className: "dsau-cal-cell" });
            const key = cell.key;
            const isFuture = isFutureDate(key, todayKey);
            const overLimit = limitAnchor !== null && !withinMonthLimit(key, limitAnchor, MAX_RANGE_MONTHS);
            const disabled = isFuture || overLimit;
            const isEdge = key === from || key === to;
            const band = bandKind(preview.from, preview.to, key);
            const isToday = key === todayKey;
            const hovered = hoverKey === key && !disabled && !isEdge;
            // 区间底色画在单元格上（跨格连续、行间留缝），端点圆压在它上面。
            return React.createElement("div", {
              key,
              className: "dsau-cal-cell",
              "data-band": band === null ? undefined : band
            },
              React.createElement("button", {
                type: "button",
                className: "dsau-cal-day",
                "data-edge": isEdge ? "1" : "0",
                "data-in-range": band === "middle" ? "1" : "0",
                "data-hover": hovered ? "1" : "0",
                "data-today": isToday ? "1" : "0",
                "data-disabled": disabled ? "1" : "0",
                // 越界与「未来日期」视觉上同为禁用，但悬停能拿到原因说明。
                "data-limit": overLimit ? "1" : undefined,
                title: overLimit ? limitTip : undefined,
                "data-focus-key": key,
                tabIndex: focusedKey === key ? 0 : -1,
                "aria-label": key,
                "aria-current": isToday ? "date" : undefined,
                "aria-selected": isEdge ? "true" : undefined,
                "aria-disabled": disabled ? "true" : undefined,
                onClick: disabled ? undefined : () => onPick(key),
                onMouseEnter: () => onHover(disabled ? null : key),
                onFocus: () => onHover(disabled ? null : key)
              },
                cell.day,
                // 今日恰好是区间端点时，用右下角小圆点标记（对应参考图 19 号）。
                isToday && isEdge ? React.createElement("span", { className: "dsau-cal-dot" }) : null
              )
            );
          })
        )
      );
      return React.createElement("div", { className: "dsau-cal-month" },
        React.createElement("div", { className: "dsau-cal-weekdays" },
          weekdays.map((label, index) => React.createElement("div", { key: index, className: "dsau-cal-wd" }, label))
        ),
        rows
      );
    }

    /** 浮层面板：标题行 + 双月（或窄屏单月）。 */
    function CalendarPanel({ panelRef, panelStyle, grids, staged, hoverKey, focusedKey, todayKey, canNext, onPrev, onNext, onPick, onHover, onKeyDown, label, t }) {
      return React.createElement("div", {
        ref: panelRef,
        className: "dsau-cal",
        role: "dialog",
        "aria-modal": "false",
        "aria-label": label,
        tabIndex: -1,
        style: panelStyle,
        onKeyDown,
        onMouseLeave: () => onHover(null)
      },
        React.createElement("div", { className: "dsau-cal-head" },
          React.createElement("button", { type: "button", className: "dsau-cal-nav", onClick: onPrev, "aria-label": t("rangePrevMonth") }, calendarChevron("prev")),
          React.createElement("div", { className: "dsau-cal-titles" },
            grids.map((grid) =>
              React.createElement("p", { key: grid.year + "-" + grid.month, className: "dsau-cal-title" },
                formatMonthTitle(grid.year, grid.month, t)
              )
            )
          ),
          React.createElement("button", { type: "button", className: "dsau-cal-nav", onClick: onNext, disabled: canNext !== true, "aria-label": t("rangeNextMonth") }, calendarChevron("next"))
        ),
        React.createElement("div", { className: "dsau-cal-months" },
          grids.map((grid) =>
            React.createElement(CalendarMonth, {
              key: grid.year + "-" + grid.month,
              grid,
              staged,
              hoverKey,
              focusedKey,
              todayKey,
              onPick,
              onHover,
              t
            })
          )
        )
      );
    }

    function RangeSelector({ range, onApply, t, visible }) {
      const todayKey = todayDate();
      const todayMonth = monthOfDateKey(todayKey);
      const todayIndex = todayMonth.year * 12 + (todayMonth.month - 1);
      const [staged, setStaged] = React.useState({ from: range.from, to: range.to });
      const [activePreset, setActivePreset] = React.useState("thisMonth");
      const [open, setOpen] = React.useState(false);
      const [hoverKey, setHoverKey] = React.useState(null);
      const [focusedKey, setFocusedKey] = React.useState(null);
      const [anchorMonth, setAnchorMonth] = React.useState(() => monthOfDateKey(range.to, todayKey));
      const [layout, setLayout] = React.useState(currentCalendarLayout);
      const [position, setPosition] = React.useState({ left: 0, top: 0 });
      const triggerRef = React.useRef(null);
      const panelRef = React.useRef(null);
      // 关闭逻辑挂在 document 监听上，读 ref 才能拿到最新暂存区间（避免闭包过期）。
      const stagedRef = React.useRef({ from: range.from, to: range.to });
      // 浮层挂到 body 上避免被设置页滚动容器裁切；运行时缺少 createPortal 时就地渲染。
      const usePortal =
        typeof document !== "undefined" &&
        document !== null &&
        document.body !== null &&
        document.body !== undefined &&
        ReactDOM !== null &&
        typeof ReactDOM.createPortal === "function";

      React.useEffect(() => {
        ensureCalendarStyles();
      }, []);
      // 标签页切走时内容被 display:none 隐藏，但浮层挂在 body 上不会跟着隐藏，必须主动关闭。
      React.useEffect(() => {
        if (visible === false && open) {
          setOpen(false);
          setHoverKey(null);
          setStaged({ from: range.from, to: range.to });
        }
      }, [visible, open, range.from, range.to]);


      // 预设切换后把暂存区间同步回已应用区间。
      React.useEffect(() => {
        setStaged({ from: range.from, to: range.to });
      }, [range.from, range.to]);

      React.useEffect(() => {
        stagedRef.current = staged;
      }, [staged]);

      // 窄屏只显示一个月，窗口尺寸变化时重算。
      React.useEffect(() => {
        if (typeof window === "undefined") return undefined;
        const sync = () => setLayout(currentCalendarLayout());
        sync();
        window.addEventListener("resize", sync);
        return () => window.removeEventListener("resize", sync);
      }, []);

      const visibleMonths =
        layout === "single"
          ? [anchorMonth]
          : [addMonths(anchorMonth.year, anchorMonth.month, -1), anchorMonth];
      const grids = visibleMonths.map((month) => buildMonthGrid(month.year, month.month));
      const weekRows = grids.reduce((max, grid) => Math.max(max, grid.weeks.length), 0);
      const panelWidth = calendarWidth(layout);
      const panelHeight = calendarHeight(weekRows);
      const anchorIndex = anchorMonth.year * 12 + (anchorMonth.month - 1);
      const canNext = anchorIndex < todayIndex;

      // 浮层定位：默认贴触发框下方，下方不够且上方够时翻转，横向夹在视口内。
      React.useLayoutEffect(() => {
        if (!open || !usePortal || typeof window === "undefined") return undefined;
        const update = () => {
          const trigger = triggerRef.current;
          if (trigger === null || typeof trigger.getBoundingClientRect !== "function") return;
          const rect = trigger.getBoundingClientRect();
          const margin = 8;
          let left = rect.left;
          const maxLeft = window.innerWidth - panelWidth - margin;
          if (left > maxLeft) left = maxLeft;
          if (left < margin) left = margin;
          let top = rect.bottom + margin;
          if (top + panelHeight > window.innerHeight - margin) {
            const above = rect.top - panelHeight - margin;
            top = above >= margin ? above : Math.max(margin, window.innerHeight - panelHeight - margin);
          }
          const nextLeft = Math.round(left);
          const nextTop = Math.round(top);
          setPosition((prev) => (prev.left === nextLeft && prev.top === nextTop ? prev : { left: nextLeft, top: nextTop }));
        };
        update();
        window.addEventListener("scroll", update, true);
        window.addEventListener("resize", update);
        return () => {
          window.removeEventListener("scroll", update, true);
          window.removeEventListener("resize", update);
        };
      }, [open, usePortal, panelWidth, panelHeight]);

      /** 焦点交还触发框（关闭浮层后保持键盘可达）。 */
      const focusTrigger = () => {
        const trigger = triggerRef.current;
        if (trigger !== null && typeof trigger.focus === "function") trigger.focus();
      };

      /**
       * 关闭并应用（0.5.0：没有「应用」按钮，关闭即按所选区间筛选）。
       * 只选了起点就关闭时视为放弃，回滚到已应用区间。
       */
      const closeAndApply = React.useCallback(() => {
        const current = stagedRef.current;
        const normalized = normalizeRange(current.from, current.to);
        setOpen(false);
        setHoverKey(null);
        if (normalized === null) {
          setStaged({ from: range.from, to: range.to });
        } else if (normalized.from !== range.from || normalized.to !== range.to) {
          onApply(normalized);
        }
        focusTrigger();
      }, [range.from, range.to, onApply]);

      // 关闭：Esc / 点浮层与触发框之外 → 都按当前所选区间筛选（见 closeAndApply）。
      React.useEffect(() => {
        if (!open || typeof document === "undefined") return undefined;
        const onPointerDown = (event) => {
          const target = event.target;
          if (panelRef.current !== null && panelRef.current.contains(target)) return;
          if (triggerRef.current !== null && triggerRef.current.contains(target)) return;
          closeAndApply();
        };
        const onKeyDown = (event) => {
          if (event.key !== "Escape") return;
          event.preventDefault();
          event.stopPropagation();
          closeAndApply();
        };
        document.addEventListener("pointerdown", onPointerDown, true);
        document.addEventListener("keydown", onKeyDown, true);
        return () => {
          document.removeEventListener("pointerdown", onPointerDown, true);
          document.removeEventListener("keydown", onKeyDown, true);
        };
      }, [open, closeAndApply]);

      // 焦点落到当前焦点格（打开时定位到区间终点）。
      React.useEffect(() => {
        if (!open || focusedKey === null) return;
        const panel = panelRef.current;
        if (panel === null || typeof panel.querySelector !== "function") return;
        const target = panel.querySelector('[data-focus-key="' + focusedKey + '"]');
        if (target !== null && typeof target.focus === "function") target.focus();
      }, [open, focusedKey, anchorMonth, layout]);

      const openPanel = (fromKey, toKey) => {
        setStaged({ from: fromKey, to: toKey });
        setAnchorMonth(monthOfDateKey(toKey, todayKey));
        setHoverKey(null);
        setFocusedKey(isDateKey(toKey) ? toKey : todayKey);
        setOpen(true);
      };

      const toggleOpen = () => {
        if (open) {
          closeAndApply();
          return;
        }
        openPanel(range.from, range.to);
      };

      /**
       * 点击某一天：无起点或两端齐全 → 重开区间；只有起点 → 补齐终点。
       * 两端选满即视为完成，立刻关闭浮层并按该区间筛选。
       */
      const pick = (key) => {
        setActivePreset("custom");
        setFocusedKey(key);
        const from = isDateKey(staged.from) ? staged.from : null;
        const to = isDateKey(staged.to) ? staged.to : null;
        if (from === null || to !== null) {
          setStaged({ from: key, to: null });
          return;
        }
        const normalized = normalizeRange(from, key);
        if (normalized === null) return;
        // 兜底：键盘 Enter / 焦点路径可能绕过按钮的 disabled，这里再校验一次上限。
        if (!withinMonthLimit(key, from, MAX_RANGE_MONTHS)) return;
        setStaged(normalized);
        setOpen(false);
        setHoverKey(null);
        if (normalized.from !== range.from || normalized.to !== range.to) onApply(normalized);
        focusTrigger();
      };

      const moveMonth = (delta) => {
        setAnchorMonth((prev) => {
          const next = addMonths(prev.year, prev.month, delta);
          const nextIndex = next.year * 12 + (next.month - 1);
          return nextIndex > todayIndex ? prev : next;
        });
      };

      const onPanelKeyDown = (event) => {
        const current = isDateKey(focusedKey) ? focusedKey : todayKey;
        let next = null;
        if (event.key === "ArrowLeft") next = addDays(current, -1);
        else if (event.key === "ArrowRight") next = addDays(current, 1);
        else if (event.key === "ArrowUp") next = addDays(current, -7);
        else if (event.key === "ArrowDown") next = addDays(current, 7);
        else if (event.key === "PageUp") next = shiftMonthKey(current, -1);
        else if (event.key === "PageDown") next = shiftMonthKey(current, 1);
        else if (event.key === "Home") next = startOfWeekKey(current);
        else if (event.key === "End") next = endOfWeekKey(current);
        else if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          if (!isFutureDate(current, todayKey)) pick(current);
          return;
        } else return;
        event.preventDefault();
        // 未来日期不可选，焦点也不越过今天。
        if (next > todayKey) next = todayKey;
        setFocusedKey(next);
        const targetMonth = monthOfDateKey(next);
        const targetIndex = targetMonth.year * 12 + (targetMonth.month - 1);
        if (layout === "single") {
          if (targetIndex !== anchorIndex) setAnchorMonth(targetMonth);
        } else if (targetIndex > anchorIndex) {
          setAnchorMonth(targetMonth);
        } else if (targetIndex < anchorIndex - 1) {
          setAnchorMonth(addMonths(targetMonth.year, targetMonth.month, 1));
        }
      };

      const onSelect = (event) => {
        const id = event.target.value;
        if (id === "custom") {
          // 切到自定义：直接打开日历，区间在点击「应用」后生效。
          setActivePreset("custom");
          if (!open) openPanel(range.from, range.to);
          return;
        }
        const preset = presets().find((item) => item.id === id);
        if (preset === undefined) return;
        setActivePreset(preset.id);
        setStaged({ from: preset.from, to: preset.to });
        setOpen(false);
        setHoverKey(null);
        onApply({ from: preset.from, to: preset.to });
      };

      const stagedFrom = isDateKey(staged.from) ? staged.from : null;
      const stagedTo = isDateKey(staged.to) ? staged.to : null;
      const triggerLabel =
        stagedFrom === null
          ? React.createElement("span", { className: "dsau-trigger-empty" }, t("rangeSelectDates"))
          : React.createElement(React.Fragment, null,
            React.createElement("span", null, fmtSlashDate(stagedFrom)),
            React.createElement("span", { className: "dsau-trigger-sep" }, t("rangeSeparator")),
            React.createElement("span", { className: stagedTo === null ? "dsau-trigger-empty" : undefined },
              stagedTo === null ? "…" : fmtSlashDate(stagedTo)
            )
          );

      const panelStyle = usePortal
        ? { position: "fixed", left: position.left, top: position.top, width: panelWidth }
        : { position: "absolute", left: 0, top: "calc(100% + 8px)", width: panelWidth };
      const panel = open
        ? React.createElement(CalendarPanel, {
          panelRef,
          panelStyle,
          grids,
          staged,
          hoverKey,
          focusedKey,
          todayKey,
          canNext,
          onPrev: () => moveMonth(-1),
          onNext: () => moveMonth(1),
          onPick: pick,
          onHover: setHoverKey,
          onKeyDown: onPanelKeyDown,
          label: t("rangeCustomRow"),
          t
        })
        : null;
      const panelNode = panel !== null && usePortal ? ReactDOM.createPortal(panel, document.body) : panel;

      return React.createElement("div", { style: styles.section },
        React.createElement("div", { style: styles.buttonsRow },
          React.createElement("p", { style: styles.rangeLabel }, t("rangeTitle")),
          React.createElement("span", { className: "dsau-select" },
            React.createElement("select", {
              value: activePreset,
              onChange: onSelect,
              className: "dsau-select-input",
              "aria-label": t("rangeTitle")
            },
              presets().map((preset) =>
                React.createElement("option", { key: preset.id, value: preset.id }, t(PRESET_LABEL_KEYS[preset.id]))
              ),
              React.createElement("option", { value: "custom" }, t("rangeCustom"))
            ),
            React.createElement("span", { className: "dsau-select-icon" }, selectChevron())
          )
        ),
        React.createElement("div", { className: "dsau-range-row" },
          React.createElement("span", { style: styles.rangeLabel }, t("rangeCustomRow")),
          React.createElement("button", {
            ref: triggerRef,
            type: "button",
            className: "dsau-trigger",
            "data-open": open ? "1" : "0",
            "aria-haspopup": "dialog",
            "aria-expanded": open ? "true" : "false",
            onClick: toggleOpen
          },
            triggerLabel,
            React.createElement("span", { className: "dsau-trigger-icon" }, calendarGlyph())
          ),
          usePortal ? null : panel
        ),
        usePortal ? panelNode : null
      );
    }

    function TokenPanel({ credApi, onSaved, t }) {
      const [state, setState] = React.useState({ kind: "loading" });
      const [value, setValue] = React.useState("");
      const [busy, setBusy] = React.useState(false);
      const [message, setMessage] = React.useState(null);

      const load = React.useCallback(() => {
        if (!credApi) {
          setState({ kind: "unavailable" });
          return;
        }
        Promise.resolve()
          .then(() => credApi.describe({ refs: [PLATFORM_TOKEN_REF] }))
          .then((r) => {
            const result = unwrapRpc(r);
            if (result === null || result.ok !== true || !result.value || !result.value.credentials) {
              setState({ kind: "unavailable" });
              return;
            }
            const view = result.value.credentials[PLATFORM_TOKEN_REF];
            setState({ kind: "done", configured: !!(view && view.configured), source: view ? view.source : null });
          })
          .catch(() => setState({ kind: "unavailable" }));
      }, [credApi]);

      React.useEffect(() => {
        load(false);
      }, [load]);

      const save = React.useCallback(() => {
        const v = value.trim();
        if (v === "" || busy || !credApi) return;
        setBusy(true);
        setMessage(null);
        credApi
          .set({ ref: PLATFORM_TOKEN_REF, value: v })
          .then((r) => {
            setBusy(false);
            const result = unwrapRpc(r);
            if (result === null || result.ok !== true) {
              setMessage(t("tokenSaveFailed"));
              return;
            }
            setValue("");
            load();
            if (onSaved) onSaved();
          })
          .catch(() => {
            setBusy(false);
            setMessage(t("tokenSaveFailed"));
          });
      }, [value, busy, credApi, load, onSaved, t]);

      const clear = React.useCallback(() => {
        if (busy || !credApi) return;
        setBusy(true);
        setMessage(null);
        credApi
          .unset({ ref: PLATFORM_TOKEN_REF })
          .then((r) => {
            setBusy(false);
            const result = unwrapRpc(r);
            if (result === null || result.ok !== true) {
              setMessage(t("tokenSaveFailed"));
              return;
            }
            load();
            if (onSaved) onSaved();
          })
          .catch(() => {
            setBusy(false);
            setMessage(t("tokenSaveFailed"));
          });
      }, [busy, credApi, load, onSaved, t]);

      let status;
      if (state.kind === "loading") status = React.createElement("p", { style: styles.hint }, t("loading"));
      else if (state.kind === "unavailable") status = React.createElement("p", { style: styles.error }, t("tokenUnavailable"));
      else if (state.configured) {
        status = React.createElement("p", { style: styles.ok },
          `${t("tokenConfigured")}${state.source === "env" ? ` · ${t("tokenSourceEnv")}` : ""}`
        );
      } else status = React.createElement("p", { style: styles.error }, t("tokenMissing"));

      return React.createElement("div", { style: styles.section },
        React.createElement("div", { style: styles.row },
          React.createElement("strong", { style: { fontSize: 13 } }, t("tokenTitle")),
          status
        ),
        React.createElement("p", { style: styles.hint }, t("tokenHint")),
        React.createElement("div", { style: styles.tokenRow },
          React.createElement("input", {
            type: "password",
            value,
            placeholder: t("tokenPlaceholder"),
            onChange: (e) => setValue(e.target.value),
            style: styles.input
          }),
          React.createElement("button", { style: styles.button, onClick: save, disabled: busy }, t("tokenSave")),
          React.createElement("button", { style: styles.button, onClick: clear, disabled: busy }, t("tokenClear"))
        ),
        message !== null ? React.createElement("p", { style: styles.error }, message) : null
      );
    }

    function DeepSeekPanel({ credApi, t, visible }) {
      const [summary, setSummary] = React.useState({ kind: "loading" });
      const [usage, setUsage] = React.useState({ kind: "loading" });
      const [range, setRange] = React.useState(() => {
        // 按 id 查找而不是按下标：预设列表会随版本调整，下标会漂移。
        const list = presets();
        const p = list.find((item) => item.id === "thisMonth") ?? list[list.length - 1];
        return clampRangeToMonths(p.from, p.to, MAX_RANGE_MONTHS);
      });
      // 会话令牌模块折叠状态：默认折叠；探测到令牌未配置时自动展开
      const [tokenCollapsed, setTokenCollapsed] = React.useState(true);
      const [tokenConfigured, setTokenConfigured] = React.useState(null); // null=探测中

      React.useEffect(() => {
        let disposed = false;
        if (!credApi) {
          setTokenConfigured(false);
          return;
        }
        Promise.resolve()
          .then(() => credApi.describe({ refs: [PLATFORM_TOKEN_REF] }))
          .then((r) => {
            if (disposed) return;
            const result = unwrapRpc(r);
            const view =
              result && result.ok === true && result.value && result.value.credentials
                ? result.value.credentials[PLATFORM_TOKEN_REF]
                : null;
            setTokenConfigured(!!(view && view.configured));
          })
          .catch(() => {
            if (!disposed) setTokenConfigured(false);
          });
        return () => {
          disposed = true;
        };
      }, [credApi]);

      React.useEffect(() => {
        // 未配置 → 自动展开；已配置则保持折叠默认
        if (tokenConfigured === false) setTokenCollapsed(false);
      }, [tokenConfigured]);

      const loadSummary = React.useCallback(() => {
        setSummary({ kind: "loading" });
        fetchJson("/api/account-usage/deepseek-summary")
          .then((body) => setSummary({ kind: "done", value: body }))
          .catch((e) => setSummary({ kind: "failure", message: String((e && e.message) || e) }));
      }, []);

      const loadUsage = React.useCallback((r) => {
        setUsage({ kind: "loading" });
        fetchJson(`/api/account-usage/deepseek-usage?from=${r.from}&to=${r.to}`)
          .then((body) => setUsage({ kind: "done", value: body }))
          .catch((e) => setUsage({ kind: "failure", message: String((e && e.message) || e) }));
      }, []);

      React.useEffect(() => {
        loadSummary();
      }, [loadSummary]);

      React.useEffect(() => {
        loadUsage(range);
      }, [loadUsage, range]);

      React.useEffect(() => {
        const id = window.setInterval(() => {
          loadSummary();
          loadUsage(range);
        }, 60000);
        return () => window.clearInterval(id);
      }, [loadSummary, loadUsage, range]);

      const applyRange = React.useCallback(
        (r) => {
          // 静默收紧：任何来源（预设、回填、宿主裁剪后的回显）超过 3 个自然月时，
          // 保持 to 不动、把 from 后移到上限内，避免把越界区间发去宿主被裁剪。
          setRange(r === null || typeof r !== "object" ? r : clampRangeToMonths(r.from, r.to, MAX_RANGE_MONTHS));
        },
        []
      );

      const currency = summary.kind === "done" && summary.value.ok === true ? summary.value.balance?.currency : null;
      const [tokenModel, setTokenModel] = React.useState(null);
      const usageModels = usage.kind === "done" && usage.value.ok === true ? usage.value.models || [] : [];
      const tokenModelResolved =
        usageModels.length > 0 && usageModels.some((m) => m.model === tokenModel)
          ? tokenModel
          : usageModels.length > 0
            ? usageModels[0].model
            : null;

      // 合计口径（0.5.0）：消费金额与请求次数把工具（网页搜索/抓取）消耗一并计入。
      const totals =
        usage.kind === "done" && usage.value.ok === true ? combinedTotals(usage.value) : null;
      const toolsTotalsOk = totals !== null && totals.toolsOk === true;
      const splitHint = (key, modelText, toolText) =>
        t(key).replace("{model}", modelText).replace("{tools}", toolText);
      const costHint =
        totals === null
          ? null
          : !toolsTotalsOk
            ? t("totalsToolsUnavailable")
            : totals.costPartial
              ? t("totalsToolsCostUnavailable")
              : splitHint("totalsCostHint", fmtMoney(totals.modelCost, currency), fmtMoney(totals.toolCost, currency));
      const requestsHint =
        totals === null
          ? null
          : toolsTotalsOk && !totals.requestsPartial
            ? splitHint("totalsRequestsHint", fmtCount(totals.modelRequests), fmtCount(totals.toolCalls))
            : t("totalsToolsUnavailable");

      return React.createElement("div", { style: styles.section },
        React.createElement("div", { style: styles.panelTitle },
          React.createElement("span", null, t("deepseekPanel")),
          React.createElement("div", { style: styles.buttonsRow },
            React.createElement(JumpButton, { url: DEEPSEEK_USAGE_PAGE_URL, t }),
            React.createElement(RefreshButton, { onClick: () => { loadSummary(); loadUsage(range); }, t })
          )
        ),
        // 模块一：会话令牌（默认折叠；未配置令牌时自动展开）
        React.createElement(ModuleCard, {
          title: t("moduleToken"),
          collapsible: true,
          collapsed: tokenCollapsed,
          onToggle: () => setTokenCollapsed((v) => !v)
        },
          React.createElement(TokenPanel, { credApi, onSaved: () => { loadSummary(); loadUsage(range); }, t })
        ),
        // 模块二：账户余额
        React.createElement(ModuleCard, { title: t("moduleBalance") },
          summary.kind === "loading"
            ? React.createElement("p", { style: styles.hint }, t("loading"))
            : summary.kind === "failure"
              ? React.createElement("p", { style: styles.error }, summary.message)
              : summary.value.ok !== true
                ? React.createElement("p", { style: styles.error }, errorText(summary.value, t))
                : React.createElement("div", { style: styles.cardsGrid },
                  React.createElement(StatGridItem, { label: t("summaryToppedUp"), value: fmtMoney(summary.value.balance?.toppedUp, currency) }),
                  React.createElement(StatGridItem, { label: t("summaryGranted"), value: fmtMoney(summary.value.balance?.granted, currency) }),
                  React.createElement(StatGridItem, { label: t("summaryCumulative"), value: fmtMoney(summary.value.cumulativeCost, currency) })
                )
        ),
        // 模块三：用量（筛选 + 合计口径 = 模型 + 工具）
        React.createElement(ModuleCard, { title: t("moduleUsage") },
          React.createElement(RangeSelector, { range, onApply: applyRange, t, visible }),
          usage.kind === "loading"
            ? React.createElement("p", { style: styles.hint }, t("loading"))
            : usage.kind === "failure"
              ? React.createElement("p", { style: styles.error }, usage.message)
              : usage.value.ok !== true
                ? React.createElement("p", { style: styles.error }, errorText(usage.value, t))
                : React.createElement(React.Fragment, null,
                  React.createElement("div", { style: styles.cardsGrid },
                    React.createElement(StatGridItem, {
                      label: t("totalsCost"),
                      value: fmtMoney(totals.cost, currency),
                      hint: costHint
                    }),
                    React.createElement(StatGridItem, {
                      label: t("totalsRequests"),
                      value: fmtCount(totals.requests),
                      hint: requestsHint
                    }),
                    React.createElement(StatGridItem, { label: t("totalsTokens"), value: fmtCount(totals.tokens) })
                  )
                )
        ),
        // 模块四：模型用量明细（消费/Token 图表 + 模型明细表，均为模型口径）
        React.createElement(ModuleCard, { title: t("moduleModels") },
          usage.kind === "loading"
            ? React.createElement("p", { style: styles.hint }, t("loading"))
            : usage.kind === "failure"
              ? React.createElement("p", { style: styles.error }, usage.message)
              : usage.value.ok !== true
                ? React.createElement("p", { style: styles.error }, errorText(usage.value, t))
                : React.createElement(React.Fragment, null,
                  React.createElement("div", { style: styles.card },
                    React.createElement("p", { style: styles.statLabel }, t("chartTitle")),
                    React.createElement(BarChart, { days: usage.value.days, currency, t })
                  ),
                  React.createElement("div", { style: styles.card },
                    React.createElement("p", { style: styles.statLabel }, t("tokenChartTitle")),
                    usageModels.length > 0
                      ? React.createElement(React.Fragment, null,
                        React.createElement("div", { style: styles.buttonsRow },
                          usageModels.map((m) =>
                            React.createElement("button", {
                              key: m.model,
                              style: tokenModelResolved === m.model ? styles.chipActive : styles.chip,
                              onClick: () => setTokenModel(m.model)
                            }, m.model)
                          )
                        ),
                        React.createElement(TokenChart, { days: usage.value.days, model: tokenModelResolved, currency, t }),
                        React.createElement(TokenLegend, { t })
                      )
                      : React.createElement("p", { style: styles.hint }, t("tokenChartEmpty"))
                  ),
                  React.createElement("div", { style: styles.card },
                    React.createElement("p", { style: styles.statLabel }, t("modelTableTitle")),
                    React.createElement(ModelTable, { models: usage.value.models, currency, t })
                  )
                )
        ),
        // 模块五：网页搜索与抓取（调用类型用量）
        React.createElement(ModuleCard, { title: t("moduleTools") },
          usage.kind === "loading"
            ? React.createElement("p", { style: styles.hint }, t("loading"))
            : usage.kind === "failure"
              ? React.createElement("p", { style: styles.error }, usage.message)
              : usage.value.ok !== true
                ? React.createElement("p", { style: styles.error }, errorText(usage.value, t))
                : React.createElement(ToolUsageSection, { tools: usage.value.tools, currency, t })
        )
      );
    }

    // ---- OpenCode 用量趋势（0.4.0 新增） -------------------------------------
    // 当前订阅周期的「按天已用额度」曲线 + 线性外推预测。数据来自宿主路由
    // /api/account-usage/opencode-history：宿主优先用官方 Console 日榜，
    // 未配置 Cookie 时退回本地 15 分钟采样（历史从插件开始记录那天起算）。

    /** Console 会话 Cookie 的凭据引用名（与宿主侧常量一致）。 */
    const CONSOLE_COOKIE_REF = "OPENCODE_CONSOLE_COOKIE";

    /** 趋势图坐标系；宽高与 ChartTooltip 的换算口径保持一致。 */
    const TREND_W = 640;
    const TREND_H = 200;
    const TREND_PAD_L = 34;
    const TREND_PAD_R = 46;
    const TREND_PAD_T = 12;
    const TREND_PAD_B = 20;
    const TREND_PATTERN_ID = "dsh-account-usage-trend-hatch";
    /** 趋势数据刷新周期（额度卡仍按 60 秒刷新，历史序列没必要那么勤）。 */
    const TREND_REFRESH_MS = 10 * 60 * 1000;

    /** `YYYY-MM-DD` → 本地 Date（避免 new Date("2026-11-02") 被当成 UTC 零点）。 */
    function parseLocalDateKey(key) {
      const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(typeof key === "string" ? key : "");
      if (m === null) return null;
      return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    }

    /** 星期缩写（跟随浏览器语言；无法解析时返回空串）。 */
    function weekdayShort(key) {
      const date = parseLocalDateKey(key);
      if (date === null) return "";
      try {
        return date.toLocaleDateString(undefined, { weekday: "short" });
      } catch {
        return "";
      }
    }

    /** 大数字紧凑展示：17,236 / 1.23M / 3.784B。 */
    function fmtCompactCount(value) {
      if (value === null || value === undefined || Number.isNaN(Number(value))) return "—";
      const n = Number(value);
      const trim = (s) => s.replace(/\.?0+$/, "");
      if (Math.abs(n) >= 1e9) return `${trim((n / 1e9).toFixed(3))}B`;
      if (Math.abs(n) >= 1e6) return `${trim((n / 1e6).toFixed(2))}M`;
      return Math.round(n).toLocaleString();
    }

    /** 百分比展示：精度 1 时取整，否则保留一位小数。 */
    function fmtPercent(value, precision) {
      if (value === null || value === undefined || Number.isNaN(Number(value))) return "—";
      const n = Number(value);
      return precision === 1 ? `${Math.round(n)}%` : `${(Math.round(n * 10) / 10).toFixed(1)}%`;
    }

    /**
     * 累计已用额度 + 预测折线图（纯 SVG）。
     * - 历史段：相邻两天都有记录的连续片段各画一条折线（缺口断开，不插值）；
     * - 预测段：从今天到周期末的虚线 + 斜线填充；
     * - 悬浮：按天热区，复用 ChartTooltip 的边缘钳制逻辑。
     */
    function OpenCodeTrendChart({ data, t }) {
      const [hovered, setHovered] = React.useState(null);
      const wrapRef = React.useRef(null);
      const days = Array.isArray(data.days) ? data.days : [];
      if (days.length === 0) {
        return React.createElement("p", { style: styles.hint }, t("trendEmpty"));
      }
      const precision = data.precision === 1 ? 1 : 0.1;
      const gridMax = Math.max(100, Number(data.gridMax) || 100);
      const innerW = TREND_W - TREND_PAD_L - TREND_PAD_R;
      const innerH = TREND_H - TREND_PAD_T - TREND_PAD_B;
      const slot = innerW / days.length;
      const xOf = (index) => TREND_PAD_L + (index + 0.5) * slot;
      const yOf = (percent) =>
        TREND_PAD_T + innerH * (1 - Math.max(0, Math.min(percent, gridMax)) / gridMax);
      const baseY = yOf(0);

      // 网格线 + 百分比刻度
      const gridLines = [];
      for (let p = 0; p <= gridMax; p += 50) {
        const y = yOf(p);
        gridLines.push(
          React.createElement("line", {
            key: `grid-${p}`,
            x1: TREND_PAD_L,
            x2: TREND_W - TREND_PAD_R,
            y1: y,
            y2: y,
            stroke: "var(--dsw-alias-border-l2)",
            strokeWidth: 1,
            opacity: 0.6
          }),
          React.createElement("text", {
            key: `grid-label-${p}`,
            x: TREND_PAD_L - 6,
            y: y + 3.5,
            textAnchor: "end",
            style: { fill: "var(--dsw-alias-label-tertiary)", fontSize: 10 }
          }, `${p}%`)
        );
      }

      // 历史段：按「连续有记录」切段，缺口不连线
      const segments = [];
      let current = [];
      days.forEach((day, index) => {
        if (day.recorded && day.cumulativePercent !== null && day.cumulativePercent !== undefined) {
          current.push({ x: xOf(index), y: yOf(day.cumulativePercent), index });
        } else if (current.length > 0) {
          segments.push(current);
          current = [];
        }
      });
      if (current.length > 0) segments.push(current);

      const historyShapes = [];
      segments.forEach((segment, segIndex) => {
        const line = segment
          .map((point, i) => `${i === 0 ? "M" : "L"} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`)
          .join(" ");
        if (segment.length > 1) {
          const first = segment[0];
          const last = segment[segment.length - 1];
          const area = `${line} L ${last.x.toFixed(1)} ${baseY.toFixed(1)} L ${first.x.toFixed(1)} ${baseY.toFixed(1)} Z`;
          historyShapes.push(
            React.createElement("path", {
              key: `area-${segIndex}`,
              d: area,
              fill: "var(--dsw-alias-state-success-primary)",
              opacity: 0.12,
              stroke: "none"
            })
          );
          historyShapes.push(
            React.createElement("path", {
              key: `line-${segIndex}`,
              d: line,
              fill: "none",
              stroke: "var(--dsw-alias-state-success-primary)",
              strokeWidth: 2,
              strokeLinecap: "round",
              strokeLinejoin: "round"
            })
          );
        } else {
          historyShapes.push(
            React.createElement("circle", {
              key: `dot-${segIndex}`,
              cx: segment[0].x,
              cy: segment[0].y,
              r: 2.5,
              fill: "var(--dsw-alias-state-success-primary)"
            })
          );
        }
      });

      // 预测段：从今天的锚点外推到周期末
      const todayKey = data.today !== undefined && data.today !== null ? data.today : data.now ? data.now.date : null;
      const todayIndex = days.findIndex((day) => day.date === todayKey);
      const forecast = data.forecast || {};
      const currentPercent =
        todayIndex >= 0 && days[todayIndex].cumulativePercent !== null
          ? days[todayIndex].cumulativePercent
          : forecast.currentPercent;
      const hasForecast =
        forecast.sufficient === true &&
        todayIndex >= 0 &&
        forecast.projectedEndPercent !== null &&
        forecast.projectedEndPercent !== undefined &&
        currentPercent !== null &&
        currentPercent !== undefined;
      let forecastShapes = null;
      if (hasForecast) {
        const startX = xOf(todayIndex);
        const startY = yOf(currentPercent);
        const endX = xOf(days.length - 1);
        const endY = yOf(forecast.projectedEndPercent);
        const hatchPath = `M ${startX.toFixed(1)} ${startY.toFixed(1)} L ${endX.toFixed(1)} ${endY.toFixed(1)} L ${endX.toFixed(1)} ${baseY.toFixed(1)} L ${startX.toFixed(1)} ${baseY.toFixed(1)} Z`;
        forecastShapes = React.createElement("g", null,
          React.createElement("path", {
            d: hatchPath,
            fill: `url(#${TREND_PATTERN_ID})`,
            stroke: "none"
          }),
          React.createElement("line", {
            x1: startX,
            y1: startY,
            x2: endX,
            y2: endY,
            stroke: "var(--dsw-alias-state-warn-primary)",
            strokeWidth: 2,
            strokeDasharray: "5 4",
            strokeLinecap: "round"
          }),
          React.createElement("circle", {
            cx: endX,
            cy: endY,
            r: 3.5,
            fill: "var(--dsw-alias-bg-layer-3)",
            stroke: "var(--dsw-alias-state-warn-primary)",
            strokeWidth: 2
          }),
          React.createElement("text", {
            x: Math.min(endX + 8, TREND_W - 2),
            y: endY - 6,
            textAnchor: "end",
            style: { fill: "var(--dsw-alias-state-warn-primary)", fontSize: 11, fontWeight: 600 }
          }, fmtPercent(forecast.projectedEndPercent, precision))
        );
      }

      // 今天的锚点
      let todayMarker = null;
      if (todayIndex >= 0 && currentPercent !== null && currentPercent !== undefined) {
        todayMarker = React.createElement("circle", {
          cx: xOf(todayIndex),
          cy: yOf(currentPercent),
          r: 3.5,
          fill: "var(--dsw-alias-bg-layer-3)",
          stroke: "var(--dsw-alias-state-success-primary)",
          strokeWidth: 2
        });
      }

      // 横轴刻度：首日 / 三分之一 / 三分之二 / 末日
      const axisIndexes = days.length <= 2
        ? [0, days.length - 1]
        : [0, Math.round((days.length - 1) / 3), Math.round(((days.length - 1) * 2) / 3), days.length - 1];
      const axisLabels = [...new Set(axisIndexes)].map((index, order, list) =>
        React.createElement("text", {
          key: `axis-${index}`,
          x: index === 0
            ? TREND_PAD_L
            : index === days.length - 1
              ? TREND_W - TREND_PAD_R
              : xOf(index),
          y: TREND_H - 6,
          textAnchor: index === 0 ? "start" : index === days.length - 1 ? "end" : "middle",
          style: { fill: "var(--dsw-alias-label-tertiary)", fontSize: 10 }
        }, index === 0 || index === days.length - 1 ? days[index].date : days[index].date.slice(5))
      );

      // 悬浮热区（每天一条竖带）
      const hitAreas = days.map((day, index) =>
        React.createElement("rect", {
          key: `hit-${day.date}`,
          x: TREND_PAD_L + index * slot,
          y: TREND_PAD_T,
          width: slot,
          height: innerH,
          fill: "transparent",
          pointerEvents: "all",
          onMouseEnter: () => setHovered(index),
          onMouseLeave: () => setHovered(null)
        })
      );

      let tooltip = null;
      if (hovered !== null && days[hovered] !== undefined) {
        const day = days[hovered];
        const weekday = weekdayShort(day.date);
        const rows = [
          React.createElement("p", { key: "used", style: styles.tooltipRow },
            `${t("trendUsed")}: ${day.recorded ? fmtPercent(day.cumulativePercent, precision) : t("trendNotRecorded")}`
          ),
          React.createElement("p", { key: "delta", style: styles.tooltipRow },
            `${t("trendDayDelta")}: ${day.deltaPercent === null || day.deltaPercent === undefined
              ? "—"
              : `${day.deltaPercent >= 0 ? "+" : ""}${fmtPercent(day.deltaPercent, precision)}`}`
          ),
          React.createElement("p", { key: "requests", style: styles.tooltipRow },
            `${t("trendRequests")}: ${day.requests === null || day.requests === undefined ? "—" : fmtCompactCount(day.requests)}`
          )
        ];
        tooltip = React.createElement(ChartTooltip, {
          anchorX: xOf(hovered),
          count: days.length,
          wrapRef,
          chartWidth: TREND_W,
          chartHeight: TREND_H
        },
          React.createElement("p", { style: styles.tooltipTitle }, weekday === "" ? day.date : `${day.date} · ${weekday}`),
          rows
        );
      }

      return React.createElement("div", { ref: wrapRef, style: styles.chartWrap },
        React.createElement("svg", {
          width: "100%",
          viewBox: `0 0 ${TREND_W} ${TREND_H}`,
          style: { display: "block" },
          onMouseLeave: () => setHovered(null)
        },
          React.createElement("defs", null,
            React.createElement("pattern", {
              id: TREND_PATTERN_ID,
              width: 6,
              height: 6,
              patternUnits: "userSpaceOnUse",
              patternTransform: "rotate(45)"
            },
              React.createElement("line", {
                x1: 0,
                y1: 0,
                x2: 0,
                y2: 6,
                stroke: "var(--dsw-alias-state-warn-primary)",
                strokeWidth: 1.5,
                opacity: 0.35
              })
            )
          ),
          gridLines,
          // 100% 月度上限参考线
          React.createElement("line", {
            x1: TREND_PAD_L,
            x2: TREND_W - TREND_PAD_R,
            y1: yOf(Math.min(100, gridMax)),
            y2: yOf(Math.min(100, gridMax)),
            stroke: "var(--dsw-alias-label-tertiary)",
            strokeWidth: 1,
            strokeDasharray: "4 4",
            opacity: 0.7
          }),
          historyShapes,
          forecastShapes,
          todayMarker,
          hovered !== null ? React.createElement("line", {
            x1: xOf(hovered),
            x2: xOf(hovered),
            y1: TREND_PAD_T,
            y2: baseY,
            stroke: "var(--dsw-alias-label-tertiary)",
            strokeWidth: 1,
            opacity: 0.35
          }) : null,
          axisLabels,
          hitAreas
        ),
        tooltip
      );
    }

    /** Console Cookie 配置（无 Cookie 时展开在趋势卡内；保存到 DSH 凭据）。 */
    function ConsoleCookieEditor({ credApi, t, onSaved }) {
      const [state, setState] = React.useState({ kind: "loading" });
      const [value, setValue] = React.useState("");
      const [busy, setBusy] = React.useState(false);
      const [message, setMessage] = React.useState(null);

      const load = React.useCallback(() => {
        if (!credApi) {
          setState({ kind: "unavailable" });
          return;
        }
        Promise.resolve()
          .then(() => credApi.describe({ refs: [CONSOLE_COOKIE_REF] }))
          .then((r) => {
            const result = unwrapRpc(r);
            if (result === null || result.ok !== true || !result.value || !result.value.credentials) {
              setState({ kind: "unavailable" });
              return;
            }
            const view = result.value.credentials[CONSOLE_COOKIE_REF];
            setState({ kind: "done", configured: !!(view && view.configured) });
          })
          .catch(() => setState({ kind: "unavailable" }));
      }, [credApi]);

      React.useEffect(() => {
        load();
      }, [load]);

      const save = React.useCallback(() => {
        const v = value.trim();
        if (v === "" || busy || !credApi) return;
        setBusy(true);
        setMessage(null);
        credApi.set({ ref: CONSOLE_COOKIE_REF, value: v })
          .then((r) => {
            setBusy(false);
            const result = unwrapRpc(r);
            if (result === null || result.ok !== true) {
              setMessage(t("cookieSaveFailed"));
              return;
            }
            setValue("");
            setMessage(t("cookieSaved"));
            load();
            if (onSaved) onSaved();
          })
          .catch(() => {
            setBusy(false);
            setMessage(t("cookieSaveFailed"));
          });
      }, [value, busy, credApi, load, onSaved, t]);

      const clear = React.useCallback(() => {
        if (busy || !credApi) return;
        setBusy(true);
        setMessage(null);
        credApi.unset({ ref: CONSOLE_COOKIE_REF })
          .then((r) => {
            setBusy(false);
            const result = unwrapRpc(r);
            if (result === null || result.ok !== true) {
              setMessage(t("cookieSaveFailed"));
              return;
            }
            load();
            if (onSaved) onSaved();
          })
          .catch(() => {
            setBusy(false);
            setMessage(t("cookieSaveFailed"));
          });
      }, [busy, credApi, load, onSaved, t]);

      let status = null;
      if (state.kind === "done") {
        status = React.createElement("p", { style: state.configured ? styles.ok : styles.hint },
          state.configured ? t("cookieConfigured") : t("cookieMissing"));
      } else if (state.kind === "unavailable") {
        status = React.createElement("p", { style: styles.error }, t("tokenUnavailable"));
      }

      return React.createElement("div", { style: styles.cookieBox },
        React.createElement("p", { style: styles.hint }, t("cookieHint")),
        status,
        React.createElement("div", { style: styles.tokenRow },
          React.createElement("input", {
            type: "password",
            value,
            placeholder: t("cookiePlaceholder"),
            onChange: (e) => setValue(e.target.value),
            style: styles.input,
            "aria-label": t("cookiePlaceholder")
          }),
          React.createElement("button", { style: styles.button, onClick: save, disabled: busy }, t("cookieSave")),
          React.createElement("button", { style: styles.button, onClick: clear, disabled: busy }, t("cookieClear"))
        ),
        message !== null ? React.createElement("p", { style: styles.ok }, message) : null
      );
    }

    /** 本周期模型用量卡（仅官方日榜可用时渲染）。 */
    function OpenCodeModelsCard({ data, t }) {
      const models = Array.isArray(data.models) ? data.models : [];
      if (models.length === 0) return null;
      const rows = models.map((model, index) => {
        const sharePercent = Math.round((model.share ?? 0) * 1000) / 10;
        return React.createElement("div", { key: `${model.provider ?? ""}/${model.model}/${index}`, style: styles.modelRow },
          React.createElement("div", { style: styles.modelRowHead },
            React.createElement("span", { style: styles.modelName }, model.model),
            React.createElement("span", { style: styles.modelShare }, `${sharePercent.toFixed(1)}%`)
          ),
          React.createElement("div", { style: styles.modelBarTrack },
            React.createElement("div", {
              style: { ...styles.modelBarFill, width: `${Math.max(1, Math.min(100, sharePercent))}%` }
            })
          )
        );
      });
      const totals = data.totals || {};
      return React.createElement(ModuleCard, { title: t("modelsTitle") },
        React.createElement("div", { style: styles.modelList }, rows),
        React.createElement("div", { style: styles.modelTotals },
          React.createElement("div", { style: styles.modelTotalItem },
            React.createElement("p", { style: styles.statLabel }, t("trendRequests")),
            React.createElement("p", { style: styles.statValue }, fmtCompactCount(totals.requests))
          ),
          React.createElement("div", { style: styles.modelTotalItem },
            React.createElement("p", { style: styles.statLabel }, t("modelsTokens")),
            React.createElement("p", { style: styles.statValue }, fmtCompactCount(totals.tokens))
          )
        ),
        React.createElement("p", { style: styles.hint }, t("modelsSource"))
      );
    }

    /**
     * 用量趋势卡：拉 /api/account-usage/opencode-history 并渲染。
     * 挂载时取一次，之后每 10 分钟刷新；点刷新按钮走 ?refresh=1 绕过宿主缓存。
     */
    function OpenCodeTrendCard({ t, credApi }) {
      const [state, setState] = React.useState({ kind: "loading" });
      const [showCookie, setShowCookie] = React.useState(false);

      const load = React.useCallback((force) => {
        const path = force ? "/api/account-usage/opencode-history?refresh=1" : "/api/account-usage/opencode-history";
        fetchJson(path)
          .then((body) => setState({ kind: "done", value: body }))
          .catch((e) => setState({ kind: "failure", message: String((e && e.message) || e) }));
      }, []);

      React.useEffect(() => {
        load(false);
      }, [load]);

      React.useEffect(() => {
        const id = window.setInterval(() => load(false), TREND_REFRESH_MS);
        return () => window.clearInterval(id);
      }, [load]);

      const refresh = React.useCallback(() => load(true), [load]);
      const retry = React.useCallback(() => load(false), [load]);

      if (state.kind === "loading") {
        return React.createElement(ModuleCard, { title: t("trendTitle") },
          React.createElement("p", { style: styles.hint }, t("loading"))
        );
      }
      if (state.kind === "failure") {
        return React.createElement(ModuleCard, { title: t("trendTitle") },
          React.createElement("p", { style: styles.error }, state.message),
          React.createElement("div", { style: styles.buttonsRow },
            React.createElement(RefreshButton, { onClick: retry, t })
          )
        );
      }
      if (state.value.ok !== true) {
        return React.createElement(ModuleCard, { title: t("trendTitle") },
          React.createElement("p", { style: styles.error }, errorText(state.value, t)),
          React.createElement("div", { style: styles.buttonsRow },
            React.createElement(RefreshButton, { onClick: retry, t })
          )
        );
      }

      const value = state.value;
      const days = Array.isArray(value.days) ? value.days : [];
      const forecast = value.forecast || {};
      const consoleInfo = value.console || {};
      const precision = value.precision === 1 ? 1 : 0.1;
      const isConsole = value.source === "console";

      // 顶部摘要：当前已用 · 日均 · 期末预测
      const summary = [];
      summary.push(
        React.createElement("div", { key: "current", style: styles.trendSummaryItem },
          React.createElement("p", { style: styles.statLabel }, t("trendCurrent")),
          React.createElement("p", { style: styles.trendSummaryValue }, fmtPercent(value.now && value.now.currentPercent, precision))
        )
      );
      if (forecast.sufficient) {
        summary.push(
          React.createElement("div", { key: "pace", style: styles.trendSummaryItem },
            React.createElement("p", { style: styles.statLabel }, t("trendPace")),
            React.createElement("p", { style: styles.trendSummaryValue },
              `${(Math.round((forecast.pacePercentPerDay ?? 0) * 10) / 10).toFixed(1)}${t("trendPaceUnit")}`)
          ),
          React.createElement("div", { key: "projected", style: styles.trendSummaryItem },
            React.createElement("p", { style: styles.statLabel }, t("trendProjected")),
            React.createElement("p", {
              style: {
                ...styles.trendSummaryValue,
                color: forecast.projectedEndPercent > 100
                  ? "var(--dsw-alias-state-warn-primary)"
                  : "var(--dsw-alias-label-primary)"
              }
            }, `${(Math.round((forecast.projectedEndPercent ?? 0) * 10) / 10).toFixed(1)}%`)
          )
        );
      } else {
        summary.push(
          React.createElement("div", { key: "insufficient", style: styles.trendSummaryItem },
            React.createElement("p", { style: styles.statLabel }, t("trendProjected")),
            React.createElement("p", { style: styles.trendSummaryValue }, t("trendInsufficient"))
          )
        );
      }

      // 数据来源行 + 降级提示
      let sourceText = isConsole ? t("trendSourceConsole") : t("trendSourceSampling");
      if (!isConsole && value.sampledSince) sourceText = `${sourceText} · ${t("trendSince")} ${value.sampledSince}`;
      const consoleStatus = consoleInfo.status;
      const degraded = consoleStatus === "expired" || consoleStatus === "unavailable";
      // 把上游状态码带出来，用户（和排查者）能一眼区分「Cookie 错」与「接口结构变」
      const diagnostics = consoleInfo.diagnostics || {};
      const httpStatus = [
        diagnostics.orgsStatus,
        diagnostics.statusStatus,
        diagnostics.activityStatus,
        diagnostics.exportStatus
      ].find((code) => typeof code === "number" && code !== 200 && code !== 0);
      const cookiePairs = typeof diagnostics.cookiePairs === "number" ? diagnostics.cookiePairs : null;
      const shortCookie = degraded && cookiePairs !== null && cookiePairs <= 3 && consoleStatus !== "expired";
      let degradedText = consoleStatus === "expired"
        ? t("consoleExpired")
        : `${t("consoleUnavailable")}${httpStatus === undefined ? "" : ` · HTTP ${httpStatus}`}`;
      if (shortCookie) {
        degradedText = `${degradedText} — ${t("consoleCookieLooksShort").replace("{pairs}", String(cookiePairs))}`;
      }
      const cookieButtonLabel = consoleInfo.configured ? t("cookieUpdate") : t("cookieConfigure");

      return React.createElement(React.Fragment, null,
        React.createElement(ModuleCard, { title: t("trendTitle") },
          React.createElement("div", { style: styles.trendSummary }, summary),
          React.createElement(OpenCodeTrendChart, {
            data: {
              days,
              forecast,
              gridMax: value.grid ? value.grid.max : 100,
              precision,
              today: value.now ? value.now.date : null
            },
            t
          }),
          React.createElement("div", { style: styles.legendRow },
            React.createElement("span", { style: styles.legendItem },
              React.createElement("i", { style: { ...styles.swatch, background: "var(--dsw-alias-state-success-primary)" } }),
              t("trendLegendUsage")
            ),
            React.createElement("span", { style: styles.legendItem },
              React.createElement("i", { style: { ...styles.swatch, background: "var(--dsw-alias-state-warn-primary)" } }),
              t("trendLegendForecast")
            ),
            React.createElement("span", { style: styles.legendItem },
              React.createElement("i", { style: { ...styles.swatch, background: "var(--dsw-alias-label-tertiary)" } }),
              t("trendLegendLimit")
            )
          ),
          React.createElement("div", { style: styles.buttonsRow },
            React.createElement("button", { style: styles.button, onClick: () => setShowCookie((v) => !v) }, cookieButtonLabel),
            React.createElement(RefreshButton, { onClick: refresh, t })
          ),
          React.createElement("p", { style: styles.hint }, sourceText),
          degraded
            ? React.createElement("p", { style: styles.error }, degradedText)
            : null,
          showCookie ? React.createElement(ConsoleCookieEditor, {
            credApi,
            t,
            onSaved: () => {
              setShowCookie(false);
              load(true);
            }
          }) : null
        ),
        React.createElement(OpenCodeModelsCard, { data: value, t })
      );
    }

    function OpencodePanel({ t, credApi }) {
      const [state, setState] = React.useState({ kind: "loading" });

      const load = React.useCallback(() => {
        setState({ kind: "loading" });
        fetchJson("/api/account-usage/opencode")
          .then((body) => setState({ kind: "done", value: body }))
          .catch((e) => setState({ kind: "failure", message: String((e && e.message) || e) }));
      }, []);

      React.useEffect(() => {
        load();
      }, [load]);

      React.useEffect(() => {
        const id = window.setInterval(load, 60000);
        return () => window.clearInterval(id);
      }, [load]);

      if (state.kind === "loading") {
        return React.createElement("div", { style: styles.section },
          React.createElement("div", { style: styles.panelTitle },
            React.createElement("span", null, t("opencodePanel"))
          ),
          React.createElement("p", { style: styles.hint }, t("loading"))
        );
      }
      if (state.kind === "failure") {
        return React.createElement("div", { style: styles.section },
          React.createElement("div", { style: styles.panelTitle },
            React.createElement("span", null, t("opencodePanel")),
            React.createElement("div", { style: styles.buttonsRow },
              React.createElement(JumpButton, { url: OPENCODE_GO_PAGE_URL, t }),
              React.createElement(RefreshButton, { onClick: () => load(true), t })
            )
          ),
          React.createElement("p", { style: styles.error }, state.message)
        );
      }
      if (state.value.ok !== true) {
        return React.createElement("div", { style: styles.section },
          React.createElement("div", { style: styles.panelTitle },
            React.createElement("span", null, t("opencodePanel")),
            React.createElement("div", { style: styles.buttonsRow },
              React.createElement(JumpButton, { url: OPENCODE_GO_PAGE_URL, t }),
              React.createElement(RefreshButton, { onClick: load, t })
            )
          ),
          React.createElement("p", { style: styles.error }, errorText(state.value, t)),
          state.value.keySource === "credentials"
            ? React.createElement("p", { style: styles.hint }, t("keySourceCredentials"))
            : state.value.keySource === "auth-json"
              ? React.createElement("p", { style: styles.hint }, t("keySourceAuthJson"))
              : null
        );
      }
      const keySource = state.value.keySource;
      return React.createElement("div", { style: styles.section },
        React.createElement("div", { style: styles.panelTitle },
          React.createElement("span", null, t("opencodePanel")),
          React.createElement("div", { style: styles.buttonsRow },
            React.createElement(JumpButton, { url: OPENCODE_GO_PAGE_URL, t }),
            React.createElement(RefreshButton, { onClick: load, t })
          )
        ),
        React.createElement("div", { style: styles.row },
          keySource === "credentials"
            ? React.createElement("span", { style: styles.badgeOk }, t("keySourceCredentials"))
            : keySource === "auth-json"
              ? React.createElement("span", { style: styles.badgeOk }, t("keySourceAuthJson"))
              : React.createElement("span", { style: styles.badge }, t("keyMissing")),
          React.createElement("span", null)
        ),
        React.createElement(WindowCard, {
          name: t("rolling"),
          limit: OPENCODE_LIMITS.rolling,
          windowData: state.value.usage?.rolling,
          countdown: fmtCountdown(state.value.usage?.rolling?.resetsAt, "rolling", t),
          t
        }),
        React.createElement(WindowCard, {
          name: t("weekly"),
          limit: OPENCODE_LIMITS.weekly,
          windowData: state.value.usage?.weekly,
          countdown: fmtCountdown(state.value.usage?.weekly?.resetsAt, "weekly", t),
          t
        }),
        React.createElement(WindowCard, {
          name: t("monthly"),
          limit: OPENCODE_LIMITS.monthly,
          windowData: state.value.usage?.monthly,
          countdown: fmtCountdown(state.value.usage?.monthly?.resetsAt, "monthly", t),
          t
        }),
        // 三张额度卡下方：当前订阅周期的按天趋势 + 预测（数据来自宿主侧采样/官方日榜）
        React.createElement(OpenCodeTrendCard, { t, credApi })
      );
    }

    // ---- 「概览」标签页（0.5.0） -----------------------------------------------
    // 数据来自宿主 /api/account-usage/insights：账本只增不减，已归档/已删除会话
    // 的历史消耗仍在里面。首次进入时宿主在后台增量扫描，前端轮询到 scanning=false。

    /** 统计格：数值在上、标签在下，可选第三行小字（如峰值日期）。 */
    function OverviewStat({ label, value, hint }) {
      return React.createElement("div", { className: "dsau-stat" },
        React.createElement("p", { className: "dsau-stat-value" }, value),
        React.createElement("p", { className: "dsau-stat-label" }, label),
        hint === null || hint === undefined ? null : React.createElement("p", { className: "dsau-stat-hint" }, hint)
      );
    }

    const OVERVIEW_MODES = ["daily", "weekly", "cumulative"];

    function OverviewPanel({ t }) {
      const [state, setState] = React.useState({ kind: "loading" });
      const [year, setYear] = React.useState(() => new Date().getFullYear());
      const [mode, setMode] = React.useState("daily");
      const [tip, setTip] = React.useState(null);
      const [tipBox, setTipBox] = React.useState(null);
      const tipRef = React.useRef(null);
      const pollCount = React.useRef(0);

      React.useEffect(() => {
        ensureOverviewStyles();
        ensureCalendarStyles();
      }, []);

      // force=true（手动刷新）让宿主立刻再扫一次，自动轮询则受宿主 60 秒节流约束。
      const load = React.useCallback(
        (force) =>
          fetchJson("/api/account-usage/insights" + (force === true ? "?force=1" : ""))
            .then((body) => setState({ kind: "done", value: body }))
            .catch(() => setState({ kind: "failure", message: null })),
        []
      );

      React.useEffect(() => {
        load();
      }, [load]);

      // 热力图提示框：fixed 定位 + 视口夹紧，避免贴边时被设置面板的滚动容器裁切。
      React.useLayoutEffect(() => {
        if (tip === null) {
          if (tipBox !== null) setTipBox(null);
          return;
        }
        const el = tipRef.current;
        if (el === null) return;
        const next = clampTipPosition(tip.anchorX, tip.anchorY, el.offsetWidth, el.offsetHeight, window.innerWidth, 8);
        if (tipBox === null || tipBox.left !== next.left || tipBox.top !== next.top) setTipBox(next);
      }, [tip, tipBox]);

      const scanning = state.kind === "done" && state.value !== null && state.value.scanning === true;
      React.useEffect(() => {
        if (!scanning) {
          pollCount.current = 0;
          return undefined;
        }
        const id = window.setInterval(() => {
          if (pollCount.current >= 90) return;
          pollCount.current += 1;
          load(false);
        }, 2000);
        return () => window.clearInterval(id);
      }, [scanning, load]);

      const value = state.kind === "done" ? state.value : null;
      const supported = value === null || value.ok === true;
      const days = supported && value !== null && value.days !== null && typeof value.days === "object" ? value.days : {};
      const dataYears = supported && value !== null && Array.isArray(value.years) ? value.years : [];
      const currentYear = new Date().getFullYear();
      const yearOptions = [...new Set([...dataYears, currentYear])].filter((item) => Number.isInteger(item)).sort((a, b) => b - a);
      const activeYear = yearOptions.includes(year) ? year : yearOptions[0];

      const scale = t("numberScale");
      const durationUnits = {
        day: t("durationDay"),
        hour: t("durationHour"),
        minute: t("durationMinute"),
        second: t("durationSecond")
      };
      const totalTokens = sumYearTokens(days, activeYear);
      const peak = peakOfYear(days, activeYear);
      const longestStreak = longestStreakOfYear(days, activeYear);
      const streakNow = activeYear === currentYear ? currentStreakOfDays(days, todayDate()) : null;
      const longestTaskMs =
        value !== null && value.longestTurnMsByYear !== null && typeof value.longestTurnMsByYear === "object"
          ? value.longestTurnMsByYear[String(activeYear)]
          : undefined;

      const grid = React.useMemo(() => buildYearWeeks(activeYear), [activeYear]);
      const weeks = grid.weeks;
      const weeklyTotals = React.useMemo(() => weekTotalsOf(days, weeks), [days, weeks]);
      const cumulative = React.useMemo(() => cumulativeByDay(days, weeks), [days, weeks]);
      const todayKey = todayDate();
      // 每周 / 累计总量都按「一列填几格 = 那周有几天用过」着色，单元格共享列色。
      const activeDays = React.useMemo(() => weekActiveDaysOf(days, weeks), [days, weeks]);
      const weekCumulative = React.useMemo(
        () => weekCumulativeOf(weeks, cumulative, todayKey),
        [weeks, cumulative, todayKey]
      );
      // 每列代表日，供累计模式的提示框使用（与 weekCumulative 同一口径）。
      const weekLastKeys = React.useMemo(() => weekLastKeyOf(weeks, todayKey), [weeks, todayKey]);
      // 悬停提示里的数值必须与着色口径一致：每周=所在周合计，累计=该周末的累计值，
      // 这样同一列里任何一格读到的数字都相同，不会出现「颜色一样、数字却逐格变化」。
      const cellValueOf = React.useCallback(
        (key, weekIndex) => {
          if (mode === "weekly") return weeklyTotals[weekIndex] ?? 0;
          if (mode === "cumulative") return weekCumulative[weekIndex] ?? 0;
          const raw = days[key];
          return typeof raw === "number" && raw > 0 ? raw : 0;
        },
        [mode, weeklyTotals, weekCumulative, days]
      );
      // 色阶阈值只由「真正会着色的值」决定：每周模式用周合计、累计模式用周末累计值。
      // 每天模式不再参与动态分位——改用 DAILY_LEVEL_BOUNDS 固定分级，颜色含义跨年度稳定。
      const thresholds = React.useMemo(() => {
        if (mode === "weekly") {
          // 只有「本周至少有一天有用量」的列才会着色，阈值也只看这些列的周合计。
          return quantileThresholds(activeDays.map((count, weekIndex) => (count > 0 ? weeklyTotals[weekIndex] ?? 0 : 0)));
        }
        if (mode === "cumulative") {
          return quantileThresholds(activeDays.map((count, weekIndex) => (count > 0 ? weekCumulative[weekIndex] ?? 0 : 0)));
        }
        // daily：动态阈值不再被着色逻辑使用，但保留计算供 tooltip 等处兜底引用。
        const inYear = weeks.flat().filter((cell) => cell.inYear);
        return quantileThresholds(inYear.map((cell) => (typeof days[cell.key] === "number" ? days[cell.key] : 0)));
      }, [mode, weeks, weeklyTotals, weekCumulative, activeDays, days]);
      // 行号查表：key → 该格在本列中的行号（0 = 周一 … 6 = 周日）。
      const rowOf = React.useMemo(() => {
        const map = new Map();
        for (const cells of weeks) cells.forEach((cell, index) => map.set(cell.key, index));
        return (key) => map.get(key) ?? null;
      }, [weeks]);
      const levelContext = { days, weeklyTotals, weekCumulative, cumulative, thresholds, dailyThresholds: DAILY_LEVEL_BOUNDS, todayKey, activeDays, rowOf };

      const monthNames = String(t("heatmapMonths")).split(",");
      // 月份刻度：按「该月首日所在列」定位；列很窄时按最小列距抽稀，避免相邻月份标签挤在一起。
      const monthAnchors = [];
      for (let month = 1; month <= 12; month += 1) {
        const firstKey = `${activeYear}-${String(month).padStart(2, "0")}-01`;
        const weekIndex = weeks.findIndex((cells) => cells.some((cell) => cell.key === firstKey));
        if (weekIndex < 0) continue;
        monthAnchors.push({ month, weekIndex });
      }
      // 一年拆成两行：设置面板内只有约 530px，53 列挤一行每格不足 7px，
      // 拆成两块后每格约 16px，与官方参考图的圆角方块比例一致。
      const weekBlocks = splitWeekColumns(weeks, 2);

      const showTip = (event, cell, weekIndex) => {
        const rect = event.currentTarget.getBoundingClientRect();
        const unit = t("heatmapValueUnit");
        // 数值按面板同一套量级缩写（5.4亿 / 1.5M），与官方平台提示框一致。
        const tokens = `${formatTokenCount(cellValueOf(cell.key, weekIndex), scale)} ${unit}`;
        // 第一行描述（日期 / 所在周 / 累计至），第二行是带单位的数值，与官方平台一致。
        // 每周与累计都按「整列」聚合，所以提示里的日期也用该列的代表日（周末），
        // 而不是鼠标停留的那一格，避免同一列各格给出不同数字。
        const lastKey = weekLastKeys[weekIndex];
        // 每年第一列会带上前一年的日期，提示里要跳过它，否则会显示成上一年的一天。
        const firstInYear = weeks[weekIndex].find((c) => c.inYear) ?? weeks[weekIndex][0];
        const caption =
          mode === "weekly"
            ? t("heatmapWeekTip").replace("{date}", fmtSlashDate(firstInYear.key))
            : mode === "cumulative"
              ? t("heatmapCumulativeTip").replace("{date}", fmtSlashDate(lastKey ?? cell.key))
              : t("heatmapDayTip").replace("{date}", fmtSlashDate(cell.key));
        setTip({ anchorX: rect.left + rect.width / 2, anchorY: rect.top, caption, value: tokens });
      };

      const modeLabels = {
        daily: t("heatmapDaily"),
        weekly: t("heatmapWeekly"),
        cumulative: t("heatmapCumulative")
      };

      const yearSelect = React.createElement("span", { className: "dsau-select" },
        React.createElement("select", {
          className: "dsau-select-input",
          value: String(activeYear),
          "aria-label": t("overviewYear"),
          onChange: (event) => setYear(Number(event.target.value))
        },
          yearOptions.map((item) =>
            React.createElement("option", { key: item, value: String(item) }, `${item}`)
          )
        ),
        React.createElement("span", { className: "dsau-select-icon" }, selectChevron())
      );

      const body =
        state.kind === "loading"
          ? React.createElement("p", { style: styles.hint }, t("loading"))
          : state.kind === "failure"
            ? React.createElement("p", { style: styles.error }, t("loadFailed"))
            : !supported
              ? React.createElement("p", { style: styles.hint }, t("overviewUnsupported"))
              : React.createElement(React.Fragment, null,
                // 只在后台扫描期间提示「统计中…」，平时不占用首屏空间。
                scanning ? React.createElement("p", { style: styles.hint }, t("overviewScanning")) : null,
                React.createElement(ModuleCard, { title: t("statsTitle") },
                  React.createElement("div", { className: "dsau-stats" },
                    React.createElement(OverviewStat, {
                      label: t("statTotalTokens"),
                      value: formatTokenCount(totalTokens, scale)
                    }),
                    React.createElement(OverviewStat, {
                      label: t("statPeakTokens"),
                      value: peak.tokens > 0 ? formatTokenCount(peak.tokens, scale) : t("noValue"),
                      hint: peak.date === null ? null : fmtSlashDate(peak.date)
                    }),
                    React.createElement(OverviewStat, {
                      label: t("statLongestTask"),
                      value: typeof longestTaskMs === "number" ? formatDurationMs(longestTaskMs, durationUnits) : t("noValue")
                    }),
                    React.createElement(OverviewStat, {
                      label: t("statLongestStreak"),
                      value: t("daysCount").replace("{n}", String(longestStreak))
                    }),
                    React.createElement(OverviewStat, {
                      label: t("statCurrentStreak"),
                      value: streakNow === null ? t("noValue") : t("daysCount").replace("{n}", String(streakNow))
                    })
                  ),
                  totalTokens === 0 ? React.createElement("p", { style: styles.hint }, t("overviewEmpty")) : null
                ),
                React.createElement(ModuleCard, { title: t("heatmapTitle") },
                  React.createElement("div", { style: styles.buttonsRow },
                    OVERVIEW_MODES.map((item) =>
                      React.createElement("button", {
                        key: item,
                        type: "button",
                        className: "dsau-heat-mode",
                        "data-active": mode === item ? "1" : "0",
                        onClick: () => setMode(item)
                      }, modeLabels[item])
                    )
                  ),
                  React.createElement("div", { className: "dsau-heat" },
                    // 每一块是「上半年 / 下半年」：各自带月份刻度与 7 行格子。
                    // weekIndex 一律用全年列号（block.startIndex + 块内下标），
                    // 这样每周聚合值、tooltip 日期都不受分块影响。
                    weekBlocks.map((block) =>
                      React.createElement("div", { key: `block-${block.startIndex}`, className: "dsau-heat-block" },
                        React.createElement("div", {
                          className: "dsau-heat-months",
                          style: { gridTemplateColumns: `repeat(${block.weeks.length}, minmax(0, 1fr))` }
                        },
                          thinMonthAnchors(
                            monthAnchors
                              .filter((anchor) => anchor.weekIndex >= block.startIndex
                                && anchor.weekIndex < block.startIndex + block.weeks.length)
                              .map((anchor) => ({ month: anchor.month, weekIndex: anchor.weekIndex - block.startIndex })),
                            4
                          ).map((anchor) =>
                            React.createElement("span", {
                              key: anchor.month,
                              className: "dsau-heat-month",
                              style: { gridColumnStart: anchor.weekIndex + 1 }
                            }, monthNames[anchor.month - 1] ?? String(anchor.month))
                          )
                        ),
                        React.createElement("div", {
                          className: "dsau-heat-grid",
                          style: { gridTemplateColumns: `repeat(${block.weeks.length}, minmax(0, 1fr))` }
                        },
                          block.weeks.map((cells, localIndex) => {
                            const weekIndex = block.startIndex + localIndex;
                            return cells.map((cell) =>
                              React.createElement("div", {
                                key: cell.key,
                                className: "dsau-heat-cell",
                                "data-hidden": cell.inYear ? undefined : "1",
                                "data-level": cell.inYear ? String(heatLevelOf(mode, cell.key, weekIndex, levelContext)) : undefined,
                                onMouseEnter: cell.inYear ? (event) => showTip(event, cell, weekIndex) : undefined,
                                onMouseLeave: () => setTip(null)
                              })
                            );
                          })
                        )
                      )
                    ),
                    // 图例：最左的灰色代表 0 Token，随后五档蓝依次代表用量由少到多
                    // （第 5 档 ≥5 亿为极值档，每周/累计模式下暂时不会出现）。
                    React.createElement("div", { className: "dsau-heat-legend" },
                      React.createElement("span", { className: "dsau-heat-legend-label" }, t("heatmapLess")),
                      ["0", "1", "2", "3", "4", "5"].map((level) =>
                        React.createElement("span", {
                          key: level,
                          className: "dsau-heat-legend-swatch",
                          "data-level": level
                        })
                      ),
                      React.createElement("span", { className: "dsau-heat-legend-label" }, t("heatmapMore"))
                    ),
                    tip === null
                      ? null
                      : React.createElement("div", {
                        ref: tipRef,
                        className: "dsau-heat-tip",
                        style: {
                          left: tipBox === null ? Math.round(tip.anchorX) : tipBox.left,
                          top: tipBox === null ? Math.round(tip.anchorY - 6) : tipBox.top
                        }
                      }, React.createElement("span", { className: "dsau-heat-tip-caption" }, tip.caption),
                        React.createElement("span", { className: "dsau-heat-tip-value" }, tip.value))
                  )
                )
              );

      return React.createElement("div", { style: styles.section },
        React.createElement("div", { style: styles.panelTitle },
          React.createElement("span", null, t("overviewTitle")),
          React.createElement("div", { style: styles.buttonsRow },
            yearSelect,
            React.createElement(RefreshButton, { onClick: load, t })
          )
        ),
        body
      );
    }

    // ---- 标签页跳转通道（0.5.1） -------------------------------------------
    // 账户菜单的「余额」入口是 DOM 事件监听器，AccountPage 在 React 树里，
    // 两者没有共同的 props 通路。这里用模块级一次性标记 + 订阅打通：
    // 写入后保留到被消费，AccountPage 挂载时消费一次，用户之后可自由切标签。
    let pendingAccountTab = null;
    const accountTabListeners = new Set();

    /**
     * 请求账号页切到指定标签。
     * 面板已挂载时由订阅者当场切过去；此时清掉标记，避免下次重新挂载时
     * 把早就用过的请求再消费一遍（跳转只应生效一次）。
     */
    function requestAccountTab(tab) {
      if (typeof tab !== "string" || tab === "") return;
      pendingAccountTab = tab;
      const listeners = Array.from(accountTabListeners);
      if (listeners.length === 0) return;
      for (const listener of listeners) {
        try {
          listener(tab);
        } catch {
          /* 单个订阅者失败不影响其余 */
        }
      }
      pendingAccountTab = null;
    }

    /** 取出并清空待处理的标签请求；没有则返回 null。 */
    function consumeAccountTabRequest() {
      const tab = pendingAccountTab;
      pendingAccountTab = null;
      return tab;
    }

    /** 订阅后续的标签请求（面板已挂载、停在别的标签时用）。返回取消函数。 */
    function subscribeAccountTabRequest(listener) {
      if (typeof listener !== "function") return () => {};
      accountTabListeners.add(listener);
      return () => {
        accountTabListeners.delete(listener);
      };
    }

    function AccountPage(props) {
      const { t, credApi, embedded } = props;
      // 挂载时消费一次性请求：从账户菜单余额入口进来会直接落在 DeepSeek 页；
      // 从设置齿轮 / 导航进入（没有待处理请求）时仍是默认的「概览」。
      const [tab, setTab] = React.useState(() => consumeAccountTabRequest() ?? "overview");
      // 设置面板本来就开着、停在概览页时再点余额，靠订阅切过去。
      React.useEffect(() => subscribeAccountTabRequest((next) => setTab(next)), []);
      // 两个面板常驻挂载（CSS 隐藏未激活项）：切换标签零等待，
      // 数据在后台按各自 60s 周期保持新鲜。
      // 嵌入官方账户页时隐藏独立页标题，并跟随官方内容宽度。
      return React.createElement("div", { style: embedded ? { ...styles.wrap, maxWidth: "none" } : styles.wrap },
        embedded ? null : React.createElement("h2", { style: styles.panelTitle }, t("title")),
        React.createElement("div", { style: styles.tabsRow },
          React.createElement("button", {
            style: tab === "overview" ? styles.tabActive : styles.tab,
            onClick: () => setTab("overview")
          }, t("tabOverview")),
          React.createElement("button", {
            style: tab === "deepseek" ? styles.tabActive : styles.tab,
            onClick: () => setTab("deepseek")
          }, t("tabDeepseek")),
          React.createElement("button", {
            style: tab === "opencode" ? styles.tabActive : styles.tab,
            onClick: () => setTab("opencode")
          }, t("tabOpencode"))
        ),
        React.createElement("div", { style: tab === "overview" ? { display: "block" } : { display: "none" } },
          React.createElement(OverviewPanel, { t })
        ),
        React.createElement("div", { style: tab === "deepseek" ? { display: "block" } : { display: "none" } },
          React.createElement(DeepSeekPanel, { credApi, t, visible: tab === "deepseek" })
        ),
        React.createElement("div", { style: tab === "opencode" ? { display: "block" } : { display: "none" } },
          React.createElement(OpencodePanel, { credApi, t })
        )
      );
    }

    function apply(ctx) {
      ctx.effect(() => ctx.locale.register(NS, { zh, en }), "dsh-account-usage: dictionaries");
      const t = ctx.locale.bind(NS);
      const credApi = createCredentialApi(ctx.remote);
      const injected = () => ({ t, credApi });
      const SECTION_ID = "account-usage";
      const OFFICIAL_ACCOUNT_SECTION_ID = "account";

      // ---- 官方账户页存在性探测 ------------------------------------------------
      // 官方「账号与余额」页由 dsh-client-ui-settings-account 在登录后注册
      // settings.section(id=account)。它存在时本插件不再注册独立分区，而是把
      // 内容嵌入该页；未登录/旧版没有官方页时才注册兜底分区，避免双重入口。
      const sectionEntries = () => {
        try {
          if (typeof ctx.slots.entries !== "function") return null;
          const entries = ctx.slots.entries("settings.section");
          return Array.isArray(entries) ? entries : null;
        } catch {
          return null;
        }
      };
      const sectionRows = () => {
        const entries = sectionEntries();
        if (entries === null) return null;
        return entries
          .map((entry) => ({
            id: entry?.options?.id,
            order: typeof entry?.options?.order === "number" ? entry.options.order : 0
          }))
          .sort((a, b) => a.order - b.order);
      };
      const hasSection = (id) => {
        const entries = sectionEntries();
        if (entries === null) return false;
        return entries.some((entry) => entry?.options?.id === id);
      };

      ctx.slots.inject("settings.section", () => {
        let stopped = false;
        let unregisterFallbackSection = null;
        const syncFallbackSection = () => {
          if (stopped) return;
          // 无法嵌入 React 内容时始终保留独立分区，保证功能可访问。
          const officialAccount = hasSection(OFFICIAL_ACCOUNT_SECTION_ID) && canEmbedReact;
          if (officialAccount) {
            unregisterFallbackSection?.();
            unregisterFallbackSection = null;
            return;
          }
          if (unregisterFallbackSection === null) {
            try {
              unregisterFallbackSection = ctx.slots.register(
                {
                  name: "settings.section",
                  // 官方账号与余额页使用 account；独立 ID 保证兜底页可单独注册。
                  id: SECTION_ID,
                  order: 45,
                  label: () => t("nav"),
                  icon: ACCOUNT_ICON,
                  locale: NS,
                  inject: injected
                },
                AccountPage
              );
            } catch {
              // 槽位在插件卸载后可能已不可用；保持无兜底状态即可。
              unregisterFallbackSection = null;
            }
          }
        };
        const disposers = [];
        if (typeof ctx.slots.subscribe === "function") {
          disposers.push(ctx.slots.subscribe("settings.section", syncFallbackSection));
        }
        syncFallbackSection();
        return () => {
          stopped = true;
          for (const dispose of disposers) {
            try {
              dispose();
            } catch {
              /* ignore cleanup failure */
            }
          }
          unregisterFallbackSection?.();
          unregisterFallbackSection = null;
        };
      });

      // 官方 0.2.2 起提供正式的分区导航图标插槽 settings.section.icon：
      // 注册 id 必须等于对应 settings.section 的 id，命中后壳层不再渲染默认齿轮。
      // 旧版壳没有该插槽，inject 静默不注册，继续由下面的 DOM 钩子兜底；
      // 两条路径靠 svg 上的 data-dsh-account-injected 标记互斥，不会重复绘制。
      ctx.slots.inject("settings.section.icon", () =>
        ctx.slots.register(
          {
            name: "settings.section.icon",
            id: "account-usage",
            order: 45,
            label: () => t("nav"),
            locale: NS
          },
          () => ACCOUNT_ICON
        )
      );

      // ---- 设置导航图标 / 账户菜单余额（运行时 DOM 增强） ----
      // 官方 settings.section.icon 插槽覆盖兜底分区图标；旧壳继续由 DOM 钩子兜底。
      // 账户菜单（settings.launcher 由官方账户插件占用）没有可插入菜单项的 Slot，
      // 这里在「设置」项上方插入「余额：¥x.xx」；点击后打开官方「账号与余额」页，
      // 官方页不可用时回退到本插件兜底分区。
      const SVG_NS = "http://www.w3.org/2000/svg";
      const ICON_MARK = "data-dsh-account-injected";
      const NAV_ATTR = "data-dsh-account-usage-nav";
      const BALANCE_ATTR = "data-dsh-account-balance";
      const BALANCE_LABEL_ATTR = "data-dsh-account-balance-label";
      const MENU_STYLE_ID = "dsh-account-usage/menu.css";
      const normalizeText = (value) => String(value ?? "").replace(/\s+/g, " ").trim();
      const MENU_CSS = [
        ".dsh-account-balance-item{display:flex;align-items:center;gap:6px;width:100%;min-height:34px;padding:6px 8px;border:none;border-radius:var(--dsw-radius-md);background:transparent;cursor:pointer;font:inherit;font-size:13px;line-height:20px;color:var(--dsw-alias-label-primary);text-align:left}",
        ".dsh-account-balance-item:hover:not(:disabled),.dsh-account-balance-item:focus-visible{background:var(--dsw-alias-interactive-bg-hover);outline:none}",
        ".dsh-account-balance-item:disabled{opacity:.4;cursor:not-allowed}",
        ".dsh-account-balance-icon{display:inline-flex;flex:none;width:16px;height:16px;align-items:center;justify-content:center;color:var(--dsw-alias-menu-icon)}",
        ".dsh-account-balance-label{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-variant-numeric:tabular-nums}"
      ].join("\n");

      const makeIcon = () => {
        const svg = document.createElementNS(SVG_NS, "svg");
        svg.setAttribute("viewBox", "0 0 16 16");
        svg.setAttribute("width", "16");
        svg.setAttribute("height", "16");
        svg.setAttribute("aria-hidden", "true");
        svg.setAttribute(ICON_MARK, "1");
        svg.style.display = "block";
        const addPath = (d) => {
          const p = document.createElementNS(SVG_NS, "path");
          p.setAttribute("fill", "currentColor");
          p.setAttribute("d", d);
          svg.appendChild(p);
        };
        addPath(ACCOUNT_ICON_D1);
        addPath(ACCOUNT_ICON_D2);
        return svg;
      };

      const alreadyOurs = (btn) => {
        const svg = btn.querySelector("svg[" + ICON_MARK + "]");
        if (!svg) return false;
        const first = svg.querySelector("path");
        return !!(first && first.getAttribute("d") === ACCOUNT_ICON_D1);
      };

      /** 设置面板对话框（优先精确匹配 settings 模态，旧壳退回首个 dialog）。 */
      const findSettingsDialog = () =>
        document.querySelector('[role="dialog"][data-shortcut-modal="settings"]') ||
        document.querySelector('[role="dialog"]');

      /** settings.section 条目下标；null 表示旧运行时无 entries。 */
      const sectionIndexById = (id) => {
        const rows = sectionRows();
        if (rows === null) return null;
        return rows.findIndex((row) => row.id === id);
      };

      /** 按 section id 定位设置导航行；索引不可用时按已知文案兜底。 */
      const navButtonForSection = (id) => {
        if (typeof document === "undefined") return null;
        const dialog = findSettingsDialog();
        if (dialog === null) return null;
        const buttons = Array.from(dialog.querySelectorAll("nav button"));
        if (buttons.length === 0) return null;
        const index = sectionIndexById(id);
        if (index !== null && index >= 0 && index < buttons.length) return buttons[index];
        if (index !== null) return null;
        const labels =
          id === OFFICIAL_ACCOUNT_SECTION_ID
            ? ["账号与余额", "Account"]
            : [(() => {
                try {
                  return t("nav");
                } catch {
                  return "账户";
                }
              })()];
        const match = buttons.find((btn) =>
          labels.some((label) => normalizeText(btn.textContent) === normalizeText(label))
        );
        return match ?? null;
      };

      /** 给设置导航中的本插件兜底行注入图标；返回该 nav button（找不到返回 null）。 */
      const paintNavIcons = () => {
        if (typeof document === "undefined") return null;
        let label;
        try {
          label = t("nav");
        } catch {
          label = undefined;
        }
        const dialog = findSettingsDialog();
        if (dialog === null) return null;
        const buttons = Array.from(dialog.querySelectorAll("nav button"));
        for (const btn of buttons) btn.removeAttribute(NAV_ATTR);
        let target = null;
        const index = sectionIndexById(SECTION_ID);
        if (index !== null && index >= 0 && index < buttons.length) target = buttons[index];
        if (target === null && label) {
          const matches = buttons.filter((btn) => normalizeText(btn.textContent) === normalizeText(label));
          // 同名分区时取最后一个；条目列表可用但本插件尚未注册时无法确认归属，
          // 跳过以免误改官方图标。旧运行时（无 slots.entries）退回按文本匹配。
          if (matches.length >= 2) target = matches[matches.length - 1];
          else if (matches.length === 1 && (index === null || alreadyOurs(matches[0]))) target = matches[0];
        }
        if (target === null) return null;
        target.setAttribute(NAV_ATTR, "1");
        if (alreadyOurs(target)) return target;
        const children = Array.from(target.children);
        const labelIdx = label
          ? children.findIndex(
              (child) => child.tagName === "SPAN" && normalizeText(child.textContent) === normalizeText(label)
            )
          : children.length - 1;
        const slot = labelIdx > 0 ? children[labelIdx - 1] : null;
        if (slot === null) return target;
        const icon = makeIcon();
        if (slot.tagName === "SVG") {
          slot.replaceWith(icon);
        } else {
          while (slot.firstChild) slot.removeChild(slot.firstChild);
          slot.appendChild(icon);
        }
        return target;
      };

      ctx.effect(() => {
        if (typeof document === "undefined" || typeof MutationObserver === "undefined") {
          return () => {};
        }
        paintNavIcons();
        const observer = new MutationObserver(() => {
          paintNavIcons();
        });
        observer.observe(document.body, { childList: true, subtree: true, characterData: true });
        return () => observer.disconnect();
      }, "dsh-account-usage: settings nav icon injection");

      // —— 账户菜单余额入口 ——
      let balanceState = { at: 0, body: null, loading: false };
      const attachedRows = new Set();

      const paintBalanceRow = (row, body) => {
        const labelNode = row.querySelector("[" + BALANCE_LABEL_ATTR + "]");
        const text = balanceTextOf(body, t);
        if (labelNode && labelNode.textContent !== text) labelNode.textContent = text;
        row.setAttribute("aria-label", `${text} ${t("menuOpenAccount")}`);
        row.title = `${t("menuBalanceTitle")} · ${t("menuOpenAccount")}`;
      };

      const paintAttachedBalanceRows = () => {
        for (const row of Array.from(attachedRows)) {
          if (row.isConnected) paintBalanceRow(row, balanceState.body);
          else attachedRows.delete(row);
        }
      };

      const refreshBalance = () => {
        if (balanceState.loading) return;
        if (balanceState.body !== null && Date.now() - balanceState.at < 30000) {
          paintAttachedBalanceRows();
          return;
        }
        balanceState.loading = true;
        fetchJson("/api/account-usage/deepseek-summary")
          .then((body) => {
            balanceState = { at: Date.now(), body, loading: false };
            paintAttachedBalanceRows();
          })
          .catch(() => {
            balanceState = { at: Date.now(), body: { ok: false }, loading: false };
            paintAttachedBalanceRows();
          });
      };

      const makeBalanceIcon = () => {
        const svg = document.createElementNS(SVG_NS, "svg");
        svg.setAttribute("viewBox", "0 0 1024 1024");
        svg.setAttribute("width", "16");
        svg.setAttribute("height", "16");
        svg.setAttribute("fill", "none");
        svg.setAttribute("aria-hidden", "true");
        svg.setAttribute("focusable", "false");
        svg.style.display = "block";
        const addPath = (d) => {
          const p = document.createElementNS(SVG_NS, "path");
          p.setAttribute("fill", "currentColor");
          p.setAttribute("d", d);
          svg.appendChild(p);
        };
        // 图标来源：assets/icons/balance.svg（余额图标，¥ 圆形，1024 viewBox）。
        // 这里内联 path，避免运行时依赖静态资源 URL；fill 改为 currentColor 以跟随主题。
        addPath(
          "M491.530806 968.943057c-237.409085 0-430.567339-193.158255-430.567339-430.567339S254.121721 107.808378 491.530806 107.808378s430.567339 193.158255 430.567339 430.567339S728.939891 968.943057 491.530806 968.943057zM491.530806 170.540118c-202.817242 0-367.835599 165.018358-367.835599 367.835599s165.018358 367.835599 367.835599 367.835599S859.366406 741.192959 859.366406 538.375717 694.348048 170.540118 491.530806 170.540118z"
        );
        addPath(
          "M606.641497 670.333098 376.440581 670.333098c-17.316387 0-31.366382-14.048971-31.366382-31.366382s14.048971-31.366382 31.366382-31.366382l230.200916 0c17.316387 0 31.366382 14.048971 31.366382 31.366382S623.957885 670.333098 606.641497 670.333098z"
        );
        addPath(
          "M627.592668 575.806211 355.468944 575.806211c-17.316387 0-31.366382-14.048971-31.366382-31.366382s14.048971-31.366382 31.366382-31.366382l272.124747 0c17.316387 0 31.366382 14.048971 31.366382 31.366382S644.909056 575.806211 627.592668 575.806211z"
        );
        addPath(
          "M491.530806 766.228145c-17.316387 0-31.366382-14.048971-31.366382-31.366382L460.164425 479.646128c0-17.316387 14.048971-31.366382 31.366382-31.366382 17.316387 0 31.366382 14.048971 31.366382 31.366382l0 255.215636C522.896164 752.179175 508.847194 766.228145 491.530806 766.228145z"
        );
        addPath(
          "M491.530806 516.362354c-8.024767 0-16.050558-3.062755-22.177092-9.18929L366.455159 404.254044c-12.252045-12.252045-12.252045-32.101115 0-44.353161s32.101115-12.252045 44.353161 0l102.899578 102.920044c12.252045 12.252045 12.252045 32.101115 0 44.353161C507.581364 513.299599 499.555573 516.362354 491.530806 516.362354z"
        );
        addPath(
          "M491.285213 516.362354c-8.024767 0-16.050558-3.062755-22.177092-9.18929-12.252045-12.252045-12.252045-32.101115 0-44.353161l108.739587-108.760053c12.252045-12.252045 32.101115-12.252045 44.353161 0 12.252045 12.252045 12.252045 32.101115 0 44.353161L513.462305 507.173065C507.33577 513.299599 499.311003 516.362354 491.285213 516.362354z"
        );
        return svg;
      };

      const findSettingsMenuItem = (menu) => {
        if (!(menu instanceof Element)) return null;
        const items = Array.from(menu.querySelectorAll('button[role="menuitem"]')).filter(
          (item) => !item.hasAttribute(BALANCE_ATTR)
        );
        if (items.length === 0) return null;
        const match = items.find((item) => {
          const text = normalizeText(item.textContent);
          const shortcut = item.getAttribute("aria-keyshortcuts") ?? "";
          return /设置|Settings/i.test(text) || /Comma/i.test(shortcut);
        });
        return match ?? items[0] ?? null;
      };

      /** 余额入口应打开的设置分区：官方账户页优先，否则回退兜底页。 */
      const preferredAccountSectionId = () =>
        hasSection(OFFICIAL_ACCOUNT_SECTION_ID) && canEmbedReact
          ? OFFICIAL_ACCOUNT_SECTION_ID
          : SECTION_ID;

      const activatePreferredAccountSection = (attempt = 0) => {
        if (typeof document === "undefined" || typeof window === "undefined") return;
        const target = navButtonForSection(preferredAccountSectionId());
        if (target !== null) {
          if (target.getAttribute("aria-current") !== "true") target.click();
          return;
        }
        if (attempt < 40) window.setTimeout(() => activatePreferredAccountSection(attempt + 1), 50);
      };

      const openAccountSection = (menu) => {
        if (typeof document === "undefined") return;
        if (findSettingsDialog() === null) {
          const item = findSettingsMenuItem(menu);
          if (item !== null) {
            item.click();
          } else {
            // 旧版壳层没有账户菜单时，回退到设置齿轮触发器。
            const gear = document.querySelector('[data-slot="settings.launcher"] button[aria-haspopup="dialog"]');
            if (gear !== null) gear.click();
          }
        }
        activatePreferredAccountSection(0);
      };

      const createBalanceRow = () => {
        const row = document.createElement("button");
        row.type = "button";
        row.className = "dsh-account-balance-item";
        row.setAttribute("role", "menuitem");
        row.setAttribute(BALANCE_ATTR, "1");
        const icon = document.createElement("span");
        icon.className = "dsh-account-balance-icon";
        icon.appendChild(makeBalanceIcon());
        const label = document.createElement("span");
        label.className = "dsh-account-balance-label";
        label.setAttribute(BALANCE_LABEL_ATTR, "1");
        label.textContent = t("menuBalance") + "…";
        row.appendChild(icon);
        row.appendChild(label);
        row.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          // 先登记标签请求再打开设置：AccountPage 挂载时会消费它，
          // 因此余额入口总是落在 DeepSeek 标签页（官方嵌入页与兜底分区都走同一组件）。
          requestAccountTab("deepseek");
          openAccountSection(row.closest('[role="menu"]'));
        });
        return row;
      };

      const injectMenuStyles = () => {
        // 与 ensureCalendarStyles 同理：热更新后旧样式表还在，内容不一致就覆盖。
        const existing = document.querySelector('style[data-plugin-css="' + MENU_STYLE_ID + '"]');
        if (existing !== null) {
          if (existing.textContent !== MENU_CSS) existing.textContent = MENU_CSS;
          return;
        }
        const style = document.createElement("style");
        style.dataset.plugin = "dsh-account-usage";
        style.dataset.pluginCss = MENU_STYLE_ID;
        style.textContent = MENU_CSS;
        document.head.appendChild(style);
      };

      const findLauncherTrigger = () => {
        const triggers = document.querySelectorAll('[data-slot="settings.launcher"] [aria-haspopup="menu"]');
        for (const trigger of triggers) {
          if (normalizeText(trigger.getAttribute("aria-expanded")) !== "true") continue;
          const rect = trigger.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) return trigger;
        }
        return null;
      };

      const findAccountMenu = (trigger) => {
        const triggerRect = trigger.getBoundingClientRect();
        const menus = Array.from(document.querySelectorAll('[role="menu"]'));
        let best = null;
        let bestScore = Infinity;
        for (const menu of menus) {
          const rect = menu.getBoundingClientRect();
          if (!(rect.width > 0 && rect.height > 0)) continue;
          // 账户菜单由 Menu 的 side=top 渲染：底边贴近触发器顶边，左对齐（或至少水平重叠）。
          const vertical = Math.abs(triggerRect.top - rect.bottom);
          const horizontal = Math.abs(triggerRect.left - rect.left);
          const overlap = rect.left < triggerRect.right && rect.right > triggerRect.left;
          const score = vertical + horizontal;
          if (vertical <= 14 && (horizontal <= 28 || overlap) && score < bestScore) {
            best = menu;
            bestScore = score;
          }
        }
        if (best !== null) return best;
        // 几何兜底失败时按菜单内容识别（设置 + 反馈/退出/登录）。
        for (const menu of menus) {
          const texts = Array.from(menu.querySelectorAll('button[role="menuitem"]')).map(
            (item) => item.textContent ?? ""
          );
          if (
            texts.some((text) => /设置|Settings/i.test(text)) &&
            texts.some((text) => /反馈|Feedback|退出|Sign out|登录|Sign in/i.test(text))
          ) {
            return menu;
          }
        }
        return null;
      };

      const attachBalanceRow = (menu) => {
        const existing = menu.querySelector("[" + BALANCE_ATTR + "]");
        if (existing !== null) {
          attachedRows.add(existing);
          refreshBalance();
          return;
        }
        const viewport =
          Array.from(menu.children).find((child) => child.getAttribute("role") === "presentation") ?? menu;
        const firstNative = Array.from(viewport.querySelectorAll('button[role="menuitem"]')).find(
          (item) => !item.hasAttribute(BALANCE_ATTR)
        );
        const row = createBalanceRow();
        if (firstNative !== null && firstNative !== undefined) {
          const wrapper = firstNative.parentElement;
          if (wrapper !== null && wrapper !== viewport && viewport.contains(wrapper)) {
            viewport.insertBefore(row, wrapper);
          } else {
            viewport.insertBefore(row, firstNative);
          }
        } else {
          viewport.appendChild(row);
        }
        attachedRows.add(row);
        paintBalanceRow(row, balanceState.body);
        refreshBalance();
      };

      const scanAccountMenu = () => {
        injectMenuStyles();
        for (const row of Array.from(attachedRows)) {
          if (!row.isConnected) attachedRows.delete(row);
        }
        const trigger = findLauncherTrigger();
        if (trigger === null) return;
        const menu = findAccountMenu(trigger);
        if (menu !== null) attachBalanceRow(menu);
      };

      ctx.effect(() => {
        if (
          typeof document === "undefined" ||
          typeof window === "undefined" ||
          typeof MutationObserver === "undefined"
        ) {
          return () => {};
        }
        let scheduled = null;
        const schedule = () => {
          if (scheduled !== null) return;
          scheduled = window.setTimeout(() => {
            scheduled = null;
            scanAccountMenu();
          }, 0);
        };
        schedule();
        const observer = new MutationObserver(schedule);
        observer.observe(document.body, {
          childList: true,
          subtree: true,
          attributes: true,
          attributeFilter: ["aria-expanded"]
        });
        return () => {
          observer.disconnect();
          if (scheduled !== null) window.clearTimeout(scheduled);
        };
      }, "dsh-account-usage: account menu balance");

      // ---- 官方「账号与余额」页内容嵌入 --------------------------------------
      // 官方页面没有提供内容 Slot：把插件内容追加到官方 AccountSection 的
      // <section> 末尾（原生卡片下方），切到其他分区时仅摘除容器、保留 React
      // 根以保存 tab/区间；关闭设置面板时卸载根并停止轮询。
      const EMBED_ATTR = "data-dsh-account-usage-embedded";
      let embeddedRoot = null;
      let embeddedContainer = null;
      let embeddedSection = null;
      let destroyEmbeddedRoot = null;

      /** 当前激活的设置分区 id（按 settings.section 排序与导航行一一对应）。 */
      const activeSettingsSectionId = () => {
        if (typeof document === "undefined") return null;
        const dialog = findSettingsDialog();
        if (dialog === null) return null;
        const rows = sectionRows();
        if (rows === null || rows.length === 0) return null;
        const buttons = Array.from(dialog.querySelectorAll("nav button"));
        const activeIndex = buttons.findIndex((button) => button.getAttribute("aria-current") === "true");
        if (activeIndex < 0 || activeIndex >= rows.length) return null;
        return rows[activeIndex]?.id ?? null;
      };

      /** 官方账户页 AccountSection 根节点（[data-slot] outlet 内的 <section>）。 */
      const findActiveAccountSection = () => {
        if (typeof document === "undefined") return null;
        const dialog = findSettingsDialog();
        if (dialog === null) return null;
        const outlet = dialog.querySelector('[data-slot="settings.section"]');
        if (outlet === null) return null;
        const section = Array.from(outlet.children).find((child) => child.tagName === "SECTION");
        return section ?? null;
      };

      const renderEmbeddedContent = () => {
        if (embeddedContainer === null) return;
        try {
          const element = React.createElement(AccountPage, { t, credApi, embedded: true });
          if (embeddedRoot !== null) {
            embeddedRoot.render(element);
            return;
          }
          if (ReactDOMClient !== null && typeof ReactDOMClient.createRoot === "function") {
            embeddedRoot = ReactDOMClient.createRoot(embeddedContainer);
            destroyEmbeddedRoot = () => embeddedRoot?.unmount();
            embeddedRoot.render(element);
          } else if (ReactDOM !== null && typeof ReactDOM.render === "function") {
            embeddedRoot = {
              render: (next) => ReactDOM.render(next, embeddedContainer),
              unmount: () => ReactDOM.unmountComponentAtNode(embeddedContainer)
            };
            destroyEmbeddedRoot = () => embeddedRoot?.unmount();
            embeddedRoot.render(element);
          }
        } catch (error) {
          ctx.logger?.warn?.("dsh-account-usage: embedded account content render failed");
          ctx.logger?.warn?.(error);
        }
      };

      const attachEmbeddedContent = (section) => {
        if (!canEmbedReact) return;
        if (embeddedContainer === null) {
          embeddedContainer = document.createElement("div");
          embeddedContainer.setAttribute(EMBED_ATTR, "1");
          embeddedContainer.style.display = "contents";
        }
        if (embeddedSection !== section || embeddedContainer.parentNode !== section) {
          section.appendChild(embeddedContainer);
          embeddedSection = section;
        } else if (section.lastElementChild !== embeddedContainer) {
          section.appendChild(embeddedContainer);
        }
        if (embeddedRoot === null) renderEmbeddedContent();
      };

      const detachEmbeddedContent = () => {
        if (embeddedContainer !== null && embeddedContainer.parentNode !== null) {
          embeddedContainer.parentNode.removeChild(embeddedContainer);
        }
        embeddedSection = null;
      };

      const destroyEmbeddedContent = () => {
        detachEmbeddedContent();
        if (destroyEmbeddedRoot !== null) {
          try {
            destroyEmbeddedRoot();
          } catch {
            /* ignore unmount failure */
          }
          destroyEmbeddedRoot = null;
        }
        embeddedRoot = null;
        embeddedContainer = null;
      };

      const scanEmbeddedContent = () => {
        if (typeof document === "undefined") return;
        if (!canEmbedReact) {
          detachEmbeddedContent();
          return;
        }
        const dialog = findSettingsDialog();
        if (dialog === null) {
          destroyEmbeddedContent();
          return;
        }
        if (
          activeSettingsSectionId() !== OFFICIAL_ACCOUNT_SECTION_ID ||
          !hasSection(OFFICIAL_ACCOUNT_SECTION_ID)
        ) {
          detachEmbeddedContent();
          return;
        }
        const section = findActiveAccountSection();
        if (section === null) {
          detachEmbeddedContent();
          return;
        }
        attachEmbeddedContent(section);
      };

      ctx.effect(() => {
        if (
          typeof document === "undefined" ||
          typeof window === "undefined" ||
          typeof MutationObserver === "undefined"
        ) {
          return () => {};
        }
        let scheduled = null;
        const schedule = () => {
          if (scheduled !== null) return;
          scheduled = window.setTimeout(() => {
            scheduled = null;
            scanEmbeddedContent();
          }, 0);
        };
        schedule();
        const observer = new MutationObserver(schedule);
        observer.observe(document.body, {
          childList: true,
          subtree: true,
          attributes: true,
          attributeFilter: ["aria-current", "data-shortcut-modal"]
        });
        let disposeLocale = null;
        if (typeof ctx.locale.subscribe === "function") {
          disposeLocale = ctx.locale.subscribe(() => {
            if (embeddedRoot !== null) renderEmbeddedContent();
          });
        }
        return () => {
          observer.disconnect();
          if (scheduled !== null) window.clearTimeout(scheduled);
          if (typeof disposeLocale === "function") disposeLocale();
          destroyEmbeddedContent();
        };
      }, "dsh-account-usage: official account page embedding");
    }

    exports.NS = NS;
    exports.apply = apply;
    exports.inject = inject;
    exports.createCredentialApi = createCredentialApi;
    exports.unwrapRpc = unwrapRpc;
    exports.BarChart = BarChart;
    exports.TokenChart = TokenChart;
    exports.TokenLegend = TokenLegend;
    exports.TOKEN_COLORS = TOKEN_COLORS;
    exports.tokenTooltipRow = tokenTooltipRow;
    exports.fmtCountdown = fmtCountdown;
    exports.balanceTextOf = balanceTextOf;
    exports.toolLabelOf = toolLabelOf;
    // 区间日历与合计口径的纯函数（0.5.0，供单测锁定边界）
    exports.isDateKey = isDateKey;
    exports.addMonths = addMonths;
    exports.buildMonthGrid = buildMonthGrid;
    exports.weekdayLabels = weekdayLabels;
    exports.formatMonthTitle = formatMonthTitle;
    exports.normalizeRange = normalizeRange;
    exports.isFutureDate = isFutureDate;
    exports.monthOfDateKey = monthOfDateKey;
    exports.shiftMonthKey = shiftMonthKey;
    exports.startOfWeekKey = startOfWeekKey;
    exports.endOfWeekKey = endOfWeekKey;
    exports.previewRange = previewRange;
    exports.bandKind = bandKind;
    exports.combinedTotals = combinedTotals;
    exports.CALENDAR_CSS = CALENDAR_CSS;
    exports.ensureCalendarStyles = ensureCalendarStyles;
    exports.yearOfDayKey = yearOfDayKey;
    exports.dayKeysOfYear = dayKeysOfYear;
    exports.sumYearTokens = sumYearTokens;
    exports.peakOfYear = peakOfYear;
    exports.longestStreakOfYear = longestStreakOfYear;
    exports.currentStreakOfDays = currentStreakOfDays;
    exports.buildYearWeeks = buildYearWeeks;
    exports.weekTotalsOf = weekTotalsOf;
    exports.thinMonthAnchors = thinMonthAnchors;
    exports.splitWeekColumns = splitWeekColumns;
    exports.MAX_RANGE_MONTHS = MAX_RANGE_MONTHS;
    exports.monthIndexKey = monthIndexKey;
    exports.monthSpanOf = monthSpanOf;
    exports.withinMonthLimit = withinMonthLimit;
    exports.clampRangeToMonths = clampRangeToMonths;
    exports.requestAccountTab = requestAccountTab;
    exports.consumeAccountTabRequest = consumeAccountTabRequest;
    exports.subscribeAccountTabRequest = subscribeAccountTabRequest;
    exports.cumulativeByDay = cumulativeByDay;
    exports.weekActiveDaysOf = weekActiveDaysOf;
    exports.weekCumulativeOf = weekCumulativeOf;
    exports.weekLastKeyOf = weekLastKeyOf;
    exports.quantileThresholds = quantileThresholds;
    exports.DAILY_LEVEL_BOUNDS = DAILY_LEVEL_BOUNDS;
    exports.levelOfValue = levelOfValue;
    exports.heatLevelOf = heatLevelOf;
    exports.clampTipPosition = clampTipPosition;
    exports.ensureOverviewStyles = ensureOverviewStyles;
    exports.OVERVIEW_CSS = OVERVIEW_CSS;
    exports.formatTokenCount = formatTokenCount;
    exports.formatDurationMs = formatDurationMs;
    exports.OverviewPanel = OverviewPanel;
    exports.CalendarMonth = CalendarMonth;
    exports.CalendarPanel = CalendarPanel;
    exports.DeepSeekPanel = DeepSeekPanel;
    exports.AccountPage = AccountPage;
    exports.RangeSelector = RangeSelector;
    // 用量趋势相关纯函数（供单测锁定格式与坐标系换算）
    exports.fmtCompactCount = fmtCompactCount;
    exports.fmtPercent = fmtPercent;
    exports.parseLocalDateKey = parseLocalDateKey;
    exports.OpenCodeTrendChart = OpenCodeTrendChart;
    exports.OpenCodeModelsCard = OpenCodeModelsCard;
    exports.OpenCodeTrendCard = OpenCodeTrendCard;
    exports.ConsoleCookieEditor = ConsoleCookieEditor;
    return module.exports;
  }
});

// client reload probe 1795057302
