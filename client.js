// Client half of the dsh-account-usage plugin.
// Hand-written browser bundle in the lazy-CJS format the client module loader
// expects: it only REGISTERS the factory; the body runs at materialization.
// It registers a settings.section entry ("账户") and renders the account page:
// DeepSeek platform balance/usage (chart, per-model table, time range) plus
// the OpenCode Go 5h/weekly/monthly quota. All data arrives from same-origin
// routes registered by the host half; secrets never enter the browser.
window.__ModuleLoader__.load({
  id: "dsh-account-usage",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
    const React = require("react");

    const NS = "settings.accountUsage";
    const inject = ["slots", "locale", "connection"];

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
      tabDeepseek: "deepseek",
      tabOpencode: "opencode go",
      deepseekPanel: "DeepSeek 平台",
      opencodePanel: "OpenCode Go",
      moduleToken: "会话令牌",
      moduleBalance: "账户余额",
      moduleUsage: "用量与图表",
      moduleModels: "模型明细",
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
      range90d: "近90天",
      rangeThisMonth: "本月",
      rangeLastMonth: "上月",
      rangeCustom: "自定义",
      rangeCustomRow: "自定义区间",
      rangeApply: "应用",
      rangeClipped: "区间超过单次可查询的月份上限，已自动裁剪至最近月份",
      totalsCost: "消费金额",
      totalsRequests: "API 请求次数",
      totalsTokens: "tokens",
      chartTitle: "消费金额柱状图",
      chartEmpty: "所选区间内暂无消费数据",
      tooltipTotal: "总消耗",
      tokenChartTitle: "Token 消耗柱状图",
      tokenChartEmpty: "所选区间内暂无 token 数据",
      legendMiss: "未命中输入",
      legendHit: "命中输入",
      legendOut: "输出",
      modelsTitle: "模型明细（所选区间）",
      modelsEmpty: "暂无模型数据",
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
      networkError: "网络请求失败，请稍后重试",
      badJson: "接口响应解析失败",
      httpError: "接口返回 HTTP {status}"
    };

    const en = {
      nav: "Account",
      title: "Account",
      tabDeepseek: "deepseek",
      tabOpencode: "opencode go",
      deepseekPanel: "DeepSeek Platform",
      opencodePanel: "OpenCode Go",
      moduleToken: "Session Token",
      moduleBalance: "Account Balance",
      moduleUsage: "Usage & Charts",
      moduleModels: "Model Details",
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
      range90d: "90 days",
      rangeThisMonth: "This month",
      rangeLastMonth: "Last month",
      rangeCustom: "Custom",
      rangeCustomRow: "Custom range",
      rangeApply: "Apply",
      rangeClipped: "Range exceeds the per-query month cap; clipped to the most recent months",
      totalsCost: "Spend",
      totalsRequests: "API requests",
      totalsTokens: "tokens",
      chartTitle: "Spend chart",
      chartEmpty: "No spend data in the selected range",
      tooltipTotal: "Total",
      tokenChartTitle: "Token usage chart",
      tokenChartEmpty: "No token data in the selected range",
      legendMiss: "Input (miss)",
      legendHit: "Cache hit",
      legendOut: "Output",
      modelsTitle: "Model details (selected range)",
      modelsEmpty: "No model data",
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
      networkError: "Network request failed, try again later",
      badJson: "Failed to parse the endpoint response",
      httpError: "Endpoint returned HTTP {status}"
    };

    const styles = {
      wrap: { maxWidth: 720, display: "flex", flexDirection: "column", gap: 18, padding: "8px 0" },
      panelTitle: { fontSize: 16, fontWeight: 600, margin: 0, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 },
      section: { display: "flex", flexDirection: "column", gap: 12 },
      hint: { color: "var(--dsw-alias-label-tertiary)", fontSize: 13, lineHeight: 1.6, margin: 0 },
      error: { color: "var(--dsw-alias-state-error-primary)", fontSize: 13, lineHeight: 1.6, margin: 0 },
      ok: { color: "var(--dsw-alias-state-success-primary)", fontSize: 12, lineHeight: 1.6, margin: 0 },
      card: { border: "1px solid var(--dsw-alias-border-l2)", background: "var(--dsw-alias-bg-layer-3)", borderRadius: 10, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 8 },
      moduleCard: { border: "1px solid var(--dsw-alias-border-l2)", background: "var(--dsw-alias-bg-layer-3)", borderRadius: 10, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 12 },
      moduleHeader: { display: "flex", alignItems: "center", gap: 8, borderBottom: "1px solid var(--dsw-alias-border-l2)", paddingBottom: 8 },
      moduleBar: { width: 3, height: 14, borderRadius: 2, background: "var(--dsw-alias-state-business-primary)", flexShrink: 0 },
      moduleTitle: { margin: 0, fontSize: 13, fontWeight: 600, color: "var(--dsw-alias-label-primary)" },
      statGridItem: { display: "flex", flexDirection: "column", gap: 4 },
      cardsGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 8 },
      statLabel: { color: "var(--dsw-alias-label-tertiary)", fontSize: 12, margin: 0 },
      statValue: { fontSize: 18, fontWeight: 600, margin: 0 },
      row: { display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--dsw-alias-label-secondary)", gap: 8 },
      button: { border: "1px solid var(--dsw-alias-border-l2)", color: "var(--dsw-alias-label-primary)", font: "inherit", cursor: "pointer", background: "transparent", borderRadius: 6, padding: "5px 12px" },
      buttonActive: { border: "1px solid var(--dsw-alias-state-business-primary)", color: "var(--dsw-alias-state-business-primary)", font: "inherit", cursor: "pointer", background: "transparent", borderRadius: 6, padding: "5px 12px" },
      buttonsRow: { display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" },
      input: { flex: 1, minWidth: 200, border: "1px solid var(--dsw-alias-border-l2)", background: "var(--dsw-alias-bg-layer-1)", color: "var(--dsw-alias-label-primary)", font: "inherit", borderRadius: 6, padding: "5px 10px" },
      dateInput: { border: "1px solid var(--dsw-alias-border-l2)", background: "var(--dsw-alias-bg-layer-1)", color: "var(--dsw-alias-label-primary)", font: "inherit", borderRadius: 6, padding: "4px 8px" },
      select: { border: "1px solid var(--dsw-alias-border-l2)", background: "var(--dsw-alias-bg-layer-1)", color: "var(--dsw-alias-label-primary)", font: "inherit", borderRadius: 6, padding: "5px 10px", cursor: "pointer", maxWidth: 200 },
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
      chartWrap: { position: "relative" },
      tooltip: { position: "absolute", zIndex: 6, background: "var(--dsw-alias-bg-layer-3)", border: "1px solid var(--dsw-alias-border-l2)", borderRadius: 8, padding: "6px 10px", fontSize: 12, lineHeight: 1.6, whiteSpace: "nowrap", pointerEvents: "none", boxShadow: "0 4px 16px rgb(0 0 0 / 0.25)" },
      tooltipTitle: { margin: 0, fontWeight: 600, color: "var(--dsw-alias-label-primary)", fontSize: 12 },
      tooltipRow: { margin: 0, color: "var(--dsw-alias-label-secondary)", fontSize: 12, fontVariantNumeric: "tabular-nums" },
      chip: { border: "1px solid var(--dsw-alias-border-l2)", color: "var(--dsw-alias-label-primary)", font: "inherit", cursor: "pointer", background: "transparent", borderRadius: 999, padding: "4px 12px", fontSize: 12 },
      chipActive: { border: "1px solid var(--dsw-alias-state-business-primary)", color: "var(--dsw-alias-state-business-primary)", font: "inherit", cursor: "pointer", background: "transparent", borderRadius: 999, padding: "4px 12px", fontSize: 12 },
      legendRow: { display: "flex", flexWrap: "wrap", gap: 14, alignItems: "center" },
      swatch: { display: "inline-block", width: 10, height: 10, borderRadius: 3, marginRight: 5, verticalAlign: -1 },
      tabsRow: { display: "flex", gap: 4, borderBottom: "1px solid var(--dsw-alias-border-l2)", marginBottom: 4 },
      tab: { border: "none", background: "transparent", color: "var(--dsw-alias-label-secondary)", font: "inherit", fontSize: 14, padding: "8px 14px", cursor: "pointer", borderBottom: "2px solid transparent", marginBottom: -1 },
      tabActive: { border: "none", background: "transparent", color: "var(--dsw-alias-label-primary)", font: "inherit", fontSize: 14, fontWeight: 600, padding: "8px 14px", cursor: "pointer", borderBottom: "2px solid var(--dsw-alias-state-business-primary)", marginBottom: -1 }
    };

    const OPENCODE_LIMITS = { rolling: "$12", weekly: "$30", monthly: "$60" };
    /** 「跳转」目标：官方对应页面（新标签页打开）。 */
    const DEEPSEEK_USAGE_PAGE_URL = "https://platform.deepseek.com/usage";
    const OPENCODE_GO_PAGE_URL = "https://opencode.ai/workspace/wrk_01KWW4E4FYP5MRWA0GVTQP5JA6/go";
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
      return [
        { id: "today", from: today, to: today },
        { id: "7d", from: addDays(today, -6), to: today },
        { id: "30d", from: addDays(today, -29), to: today },
        { id: "90d", from: addDays(today, -89), to: today },
        { id: "thisMonth", from: thisMonth.from, to: thisMonth.to },
        { id: "lastMonth", from: lastMonth.from, to: lastMonth.to }
      ];
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
      if (code === "network") return t("networkError");
      if (code === "bad-json") return t("badJson");
      if (typeof code === "string" && code.startsWith("http-")) {
        return t("httpError").replace("{status}", code.slice(5));
      }
      return typeof body.message === "string" && body.message !== "" ? body.message : t("loadFailed");
    }

    /**
     * connection.api 的 unary 方法返回 { rpcId, result: { ok, value|error } }
     * 信封；解出 result 分支，信封缺失返回 null（调用方按失败处理）。
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

    /** 分组卡片：标题栏（3px 主题色竖条 + 标题 + 底部分隔线）+ 内容区。 */
    function ModuleCard({ title, children }) {
      return React.createElement("div", { style: styles.moduleCard },
        React.createElement("div", { style: styles.moduleHeader },
          React.createElement("span", { style: styles.moduleBar }),
          React.createElement("p", { style: styles.moduleTitle }, title)
        ),
        children
      );
    }

    /** 无边框统计项（模块卡片内使用，避免“卡中卡”）。 */
    function StatGridItem({ label, value }) {
      return React.createElement("div", { style: styles.statGridItem },
        React.createElement("p", { style: styles.statLabel }, label),
        React.createElement("p", { style: styles.statValue }, value)
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
     */
    function ChartTooltip({ anchorIndex, count, wrapRef, children }) {
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
        const slot = (CHART_W - CHART_PAD_L - CHART_PAD_R) / count;
        const centerX = wrapRect.width * ((CHART_PAD_L + (anchorIndex + 0.5) * slot) / CHART_W);
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
          ? ((CHART_H - CHART_PAD_B) / CHART_H) * wrapRect.height + 6
          : aboveTop;
        setPos({ left, top });
      }, [anchorIndex, count, wrapRef]);
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
        // 按费用降序列出当日有明细的模型（flash/pro 通常在前）
        const rows = Object.keys(perModel)
          .map((name) => ({ name, cost: perModel[name].cost }))
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

    /** Token 柱状图分类色：未命中输入 / 命中输入 / 输出。 */
    const TOKEN_COLORS = {
      miss: "var(--dsw-alias-state-business-primary)",
      hit: "var(--dsw-alias-state-success-primary)",
      out: "var(--dsw-alias-state-warn-primary)"
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
        { key: "miss", v: s.miss, color: TOKEN_COLORS.miss },
        { key: "hit", v: s.hit, color: TOKEN_COLORS.hit },
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
          React.createElement("p", { style: styles.tooltipTitle }, s.date),
          React.createElement("p", { style: styles.tooltipRow }, `${t("legendMiss")}: ${fmtCount(s.miss)}`),
          React.createElement("p", { style: styles.tooltipRow }, `${t("legendHit")}: ${fmtCount(s.hit)}`),
          React.createElement("p", { style: styles.tooltipRow }, `${t("legendOut")}: ${fmtCount(s.out)}`),
          React.createElement("p", { style: { ...styles.tooltipRow, fontWeight: 600 } }, `${t("tooltipTotal")}: ${fmtCount(s.miss + s.hit + s.out)}`)
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

    /** Token 图图例。 */
    function TokenLegend({ t }) {
      return React.createElement("div", { style: styles.legendRow },
        React.createElement("span", { style: { color: "var(--dsw-alias-label-secondary)", fontSize: 12 } },
          React.createElement("span", { style: { ...styles.swatch, background: TOKEN_COLORS.miss } }), t("legendMiss")
        ),
        React.createElement("span", { style: { color: "var(--dsw-alias-label-secondary)", fontSize: 12 } },
          React.createElement("span", { style: { ...styles.swatch, background: TOKEN_COLORS.hit } }), t("legendHit")
        ),
        React.createElement("span", { style: { color: "var(--dsw-alias-label-secondary)", fontSize: 12 } },
          React.createElement("span", { style: { ...styles.swatch, background: TOKEN_COLORS.out } }), t("legendOut")
        )
      );
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
      "90d": "range90d",
      thisMonth: "rangeThisMonth",
      lastMonth: "rangeLastMonth"
    };

    function RangeSelector({ range, onApply, t }) {
      const [customFrom, setCustomFrom] = React.useState(range.from);
      const [customTo, setCustomTo] = React.useState(range.to);
      const [activePreset, setActivePreset] = React.useState("thisMonth");
      const applyPreset = (p) => {
        setActivePreset(p.id);
        setCustomFrom(p.from);
        setCustomTo(p.to);
        onApply({ from: p.from, to: p.to });
      };
      const applyCustom = () => {
        setActivePreset("custom");
        if (customFrom === "" || customTo === "") return;
        const from = customFrom <= customTo ? customFrom : customTo;
        const to = customFrom <= customTo ? customTo : customFrom;
        onApply({ from, to });
      };
      const onSelect = (e) => {
        const id = e.target.value;
        if (id === "custom") {
          // 仅切到自定义模式，区间在点击「应用」后生效
          setActivePreset("custom");
          return;
        }
        const p = presets().find((x) => x.id === id);
        if (p) applyPreset(p);
      };
      return React.createElement("div", { style: styles.section },
        React.createElement("div", { style: styles.buttonsRow },
          React.createElement("p", { style: styles.hint }, t("rangeTitle")),
          React.createElement("select", {
            value: activePreset,
            onChange: onSelect,
            style: styles.select,
            "aria-label": t("rangeTitle")
          },
            presets().map((p) =>
              React.createElement("option", { key: p.id, value: p.id }, t(PRESET_LABEL_KEYS[p.id]))
            ),
            React.createElement("option", { value: "custom" }, t("rangeCustom"))
          )
        ),
        React.createElement("div", { style: styles.buttonsRow },
          React.createElement("span", { style: styles.hint }, t("rangeCustomRow")),
          React.createElement("input", { type: "date", value: customFrom, onChange: (e) => setCustomFrom(e.target.value), style: styles.dateInput }),
          React.createElement("input", { type: "date", value: customTo, onChange: (e) => setCustomTo(e.target.value), style: styles.dateInput }),
          React.createElement("button", { style: styles.button, onClick: applyCustom }, t("rangeApply"))
        )
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
        load();
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

    function DeepSeekPanel({ credApi, t }) {
      const [summary, setSummary] = React.useState({ kind: "loading" });
      const [usage, setUsage] = React.useState({ kind: "loading" });
      const [range, setRange] = React.useState(() => {
        const p = presets()[4]; // 本月（默认）
        return { from: p.from, to: p.to };
      });

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
          setRange(r);
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

      return React.createElement("div", { style: styles.section },
        React.createElement("div", { style: styles.panelTitle },
          React.createElement("span", null, t("deepseekPanel")),
          React.createElement("div", { style: styles.buttonsRow },
            React.createElement(JumpButton, { url: DEEPSEEK_USAGE_PAGE_URL, t }),
            React.createElement(RefreshButton, { onClick: () => { loadSummary(); loadUsage(range); }, t })
          )
        ),
        // 模块一：会话令牌
        React.createElement(ModuleCard, { title: t("moduleToken") },
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
        // 模块三：用量与图表
        React.createElement(ModuleCard, { title: t("moduleUsage") },
          React.createElement(RangeSelector, { range, onApply: applyRange, t }),
          usage.kind === "loading"
            ? React.createElement("p", { style: styles.hint }, t("loading"))
            : usage.kind === "failure"
              ? React.createElement("p", { style: styles.error }, usage.message)
              : usage.value.ok !== true
                ? React.createElement("p", { style: styles.error }, errorText(usage.value, t))
                : React.createElement(React.Fragment, null,
                  usage.value.range?.clipped
                    ? React.createElement("p", { style: styles.hint }, t("rangeClipped"))
                    : null,
                  React.createElement("div", { style: styles.cardsGrid },
                    React.createElement(StatGridItem, { label: t("totalsCost"), value: fmtMoney(usage.value.totals?.cost, currency) }),
                    React.createElement(StatGridItem, { label: t("totalsRequests"), value: fmtCount(usage.value.totals?.requests) }),
                    React.createElement(StatGridItem, { label: t("totalsTokens"), value: fmtCount(usage.value.totals?.tokens) })
                  ),
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
                  )
                )
        ),
        // 模块四：模型明细
        React.createElement(ModuleCard, { title: t("moduleModels") },
          usage.kind === "loading"
            ? React.createElement("p", { style: styles.hint }, t("loading"))
            : usage.kind === "failure"
              ? React.createElement("p", { style: styles.error }, usage.message)
              : usage.value.ok !== true
                ? React.createElement("p", { style: styles.error }, errorText(usage.value, t))
                : React.createElement(ModelTable, { models: usage.value.models, currency, t })
        )
      );
    }

    function OpencodePanel({ t }) {
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
              React.createElement(RefreshButton, { onClick: load, t })
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
          React.createElement("p", { style: styles.error }, errorText(state.value, t))
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
        })
      );
    }

    function AccountPage(props) {
      const { t, credApi } = props;
      const [tab, setTab] = React.useState("deepseek");
      // 两个面板常驻挂载（CSS 隐藏未激活项）：切换标签零等待，
      // 数据在后台按各自 60s 周期保持新鲜。
      return React.createElement("div", { style: styles.wrap },
        React.createElement("h2", { style: styles.panelTitle }, t("title")),
        React.createElement("div", { style: styles.tabsRow },
          React.createElement("button", {
            style: tab === "deepseek" ? styles.tabActive : styles.tab,
            onClick: () => setTab("deepseek")
          }, t("tabDeepseek")),
          React.createElement("button", {
            style: tab === "opencode" ? styles.tabActive : styles.tab,
            onClick: () => setTab("opencode")
          }, t("tabOpencode"))
        ),
        React.createElement("div", { style: tab === "deepseek" ? { display: "block" } : { display: "none" } },
          React.createElement(DeepSeekPanel, { credApi, t })
        ),
        React.createElement("div", { style: tab === "opencode" ? { display: "block" } : { display: "none" } },
          React.createElement(OpencodePanel, { t })
        )
      );
    }

    function apply(ctx) {
      ctx.effect(() => ctx.locale.register(NS, { zh, en }), "dsh-account-usage: dictionaries");
      const t = ctx.locale.bind(NS);
      const connection = ctx.get("connection");
      const credApi = connection && connection.api && connection.api.credentials ? connection.api.credentials : null;
      const injected = () => ({ t, credApi });
      ctx.slots.inject("settings.section", () =>
        ctx.slots.register(
          {
            name: "settings.section",
            id: "account",
            order: 45,
            label: () => t("nav"),
            icon: ACCOUNT_ICON,
            locale: NS,
            inject: injected
          },
          AccountPage
        )
      );

      // ---- 设置导航图标兜底注入（保证在任意 DSH 安装上都显示本插件图标） ----
      // 上游 DSH 的 settings.section 目前不原生支持“每个分区自定义图标”：设置
      // 壳层的 navIcon() 只对 models / agent-presets / plugins 三个固定 id 有
      // 专属图标，其余分区一律渲染默认“设置”齿轮。为让本插件在任何 DSH 版本
      // （包括没有打过对应补丁、尚未合并上游特性）的安装上“装完即显示”账户
      // 图标，这里用一个健壮的运行时兜底：监听设置面板（[role=dialog] 内的
      // nav）的 DOM 变化，找到文本与本插件当前导航标签（随 DSH 语言切换）一致
      // 的导航行，把该行的图标元素替换为我们的“我的”SVG。
      // - 若所在 DSH 已原生支持分区 icon（壳层直接渲染了带 data-dsh-account-injected
      //   标记的图标），观察器识别后会跳过，不重复注入。
      // - 图标占位兼容两种壳层结构：旧壳层把图标包在 span 里（navIcon 占位
      //   span），新壳层（0.1.1-rc.2+）把图标渲染为裸 <svg>。定位方式不依赖
      //   具体标签：先按导航文本找到 label span，取它前一个兄弟作为图标槽。
      // - 壳层重渲染时 React 会重放齿轮，下一次 DOM 变更会再次注入，终态一致。
      ctx.effect(() => {
        if (typeof document === "undefined" || typeof MutationObserver === "undefined") {
          return () => {};
        }
        const SVG_NS = "http://www.w3.org/2000/svg";
        const ICON_MARK = "data-dsh-account-injected";
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
        const inject = () => {
          let label;
          try { label = t("nav"); } catch { label = undefined; }
          if (!label) return;
          const rows = document.querySelectorAll('[role="dialog"] nav button');
          for (let i = 0; i < rows.length; i++) {
            const btn = rows[i];
            if (btn.textContent.replace(/\s+/g, " ").trim() !== label) continue;
            if (alreadyOurs(btn)) continue;
            // 图标槽 = 导航 label span 的前一个兄弟；找不到 label span 时，
            // 若首个子元素不是 span（裸 svg 结构）也视作图标槽直接替换。
            const children = Array.from(btn.children);
            const labelIdx = children.findIndex(
              (c) => c.tagName === "SPAN" && c.textContent.replace(/\s+/g, " ").trim() === label
            );
            const slot = labelIdx > 0 ? children[labelIdx - 1] : null;
            if (!slot) continue;
            const icon = makeIcon();
            if (slot.tagName === "SVG") {
              slot.replaceWith(icon);
            } else {
              while (slot.firstChild) slot.removeChild(slot.firstChild);
              slot.appendChild(icon);
            }
          }
        };
        inject();
        const mo = new MutationObserver(inject);
        mo.observe(document.body, { childList: true, subtree: true, characterData: true });
        return () => mo.disconnect();
      }, "dsh-account-usage: settings nav icon injection");
    }

    exports.NS = NS;
    exports.apply = apply;
    exports.inject = inject;
    exports.unwrapRpc = unwrapRpc;
    exports.BarChart = BarChart;
    exports.TokenChart = TokenChart;
    exports.fmtCountdown = fmtCountdown;
    return module.exports;
  }
});
