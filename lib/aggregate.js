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

// ===========================================================================
// OpenCode Go 用量趋势（0.4.0 新增）
//
// 背景：官方 `GET /zen/go/v1/usage` 只给当前三个窗口的整数百分比，没有任何
// 历史序列；控制台日榜（`/console/api/*`）只认浏览器登录态 Cookie。因此本组
// 函数负责把两类来源拼成「当前订阅周期的按天序列」：
//   1) 采样：宿主每 15 分钟把 monthly.percent 落盘 → 只在有样本的那天有值；
//   2) 官方日榜：CSV/活动接口给出每日费用与请求数 → 按额度上限折算百分比。
// 任何来源不可用时返回空/NaN，而不是抛错，由调用方降级。
// ===========================================================================

/** 趋势序列最长支撑的周期天数（自然月 31 天，留 1 天余量；超出视为异常周期）。 */
export const MAX_PERIOD_DAYS = 32;

/** 采样保留天数（与 UI 口径一致：历史保留 180 天）。 */
export const SAMPLE_RETENTION_DAYS = 180;

/** 原始采样在最近 72 小时内保留，更早按天折叠成一条。 */
export const SAMPLE_RAW_WINDOW_MS = 72 * 3600 * 1000;

/** CSV 单次解析的行数上限（防御异常大响应）。 */
const CSV_MAX_ROWS = 20000;

/** `YYYY-MM-DD` 语法 + 真实性校验（复用 parseDateParam 的严格口径）。 */
export function isDateKey(value) {
  return typeof value === "string" && parseDateParam(value) !== null;
}

/** 时间戳（毫秒或秒）或日期字符串 → 本地日历日 `YYYY-MM-DD`；无法解析返回 null。 */
export function dateKeyOf(value) {
  if (typeof value === "string") {
    const m = /^(\d{4}-\d{2}-\d{2})/.exec(value.trim());
    if (m !== null && isDateKey(m[1])) return m[1];
    const n = toFinite(value);
    if (!Number.isFinite(n)) return null;
    return dateKeyOf(n);
  }
  const n = toFinite(value);
  if (!Number.isFinite(n)) return null;
  // 10 位按秒、13 位按毫秒判断（上游两种都有）
  const ms = n > 1e11 ? n : n * 1000;
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return null;
  return localDate(d);
}

/** 日期字符串（`YYYY-MM-DD`）整体下移一个自然月；非法输入返回 null。 */
export function shiftMonthKey(key) {
  const d = parseDateParam(key);
  if (d === null) return null;
  const y = d.getFullYear();
  const m = d.getMonth();
  const day = d.getDate();
  // 先按目标月的 1 号构造，再用 min(源日, 目标月末日) 收拢，避免 3/31 → 2/31 滚动
  const lastDayOfPrev = new Date(y, m, 0).getDate();
  return localDate(new Date(y, m - 1, Math.min(day, lastDayOfPrev)));
}

/**
 * 由月度窗口的重置时间倒推当前订阅周期。
 * 截图证据为一个自然月（10/20 → 11/20），因此 periodStart = 重置日上一个月同日。
 * resetsAt 非法时返回 { start: null, end: null }，由调用方决定降级。
 */
export function periodRangeOf(monthlyResetsAt, now = new Date()) {
  const reset = typeof monthlyResetsAt === "string" ? new Date(monthlyResetsAt) : null;
  if (reset === null || Number.isNaN(reset.getTime())) {
    return { start: null, end: null, resetsAt: null };
  }
  const end = localDate(reset);
  const start = shiftMonthKey(end);
  if (start === null) return { start: null, end: null, resetsAt: monthlyResetsAt };
  // 周期长度异常（> MAX_PERIOD_DAYS）时按 30 天兜底，避免横轴被拉爆
  const span = (dateKeyToUtcMs(end) - dateKeyToUtcMs(start)) / 86400000;
  if (!Number.isFinite(span) || span < 1 || span > MAX_PERIOD_DAYS) {
    const fallbackStart = utcMsToDateKey(dateKeyToUtcMs(end) - 30 * 86400000);
    return { start: fallbackStart, end, resetsAt: monthlyResetsAt };
  }
  void now;
  return { start, end, resetsAt: monthlyResetsAt };
}

/** 由 10 位/13 位时间戳得到毫秒；非法返回 NaN。 */
function timestampMs(value) {
  const n = toFinite(value);
  if (!Number.isFinite(n)) return NaN;
  return n > 1e11 ? n : n * 1000;
}

/**
 * 采样折叠：最近 72 小时保留原始样本；更早每个本地日只保留当天最后一条；
 * 同时丢弃 retentionDays 之外的样本。输入按时间升序输出，绝不修改入参。
 */
export function compactSamples(samples, nowMs = Date.now(), retentionDays = SAMPLE_RETENTION_DAYS) {
  const list = Array.isArray(samples) ? samples : [];
  const cutoff = nowMs - retentionDays * 86400000;
  const rawFrom = nowMs - SAMPLE_RAW_WINDOW_MS;
  const older = new Map();
  const kept = [];
  for (const sample of list) {
    if (sample === null || typeof sample !== "object") continue;
    const ms = timestampMs(sample.t);
    if (!Number.isFinite(ms) || ms < cutoff) continue;
    const percent = toFinite(sample.percent);
    const entry = {
      t: Math.round(ms),
      percent: Number.isFinite(percent) ? percent : null,
      resetsAt: typeof sample.resetsAt === "string" ? sample.resetsAt : null
    };
    if (ms >= rawFrom) {
      kept.push(entry);
    } else {
      // 同一个本地日只留最后一条（按时间升序遍历，后写覆盖前写）
      older.set(localDate(new Date(ms)), entry);
    }
  }
  kept.sort((a, b) => a.t - b.t);
  const folded = [...older.values()].sort((a, b) => a.t - b.t);
  return [...folded, ...kept];
}

/**
 * 把采样序列折叠成「本地日 → 当天最后一个百分比」。
 * 返回 Map<date, percent>，只保留日期落在 [startKey, endKey] 的样本。
 */
export function lastPercentByDate(samples, startKey, endKey) {
  const out = new Map();
  const fromMs = dateKeyToUtcMs(startKey);
  const toMs = dateKeyToUtcMs(endKey);
  if (!Number.isFinite(fromMs) || !Number.isFinite(toMs) || fromMs > toMs) return out;
  for (const sample of Array.isArray(samples) ? samples : []) {
    const ms = timestampMs(sample?.t);
    const percent = toFinite(sample?.percent);
    if (!Number.isFinite(ms) || !Number.isFinite(percent)) continue;
    if (ms < fromMs || ms > toMs + 86400000) continue;
    out.set(localDate(new Date(ms)), percent);
  }
  return out;
}

/** 在对象树里按候选键名有界搜索第一个「对象或数组」值。 */
function deepFind(root, keys, maxDepth = 5) {
  const wanted = new Set(keys.map((k) => k.toLowerCase()));
  const seen = new Set();
  const walk = (node, depth) => {
    if (depth > maxDepth || node === null || typeof node !== "object") return undefined;
    if (seen.has(node)) return undefined;
    seen.add(node);
    if (!Array.isArray(node)) {
      for (const [key, value] of Object.entries(node)) {
        if (wanted.has(key.toLowerCase()) && value !== null && value !== undefined) return value;
      }
    }
    for (const value of Array.isArray(node) ? node : Object.values(node)) {
      const hit = walk(value, depth + 1);
      if (hit !== undefined) return hit;
    }
    return undefined;
  };
  return walk(root, 0);
}

/** 从对象里按候选键名取第一个有限数值。 */
function pickNumber(obj, keys) {
  if (obj === null || typeof obj !== "object") return null;
  for (const key of keys) {
    for (const actual of Object.keys(obj)) {
      if (actual.toLowerCase() !== key) continue;
      const n = toFinite(obj[actual]);
      if (Number.isFinite(n)) return n;
    }
  }
  return null;
}

/** 从对象里按候选键名取第一个非空字符串（键名大小写不敏感）。 */
function pickString(obj, keys) {
  if (obj === null || typeof obj !== "object") return null;
  for (const key of keys) {
    for (const actual of Object.keys(obj)) {
      if (actual.toLowerCase() !== key) continue;
      const value = obj[actual];
      if (typeof value === "string" && value.trim() !== "") return value;
    }
  }
  return null;
}

/** 额度计量单位：控制台的 micro-cents（1 USD = 1e8）。 */
const MICRO_CENTS_PER_USD = 1e8;

const USED_KEYS = ["usedmicrocents", "used_micro_cents", "usedmicro", "used", "spent", "consumed"];
const LIMIT_KEYS = ["limitmicrocents", "limit_micro_cents", "limitmicro", "limit", "allowance", "quota"];
const PERCENT_KEYS = ["percent", "usedpercent", "used_percent", "percent_used", "utilization"];
const RESET_KEYS = ["resetsat", "resets_at", "resetat", "reset_at", "periodend", "period_end"];

/**
 * 解析控制台 Go 订阅计量（`/console/api/go/status`）。
 * 三种可能的载荷形态（`{usage:{...}}`、`{data:{usage:{...}}}`、顶层三窗口）
 * 都能处理；同时给出精确百分比（微美分折算）与周期起点。
 */
export function parseConsoleMeters(json) {
  const empty = {
    rolling: null,
    weekly: null,
    monthly: null,
    periodStart: null,
    periodEnd: null,
    limitMicroCents: null,
    percentDecimals: 2
  };
  if (json === null || typeof json !== "object") return empty;
  const scope = deepFind(json, ["usage"]) ?? json;
  const readWindow = (key) => {
    const raw = deepFind(scope, [key]);
    if (raw === null || typeof raw !== "object" || Array.isArray(raw)) return null;
    const used = pickNumber(raw, USED_KEYS);
    const limit = pickNumber(raw, LIMIT_KEYS);
    let percent = pickNumber(raw, PERCENT_KEYS);
    if (percent === null && used !== null && limit !== null && limit > 0) {
      percent = (used / limit) * 100;
    }
    const reset = pickString(raw, RESET_KEYS);
    if (percent === null && reset === null) return null;
    return {
      percent: percent === null ? null : Math.round(percent * 100) / 100,
      usedMicroCents: used,
      limitMicroCents: limit,
      resetsAt: reset
    };
  };
  const monthly = readWindow("monthly");
  const periodStartRaw =
    deepFind(json, ["periodstart", "period_start", "currentperiodstart", "billingperiodstart"]) ?? null;
  const periodEndRaw =
    deepFind(json, ["periodend", "period_end", "currentperiodend", "billingperiodend"]) ?? null;
  return {
    rolling: readWindow("rolling"),
    weekly: readWindow("weekly"),
    monthly,
    periodStart: dateKeyOf(periodStartRaw),
    periodEnd: dateKeyOf(periodEndRaw) ?? (monthly?.resetsAt ? dateKeyOf(monthly.resetsAt) : null),
    limitMicroCents: monthly?.limitMicroCents ?? null,
    percentDecimals: 2
  };
}

/**
 * 从 `/console/api/orgs`（或任何组织/工作区列表）里提取控制台需要的组织 id。
 * 控制台接口除了会话 Cookie 还要求 `x-org-id` 请求头，缺失时统一返回 HTTP 400，
 * 所以这里尽量多认几种键名，并为「工作区 id 与组织 id 不同」的账号保留工作区候选。
 * 返回 { orgId, workspaceId, orgKey, count }，识别不到时各字段为 null。
 */
export function parseConsoleOrgIds(json) {
  const empty = { orgId: null, workspaceId: null, orgKey: null, count: 0 };
  if (json === null || typeof json !== "object") return empty;
  // 顶层直接给出活跃组织的情况优先采用
  for (const key of ["activeOrgId", "active_org_id", "defaultOrgId", "currentOrgId", "orgId"]) {
    for (const actual of Object.keys(json)) {
      if (actual.toLowerCase() !== key.toLowerCase()) continue;
      const value = json[actual];
      if (typeof value === "string" && value.trim() !== "") {
        return { orgId: value.trim(), workspaceId: null, orgKey: actual, count: 1 };
      }
    }
  }
  // 收集候选对象：优先 orgs / organizations / workspaces / data 数组
  let list = null;
  if (Array.isArray(json)) list = json;
  if (list === null) {
    for (const key of ["orgs", "organizations", "workspaces", "data", "items", "results"]) {
      const found = deepFind(json, [key]);
      if (Array.isArray(found)) {
        list = found;
        break;
      }
    }
  }
  if (list === null || list.length === 0) return empty;
  const first = list.find((item) => item !== null && typeof item === "object");
  if (first === undefined) return empty;
  let orgId = null;
  let workspaceId = null;
  let orgKey = null;
  let fallbackId = null;
  const visit = (node, depth) => {
    if (depth > 2 || node === null || typeof node !== "object" || Array.isArray(node)) return;
    for (const [key, value] of Object.entries(node)) {
      if (typeof value === "string" && value.trim() !== "") {
        const k = key.toLowerCase();
        if (orgId === null && (/^org(id|anization_?id)?$/.test(k) || /org_?id$/.test(k))) {
          orgId = value.trim();
          orgKey = key;
          continue;
        }
        if (workspaceId === null && /workspace_?id$/.test(k)) {
          workspaceId = value.trim();
          continue;
        }
        if (fallbackId === null && k === "id") fallbackId = value.trim();
      }
      if (value !== null && typeof value === "object") visit(value, depth + 1);
    }
  };
  visit(first, 0);
  if (orgId === null) {
    orgId = fallbackId;
    if (orgId !== null) orgKey = "id";
  }
  if (orgId === null && workspaceId === null) return { ...empty, count: list.length };
  return { orgId, workspaceId, orgKey, count: list.length };
}

/**
 * 解析控制台 Go 活动日序列（`/console/api/activity/go`）。
 * 返回按日期升序的 [{ date, costMicroCents, tokens, requests }]；
 * 结构不识别时返回空数组（绝不猜测）。
 */
export function parseConsoleActivity(json) {
  if (json === null || typeof json !== "object") return [];
  let list = null;
  for (const key of ["days", "activity", "data", "items", "periods", "series", "daily"]) {
    const value = deepFind(json, [key]);
    if (Array.isArray(value)) {
      list = value;
      break;
    }
  }
  if (list === null) {
    // 顶层本身就是数组的情况（部分端点直接返回 [{date,...}]）
    if (Array.isArray(json)) list = json;
    else return [];
  }
  const out = new Map();
  for (const item of list) {
    if (item === null || typeof item !== "object") continue;
    const date =
      dateKeyOf(item.date) ??
      dateKeyOf(item.day) ??
      dateKeyOf(item.startAt) ??
      dateKeyOf(item.start_at) ??
      dateKeyOf(item.time) ??
      dateKeyOf(item.ts) ??
      dateKeyOf(item.timestamp);
    if (date === null) continue;
    const costMicroCents =
      pickNumber(item, ["costmicrocents", "cost_micro_cents", "cost", "amount", "spent", "spend"]) ?? null;
    const tokens =
      pickNumber(item, ["tokens", "totaltokens", "total_tokens", "tokencount", "token_count"]) ?? null;
    const requests =
      pickNumber(item, ["requests", "requestcount", "request_count", "count", "calls"]) ?? null;
    const previous = out.get(date);
    if (previous === undefined) {
      out.set(date, { date, costMicroCents, tokens, requests });
    } else {
      // 同一天出现多行时累加（分模型行被拍平的情况）
      out.set(date, {
        date,
        costMicroCents:
          previous.costMicroCents === null && costMicroCents === null
            ? null
            : (previous.costMicroCents ?? 0) + (costMicroCents ?? 0),
        tokens:
          previous.tokens === null && tokens === null ? null : (previous.tokens ?? 0) + (tokens ?? 0),
        requests:
          previous.requests === null && requests === null
            ? null
            : (previous.requests ?? 0) + (requests ?? 0)
      });
    }
  }
  return [...out.values()].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

/** CSV 表头 → 语义列的别名表（全部小写，空格归一为下划线）。 */
const CSV_COLUMNS = {
  date: ["date", "day", "usage_date", "utc_date", "period", "period_start", "start_date", "time"],
  model: ["model", "model_id", "model_name"],
  provider: ["provider", "provider_id", "provider_name"],
  requests: ["requests", "request_count", "request", "count", "calls"],
  input: ["input_tokens", "input", "prompt_tokens", "input_token_count"],
  output: ["output_tokens", "output", "completion_tokens", "output_token_count"],
  cacheRead: ["cache_read_tokens", "cache_read", "cached_tokens", "cache_read_input_tokens"],
  cacheWrite: ["cache_write_tokens", "cache_write", "cache_write_input_tokens", "cache_creation_input_tokens"],
  cacheWrite5m: ["cache_write_5m_tokens", "cache_write_5m"],
  cacheWrite1h: ["cache_write_1h_tokens", "cache_write_1h", "cache_write_1h_input_tokens"],
  cost: ["cost_micro_cents", "cost_microcents", "micro_cents", "cost", "amount"]
};

/** 规范化一个 CSV 表头单元格。 */
function normalizeHeaderCell(cell) {
  return String(cell ?? "")
    .replace(/^\uFEFF/, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/^"|"$/g, "");
}

/** 单行 CSV 拆分（支持双引号包裹与 "" 转义）。 */
function splitCsvLine(line) {
  const out = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        cur += ch;
      }
      continue;
    }
    if (ch === '"') {
      quoted = true;
      continue;
    }
    if (ch === ",") {
      out.push(cur);
      cur = "";
      continue;
    }
    cur += ch;
  }
  out.push(cur);
  return out;
}

/**
 * 解析控制台用量导出 CSV（`/console/api/v2/usage/export`）。
 * 列名按别名表匹配；没有日期列即视为不可解析 → 返回 null。
 * 返回 { header, columns, rows, truncated }，rows 已按列语义归一。
 */
export function parseUsageCsv(text) {
  if (typeof text !== "string" || text.trim() === "") return null;
  const lines = text.split(/\r?\n/);
  let headerIndex = -1;
  for (let i = 0; i < lines.length; i += 1) {
    if (lines[i].trim() !== "") {
      headerIndex = i;
      break;
    }
  }
  if (headerIndex < 0) return null;
  const rawHeader = lines[headerIndex];
  const headerCells = splitCsvLine(rawHeader).map(normalizeHeaderCell);
  const columns = {};
  for (const [semantic, aliases] of Object.entries(CSV_COLUMNS)) {
    const index = headerCells.findIndex((cell) => aliases.includes(cell));
    if (index >= 0) columns[semantic] = index;
  }
  if (columns.date === undefined) return null;
  const rows = [];
  let truncated = false;
  for (let i = headerIndex + 1; i < lines.length; i += 1) {
    const line = lines[i];
    if (line.trim() === "") continue;
    if (rows.length >= CSV_MAX_ROWS) {
      truncated = true;
      break;
    }
    const cells = splitCsvLine(line);
    const date = dateKeyOf(cells[columns.date]);
    if (date === null) continue;
    const num = (key) => {
      const index = columns[key];
      if (index === undefined) return 0;
      const n = toFinite(cells[index]);
      return Number.isFinite(n) ? n : 0;
    };
    rows.push({
      date,
      model: columns.model === undefined ? null : (cells[columns.model] ?? "").trim() || null,
      provider: columns.provider === undefined ? null : (cells[columns.provider] ?? "").trim() || null,
      requests: num("requests"),
      input: num("input"),
      output: num("output"),
      cacheRead: num("cacheRead"),
      cacheWrite: num("cacheWrite") + num("cacheWrite5m") + num("cacheWrite1h"),
      costMicroCents: num("cost")
    });
  }
  return { header: rawHeader.trim(), columns, rows, truncated };
}

/** CSV 行 → 按日汇总 { requests, tokens, costMicroCents }（tokens 含缓存读写）。 */
export function rollupCsvDaily(rows) {
  const out = new Map();
  for (const row of Array.isArray(rows) ? rows : []) {
    if (row === null || typeof row !== "object" || typeof row.date !== "string") continue;
    const rec = out.get(row.date) ?? { requests: 0, tokens: 0, costMicroCents: 0 };
    rec.requests += toFinite(row.requests) || 0;
    rec.tokens +=
      (toFinite(row.input) || 0) +
      (toFinite(row.output) || 0) +
      (toFinite(row.cacheRead) || 0) +
      (toFinite(row.cacheWrite) || 0);
    rec.costMicroCents += toFinite(row.costMicroCents) || 0;
    out.set(row.date, rec);
  }
  return out;
}

/** CSV 行 → 按模型汇总（Requests / Tokens / 占比），按 Tokens 降序。 */
export function rollupCsvModels(rows) {
  const out = new Map();
  let total = 0;
  for (const row of Array.isArray(rows) ? rows : []) {
    if (row === null || typeof row !== "object") continue;
    const model = typeof row.model === "string" && row.model !== "" ? row.model : "unknown";
    const key = row.provider === null || row.provider === undefined ? model : `${row.provider}/${model}`;
    const rec = out.get(key) ?? { model, provider: row.provider ?? null, requests: 0, tokens: 0 };
    rec.requests += toFinite(row.requests) || 0;
    const tokens =
      (toFinite(row.input) || 0) +
      (toFinite(row.output) || 0) +
      (toFinite(row.cacheRead) || 0) +
      (toFinite(row.cacheWrite) || 0);
    rec.tokens += tokens;
    total += tokens;
    out.set(key, rec);
  }
  return [...out.values()]
    .map((rec) => ({
      model: rec.model,
      provider: rec.provider,
      requests: Math.round(rec.requests),
      tokens: Math.round(rec.tokens),
      share: total > 0 ? rec.tokens / total : 0
    }))
    .sort((a, b) => b.tokens - a.tokens || b.requests - a.requests);
}

/** micro-cents → 美元（仅用于必要时的展示，不参与百分比计算）。 */
export function microCentsToUsd(value) {
  const n = toFinite(value);
  if (!Number.isFinite(n)) return null;
  return Math.round((n / MICRO_CENTS_PER_USD) * 1e6) / 1e6;
}

/**
 * 构建当前订阅周期的按天序列。
 *
 * 优先用官方日榜（费用累计 ÷ 额度上限 = 精确百分比）；否则用采样百分比。
 * 两条来源都不做「缺口插值」：采样缺口日 cumulativePercent=null、recorded=false。
 *
 * @param {object} input
 * @param {string} input.periodStart  周期起始日 `YYYY-MM-DD`
 * @param {string} input.periodEnd    周期结束日（重置日）
 * @param {string} input.todayKey     今天（本地日）
 * @param {Array}  [input.samples]    采样 [{ t, percent }]
 * @param {Array}  [input.consoleDays] 日榜 [{ date, costMicroCents, requests, tokens }]
 * @param {number} [input.limitMicroCents] 月度额度上限（微美分）
 * @param {number} [input.anchorPercent]   当前实时百分比（官方整数口径），用于锚定末点
 * @returns {{ source: 'console'|'sampling', days: Array, lastPercent: number|null }}
 */
export function buildDailySeries(input) {
  const {
    periodStart,
    periodEnd,
    todayKey,
    samples = [],
    consoleDays = null,
    limitMicroCents = null,
    anchorPercent = null
  } = input ?? {};
  const dates = enumerateDateKeys(periodStart, periodEnd);
  const empty = { source: "sampling", days: [], lastPercent: null };
  if (dates.length === 0 || dates.length > MAX_PERIOD_DAYS) return empty;

  const todayIndex = (() => {
    if (!isDateKey(todayKey)) return dates.length - 1;
    const index = dates.indexOf(todayKey);
    if (index >= 0) return index;
    return todayKey < dates[0] ? -1 : dates.length - 1;
  })();

  const anchor =
    anchorPercent !== null && Number.isFinite(toFinite(anchorPercent))
      ? Math.max(0, Math.round(toFinite(anchorPercent) * 100) / 100)
      : null;

  const limit = toFinite(limitMicroCents);
  const round2 = (value) => Math.round(value * 100) / 100;

  let days;
  let source;
  if (Array.isArray(consoleDays) && consoleDays.length > 0) {
    // --- 来源一：官方日榜 ---
    // 日榜给出的是「费用」，额度是百分比口径（且混合模型的换算非线性），因此
    // 用「累计费用占比 × 官方当前百分比」折算：形状来自日榜，量级来自官方实时值。
    // 拿不到官方百分比时退回 limitMicroCents 的线性折算。
    const costByDate = new Map();
    for (const day of consoleDays) {
      if (day !== null && typeof day === "object" && isDateKey(day.date)) {
        costByDate.set(day.date, day);
      }
    }
    const cumCost = new Array(dates.length).fill(0);
    let running = 0;
    for (let i = 0; i < dates.length && (todayIndex < 0 || i <= todayIndex); i += 1) {
      const rec = costByDate.get(dates[i]);
      running += rec === undefined ? 0 : toFinite(rec.costMicroCents) || 0;
      cumCost[i] = running;
    }
    const cumToday = todayIndex >= 0 ? cumCost[todayIndex] : 0;
    let factor = null;
    if (anchor !== null && cumToday > 0) factor = anchor / cumToday;
    else if (Number.isFinite(limit) && limit > 0) factor = 100 / limit;
    days = dates.map((date, index) => {
      const inPast = todayIndex >= 0 && index <= todayIndex;
      if (!inPast || factor === null) {
        return { date, cumulativePercent: null, deltaPercent: null, requests: null, tokens: null, recorded: false };
      }
      const rec = costByDate.get(date);
      return {
        date,
        cumulativePercent: Math.min(1000, round2(cumCost[index] * factor)),
        deltaPercent: null,
        requests: rec === undefined || rec.requests === null || rec.requests === undefined
          ? null
          : Math.round(toFinite(rec.requests) || 0),
        tokens: rec === undefined || rec.tokens === null || rec.tokens === undefined
          ? null
          : Math.round(toFinite(rec.tokens) || 0),
        recorded: true
      };
    });
    source = "console";
  } else {
    // --- 来源二：本地采样（每天取最后一条样本；缺口保持 null） ---
    const perDate = lastPercentByDate(samples, periodStart, periodEnd);
    days = dates.map((date, index) => {
      const percent = perDate.get(date);
      const inPast = todayIndex >= 0 && index <= todayIndex;
      if (percent === undefined || !inPast) {
        return { date, cumulativePercent: null, deltaPercent: null, requests: null, tokens: null, recorded: false };
      }
      return {
        date,
        cumulativePercent: round2(percent),
        deltaPercent: null,
        requests: null,
        tokens: null,
        recorded: true
      };
    });
    source = "sampling";
  }

  // 末点锚定：今天这一刻的累计百分比是已知的官方实时值，直接写进今天这一格；
  // 更早的缺口仍保持 null（不插值）。
  if (anchor !== null && todayIndex >= 0 && todayIndex < days.length) {
    days[todayIndex] = {
      ...days[todayIndex],
      cumulativePercent: round2(anchor),
      recorded: true,
      sealed: true
    };
  }

  // 日增量只在「相邻两天都有值」时给出，跨缺口不臆造
  for (let i = 1; i < days.length; i += 1) {
    const cur = days[i];
    const prev = days[i - 1];
    if (cur.recorded && prev.recorded && cur.cumulativePercent !== null && prev.cumulativePercent !== null) {
      cur.deltaPercent = round2(cur.cumulativePercent - prev.cumulativePercent);
    }
  }

  const recordedDays = days.filter((day) => day.recorded && day.cumulativePercent !== null);
  return {
    source,
    days,
    lastPercent: recordedDays.length === 0 ? null : recordedDays[recordedDays.length - 1].cumulativePercent
  };
}

/**
 * 线性外推预测：日均 = 已用% / 已过天数；期末 = 已用% + 日均 × 剩余天数。
 * 周期刚开始（不足 1 天）或没有有效末点时返回 sufficient=false。
 */
export function forecastSeries(series, input) {
  const { periodStart, periodEnd, todayKey } = input ?? {};
  const days = Array.isArray(series?.days) ? series.days : [];
  const last = [...days].reverse().find((d) => d.recorded && d.cumulativePercent !== null) ?? null;
  const empty = {
    pacePercentPerDay: null,
    projectedEndPercent: null,
    elapsedDays: 0,
    remainingDays: 0,
    sufficient: false,
    currentPercent: null,
    lastRecorded: last === null ? null : last.date
  };
  if (last === null || !isDateKey(periodStart) || !isDateKey(periodEnd)) return empty;
  const startMs = dateKeyToUtcMs(periodStart);
  const endMs = dateKeyToUtcMs(periodEnd);
  const todayMs = dateKeyToUtcMs(isDateKey(todayKey) ? todayKey : last.date);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || !Number.isFinite(todayMs)) return empty;
  const elapsedDays = Math.max(0, (todayMs - startMs) / 86400000);
  const remainingDays = Math.max(0, (endMs - todayMs) / 86400000);
  const currentPercent = last.cumulativePercent;
  if (elapsedDays < 1 || currentPercent === null) {
    return { ...empty, elapsedDays: Math.round(elapsedDays * 100) / 100, remainingDays: Math.round(remainingDays * 100) / 100, currentPercent };
  }
  const pace = currentPercent / elapsedDays;
  const projected = currentPercent + pace * remainingDays;
  return {
    pacePercentPerDay: Math.round(pace * 100) / 100,
    projectedEndPercent: Math.round(Math.min(1000, projected) * 10) / 10,
    elapsedDays: Math.round(elapsedDays * 100) / 100,
    remainingDays: Math.round(remainingDays * 100) / 100,
    sufficient: true,
    currentPercent,
    lastRecorded: last.date
  };
}

/** 纵轴上限：默认 100%；超过 100% 用 150%；再高按 50% 向上取整。 */
export function percentGridMax(values) {
  let max = 100;
  for (const value of Array.isArray(values) ? values : []) {
    const n = toFinite(value);
    if (Number.isFinite(n) && n > max) max = n;
  }
  if (max <= 100) return 100;
  if (max <= 150) return 150;
  return Math.ceil(max / 50) * 50;
}
