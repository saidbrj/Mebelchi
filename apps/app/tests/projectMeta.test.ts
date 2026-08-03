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

  it("every status lands in at least one non-«Все» bucket", () => {
    // otherwise a project would be invisible under every chip but "Все" — findable only by
    // knowing to clear the filter, which is how projects get declared lost
    for (const s of DEAL_STATUSES) {
      const hit = PROJECT_BUCKETS.filter((b) => b !== "all" && inBucket(at(s), b));
      expect(hit.length, `status ${s} has no bucket`).toBeGreaterThan(0);
    }
  });

  it("«В работе» excludes the finished and the dead", () => {
    expect(inBucket(at("quoted"), "active")).toBe(true);
    expect(inBucket(at("installed"), "active")).toBe(false);
    expect(inBucket(at("lost"), "active")).toBe(false);
  });

  it("«Выиграно» keeps a deal visible through production and install", () => {
    expect(inBucket(at("won"), "won")).toBe(true);
    expect(inBucket(at("production"), "won")).toBe(true);
    expect(inBucket(at("installed"), "won")).toBe(true);
    expect(inBucket(at("quoted"), "won")).toBe(false);
  });

  it("«Архив» is only the refusals", () => {
    expect(inBucket(at("lost"), "archive")).toBe(true);
    expect(inBucket(at("installed"), "archive")).toBe(false);
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
