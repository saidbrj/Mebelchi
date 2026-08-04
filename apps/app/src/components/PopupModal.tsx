// The shell shared by the two "hub screen shown over the journey" popups — Настройки and
// Каталог. Both take a screen that normally lives behind the bottom tab bar and float it over
// whatever journey step is active, so the designer can change a setting or edit a material
// without unmounting (and losing) the work in progress. Backdrop tap or ✕ dismisses.
//
// Nested dialogs inside the embedded screen (the catalog's material editor, the rename card —
// `.hc-rename-backdrop`, z-index 100) deliberately sit ABOVE this backdrop's z-index 60.
import type { ReactNode } from "react";

export function PopupModal({
  onClose,
  closeLabel,
  children,
}: {
  onClose: () => void;
  closeLabel: string;
  children: ReactNode;
}) {
  return (
    <div className="app-modal-backdrop" onClick={onClose}>
      <div className="app-modal" onClick={(e) => e.stopPropagation()}>
        <button className="sheet-x app-modal-x" onClick={onClose} type="button" aria-label={closeLabel}>
          ✕
        </button>
        {children}
      </div>
    </div>
  );
}
