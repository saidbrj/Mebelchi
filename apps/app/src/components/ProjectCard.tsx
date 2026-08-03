// The project card — a DEAL, not a file. Beyond the design thumbnail it carries who the client
// is, how to reach them, where the flat is, what stage the deal is at and what it's worth, so a
// seller standing in a stairwell can act on the list without opening a single project.
import { useState, useRef, useEffect } from "react";
import {
  DEAL_STATUSES, statusOf, telHref, tgHref, mapHref,
  type DealStatus, type MetaPatch, type ProjectMeta,
} from "../model/projects";
import { useStore } from "../store";
import { useMoney } from "../useMoney";
import { useT } from "../i18n/useT";
import { IconPhone, IconPin, IconTelegram } from "./icons";

/* ── 3-dot dropdown menu ────────────────────────────────────── */
function CardMenu({
  onRename,
  onDelete,
  t,
}: {
  onRename: () => void;
  onDelete: () => void;
  t: ReturnType<typeof useT>;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div className="hc-menu-wrap" ref={ref}>
      <button
        className="hc-dots"
        type="button"
        aria-label="Menu"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
      >
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <circle cx="10" cy="4" r="1.6" fill="currentColor" />
          <circle cx="10" cy="10" r="1.6" fill="currentColor" />
          <circle cx="10" cy="16" r="1.6" fill="currentColor" />
        </svg>
      </button>
      {open && (
        <div className="hc-dropdown">
          <button
            className="hc-drop-item"
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setOpen(false);
              onRename();
            }}
          >
            {t.projects.edit}
          </button>
          <button
            className="hc-drop-item hc-drop-danger"
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setOpen(false);
              onDelete();
            }}
          >
            {t.projects.del}
          </button>
        </div>
      )}
    </div>
  );
}

/* ── deal-status pill ───────────────────────────────────────── */
export function StatusPill({ status, t }: { status: DealStatus; t: ReturnType<typeof useT> }) {
  return <span className={`hc-status hc-status--${status}`}>{t.projects.statusShort[status]}</span>;
}

/* ── project card ───────────────────────────────────────────── */
export function ProjectCard({
  p,
  t,
  onOpen,
  onRename,
  onDelete,
}: {
  p: ProjectMeta;
  t: ReturnType<typeof useT>;
  onOpen: () => void;
  onRename: () => void;
  onDelete: () => void;
}) {
  // Pricing is opt-in (Настройки → Цены). The total is snapshotted on every save regardless,
  // so flipping the switch on fills the whole list in at once — but a seller who keeps pricing
  // off must never see a sum leak onto a card in front of a client.
  const showPricing = useStore((s) => s.settings.showPricing);
  const money = useMoney();

  // Every action inside the card must stop the click reaching the card's own open handler.
  const act = (fn: () => void) => (e: React.MouseEvent) => { e.stopPropagation(); fn(); };
  const open = (href: string) => () => { window.open(href, "_blank"); };
  // Telegram first, `tel:` if nothing handles the scheme — Telegram is how UZ/KZ sellers
  // actually reach clients, but a WebView with no Telegram installed must still do something.
  const openChat = (phone: string) => () => {
    window.location.href = tgHref(phone);
    setTimeout(() => { if (!document.hidden) window.location.href = telHref(phone); }, 700);
  };

  const sub = [p.client, p.address].filter(Boolean).join(" · ");

  return (
    <div className="hc-card" onClick={onOpen}>
      {/* thumbnail – 3D screenshot or fallback icon */}
      <div className="hc-thumb">
        {p.thumbnail ? (
          <img className="hc-thumb-img" src={p.thumbnail} alt={p.name} />
        ) : (
          <svg className="hc-thumb-icon" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="4" y="16" width="40" height="24" rx="2" />
            <path d="M8 16V12a4 4 0 0 1 4-4h24a4 4 0 0 1 4 4v4" />
            <line x1="16" y1="16" x2="16" y2="40" />
            <line x1="32" y1="16" x2="32" y2="40" />
            <circle cx="24" cy="28" r="3" />
          </svg>
        )}
      </div>

      <div className="hc-card-body">
        <div className="hc-card-info">
          <span className="hc-card-name">{p.name}</span>
          {sub && <span className="hc-card-client">{sub}</span>}
          <span className="hc-card-date">
            {new Date(p.updatedAt).toLocaleDateString("ru-RU")}
          </span>
        </div>
        <CardMenu onRename={onRename} onDelete={onDelete} t={t} />
      </div>

      <div className="hc-card-foot">
        <StatusPill status={statusOf(p)} t={t} />
        {/* no snapshot yet (nothing designed, or saved before totals existed) → show nothing
            rather than a "$0" that reads as a free kitchen */}
        {showPricing && p.totalUSD ? <span className="hc-card-sum">{money(p.totalUSD)}</span> : null}
      </div>

      {/* Icon-only on purpose: two cards share a 393px screen, so ~180px of card can't hold
          three labelled buttons — labelled, they'd force the grid wider than the viewport.
          The label lives in aria-label/title instead. */}
      {(p.clientPhone || p.address) && (
        <div className="hc-quick">
          {p.clientPhone && (
            <>
              <button className="hc-quick-btn" type="button" title={t.projects.call} aria-label={t.projects.call}
                onClick={act(open(telHref(p.clientPhone)))}>
                <IconPhone />
              </button>
              <button className="hc-quick-btn" type="button" title="Telegram" aria-label="Telegram"
                onClick={act(openChat(p.clientPhone))}>
                <IconTelegram />
              </button>
            </>
          )}
          {p.address && (
            <button className="hc-quick-btn" type="button" title={t.projects.route} aria-label={t.projects.route}
              onClick={act(open(mapHref(p)))}>
              <IconPin />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/* ── project details sheet ──────────────────────────────────── */
// Grew out of the old rename modal: it still renames, but it's now where all the client
// bookkeeping happens — so a seller can fix a phone number or move a deal to «Согласовано»
// straight from the list, without loading the 3D scene.
export function RenameModal({
  p,
  t,
  onSave,
  onCancel,
}: {
  p: ProjectMeta;
  t: ReturnType<typeof useT>;
  onSave: (patch: MetaPatch) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(p.name);
  const [client, setClient] = useState(p.client ?? "");
  const [clientPhone, setPhone] = useState(p.clientPhone ?? "");
  const [address, setAddress] = useState(p.address ?? "");
  const [status, setStatus] = useState<DealStatus>(statusOf(p));

  return (
    <div className="hc-rename-backdrop" onClick={onCancel}>
      <div className="hc-rename-card" onClick={(e) => e.stopPropagation()}>
        <h3 className="hc-rename-title">{t.projects.edit}</h3>
        <input
          className="set-input hc-rename-input"
          value={name}
          placeholder={t.projects.name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
        />
        <input
          className="set-input hc-rename-input"
          value={client}
          placeholder={t.projects.client}
          onChange={(e) => setClient(e.target.value)}
        />
        <input
          className="set-input hc-rename-input"
          value={clientPhone}
          placeholder={t.projects.clientPhone}
          inputMode="tel"
          autoComplete="tel"
          onChange={(e) => setPhone(e.target.value)}
        />
        <input
          className="set-input hc-rename-input"
          value={address}
          placeholder={t.projects.address}
          onChange={(e) => setAddress(e.target.value)}
        />

        <span className="hc-rename-label">{t.projects.status}</span>
        <div className="hc-status-pick">
          {DEAL_STATUSES.map((s) => (
            <button
              key={s}
              type="button"
              className={`hc-filter-pill${s === status ? " on" : ""}`}
              onClick={() => setStatus(s)}
            >
              {t.projects.statusLabel[s]}
            </button>
          ))}
        </div>

        <div className="hc-rename-actions">
          <button className="hc-rename-cancel" type="button" onClick={onCancel}>
            {t.projects.cancel}
          </button>
          <button
            className="hc-rename-save"
            type="button"
            onClick={() => onSave({ name, client, clientPhone, address, status })}
          >
            {t.projects.save}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── delete confirmation modal ──────────────────────────────── */
export function DeleteModal({
  t,
  onConfirm,
  onCancel,
}: {
  t: ReturnType<typeof useT>;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="hc-rename-backdrop" onClick={onCancel}>
      <div className="hc-rename-card" onClick={(e) => e.stopPropagation()}>
        <h3 className="hc-rename-title">{t.projects.del}?</h3>
        <div className="hc-rename-actions">
          <button className="hc-rename-cancel" type="button" onClick={onCancel}>
            {t.projects.cancel}
          </button>
          <button className="hc-rename-save hc-rename-danger" type="button" onClick={onConfirm}>
            {t.projects.del}
          </button>
        </div>
      </div>
    </div>
  );
}
