/**
 * 使用统计账本（0.5.0）。
 *
 * 把 DSH 会话事件折叠成两样东西：
 *   - days：按本地日的 token 合计（用于累计、峰值、连续天数、热力图）
 *   - longestTurnMsByYear：按年的最长「回合」耗时（用户发一条消息 → turn/end）
 *
 * 合并语义是「只增不减」：会话在 persistence 列表里消失（被清理 / 被删除）时，
 * 账本里已有的条目必须保留并继续计入统计，否则用户删掉一个旧会话就会让累计
 * 数字倒退。
 */

/** 本地日 key（`YYYY-MM-DD`）。offsetMin 取 `Date.prototype.getTimezoneOffset()` 口径。 */
export function localDateKeyOf(ms, offsetMin = new Date().getTimezoneOffset()) {
  const shifted = new Date(ms - offsetMin * 60000);
  const y = shifted.getUTCFullYear();
  const m = String(shifted.getUTCMonth() + 1).padStart(2, "0");
  const d = String(shifted.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** 本地年份（字符串）。 */
export function localYearOf(ms, offsetMin = new Date().getTimezoneOffset()) {
  return String(new Date(ms - offsetMin * 60000).getUTCFullYear());
}

/**
 * TokenUsage → 总 token 数。
 * 与 `dsh-llm-deepseek` 的归一化口径一致：totalTokens = input + output + cacheRead + cacheWrite；
 * 缺 totalTokens 时按同一公式回退。
 */
export function usageTokens(usage) {
  if (usage === null || typeof usage !== "object") return 0;
  if (typeof usage.totalTokens === "number" && Number.isFinite(usage.totalTokens)) {
    return Math.max(0, Math.round(usage.totalTokens));
  }
  const part = (value) =>
    typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 0;
  return Math.round(
    part(usage.inputTokens) + part(usage.outputTokens) + part(usage.cacheReadTokens) + part(usage.cacheWriteTokens)
  );
}

/**
 * 折叠一个会话的事件流。
 *
 * 重要：子代理会话的日志会把父会话历史整段重放一遍，重放结束处有一条
 * `session/end-seed` 事件（`data.inherited === true`）。这段重放的消耗已经
 * 计入父会话，若不跳过就会被重复计费（实测本机 15 个子代理会话因此虚高 33.7%）。
 * 因此先扫描出所有继承种子的最大 seq，再跳过 seq 不大于它的全部事件。
 *
 * @param {readonly unknown[]} events 会话事件（按 seq 升序）
 * @param {{ trackTurns?: boolean, offsetMin?: number }} options
 *   trackTurns=false 用于子代理会话：token 照算，但不参与「最长任务用时」。
 * @returns {{ days: Record<string, number>, longestTurnMsByYear: Record<string, number>,
 *             firstTime: number|null, lastTime: number|null, inheritedCut: number }}
 */
export function foldSessionEvents(events, options = {}) {
  const trackTurns = options.trackTurns !== false;
  const offsetMin = typeof options.offsetMin === "number" ? options.offsetMin : new Date().getTimezoneOffset();
  const days = {};
  const longestTurnMsByYear = {};
  let firstTime = null;
  let lastTime = null;
  /** 回合号 → 开始时间；跨事件累积，结束时结算。 */
  const openTurns = new Map();
  const list = Array.isArray(events) ? events : [];
  // 继承种子的截止点：子代理可能继承多次，取最大的 seq。
  const inheritedCut = inheritedSeedCutOf(list);

  for (const event of list) {
    if (event === null || typeof event !== "object") continue;
    // 跳过父会话历史的重放段（它已在父会话里计过账）。
    if (inheritedCut >= 0 && typeof event.seq === "number" && event.seq <= inheritedCut) continue;
    const time = typeof event.time === "number" && Number.isFinite(event.time) ? event.time : null;
    if (time !== null) {
      if (firstTime === null || time < firstTime) firstTime = time;
      if (lastTime === null || time > lastTime) lastTime = time;
    }
    const type = event.type;
    const data = event.data !== null && typeof event.data === "object" ? event.data : null;
    if (type === "assistant/message") {
      if (time === null || data === null) continue;
      const tokens = usageTokens(data.usage);
      if (tokens <= 0) continue;
      const key = localDateKeyOf(time, offsetMin);
      days[key] = (days[key] ?? 0) + tokens;
      continue;
    }
    if (!trackTurns || data === null) continue;
    const turn = data.turn;
    if (typeof turn !== "number") continue;
    if (type === "turn/start") {
      if (time !== null && !openTurns.has(turn)) openTurns.set(turn, time);
    } else if (type === "turn/end") {
      const start = openTurns.get(turn);
      if (start === undefined || time === null) continue;
      openTurns.delete(turn);
      const ms = time - start;
      if (!(ms > 0)) continue;
      const year = localYearOf(start, offsetMin);
      if (!(longestTurnMsByYear[year] >= ms)) longestTurnMsByYear[year] = ms;
    }
  }

  return { days, longestTurnMsByYear, firstTime, lastTime, inheritedCut };
}

/**
 * 找出「继承种子」事件的截止 seq。
 *
 * 子代理会话被 `isSeeded` 启动时，会先把父会话的全部历史重放进自己的日志，
 * 重放结束处写一条 `session/end-seed`，其 `data.inherited === true`。
 * 这段重放的 token 属于父会话，本会话不应再计一次。
 *
 * @param {readonly unknown[]} events
 * @returns {number} 截止 seq；没有继承种子时返回 -1
 */
export function inheritedSeedCutOf(events) {
  let cut = -1;
  for (const event of Array.isArray(events) ? events : []) {
    if (event === null || typeof event !== "object") continue;
    if (event.type !== "session/end-seed") continue;
    const data = event.data !== null && typeof event.data === "object" ? event.data : null;
    if (data === null || data.inherited !== true) continue;
    const seq = typeof event.seq === "number" && Number.isFinite(event.seq) ? event.seq : -1;
    if (seq > cut) cut = seq;
  }
  return cut;
}

/** 账本结构版本：2 = 跳过子代理继承重放（1 的账本数据虚高，必须重扫）。 */
export const LEDGER_VERSION = 2;

/**
 * 判断读到的旧账本是否需要整体重算。
 *
 * version 1 的账本把子代理继承的父会话历史重复计了一遍（实测虚高 33.7%），
 * 那些条目即使 revision 没变也不能复用，必须重读会话日志。
 *
 * @param {unknown} raw 磁盘上读到的账本（可能缺失/损坏）
 * @returns {boolean} true 表示旧条目不可信、需要重扫
 */
export function rebuildRequired(raw) {
  if (raw === null || typeof raw !== "object") return false;
  const sessions = raw.sessions;
  if (sessions === null || typeof sessions !== "object") return false;
  const version = typeof raw.version === "number" ? raw.version : 0;
  return version < LEDGER_VERSION;
}

/** 空账本。 */
export function emptyLedger(now = Date.now()) {
  return { version: LEDGER_VERSION, updatedAt: now, skipped: 0, sessions: {} };
}

/**
 * 合并账本（只增不减）。
 *
 * @param {object|null} previous 上一版账本
 * @param {readonly {header: {id: string, origin?: string}, revision: string}[]} snapshots
 *   `sessionPersistence.list()` 的结果（已归档会话仍在其中）。
 * @param {(snapshot: object) => Promise<{days: object, longestTurnMsByYear: object, firstTime: number|null, lastTime: number|null}>} readSession
 *   读取并折叠单个会话；抛错时该会话按「跳过」处理（保留旧账本值）。
 * @param {{ now?: number, signal?: AbortSignal }} options
 * @returns {Promise<{ledger: object, stats: {counted: number, retained: number, read: number, skipped: number}}>}
 */
export async function mergeLedger(previous, snapshots, readSession, options = {}) {
  const now = typeof options.now === "number" ? options.now : Date.now();
  const signal = options.signal;
  const previousSessions =
    previous !== null && typeof previous === "object" && previous.sessions !== null && typeof previous.sessions === "object"
      ? previous.sessions
      : {};
  const next = {};
  const stats = { counted: 0, retained: 0, read: 0, skipped: 0 };
  const seen = new Set();

  for (const snapshot of Array.isArray(snapshots) ? snapshots : []) {
    if (signal !== undefined && signal.aborted === true) break;
    const header = snapshot !== null && typeof snapshot === "object" ? snapshot.header : null;
    const id = header !== null && typeof header === "object" ? header.id : null;
    if (typeof id !== "string" || id === "") continue;
    if (seen.has(id)) continue;
    seen.add(id);
    const cached = previousSessions[id];
    // stale=true：旧版本口径的条目，即使 revision 没变也必须重读。
    if (cached !== undefined && cached.revision === snapshot.revision && cached.stale !== true) {
      next[id] = { ...cached, retained: false, lastSeenAt: now };
      stats.counted += 1;
      continue;
    }
    try {
      const folded = await readSession(snapshot);
      next[id] = {
        revision: snapshot.revision,
        days: folded.days ?? {},
        longestTurnMsByYear: folded.longestTurnMsByYear ?? {},
        firstTime: folded.firstTime ?? null,
        lastTime: folded.lastTime ?? null,
        retained: false,
        lastSeenAt: now
      };
      stats.read += 1;
      stats.counted += 1;
    } catch {
      // 单会话读取失败不拖垮整次扫描：沿用旧值，没有旧值就留一条空记录。
      stats.skipped += 1;
      next[id] =
        cached !== undefined
          ? { ...cached, retained: false, lastSeenAt: now }
          : {
              revision: null,
              days: {},
              longestTurnMsByYear: {},
              firstTime: null,
              lastTime: null,
              retained: false,
              lastSeenAt: now
            };
      stats.counted += 1;
    }
  }

  // 列表里消失的会话（已归档后被清理、已删除）：保留账本，继续计入。
  for (const [id, entry] of Object.entries(previousSessions)) {
    if (seen.has(id)) continue;
    next[id] = { ...entry, retained: true };
    stats.retained += 1;
    stats.counted += 1;
  }

  return {
    ledger: {
      version: LEDGER_VERSION,
      updatedAt: now,
      skipped: stats.skipped,
      sessions: next
    },
    stats
  };
}

/** 本地日格式化（与 client 侧 `fmtDate` 同一口径）。 */
function fmtDay(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** `YYYY-MM-DD` 合法性（同时挡住 2026-02-30 这类不存在的日期）。 */
function isDayKey(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(value + "T00:00:00");
  return !Number.isNaN(parsed.getTime()) && fmtDay(parsed) === value;
}

/**
 * 某日所在周的**周一** key（周一为一周起始，与「本周 Token」口径一致）。
 * 用本地 `Date(y, m-1, d)` 运算，跨年、跨月都正确；非法输入返回 null。
 */
export function mondayKeyOf(dayKey) {
  if (!isDayKey(dayKey)) return null;
  const date = new Date(dayKey + "T00:00:00");
  // getDay()：0=周日 … 6=周六；换算成「距离本周周一的天数」= (d + 6) % 7。
  date.setDate(date.getDate() - ((date.getDay() + 6) % 7));
  return fmtDay(date);
}

/** 某日所在月 key（`YYYY-MM`）；非法输入返回 null。 */
export function monthKeyOf(dayKey) {
  if (!isDayKey(dayKey)) return null;
  return dayKey.slice(0, 7);
}

/** 账本 → 前端需要的聚合数据。 */
export function aggregateLedger(ledger) {
  const days = {};
  const longestTurnMsByYear = {};
  const sessions =
    ledger !== null && typeof ledger === "object" && ledger.sessions !== null && typeof ledger.sessions === "object"
      ? ledger.sessions
      : {};
  // 会话数按「会话 id 集合」累计：每日直接计数即可（同一条目内日期键唯一），
  // 每周 / 每月必须用 Set 去重——同一会话在一周或一月里多天活跃只算 1 个。
  const sessionsByDay = {};
  const weekSessionSets = new Map();
  const monthSessionSets = new Map();
  let counted = 0;
  let retained = 0;
  for (const [sessionId, entry] of Object.entries(sessions)) {
    if (entry === null || typeof entry !== "object") continue;
    counted += 1;
    if (entry.retained === true) retained += 1;
    const entryDays = entry.days !== null && typeof entry.days === "object" ? entry.days : {};
    for (const [key, value] of Object.entries(entryDays)) {
      if (typeof value !== "number" || !(value > 0)) continue;
      days[key] = (days[key] ?? 0) + value;
      // 「工作过的会话」口径 = 当天有 Token 消耗的会话，与 token 总额同源。
      sessionsByDay[key] = (sessionsByDay[key] ?? 0) + 1;
      const weekKey = mondayKeyOf(key);
      if (weekKey !== null) {
        if (!weekSessionSets.has(weekKey)) weekSessionSets.set(weekKey, new Set());
        weekSessionSets.get(weekKey).add(sessionId);
      }
      const monthKey = monthKeyOf(key);
      if (monthKey !== null) {
        if (!monthSessionSets.has(monthKey)) monthSessionSets.set(monthKey, new Set());
        monthSessionSets.get(monthKey).add(sessionId);
      }
    }
    const entryTurns =
      entry.longestTurnMsByYear !== null && typeof entry.longestTurnMsByYear === "object"
        ? entry.longestTurnMsByYear
        : {};
    for (const [year, ms] of Object.entries(entryTurns)) {
      if (typeof ms !== "number" || !(ms > 0)) continue;
      if (!(longestTurnMsByYear[year] >= ms)) longestTurnMsByYear[year] = ms;
    }
  }
  const years = [...new Set(Object.keys(days).map((key) => Number(key.slice(0, 4))))]
    .filter((year) => Number.isInteger(year) && year > 1970)
    .sort((a, b) => a - b);
  // Set → 计数对象；键顺序按字母升序，便于前端与快照断言稳定。
  const toCountObject = (sets) => {
    const out = {};
    for (const key of [...sets.keys()].sort()) out[key] = sets.get(key).size;
    return out;
  };
  return {
    days,
    longestTurnMsByYear,
    years,
    sessions: { counted, retained },
    // 活跃会话数（0.6.0）：每日直接计数，每周/每月按会话去重。
    sessionsByDay,
    sessionsByWeek: toCountObject(weekSessionSets),
    sessionsByMonth: toCountObject(monthSessionSets),
    updatedAt: typeof ledger?.updatedAt === "number" ? ledger.updatedAt : 0,
    skipped: typeof ledger?.skipped === "number" ? ledger.skipped : 0
  };
}
