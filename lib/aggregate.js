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

// ---- 网页搜索 / 网页抓取（调用类型）用量 ------------------------------------
//
// 平台控制台「调用类型」视图的数据来自另一组接口：
//   /api/v0/usage/by_api_key/amount
//   /api/v0/usage/by_api_key/cost
// 它们按时间区间查询（start/end 为 epoch 秒、tz 为时区偏移秒），单次最多
// 31 天；响应中的 function_series 按「函数名（tool-search / tool-fetch）×
// 日期桶」给出 FUNCTION_CALL 次数与费用。以下函数只做纯解析/合并，无网络。

/** 平台单次查询允许的最大天数（2026-11 实测：64 天返回 biz_code=1 INVALID_PARAM）。 */
export const TOOL_WINDOW_DAYS = 31;

/** 浏览器/宿主当前时区相对 UTC 的偏移秒（UTC+8 → 28800）。 */
export function timezoneOffsetSeconds(date = new Date()) {
  const offset = date.getTimezoneOffset();
  return Number.isFinite(offset) ? -offset * 60 : 0;
}

/** `YYYY-MM-DD` → UTC 毫秒；非法/滚动日期返回 NaN。 */
function dateKeyToUtcMs(key) {
  if (typeof key !== "string") return NaN;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!m) return NaN;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  const ms = Date.UTC(year, month - 1, day);
  const d = new Date(ms);
  if (d.getUTCFullYear() !== year || d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) return NaN;
  return ms;
}

function utcMsToDateKey(ms) {
  const d = new Date(ms);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** 本地日历日 00:00 的 epoch 秒（按给定偏移量，可为非整小时）。 */
export function localDayEpoch(dateKey, offsetSec) {
  const ms = dateKeyToUtcMs(dateKey);
  if (!Number.isFinite(ms)) return null;
  if (!Number.isFinite(offsetSec)) return null;
  return Math.floor(ms / 1000) - offsetSec;
}

/**
 * 构造平台 by_api_key 用量接口的查询参数。
 * 平台 UI 的换算过程是：startSec = UTC 零点 - 时区偏移，再按「整小时 tz +
 * 余数并入 start/end」提交；两步合起来等价于 UTC 零点 - 整小时 tz，因此这里
 * 直接返回整小时 tz 与对应起止时间（结束时间取 to 的次日 00:00，接口按
 * [start, end) 返回）。
 */
export function platformWindowQuery(fromKey, toKey, offsetSec) {
  if (!Number.isFinite(offsetSec)) return null;
  const tz = 3600 * Math.floor(offsetSec / 3600);
  const fromMs = dateKeyToUtcMs(fromKey);
  const toMs = dateKeyToUtcMs(toKey);
  if (!Number.isFinite(fromMs) || !Number.isFinite(toMs) || fromMs > toMs) return null;
  return {
    start: Math.floor(fromMs / 1000) - tz,
    end: Math.floor((toMs + 86400000) / 1000) - tz,
    tz
  };
}

/** 把 [fromKey, toKey]（含首尾）切成若干不超过 maxDays 天的窗口。 */
export function splitDateWindows(fromKey, toKey, maxDays = TOOL_WINDOW_DAYS) {
  const fromMs = dateKeyToUtcMs(fromKey);
  const toMs = dateKeyToUtcMs(toKey);
  const span = Number.isFinite(maxDays) && maxDays >= 1 ? Math.floor(maxDays) : TOOL_WINDOW_DAYS;
  const out = [];
  if (!Number.isFinite(fromMs) || !Number.isFinite(toMs) || fromMs > toMs) return out;
  for (let cursor = fromMs; cursor <= toMs; cursor += span * 86400000) {
    const windowEnd = Math.min(toMs, cursor + (span - 1) * 86400000);
    out.push({ from: utcMsToDateKey(cursor), to: utcMsToDateKey(windowEnd) });
  }
  return out;
}

/** 区间内所有本地日历日（含首尾），日期非法时返回空数组。 */
export function enumerateDateKeys(fromKey, toKey) {
  const fromMs = dateKeyToUtcMs(fromKey);
  const toMs = dateKeyToUtcMs(toKey);
  if (!Number.isFinite(fromMs) || !Number.isFinite(toMs) || fromMs > toMs) return [];
  const out = [];
  for (let ms = fromMs; ms <= toMs; ms += 86400000) out.push(utcMsToDateKey(ms));
  return out;
}

/** 日桶 epoch 秒 + 查询时区 → 本地日历日 `YYYY-MM-DD`。 */
export function bucketLocalDate(epochSec, tzSec) {
  const sec = toFinite(epochSec);
  if (!Number.isFinite(sec) || !Number.isFinite(tzSec)) return null;
  const d = new Date((sec + tzSec) * 1000);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

/**
 * 解析 by_api_key/amount 的 biz_data：
 *   { function_series: [{ model: "tool-search", buckets: [{ time, usage: { FUNCTION_CALL } }] }] }
 * 返回 Map<date, Map<function, calls>>；字段缺失时返回空 Map。
 */
export function parseFunctionAmount(bizData, tzSec) {
  const container = Array.isArray(bizData) ? bizData[0] : bizData;
  const series = Array.isArray(container?.function_series) ? container.function_series : [];
  const byDate = new Map();
  for (const entry of series) {
    if (entry === null || typeof entry !== "object") continue;
    const fn = typeof entry.model === "string" && entry.model !== "" ? entry.model : null;
    if (fn === null) continue;
    for (const bucket of Array.isArray(entry.buckets) ? entry.buckets : []) {
      if (bucket === null || typeof bucket !== "object") continue;
      const date = bucketLocalDate(bucket.time, tzSec);
      const calls = toFinite(bucket.usage?.FUNCTION_CALL);
      if (date === null || !Number.isFinite(calls)) continue;
      let perFn = byDate.get(date);
      if (perFn === undefined) {
        perFn = new Map();
        byDate.set(date, perFn);
      }
      perFn.set(fn, (perFn.get(fn) ?? 0) + calls);
    }
  }
  return byDate;
}

/**
 * 解析 by_api_key/cost 的 biz_data：
 *   { data: [{ currency: "CNY", function_series: [{ model, buckets: [{ time, cost }] }] }] }
 * 返回 { currency, byDate: Map<date, Map<function, cost>> }；币种优先 CNY。
 * 若响应直接是单币种对象（无 data 数组），也做兼容。
 */
export function parseFunctionCost(bizData, tzSec) {
  const container = Array.isArray(bizData) ? bizData[0] : bizData;
  const groups = Array.isArray(container?.data) ? container.data : [];
  const chosen =
    groups.find((g) => g !== null && typeof g === "object" && g.currency === "CNY") ??
    groups.find((g) => g !== null && typeof g === "object" && Array.isArray(g.function_series)) ??
    groups[0] ??
    container;
  const currency = typeof chosen?.currency === "string" ? chosen.currency : null;
  const series = Array.isArray(chosen?.function_series) ? chosen.function_series : [];
  const byDate = new Map();
  for (const entry of series) {
    if (entry === null || typeof entry !== "object") continue;
    const fn = typeof entry.model === "string" && entry.model !== "" ? entry.model : null;
    if (fn === null) continue;
    for (const bucket of Array.isArray(entry.buckets) ? entry.buckets : []) {
      if (bucket === null || typeof bucket !== "object") continue;
      const date = bucketLocalDate(bucket.time, tzSec);
      const cost = toFinite(bucket.cost ?? bucket.amount);
      if (date === null || !Number.isFinite(cost)) continue;
      let perFn = byDate.get(date);
      if (perFn === undefined) {
        perFn = new Map();
        byDate.set(date, perFn);
      }
      perFn.set(fn, (perFn.get(fn) ?? 0) + cost);
    }
  }
  return { currency, byDate };
}

/**
 * 合并多个窗口的 amount/cost 解析结果 → 面向 UI 的工具用量序列。
 * - functions：优先按平台 `order`（functions 数组）排列，数据里多出的函数追加在后；
 * - days：补齐 [fromKey, toKey] 全区间，缺失日期 calls=0；
 * - costResults 任一项为 null 表示费用接口不可用 → cost=null / costAvailable=false。
 */
export function mergeToolUsage(amountMaps, costResults, fromKey, toKey, order = []) {
  const dates = enumerateDateKeys(fromKey, toKey);
  const records = new Map();
  const touch = (fn, date) => {
    let perDate = records.get(fn);
    if (perDate === undefined) {
      perDate = new Map();
      records.set(fn, perDate);
    }
    let rec = perDate.get(date);
    if (rec === undefined) {
      rec = { calls: 0, cost: 0 };
      perDate.set(date, rec);
    }
    return rec;
  };
  for (const map of amountMaps) {
    if (map === null || map === undefined) continue;
    for (const [date, perFn] of map) {
      for (const [fn, calls] of perFn) touch(fn, date).calls += calls;
    }
  }
  const costAvailable = costResults.some((r) => r !== null && r !== undefined);
  let currency = null;
  for (const result of costResults) {
    if (result === null || result === undefined) continue;
    for (const [date, perFn] of result.byDate) {
      for (const [fn, cost] of perFn) touch(fn, date).cost += cost;
    }
    if (currency === null && typeof result.currency === "string" && result.currency !== "") currency = result.currency;
  }
  const names = [];
  const seen = new Set();
  for (const fn of Array.isArray(order) ? order : []) {
    if (typeof fn === "string" && fn !== "" && !seen.has(fn)) {
      seen.add(fn);
      names.push(fn);
    }
  }
  for (const fn of records.keys()) {
    if (!seen.has(fn)) {
      seen.add(fn);
      names.push(fn);
    }
  }
  let totalCalls = 0;
  let totalCost = 0;
  const functions = names.map((fn) => {
    let calls = 0;
    let cost = 0;
    const days = dates.map((date) => {
      const rec = records.get(fn)?.get(date);
      const dayCalls = rec === undefined ? 0 : rec.calls;
      const dayCost = rec === undefined ? 0 : rec.cost;
      calls += dayCalls;
      cost += dayCost;
      return {
        date,
        calls: Math.round(dayCalls),
        cost: costAvailable ? roundCost(dayCost) : null
      };
    });
    totalCalls += calls;
    totalCost += cost;
    return {
      id: fn,
      calls: Math.round(calls),
      cost: costAvailable ? roundCost(cost) : null,
      days
    };
  });
  return {
    currency,
    costAvailable,
    functions,
    totals: {
      calls: Math.round(totalCalls),
      cost: costAvailable ? roundCost(totalCost) : null
    }
  };
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
