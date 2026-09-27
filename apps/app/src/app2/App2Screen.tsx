// App2Screen — the "smart object" entry point. When a cabinet is double-clicked
// in App 1 (ConfigScreen), the store sets app2CabId and navigates here. This
// screen converts the Cabinet to a kernel session, opens the editor, and writes
// the result back to the Cabinet on exit.

import React, { useMemo } from "react";
import { useStore } from "../store";
import { CabinetEditor } from "./editor/CabinetEditor";
import { cabinetToSession, sessionToCabinetPatch, isKernelCompatible, unsupportedFeatures } from "./bridge";
import type { Session } from "./kernel";

import { mk } from "../model/cabinet";

interface App2ScreenProps {
  onBack?: () => void;
}

export function App2Screen({ onBack }: App2ScreenProps) {
  const app2CabId = useStore((s) => s.app2CabId);
  const cabs = useStore((s) => s.cabs);
  const exitApp2 = useStore((s) => s.exitApp2);

  const cab = useMemo(() => {
    if (app2CabId) {
      const found = cabs.find((c) => c.id === app2CabId);
      if (found) return found;
    }
    if (cabs.length > 0) return cabs[0]!;
    return mk({
      kind: "base",
      w: 600,
      h: 720,
      depth: 560,
      fill: "shelves",
      count: 1,
      door: 1,
      handle: 0,
      run: 0,
    });
  }, [app2CabId, cabs]);

  // Convert Cabinet → kernel session (memoised so it's stable across renders)
  const initialSession = useMemo(
    () => (cab ? cabinetToSession(cab) : null),
    [cab],
  );

  const handleExit = (session: Session | null) => {
    exitApp2(session !== null, session ?? undefined);
    if (typeof window !== "undefined" && (window.location.search.includes("app2") || window.location.hash.includes("app2"))) {
      window.history.replaceState(null, "", window.location.pathname);
    }
  };

  // No cabinet selected — shouldn't happen, but handle gracefully
  if (!cab || !initialSession) {
    return (
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 9999,
          background: "#f5f3ee",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 16,
          fontFamily: "'Inter', -apple-system, sans-serif",
        }}
      >
        <div style={{ fontSize: 48 }}>🚪</div>
        <div style={{ fontSize: 16, fontWeight: 600, color: "#555" }}>
          Шкаф не выбран
        </div>
        <div style={{ fontSize: 13, color: "#999", maxWidth: 300, textAlign: "center" }}>
          Чтобы открыть редактор, дважды нажмите на шкаф в конструкторе
        </div>
        <button
          type="button"
          onClick={onBack}
          style={{
            marginTop: 12,
            background: "#e8590c",
            color: "#fff",
            border: "none",
            borderRadius: 10,
            padding: "10px 24px",
            fontSize: 14,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          ← Назад
        </button>
      </div>
    );
  }

  const [forceOpen, setForceOpen] = React.useState(false);

  // Check if the kernel can express this cabinet
  const issues = unsupportedFeatures(cab);
  if (issues.length > 0 && !forceOpen) {
    return (
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 9999,
          background: "#f5f3ee",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 16,
          fontFamily: "'Inter', -apple-system, sans-serif",
          padding: 24,
        }}
      >
        <div style={{ fontSize: 48 }}>💡</div>
        <div style={{ fontSize: 18, fontWeight: 700, color: "#1c1f22" }}>
          Особый модуль
        </div>
        <div style={{ fontSize: 13, color: "#777", maxWidth: 360, textAlign: "center", lineHeight: 1.5 }}>
          Этот модуль содержит элементы ({issues.join(", ")}), которые в детальном редакторе сейчас отображаются как базовый каркас с полками.
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
          <button
            type="button"
            onClick={() => handleExit(null)}
            style={{
              background: "#fff",
              border: "1px solid #d9d5cc",
              color: "#333",
              borderRadius: 10,
              padding: "10px 20px",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            ← Назад в проект
          </button>
          <button
            type="button"
            onClick={() => setForceOpen(true)}
            style={{
              background: "#e8590c",
              color: "#fff",
              border: "none",
              borderRadius: 10,
              padding: "10px 20px",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Редактировать каркас
          </button>
        </div>
      </div>
    );
  }

  const kindName =
    cab.kind === "base"
      ? "Нижний модуль"
      : cab.kind === "upper"
      ? "Верхний модуль"
      : cab.kind === "tall"
      ? "Пенал"
      : "Угловой модуль";
  const fillName = cab.sink
    ? "Мойка"
    : cab.appliance && cab.appliance !== "none"
    ? `Техника (${cab.appliance})`
    : cab.fill === "drawers"
    ? "Ящики"
    : cab.fill === "shelves"
    ? "Полки"
    : "Открытый";

  return (
    <CabinetEditor
      initialSession={initialSession}
      onExit={handleExit}
      cabTitle={`${kindName} #${cab.id}`}
      cabSubtitle={fillName}
    />
  );
}
