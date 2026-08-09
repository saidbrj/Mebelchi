// Bridge so the journey Footer's final CTA ("Экспорт на ЧПУ →") actually runs the handoff
// export/share — the real logic (bundling SWJ008 + DXF + CSV and opening the OS share sheet,
// or downloading as a fallback) lives in HandoffScreen, which registers it here on mount.
// Without this the footer button just flipped an `exported` flag and did nothing.

let _export: (() => boolean) | null = null;

/** The handler returns whether the export actually went out — it can REFUSE (a module drawn too
 *  small for its own hardware blocks the production files), and the journey must not mark itself
 *  finished on a refusal. */
export function registerExport(fn: (() => boolean) | null): void {
  _export = fn;
}

/** Run the registered handoff export. False when none is registered (screen not mounted) or when
 *  the screen refused to export. */
export function runExport(): boolean {
  return _export ? _export() : false;
}
