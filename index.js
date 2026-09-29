/**
 * dsh-account-usage — host half.
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
import { credentialRef } from "@deepseek-ai/dsh-credentials";
import { homedir } from "node:os";
import { join } from "node:path";
import { readFile } from "node:fs/promises";
import {
  localDate,
  parseDateParam,
  monthsBetween,
  parseSummary,
  parseAmount,
  parseCost,
  mergeMonths,
  pickWindow,
  roundCost
} from "./lib/aggregate.js";

const name = "dsh-account-usage";
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
  const bizCode = body?.code ?? body?.data?.biz_code;
  if (bizCode !== 0) {
    if (bizCode === 40002 || bizCode === 40003) {
      return { ok: false, code: "token-expired", message: "平台令牌已过期，请重新登录 platform.deepseek.com" };
    }
    return { ok: false, code: "biz-error", message: `平台接口业务错误 (code ${bizCode ?? "unknown"})` };
  }
  return { ok: true, bizData: body?.data?.biz_data };
}

/** 带短 TTL 缓存的平台请求（cacheKey 不同即独立缓存）。 */
async function cachedPlatform(ctx, path, params, cacheKey) {
  const hit = platformCache.get(cacheKey);
  if (hit !== undefined && Date.now() - hit.at < CACHE_TTL_MS) return hit.value;
  const value = await fetchPlatformJson(ctx, path, params);
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
  const results = await Promise.all(
    months.map(({ year, month }) =>
      Promise.all([
        cachedPlatform(ctx, "/usage/amount", { month, year }, `amount:${year}-${month}`),
        cachedPlatform(ctx, "/usage/cost", { month, year }, `cost:${year}-${month}`)
      ])
    )
  );
  const firstError = results.flat().find((r) => !r.ok);
  if (firstError !== undefined) {
    sendJson(res, 200, { ok: false, code: firstError.code, message: firstError.message });
    return;
  }
  const amountMaps = results.map(([a]) => parseAmount(a.bizData));
  const costMaps = results.map(([, c]) => parseCost(c.bizData));
  const fromKey = localDate(from);
  const toKey = localDate(to);
  const todayKey = localDate(today);
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
  sendJson(res, 200, { ok: true, range: { from: fromKey, to: toKey, clipped }, totals, days, models });
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
}

export { name, inject, apply };
