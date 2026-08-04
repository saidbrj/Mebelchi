// «Каталог» — what the SHOP owns, as opposed to what a project uses. Three lists behind one
// segmented control:
//   Материалы  → the boards: фасад / корпус / задняя стенка / столешница
//   Фурнитура  → handles and the like (part === "handle")
//   Мои шкафы  → the reusable cabinet library (model/savedCabs.ts)
//
// Materials and hardware are the SAME record (EmanMaterial) split by `part`, because to the
// pricing engine a handle and a sheet of ЛДСП are both "a thing with a price and a supplier".
// Splitting them into two models would mean two editors and two sync paths for one idea.
//
// Everything here is per-device (localStorage). A material edited here changes every picker
// and every future quote — but never a past one, because a project stores the material id and
// the quote is recomputed from the live catalog when it is opened.
import { useState, useMemo, useCallback } from "react";
import { useStore } from "../store";
import { useT } from "../i18n/useT";
import { useMoney } from "../useMoney";
import { listMaterials, describeMaterial, newMaterialId, isSeedMaterial } from "../model/catalog";
import { MATERIAL_KINDS, type EmanMaterial } from "../model/materials";
import { listSavedCabs, type SavedCab } from "../model/savedCabs";
import { matSwatchStyle, TEX_KEYS } from "../three/pbr";
import { IconSearch } from "../components/icons";

type Tab = "materials" | "hardware" | "cabinets";

/** Which roles each tab shows. Hardware is its own tab because a shop buys it from a different
 *  supplier on a different cadence — not because the record differs. */
const MATERIAL_ROLES: EmanMaterial["part"][] = ["facade", "carcass", "back", "worktop"];

const blankMaterial = (part: EmanMaterial["part"]): EmanMaterial => ({
  id: newMaterialId(),
  name: "",
  kind: part === "handle" ? "Фурнитура" : "ЛДСП",
  desc: "",
  thickness: "",
  thicknessMm: part === "handle" ? undefined : 16,
  sheetW: part === "handle" ? undefined : 2750,
  sheetH: part === "handle" ? undefined : 1830,
  stockSheets: 0,
  price: 0,
  per: 1,
  color: "#d9d6cf",
  part,
});

export function CatalogScreen() {
  const t = useT();
  const money = useMoney();
  const catalogRev = useStore((s) => s.catalogRev);
  const savedCabsRev = useStore((s) => s.savedCabsRev);
  const saveMaterial = useStore((s) => s.saveMaterial);
  const deleteMaterial = useStore((s) => s.deleteMaterial);
  const resetMaterials = useStore((s) => s.resetMaterials);
  const removeSavedCab = useStore((s) => s.removeSavedCab);
  const renameSavedCab = useStore((s) => s.renameSavedCab);

  const [tab, setTab] = useState<Tab>("materials");
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<EmanMaterial | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  const all = useMemo(() => listMaterials(), [catalogRev]);
  const cabs = useMemo(() => listSavedCabs(), [savedCabsRev]);

  const q = query.trim().toLowerCase();
  const match = useCallback(
    (m: EmanMaterial) => !q || `${m.name} ${m.kind ?? ""} ${m.desc}`.toLowerCase().includes(q),
    [q],
  );

  const shown = all.filter(match).filter((m) => (tab === "hardware" ? m.part === "handle" : MATERIAL_ROLES.includes(m.part)));

  const handleSave = useCallback(
    (m: EmanMaterial) => {
      saveMaterial(m);
      setEditing(null);
    },
    [saveMaterial],
  );

  return (
    <section className="screen home-grid-screen">
      <h1 className="h1">{t.catalog.title}</h1>
      <p className="sub">{t.catalog.sub}</p>

      {/* which list */}
      <div className="proj-buckets cat-tabs">
        <button className={`hc-filter-pill${tab === "materials" ? " on" : ""}`} type="button" onClick={() => setTab("materials")}>{t.catalog.tabMaterials}</button>
        <button className={`hc-filter-pill${tab === "hardware" ? " on" : ""}`} type="button" onClick={() => setTab("hardware")}>{t.catalog.tabHardware}</button>
        <button className={`hc-filter-pill${tab === "cabinets" ? " on" : ""}`} type="button" onClick={() => setTab("cabinets")}>{t.catalog.tabCabinets}</button>
      </div>

      {tab === "cabinets" ? (
        <SavedCabList cabs={cabs} t={t} onRename={renameSavedCab} onRemove={removeSavedCab} />
      ) : (
        <>
          <div className="search-box proj-search">
            <input className="search-input" placeholder={t.catalog.search} value={query} onChange={(e) => setQuery(e.target.value)} />
            <span className="search-ic"><IconSearch /></span>
          </div>

          <div className="cat-actions">
            <button className="cat-add" type="button" onClick={() => setEditing(blankMaterial(tab === "hardware" ? "handle" : "facade"))}>
              {t.catalog.add}
            </button>
            <button className="cat-reset" type="button" onClick={() => setConfirmReset(true)}>{t.catalog.reset}</button>
          </div>

          {shown.length === 0 ? (
            <p className="sub" style={{ marginTop: 16 }}>
              {tab === "hardware" ? t.catalog.emptyHardware : t.catalog.emptyMaterials}
            </p>
          ) : tab === "hardware" ? (
            <div className="cat-list">
              {shown.map((m) => (
                <MaterialRow key={m.id} m={m} t={t} money={money} onEdit={() => setEditing(m)} />
              ))}
            </div>
          ) : (
            // grouped by role, so the list reads the way the shop buys: fronts, carcass, backs, tops
            MATERIAL_ROLES.map((role) => {
              const rows = shown.filter((m) => m.part === role);
              if (!rows.length) return null;
              return (
                <div key={role}>
                  <div className="hc-sec-head">
                    <span className="hc-sec-title">{t.catalog.roles[role]}</span>
                    <span className="hc-sec-count">{rows.length}</span>
                  </div>
                  <div className="cat-list">
                    {rows.map((m) => (
                      <MaterialRow key={m.id} m={m} t={t} money={money} onEdit={() => setEditing(m)} />
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </>
      )}

      {editing && (
        <MaterialModal
          m={editing}
          t={t}
          onSave={handleSave}
          onDelete={
            // a brand-new record has nothing to delete yet
            all.some((x) => x.id === editing.id)
              ? () => {
                  deleteMaterial(editing.id);
                  setEditing(null);
                }
              : undefined
          }
          onCancel={() => setEditing(null)}
        />
      )}

      {confirmReset && (
        <div className="hc-rename-backdrop" onClick={() => setConfirmReset(false)}>
          <div className="hc-rename-card" onClick={(e) => e.stopPropagation()}>
            <h3 className="hc-rename-title">{t.catalog.resetAsk}</h3>
            <div className="hc-rename-actions">
              <button className="hc-rename-cancel" type="button" onClick={() => setConfirmReset(false)}>{t.catalog.cancel}</button>
              <button
                className="hc-rename-save"
                type="button"
                onClick={() => {
                  resetMaterials();
                  setConfirmReset(false);
                }}
              >
                {t.catalog.reset}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

/* ── one material row ───────────────────────────────────────── */
function MaterialRow({
  m,
  t,
  money,
  onEdit,
}: {
  m: EmanMaterial;
  t: ReturnType<typeof useT>;
  money: (n: number) => string;
  onEdit: () => void;
}) {
  const stock = m.stockSheets ?? 0;
  return (
    <button className="cat-row" type="button" onClick={onEdit}>
      <span className="cat-swatch" style={matSwatchStyle(m.color, m.tex)} />
      <span className="cat-row-main">
        <span className="cat-row-name">
          {m.name || "—"}
          {!isSeedMaterial(m.id) && <span className="cat-badge-own">•</span>}
        </span>
        <span className="cat-row-sub">{describeMaterial(m)}</span>
      </span>
      <span className="cat-row-right">
        <span className="cat-row-price">{money(m.price)}</span>
        <span className={`cat-row-stock${stock <= 0 ? " out" : ""}`}>{stock > 0 ? t.catalog.stock(stock) : t.catalog.noStock}</span>
      </span>
    </button>
  );
}

/* ── saved cabinets ─────────────────────────────────────────── */
function SavedCabList({
  cabs,
  t,
  onRename,
  onRemove,
}: {
  cabs: SavedCab[];
  t: ReturnType<typeof useT>;
  onRename: (id: string, name: string) => void;
  onRemove: (id: string) => void;
}) {
  const [renaming, setRenaming] = useState<SavedCab | null>(null);
  const [name, setName] = useState("");

  if (!cabs.length) return <p className="sub" style={{ marginTop: 16 }}>{t.catalog.emptyCabinets}</p>;

  return (
    <>
      <div className="cat-cab-grid">
        {cabs.map((c) => (
          <div key={c.id} className="cat-cab">
            <div className="cat-cab-thumb">
              {c.thumbnail ? <img src={c.thumbnail} alt="" /> : <span className="cat-cab-noimg">▢</span>}
            </div>
            <div className="cat-cab-name">{c.name}</div>
            <div className="cat-cab-actions">
              <button
                type="button"
                onClick={() => {
                  setRenaming(c);
                  setName(c.name);
                }}
              >
                {t.catalog.rename}
              </button>
              <button type="button" className="danger" onClick={() => onRemove(c.id)}>{t.catalog.del}</button>
            </div>
          </div>
        ))}
      </div>

      {renaming && (
        <div className="hc-rename-backdrop" onClick={() => setRenaming(null)}>
          <div className="hc-rename-card" onClick={(e) => e.stopPropagation()}>
            <h3 className="hc-rename-title">{t.catalog.rename}</h3>
            <input className="set-input hc-rename-input" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
            <div className="hc-rename-actions">
              <button className="hc-rename-cancel" type="button" onClick={() => setRenaming(null)}>{t.catalog.cancel}</button>
              <button
                className="hc-rename-save"
                type="button"
                onClick={() => {
                  onRename(renaming.id, name);
                  setRenaming(null);
                }}
              >
                {t.catalog.save}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/* ── add / edit a material ──────────────────────────────────── */
function MaterialModal({
  m,
  t,
  onSave,
  onDelete,
  onCancel,
}: {
  m: EmanMaterial;
  t: ReturnType<typeof useT>;
  onSave: (m: EmanMaterial) => void;
  onDelete?: () => void;
  onCancel: () => void;
}) {
  const [d, setD] = useState<EmanMaterial>(m);
  const [err, setErr] = useState("");
  const set = <K extends keyof EmanMaterial>(k: K, v: EmanMaterial[K]) => setD((x) => ({ ...x, [k]: v }));
  // "" must clear the field rather than become 0 — a blank sheet width means "not a sheet good"
  const num = (v: string): number | undefined => (v.trim() === "" ? undefined : Number(v));

  const submit = () => {
    if (!d.name.trim()) {
      setErr(t.catalog.nameRequired);
      return;
    }
    // `desc` and `thickness` are the legacy display strings the pickers still read; keep them
    // in step with the structured fields so an edited material never shows a stale sub-line.
    onSave({
      ...d,
      name: d.name.trim(),
      desc: describeMaterial(d),
      thickness: d.thicknessMm ? `${d.thicknessMm}mm` : d.thickness,
    });
  };

  const ROLES: EmanMaterial["part"][] = ["facade", "carcass", "back", "worktop", "handle"];

  return (
    <div className="hc-rename-backdrop" onClick={onCancel}>
      <div className="hc-rename-card cat-modal" onClick={(e) => e.stopPropagation()}>
        <h3 className="hc-rename-title">{t.catalog.editMaterial}</h3>

        <span className="hc-rename-label">{t.catalog.fName}</span>
        <input className="set-input hc-rename-input" value={d.name} placeholder={t.catalog.fName} onChange={(e) => set("name", e.target.value)} autoFocus />

        <span className="hc-rename-label">{t.catalog.fRole}</span>
        <div className="hc-status-pick">
          {ROLES.map((r) => (
            <button key={r} type="button" className={`hc-filter-pill${d.part === r ? " on" : ""}`} onClick={() => set("part", r)}>
              {t.catalog.roles[r]}
            </button>
          ))}
        </div>

        <span className="hc-rename-label">{t.catalog.fKind}</span>
        <div className="hc-status-pick">
          {MATERIAL_KINDS.map((k) => (
            <button key={k} type="button" className={`hc-filter-pill${d.kind === k ? " on" : ""}`} onClick={() => set("kind", k)}>
              {k}
            </button>
          ))}
        </div>
        {/* free text as well as the chips — a shop that buys Фанера must not be stuck */}
        <input className="set-input hc-rename-input" value={d.kind ?? ""} placeholder={t.catalog.fKind} onChange={(e) => set("kind", e.target.value)} />

        <span className="hc-rename-label">{t.catalog.fColor}</span>
        <div className="cat-color-row">
          <input className="cat-color" type="color" value={d.color} onChange={(e) => set("color", e.target.value)} />
          <input className="set-input hc-rename-input" value={d.color} onChange={(e) => set("color", e.target.value)} />
        </div>

        <span className="hc-rename-label">{t.catalog.fTexture}</span>
        <div className="hc-status-pick">
          <button type="button" className={`hc-filter-pill${!d.tex ? " on" : ""}`} onClick={() => set("tex", undefined)}>
            {t.catalog.texNone}
          </button>
          {TEX_KEYS.map((k) => (
            <button key={k} type="button" className={`hc-filter-pill${d.tex === k ? " on" : ""}`} onClick={() => set("tex", k)}>
              {k}
            </button>
          ))}
        </div>

        <span className="hc-rename-label">{t.catalog.fSheet}</span>
        <div className="cat-pair">
          <input className="set-input hc-rename-input" inputMode="numeric" value={d.sheetW ?? ""} placeholder="2750" onChange={(e) => set("sheetW", num(e.target.value))} />
          <input className="set-input hc-rename-input" inputMode="numeric" value={d.sheetH ?? ""} placeholder="1830" onChange={(e) => set("sheetH", num(e.target.value))} />
        </div>

        <span className="hc-rename-label">{t.catalog.fThickness}</span>
        <input className="set-input hc-rename-input" inputMode="numeric" value={d.thicknessMm ?? ""} placeholder="16" onChange={(e) => set("thicknessMm", num(e.target.value))} />

        {/* Two boxes because a price is «столько-то ЗА столько-то»: a sheet is bought one at a
            time, handles come in a pack of two. Each gets its own caption — unlabelled twins
            were read as a range. */}
        <span className="hc-rename-label">{t.catalog.fPrice}</span>
        <div className="cat-pair">
          <label className="cat-field">
            <span className="cat-field-cap">{t.catalog.fPriceAmount}</span>
            <input className="set-input hc-rename-input" inputMode="decimal" value={d.price} onChange={(e) => set("price", Number(e.target.value) || 0)} />
          </label>
          <label className="cat-field">
            <span className="cat-field-cap">{t.catalog.fPerCap}</span>
            <input className="set-input hc-rename-input" inputMode="numeric" value={d.per} placeholder="1" onChange={(e) => set("per", Number(e.target.value) || 1)} />
          </label>
        </div>
        <span className="cat-hint">{t.catalog.priceHint}</span>

        <span className="hc-rename-label">{t.catalog.fStock}</span>
        <input className="set-input hc-rename-input" inputMode="decimal" value={d.stockSheets ?? ""} placeholder="0" onChange={(e) => set("stockSheets", num(e.target.value))} />
        <span className="cat-hint">{t.catalog.stockHint}</span>

        {err && <span className="cat-err">{err}</span>}

        <div className="hc-rename-actions">
          {onDelete && <button className="cat-del" type="button" onClick={onDelete}>{t.catalog.del}</button>}
          <button className="hc-rename-cancel" type="button" onClick={onCancel}>{t.catalog.cancel}</button>
          <button className="hc-rename-save" type="button" onClick={submit}>{t.catalog.save}</button>
        </div>
      </div>
    </div>
  );
}
