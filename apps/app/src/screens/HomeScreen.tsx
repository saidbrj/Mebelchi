// "На главную" — the landing screen AND the full deal list. There used to be a second
// «Проекты» tab holding the search / stage filters / sorting while Home showed only the
// four most-recent cards; the split meant every real lookup ("where's the Karimov job?")
// started with a tab switch, and the two screens rendered the same ProjectCard grid from
// the same store. They are one screen now, and the freed tab slot goes to the catalog.
//
// The list controls only appear once there are enough projects to need them — a search
// box over two cards is furniture, not a feature.
import { useState, useCallback, useMemo } from "react";
import { useStore } from "../store";
import { useT } from "../i18n/useT";
import { listProjects, isStale, filterSortProjects, PROJECT_BUCKETS, type ProjectBucket, type ProjectSort, type MetaPatch, type ProjectMeta } from "../model/projects";
import { profileComplete } from "../model/settings";

import { ProjectCard, RenameModal, DeleteModal } from "../components/ProjectCard";
import { Logo } from "../components/logo";
import { IconSearch } from "../components/icons";

/** A filter chip's label. «Все» is the only one that isn't a stage; every other chip reuses
 *  the SAME status wording the edit sheet and the card pill use, so a seller never has to work
 *  out that «Выиграно» and «Согласовано» meant the same thing. `statusShort` rather than
 *  `statusLabel` because that is what the card pill under it says. */
const bucketLabel = (b: ProjectBucket, t: ReturnType<typeof useT>) =>
  b === "all" ? t.projects.filterAll : t.projects.statusShort[b];

/** The SEARCH BOX alone waits for a list worth searching — it costs a full row and nobody
 *  types a query to find one of four cards. The stage filters and sort do NOT wait: they are
 *  one compact row each, and they are how a seller learns this list is a deal pipeline rather
 *  than a folder. Hiding them until the fourth project meant the person who asked for the
 *  merged screen could not find them at all. */
const SEARCH_FROM = 5;

/* ── main screen ────────────────────────────────────────────── */
export function HomeScreen() {
  const t = useT();
  const goTo = useStore((s) => s.goTo);
  const openProject = useStore((s) => s.openProject);
  const removeProject = useStore((s) => s.removeProject);
  const renameProject = useStore((s) => s.renameProject);
  const settings = useStore((s) => s.settings);
  const authUser = useStore((s) => s.authUser);
  const syncBusy = useStore((s) => s.syncBusy);
  const syncError = useStore((s) => s.syncError);
  const rev = useStore((s) => s.projectsRev); // re-render when the project list changes

  // the deal-stage bucket lives in the store because the "Ждут ответа" banner sets it
  const bucket = useStore((s) => s.projectBucket);
  const setBucket = useStore((s) => s.setProjectBucket);
  const showPricing = useStore((s) => s.settings.showPricing);

  const [renaming, setRenaming] = useState<ProjectMeta | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState<ProjectSort>("date");
  const [asc, setAsc] = useState(false); // default: newest first (descending)

  const all = useMemo(() => listProjects(), [rev]);
  const showControls = all.length > 0;
  const showSearch = all.length >= SEARCH_FROM;

  // The one thing a seller loses money on: a quote sent days ago that nobody chased. It's the
  // only agenda item derivable today — deadlines and install dates need a due date on the
  // project first, so the strip stays honest rather than padded with guesses.
  const waiting = all.filter((p) => isStale(p)).length;

  const firstName = settings.name.trim().split(/\s+/)[0];
  const hello = firstName ? t.home.greetingName(firstName) : t.home.greeting;

  // Pass ONLY the controls that are actually on screen (model/projects.ts spells out why):
  // a bucket or a query left in state while its control is unmounted would hide cards with
  // nothing visible to explain it, which reads as lost work rather than as a filter.
  const projects = filterSortProjects(all, {
    bucket: showControls ? bucket : undefined,
    query: showSearch ? query : undefined,
    sortBy: showControls ? sortBy : "date",
    asc: showControls ? asc : false,
  });

  const handleSaveRename = useCallback(
    (id: string, patch: MetaPatch) => {
      renameProject(id, patch);
      setRenaming(null);
    },
    [renameProject],
  );

  // the banner now filters the list in place — there is no other screen to send them to
  const showWaiting = useCallback(() => setBucket("quoted"), [setBucket]);

  const handleDelete = useCallback(
    (id: string) => {
      removeProject(id);
      setDeleting(null);
    },
    [removeProject],
  );

  return (
    <section className="screen home home-grid-screen">
      {/* header */}
      <div className="qblock">
        <div className="qnum"><Logo height={14} /></div>
        <h1 className="h1">{hello}</h1>
        <p className="sub">{t.home.sub}</p>
      </div>

      {!profileComplete(settings) && (
        <button className="home-nudge" onClick={() => goTo("user")} type="button">
          <span>{t.home.nudge}</span>
          <span className="home-nudge-sub">{t.home.nudgeSub}</span>
        </button>
      )}

      {waiting > 0 && (
        <button className="home-attention" onClick={showWaiting} type="button">
          <span>{t.projects.awaiting(waiting)}</span>
          <span className="home-nudge-sub">{t.projects.awaitingSub}</span>
        </button>
      )}

      {authUser && (
        <div className={`proj-cloud ${syncBusy > 0 ? "busy" : syncError ? "err" : "ok"}`}>
          <span className="proj-cloud-dot" />
          {syncBusy > 0 ? t.projects.cloudSyncing : syncError ? t.projects.cloudOffline : t.projects.cloudSaved}
        </div>
      )}

      <div className="home-quick-cards" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, margin: "14px 0" }}>
        <button
          type="button"
          className="home-quick-card"
          onClick={() => useStore.getState().newProject()}
          style={{
            background: "linear-gradient(135deg, rgba(0, 172, 122, 0.12), rgba(5, 150, 105, 0.08))",
            border: "1.5px solid rgba(16, 185, 129, 0.3)",
            borderRadius: 14,
            padding: "12px 14px",
            textAlign: "left",
            cursor: "pointer",
            display: "flex",
            flexDirection: "column",
            gap: 4,
          }}
        >
          <span style={{ fontSize: 20 }}>✨</span>
          <strong style={{ fontSize: 13, color: "#0f172a" }}>Новая кухня</strong>
          <span style={{ fontSize: 11, color: "#64748b" }}>Создать проект с нуля</span>
        </button>

        <button
          type="button"
          className="home-quick-card"
          onClick={() => goTo("catalog")}
          style={{
            background: "#fff",
            border: "1.5px solid #e2e8f0",
            borderRadius: 14,
            padding: "12px 14px",
            textAlign: "left",
            cursor: "pointer",
            display: "flex",
            flexDirection: "column",
            gap: 4,
          }}
        >
          <span style={{ fontSize: 20 }}>🗄️</span>
          <strong style={{ fontSize: 13, color: "#0f172a" }}>Библиотека шкафов</strong>
          <span style={{ fontSize: 11, color: "#64748b" }}>Каталог и свои модули</span>
        </button>
      </div>

      {all.length === 0 ? (
        <p className="sub home-empty">{t.home.empty}</p>
      ) : (
        <>
          <div className="hc-sec-head">
            <span className="hc-sec-title">{t.projects.title}</span>
            <span className="hc-sec-count">{all.length}</span>
          </div>

          {showControls && (
            <>
              {/* a search box earns its row only once the list is long enough to get lost in */}
              {showSearch && (
                <div className="search-box proj-search">
                  <input className="search-input" placeholder={t.projects.search} value={query} onChange={(e) => setQuery(e.target.value)} />
                  <span className="search-ic"><IconSearch /></span>
                </div>
              )}

              {/* deal-stage buckets — what to DO with a project, not which screen it's on */}
              <div className="proj-buckets">
                {PROJECT_BUCKETS.map((b) => (
                  <button
                    key={b}
                    className={`hc-filter-pill${b === bucket ? " on" : ""}`}
                    type="button"
                    onClick={() => setBucket(b)}
                  >
                    {bucketLabel(b, t)}
                  </button>
                ))}
              </div>

              <div className="proj-sort">
                <button className={`hc-filter-pill${sortBy === "date" ? " on" : ""}`} type="button" onClick={() => setSortBy("date")}>{t.projects.byDate}</button>
                <button className={`hc-filter-pill${sortBy === "name" ? " on" : ""}`} type="button" onClick={() => setSortBy("name")}>{t.projects.byName}</button>
                {/* sorting by deal size is meaningless with pricing switched off — no card shows a sum */}
                {showPricing && (
                  <button className={`hc-filter-pill${sortBy === "sum" ? " on" : ""}`} type="button" onClick={() => setSortBy("sum")}>{t.projects.bySum}</button>
                )}
                <button className="hc-filter-pill proj-dir" type="button" onClick={() => setAsc((v) => !v)} aria-label="asc/desc">{asc ? "↑" : "↓"}</button>
              </div>
            </>
          )}

          {projects.length === 0 ? (
            <p className="sub" style={{ marginTop: 16 }}>{t.projects.nothingFound}</p>
          ) : (
            <div className="hc-grid">
              {projects.map((p) => (
                <ProjectCard
                  key={p.id}
                  p={p}
                  t={t}
                  onOpen={() => openProject(p.id)}
                  onRename={() => setRenaming(p)}
                  onDelete={() => setDeleting(p.id)}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* rename modal */}
      {renaming && (
        <RenameModal
          p={renaming}
          t={t}
          onSave={(patch) => handleSaveRename(renaming.id, patch)}
          onCancel={() => setRenaming(null)}
        />
      )}

      {/* delete confirmation */}
      {deleting && (
        <DeleteModal
          t={t}
          onConfirm={() => handleDelete(deleting)}
          onCancel={() => setDeleting(null)}
        />
      )}
    </section>
  );
}
