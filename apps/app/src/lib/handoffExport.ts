// Bridge so the journey Footer's final CTA ("Экспорт на ЧПУ →") actually runs the handoff
// export/share — the real logic (bundling SWJ008 + DXF + CSV and opening the OS share sheet,
// or downloading as a fallback) lives in HandoffScreen, which registers it here on mount.
// Without this the footer button just flipped an `exported` flag and did nothing.

let _export: (() => void) | null = null;

export function registerExport(fn: (() => void) | null): void {
  _export = fn;
}

/** Run the registered handoff export. Returns false if none is registered (screen not mounted). */
export function runExport(): boolean {
  if (_export) {
    _export();
    return true;
  }
  return false;
}
