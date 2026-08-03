// "На главную" — landing: greet the designer, start a new project, or jump back into
// a recent one. Projects save automatically as you work (model/projects.ts); the
// profile nudge points first-time users to Настройки.
import { useState, useCallback, useMemo } from "react";
import { useStore } from "../store";
import { useT } from "../i18n/useT";
import { listProjects, isStale, type MetaPatch, type ProjectMeta } from "../model/projects";
import { profileComplete } from "../model/settings";

import { ProjectCard, RenameModal, DeleteModal } from "../components/ProjectCard";
import { Logo } from "../components/logo";

/* ── main screen ────────────────────────────────────────────── */
export function HomeScreen() {
  const t = useT();
  const newProject = useStore((s) => s.newProject);
  const goTo = useStore((s) => s.goTo);
  const openProject = useStore((s) => s.openProject);
  const removeProject = useStore((s) => s.removeProject);
  const renameProject = useStore((s) => s.renameProject);
  const settings = useStore((s) => s.settings);
  const setProjectBucket = useStore((s) => s.setProjectBucket);
  const rev = useStore((s) => s.projectsRev); // re-render when the project list changes

  const [renaming, setRenaming] = useState<ProjectMeta | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const all = useMemo(() => listProjects(), [rev]);
  // Home shows only the 4 most-recent projects (sorting/search live on the Projects tab).
  const recent = [...all].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 4);
  // The one thing a seller loses money on: a quote sent days ago that nobody chased. It's the
  // only agenda item derivable today — deadlines and install dates need a due date on the
  // project first, so the strip stays honest rather than padded with guesses.
  const waiting = all.filter((p) => isStale(p)).length;

  const firstName = settings.name.trim().split(/\s+/)[0];
  const hello = firstName ? t.home.greetingName(firstName) : t.home.greeting;

  const handleSaveRename = useCallback(
    (id: string, patch: MetaPatch) => {
      renameProject(id, patch);
      setRenaming(null);
    },
    [renameProject],
  );

  const showWaiting = useCallback(() => {
    setProjectBucket("quoted");
    goTo("projects");
  }, [setProjectBucket, goTo]);

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
        <div className="qnum"><Logo height={24} /></div>
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

      {all.length > 0 ? (
        <>
          <div className="hc-sec-head">
            <span className="hc-sec-title">{t.home.recent}</span>
            {all.length > recent.length && (
              <button className="hc-sec-all" type="button" onClick={() => goTo("projects")}>{t.home.all(all.length)}</button>
            )}
          </div>
          {/* recent 4 — 2-column card grid */}
          <div className="hc-grid">
            {recent.map((p) => (
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
        </>
      ) : (
        <p className="sub home-empty">{t.home.empty}</p>
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
