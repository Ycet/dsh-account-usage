/**
 * @ycet/dsh-account-usage — host half.
 *
 * 在 DSH web 服务器上注册三条精确 GET 路由，供设置页「账户」使用：
 *
 *   GET /api/account-usage/deepseek-summary
 *     解析 DeepSeek 平台会话（DEEPSEEK_PLATFORM_TOKEN）下的账户概要：
 *     充值余额 / 赠送余额 / 累计消费 / 本月消费 / 本月 tokens。
 *     数据源：platform.deepseek.com/api/v0/users/get_user_summary
 *     （并尽力附加 /users/get_user_info 以补全累计消费字段）。
 *
 *   GET /api/account-usage/deepseek-usage?from=YYYY-MM-DD&to=YYYY-MM-DD
 *     按月拉取 /api/v0/usage/amount 与 /api/v0/usage/cost，合并为所选
 *     区间内的每日序列（费用、请求次数、各类型 token）与按模型汇总。
 *     跨月区间自动并行拉取所需月份（上限 MAX_MONTHS，超出裁剪 from 并
 *     标记 range.clipped）。接口返回整月数据，未来日期被过滤。
 *     同时按 ≤31 天窗口拉取 /api/v0/usage/by_api_key/amount 与
 *     /api/v0/usage/by_api_key/cost，合并出网页搜索/抓取（调用类型）的
 *     每日调用次数与费用（响应字段 tools）；工具查询失败只降级该模块，
 *     不影响模型用量。
 *
 *   GET /api/account-usage/insights
 *     本机使用统计（「概览」标签页）：从 DSH 会话日志折叠出按本地日的 token
 *     合计与按年最长回合耗时，用于累计/峰值/最长任务/连续天数与年度热力图。
 *     只读 sessionPersistence 公开契约；账本只增不减，会话被清理或删除后
 *     其历史消耗仍保留。
 *
 *   GET /api/account-usage/opencode
 *     调用官方端点 https://opencode.ai/zen/go/v1/usage，返回 OpenCode Go
 *     5 小时滚动 / 每周 / 每月三个用量窗口（百分比 + 下次重置时间）。
 *     Key 解析顺序：凭据 OPENCODE_GO_API_KEY → ~/.local/share/opencode/auth.json。
 *
 * 安全约定：
 *   - 上游 URL 全部为固定白名单常量，绝不接受浏览器提供的 URL；
 *   - 令牌/Key 仅在宿主侧经 ctx.credentials 解析，浏览器不接触任何密钥；
 *   - 平台数据带短 TTL 内存缓存，避免高频轮询触发平台限流；
 *   - 上游请求带超时（AbortSignal.timeout）与防御式解析，私有接口字段
 *     变化时降级为空态而非崩溃。
 *
 * 浏览器契约（同源 fetch，HTTP 200 + JSON）：
 *   成功: { ok: true, ... }
 *   失败: { ok: false, code: "no-token"|"token-expired"|"no-key"|
 *          "unauthorized"|"network"|"bad-json"|"http-<n>"|"biz-error",
 *          message: string }
 */
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import {
  localDate,
  parseDateParam,
  monthsBetween,
  parseSummary,
  parseAmount,
  parseCost,
  mergeMonths,
  pickWindow,
  roundCost,
  TOOL_WINDOW_DAYS,
  timezoneOffsetSeconds,
  platformWindowQuery,
  splitDateWindows,
  parseFunctionAmount,
  parseFunctionCost,
  mergeToolUsage,
  periodRangeOf,
  compactSamples,
  buildDailySeries,
  forecastSeries,
  parseConsoleMeters,
  parseConsoleActivity,
  parseConsoleOrgIds,
  parseUsageCsv,
  filterCsvRowsByDateRange,
  rollupCsvDaily,
  rollupCsvModels,
  percentGridMax
} from "./lib/aggregate.js";
import {
  LEDGER_VERSION,
  aggregateLedger,
  emptyLedger,
  foldSessionEvents,
  mergeLedger,
  rebuildRequired
} from "./lib/insights.js";

const name = "@ycet/dsh-account-usage";
const inject = ["credentials", "webServer"];

// ---- tunables（环境变量覆盖，默认值即插即用） ------------------------------

function envNum(key, fallback) {
  const raw = process.env[key];
  if (raw !== undefined && raw.trim() !== "") {
    const n = Number(raw);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return fallback;
}

const TIMEOUT_MS = envNum("DSH_ACCOUNT_USAGE_TIMEOUT_MS", 15000);
const CACHE_TTL_MS = envNum("DSH_ACCOUNT_USAGE_CACHE_MS", 30000);
const MAX_MONTHS = envNum("DSH_ACCOUNT_USAGE_MAX_MONTHS", 3);
/** OpenCode 配额缓存 TTL：上游 opencode.ai 实测 3-10s 延迟，缓存避免每次切换标签都等。 */
const OPENCODE_CACHE_TTL_MS = envNum("DSH_ACCOUNT_USAGE_OPENCODE_CACHE_MS", 60000);

// ---- 常量 -----------------------------------------------------------------

const DEEPSEEK_PLATFORM_BASE = "https://platform.deepseek.com/api/v0";
const OPENCODE_USAGE_URL = "https://opencode.ai/zen/go/v1/usage";

/**
 * 凭证引用名的语法，与官方 `@deepseek-ai/dsh-credentials` 的 `REF_PATTERN`
 * 完全一致（0.1.7-rc.1 至 0.2.2-rc.1 未变）：POSIX 环境变量名。
 *
 * 这里刻意内联，不再 import 官方包：
 *   - 该包只提供这一个纯函数（官方实现即「正则校验 + brandString」，而 brandString
 *     在运行期就是原值），内联后 `ctx.credentials.resolve()` 拿到的仍是同一个字符串；
 *   - 官方包会连带拉起它自己的 `@deepseek-ai/cordis`，在 0.2.2 运行时里形成第二份
 *     cordis 模块实例（双实例隐患），而本插件只用到这一个纯函数。
 */
const CREDENTIAL_REF_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;

/**
 * 把环境变量名标记成凭证引用（语法校验，语义同官方 `credentialRef`）。
 * 导出仅为便于单测锁定语法，不参与插件生命周期。
 * @param {unknown} value 候选引用名
 * @returns {string} 同一个字符串
 */
export function credentialRef(value) {
  if (typeof value !== "string" || !CREDENTIAL_REF_PATTERN.test(value)) {
    throw new TypeError(`credential ref "${String(value)}" must match ${String(CREDENTIAL_REF_PATTERN)}`);
  }
  return value;
}

const PLATFORM_TOKEN_REF = credentialRef("DEEPSEEK_PLATFORM_TOKEN");
const OPENCODE_KEY_REF = credentialRef("OPENCODE_GO_API_KEY");

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36";

const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store"
};

// ---- 小工具 ---------------------------------------------------------------

function sendJson(res, status, body) {
  res.writeHead(status, JSON_HEADERS);
  res.end(JSON.stringify(body));
}

// ---- DeepSeek 平台私有接口 ------------------------------------------------

/** 平台请求缓存：cacheKey -> { at, value }。 */
const platformCache = new Map();

async function resolvePlatformToken(ctx) {
  try {
    const hit = await ctx.credentials.resolve(PLATFORM_TOKEN_REF);
    if (hit !== undefined && typeof hit.value === "string" && hit.value !== "") return hit.value;
  } catch {
    /* fall through */
  }
  return undefined;
}

/**
 * 调用平台内部端点并解包 `{code:0, data:{biz_code:0, biz_data:...}}`。
 * 返回统一结果对象，永不抛异常：
 *   { ok: true, bizData }
 *   { ok: false, code: "no-token"|"token-expired"|"bad-json"|"http-<n>"|"biz-error", message }
 */
async function fetchPlatformJson(ctx, path, params) {
  const token = await resolvePlatformToken(ctx);
  if (token === undefined) {
    return { ok: false, code: "no-token", message: "未配置 DEEPSEEK_PLATFORM_TOKEN" };
  }
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) qs.set(k, String(v));
  }
  const url = `${DEEPSEEK_PLATFORM_BASE}${path}?${qs.toString()}`;
  let response;
  try {
    response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        "x-app-version": "1.0.0",
        Origin: "https://platform.deepseek.com",
        Referer: "https://platform.deepseek.com/usage",
        "User-Agent": BROWSER_UA
      },
      signal: AbortSignal.timeout(TIMEOUT_MS)
    });
  } catch {
    return { ok: false, code: "network", message: "无法连接 DeepSeek 平台（网络失败或超时）" };
  }
  if (response.status === 401) {
    return { ok: false, code: "token-expired", message: "平台令牌无效或已过期，请重新获取 userToken" };
  }
  if (!response.ok) {
    return { ok: false, code: `http-${response.status}`, message: `平台接口返回 HTTP ${response.status}` };
  }
  let body;
  try {
    body = await response.json();
  } catch {
    return { ok: false, code: "bad-json", message: "平台接口响应解析失败" };
  }
  if (body === null || typeof body !== "object") {
    return { ok: false, code: "bad-json", message: "平台接口响应格式异常" };
  }
  // 平台信封有两层状态：顶层 code 与 data.biz_code。实测区间超限等业务错误
  // 会返回顶层 code=0 + biz_code=1（INVALID_PARAM），只读顶层会把失败误判为成功。
  const topCode = body.code;
  const bizCode = body.data?.biz_code;
  const failed =
    (topCode !== undefined && topCode !== 0) || (bizCode !== undefined && bizCode !== 0);
  if (failed) {
    const code = bizCode !== undefined && bizCode !== 0 ? bizCode : topCode;
    if (code === 40002 || code === 40003) {
      return { ok: false, code: "token-expired", message: "平台令牌已过期，请重新登录 platform.deepseek.com" };
    }
    const bizMsg = typeof body.data?.biz_msg === "string" && body.data.biz_msg !== "" ? body.data.biz_msg : null;
    return {
      ok: false,
      code: "biz-error",
      message: `平台接口业务错误 (code ${code ?? "unknown"}${bizMsg === null ? "" : `: ${bizMsg}`})`
    };
  }
  return { ok: true, bizData: body?.data?.biz_data };
}

/** 带短 TTL 缓存的平台请求（cacheKey 不同即独立缓存）。 */
async function cachedPlatform(ctx, path, params, cacheKey) {
  const hit = platformCache.get(cacheKey);
  if (hit !== undefined && Date.now() - hit.at < CACHE_TTL_MS) return hit.value;
  const value = await fetchPlatformJson(ctx, path, params);
  // 区间切换会产生大量窗口缓存键；超过上限时顺手清理过期项，避免无界增长。
  if (platformCache.size > 256) {
    const now = Date.now();
    for (const [key, entry] of platformCache) {
      if (now - entry.at >= CACHE_TTL_MS) platformCache.delete(key);
    }
  }
  platformCache.set(cacheKey, { at: Date.now(), value });
  return value;
}

// ---- OpenCode Go ------------------------------------------------------------

async function resolveOpencodeKey(ctx) {
  try {
    const hit = await ctx.credentials.resolve(OPENCODE_KEY_REF);
    if (hit !== undefined && typeof hit.value === "string" && hit.value !== "") {
      return { key: hit.value, source: "credentials" };
    }
  } catch {
    /* fall through */
  }
  try {
    const authPath = join(homedir(), ".local", "share", "opencode", "auth.json");
    const raw = JSON.parse(await readFile(authPath, "utf8"));
    const entry = raw["opencode-go"] ?? raw["opencode"];
    if (entry?.type === "api" && typeof entry.key === "string" && entry.key !== "") {
      return { key: entry.key, source: "auth-json" };
    }
  } catch {
    /* fall through */
  }
  return { key: undefined, source: null };
}

async function fetchOpencodeUsage(ctx) {
  const { key, source } = await resolveOpencodeKey(ctx);
  if (key === undefined) {
    return { ok: false, code: "no-key", message: "未找到 OpenCode Go API Key（OPENCODE_GO_API_KEY / auth.json）" };
  }
  let response;
  try {
    response = await fetch(OPENCODE_USAGE_URL, {
      headers: { Authorization: `Bearer ${key}`, Accept: "application/json" },
      signal: AbortSignal.timeout(TIMEOUT_MS)
    });
  } catch {
    return { ok: false, code: "network", message: "无法连接 opencode.ai（网络失败或超时）" };
  }
  if (response.status === 401) {
    return { ok: false, code: "unauthorized", message: "OpenCode Go API Key 无效或已过期（401）" };
  }
  if (response.status === 403) {
    // 官方用量接口用 EntitlementError 区分“缺少 Go 订阅”和其他访问拒绝。
    let errorType;
    try {
      errorType = (await response.json())?.error?.type;
    } catch {
      /* 保留通用 HTTP 403 错误 */
    }
    if (errorType === "EntitlementError") {
      return {
        ok: false,
        code: "go-subscription-required",
        keySource: source,
        message: "当前 API Key 所属工作区没有 OpenCode Go 订阅"
      };
    }
  }
  if (!response.ok) {
    return { ok: false, code: `http-${response.status}`, message: `OpenCode 用量接口返回 HTTP ${response.status}` };
  }
  let body;
  try {
    body = await response.json();
  } catch {
    return { ok: false, code: "bad-json", message: "OpenCode 用量接口响应解析失败" };
  }
  const usage = body && typeof body === "object" && body.usage ? body.usage : body;
  return {
    ok: true,
    keySource: source,
    usage: {
      rolling: pickWindow(usage?.rolling),
      weekly: pickWindow(usage?.weekly),
      monthly: pickWindow(usage?.monthly)
    }
  };
}

// ---- 路由处理器 --------------------------------------------------------------

// ---- 网页搜索 / 网页抓取（调用类型）用量 ----------------------------------

/** 从 by_api_key 响应中提取 functions 顺序（兼容 amount / cost 两种结构）。 */
function functionOrderOf(bizData) {
  const container = Array.isArray(bizData) ? bizData[0] : bizData;
  if (Array.isArray(container?.functions)) return container.functions;
  for (const group of Array.isArray(container?.data) ? container.data : []) {
    if (Array.isArray(group?.functions)) return group.functions;
  }
  return [];
}

/**
 * 查询网页搜索/抓取（平台「调用类型」）用量。
 * 平台该接口单次最多 31 天，超出会返回 biz_code=1 INVALID_PARAM，因此按
 * <=TOOL_WINDOW_DAYS 天切窗并行请求，再按「函数 × 日期」合并。
 * 永不抛异常；amount 查询失败 → ok:false；cost 查询失败 → 只降级费用。
 */
async function loadToolUsage(ctx, fromKey, toKey) {
  const offsetSec = timezoneOffsetSeconds();
  const windows = splitDateWindows(fromKey, toKey, TOOL_WINDOW_DAYS);
  const range = { from: fromKey, to: toKey, windows: windows.length };
  if (windows.length === 0) {
    return {
      ok: true,
      currency: null,
      costAvailable: false,
      functions: [],
      totals: { calls: 0, cost: null },
      range
    };
  }
  const tasks = windows.map((window) => ({
    window,
    query: platformWindowQuery(window.from, window.to, offsetSec)
  }));
  if (tasks.some((task) => task.query === null)) {
    return { ok: false, code: "bad-range", message: "所选区间无法转换为平台查询参数", range };
  }
  const results = await Promise.all(
    tasks.map((task) =>
      Promise.all([
        cachedPlatform(
          ctx,
          "/usage/by_api_key/amount",
          { start: task.query.start, end: task.query.end, tz: task.query.tz },
          `tool-amount:${task.query.start}:${task.query.end}:${task.query.tz}`
        ),
        cachedPlatform(
          ctx,
          "/usage/by_api_key/cost",
          { start: task.query.start, end: task.query.end, tz: task.query.tz },
          `tool-cost:${task.query.start}:${task.query.end}:${task.query.tz}`
        )
      ])
    )
  );
  const amountResults = results.map(([amount]) => amount);
  const amountError = amountResults.find((result) => !result.ok);
  if (amountError !== undefined) {
    return { ok: false, code: amountError.code, message: amountError.message, range };
  }
  const costResults = results.map(([, cost]) => cost);
  const costError = costResults.find((result) => !result.ok);
  if (costError !== undefined) {
    ctx.logger?.warn?.(`dsh-account-usage: 工具费用查询降级（${costError.code}）`);
  }
  const order = [];
  const seen = new Set();
  for (const result of amountResults) {
    for (const fn of functionOrderOf(result.bizData)) {
      if (typeof fn === "string" && fn !== "" && !seen.has(fn)) {
        seen.add(fn);
        order.push(fn);
      }
    }
  }
  const amountMaps = amountResults.map((result, index) =>
    parseFunctionAmount(result.bizData, tasks[index].query.tz)
  );
  // 任一分段费用失败则整体标记费用不可用，避免部分窗口按 0 计算造成少计。
  const costParsed = costError === undefined
    ? costResults.map((result, index) => parseFunctionCost(result.bizData, tasks[index].query.tz))
    : costResults.map(() => null);
  const merged = mergeToolUsage(amountMaps, costParsed, fromKey, toKey, order);
  return {
    ok: true,
    currency: merged.currency,
    costAvailable: merged.costAvailable,
    functions: merged.functions,
    totals: merged.totals,
    range
  };
}

async function handleSummary(ctx, res) {
  const summary = await cachedPlatform(ctx, "/users/get_user_summary", {}, "summary");
  if (!summary.ok) {
    sendJson(res, 200, { ok: false, code: summary.code, message: summary.message });
    return;
  }
  const parsed = parseSummary(summary.bizData);
  sendJson(res, 200, {
    ok: true,
    balance: {
      toppedUp: parsed.toppedUp,
      granted: parsed.granted,
      currency: parsed.currency
    },
    cumulativeCost: parsed.cumulativeCost
  });
}

async function handleUsage(ctx, req, res) {
  const url = new URL(req.url ?? "/", "http://localhost");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let to = parseDateParam(url.searchParams.get("to"));
  let from = parseDateParam(url.searchParams.get("from"));
  if (to === null || to > today) to = today;
  if (from === null) from = new Date(to.getTime() - 29 * 86400000);
  if (from > to) from = to;
  let months = monthsBetween(from, to);
  let clipped = false;
  if (months.length > MAX_MONTHS) {
    months = months.slice(-MAX_MONTHS);
    from = new Date(months[0].year, months[0].month - 1, 1);
    clipped = true;
  }
  const fromKey = localDate(from);
  const toKey = localDate(to);
  const todayKey = localDate(today);
  const [results, tools] = await Promise.all([
    Promise.all(
      months.map(({ year, month }) =>
        Promise.all([
          cachedPlatform(ctx, "/usage/amount", { month, year }, `amount:${year}-${month}`),
          cachedPlatform(ctx, "/usage/cost", { month, year }, `cost:${year}-${month}`)
        ])
      )
    ),
    // 工具用量独立查询：失败只降级该模块，不影响模型用量响应。
    loadToolUsage(ctx, fromKey, toKey).catch((error) => {
      ctx.logger?.warn?.("dsh-account-usage: tool usage query failed");
      ctx.logger?.warn?.(error);
      return { ok: false, code: "internal", message: "网页搜索/抓取用量查询失败" };
    })
  ]);
  const firstError = results.flat().find((r) => !r.ok);
  if (firstError !== undefined) {
    sendJson(res, 200, { ok: false, code: firstError.code, message: firstError.message });
    return;
  }
  const amountMaps = results.map(([a]) => parseAmount(a.bizData));
  const costMaps = results.map(([, c]) => parseCost(c.bizData));
  const { dayAgg, modelAgg, dayModelAgg } = mergeMonths(
    amountMaps,
    costMaps,
    (date) => date >= fromKey && date <= toKey && date <= todayKey
  );

  const days = [];
  for (const [date, d] of dayAgg) {
    // 每日分模型明细（费用 + token），供费用图 tooltip 与分模型 token 图使用
    const dayModels = {};
    const perModel = dayModelAgg.get(date);
    if (perModel !== undefined) {
      for (const [model, m] of perModel) {
        dayModels[model] = {
          cost: roundCost(m.cost),
          requests: Math.round(m.requests),
          cacheHitTokens: Math.round(m.cacheHit),
          cacheMissTokens: Math.round(m.cacheMiss),
          responseTokens: Math.round(m.response)
        };
      }
    }
    days.push({
      date,
      cost: roundCost(d.cost),
      requests: Math.round(d.requests),
      promptTokens: Math.round(d.prompt),
      cacheHitTokens: Math.round(d.cacheHit),
      cacheMissTokens: Math.round(d.cacheMiss),
      responseTokens: Math.round(d.response),
      models: dayModels
    });
  }
  days.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const models = [...modelAgg.values()]
    .map((m) => ({
      model: m.model,
      cost: roundCost(m.cost),
      requests: Math.round(m.requests),
      promptTokens: Math.round(m.prompt),
      cacheHitTokens: Math.round(m.cacheHit),
      cacheMissTokens: Math.round(m.cacheMiss),
      responseTokens: Math.round(m.response)
    }))
    // 平台会返回全零的遗留模型行（如 "deepseek-chat & deepseek-reasoner"），过滤掉
    .filter(
      (m) =>
        m.cost !== 0 ||
        m.requests !== 0 ||
        m.promptTokens !== 0 ||
        m.cacheHitTokens !== 0 ||
        m.cacheMissTokens !== 0 ||
        m.responseTokens !== 0
    )
    .sort((a, b) => b.cost - a.cost || b.requests - a.requests);
  const totals = {
    cost: roundCost(days.reduce((s, d) => s + d.cost, 0)),
    requests: days.reduce((s, d) => s + d.requests, 0),
    tokens: days.reduce(
      (s, d) => s + d.promptTokens + d.cacheHitTokens + d.cacheMissTokens + d.responseTokens,
      0
    )
  };
  sendJson(res, 200, {
    ok: true,
    range: { from: fromKey, to: toKey, clipped },
    totals,
    days,
    models,
    tools
  });
}

/** OpenCode 配额结果缓存（仅缓存成功结果；失败不缓存以便下次重试）。 */
const opencodeCache = { at: 0, value: null };

async function handleOpencode(ctx, res) {
  if (opencodeCache.value !== null && Date.now() - opencodeCache.at < OPENCODE_CACHE_TTL_MS) {
    sendJson(res, 200, opencodeCache.value);
    return;
  }
  const result = await fetchOpencodeUsage(ctx);
  if (result.ok === true) {
    opencodeCache.at = Date.now();
    opencodeCache.value = result;
  }
  sendJson(res, 200, result);
}

// ---- OpenCode 用量趋势：采样、持久化与控制台日榜 ----------------------------
//
// 官方 `GET /zen/go/v1/usage` 只给当前三个窗口的整数百分比，没有历史序列；
// 控制台日榜（`/console/api/*`）只认浏览器登录态 Cookie。因此这里两条腿走路：
//
//   1) 采样：每 15 分钟把 monthly.percent 落盘到
//      ~/.dsh/storages/dsh-account-usage/opencode-samples.v1.json；
//   2) 可选 Console Cookie：配置后由宿主用固定白名单 URL 拉官方日榜
//      （请求数 / Tokens / 模型 / 精确百分比）。
//
// 安全约定：
//   - Cookie 只经 ctx.credentials 在宿主侧解析，绝不进入浏览器、日志或响应体；
//   - 三个控制台 URL 全部是常量，不接受任何来自浏览器的 URL；
//   - 响应体积、超时、错误码全部有界，失败即降级到采样数据。

/** Console 会话 Cookie 的凭据引用名（用户可在设置面板里粘贴/清除）。 */
const CONSOLE_COOKIE_REF = credentialRef("OPENCODE_CONSOLE_COOKIE");

/** 控制台接口白名单（四条固定 URL，绝不拼接用户输入）。 */
const CONSOLE_ORGS_URL = "https://opencode.ai/console/api/orgs";
const CONSOLE_GO_STATUS_URL = "https://opencode.ai/console/api/go/status";
const CONSOLE_GO_ACTIVITY_URL = "https://opencode.ai/console/api/activity/go?range=30d";
const CONSOLE_USAGE_EXPORT_URL = "https://opencode.ai/console/api/v2/usage/export?range=30d";

/** 采样间隔（默认 15 分钟 = 96 次/天，对上游很轻）。 */
const SAMPLE_INTERVAL_MS = envNum("DSH_ACCOUNT_USAGE_SAMPLE_INTERVAL_MS", 15 * 60 * 1000);
/** 首次采样延迟：避免插件加载时和页面首屏抢带宽。 */
const SAMPLE_FIRST_DELAY_MS = envNum("DSH_ACCOUNT_USAGE_SAMPLE_FIRST_DELAY_MS", 30000);
/** 控制台日榜缓存（10 分钟；Cookie 变化时立即失效）。 */
const CONSOLE_CACHE_TTL_MS = envNum("DSH_ACCOUNT_USAGE_CONSOLE_CACHE_MS", 10 * 60 * 1000);
/** 控制台单个响应体上限（防御异常大 CSV）。 */
const CONSOLE_MAX_BYTES = envNum("DSH_ACCOUNT_USAGE_CONSOLE_MAX_BYTES", 4 * 1024 * 1024);
/** 实时用量快照复用窗口（采样器与趋势路由共用，避免重复请求）。 */
const USAGE_SNAPSHOT_TTL_MS = 60 * 1000;
/** 快照过期但仍可用于锚定的宽限窗口。 */
const USAGE_STALE_TTL_MS = 15 * 60 * 1000;

function sendHistoryError(res, code, message) {
  sendJson(res, 200, { ok: false, code, message });
}

/** 采样库目录（可用环境变量覆盖，跨平台由 node:path 处理分隔符）。 */
function sampleDirectory() {
  const override = process.env.DSH_ACCOUNT_USAGE_DATA_DIR;
  if (typeof override === "string" && override.trim() !== "") return override.trim();
  return join(homedir(), ".dsh", "storages", "dsh-account-usage");
}

function sampleFilePath() {
  return join(sampleDirectory(), "opencode-samples.v1.json");
}

/** 采样库内存态：{ samples } 或 null（未加载）。 */
let sampleStore = null;
/** 写入串行化：同一进程内不会有两个写入交错。 */
let sampleWriteChain = Promise.resolve();

/** 懒加载采样库；文件缺失/损坏时按空库处理，绝不抛错。 */
async function loadSampleStore() {
  if (sampleStore !== null) return sampleStore;
  let samples = [];
  try {
    const raw = JSON.parse(await readFile(sampleFilePath(), "utf8"));
    if (Array.isArray(raw?.samples)) samples = raw.samples;
  } catch {
    /* 首次运行、文件缺失或损坏：按空库处理 */
  }
  sampleStore = { samples: compactSamples(samples, Date.now()) };
  return sampleStore;
}

/** 原子写采样库：先写同目录临时文件再 rename，避免半截 JSON。 */
function persistSamples(ctx, samples) {
  sampleWriteChain = sampleWriteChain
    .catch(() => {})
    .then(async () => {
      const file = sampleFilePath();
      await mkdir(dirname(file), { recursive: true });
      const tmp = `${file}.${process.pid}.tmp`;
      await writeFile(tmp, JSON.stringify({ version: 1, samples }), "utf8");
      await rename(tmp, file);
    })
    .catch((error) => {
      // 写失败只影响历史精度，不影响配额展示与趋势图的当前值
      ctx.logger?.warn?.("dsh-account-usage: 用量采样写入失败");
      ctx.logger?.warn?.(error);
    });
  return sampleWriteChain;
}

/** 追加一条采样点（按保留策略折叠后落盘）。 */
async function appendSample(ctx, sample) {
  const store = await loadSampleStore();
  store.samples = compactSamples([...store.samples, sample], Date.now());
  await persistSamples(ctx, store.samples);
}

/** 实时用量快照缓存（采样器与趋势路由共用）。 */
const usageSnapshot = { at: 0, value: null };

/**
 * 取一份尽量新鲜的 OpenCode 用量快照。
 * 失败时若还有 15 分钟内的旧快照，仍然返回它并标记 stale（用于锚定趋势末点）。
 */
async function latestOpencodeUsage(ctx) {
  if (usageSnapshot.value !== null && Date.now() - usageSnapshot.at < USAGE_SNAPSHOT_TTL_MS) {
    return usageSnapshot.value;
  }
  const value = await fetchOpencodeUsage(ctx);
  if (value.ok === true) {
    usageSnapshot.at = Date.now();
    usageSnapshot.value = value;
    return value;
  }
  if (usageSnapshot.value !== null && Date.now() - usageSnapshot.at < USAGE_STALE_TTL_MS) {
    return { ...usageSnapshot.value, stale: true };
  }
  return value;
}

/** 单次采样：只记录每月窗口百分比（趋势图的锚点）。 */
async function sampleOpencodeOnce(ctx) {
  const result = await fetchOpencodeUsage(ctx);
  if (result.ok !== true) return;
  const monthly = result.usage?.monthly;
  const percent = monthly?.percent;
  if (percent === null || percent === undefined || !Number.isFinite(Number(percent))) return;
  usageSnapshot.at = Date.now();
  usageSnapshot.value = result;
  await appendSample(ctx, {
    t: Date.now(),
    percent: Number(percent),
    resetsAt: typeof monthly.resetsAt === "string" ? monthly.resetsAt : null
  });
}

/**
 * 启动后台采样器。生命周期挂到 ctx.effect：插件卸载/重载时定时器必须被清掉。
 * 定时器全部 unref，避免拖住进程退出。
 */
function startSampleScheduler(ctx) {
  if (process.env.DSH_ACCOUNT_USAGE_SAMPLING === "off") return () => {};
  const tick = () => {
    sampleOpencodeOnce(ctx).catch((error) => {
      ctx.logger?.warn?.("dsh-account-usage: 用量采样失败");
      ctx.logger?.warn?.(error);
    });
  };
  const first = setTimeout(tick, SAMPLE_FIRST_DELAY_MS);
  first.unref?.();
  const timer = setInterval(tick, SAMPLE_INTERVAL_MS);
  timer.unref?.();
  return () => {
    clearTimeout(first);
    clearInterval(timer);
  };
}

/**
 * 归一化用户粘贴的 Console Cookie。
 * 用户经常会把「整行 Request Headers」或「cookie: 前缀」一起复制进来，
 * 这里统一处理：取 cookie 那一行 → 去掉前缀 → 去掉首尾引号 → 长度防御。
 */
export function normalizeConsoleCookie(raw) {
  if (typeof raw !== "string") return undefined;
  let value = raw.trim();
  if (value === "") return undefined;
  const cookieLine = value.split(/\r?\n/).find((line) => /^\s*cookie\s*:/i.test(line));
  value = (cookieLine === undefined ? value : cookieLine).replace(/^\s*cookie\s*:/i, "").trim();
  // 只保留第一行（换行会让 HTTP 头非法）
  value = value.split(/\r?\n/)[0].trim();
  // 去掉整体包裹的引号，以及末尾多余的分号
  value = value.replace(/^['"]|['"]$/g, "").trim().replace(/;\s*$/, "");
  if (value === "" || value.length > 8192) return undefined;
  return value;
}

/** 解析控制台会话 Cookie（只在宿主侧使用，永不外泄）。 */
async function resolveConsoleCookie(ctx) {
  try {
    const hit = await ctx.credentials.resolve(CONSOLE_COOKIE_REF);
    if (hit !== undefined && typeof hit.value === "string") {
      return normalizeConsoleCookie(hit.value);
    }
  } catch {
    /* 未配置或凭据服务不可用 */
  }
  return undefined;
}

/** 带 Cookie 抓取一条白名单控制台 URL；永不抛异常。 */
async function fetchConsoleResource(ctx, url, cookie, extraHeaders) {
  let response;
  const headers = {
    Cookie: cookie,
    Accept: "application/json, text/csv;q=0.9, */*;q=0.8",
    "User-Agent": BROWSER_UA
  };
  if (extraHeaders !== undefined && extraHeaders !== null) {
    for (const [key, value] of Object.entries(extraHeaders)) {
      if (typeof value === "string" && value !== "") headers[key] = value;
    }
  }
  try {
    response = await fetch(url, { headers, signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch {
    return { ok: false, status: 0, code: "network" };
  }
  const status = response.status;
  const contentType = response.headers?.get?.("content-type") ?? "";
  if (status === 401 || status === 403) return { ok: false, status, code: "unauthorized", contentType };
  if (!response.ok) return { ok: false, status, code: `http-${status}`, contentType };
  let text;
  try {
    text = await response.text();
  } catch {
    return { ok: false, status, code: "read-failed", contentType };
  }
  if (typeof text === "string" && text.length > CONSOLE_MAX_BYTES) {
    return { ok: false, status, code: "too-large", contentType };
  }
  return { ok: true, status, contentType, text };
}

/** 控制台日榜缓存（Cookie 变化时立即失效）。 */
const consoleCache = { at: 0, cookie: null, value: null };

/** 解析 JSON 文本，失败返回 null。 */
function safeJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/**
 * 拉取控制台三份数据并归一：
 *   - `/go/status`       → 精确额度计量 + 周期起点
 *   - `/activity/go`     → 每日费用/Tokens（CSV 不可用时的退路）
 *   - `/v2/usage/export` → 每日 × 模型的 CSV（请求数 / Tokens / 模型占比）
 */
async function loadConsoleUsage(ctx, force = false) {
  const cookie = await resolveConsoleCookie(ctx);
  if (cookie === undefined) {
    return {
      configured: false,
      status: "unconfigured",
      days: null,
      limitMicroCents: null,
      csv: null,
      activityDays: null,
      meters: null,
      diagnostics: null
    };
  }
  if (
    !force &&
    consoleCache.value !== null &&
    consoleCache.cookie === cookie &&
    Date.now() - consoleCache.at < CONSOLE_CACHE_TTL_MS
  ) {
    return consoleCache.value;
  }
  // 控制台接口除会话 Cookie 外还要求工作区/组织头（缺失一律 HTTP 400），
  // 先用 /console/api/orgs 拿到当前账号的组织 id，再带上 `x-org-id` 请求三条数据接口。
  const orgsRes = await fetchConsoleResource(ctx, CONSOLE_ORGS_URL, cookie);
  const orgIds = orgsRes.ok === true ? parseConsoleOrgIds(safeJson(orgsRes.text)) : null;
  const orgHeaders = {};
  if (orgIds !== null && orgIds.orgId !== null) orgHeaders["x-org-id"] = orgIds.orgId;
  if (orgIds !== null && orgIds.workspaceId !== null && orgIds.workspaceId !== orgIds.orgId) {
    orgHeaders["x-workspace-id"] = orgIds.workspaceId;
  }
  const [statusRes, activityRes, exportRes] = await Promise.all([
    fetchConsoleResource(ctx, CONSOLE_GO_STATUS_URL, cookie, orgHeaders),
    fetchConsoleResource(ctx, CONSOLE_GO_ACTIVITY_URL, cookie, orgHeaders),
    fetchConsoleResource(ctx, CONSOLE_USAGE_EXPORT_URL, cookie, orgHeaders)
  ]);
  const meters = statusRes.ok ? parseConsoleMeters(safeJson(statusRes.text)) : null;
  const activityDays = activityRes.ok ? parseConsoleActivity(safeJson(activityRes.text)) : null;
  const csv = exportRes.ok ? parseUsageCsv(exportRes.text) : null;
  // 日序列优先用 CSV（带请求数/模型），否则用活动接口；两者都没有则日榜不可用
  let days = null;
  if (csv !== null && csv.rows.length > 0) {
    days = [...rollupCsvDaily(csv.rows).entries()]
      .map(([date, rec]) => ({
        date,
        costMicroCents: rec.costMicroCents,
        requests: rec.requests,
        tokens: rec.tokens
      }))
      .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  } else if (activityDays !== null && activityDays.length > 0) {
    days = activityDays;
  }
  const unauthorized =
    orgsRes.code === "unauthorized" ||
    statusRes.code === "unauthorized" ||
    activityRes.code === "unauthorized" ||
    exportRes.code === "unauthorized";
  let status;
  if (days !== null || (meters !== null && meters.monthly !== null)) status = "ok";
  else if (unauthorized) status = "expired";
  else status = "unavailable";
  // Cookie 形状统计（只给「几段/多长」，不含内容）：粘贴不全时最容易看出来
  const cookiePairs = cookie.split(";").filter((part) => part.trim() !== "").length;
  const value = {
    configured: true,
    status,
    days,
    limitMicroCents: meters?.limitMicroCents ?? null,
    csv,
    activityDays,
    meters,
    diagnostics: {
      // 只回传状态码/类型/CSV 表头一行/是否取到组织 id：不含 Cookie、不含业务数据
      orgsStatus: orgsRes.status ?? null,
      cookiePairs,
      cookieLength: cookie.length,
      orgIdPresent: orgHeaders["x-org-id"] !== undefined,
      orgIdKey: orgIds === null ? null : orgIds.orgKey,
      workspaceIdPresent: orgHeaders["x-workspace-id"] !== undefined,
      statusStatus: statusRes.status ?? null,
      activityStatus: activityRes.status ?? null,
      exportStatus: exportRes.status ?? null,
      contentType: exportRes.contentType ?? activityRes.contentType ?? null,
      csvHeader: csv === null ? null : csv.header,
      csvRows: csv === null ? 0 : csv.rows.length
    }
  };
  consoleCache.at = Date.now();
  consoleCache.cookie = cookie;
  consoleCache.value = value;
  return value;
}

/**
 * GET /api/account-usage/opencode-history
 * 当前订阅周期的按天已用额度序列 + 线性外推预测（+ 可选的官方日榜明细）。
 * 官方日榜明细（模型占比 / 请求数 / Tokens）与曲线口径一致，只统计当前周期。
 * 浏览器契约：HTTP 200 + JSON；只有「连周期都算不出来」时才 ok:false。
 */
async function handleOpencodeHistory(ctx, req, res) {
  const url = new URL(req.url ?? "/", "http://localhost");
  const force = url.searchParams.get("refresh") === "1";
  const [snapshot, consoleUsage, store] = await Promise.all([
    latestOpencodeUsage(ctx),
    loadConsoleUsage(ctx, force),
    loadSampleStore()
  ]);
  const monthly = snapshot.ok === true ? snapshot.usage?.monthly ?? null : null;
  // 实时接口挂掉时退回采样库里的最后一个重置时间/百分比：至少还能画出已记录的历史
  const lastSample = [...store.samples].reverse().find((sample) => sample !== null && typeof sample === "object") ?? null;
  const fallbackResetsAt = typeof lastSample?.resetsAt === "string" ? lastSample.resetsAt : null;
  const fallbackPercent = Number.isFinite(Number(lastSample?.percent)) ? Number(lastSample.percent) : null;
  const anchorPercent = monthly?.percent ?? fallbackPercent;
  const period = periodRangeOf(monthly?.resetsAt ?? fallbackResetsAt);
  if (period.start === null) {
    sendHistoryError(
      res,
      "no-period",
      "未能确定当前订阅周期（OpenCode 用量接口不可用或字段变化），请稍后重试"
    );
    return;
  }
  const todayKey = localDate();
  const series = buildDailySeries({
    periodStart: period.start,
    periodEnd: period.end,
    todayKey,
    samples: store.samples,
    consoleDays: consoleUsage.days,
    limitMicroCents: consoleUsage.limitMicroCents,
    anchorPercent
  });
  const forecast = forecastSeries(series, { periodStart: period.start, periodEnd: period.end, todayKey });
  // 控制台导出的 CSV 固定是近 30 天滚动窗口，周期刚重置时会带上上一周期尾段。
  // 「本周期模型用量」必须只统计 [周期起点, min(周期终点, 今天)] 内的行，
  // 否则刚重置时展示的仍是上一周期的模型占比、请求数与 Tokens。
  const periodEndCap = period.end < todayKey ? period.end : todayKey;
  const periodRows =
    consoleUsage.csv === null
      ? []
      : filterCsvRowsByDateRange(consoleUsage.csv.rows, period.start, periodEndCap);
  const models = consoleUsage.csv === null ? null : rollupCsvModels(periodRows).slice(0, 8);
  let totals = null;
  if (periodRows.length > 0) {
    const daily = rollupCsvDaily(periodRows);
    let requests = 0;
    let tokens = 0;
    for (const rec of daily.values()) {
      requests += rec.requests;
      tokens += rec.tokens;
    }
    totals = { requests: Math.round(requests), tokens: Math.round(tokens) };
  }
  const firstSampleDate = (() => {
    for (const sample of store.samples) {
      const ms = Number(sample?.t);
      if (Number.isFinite(ms)) return localDate(new Date(ms));
    }
    return null;
  })();
  sendJson(res, 200, {
    ok: true,
    source: series.source,
    precision: series.source === "console" ? 0.1 : 1,
    period: { start: period.start, end: period.end, resetsAt: period.resetsAt },
    now: {
      date: todayKey,
      currentPercent: anchorPercent,
      stale: snapshot.stale === true,
      status: monthly?.status ?? null
    },
    days: series.days,
    forecast,
    // 纵轴留 15% headroom：预测终点不会贴着图顶（截图即 0/50/100/150 四档）
    grid: {
      max: percentGridMax([
        ...series.days.map((day) => day.cumulativePercent),
        forecast.projectedEndPercent === null ? null : forecast.projectedEndPercent * 1.15
      ])
    },
    models,
    totals,
    sampledSince: firstSampleDate,
    sampleCount: store.samples.length,
    console: {
      configured: consoleUsage.configured,
      status: consoleUsage.status,
      diagnostics: consoleUsage.diagnostics
    }
  });
}

// ---- 本机使用统计账本（「概览」标签页） --------------------------------------

/** 账本文件名：与采样库同目录，可用 DSH_ACCOUNT_USAGE_DATA_DIR 覆盖。 */
function insightsFilePath() {
  return join(sampleDirectory(), "usage-ledger.v1.json");
}

/** 账本内存态；null 表示尚未加载。 */
let insightsLedger = null;
/** 写入串行化：同一进程内不会有两个写入交错。 */
let insightsWriteChain = Promise.resolve();
/** 扫描状态：running 用于前端轮询，abort 用于插件卸载时中断。 */
const insightsScan = { running: false, abort: null, lastFinishedAt: 0 };

/** 两次自动扫描之间的最小间隔：前端轮询不会把扫描拖成死循环。 */
const INSIGHTS_SCAN_MIN_INTERVAL_MS = 60 * 1000;

/** 懒加载账本；文件缺失/损坏时按空账本处理，绝不抛错。 */
async function loadInsightsLedger() {
  if (insightsLedger !== null) return insightsLedger;
  let ledger = emptyLedger(0);
  try {
    const raw = JSON.parse(await readFile(insightsFilePath(), "utf8"));
    if (raw !== null && typeof raw === "object" && raw.sessions !== null && typeof raw.sessions === "object") {
      // 旧版账本（version < LEDGER_VERSION）把子代理继承的父会话历史重复计过账，
      // 这些条目必须重读。做法是给每条打 stale 标记，让 mergeLedger 忽略 revision
      // 直接重扫；同时保留条目本身，已删除会话的历史累计不会因此丢失。
      const stale = rebuildRequired(raw);
      const sessions = stale
        ? Object.fromEntries(Object.entries(raw.sessions).map(([id, entry]) => [id, { ...entry, stale: true }]))
        : raw.sessions;
      ledger = {
        version: LEDGER_VERSION,
        updatedAt: typeof raw.updatedAt === "number" ? raw.updatedAt : 0,
        skipped: typeof raw.skipped === "number" ? raw.skipped : 0,
        sessions
      };
    }
  } catch {
    /* 首次运行、文件缺失或损坏：按空账本处理 */
  }
  insightsLedger = ledger;
  return ledger;
}

/** 原子写账本：先写同目录临时文件再 rename，避免半截 JSON。 */
function persistInsightsLedger(ctx, ledger) {
  insightsWriteChain = insightsWriteChain
    .catch(() => {})
    .then(async () => {
      const file = insightsFilePath();
      await mkdir(dirname(file), { recursive: true });
      const tmp = `${file}.${process.pid}.tmp`;
      await writeFile(tmp, JSON.stringify(ledger), "utf8");
      await rename(tmp, file);
    })
    .catch((error) => {
      ctx.logger?.warn?.("dsh-account-usage: 使用统计账本写入失败");
      ctx.logger?.warn?.(error);
    });
  return insightsWriteChain;
}

/** 读取并折叠单个会话；子代理只算 token，不参与「最长任务用时」。 */
async function readSessionUsage(persistence, snapshot) {
  const handle = await persistence.open(snapshot.header.id, "read");
  try {
    const result = await handle.read();
    const events = result !== null && typeof result === "object" && Array.isArray(result.events) ? result.events : [];
    return foldSessionEvents(events, { trackTurns: snapshot.header.origin !== "subagent" });
  } finally {
    try {
      await handle.close();
    } catch {
      /* 关闭失败不影响已读到的事件 */
    }
  }
}

/** 启动一次后台增量扫描（同一时刻只允许一个）。 */
function startInsightsScan(ctx, persistence) {
  if (insightsScan.running) return;
  insightsScan.running = true;
  const abort = new AbortController();
  insightsScan.abort = abort;
  const run = async () => {
    try {
      const previous = await loadInsightsLedger();
      const snapshots = await persistence.list({ signal: abort.signal });
      const { ledger } = await mergeLedger(previous, snapshots, (snapshot) => readSessionUsage(persistence, snapshot), {
        signal: abort.signal
      });
      insightsLedger = ledger;
      await persistInsightsLedger(ctx, ledger);
    } catch (error) {
      ctx.logger?.warn?.("dsh-account-usage: 使用统计扫描失败");
      ctx.logger?.warn?.(error);
    } finally {
      insightsScan.running = false;
      insightsScan.abort = null;
      insightsScan.lastFinishedAt = Date.now();
    }
  };
  void run();
}

/**
 * GET /api/account-usage/insights：返回账本聚合，并按需触发一次后台增量扫描。
 * `?force=1`（手动刷新）绕过最小间隔；自动轮询在 60 秒内不会重复触发扫描。
 */
async function handleInsights(ctx, req, res) {
  const persistence = typeof ctx.get === "function" ? ctx.get("sessionPersistence") : undefined;
  if (persistence === undefined || persistence === null) {
    sendJson(res, 200, {
      ok: false,
      code: "unsupported",
      message: "当前 DSH 版本不支持使用统计"
    });
    return;
  }
  const url = new URL(req?.url ?? "/", "http://localhost");
  const force = url.searchParams.get("force") === "1";
  const ledger = await loadInsightsLedger();
  const due = force || Date.now() - insightsScan.lastFinishedAt >= INSIGHTS_SCAN_MIN_INTERVAL_MS;
  if (!insightsScan.running && due) startInsightsScan(ctx, persistence);
  const aggregated = aggregateLedger(ledger);
  sendJson(res, 200, {
    ok: true,
    updatedAt: aggregated.updatedAt,
    scanning: insightsScan.running,
    skipped: aggregated.skipped,
    years: aggregated.years,
    days: aggregated.days,
    longestTurnMsByYear: aggregated.longestTurnMsByYear,
    sessions: aggregated.sessions,
    // 活跃会话数（0.6.0）：新增字段纯加法，旧版客户端会忽略。
    sessionsByDay: aggregated.sessionsByDay,
    sessionsByWeek: aggregated.sessionsByWeek,
    sessionsByMonth: aggregated.sessionsByMonth
  });
}

// ---- 插件主体 ----------------------------------------------------------------

function apply(ctx) {
  ctx.effect(
    () =>
      ctx.webServer.register({
        kind: "exact",
        path: "/api/account-usage/deepseek-summary",
        handler: async (req, res) => {
          try {
            await handleSummary(ctx, res);
          } catch (error) {
            ctx.logger.warn("dsh-account-usage: summary route failed");
            ctx.logger.warn(error);
            sendJson(res, 500, { ok: false, code: "internal", message: "internal error" });
          }
        }
      }),
    "dsh-account-usage: summary route"
  );

  ctx.effect(
    () =>
      ctx.webServer.register({
        kind: "exact",
        path: "/api/account-usage/deepseek-usage",
        handler: async (req, res) => {
          try {
            await handleUsage(ctx, req, res);
          } catch (error) {
            ctx.logger.warn("dsh-account-usage: usage route failed");
            ctx.logger.warn(error);
            sendJson(res, 500, { ok: false, code: "internal", message: "internal error" });
          }
        }
      }),
    "dsh-account-usage: usage route"
  );

  ctx.effect(
    () =>
      ctx.webServer.register({
        kind: "exact",
        path: "/api/account-usage/opencode",
        handler: async (req, res) => {
          try {
            await handleOpencode(ctx, res);
          } catch (error) {
            ctx.logger.warn("dsh-account-usage: opencode route failed");
            ctx.logger.warn(error);
            sendJson(res, 500, { ok: false, code: "internal", message: "internal error" });
          }
        }
      }),
    "dsh-account-usage: opencode route"
  );

  // 用量趋势：当前订阅周期的按天已用额度 + 预测（采样 / 官方日榜两种来源）
  ctx.effect(
    () =>
      ctx.webServer.register({
        kind: "exact",
        path: "/api/account-usage/opencode-history",
        handler: async (req, res) => {
          try {
            await handleOpencodeHistory(ctx, req, res);
          } catch (error) {
            ctx.logger.warn("dsh-account-usage: opencode history route failed");
            ctx.logger.warn(error);
            sendJson(res, 500, { ok: false, code: "internal", message: "internal error" });
          }
        }
      }),
    "dsh-account-usage: opencode history route"
  );

  // 本机使用统计（「概览」标签页）：读会话日志折叠出的账本，触发后台增量扫描
  ctx.effect(
    () =>
      ctx.webServer.register({
        kind: "exact",
        path: "/api/account-usage/insights",
        handler: async (req, res) => {
          try {
            await handleInsights(ctx, req, res);
          } catch (error) {
            ctx.logger.warn("dsh-account-usage: insights route failed");
            ctx.logger.warn(error);
            sendJson(res, 500, { ok: false, code: "internal", message: "internal error" });
          }
        }
      }),
    "dsh-account-usage: insights route"
  );

  // 卸载时中断仍在跑的扫描，避免定时/IO 泄漏到下一个实例
  ctx.effect(
    () => () => {
      insightsScan.abort?.abort();
      insightsScan.abort = null;
      insightsScan.running = false;
    },
    "dsh-account-usage: insights scan cleanup"
  );

  // 后台采样：把每月窗口百分比按 15 分钟粒度累积成历史（可 DSH_ACCOUNT_USAGE_SAMPLING=off 关闭）
  ctx.effect(() => startSampleScheduler(ctx), "dsh-account-usage: opencode sample scheduler");
}

export { name, inject, apply };
