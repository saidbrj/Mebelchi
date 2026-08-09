// "Профиль" tab — designer profile & company details (used in quotes/handoff) + account (sign in / sign out).
import { useState } from "react";
import { useStore } from "../store";
import { useT } from "../i18n/useT";
import { listProjects } from "../model/projects";
import { isSupabaseConfigured } from "../lib/supabase";
import { AuthScreen } from "./AuthScreen";
import { Logo } from "../components/logo";
import type { Settings } from "../model/settings";

type TextKey = "name" | "phone" | "email" | "company" | "companyPhone" | "companyAddress";

export function UserScreen() {
  const t = useT();
  const authUser = useStore((s) => s.authUser);
  const settings = useStore((s) => s.settings);
  const update = useStore((s) => s.updateSettings);
  const signOut = useStore((s) => s.signOut);
  const deleteAccount = useStore((s) => s.deleteAccount);
  useStore((s) => s.projectsRev); // refresh the count on save/delete

  const [confirmDel, setConfirmDel] = useState(false);
  const [delBusy, setDelBusy] = useState(false);
  const [delError, setDelError] = useState<string | null>(null);

  const runDelete = async () => {
    setDelBusy(true);
    setDelError(null);
    const r = await deleteAccount();
    setDelBusy(false);
    if (r.error) setDelError(r.error);
  };

  const field = (key: TextKey, label: string, type = "text", placeholder = "") => (
    <label className="set-field" key={key}>
      <span className="set-label">{label}</span>
      <input
        className="set-input"
        value={settings[key]}
        type={type}
        placeholder={placeholder}
        onChange={(e) => update({ [key]: e.target.value } as Partial<Settings>)}
      />
    </label>
  );

  const profileAndCompanyFields = (
    <>
      <div className="menu-sec-title">{t.settings.profile}</div>
      <div className="set-group">
        {field("name", t.settings.name, "text", t.settings.phName)}
        {field("phone", t.settings.phone, "tel", t.settings.phPhone)}
        {field("email", t.settings.email, "email", t.settings.phEmail)}
      </div>

      <div className="menu-sec-title">{t.settings.company}</div>
      <div className="set-group">
        {field("company", t.settings.companyName, "text", t.settings.phCompany)}
        {field("companyPhone", t.settings.companyPhone, "tel", t.settings.phCompanyPhone)}
        {field("companyAddress", t.settings.companyAddress, "text", t.settings.phAddress)}
      </div>
    </>
  );

  const name = settings.name.trim();
  const initial = (name || authUser?.email || "?").trim().charAt(0).toUpperCase();
  const count = listProjects().length;

  return (
    <section className="screen set-screen">
      <div className="qnum"><Logo height={14} /></div>
      <h1 className="h1">{t.user.title}</h1>
      <p className="sub">{t.user.sub}</p>

      {authUser ? (
        <>
          <div className="user-card">
            <div className="user-avatar" aria-hidden>{initial}</div>
            <div className="user-meta">
              {name && <div className="user-name">{name}</div>}
              <div className="user-email">{authUser.email}</div>
              <div className="user-count">{t.user.projectsCount(count)}</div>
            </div>
          </div>

          <button className="ho-download ho-download-2 set-signout" onClick={() => void signOut()} type="button">
            {t.common.signOut}
          </button>

          {profileAndCompanyFields}

          <div className="menu-sec-title">{t.settings.danger}</div>
          {!confirmDel ? (
            <button className="set-danger" onClick={() => { setConfirmDel(true); setDelError(null); }} type="button">
              {t.settings.deleteAccount}
            </button>
          ) : (
            <div className="set-danger-box">
              <p className="set-danger-txt">{t.settings.deleteWarn}</p>
              {delError && <div className="auth-error">{delError}</div>}
              <div className="proj-confirm">
                <button className="proj-confirm-yes" disabled={delBusy} onClick={() => void runDelete()} type="button">
                  {delBusy ? t.settings.deleting : t.settings.deleteForever}
                </button>
                <button className="proj-confirm-no" onClick={() => setConfirmDel(false)} type="button">
                  {t.common.cancel}
                </button>
              </div>
            </div>
          )}
        </>
      ) : (
        <>
          {profileAndCompanyFields}

          <div className="menu-sec-title">{t.user.guestTitle}</div>
          {isSupabaseConfigured ? (
            <div style={{ marginTop: 8 }}>
              <AuthScreen embedded />
            </div>
          ) : (
            <p className="sub">{t.settings.noteLocal}</p>
          )}
        </>
      )}
    </section>
  );
}
