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
import { DEAL_STATUSES, type SavedProject, type DesignState, type DealStatus } from "../model/projects";
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

// The client-detail columns (phone/address/status/total) are REAL COLUMNS, not fields buried
// inside `state`: the project list filters and sorts on them, and reading them out of the design
// blob would mean downloading every kitchen just to draw a list of cards. They arrive via
// migration 002 — see supabase/migrations/002_project_meta.sql, and `pushProject` below for what
// happens on a database where that migration hasn't been run yet.
interface ProjectRow {
  id: string;
  name: string;
  client: string | null;
  state: DesignState;
  created_at: string;
  updated_at: string;
  // migration 002 — absent (undefined) on a database still on the original schema
  client_phone?: string | null;
  address?: string | null;
  geo_lat?: number | null;
  geo_lng?: number | null;
  status?: string | null;
  total_usd?: number | string | null; // numeric arrives as a string on some driver versions
  meta_updated_at?: string | null;
}

const asStatus = (s: string | null | undefined): DealStatus | undefined =>
  s && (DEAL_STATUSES as string[]).includes(s) ? (s as DealStatus) : undefined;

/** All of the signed-in user's projects (newest first), or [] if none / offline. */
export async function pullProjects(): Promise<SavedProject[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from("projects").select("*").order("updated_at", { ascending: false });
  if (error || !data) return [];
  return (data as ProjectRow[]).map((r) => {
    const { _thumbnail, ...realState } = r.state as any;
    const total = r.total_usd == null ? undefined : Number(r.total_usd);
    return {
      id: r.id,
      name: r.name,
      client: r.client || undefined,
      // `undefined` (column missing) and `""` (column present, genuinely empty) both collapse to
      // undefined here — replaceAllProjects then falls back to the local value, which is what
      // keeps a pre-migration pull from wiping the seller's client details.
      clientPhone: r.client_phone || undefined,
      address: r.address || undefined,
      geo: r.geo_lat != null && r.geo_lng != null ? { lat: r.geo_lat, lng: r.geo_lng } : undefined,
      status: asStatus(r.status),
      totalUSD: Number.isFinite(total) ? total : undefined,
      thumbnail: _thumbnail,
      createdAt: Date.parse(r.created_at) || Date.now(),
      updatedAt: Date.parse(r.updated_at) || Date.now(),
      metaUpdatedAt: r.meta_updated_at ? Date.parse(r.meta_updated_at) || undefined : undefined,
      state: realState,
    };
  });
}

/** Postgres "column does not exist" — i.e. this database hasn't had migration 002 run on it. */
const UNDEFINED_COLUMN = "42703";

export async function pushProject(userId: string, p: SavedProject): Promise<void> {
  if (!supabase) return;
  const stateWithThumb = { ...p.state, ...(p.thumbnail ? { _thumbnail: p.thumbnail } : {}) };
  const legacy = {
    id: p.id,
    owner: userId,
    name: p.name,
    client: p.client ?? "",
    state: stateWithThumb,
    created_at: new Date(p.createdAt).toISOString(),
    // the row's freshness is the LATER of the two local stamps: locally they're kept apart (design
    // work vs. client bookkeeping) so sorting stays honest, but the cloud only needs "when did this
    // last change at all" — otherwise a phone-number edit would push a row that looks untouched.
    updated_at: new Date(Math.max(p.updatedAt, p.metaUpdatedAt ?? 0)).toISOString(),
  };
  const { error } = await supabase.from("projects").upsert({
    ...legacy,
    client_phone: p.clientPhone ?? "",
    address: p.address ?? "",
    geo_lat: p.geo?.lat ?? null,
    geo_lng: p.geo?.lng ?? null,
    status: p.status ?? "design",
    total_usd: p.totalUSD ?? null,
    meta_updated_at: p.metaUpdatedAt ? new Date(p.metaUpdatedAt).toISOString() : null,
  });
  if (!error) return;
  // A seller who upgraded the app but hasn't run migration 002 would otherwise see every save
  // fail and the header stick on the red "Офлайн" — a fake outage caused by a pending ALTER.
  // Fall back to the original column set so the design keeps syncing; the client details sit
  // safely in localStorage until the migration lands.
  if (error.code !== UNDEFINED_COLUMN) throw error;
  const { error: legacyErr } = await supabase.from("projects").upsert(legacy);
  if (legacyErr) throw legacyErr;
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
