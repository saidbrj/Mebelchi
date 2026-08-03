-- 002 — project client details (Supabase dashboard → SQL Editor → paste → Run).
--
-- Turns a project from a FILE into a DEAL: who the client is, how to reach them, where the
-- flat is, what stage it's at, and what it's worth. schema.sql already carries these for a
-- fresh install; this is the ALTER path for a database created before them.
--
-- Safe to re-run (every statement is guarded). Additive only — no existing column or row is
-- touched, so an older build of the app keeps working against this schema unchanged.
--
-- These are real columns rather than keys inside `state` because the project list FILTERS and
-- SORTS on them. Buried in the design blob, drawing a list of cards would mean downloading
-- every kitchen in full.
--
-- Until this runs, apps/app/src/lib/sync.ts detects 42703 (undefined_column) and falls back to
-- the original column set, so sync keeps working and nothing is lost — the client details just
-- stay on the device.

alter table public.projects
  add column if not exists client_phone    text not null default '',
  add column if not exists address         text not null default '',
  add column if not exists geo_lat         double precision,
  add column if not exists geo_lng         double precision,
  -- deal stage, set by hand: measure | design | quoted | won | production | installed | lost.
  -- Text, not an enum: statuses are product wording and will change; an enum turns a label
  -- tweak into a migration. The app validates on read (sync.ts asStatus).
  add column if not exists status          text not null default 'design',
  -- quote snapshot in USD — the BASE currency (see model/settings.ts); сум/тенге are derived
  -- at display time from the seller's rate, so a stored local amount would rot.
  add column if not exists total_usd       numeric,
  -- last client-info edit, kept apart from updated_at (last DESIGN save) so fixing a typo in a
  -- phone number doesn't reorder the seller's "По дате" list.
  add column if not exists meta_updated_at timestamptz;

-- the Projects screen's status chips filter within one owner
create index if not exists projects_owner_status_idx
  on public.projects (owner, status);

-- Row-Level Security is table-wide (projects_all_own in schema.sql) and already covers the new
-- columns — nothing to add here.
