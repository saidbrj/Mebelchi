import { useState, useCallback, useMemo } from "react";
import { useStore } from "../store";
import { useT } from "../i18n/useT";
import { listProjects, inBucket, PROJECT_BUCKETS, phoneDigits, type MetaPatch, type ProjectMeta } from "../model/projects";
import { ProjectCard, RenameModal, DeleteModal } from "../components/ProjectCard";
import { IconSearch } from "../components/icons";

const BUCKET_LABEL = {
  all: "filterAll", active: "filterActive", quoted: "filterQuoted",
  won: "filterWon", archive: "filterArchive",
} as const;

export function ProjectsScreen() {
  const t = useT();
  const openProject = useStore((s) => s.openProject);
  const removeProject = useStore((s) => s.removeProject);
  const renameProject = useStore((s) => s.renameProject);
  const newProject = useStore((s) => s.newProject);
  const authUser = useStore((s) => s.authUser);
  const syncBusy = useStore((s) => s.syncBusy);
  const syncError = useStore((s) => s.syncError);

  const [renaming, setRenaming] = useState<ProjectMeta | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState<"date" | "name" | "sum">("date");
  const [asc, setAsc] = useState(false); // default: newest / A→Z-reversed first (descending)
  // Home's "Ждут ответа" banner hands us a bucket on the way in; otherwise show everything.
  // Defaulting to a filter would hide projects on arrival, which reads as data loss.
  const bucket = useStore((s) => s.projectBucket);
  const setBucket = useStore((s) => s.setProjectBucket);
  const showPricing = useStore((s) => s.settings.showPricing);
  const rev = useStore((s) => s.projectsRev);

  const all = useMemo(() => listProjects(), [rev]);

  const q = query.trim().toLowerCase();
  // digits-only so "901234567" finds a client saved as "+998 (90) 123-45-67"
  const qDigits = phoneDigits(query.trim()).replace(/^\+/, "");
  const projects = all
    .filter((p) => inBucket(p, bucket))
    .filter((p) => !q
      || p.name.toLowerCase().includes(q)
      || (p.client ?? "").toLowerCase().includes(q)
      || (p.address ?? "").toLowerCase().includes(q)
      || (qDigits.length >= 3 && phoneDigits(p.clientPhone ?? "").includes(qDigits)))
    .sort((a, b) => {
      const cmp = sortBy === "name" ? a.name.localeCompare(b.name)
        : sortBy === "sum" ? (a.totalUSD ?? 0) - (b.totalUSD ?? 0)
        : a.updatedAt - b.updatedAt;
      return asc ? cmp : -cmp;
    });

  const handleSaveRename = useCallback(
    (id: string, patch: MetaPatch) => {
      renameProject(id, patch);
      setRenaming(null);
    },
    [renameProject],
  );

  const handleDelete = useCallback(
    (id: string) => {
      removeProject(id);
      setDeleting(null);
    },
    [removeProject],
  );

  return (
    <section className="screen home-grid-screen">
      <h1 className="h1">{t.projects.title}</h1>

      {authUser && (
        <div className={`proj-cloud ${syncBusy > 0 ? "busy" : syncError ? "err" : "ok"}`}>
          <span className="proj-cloud-dot" />
          {syncBusy > 0 ? t.projects.cloudSyncing : syncError ? t.projects.cloudOffline : t.projects.cloudSaved}
        </div>
      )}

      {/* search + sort */}
      <div className="search-box proj-search">
        <input className="search-input" placeholder={t.projects.search} value={query} onChange={(e) => setQuery(e.target.value)} />
        <span className="search-ic"><IconSearch /></span>
      </div>
      {/* deal-stage buckets — what to DO with a project, not which screen it's on */}
      <div className="proj-buckets">
        {PROJECT_BUCKETS.map((b) => (
          <button
            key={b}
            className={`hc-filter-pill${b === bucket ? " on" : ""}`}
            type="button"
            onClick={() => setBucket(b)}
          >
            {t.projects[BUCKET_LABEL[b]]}
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

      {all.length === 0 ? (
        <p className="sub" style={{ marginTop: 16 }}>
          {t.projects.empty}
        </p>
      ) : projects.length === 0 ? (
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

      {renaming && (
        <RenameModal
          p={renaming}
          t={t}
          onSave={(patch) => handleSaveRename(renaming.id, patch)}
          onCancel={() => setRenaming(null)}
        />
      )}

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
