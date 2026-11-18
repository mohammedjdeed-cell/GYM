// App state: a small external store persisted to IndexedDB (local-first).
import { useSyncExternalStore } from "react";
import type { DayId, Lang, ProfileKey } from "./data/plan";
import { PROFILES, getDay } from "./data/plan";
import { allSessions, kvGet, kvSet, putSessions } from "./db";
import { syncAll } from "./sync";
import { locale, translate, type TKey } from "./i18n";
import {
  claim,
  devProfile,
  fetchMember,
  onCalendarToken,
  reconnectCalendar,
  signOutNow,
  watchAuth,
  type AuthUser,
  type CalToken,
  type Member,
} from "./auth";
import {
  addDays,
  attendance,
  dateKey,
  defaultSched,
  monthMoney,
  nextDue,
  parseKey,
  weekOf,
  type Done,
  type Sched,
} from "./schedule";
import {
  CalendarAuthError,
  diff,
  eventId,
  push,
  type CalCache,
  type Desired,
  type EventBody,
} from "./gcal";

export { dateKey } from "./schedule";

export interface SetLog {
  done: boolean;
  kg?: number | null;
}
export interface Session {
  id: string;
  profile: ProfileKey;
  dayId: DayId;
  /** local calendar date, YYYY-MM-DD */
  date: string;
  startedAt: number;
  finishedAt: number;
  sets: Record<string, SetLog[]>;
  setsDone: number;
  setsTotal: number;
  updatedAt: number;
  deleted?: boolean;
  /** true until pushed to Firebase */
  dirty?: boolean;
}
export interface Draft {
  startedAt: number;
  sets: Record<string, SetLog[]>;
}
export interface Settings {
  lang: Lang;
  /** whose interface this is – set from the signed-in account */
  profile: ProfileKey;
  rest: 0 | 60 | 90 | 120;
  /** exercises switched to option B, keyed "profile:exerciseId" */
  alt: Record<string, boolean>;
  household: string;
  weight: Record<ProfileKey, boolean>;
  weightUpdatedAt: Record<ProfileKey, number>;
  /** keep Google Calendar in step with the plan */
  calendar: boolean;
  /** usual gym time for calendar events, "HH:MM" */
  gymTime: string;
}
export interface SyncState {
  status: "idle" | "syncing" | "ok" | "error";
  at: number;
  error?: string;
}
export interface AuthState {
  status: "loading" | "out" | "in";
  user: AuthUser | null;
  member: Member | null;
  /** 'none' = signed in but not yet part of a household (show the setup screen) */
  memberStatus: "unknown" | "loading" | "none" | "ok" | "error";
  error?: string;
}
export interface CalState {
  status: "off" | "idle" | "syncing" | "ok" | "needs-auth" | "error";
  /** events that differ from what Google has */
  pending: number;
  at: number;
  error?: string;
}
interface State {
  ready: boolean;
  settings: Settings;
  sessions: Session[];
  drafts: Record<string, Draft>;
  sync: SyncState;
  auth: AuthState;
  schedule: Record<ProfileKey, Sched>;
  cal: CalState;
}

let state: State = {
  ready: false,
  settings: {
    lang: "ar",
    profile: "mohammed",
    rest: 90,
    alt: {},
    household: "",
    weight: { mohammed: false, mai: false },
    weightUpdatedAt: { mohammed: 0, mai: 0 },
    calendar: true,
    gymTime: "18:00",
  },
  sessions: [],
  drafts: {},
  sync: { status: "idle", at: 0 },
  auth: {
    status: "loading",
    user: null,
    member: null,
    memberStatus: "unknown",
  },
  schedule: {
    mohammed: defaultSched(dateKey(new Date())),
    mai: defaultSched(dateKey(new Date())),
  },
  cal: { status: "off", pending: 0, at: 0 },
};
const listeners = new Set<() => void>();
function set(patch: Partial<State>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}
const subscribe = (l: () => void) => (
  listeners.add(l),
  () => listeners.delete(l)
);

export const useStore = () => useSyncExternalStore(subscribe, () => state);
export function useT() {
  const lang = useStore().settings.lang;
  return (key: TKey, vars?: Record<string, string | number>) =>
    translate(lang, key, vars);
}
export const partnerOf = (p: ProfileKey): ProfileKey =>
  p === "mai" ? "mohammed" : "mai";

// ---------- dates ----------
/** Monday 00:00 of the week containing d */
export function weekStart(d: Date) {
  return parseKey(weekOf(dateKey(d)));
}

// ---------- selectors ----------
export const sessionsOf = (sessions: Session[], profile: ProfileKey) =>
  sessions
    .filter((s) => s.profile === profile && !s.deleted)
    .sort((a, b) => b.finishedAt - a.finishedAt);

export const visitDates = (sessions: Session[], profile: ProfileKey) => [
  ...new Set(sessionsOf(sessions, profile).map((s) => s.date)),
];

/** Finished workouts, oldest first – decides which workout comes next. */
export const doneList = (sessions: Session[], profile: ProfileKey): Done[] =>
  sessionsOf(sessions, profile)
    .slice()
    .reverse()
    .map((s) => ({ date: s.date, dayId: s.dayId }));

export function thisWeek(
  sessions: Session[],
  profile: ProfileKey,
  now = new Date(),
) {
  const from = weekOf(dateKey(now));
  return sessionsOf(sessions, profile).filter((s) => s.date >= from);
}

/** The next workout in the rotation: the one after the last workout done (a missed Day 1 stays next). */
export function suggestedDay(
  sessions: Session[],
  profile: ProfileKey,
  _sched: Sched,
  now = new Date(),
): DayId {
  return nextDue(doneList(sessions, profile), dateKey(now));
}

/** Consecutive weeks (ending this week or last week) with at least one session. */
export function weekStreak(
  sessions: Session[],
  profile: ProfileKey,
  now = new Date(),
) {
  const weeks = new Set(
    sessionsOf(sessions, profile).map((s) => weekOf(s.date)),
  );
  let cur = weekOf(dateKey(now));
  if (!weeks.has(cur)) cur = addDays(cur, -7);
  let n = 0;
  while (weeks.has(cur)) {
    n++;
    cur = addDays(cur, -7);
  }
  return n;
}

export const draftKey = (profile: ProfileKey, dayId: string) =>
  `${profile}:${dayId}`;
export const draftSetsDone = (d?: Draft) =>
  d
    ? Object.values(d.sets).reduce(
        (n, l) => n + l.filter((x) => x.done).length,
        0,
      )
    : 0;

/** Last logged weight for an exercise set, used as an input placeholder. */
export function lastKg(
  sessions: Session[],
  profile: ProfileKey,
  exId: string,
  idx: number,
) {
  for (const s of sessionsOf(sessions, profile)) {
    const kg = s.sets[exId]?.[idx]?.kg;
    if (kg != null) return kg;
  }
  return null;
}

/** Most recent session where this exercise had at least one ticked set. */
export function exerciseLast(
  sessions: Session[],
  profile: ProfileKey,
  exId: string,
) {
  for (const s of sessionsOf(sessions, profile)) {
    const logs = s.sets[exId];
    if (!logs?.some((l) => l.done)) continue;
    const kgs = logs.map((l) => l.kg).filter((k): k is number => k != null);
    return {
      at: s.finishedAt,
      done: logs.filter((l) => l.done).length,
      total: logs.length,
      kg: kgs.length ? Math.max(...kgs) : null,
    };
  }
  return null;
}

// ---------- start-up & sign-in ----------
const TOKEN_KEY = "gym-cal-token";
let calToken: (CalToken & { uid: string }) | null = null;
try {
  calToken = JSON.parse(localStorage.getItem(TOKEN_KEY) ?? "null");
} catch {
  calToken = null;
}
const tokenValid = () =>
  !!calToken &&
  calToken.exp > Date.now() &&
  calToken.uid === state.auth.user?.uid;

onCalendarToken((t) => {
  const uid = state.auth.user?.uid;
  // the token can arrive before onAuthStateChanged has reported the user; keep it either way
  calToken = { ...t, uid: uid ?? "" };
  pendingTokenUid = !uid;
  try {
    localStorage.setItem(TOKEN_KEY, JSON.stringify(calToken));
  } catch {
    /* private mode */
  }
  calendarSoon(0);
});
let pendingTokenUid = false;

export async function init() {
  const [settings, drafts, sessions, schedule] = await Promise.all([
    kvGet<Partial<Settings>>("settings"),
    kvGet<Record<string, Draft>>("drafts"),
    allSessions(),
    kvGet<Partial<Record<ProfileKey, Sched>>>("schedule"),
  ]);
  // membership starts with the first logged workout (or today) until set in Settings
  const firstVisit = (p: ProfileKey) =>
    visitDates(sessions, p).sort()[0] ?? dateKey(new Date());
  set({
    ready: true,
    settings: { ...state.settings, ...settings },
    drafts: drafts ?? {},
    sessions,
    schedule: {
      mohammed: schedule?.mohammed ?? defaultSched(firstVisit("mohammed")),
      mai: schedule?.mai ?? defaultSched(firstVisit("mai")),
    },
  });
  void watchAuth(onUser);
  window.addEventListener("online", () => void syncNow());
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible") return;
    if (Date.now() - state.sync.at > 60_000) void syncNow();
    calendarSoon();
  });
}

async function onUser(u: AuthUser | null) {
  if (!u) {
    set({
      auth: {
        status: "out",
        user: null,
        member: null,
        memberStatus: "unknown",
      },
      cal: { status: "off", pending: 0, at: 0 },
    });
    return;
  }
  if (pendingTokenUid && calToken) {
    calToken.uid = u.uid;
    pendingTokenUid = false;
  }
  if (devProfile)
    return applyMember(u, { household: "devhouse", profile: devProfile });
  const cached = await kvGet<Member & { uid: string }>("member");
  if (cached?.uid === u.uid) {
    applyMember(u, cached);
    // re-check in the background (e.g. membership removed in the console)
    fetchMember(u.uid).then(
      (m) =>
        m &&
        (m.household !== cached.household || m.profile !== cached.profile) &&
        applyMember(u, m),
      () => {},
    );
    return;
  }
  set({
    auth: { status: "in", user: u, member: null, memberStatus: "loading" },
  });
  try {
    const m = await fetchMember(u.uid);
    if (m) applyMember(u, m);
    else
      set({
        auth: { status: "in", user: u, member: null, memberStatus: "none" },
      });
  } catch (e) {
    set({
      auth: {
        status: "in",
        user: u,
        member: null,
        memberStatus: "error",
        error: errText(e),
      },
    });
  }
}

function applyMember(u: AuthUser, m: Member) {
  set({ auth: { status: "in", user: u, member: m, memberStatus: "ok" } });
  updateSettings({ profile: m.profile, household: m.household });
  void kvSet("member", { uid: u.uid, ...m });
  void syncNow();
  calendarSoon(0);
}

/** Setup screen: join the household as Mohammed or Mai. */
export async function joinHousehold(household: string, profile: ProfileKey) {
  const u = state.auth.user;
  if (!u) return "error";
  if (!(await claim(household, profile, u))) return "taken";
  applyMember(u, { household, profile });
  return "ok";
}

export async function signOut() {
  await kvSet("member", null);
  calToken = null;
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
  await signOutNow();
}

const errText = (e: unknown) => (e instanceof Error ? e.message : String(e));

// ---------- actions ----------
export function updateSettings(patch: Partial<Settings>) {
  const settings = { ...state.settings, ...patch };
  set({ settings });
  void kvSet("settings", settings);
  if ("gymTime" in patch || "calendar" in patch || "lang" in patch)
    calendarSoon();
}

export function setWeightLogging(profile: ProfileKey, on: boolean) {
  updateSettings({
    weight: { ...state.settings.weight, [profile]: on },
    weightUpdatedAt: {
      ...state.settings.weightUpdatedAt,
      [profile]: Date.now(),
    },
  });
  void syncNow();
}

function writeSchedule(next: Record<ProfileKey, Sched>) {
  set({ schedule: next });
  void kvSet("schedule", next);
  void syncNow();
  calendarSoon();
}

/**
 * Moves the session planned on `orig` to another day ('off' = skip it this week, null = back to
 * the plan). `alsoPartner` applies the same change to the other person's calendar.
 */
export function moveSession(
  orig: string,
  to: string | "off" | null,
  alsoPartner: boolean,
) {
  const me = state.settings.profile;
  const who = alsoPartner ? [me, partnerOf(me)] : [me];
  const next = { ...state.schedule };
  for (const p of who) {
    const moves = { ...next[p].moves };
    if (to === null || to === orig) delete moves[orig];
    else moves[orig] = to;
    next[p] = { ...next[p], moves, updatedAt: Date.now() };
  }
  writeSchedule(next);
}

export function updateSched(
  profile: ProfileKey,
  patch: Partial<Pick<Sched, "since" | "price">>,
) {
  writeSchedule({
    ...state.schedule,
    [profile]: { ...state.schedule[profile], ...patch, updatedAt: Date.now() },
  });
}

function writeDraft(key: string, draft: Draft | null) {
  const drafts = { ...state.drafts };
  if (draft) drafts[key] = draft;
  else delete drafts[key];
  set({ drafts });
  void kvSet("drafts", drafts);
}

function editSet(
  dayId: string,
  exId: string,
  idx: number,
  nSets: number,
  fn: (l: SetLog) => SetLog,
) {
  const key = draftKey(state.settings.profile, dayId);
  const draft = state.drafts[key] ?? { startedAt: Date.now(), sets: {} };
  const logs = Array.from(
    { length: nSets },
    (_, i) => draft.sets[exId]?.[i] ?? { done: false },
  );
  logs[idx] = fn(logs[idx]);
  writeDraft(key, { ...draft, sets: { ...draft.sets, [exId]: logs } });
  return logs[idx];
}

/** Toggles one set; returns true when it is now ticked. */
export const toggleSet = (
  dayId: string,
  exId: string,
  idx: number,
  nSets: number,
) => editSet(dayId, exId, idx, nSets, (l) => ({ ...l, done: !l.done })).done;

export const setKg = (
  dayId: string,
  exId: string,
  idx: number,
  nSets: number,
  kg: number | null,
) => void editSet(dayId, exId, idx, nSets, (l) => ({ ...l, kg }));

export const clearDraft = (dayId: string) =>
  writeDraft(draftKey(state.settings.profile, dayId), null);

export function finishWorkout(
  dayId: DayId,
  exercises: { id: string; sets: number }[],
) {
  const profile = state.settings.profile;
  const key = draftKey(profile, dayId);
  const draft = state.drafts[key];
  const now = Date.now();
  const sets: Record<string, SetLog[]> = {};
  let setsDone = 0;
  let setsTotal = 0;
  for (const ex of exercises) {
    sets[ex.id] = Array.from(
      { length: ex.sets },
      (_, i) => draft?.sets[ex.id]?.[i] ?? { done: false },
    );
    setsDone += sets[ex.id].filter((l) => l.done).length;
    setsTotal += ex.sets;
  }
  const session: Session = {
    id: crypto.randomUUID(),
    profile,
    dayId,
    date: dateKey(new Date()),
    startedAt: draft?.startedAt ?? now,
    finishedAt: now,
    sets,
    setsDone,
    setsTotal,
    updatedAt: now,
    dirty: true,
  };
  set({ sessions: [...state.sessions, session] });
  void putSessions([session]);
  writeDraft(key, null);
  void syncNow();
  calendarSoon();
  return session;
}

export function deleteSession(id: string) {
  const sessions = state.sessions.map((s) =>
    s.id === id
      ? { ...s, deleted: true, dirty: true, updatedAt: Date.now() }
      : s,
  );
  set({ sessions });
  void putSessions(sessions.filter((s) => s.id === id));
  void syncNow();
  calendarSoon();
}

export const pendingCount = (sessions: Session[]) =>
  sessions.filter((s) => s.dirty).length;

// ---------- Firebase sync ----------
let syncing = false;
export async function syncNow() {
  const household = state.settings.household.trim().toLowerCase();
  if (
    !state.auth.member ||
    devProfile ||
    household.length < 6 ||
    syncing ||
    !navigator.onLine
  )
    return;
  syncing = true;
  set({ sync: { ...state.sync, status: "syncing" } });
  try {
    const pushed = state.sessions.filter((s) => s.dirty);
    const remote = await syncAll(
      household,
      pushed,
      state.settings,
      state.schedule,
    );

    // merge: newest updatedAt wins; anything we just pushed is now clean
    const pushedAt = new Map(pushed.map((s) => [s.id, s.updatedAt]));
    const byId = new Map(state.sessions.map((s) => [s.id, s]));
    const changed: Session[] = [];
    for (const [id, at] of pushedAt) {
      const cur = byId.get(id);
      if (cur && cur.updatedAt === at) {
        const clean = { ...cur, dirty: false };
        byId.set(id, clean);
        changed.push(clean);
      }
    }
    for (const r of remote.sessions) {
      const cur = byId.get(r.id);
      if (!cur || r.updatedAt > cur.updatedAt) {
        byId.set(r.id, r);
        changed.push(r);
      }
    }
    set({ sessions: [...byId.values()] });
    void putSessions(changed);

    const s = state.settings;
    const weight = { ...s.weight };
    const weightUpdatedAt = { ...s.weightUpdatedAt };
    for (const p of remote.profiles) {
      if (p.updatedAt > (weightUpdatedAt[p.key] ?? 0)) {
        weight[p.key] = p.weightLogging;
        weightUpdatedAt[p.key] = p.updatedAt;
      }
    }
    updateSettings({ weight, weightUpdatedAt });

    const schedule = { ...state.schedule };
    let schedChanged = false;
    for (const [k, r] of Object.entries(remote.schedules) as [
      ProfileKey,
      Sched,
    ][]) {
      if (
        r.since &&
        (r.updatedAt > schedule[k].updatedAt || schedule[k].updatedAt === 0)
      ) {
        schedule[k] = r;
        schedChanged = true;
      }
    }
    if (schedChanged) {
      set({ schedule });
      void kvSet("schedule", schedule);
    }
    set({ sync: { status: "ok", at: Date.now() } });
    if (changed.length || schedChanged) calendarSoon();
  } catch (e) {
    set({ sync: { status: "error", at: Date.now(), error: errText(e) } });
  } finally {
    syncing = false;
  }
}

// ---------- Google Calendar ----------
const pad = (n: number) => String(n).padStart(2, "0");
const localTime = (ms: number) => {
  const d = new Date(ms);
  return `${dateKey(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}:00`;
};
export const euro = (v: number, lang: Lang) =>
  new Intl.NumberFormat(locale(lang), {
    style: "currency",
    currency: "EUR",
  }).format(v);
export const longDate = (k: string, lang: Lang) =>
  new Intl.DateTimeFormat(locale(lang), {
    weekday: "long",
    day: "numeric",
    month: "short",
  }).format(parseKey(k));

/** The calendar window kept in sync: the last 6 weeks and the next 5. */
function calWindow(sched: Sched) {
  const today = dateKey(new Date());
  const back = addDays(today, -42);
  return {
    today,
    from: sched.since > back ? sched.since : back,
    to: addDays(today, 35),
  };
}

/** The events this person's Google Calendar should have right now. */
export function desiredEvents(): {
  desired: Desired[];
  from: string;
  to: string;
} {
  const { settings, sessions, schedule } = state;
  const { profile, lang, gymTime } = settings;
  const sched = schedule[profile];
  const { today, from, to } = calWindow(sched);
  const mine = sessionsOf(sessions, profile);
  const { slots, extras } = attendance(
    sched,
    visitDates(sessions, profile),
    from,
    to,
    today,
    doneList(sessions, profile),
  );
  const tz =
    Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/Berlin";
  const T = (k: TKey, v?: Record<string, string | number>) =>
    translate(lang, k, v);
  const idx = profile === "mai" ? 1 : 0;
  const app = `${location.origin}${location.pathname}`;
  const perMonth = new Map<string, number>();
  const per = (date: string) => {
    const m = date.slice(0, 7);
    if (!perMonth.has(m)) {
      const d = parseKey(date);
      perMonth.set(
        m,
        monthMoney(
          sched,
          visitDates(sessions, profile),
          d.getFullYear(),
          d.getMonth(),
          today,
        ).per,
      );
    }
    return perMonth.get(m)!;
  };
  const [hh, mm] = gymTime.split(":").map(Number);
  const planned = (date: string) => {
    const d = parseKey(date);
    d.setHours(hh || 18, mm || 0);
    return {
      start: localTime(d.getTime()),
      end: localTime(d.getTime() + 90 * 60_000),
    };
  };
  const actual = (date: string) => {
    const s = mine
      .filter((x) => x.date === date)
      .sort((a, b) => a.startedAt - b.startedAt);
    return s.length
      ? {
          start: localTime(s[0].startedAt),
          end: localTime(
            Math.max(s.at(-1)!.finishedAt, s[0].startedAt + 15 * 60_000),
          ),
        }
      : planned(date);
  };
  const body = (
    summary: string,
    colorId: string,
    when: { start: string; end: string },
    lines: string[],
    remind: boolean,
  ): EventBody => ({
    summary,
    description: [...lines, "", app].join("\n"),
    location: "Gold's Gym Krefeld",
    colorId,
    start: { dateTime: when.start, timeZone: tz },
    end: { dateTime: when.end, timeZone: tz },
    reminders: remind
      ? { useDefault: false, overrides: [{ method: "popup", minutes: 60 }] }
      : { useDefault: false },
    extendedProperties: { private: { gymApp: "1", profile } },
  });

  const desired: Desired[] = [];
  for (const x of slots) {
    const day = getDay(x.dayId);
    const name = `${day.short[lang]}`;
    const money = euro(per(x.date), lang);
    let b: EventBody;
    if (x.status === "done")
      b = body(
        `✅ ${T("calWent")} · ${name}`,
        "10",
        actual(x.date),
        [day.title[lang], T("calUsed", { m: money })],
        false,
      );
    else if (x.status === "missed")
      b = body(
        `❌ ${T("calMissed")} · ${name}`,
        "11",
        planned(x.date),
        [day.title[lang], T("calLost", { m: money })],
        false,
      );
    else if (x.status === "skipped")
      b = body(
        `⏭ ${T("calSkipped")} · ${name}`,
        "8",
        planned(x.date),
        [day.title[lang], T("calLost", { m: money })],
        false,
      );
    else if (x.status === "covered")
      b = body(
        `↪ ${name} · ${T("calMadeUp")}`,
        "8",
        planned(x.date),
        [
          day.title[lang],
          T("calMadeUpOn", {
            d: x.coveredBy ? longDate(x.coveredBy, lang) : "",
          }),
        ],
        false,
      );
    else
      b = body(
        `🏋️ ${T("calGym")} · ${name}`,
        "9",
        planned(x.date),
        [day.title[lang], T("calWorth", { m: money })],
        true,
      );
    desired.push({ id: eventId("s", idx, x.orig), date: x.date, body: b });
  }
  for (const date of extras) {
    const s = mine.find((x) => x.date === date);
    const day = getDay(s?.dayId ?? "d1");
    desired.push({
      id: eventId("x", idx, date),
      date,
      body: body(
        `✅ ${T("calWent")} · ${day.short[lang]} (${T("calExtra")})`,
        "10",
        actual(date),
        [day.title[lang]],
        false,
      ),
    });
  }
  return { desired, from, to };
}

let calTimer: ReturnType<typeof setTimeout> | undefined;
let calBusy = false;
/** Debounced calendar update after any change. */
export function calendarSoon(ms = 1500) {
  clearTimeout(calTimer);
  calTimer = setTimeout(() => void syncCalendar(), ms);
}

const cacheKey = () => `gcal:${state.auth.user?.uid}`;

export async function syncCalendar() {
  if (!state.auth.member || !state.settings.calendar)
    return set({ cal: { status: "off", pending: 0, at: 0 } });
  if (calBusy) return calendarSoon();
  calBusy = true;
  try {
    const { desired, from, to } = desiredEvents();
    const cache = (await kvGet<CalCache>(cacheKey())) ?? {};
    const { upserts, deletes } = diff(desired, cache, from, to);
    const pending = upserts.length + deletes.length;
    if (!pending)
      return set({ cal: { status: "ok", pending: 0, at: Date.now() } });
    if (!tokenValid())
      return set({ cal: { ...state.cal, status: "needs-auth", pending } });
    if (!navigator.onLine)
      return set({ cal: { ...state.cal, status: "idle", pending } });
    set({ cal: { ...state.cal, status: "syncing", pending } });
    const res = await push(calToken!.token, desired, cache, from, to);
    await kvSet(cacheKey(), res.cache);
    const left = (() => {
      const d = diff(desired, res.cache, from, to);
      return d.upserts.length + d.deletes.length;
    })();
    if (res.error instanceof CalendarAuthError) {
      calToken = null;
      set({ cal: { ...state.cal, status: "needs-auth", pending: left } });
    } else if (res.error)
      set({
        cal: {
          status: "error",
          pending: left,
          at: Date.now(),
          error: errText(res.error),
        },
      });
    else set({ cal: { status: "ok", pending: 0, at: Date.now() } });
  } finally {
    calBusy = false;
  }
}

/** Must run straight from a tap: it opens Google's (one-tap) permission popup. */
export async function connectCalendar() {
  if (!state.settings.calendar) updateSettings({ calendar: true });
  if (tokenValid()) return syncCalendar();
  try {
    await reconnectCalendar(state.auth.user?.email ?? "");
  } catch (e) {
    set({ cal: { ...state.cal, status: "error", error: errText(e) } });
  }
}

export const profileName = (p: ProfileKey, lang: Lang) => PROFILES[p][lang];
