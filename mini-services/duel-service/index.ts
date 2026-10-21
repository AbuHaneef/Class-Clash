/**
 * ClassClash — real-time duel service
 * ─────────────────────────────────────────────────────────────
 * Socket.io mini-service (port 3003) that powers LIVE duels:
 *  • Quick-match queue (same class + subject)
 *  • Instant matches vs Live Trainer bots
 *  • Friend rooms with share codes
 *  • Round-synchronized question flow with server-authoritative
 *    timing, scoring and answer validation
 *  • Forfeit-on-disconnect with rejoin grace period
 *
 * Persistence & scoring authority live in the main Next.js app:
 * this service talks to /api/clash/live/internal/* with a shared
 * secret. The answer key NEVER leaves this process (and never
 * reaches a browser).
 */
import { createServer } from "http";
import { Server, Socket } from "socket.io";

const PORT = 3003;
const INTERNAL_KEY = process.env.LIVE_INTERNAL_KEY ?? "cc-live-internal-key-2026";
const API_BASE = process.env.LIVE_API_BASE ?? "http://127.0.0.1:3000";

const ROUND_REVEAL_MS = 3200;
const COUNTDOWN_STEP_MS = 900;
const COUNTDOWN_FROM = 3;
const DISCONNECT_GRACE_MS = 7000;
const BOT_MIN_DELAY_MS = 1800;

// ── types ────────────────────────────────────────────────────

type LiveUser = {
  id: string;
  displayName: string;
  avatar: string;
  rating: number;
  gradeId: string | null;
  gradeName: string | null;
  onboarded: boolean;
  isBot: boolean;
  seasonPoints: number;
};

type Slot = {
  userId: string;
  displayName: string;
  avatar: string;
  rating: number;
  isBot: boolean;
  botSkill: number;
  socketId: string | null;
};

type SanitizedQuestion = {
  id: string;
  text: string;
  type: string;
  difficulty: string;
  points: number;
  timeLimit: number;
  options: { id: string; text: string }[];
  subjectName: string;
  topicName: string;
};

type RoundDetail = {
  questionId: string;
  chosenOptionId: string | null;
  correct: boolean;
  timeSpentMs: number;
  points: number;
};

type PlayerState = {
  slot: Slot;
  score: number;
  correctCount: number;
  totalTimeMs: number;
  detail: RoundDetail[];
  answeredRound: boolean;
  roundChosen: string | null;
  roundCorrect: boolean;
  roundMs: number;
  roundPoints: number;
};

type Phase = "waiting" | "starting" | "question" | "reveal" | "finished";

type Room = {
  id: string;
  code: string | null;
  subjectId: string;
  gradeId: string;
  vsBot: boolean;
  players: [PlayerState, PlayerState];
  phase: Phase;
  challengeId: string | null;
  subjectName: string;
  gradeName: string;
  questionCount: number;
  questions: SanitizedQuestion[];
  answerKey: Map<string, { correctOptionId: string; basePoints: number }>;
  timePerQuestionSec: number;
  roundIndex: number;
  roundStartMs: number;
  roundEndsAtMs: number;
  timers: NodeJS.Timeout[];
  forfeitTimer: NodeJS.Timeout | null;
  rematch: Set<string>;
  createdAt: number;
  finishedAt: number | null;
  botAnswerTimer: NodeJS.Timeout | null;
};

type QueueEntry = {
  socketId: string;
  userId: string;
  user: LiveUser;
  subjectId: string;
  joinedAt: number;
};

// ── state ────────────────────────────────────────────────────

const rooms = new Map<string, Room>(); // matchId/roomId → Room (waiting + active + finished)
const userRoom = new Map<string, string>(); // userId → roomId (active or finished-not-cleaned)
const queues = new Map<string, QueueEntry[]>(); // `${gradeId}:${subjectId}` → entries

let roomSeq = 0;
const nextRoomId = () => `rm_${Date.now().toString(36)}_${(roomSeq++).toString(36)}`;

function code5(): string {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 5; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}

// ── internal API client ──────────────────────────────────────

async function internal<T = Record<string, unknown>>(
  action: "auth" | "start" | "finish",
  body: Record<string, unknown>,
  timeoutMs = 15000
): Promise<{ ok: boolean; error?: string } & T> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${API_BASE}/api/clash/live/internal/${action}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-internal-key": INTERNAL_KEY },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    return (await res.json()) as { ok: boolean; error?: string } & T;
  } catch {
    return { ok: false, error: "Main app unreachable." } as { ok: boolean; error?: string } & T;
  } finally {
    clearTimeout(t);
  }
}

// ── helpers ──────────────────────────────────────────────────

function speedBonus(ms: number, limitSec: number): number {
  if (limitSec <= 0) return 0;
  const frac = 1 - Math.min(1, ms / (limitSec * 1000));
  return Math.round(20 * frac);
}

function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx > 0) out[part.slice(0, idx).trim()] = part.slice(idx + 1).trim();
  }
  return out;
}

function clearTimers(room: Room) {
  for (const t of room.timers) clearTimeout(t);
  room.timers = [];
  if (room.botAnswerTimer) {
    clearTimeout(room.botAnswerTimer);
    room.botAnswerTimer = null;
  }
}

function later(room: Room, fn: () => void, ms: number) {
  const t = setTimeout(fn, ms);
  room.timers.push(t);
}

function otherPlayer(room: Room, idx: 0 | 1): PlayerState {
  return room.players[idx === 0 ? 1 : 0];
}

function idxOf(room: Room, userId: string): 0 | 1 | null {
  if (room.players[0].slot.userId === userId) return 0;
  if (room.players[1].slot.userId === userId) return 1;
  return null;
}

function socketFor(slot: Slot): Socket | null {
  return slot.socketId ? io.sockets.sockets.get(slot.socketId) ?? null : null;
}

function emitTo(slot: Slot, event: string, payload?: unknown) {
  const s = socketFor(slot);
  if (s) s.emit(event, payload);
}

function publicSlot(slot: Slot) {
  return {
    userId: slot.userId,
    displayName: slot.displayName,
    avatar: slot.avatar,
    rating: slot.rating,
    isBot: slot.isBot,
  };
}

function summaryFor(room: Room, viewerIdx: 0 | 1) {
  const me = room.players[viewerIdx];
  const opp = otherPlayer(room, viewerIdx);
  return {
    roomId: room.id,
    challengeId: room.challengeId,
    subjectId: room.subjectId,
    subjectName: room.subjectName,
    gradeName: room.gradeName,
    questionCount: room.questionCount,
    timePerQuestionSec: room.timePerQuestionSec,
    vsBot: room.vsBot,
    you: { ...publicSlot(me.slot), score: me.score, correctCount: me.correctCount },
    opponent: { ...publicSlot(opp.slot), score: opp.score, correctCount: opp.correctCount },
  };
}

function roundResultFor(room: Room, viewerIdx: 0 | 1) {
  const me = room.players[viewerIdx];
  const opp = otherPlayer(room, viewerIdx);
  const key = room.answerKey.get(room.questions[room.roundIndex]?.id ?? "");
  return {
    index: room.roundIndex,
    correctOptionId: key?.correctOptionId ?? null,
    you: {
      chosenOptionId: me.roundChosen,
      correct: me.roundCorrect,
      points: me.roundPoints,
      ms: me.roundMs,
    },
    opponent: {
      chosenOptionId: opp.roundChosen,
      correct: opp.roundCorrect,
      points: opp.roundPoints,
      ms: opp.roundMs,
    },
    scoreYou: me.score,
    scoreOpp: opp.score,
  };
}

function snapshotFor(room: Room, viewerIdx: 0 | 1) {
  const snap: Record<string, unknown> = {
    ...summaryFor(room, viewerIdx),
    phase: room.phase,
    roundIndex: room.roundIndex,
    lastResult: room.phase === "reveal" || room.phase === "finished" ? roundResultFor(room, viewerIdx) : null,
  };
  if (room.phase === "question" && room.questions[room.roundIndex]) {
    snap.question = {
      index: room.roundIndex,
      total: room.questionCount,
      question: room.questions[room.roundIndex],
      endsAtMs: room.roundEndsAtMs,
      durationSec: room.timePerQuestionSec,
      answered: room.players[viewerIdx].answeredRound,
    };
  }
  return snap;
}

function makePlayerState(slot: Slot): PlayerState {
  return {
    slot,
    score: 0,
    correctCount: 0,
    totalTimeMs: 0,
    detail: [],
    answeredRound: false,
    roundChosen: null,
    roundCorrect: false,
    roundMs: 0,
    roundPoints: 0,
  };
}

function removeFromQueue(userId: string) {
  for (const [key, list] of queues) {
    const before = list.length;
    const filtered = list.filter((e) => e.userId !== userId);
    if (filtered.length !== before) {
      queues.set(key, filtered);
      if (filtered.length === 0) queues.delete(key);
    }
  }
}

function makeRoom(p1: Slot, p2: Slot | null, subjectId: string, gradeId: string, vsBot: boolean, code: string | null): Room {
  const room: Room = {
    id: nextRoomId(),
    code,
    subjectId,
    gradeId,
    vsBot,
    players: [makePlayerState(p1), p2 ? makePlayerState(p2) : makePlayerState({ ...p1, userId: "", socketId: null })],
    phase: "waiting",
    challengeId: null,
    subjectName: "",
    gradeName: "",
    questionCount: 0,
    questions: [],
    answerKey: new Map(),
    timePerQuestionSec: 20,
    roundIndex: 0,
    roundStartMs: 0,
    roundEndsAtMs: 0,
    timers: [],
    forfeitTimer: null,
    rematch: new Set(),
    createdAt: Date.now(),
    finishedAt: null,
    botAnswerTimer: null,
  };
  if (p2) room.players[1] = makePlayerState(p2);
  rooms.set(room.id, room);
  userRoom.set(p1.userId, room.id);
  if (p2) userRoom.set(p2.userId, room.id);
  return room;
}

// ── match lifecycle ──────────────────────────────────────────

async function startMatch(room: Room): Promise<void> {
  const p1 = room.players[0].slot;
  const p2 = room.players[1].slot;
  room.phase = "starting";
  clearTimers(room);

  const r = (await internal("start", {
    p1Id: p1.userId,
    p2Id: room.vsBot ? "trainer" : p2.userId,
    subjectId: room.subjectId,
  })) as unknown as {
    ok: boolean;
    error?: string;
    challengeId: string;
    subjectName: string;
    gradeName: string;
    questionCount: number;
    timePerQuestionSec: number;
    questions: SanitizedQuestion[];
    answerKey: { questionId: string; correctOptionId: string; basePoints: number }[];
    players: { userId: string; displayName: string; avatar: string; rating: number; isBot: boolean; botSkill: number }[];
  };
  if (!r.ok) {
    const msg = r.error ?? "Could not start the live duel.";
    emitTo(p1, "match:error", { message: msg });
    if (!room.vsBot) emitTo(p2, "match:error", { message: msg });
    destroyRoom(room);
    return;
  }

  room.challengeId = r.challengeId as string;
  room.subjectName = r.subjectName as string;
  room.gradeName = r.gradeName as string;
  room.questionCount = r.questionCount as number;
  room.questions = r.questions as SanitizedQuestion[];
  room.timePerQuestionSec = r.timePerQuestionSec as number;
  room.answerKey = new Map(
    (r.answerKey as { questionId: string; correctOptionId: string; basePoints: number }[]).map((k) => [
      k.questionId,
      { correctOptionId: k.correctOptionId, basePoints: k.basePoints },
    ])
  );

  // refresh display info from the authoritative payload
  // (positional: liveStart returns [p1, p2] in request order; the bot
  // slot's placeholder id is replaced with the real trainer's userId)
  const playersInfo = r.players;
  for (let i = 0; i < 2; i++) {
    const info = playersInfo[i];
    const slot = room.players[i].slot;
    const oldId = slot.userId;
    slot.userId = info.userId;
    slot.displayName = info.displayName;
    slot.avatar = info.avatar;
    slot.rating = info.rating;
    slot.isBot = info.isBot;
    slot.botSkill = info.botSkill;
    if (oldId && oldId !== info.userId) {
      if (userRoom.get(oldId) === room.id) userRoom.delete(oldId);
      userRoom.set(info.userId, room.id);
    }
  }

  const pay1 = { ...summaryFor(room, 0), phase: "starting" };
  const pay2 = { ...summaryFor(room, 1), phase: "starting" };
  emitTo(room.players[0].slot, "match:ready", pay1);
  if (!room.vsBot) emitTo(room.players[1].slot, "match:ready", pay2);

  // countdown 3…2…1
  for (let c = COUNTDOWN_FROM; c >= 1; c--) {
    later(room, () => {
      for (const p of room.players) {
        if (!p.slot.isBot) emitTo(p.slot, "match:countdown", { value: c });
      }
    }, (COUNTDOWN_FROM - c) * COUNTDOWN_STEP_MS);
  }
  later(room, () => beginRound(room, 0), COUNTDOWN_FROM * COUNTDOWN_STEP_MS + 400);
}

function beginRound(room: Room, index: number): void {
  if (room.phase === "finished") return;
  clearTimers(room);
  room.phase = "question";
  room.roundIndex = index;
  room.roundStartMs = Date.now();
  room.roundEndsAtMs = room.roundStartMs + room.timePerQuestionSec * 1000;
  for (const p of room.players) {
    p.answeredRound = false;
    p.roundChosen = null;
    p.roundCorrect = false;
    p.roundMs = 0;
    p.roundPoints = 0;
  }

  const q = room.questions[index];
  for (const [i, p] of room.players.entries()) {
    if (!p.slot.isBot) {
      emitTo(p.slot, "question:show", {
        index,
        total: room.questionCount,
        question: q,
        endsAtMs: room.roundEndsAtMs,
        durationSec: room.timePerQuestionSec,
      });
    }
  }

  // bot opponent behaviour
  const bot = room.players[1];
  if (room.vsBot && bot) {
    const window = room.timePerQuestionSec * 1000 - BOT_MIN_DELAY_MS - 800;
    const delay = BOT_MIN_DELAY_MS + Math.floor(Math.random() * Math.max(1000, window));
    room.botAnswerTimer = setTimeout(() => {
      room.botAnswerTimer = null;
      if (room.phase !== "question" || room.roundIndex !== index) return;
      const key = room.answerKey.get(q.id);
      const skill = bot.slot.botSkill || 0.72;
      const correct = Math.random() < skill;
      const wrongOption = q.options.find((o) => o.id !== key?.correctOptionId);
      const chosen = correct ? key?.correctOptionId ?? null : wrongOption?.id ?? null;
      recordAnswer(room, 1, chosen, delay);
    }, delay);
    room.timers.push(room.botAnswerTimer);
  }

  // hard stop for the round
  later(room, () => {
    if (room.phase === "question" && room.roundIndex === index) endRound(room);
  }, room.timePerQuestionSec * 1000 + 350);
}

function recordAnswer(room: Room, idx: 0 | 1, chosenOptionId: string | null, spentMs: number): void {
  const p = room.players[idx];
  if (p.answeredRound) return;
  p.answeredRound = true;
  const q = room.questions[room.roundIndex];
  const key = room.answerKey.get(q.id);
  const valid = chosenOptionId !== null && q.options.some((o) => o.id === chosenOptionId);
  p.roundChosen = valid ? chosenOptionId : null;
  p.roundCorrect = Boolean(valid && key && chosenOptionId === key.correctOptionId);
  p.roundMs = Math.max(0, Math.min(room.timePerQuestionSec * 1000 + 2000, Math.round(spentMs)));
  p.roundPoints = p.roundCorrect
    ? (key?.basePoints ?? 100) + speedBonus(p.roundMs, room.timePerQuestionSec)
    : 0;

  // tell the opponent someone locked in
  const opp = otherPlayer(room, idx);
  if (!opp.slot.isBot) emitTo(opp.slot, "opponent:answered", { byOpponent: true });

  if (room.players[0].answeredRound && room.players[1].answeredRound) {
    endRound(room);
  }
}

function endRound(room: Room): void {
  if (room.phase !== "question") return;
  clearTimers(room);
  room.phase = "reveal";

  // lock unanswered players as timeouts
  for (const p of room.players) {
    if (!p.answeredRound) {
      p.answeredRound = true;
      p.roundChosen = null;
      p.roundCorrect = false;
      p.roundMs = room.timePerQuestionSec * 1000;
      p.roundPoints = 0;
    }
  }

  // commit round → running totals
  const q = room.questions[room.roundIndex];
  for (const p of room.players) {
    p.score += p.roundPoints;
    p.correctCount += p.roundCorrect ? 1 : 0;
    p.totalTimeMs += p.roundMs;
    p.detail.push({
      questionId: q.id,
      chosenOptionId: p.roundChosen,
      correct: p.roundCorrect,
      timeSpentMs: p.roundMs,
      points: p.roundPoints,
    });
  }

  for (const [i, p] of room.players.entries()) {
    if (!p.slot.isBot) emitTo(p.slot, "round:result", roundResultFor(room, i as 0 | 1));
  }

  const next = room.roundIndex + 1;
  if (next >= room.questionCount) {
    later(room, () => finishMatch(room), ROUND_REVEAL_MS);
  } else {
    later(room, () => beginRound(room, next), ROUND_REVEAL_MS);
  }
}

async function finishMatch(room: Room, forfeitWinnerId?: string): Promise<void> {
  if (room.phase === "finished") return;
  clearTimers(room);
  room.phase = "finished";
  room.finishedAt = Date.now();
  console.log(`[finish] room=${room.id} challenge=${room.challengeId} forfeit=${forfeitWinnerId ?? "-"} scores=${room.players.map((p) => `${p.slot.userId.slice(-6)}:${p.score}`).join(" ")}`);

  const payload = {
    challengeId: room.challengeId,
    forfeitWinnerId: forfeitWinnerId ?? null,
    players: room.players.map((p) => ({
      userId: p.slot.userId,
      score: p.score,
      correctCount: p.correctCount,
      totalTimeMs: p.totalTimeMs,
      detail: p.detail,
    })),
  };

  let r = await internal("finish", payload);
  if (!r.ok) {
    console.error(`[finish] first attempt failed: ${r.error}`);
    await new Promise((res) => setTimeout(res, 1500));
    r = await internal("finish", payload);
    if (!r.ok) console.error(`[finish] retry failed: ${r.error}`);
  }
  const finishRes = r as unknown as {
    ok: boolean;
    summary: string;
    players: { userId: string }[];
    [k: string]: unknown;
  };

  for (const p of room.players) {
    if (p.slot.isBot) continue;
    const forfeitLost = Boolean(forfeitWinnerId && forfeitWinnerId !== p.slot.userId);
    emitTo(p.slot, "match:over", {
      result: finishRes.ok ? finishRes : null,
      forfeitLost,
      you: finishRes.ok ? finishRes.players?.find?.((x) => x.userId === p.slot.userId) ?? null : null,
      summary: finishRes.ok
        ? finishRes.summary
        : forfeitLost
          ? "Match ended — you left the match."
          : "Match ended (result could not be saved — nothing was lost).",
    });
  }
}

function destroyRoom(room: Room) {
  clearTimers(room);
  if (room.forfeitTimer) clearTimeout(room.forfeitTimer);
  for (const p of room.players) {
    if (p.slot.userId && userRoom.get(p.slot.userId) === room.id) userRoom.delete(p.slot.userId);
  }
  rooms.delete(room.id);
}

function beginForfeit(room: Room, leftIdx: 0 | 1) {
  if (room.phase === "finished" || room.forfeitTimer) return;
  const stayer = otherPlayer(room, leftIdx);
  if (!stayer.slot.isBot) emitTo(stayer.slot, "match:opponent_left", { graceMs: DISCONNECT_GRACE_MS });
  room.forfeitTimer = setTimeout(() => {
    room.forfeitTimer = null;
    if (room.phase === "finished") return;
    // the stayer wins by forfeit (bot stayer included)
    void finishMatch(room, stayer.slot.userId);
  }, DISCONNECT_GRACE_MS);
}

function cancelForfeit(room: Room) {
  if (room.forfeitTimer) {
    clearTimeout(room.forfeitTimer);
    room.forfeitTimer = null;
  }
}

// ── queue matching ───────────────────────────────────────────

function tryMatchQueue(key: string) {
  const list = queues.get(key);
  if (!list || list.length < 2) return;
  const a = list.shift()!;
  let bIndex = list.findIndex((e) => e.userId !== a.userId);
  if (bIndex === -1) {
    list.unshift(a);
    return;
  }
  const b = list.splice(bIndex, 1)[0];
  if (list.length === 0) queues.delete(key);

  const sa = io.sockets.sockets.get(a.socketId);
  const sb = io.sockets.sockets.get(b.socketId);
  if (!sa || !sb) {
    // one socket vanished — requeue the live one
    const liveEntry = sa ? a : b;
    if (sa || sb) {
      const list2 = queues.get(key) ?? [];
      list2.push(liveEntry);
      queues.set(key, list2);
    }
    return;
  }

  const [gradeId] = key.split(":");
  const room = makeRoom(
    { userId: a.userId, displayName: a.user.displayName, avatar: a.user.avatar, rating: a.user.rating, isBot: false, botSkill: 0, socketId: a.socketId },
    { userId: b.userId, displayName: b.user.displayName, avatar: b.user.avatar, rating: b.user.rating, isBot: false, botSkill: 0, socketId: b.socketId },
    a.subjectId,
    gradeId,
    false,
    null
  );
  void startMatch(room);
}

// ── socket server ────────────────────────────────────────────

const httpServer = createServer();

const io = new Server(httpServer, {
  path: "/",
  cors: { origin: "*", methods: ["GET", "POST"] },
  pingTimeout: 60000,
  pingInterval: 25000,
});

io.on("connection", (socket) => {
  socket.data.user = null;
  console.log(`[conn] socket=${socket.id.slice(0, 8)} cookie=${Boolean(socket.handshake.headers.cookie)} transport=${socket.conn.transport.name}`);

  const cookies = parseCookies(socket.handshake.headers.cookie);
  const token = cookies["clash_session"];

  if (!token) {
    socket.emit("auth:failed", { message: "Sign in to play live duels." });
    return;
  }

  // Handlers attach IMMEDIATELY, but events that arrive before the async
  // auth round-trip completes are buffered and replayed after auth:ok —
  // otherwise a fast client click would be silently dropped.
  const pendingCalls: Array<() => void> = [];
  const getUser = (): LiveUser => socket.data.user as LiveUser;
  const gate = <A extends unknown[]>(fn: (...a: A) => void) => (...args: A) => {
    if (socket.data.user) fn(...args);
    else pendingCalls.push(() => fn(...args));
  };
  attachHandlers(socket, getUser, gate);

  internal<{ user: LiveUser | null }>("auth", { token }, 10000).then((r) => {
    if (!r.ok || !r.user) {
      socket.emit("auth:failed", { message: "Session expired — refresh the page." });
      pendingCalls.length = 0;
      return;
    }
    socket.data.user = r.user as LiveUser;
    socket.emit("auth:ok", { user: r.user });

    // rejoin an in-flight live match if there is one (not a finished one —
    // a finished match should not hijack a fresh visit to the lobby)
    const existingId = userRoom.get(r.user.id);
    const existing = existingId ? rooms.get(existingId) : undefined;
    if (existing && (existing.phase === "starting" || existing.phase === "question" || existing.phase === "reveal")) {
      const idx = idxOf(existing, r.user.id);
      if (idx !== null) {
        cancelForfeit(existing);
        existing.players[idx].slot.socketId = socket.id;
        const other = otherPlayer(existing, idx);
        if (!other.slot.isBot) emitTo(other.slot, "match:opponent_back", {});
        socket.emit("match:rejoin", snapshotFor(existing, idx));
      }
    }

    // replay anything the client sent while auth was in flight
    for (const run of pendingCalls.splice(0)) run();
  });
});

type Gate = <A extends unknown[]>(fn: (...a: A) => void) => (...args: A) => void;

function attachHandlers(socket: Socket, user: () => LiveUser, gate: Gate) {
  // An "active" match is one still in play — finished rooms must NOT block
  // the player from queueing again.
  const requireActive = (): Room | null => {
    const u = user();
    const id = userRoom.get(u.id);
    if (!id) return null;
    const room = rooms.get(id);
    return room && ["starting", "question", "reveal"].includes(room.phase) ? room : null;
  };

  socket.on("queue:join", gate((data: { subjectId?: string }) => {
    const u = user();
    const active = requireActive();
    if (active) {
      const idx = idxOf(active, u.id);
      if (idx !== null) socket.emit("match:rejoin", snapshotFor(active, idx));
      return;
    }
    if (!u.onboarded || !u.gradeId) {
      socket.emit("live:error", { message: "Finish setting up your profile first." });
      return;
    }
    const subjectId = typeof data?.subjectId === "string" ? data.subjectId : "";
    if (!subjectId) {
      socket.emit("live:error", { message: "Pick a subject first." });
      return;
    }
    removeFromQueue(u.id);
    const key = `${u.gradeId}:${subjectId}`;
    const list = queues.get(key) ?? [];
    list.push({ socketId: socket.id, userId: u.id, user: u, subjectId, joinedAt: Date.now() });
    queues.set(key, list);
    socket.emit("queue:status", { searching: true, subjectId, pool: list.length });
    tryMatchQueue(key);
  }));

  socket.on("queue:leave", gate(() => {
    removeFromQueue(user().id);
    socket.emit("queue:status", { searching: false });
  }));

  socket.on("bot:play", gate((data: { subjectId?: string }) => {
    const u = user();
    const active = requireActive();
    if (active) {
      const idx = idxOf(active, u.id);
      if (idx !== null) socket.emit("match:rejoin", snapshotFor(active, idx));
      return;
    }
    if (!u.onboarded || !u.gradeId) {
      socket.emit("live:error", { message: "Finish setting up your profile first." });
      return;
    }
    const subjectId = typeof data?.subjectId === "string" ? data.subjectId : "";
    if (!subjectId) {
      socket.emit("live:error", { message: "Pick a subject first." });
      return;
    }
    const room = makeRoom(
      { userId: u.id, displayName: u.displayName, avatar: u.avatar, rating: u.rating, isBot: false, botSkill: 0, socketId: socket.id },
      { userId: "trainer", displayName: "Live Trainer", avatar: "robot", rating: 1000, isBot: true, botSkill: 0.72, socketId: null },
      subjectId,
      u.gradeId,
      true,
      null
    );
    void startMatch(room);
  }));

  socket.on("room:create", gate((data: { subjectId?: string }) => {
    const u = user();
    const active = requireActive();
    if (active) {
      const idx = idxOf(active, u.id);
      if (idx !== null) socket.emit("match:rejoin", snapshotFor(active, idx));
      return;
    }
    if (!u.onboarded || !u.gradeId) {
      socket.emit("live:error", { message: "Finish setting up your profile first." });
      return;
    }
    const subjectId = typeof data?.subjectId === "string" ? data.subjectId : "";
    if (!subjectId) {
      socket.emit("live:error", { message: "Pick a subject first." });
      return;
    }
    removeFromQueue(u.id);
    const room = makeRoom(
      { userId: u.id, displayName: u.displayName, avatar: u.avatar, rating: u.rating, isBot: false, botSkill: 0, socketId: socket.id },
      null,
      subjectId,
      u.gradeId,
      false,
      code5()
    );
    socket.emit("room:created", { code: room.code, roomId: room.id });
  }));

  socket.on("room:join", gate((data: { code?: string }) => {
    const u = user();
    const active = requireActive();
    if (active) {
      const idx = idxOf(active, u.id);
      if (idx !== null) socket.emit("match:rejoin", snapshotFor(active, idx));
      return;
    }
    const code = typeof data?.code === "string" ? data.code.trim().toUpperCase() : "";
    if (!code) {
      socket.emit("live:error", { message: "Enter a room code." });
      return;
    }
    let target: Room | null = null;
    for (const room of rooms.values()) {
      if (room.code === code && room.phase === "waiting") {
        target = room;
        break;
      }
    }
    if (!target) {
      socket.emit("live:error", { message: "Room not found — check the code." });
      return;
    }
    if (target.players[0].slot.userId === u.id) {
      socket.emit("live:error", { message: "This is your own room — share the code with a classmate." });
      return;
    }
    if (!u.gradeId || u.gradeId !== target.gradeId) {
      socket.emit("live:error", { message: "This live room is for a different class." });
      return;
    }
    removeFromQueue(u.id);
    target.players[1] = makePlayerState({
      userId: u.id,
      displayName: u.displayName,
      avatar: u.avatar,
      rating: u.rating,
      isBot: false,
      botSkill: 0,
      socketId: socket.id,
    });
    target.phase = "starting";
    socket.emit("room:joined", { code });
    void startMatch(target);
  }));

  socket.on("room:cancel", gate(() => {
    const id = userRoom.get(user().id);
    const room = id ? rooms.get(id) : undefined;
    if (room && room.phase === "waiting") {
      emitTo(room.players[0].slot, "match:cancelled", { reason: "Room closed." });
      destroyRoom(room);
    }
  }));

  socket.on("answer:submit", gate((data: { questionIndex?: number; questionId?: string; optionId?: string | null }) => {
    const u = user();
    const room = requireActive();
    if (!room || room.phase !== "question") return;
    const idx = idxOf(room, u.id);
    if (idx === null) return;
    if (typeof data?.questionIndex !== "number" || data.questionIndex !== room.roundIndex) return;
    const q = room.questions[room.roundIndex];
    if (!q || data.questionId !== q.id) return;
    if (room.players[idx].answeredRound) return;
    const spent = Date.now() - room.roundStartMs;
    const chosen = typeof data.optionId === "string" ? data.optionId : null;
    recordAnswer(room, idx, chosen, spent);
  }));

  socket.on("match:leave", gate(() => {
    const u = user();
    const room = requireActive();
    console.log(`[leave] user=${u.id.slice(-6)} room=${room?.id ?? "none"} phase=${room?.phase ?? "-"}`);
    if (!room) return;
    const idx = idxOf(room, u.id);
    if (idx === null) return;
    // NOTE: keep slot.socketId — the socket is still connected and must
    // receive match:over (they left the MATCH, not the page)
    const other = otherPlayer(room, idx);
    void finishMatch(room, other.slot.userId);
  }));

  socket.on("rematch:accept", gate(() => {
    const u = user();
    const id = userRoom.get(u.id);
    const room = id ? rooms.get(id) : undefined;
    if (!room || room.phase !== "finished") return;
    const idx = idxOf(room, u.id);
    if (idx === null) return;
    const subjectId = room.subjectId;
    const gradeId = room.gradeId;
    const p1Slot = { ...room.players[0].slot, socketId: room.players[0].slot.socketId };
    const p2Slot = room.vsBot ? { ...room.players[1].slot } : { ...room.players[1].slot, socketId: room.players[1].slot.socketId };
    const vsBot = room.vsBot;

    if (vsBot) {
      destroyRoom(room);
      const newRoom = makeRoom(p1Slot, p2Slot, subjectId, gradeId, true, null);
      void startMatch(newRoom);
      return;
    }

    room.rematch.add(u.id);
    const other = otherPlayer(room, idx);
    emitTo(other.slot, "rematch:wait", { from: u.displayName });
    if (room.rematch.has(other.slot.userId)) {
      destroyRoom(room);
      const newRoom = makeRoom(p1Slot, p2Slot, subjectId, gradeId, false, null);
      void startMatch(newRoom);
    }
  }));

  socket.on("disconnect", () => {
    const u = socket.data.user as LiveUser | null;
    if (!u) return;
    removeFromQueue(u.id);
    const id = userRoom.get(u.id);
    if (!id) return;
    const room = rooms.get(id);
    if (!room) {
      userRoom.delete(u.id);
      return;
    }
    const idx = idxOf(room, u.id);
    if (idx === null) return;

    if (room.phase === "waiting") {
      // friend room: creator left before anyone joined
      destroyRoom(room);
      return;
    }
    if (room.phase === "finished") {
      room.players[idx].slot.socketId = null;
      // cleanup when both sides are gone (bots have no socket)
      const anySocket = room.players.some((p) => p.slot.socketId);
      if (!anySocket) destroyRoom(room);
      return;
    }
    // mid-match disconnect → grace period, then forfeit
    room.players[idx].slot.socketId = null;
    beginForfeit(room, idx);
  });
}

// ── janitor ──────────────────────────────────────────────────

setInterval(() => {
  const now = Date.now();
  for (const room of [...rooms.values()]) {
    if (room.phase === "waiting" && now - room.createdAt > 20 * 60 * 1000) {
      emitTo(room.players[0].slot, "match:cancelled", { reason: "Room expired." });
      destroyRoom(room);
    } else if (room.phase === "finished" && now - (room.finishedAt ?? now) > 5 * 60 * 1000) {
      destroyRoom(room);
    } else if (room.phase !== "finished" && now - room.createdAt > 45 * 60 * 1000) {
      void finishMatch(room);
    }
  }
  for (const [key, list] of queues) {
    const fresh = list.filter((e) => io.sockets.sockets.has(e.socketId));
    if (fresh.length === 0) queues.delete(key);
    else if (fresh.length !== list.length) queues.set(key, fresh);
  }
}, 60_000);

httpServer.listen(PORT, () => {
  console.log(`[classclash-duel-service] listening on :${PORT}`);
});
