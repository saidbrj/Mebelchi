// Настройки as a POPUP overlay (not a screen): it renders over whatever journey step
// is active, so the designer can change their profile / currency / language without
// leaving — and losing — the work in progress. Opened from the menu (store.openSettings),
// dismissed by the ✕ or a backdrop tap. The overlay itself is <PopupModal>, shared with
// the Каталог popup.
import { useStore } from "../store";
import { useT } from "../i18n/useT";
import { SettingsScreen } from "../screens/SettingsScreen";
import { PopupModal } from "./PopupModal";

export function SettingsModal() {
  const t = useT();
  const open = useStore((s) => s.settingsOpen);
  const close = useStore((s) => s.closeSettings);
  if (!open) return null;
  return (
    <PopupModal onClose={close} closeLabel={t.settings.close}>
      <SettingsScreen />
    </PopupModal>
  );
}
