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

    const zh = {
      nav: "账户",
      title: "账户",
      deepseekPanel: "DeepSeek 平台",
      opencodePanel: "OpenCode Go",
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
      rangeApply: "应用",
      rangeClipped: "区间超过单次可查询的月份上限，已自动裁剪至最近月份",
      totalsCost: "消费金额",
      totalsRequests: "API 请求次数",
      totalsTokens: "tokens",
      chartTitle: "消费金额柱状图",
      chartEmpty: "所选区间内暂无消费数据",
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
      refresh: "刷新",
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
      deepseekPanel: "DeepSeek Platform",
      opencodePanel: "OpenCode Go",
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
      rangeApply: "Apply",
      rangeClipped: "Range exceeds the per-query month cap; clipped to the most recent months",
      totalsCost: "Spend",
      totalsRequests: "API requests",
      totalsTokens: "tokens",
      chartTitle: "Spend chart",
      chartEmpty: "No spend data in the selected range",
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
      refresh: "Refresh",
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
      cardsGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 8 },
      statLabel: { color: "var(--dsw-alias-label-tertiary)", fontSize: 12, margin: 0 },
      statValue: { fontSize: 18, fontWeight: 600, margin: 0 },
      row: { display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--dsw-alias-label-secondary)", gap: 8 },
      button: { border: "1px solid var(--dsw-alias-border-l2)", color: "var(--dsw-alias-label-primary)", font: "inherit", cursor: "pointer", background: "transparent", borderRadius: 6, padding: "5px 12px" },
      buttonActive: { border: "1px solid var(--dsw-alias-state-business-primary)", color: "var(--dsw-alias-state-business-primary)", font: "inherit", cursor: "pointer", background: "transparent", borderRadius: 6, padding: "5px 12px" },
      buttonsRow: { display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" },
      input: { flex: 1, minWidth: 200, border: "1px solid var(--dsw-alias-border-l2)", background: "var(--dsw-alias-bg-layer-1)", color: "var(--dsw-alias-label-primary)", font: "inherit", borderRadius: 6, padding: "5px 10px" },
      dateInput: { border: "1px solid var(--dsw-alias-border-l2)", background: "var(--dsw-alias-bg-layer-1)", color: "var(--dsw-alias-label-primary)", font: "inherit", borderRadius: 6, padding: "4px 8px" },
      tokenRow: { display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" },
      barTrack: { height: 8, borderRadius: 4, background: "var(--dsw-alias-bg-layer-1)", overflow: "hidden" },
      barFill: { height: "100%", borderRadius: 4, background: "var(--dsw-alias-state-business-primary)", transition: "width .2s ease" },
      badge: { border: "1px solid var(--dsw-alias-border-l2)", color: "var(--dsw-alias-label-secondary)", fontSize: 11, borderRadius: 999, padding: "2px 8px" },
      badgeOk: { border: "1px solid var(--dsw-alias-state-success-primary)", color: "var(--dsw-alias-state-success-primary)", fontSize: 11, borderRadius: 999, padding: "2px 8px" },
      table: { width: "100%", borderCollapse: "collapse", fontSize: 12 },
      th: { textAlign: "left", color: "var(--dsw-alias-label-tertiary)", fontWeight: 500, padding: "4px 8px", borderBottom: "1px solid var(--dsw-alias-border-l2)", whiteSpace: "nowrap" },
      td: { color: "var(--dsw-alias-label-primary)", padding: "5px 8px", borderBottom: "1px solid var(--dsw-alias-border-l1)" },
      tdNum: { color: "var(--dsw-alias-label-primary)", padding: "5px 8px", borderBottom: "1px solid var(--dsw-alias-border-l1)", textAlign: "right", fontVariantNumeric: "tabular-nums" },
      thNum: { textAlign: "right", color: "var(--dsw-alias-label-tertiary)", fontWeight: 500, padding: "4px 8px", borderBottom: "1px solid var(--dsw-alias-border-l2)", whiteSpace: "nowrap" }
    };

    const OPENCODE_LIMITS = { rolling: "$12", weekly: "$30", monthly: "$60" };
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

    function StatCard({ label, value }) {
      return React.createElement("div", { style: styles.card },
        React.createElement("p", { style: styles.statLabel }, label),
        React.createElement("p", { style: styles.statValue }, value)
      );
    }

    function BarChart({ days, currency, t }) {
      if (!days || days.length === 0) {
        return React.createElement("p", { style: styles.hint }, t("chartEmpty"));
      }
      const W = 640;
      const H = 170;
      const padL = 8;
      const padR = 8;
      const padB = 22;
      const padT = 14;
      let max = 0;
      for (const d of days) if (d.cost > max) max = d.cost;
      const innerW = W - padL - padR;
      const slot = innerW / days.length;
      const bw = Math.max(1, Math.min(28, slot * 0.7));
      const bars = days.map((d, i) => {
        const h = max > 0 ? (d.cost / max) * (H - padT - padB) : 0;
        const x = padL + i * slot + (slot - bw) / 2;
        const height = Math.max(h, d.cost > 0 ? 1 : 0);
        return React.createElement("g", { key: d.date },
          React.createElement("title", null, `${d.date} · ${fmtMoney(d.cost, currency)}`),
          React.createElement("rect", {
            x,
            y: H - padB - height,
            width: bw,
            height,
            rx: 1.5,
            fill: "var(--dsw-alias-state-business-primary)",
            opacity: d.cost > 0 ? 0.95 : 0.25
          })
        );
      });
      return React.createElement("svg", { width: "100%", viewBox: `0 0 ${W} ${H}`, style: { display: "block" } },
        React.createElement("text", { x: padL, y: H - 6, style: { fill: "var(--dsw-alias-label-tertiary)", fontSize: 10 } }, days[0].date),
        React.createElement("text", { x: W - padR, y: H - 6, textAnchor: "end", style: { fill: "var(--dsw-alias-label-tertiary)", fontSize: 10 } }, days[days.length - 1].date),
        bars
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

    function WindowCard({ name, limit, windowData, t }) {
      const percent = windowData && typeof windowData.percent === "number" ? windowData.percent : null;
      const pct = percent === null ? 0 : Math.max(0, Math.min(100, percent));
      return React.createElement("div", { style: styles.card },
        React.createElement("div", { style: styles.row },
          React.createElement("strong", { style: { fontSize: 14 } }, name),
          React.createElement("span", { style: { color: "var(--dsw-alias-label-tertiary)" } }, `${t("limit")}: ${limit}`)
        ),
        React.createElement("div", { style: styles.barTrack },
          React.createElement("div", { style: { ...styles.barFill, width: pct + "%" } })
        ),
        React.createElement("div", { style: styles.row },
          React.createElement("span", null, percent === null ? t("unknown") : percent + "%"),
          React.createElement("span", null, `${t("reset")}: ${fmtReset(windowData && windowData.resetsAt, t)}`)
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
      const [activePreset, setActivePreset] = React.useState("30d");
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
      return React.createElement("div", { style: styles.section },
        React.createElement("p", { style: styles.hint }, t("rangeTitle")),
        React.createElement("div", { style: styles.buttonsRow },
          presets().map((p) =>
            React.createElement("button", {
              key: p.id,
              style: activePreset === p.id ? styles.buttonActive : styles.button,
              onClick: () => applyPreset(p)
            }, t(PRESET_LABEL_KEYS[p.id]))
          ),
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

      return React.createElement("div", { style: styles.card },
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
        const p = presets()[2]; // 近30天
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

      return React.createElement("div", { style: styles.section },
        React.createElement("div", { style: styles.panelTitle },
          React.createElement("span", null, t("deepseekPanel")),
          React.createElement(RefreshButton, { onClick: () => { loadSummary(); loadUsage(range); }, t })
        ),
        React.createElement(TokenPanel, { credApi, onSaved: () => { loadSummary(); loadUsage(range); }, t }),
        summary.kind === "loading"
          ? React.createElement("p", { style: styles.hint }, t("loading"))
          : summary.kind === "failure"
            ? React.createElement("p", { style: styles.error }, summary.message)
            : summary.value.ok !== true
              ? React.createElement("p", { style: styles.error }, errorText(summary.value, t))
              : React.createElement("div", { style: styles.cardsGrid },
                React.createElement(StatCard, { label: t("summaryToppedUp"), value: fmtMoney(summary.value.balance?.toppedUp, currency) }),
                React.createElement(StatCard, { label: t("summaryGranted"), value: fmtMoney(summary.value.balance?.granted, currency) }),
                React.createElement(StatCard, { label: t("summaryCumulative"), value: fmtMoney(summary.value.cumulativeCost, currency) })
              ),
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
                  React.createElement(StatCard, { label: t("totalsCost"), value: fmtMoney(usage.value.totals?.cost, currency) }),
                  React.createElement(StatCard, { label: t("totalsRequests"), value: fmtCount(usage.value.totals?.requests) }),
                  React.createElement(StatCard, { label: t("totalsTokens"), value: fmtCount(usage.value.totals?.tokens) })
                ),
                React.createElement("div", { style: styles.card },
                  React.createElement("p", { style: styles.statLabel }, t("chartTitle")),
                  React.createElement(BarChart, { days: usage.value.days, currency, t })
                ),
                React.createElement("div", { style: styles.section },
                  React.createElement("p", { style: styles.statLabel }, t("modelsTitle")),
                  React.createElement(ModelTable, { models: usage.value.models, currency, t })
                )
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
            React.createElement(RefreshButton, { onClick: load, t })
          ),
          React.createElement("p", { style: styles.error }, state.message)
        );
      }
      if (state.value.ok !== true) {
        return React.createElement("div", { style: styles.section },
          React.createElement("div", { style: styles.panelTitle },
            React.createElement("span", null, t("opencodePanel")),
            React.createElement(RefreshButton, { onClick: load, t })
          ),
          React.createElement("p", { style: styles.error }, errorText(state.value, t))
        );
      }
      const keySource = state.value.keySource;
      return React.createElement("div", { style: styles.section },
        React.createElement("div", { style: styles.panelTitle },
          React.createElement("span", null, t("opencodePanel")),
          React.createElement(RefreshButton, { onClick: load, t })
        ),
        React.createElement("div", { style: styles.row },
          keySource === "credentials"
            ? React.createElement("span", { style: styles.badgeOk }, t("keySourceCredentials"))
            : keySource === "auth-json"
              ? React.createElement("span", { style: styles.badgeOk }, t("keySourceAuthJson"))
              : React.createElement("span", { style: styles.badge }, t("keyMissing")),
          React.createElement("span", null)
        ),
        React.createElement(WindowCard, { name: t("rolling"), limit: OPENCODE_LIMITS.rolling, windowData: state.value.usage?.rolling, t }),
        React.createElement(WindowCard, { name: t("weekly"), limit: OPENCODE_LIMITS.weekly, windowData: state.value.usage?.weekly, t }),
        React.createElement(WindowCard, { name: t("monthly"), limit: OPENCODE_LIMITS.monthly, windowData: state.value.usage?.monthly, t })
      );
    }

    function AccountPage(props) {
      const { t, credApi } = props;
      return React.createElement("div", { style: styles.wrap },
        React.createElement("h2", { style: styles.panelTitle }, t("title")),
        React.createElement(DeepSeekPanel, { credApi, t }),
        React.createElement(OpencodePanel, { t })
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
            locale: NS,
            inject: injected
          },
          AccountPage
        )
      );
    }

    exports.NS = NS;
    exports.apply = apply;
    exports.inject = inject;
    exports.unwrapRpc = unwrapRpc;
    return module.exports;
  }
});
