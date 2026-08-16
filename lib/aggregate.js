/**
 * dsh-account-usage — 纯解析/聚合函数（无任何依赖，可直接 node 测试）。
 * 全部函数为防御式实现：上游私有接口字段变化时返回 null/空集而非抛错。
 */

/** 平台控制台模型名 → 用户熟悉的模型名（未知名称原样保留）。 */
export const MODEL_ALIASES = {
  "deepseek-chat": "deepseek-v4-flash",
  "deepseek-chat-v4": "deepseek-v4-flash",
  "deepseek-reasoner": "deepseek-v4-pro",
  "deepseek-reasoner-v4": "deepseek-v4-pro"
};

export function toFinite(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : NaN;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    return Number.isFinite(n) ? n : NaN;
  }
  return NaN;
}

export function orNull(value) {
  return Number.isFinite(value) ? value : null;
}

export function roundCost(value) {
  return Math.round(value * 1e6) / 1e6;
}

/** 本地日历日 `YYYY-MM-DD`。 */
export function localDate(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function parseDateParam(raw) {
  if (typeof raw !== "string") return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const day = Number(m[3]);
  if (mo < 1 || mo > 12 || day < 1 || day > 31) return null;
  const d = new Date(y, mo - 1, day);
  // 严格校验：Date 构造会把 2026-13-01 / 2026-02-30 这类输入滚动到合法日期
  if (d.getFullYear() !== y || d.getMonth() !== mo - 1 || d.getDate() !== day) return null;
  return d;
}

export function canonicalModel(model) {
  return MODEL_ALIASES[model] ?? model;
}

/** [from, to] 覆盖的月份列表（含首尾，旧→新）。 */
export function monthsBetween(from, to) {
  const out = [];
  let y = from.getFullYear();
  let m = from.getMonth();
  const endY = to.getFullYear();
  const endM = to.getMonth();
  while (y < endY || (y === endY && m <= endM)) {
    out.push({ year: y, month: m + 1 });
    m += 1;
    if (m > 11) {
      m = 0;
      y += 1;
    }
  }
  return out;
}

/**
 * 在概要对象中有界搜索「累计消费」候选字段（字段名未在公开文档中，
 * 采用 DFS + 命名启发式：优先命中 total/cumulative/accumulated + cost，
 * 其次任意含 cost 的数值字段）。找不到返回 null —— 不会误报。
 */
export function findCumulativeCost(root) {
  let best = null;
  let bestScore = Infinity;
  const visit = (obj, depth) => {
    if (depth > 4 || obj === null || typeof obj !== "object") return;
    if (Array.isArray(obj)) {
      for (const item of obj) visit(item, depth + 1);
      return;
    }
    for (const [key, value] of Object.entries(obj)) {
      if (value !== null && typeof value === "object") {
        visit(value, depth + 1);
        continue;
      }
      const n = toFinite(value);
      if (!Number.isFinite(n)) continue;
      const k = key.toLowerCase();
      // 排除否定语义的键（no_cost / not_cost …），其余含 cost 的数值键才参与评分
      if (/(^|[^a-z])no[_-]?cost|(^|[^a-z])not[_-]?cost/.test(k)) continue;
      let score = Infinity;
      if (/^(total|user|cumulative|accumulat|all|sum)/.test(k) && k.includes("cost")) score = 0;
      else if (k.includes("cost") && /total|cumul|accumul|sum|used|consum/.test(k)) score = 1;
      else if (k.includes("cost")) score = 2;
      if (score < bestScore) {
        bestScore = score;
        best = { key, value: n };
      }
    }
  };
  visit(root, 0);
  return best;
}

/** 从 get_user_summary 的 biz_data 提取概要卡片数据（未知字段一律 null）。 */
export function parseSummary(bizData) {
  if (bizData === null || typeof bizData !== "object") bizData = {};
  const normal = Array.isArray(bizData.normal_wallets) ? bizData.normal_wallets[0] : undefined;
  const bonus = Array.isArray(bizData.bonus_wallets) ? bizData.bonus_wallets[0] : undefined;
  const totalCosts = Array.isArray(bizData.total_costs) ? bizData.total_costs : [];
  // 累计消费：实测字段为 total_costs[0].amount（2026-08 实测）；字段名若漂移
  // 则回退到命名启发式搜索。
  const explicitCumulative = orNull(toFinite(totalCosts[0]?.amount));
  const heuristic = explicitCumulative !== null ? null : findCumulativeCost(bizData);
  return {
    toppedUp: orNull(toFinite(normal?.balance)),
    granted: orNull(toFinite(bonus?.balance)),
    currency: typeof normal?.currency === "string" ? normal.currency : null,
    cumulativeCost: explicitCumulative !== null ? explicitCumulative : heuristic?.value ?? null,
    cumulativeCostKey: explicitCumulative !== null ? "total_costs[0].amount" : heuristic?.key ?? null
  };
}

/**
 * 解析 /usage/amount 的 biz_data → Map<date, Map<model, modelStats>>。
 * token 类型：PROMPT_TOKEN / PROMPT_CACHE_HIT_TOKEN / PROMPT_CACHE_MISS_TOKEN
 * / RESPONSE_TOKEN；请求次数取模型条目上的 count/requests/request_count/
 * req_count/calls 字段或类型名含 request/count/call 的 usage 项。
 */
export function parseAmount(bizData) {
  const container = Array.isArray(bizData) ? bizData[0] : bizData;
  const days = container?.days;
  if (!Array.isArray(days)) return null;
  const byDate = new Map();
  for (const day of days) {
    if (day === null || typeof day !== "object" || typeof day.date !== "string") continue;
    let rec = byDate.get(day.date);
    if (rec === undefined) {
      rec = new Map();
      byDate.set(day.date, rec);
    }
    for (const mu of Array.isArray(day.data) ? day.data : []) {
      if (mu === null || typeof mu !== "object") continue;
      const model = canonicalModel(typeof mu.model === "string" ? mu.model : "unknown");
      let stats = rec.get(model);
      if (stats === undefined) {
        stats = { prompt: 0, cacheHit: 0, cacheMiss: 0, response: 0, requests: 0 };
        rec.set(model, stats);
      }
      for (const u of Array.isArray(mu.usage) ? mu.usage : []) {
        if (u === null || typeof u !== "object") continue;
        const v = toFinite(u.amount);
        if (!Number.isFinite(v)) continue;
        switch (u.type) {
          case "PROMPT_TOKEN":
            stats.prompt += v;
            break;
          case "PROMPT_CACHE_HIT_TOKEN":
            stats.cacheHit += v;
            break;
          case "PROMPT_CACHE_MISS_TOKEN":
            stats.cacheMiss += v;
            break;
          case "RESPONSE_TOKEN":
            stats.response += v;
            break;
          case "REQUEST":
            // 实测：请求次数是 REQUEST 用量类型（amount = 次数）
            stats.requests += v;
            break;
          default:
            if (typeof u.type === "string" && /request|count|call/i.test(u.type)) stats.requests += v;
        }
      }
      const req = toFinite(mu.count ?? mu.requests ?? mu.request_count ?? mu.req_count ?? mu.calls);
      if (Number.isFinite(req)) stats.requests += req;
    }
  }
  return byDate;
}

/** 解析 /usage/cost 的 biz_data → Map<date, Map<model, cost>>。 */
export function parseCost(bizData) {
  const container = Array.isArray(bizData) ? bizData[0] : bizData;
  const days = container?.days;
  const byDate = new Map();
  if (Array.isArray(days)) {
    for (const day of days) {
      if (day === null || typeof day !== "object" || typeof day.date !== "string") continue;
      let modelCost = byDate.get(day.date);
      if (modelCost === undefined) {
        modelCost = new Map();
        byDate.set(day.date, modelCost);
      }
      for (const mu of Array.isArray(day.data) ? day.data : []) {
        if (mu === null || typeof mu !== "object") continue;
        const model = canonicalModel(typeof mu.model === "string" ? mu.model : "unknown");
        let sum = 0;
        for (const u of Array.isArray(mu.usage) ? mu.usage : []) {
          if (u === null || typeof u !== "object") continue;
          // 费用接口同样携带 REQUEST 类型（值为 0），必须排除以免污染费用求和
          if (typeof u.type === "string" && /(^|_)REQUEST$|request|count|call/i.test(u.type)) continue;
          const v = toFinite(u.cost ?? u.amount);
          if (Number.isFinite(v)) sum += v;
        }
        modelCost.set(model, sum + (modelCost.get(model) ?? 0));
      }
    }
  }
  return byDate;
}

export function emptyModelStats(model) {
  return { model, cost: 0, requests: 0, prompt: 0, cacheHit: 0, cacheMiss: 0, response: 0 };
}

/**
 * 合并多个月份的 amount/cost 解析结果 → { dayAgg, modelAgg, dayModelAgg }。
 * `keepDate` 谓词在同一处过滤日期（区间 + 未来日期），保证 days 与
 * models 两个视图来自同一日期集合——平台返回整月数据（含未来日期），
 * 必须过滤后再进入模型汇总，否则模型总数会大于每日序列之和。
 * dayModelAgg：date → Map<model, {cost, requests, prompt, cacheHit, cacheMiss, response}>，
 * 供「每日分模型费用 tooltip」与「分模型 token 柱状图」使用。
 */
export function mergeMonths(amountMaps, costMaps, keepDate = () => true) {
  const dayAgg = new Map();
  const modelAgg = new Map();
  const dayModelAgg = new Map();
  const touchDate = (date) => {
    let d = dayAgg.get(date);
    if (d === undefined) {
      d = { cost: 0, requests: 0, prompt: 0, cacheHit: 0, cacheMiss: 0, response: 0 };
      dayAgg.set(date, d);
    }
    return d;
  };
  const touchModel = (model) => {
    let m = modelAgg.get(model);
    if (m === undefined) {
      m = emptyModelStats(model);
      modelAgg.set(model, m);
    }
    return m;
  };
  const touchDayModel = (date, model) => {
    let dm = dayModelAgg.get(date);
    if (dm === undefined) {
      dm = new Map();
      dayModelAgg.set(date, dm);
    }
    let m = dm.get(model);
    if (m === undefined) {
      m = emptyModelStats(model);
      dm.set(model, m);
    }
    return m;
  };
  const dates = new Set();
  for (const amt of amountMaps) {
    if (amt !== null) for (const date of amt.keys()) dates.add(date);
  }
  for (const cost of costMaps) {
    if (cost !== null) for (const date of cost.keys()) dates.add(date);
  }
  for (const date of dates) {
    if (!keepDate(date)) continue;
    const day = touchDate(date);
    for (const amt of amountMaps) {
      const perModel = amt?.get(date);
      if (perModel === undefined) continue;
      for (const [model, stats] of perModel) {
        day.prompt += stats.prompt;
        day.cacheHit += stats.cacheHit;
        day.cacheMiss += stats.cacheMiss;
        day.response += stats.response;
        day.requests += stats.requests;
        const m = touchModel(model);
        m.prompt += stats.prompt;
        m.cacheHit += stats.cacheHit;
        m.cacheMiss += stats.cacheMiss;
        m.response += stats.response;
        m.requests += stats.requests;
        const dm = touchDayModel(date, model);
        dm.prompt += stats.prompt;
        dm.cacheHit += stats.cacheHit;
        dm.cacheMiss += stats.cacheMiss;
        dm.response += stats.response;
        dm.requests += stats.requests;
      }
    }
    for (const cost of costMaps) {
      const perModel = cost?.get(date);
      if (perModel === undefined) continue;
      for (const [model, c] of perModel) {
        day.cost += c;
        touchModel(model).cost += c;
        touchDayModel(date, model).cost += c;
      }
    }
  }
  return { dayAgg, modelAgg, dayModelAgg };
}

/** 防御式提取 OpenCode 用量窗口对象。 */
export function pickWindow(w) {
  if (w === null || typeof w !== "object") return null;
  const percent = toFinite(w.percent);
  return {
    status: typeof w.status === "string" ? w.status : null,
    percent: Number.isFinite(percent) ? percent : null,
    resetsAt: typeof w.resetsAt === "string" ? w.resetsAt : null
  };
}
