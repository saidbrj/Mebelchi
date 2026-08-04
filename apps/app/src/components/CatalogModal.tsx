// «Каталог» as a POPUP overlay for the journey screens, which have a hamburger instead of the
// bottom tab bar and so can't reach the catalog tab at all. Opened from the menu
// (store.openCatalog).
//
// A popup rather than a route on purpose: a material edited here bumps `catalogRev`, which
// re-prices the design underneath live. Navigating to the catalog SCREEN would unmount the
// constructor to do the same thing.
import { useStore } from "../store";
import { useT } from "../i18n/useT";
import { CatalogScreen } from "../screens/CatalogScreen";
import { PopupModal } from "./PopupModal";

export function CatalogModal() {
  const t = useT();
  const open = useStore((s) => s.catalogOpen);
  const close = useStore((s) => s.closeCatalog);
  if (!open) return null;
  return (
    <PopupModal onClose={close} closeLabel={t.menu.close}>
      <CatalogScreen />
    </PopupModal>
  );
}
