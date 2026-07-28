// Cloud sync (Supabase) for the two local models — profile (Settings) and projects
// (SavedProject). All functions no-op when the client is null (Supabase not configured),
// so the app runs fine offline. Row-Level Security scopes every query to the signed-in
// user, so reads need no explicit owner filter (we still pass one for clarity).
//
// Mapping notes: Settings is camelCase, the `profiles` columns are snake_case
// (companyPhone ↔ company_phone). Project timestamps are ms numbers locally and
// timestamptz (ISO) in the DB.

import { supabase } from "./supabase";
import { DEFAULT_SETTINGS, type Settings } from "../model/settings";
import type { SavedProject, DesignState } from "../model/projects";
import type { SavedCab } from "../model/savedCabs";

interface ProfileRow {
  id: string;
  name: string; phone: string; email: string;
  company: string; company_phone: string; company_address: string;
  currency: string; language: string;
}

/** The signed-in user's profile → Settings, or null if none / offline. */
export async function pullProfile(userId: string): Promise<Settings | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
  if (error || !data) return null;
  const r = data as ProfileRow;
  return {
    ...DEFAULT_SETTINGS,
    name: r.name ?? "",
    phone: r.phone ?? "",
    email: r.email ?? "",
    company: r.company ?? "",
    companyPhone: r.company_phone ?? "",
    companyAddress: r.company_address ?? "",
    currency: r.currency === "USD" ? "USD" : r.currency === "KZT" ? "KZT" : "UZS",
    language: r.language === "ru" ? "ru" : r.language === "uz" ? "uz" : DEFAULT_SETTINGS.language,
    // showPricing + rates are local-only (no columns yet) → keep the DEFAULT_SETTINGS values
    // here; store.ts re-applies the device's local copy over the pulled profile on login.
  };
}

export async function pushProfile(userId: string, s: Settings): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from("profiles").upsert({
    id: userId,
    name: s.name,
    phone: s.phone,
    email: s.email,
    company: s.company,
    company_phone: s.companyPhone,
    company_address: s.companyAddress,
    currency: s.currency,
    language: s.language,
    updated_at: new Date().toISOString(),
  });
  if (error) throw error; // let the caller mark the sync state offline
}

interface ProjectRow {
  id: string;
  name: string;
  client: string | null;
  state: DesignState;
  created_at: string;
  updated_at: string;
}

/** All of the signed-in user's projects (newest first), or [] if none / offline. */
export async function pullProjects(): Promise<SavedProject[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from("projects").select("*").order("updated_at", { ascending: false });
  if (error || !data) return [];
  return (data as ProjectRow[]).map((r) => {
    const { _thumbnail, ...realState } = r.state as any;
    return {
      id: r.id,
      name: r.name,
      client: r.client || undefined,
      thumbnail: _thumbnail,
      createdAt: Date.parse(r.created_at) || Date.now(),
      updatedAt: Date.parse(r.updated_at) || Date.now(),
      state: realState,
    };
  });
}

export async function pushProject(userId: string, p: SavedProject): Promise<void> {
  if (!supabase) return;
  const stateWithThumb = { ...p.state, ...(p.thumbnail ? { _thumbnail: p.thumbnail } : {}) };
  const { error } = await supabase.from("projects").upsert({
    id: p.id,
    owner: userId,
    name: p.name,
    client: p.client ?? "",
    state: stateWithThumb,
    created_at: new Date(p.createdAt).toISOString(),
    updated_at: new Date(p.updatedAt).toISOString(),
  });
  if (error) throw error;
}

export async function deleteProjectCloud(id: string): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from("projects").delete().eq("id", id);
  if (error) throw error;
}

// ---- "My cabinets" library sync (table `saved_cabinets`) ----
// TOLERANT by design: any error (incl. the table not being created yet) is swallowed so the
// feature stays local-only and never trips the offline indicator. See supabase/schema.sql.
interface SavedCabRow { id: string; name: string; cab: unknown; thumbnail: string | null; created_at: string }

// Returns the cloud library, [] when the cloud is genuinely empty, or NULL when the fetch
// failed / is unavailable (table missing, offline, RLS). Callers use null to mean "don't touch
// the local cache" so a transient error never wipes a device's saved cabinets.
export async function pullSavedCabs(): Promise<SavedCab[] | null> {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase.from("saved_cabinets").select("*").order("created_at", { ascending: false });
    if (error || !data) return null;
    return (data as SavedCabRow[]).map((r) => ({
      id: r.id,
      name: r.name,
      cab: r.cab as SavedCab["cab"],
      thumbnail: r.thumbnail || undefined,
      createdAt: Date.parse(r.created_at) || Date.now(),
    }));
  } catch {
    return null;
  }
}

export async function pushSavedCab(userId: string, sc: SavedCab): Promise<void> {
  if (!supabase) return;
  try {
    await supabase.from("saved_cabinets").upsert({
      id: sc.id,
      owner: userId,
      name: sc.name,
      cab: sc.cab,
      thumbnail: sc.thumbnail ?? null,
      created_at: new Date(sc.createdAt).toISOString(),
    });
  } catch {
    /* table missing / offline — stays local-only */
  }
}

export async function deleteSavedCabCloud(id: string): Promise<void> {
  if (!supabase) return;
  try {
    await supabase.from("saved_cabinets").delete().eq("id", id);
  } catch {
    /* ignore */
  }
}
