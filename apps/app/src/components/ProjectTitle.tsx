// The journey top bar's centre slot: whose kitchen this is. Tapping it opens the same details
// sheet the project card uses, so a seller can put a client's name and phone on the project the
// moment they're standing in the flat — without leaving the design and going back to the list.
import { useState, useMemo, type ReactNode } from "react";
import { useStore } from "../store";
import { useT } from "../i18n/useT";
import { listProjects, type ProjectMeta } from "../model/projects";
import { RenameModal } from "./ProjectCard";

export function ProjectTitle({ sub }: { sub?: ReactNode }) {
  const t = useT();
  const currentProjectId = useStore((s) => s.currentProjectId);
  const rev = useStore((s) => s.projectsRev); // re-read the name after an edit
  const saveCurrent = useStore((s) => s.saveCurrent);
  const renameProject = useStore((s) => s.renameProject);
  const [editing, setEditing] = useState<ProjectMeta | null>(null);

  const meta = useMemo(
    () => (currentProjectId ? listProjects().find((p) => p.id === currentProjectId) : undefined),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- rev is the invalidation signal
    [currentProjectId, rev],
  );

  const open = () => {
    // A brand-new project has no record until the first save — currentProjectId is null and the
    // name doesn't exist yet — so there'd be nothing to edit. Mint the record first; naming a
    // project is exactly the moment it's worth persisting.
    let m = meta;
    if (!m) {
      saveCurrent();
      const id = useStore.getState().currentProjectId;
      m = id ? listProjects().find((p) => p.id === id) : undefined;
    }
    if (m) setEditing(m);
  };

  return (
    <>
      <button className="cfg-title cfg-title-btn" type="button" onClick={open}>
        <span className="cfg-title-name">
          <span className="cfg-title-text">{meta?.name ?? t.projects.untitled}</span>
          <span className="cfg-title-caret" aria-hidden>⌄</span>
        </span>
        {sub}
      </button>

      {editing && (
        <RenameModal
          p={editing}
          t={t}
          onSave={(patch) => { renameProject(editing.id, patch); setEditing(null); }}
          onCancel={() => setEditing(null)}
        />
      )}
    </>
  );
}
