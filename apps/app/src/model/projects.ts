// Project persistence — saved kitchen designs in localStorage. A project is the
// design slice of the store (room + quiz + run + materials …) plus light metadata.
// Pure storage layer; the store calls these and owns the live state.

const KEY = "mebelchi.projects.v1";

/** Store fields that make up a saved design (everything else is transient UI). */
export const PERSIST_KEYS = [
  "quiz",
  "shape",
  "roomPoints",
  "openings",
  "interiorWalls",
  "fittings",
  "wallSurfaces",
  "wallLen",
  "ceiling",
  "reveal",
  "splash",
  "closer",
  "underside",
  "led",
  "water",
  "waterWall",
  "constraints",
  "roomName",
  "roomType",
  "floorCovering",
  "variant",
  "genVariants",
  "cabs",
  "cabsFrom",
  "selIdx",
  "runLayout",
  "runStyle",
  "view",
  "mat",
  "mode",
  "xray",
  "hardened",
  "hwGrade",
  "recFixed",
  "adviceApplied",
  "exported",
  "screen",
  "qi",
] as const;

export type DesignState = Record<string, unknown>;

/** Where the DEAL is — set BY HAND by the seller.
 *
 *  Deliberately NOT the same thing as design progress, which is derived for free from the
 *  saved `screen` (store.ts FLOW / resumeScreen). Reaching the Смета screen does not mean the
 *  quote was sent, and a won deal does not mean the app was opened again. Two axes, two fields. */
export type DealStatus =
  | "measure"     // Замер — visited the flat, measuring
  | "design"      // Дизайн — drawing it up
  | "quoted"      // Смета отправлена — waiting on the client
  | "won"         // Согласовано — client said yes
  | "production"  // В производстве
  | "installed"   // Установлено — done
  | "lost";       // Отказ / заморожен

/** Every status, in pipeline order (drives the status picker). */
export const DEAL_STATUSES: DealStatus[] = [
  "measure", "design", "quoted", "won", "production", "installed", "lost",
];

/** Statuses that still need work — everything except the two terminal ones. */
export const ACTIVE_STATUSES: DealStatus[] = ["measure", "design", "quoted", "won", "production"];

/** A quote sitting unanswered this long is worth chasing (drives Home's attention strip). */
export const STALE_QUOTE_MS = 3 * 24 * 60 * 60 * 1000;

export interface ProjectMeta {
  id: string;
  name: string;
  /** Client this kitchen is for (B2B — the designer works for clients). */
  client?: string;
  /** Client's phone — the single field that makes the list actionable (call / Telegram). */
  clientPhone?: string;
  /** Where the flat is. Free text; you visit it twice (замер + монтаж). */
  address?: string;
  /** Pinned coordinates for `address`, when captured. */
  geo?: { lat: number; lng: number };
  /** Deal stage. Absent on records saved before statuses existed — read via `statusOf`. */
  status?: DealStatus;
  /** Quote total SNAPSHOT in USD (the base currency — see model/settings.ts), written on
   *  every design save. The live quote only exists while a project is open, so the list
   *  would otherwise have to load and price every design just to show a number. */
  totalUSD?: number;
  /** Small JPEG data-URL captured from the 3D scene for the project card. */
  thumbnail?: string;
  createdAt: number;
  /** Last time the DESIGN was saved. This is what "По дате" sorts on. */
  updatedAt: number;
  /** Last time the client info was edited — kept apart from `updatedAt` so fixing a typo in
   *  a phone number doesn't shove the project to the top of the recents as if you'd worked on it. */
  metaUpdatedAt?: number;
}

export interface SavedProject extends ProjectMeta {
  state: DesignState;
}

function readAll(): SavedProject[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as SavedProject[]) : [];
  } catch {
    return [];
  }
}

function writeAll(list: SavedProject[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* storage full / unavailable — ignore */
  }
}

export function newProjectId(): string {
  const c = globalThis.crypto as Crypto | undefined;
  if (c?.randomUUID) return c.randomUUID();
  return `p-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;
}

/** Project metadata, newest first (no heavy `state`). */
export function listProjects(): ProjectMeta[] {
  return readAll()
    .map(({ state: _state, ...meta }) => meta)
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

export function loadProjectState(id: string): DesignState | null {
  return readAll().find((p) => p.id === id)?.state ?? null;
}

/** Full saved records (with state) — used by the cloud sync to migrate/mirror. */
export function allProjects(): SavedProject[] {
  return readAll();
}

/** Replace the whole local project cache (cloud sync makes cloud the source of truth).
 *
 *  Cloud wins on every field it actually HAS — but a field it's missing falls back to the local
 *  copy rather than wiping it. That matters for more than thumbnails now: a Supabase project
 *  whose owner hasn't run the meta migration returns rows with no phone/address/status columns,
 *  and a blind overwrite would silently delete client details on the next login. */
export function replaceAllProjects(list: SavedProject[]): void {
  const current = readAll();
  const merged = list.map((p) => {
    const old = current.find((c) => c.id === p.id);
    if (!old) return p;
    return {
      ...p,
      thumbnail: p.thumbnail || old.thumbnail,
      client: p.client ?? old.client,
      clientPhone: p.clientPhone ?? old.clientPhone,
      address: p.address ?? old.address,
      geo: p.geo ?? old.geo,
      status: p.status ?? old.status,
      totalUSD: p.totalUSD ?? old.totalUSD,
      metaUpdatedAt: p.metaUpdatedAt ?? old.metaUpdatedAt,
    };
  });
  writeAll(merged);
}

/** Insert or update a project, stamping updatedAt (createdAt + a default name on
 *  first save). Updates keep the existing name unless one is passed. */
export function upsertProject(
  id: string,
  state: DesignState,
  name?: string,
  thumbnail?: string | null,
  totalUSD?: number,
): void {
  const list = readAll();
  const now = Date.now();
  const i = list.findIndex((p) => p.id === id);
  const thumbPatch = thumbnail ? { thumbnail } : {};
  const sumPatch = totalUSD === undefined ? {} : { totalUSD };
  if (i >= 0) list[i] = { ...list[i], state, updatedAt: now, ...(name ? { name } : {}), ...thumbPatch, ...sumPatch };
  else list.push({ id, name: name ?? defaultProjectName(), createdAt: now, updatedAt: now, state, ...thumbPatch, ...sumPatch });
  writeAll(list);
}

export function deleteProject(id: string): void {
  writeAll(readAll().filter((p) => p.id !== id));
}

/** The client-facing fields, all editable from the project card without opening the design. */
export type MetaPatch = Partial<Pick<ProjectMeta,
  "name" | "client" | "clientPhone" | "address" | "geo" | "status">>;

/** Edit a project's client details without touching its saved design state.
 *
 *  Stamps `metaUpdatedAt`, NOT `updatedAt`: this is bookkeeping, not design work, and bumping
 *  updatedAt made a corrected phone number reorder "По дате" as though the kitchen had changed. */
export function updateProjectMeta(id: string, patch: MetaPatch): void {
  const list = readAll();
  const i = list.findIndex((p) => p.id === id);
  if (i < 0) return;
  const next: SavedProject = { ...list[i], metaUpdatedAt: Date.now() };
  // a blanked-out name falls back to the old one (a project must always have a label);
  // every other field is legitimately clearable.
  if (patch.name !== undefined) next.name = patch.name.trim() || next.name;
  if (patch.client !== undefined) next.client = patch.client.trim();
  if (patch.clientPhone !== undefined) next.clientPhone = patch.clientPhone.trim();
  if (patch.address !== undefined) next.address = patch.address.trim();
  if (patch.geo !== undefined) next.geo = patch.geo;
  if (patch.status !== undefined) next.status = patch.status;
  list[i] = next;
  writeAll(list);
}

/* ── deal status ────────────────────────────────────────────── */

/** A project's stage, defaulting records saved before statuses existed to "Дизайн". */
export function statusOf(p: Pick<ProjectMeta, "status">): DealStatus {
  return p.status ?? "design";
}

/** Still in play — everything but «Установлено» and «Отказ». No longer drives a filter chip
 *  (the filters are exact stages now — see ProjectBucket); kept because "is this deal live"
 *  is the natural predicate for an agenda strip, which is where it will be wanted next. */
export function isActive(p: Pick<ProjectMeta, "status">): boolean {
  return ACTIVE_STATUSES.includes(statusOf(p));
}

/** A quote that's been sitting unanswered — the one thing worth chasing today. */
export function isStale(p: Pick<ProjectMeta, "status" | "updatedAt">, now = Date.now()): boolean {
  return statusOf(p) === "quoted" && now - p.updatedAt > STALE_QUOTE_MS;
}

/** The Projects screen's filter chips. Deliberately coarser than the 7 statuses: a seller
 *  filters by what they intend to DO — chase it, celebrate it, hide it — not by every stage.
 *  Lives here rather than in the screen so Home's "Ждут ответа" banner can deep-link into it. */
/**
 * The Home list filter: «Все», or one exact deal stage.
 *
 * It used to be five invented roll-ups — Все / В работе / Ждут ответа / Выиграно / Архив —
 * and they were wrong in two ways at once. The WORDS appeared nowhere in the status picker,
 * so «Выиграно» and «Согласовано» were the same thing under two names and nothing said so.
 * And the chips OVERLAPPED while looking mutually exclusive: a `quoted` project sat in both
 * «В работе» and «Ждут ответа», a `production` one in both «В работе» and «Выиграно».
 *
 * One vocabulary, one chip per stage, no overlap. `DEAL_STATUSES` is the single source of
 * both the picker and the filter row, so the two cannot drift apart again.
 */
export type ProjectBucket = "all" | DealStatus;
export const PROJECT_BUCKETS: ProjectBucket[] = ["all", ...DEAL_STATUSES];

export function inBucket(p: Pick<ProjectMeta, "status">, b: ProjectBucket): boolean {
  return b === "all" || statusOf(p) === b;
}

/* ── link helpers ───────────────────────────────────────────── */

/** Digits (keeping a leading +) — what `tel:` and Telegram deep links want. */
export function phoneDigits(phone: string): string {
  const d = phone.replace(/[^\d+]/g, "");
  return d.startsWith("+") ? "+" + d.slice(1).replace(/\+/g, "") : d;
}

export function telHref(phone: string): string {
  return `tel:${phoneDigits(phone)}`;
}

/** Telegram-by-phone deep link. Resolves in the installed app; callers fall back to `tel:`
 *  when nothing handles the scheme (Telegram is the default channel for UZ/KZ sellers). */
export function tgHref(phone: string): string {
  return `tg://resolve?phone=${phoneDigits(phone).replace(/^\+/, "")}`;
}

/** Yandex Maps — the one that actually has Uzbek and Kazakh addressing. Prefers the pinned
 *  coordinates when we have them, else searches the typed address. */
export function mapHref(p: Pick<ProjectMeta, "address" | "geo">): string {
  if (p.geo) return `https://yandex.uz/maps/?pt=${p.geo.lng},${p.geo.lat}&z=17`;
  return `https://yandex.uz/maps/?text=${encodeURIComponent(p.address ?? "")}`;
}

/** Default name for a brand-new project (numbered by how many already exist). */
export function defaultProjectName(): string {
  return `Проект ${listProjects().length + 1}`;
}

/* ── the Home list: filter + sort ────────────────────────────────────────────
   Pure, and here rather than inline in HomeScreen, because the rule that keeps it honest is
   easy to lose in JSX: A FILTER MAY ONLY NARROW THE LIST WHILE THE CONTROL THAT SET IT IS ON
   SCREEN. Home hides the search box on a short list, and a query left in state would then
   hide cards with nothing visible to explain why — which a seller reads as lost work, not as
   a filter. The caller passes what is actually rendered; this function does not guess. */

export type ProjectSort = "date" | "name" | "sum";

export interface ProjectListOpts {
  /** the deal-stage chip, or undefined when the chips aren't rendered */
  bucket?: ProjectBucket;
  /** the search text, or undefined when the search box isn't rendered */
  query?: string;
  sortBy?: ProjectSort;
  /** ascending; default false = newest / Z→A first */
  asc?: boolean;
}

/** Does this project match a free-text query? Name, client, address, and — digits-only, so
 *  "901234567" finds a client saved as "+998 (90) 123-45-67" — the phone. */
export function matchesQuery(p: ProjectMeta, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const digits = phoneDigits(query.trim()).replace(/^\+/, "");
  return (
    p.name.toLowerCase().includes(q)
    || (p.client ?? "").toLowerCase().includes(q)
    || (p.address ?? "").toLowerCase().includes(q)
    // a 1–2 digit query would match nearly every phone — noise, not a search
    || (digits.length >= 3 && phoneDigits(p.clientPhone ?? "").includes(digits))
  );
}

export function filterSortProjects(all: ProjectMeta[], opts: ProjectListOpts = {}): ProjectMeta[] {
  const { bucket, query, sortBy = "date", asc = false } = opts;
  return all
    .filter((p) => (bucket ? inBucket(p, bucket) : true))
    .filter((p) => (query ? matchesQuery(p, query) : true))
    .sort((a, b) => {
      const cmp = sortBy === "name" ? a.name.localeCompare(b.name)
        : sortBy === "sum" ? (a.totalUSD ?? 0) - (b.totalUSD ?? 0)
        : a.updatedAt - b.updatedAt;
      return asc ? cmp : -cmp;
    });
}
