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
 * @param {readonly unknown[]} events 会话事件（按 seq 升序）
 * @param {{ trackTurns?: boolean, offsetMin?: number }} options
 *   trackTurns=false 用于子代理会话：token 照算，但不参与「最长任务用时」。
 * @returns {{ days: Record<string, number>, longestTurnMsByYear: Record<string, number>,
 *             firstTime: number|null, lastTime: number|null }}
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

  for (const event of Array.isArray(events) ? events : []) {
    if (event === null || typeof event !== "object") continue;
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

  return { days, longestTurnMsByYear, firstTime, lastTime };
}

/** 空账本。 */
export function emptyLedger(now = Date.now()) {
  return { version: 1, updatedAt: now, skipped: 0, sessions: {} };
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
    if (cached !== undefined && cached.revision === snapshot.revision) {
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
      version: 1,
      updatedAt: now,
      skipped: stats.skipped,
      sessions: next
    },
    stats
  };
}

/** 账本 → 前端需要的聚合数据。 */
export function aggregateLedger(ledger) {
  const days = {};
  const longestTurnMsByYear = {};
  const sessions =
    ledger !== null && typeof ledger === "object" && ledger.sessions !== null && typeof ledger.sessions === "object"
      ? ledger.sessions
      : {};
  let counted = 0;
  let retained = 0;
  for (const entry of Object.values(sessions)) {
    if (entry === null || typeof entry !== "object") continue;
    counted += 1;
    if (entry.retained === true) retained += 1;
    const entryDays = entry.days !== null && typeof entry.days === "object" ? entry.days : {};
    for (const [key, value] of Object.entries(entryDays)) {
      if (typeof value !== "number" || !(value > 0)) continue;
      days[key] = (days[key] ?? 0) + value;
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
  return {
    days,
    longestTurnMsByYear,
    years,
    sessions: { counted, retained },
    updatedAt: typeof ledger?.updatedAt === "number" ? ledger.updatedAt : 0,
    skipped: typeof ledger?.skipped === "number" ? ledger.skipped : 0
  };
}
