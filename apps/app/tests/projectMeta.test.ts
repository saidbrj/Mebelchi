// Project metadata — the CRM-ish layer on top of a saved design: client, phone, address,
// deal status, quote snapshot. Pure storage + predicates, so it's testable without React.
//
// The cases here are the ones that lose a seller's data rather than merely look wrong:
// a record saved before statuses existed, a cloud pull from a database that hasn't had the
// meta migration run, and the updatedAt/metaUpdatedAt split that keeps "По дате" honest.

import { describe, it, expect, beforeEach } from "vitest";

// vitest runs in node — model/projects.ts talks to localStorage directly (and swallows any
// failure), so without a stub every write would silently no-op and the assertions would lie.
class MemStorage {
  private m = new Map<string, string>();
  getItem(k: string) { return this.m.get(k) ?? null; }
  setItem(k: string, v: string) { this.m.set(k, v); }
  removeItem(k: string) { this.m.delete(k); }
  clear() { this.m.clear(); }
  key(i: number) { return [...this.m.keys()][i] ?? null; }
  get length() { return this.m.size; }
}
(globalThis as unknown as { localStorage: Storage }).localStorage = new MemStorage() as unknown as Storage;

import {
  upsertProject, updateProjectMeta, listProjects, replaceAllProjects, allProjects,
  statusOf, isActive, isStale, phoneDigits, telHref, tgHref, mapHref,
  inBucket, DEAL_STATUSES, PROJECT_BUCKETS, STALE_QUOTE_MS, type SavedProject,
  filterSortProjects, matchesQuery, type ProjectMeta,
} from "../src/model/projects";

const KEY = "mebelchi.projects.v1";
const seed = (list: SavedProject[]) => localStorage.setItem(KEY, JSON.stringify(list));
const get = (id: string) => allProjects().find((p) => p.id === id)!;

/** A record exactly as it was written before any of the meta fields existed. */
const legacy: SavedProject = {
  id: "old-1",
  name: "Проект 1",
  createdAt: 1_000,
  updatedAt: 2_000,
  state: { screen: "configure" },
};

beforeEach(() => localStorage.clear());

describe("legacy records keep working", () => {
  it("a project saved before statuses existed reads as «Дизайн» and stays active", () => {
    seed([legacy]);
    const p = listProjects()[0];
    expect(p.status).toBeUndefined();   // nothing was invented on disk
    expect(statusOf(p)).toBe("design"); // …but every reader sees a status
    expect(isActive(p)).toBe(true);
    expect(p.totalUSD).toBeUndefined(); // no fake 0 — the card must show nothing, not "$0"
  });

  it("editing one meta field leaves the rest of a legacy record intact", () => {
    seed([legacy]);
    updateProjectMeta("old-1", { clientPhone: "+998 90 123-45-67" });
    const p = get("old-1");
    expect(p.name).toBe("Проект 1");
    expect(p.state).toEqual({ screen: "configure" });
    expect(p.clientPhone).toBe("+998 90 123-45-67");
  });
});

describe("updateProjectMeta", () => {
  beforeEach(() => seed([legacy]));

  it("stamps metaUpdatedAt and leaves updatedAt alone", () => {
    // the whole point: fixing a phone number must not reorder «По дате», which sorts on updatedAt
    updateProjectMeta("old-1", { clientPhone: "998901234567" });
    const p = get("old-1");
    expect(p.updatedAt).toBe(2_000);
    expect(p.metaUpdatedAt).toBeGreaterThan(2_000);
  });

  it("trims, and lets every field except the name be cleared", () => {
    updateProjectMeta("old-1", { client: "  Алишер  ", address: " Чиланзар 5 " });
    expect(get("old-1").client).toBe("Алишер");
    expect(get("old-1").address).toBe("Чиланзар 5");

    updateProjectMeta("old-1", { client: "", address: "", name: "   " });
    expect(get("old-1").client).toBe("");
    expect(get("old-1").address).toBe("");
    expect(get("old-1").name).toBe("Проект 1"); // a project always keeps a label
  });

  it("ignores an unknown id instead of creating a ghost", () => {
    updateProjectMeta("nope", { client: "X" });
    expect(allProjects()).toHaveLength(1);
  });
});

describe("upsertProject", () => {
  it("stores the quote snapshot and keeps the existing thumbnail when passed null", () => {
    upsertProject("p1", { screen: "configure" }, "Кухня", "data:image/jpeg;base64,AAA", 1240);
    expect(get("p1").totalUSD).toBe(1240);

    upsertProject("p1", { screen: "cost" }, undefined, null, 1315);
    const p = get("p1");
    expect(p.thumbnail).toBe("data:image/jpeg;base64,AAA"); // untouched by the auto-save
    expect(p.totalUSD).toBe(1315);                          // …but the price did move
    expect(p.name).toBe("Кухня");
  });

  it("leaves totalUSD alone when none is passed", () => {
    upsertProject("p1", {}, "Кухня", null, 900);
    upsertProject("p1", {}, undefined, null);
    expect(get("p1").totalUSD).toBe(900);
  });
});

describe("predicates", () => {
  const at = (status: SavedProject["status"], updatedAt: number): SavedProject =>
    ({ id: "x", name: "x", status, createdAt: 0, updatedAt, state: {} });
  const now = 1_000_000_000;

  it("isActive covers the pipeline but not the terminal states", () => {
    expect(isActive(at("measure", now))).toBe(true);
    expect(isActive(at("production", now))).toBe(true);
    expect(isActive(at("installed", now))).toBe(false);
    expect(isActive(at("lost", now))).toBe(false);
  });

  it("isStale is a SENT quote gone quiet — not just an old project", () => {
    const old = now - STALE_QUOTE_MS - 1;
    expect(isStale(at("quoted", old), now)).toBe(true);
    expect(isStale(at("quoted", now), now)).toBe(false);  // sent today
    expect(isStale(at("design", old), now)).toBe(false);  // never sent → nothing to chase
    expect(isStale(at("won", old), now)).toBe(false);
  });
});

describe("filter buckets", () => {
  const at = (status: SavedProject["status"]): SavedProject =>
    ({ id: "x", name: "x", status, createdAt: 0, updatedAt: 0, state: {} });

  it("«Все» really means all — including the archived ones", () => {
    for (const s of DEAL_STATUSES) expect(inBucket(at(s), "all")).toBe(true);
    expect(inBucket(at(undefined), "all")).toBe(true);
  });

  // Every status must have its OWN chip and no other — a project findable only by knowing to
  // clear the filter is how work gets declared lost. The old five roll-ups failed this both
  // ways: `measure` had no chip of its own, while `quoted` matched «В работе» AND «Ждут
  // ответа», so chips that looked mutually exclusive were not.
  it("a project is in exactly ONE stage chip, never none and never two", () => {
    for (const s of DEAL_STATUSES) {
      const hit = PROJECT_BUCKETS.filter((b) => b !== "all" && inBucket(at(s), b));
      expect(hit, `status ${s} matches ${hit.length} chips`).toEqual([s]);
    }
  });

  it("offers one chip per stage plus «Все» — the picker and the filters cannot drift apart", () => {
    expect(PROJECT_BUCKETS).toEqual(["all", ...DEAL_STATUSES]);
  });
});

describe("link helpers", () => {
  it("normalises whatever a seller typed into a dialable number", () => {
    expect(phoneDigits("+998 (90) 123-45-67")).toBe("+998901234567");
    expect(phoneDigits("90 123 45 67")).toBe("901234567");
    expect(telHref("+998 90 123-45-67")).toBe("tel:+998901234567");
    expect(tgHref("+998 90 123-45-67")).toBe("tg://resolve?phone=998901234567"); // tg wants no +
  });

  it("maps by pinned coordinates when present, else by the typed address", () => {
    expect(mapHref({ address: "Чиланзар 5", geo: { lat: 41.28, lng: 69.2 } }))
      .toBe("https://yandex.uz/maps/?pt=69.2,41.28&z=17");
    expect(mapHref({ address: "Чиланзар 5" })).toContain("?text=");
  });
});

describe("replaceAllProjects (login pull)", () => {
  it("keeps local client details when the cloud row predates the meta migration", () => {
    // the data-loss path: sync pulls rows from a database without the new columns, so every
    // meta field arrives undefined. A blind overwrite would wipe the seller's phone numbers.
    seed([{
      ...legacy,
      client: "Алишер", clientPhone: "998901234567", address: "Чиланзар 5",
      status: "quoted", totalUSD: 1240, thumbnail: "data:image/jpeg;base64,AAA",
    }]);

    replaceAllProjects([{ id: "old-1", name: "Проект 1", createdAt: 1_000, updatedAt: 3_000, state: {} }]);

    const p = get("old-1");
    expect(p.clientPhone).toBe("998901234567");
    expect(p.address).toBe("Чиланзар 5");
    expect(p.status).toBe("quoted");
    expect(p.totalUSD).toBe(1240);
    expect(p.thumbnail).toBe("data:image/jpeg;base64,AAA");
    expect(p.updatedAt).toBe(3_000); // the cloud still wins on what it DOES carry
  });

  it("cloud values win over local ones when the cloud has them", () => {
    seed([{ ...legacy, client: "Алишер", status: "design" }]);
    replaceAllProjects([{
      ...legacy, client: "Дилноза", status: "won", updatedAt: 3_000,
    }]);
    const p = get("old-1");
    expect(p.client).toBe("Дилноза");
    expect(p.status).toBe("won");
  });

  it("adds cloud-only projects untouched", () => {
    seed([legacy]);
    replaceAllProjects([legacy, { id: "new-1", name: "Кухня", createdAt: 5, updatedAt: 6, state: {} }]);
    expect(allProjects()).toHaveLength(2);
  });
});

/* ── the Home list: filter + sort ──────────────────────────────────────────── */

// no `as ProjectMeta` — the cast on the first draft of this helper let two statuses that
// don't exist ("archived", "draft") through, and the bucket test failed for that reason
// rather than for a real one. Let the compiler check the fixture.
const proj = (over: Partial<ProjectMeta> & { id: string }): ProjectMeta => ({
  name: "Проект", createdAt: 0, updatedAt: 1, ...over,
});

describe("filterSortProjects — what Home actually shows", () => {
  const list: ProjectMeta[] = [
    proj({ id: "a", name: "Борис", client: "Каримов", clientPhone: "+998 (90) 123-45-67", updatedAt: 300, totalUSD: 50, status: "won" }),
    proj({ id: "b", name: "Алиса", client: "Юсупов", address: "Чиланзар 12", updatedAt: 100, totalUSD: 900, status: "design" }),
    proj({ id: "c", name: "Виктор", updatedAt: 200, totalUSD: 10, status: "lost" }), // «Архив» = отказ
  ];

  it("sorts newest first by default", () => {
    expect(filterSortProjects(list).map((p) => p.id)).toEqual(["a", "c", "b"]);
  });

  it("sorts by name, and reverses on asc", () => {
    expect(filterSortProjects(list, { sortBy: "name", asc: true }).map((p) => p.id)).toEqual(["b", "a", "c"]);
    expect(filterSortProjects(list, { sortBy: "name" }).map((p) => p.id)).toEqual(["c", "a", "b"]);
  });

  it("sorts by deal size", () => {
    expect(filterSortProjects(list, { sortBy: "sum" }).map((p) => p.id)).toEqual(["b", "a", "c"]);
  });

  it("narrows to a deal stage", () => {
    expect(filterSortProjects(list, { bucket: "won" }).map((p) => p.id)).toEqual(["a"]);
    expect(filterSortProjects(list, { bucket: "lost" }).map((p) => p.id)).toEqual(["c"]);
    expect(filterSortProjects(list, { bucket: "design" }).map((p) => p.id)).toEqual(["b"]);
    expect(filterSortProjects(list, { bucket: "all" })).toHaveLength(3);
  });

  it("searches name, client and address", () => {
    expect(filterSortProjects(list, { query: "алис" }).map((p) => p.id)).toEqual(["b"]);
    expect(filterSortProjects(list, { query: "каримов" }).map((p) => p.id)).toEqual(["a"]);
    expect(filterSortProjects(list, { query: "чиланзар" }).map((p) => p.id)).toEqual(["b"]);
  });

  it("finds a client by digits, however the phone was typed", () => {
    expect(filterSortProjects(list, { query: "901234567" }).map((p) => p.id)).toEqual(["a"]);
  });

  it("does not treat a 1–2 digit query as a phone search", () => {
    // "9" appears in nearly every phone — matching on it returns noise, not results
    expect(filterSortProjects(list, { query: "9" })).toHaveLength(0);
  });

  // THE RULE this function exists to hold: an invisible control must not narrow the list.
  it("ignores a bucket and a query that are not on screen", () => {
    // HomeScreen passes undefined when the chips / search box aren't rendered — the seller
    // must never lose cards to a filter with no visible cause
    expect(filterSortProjects(list, { bucket: undefined, query: undefined })).toHaveLength(3);
  });

  it("treats an empty query as no filter at all", () => {
    expect(filterSortProjects(list, { query: "   " })).toHaveLength(3);
  });

  it("does not mutate the list it was given", () => {
    const order = list.map((p) => p.id);
    filterSortProjects(list, { sortBy: "name" });
    expect(list.map((p) => p.id)).toEqual(order);
  });
});
