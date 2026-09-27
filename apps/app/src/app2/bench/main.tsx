import { useState } from "react";
import { createRoot } from "react-dom/client";
import { Bench, Setup } from "./Bench";
import { download, type Variant } from "./journal";

// bench.html — стенд Round 1 (UI Exploration). Планшет: экран наблюдателя → задание → мастер.
// Телефон наблюдателя: bench.html?observer — три кнопки, свой журнал с часами.

function Tablet() {
  const [run, setRun] = useState<{ task: number; variant: Variant; key: number } | null>(null);
  if (!run) return <Setup onStart={(task, variant) => setRun({ task, variant, key: Date.now() })} />;
  return <Bench key={run.key} task={run.task} variant={run.variant} onEnd={() => setRun(null)} />;
}

type Mark = { wall: number; kind: "pause" | "wrong" | "question" | "note"; text?: string };
const KEY = "mebelchi-bench-observer";

function Observer() {
  const [marks, setMarks] = useState<Mark[]>(() => { try { return JSON.parse(localStorage.getItem(KEY) ?? "[]"); } catch { return []; } });
  const [note, setNote] = useState("");
  const add = (m: Mark) => {
    const next = [...marks, m];
    setMarks(next);
    try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* в памяти есть */ }
  };
  const big = (kind: Mark["kind"], label: string, color: string) => (
    <button onClick={() => add({ wall: Date.now(), kind })}
      style={{ height: 110, fontSize: 30, fontWeight: 800, border: "none", borderRadius: 16, color: "#fff", background: color }}>{label}</button>
  );
  const time = (w: number) => new Date(w).toLocaleTimeString("ru-RU");
  return (
    <div style={{ fontFamily: "system-ui, sans-serif", padding: 16, display: "grid", gap: 12 }}>
      <b style={{ fontSize: 20 }}>Наблюдатель · Round 1</b>
      {big("pause", "Пауза", "#5e666d")}
      {big("wrong", "Не то действие", "#c62828")}
      {big("question", "Вопрос", "#1f5fbf")}
      <div style={{ display: "flex", gap: 8 }}>
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="что сказал / что сделал"
          style={{ flex: 1, fontSize: 18, padding: 12, borderRadius: 10, border: "1.5px solid #9aa1a6" }} />
        <button onClick={() => { if (note.trim()) { add({ wall: Date.now(), kind: "note", text: note.trim() }); setNote(""); } }}
          style={{ fontSize: 18, padding: "0 16px", borderRadius: 10, border: "none", background: "#16191c", color: "#fff" }}>+</button>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={() => download(`bench-observer-${new Date().toISOString().slice(0, 16)}.json`, marks)} style={{ flex: 1, height: 48, fontSize: 17 }}>Скачать ({marks.length})</button>
        <button onClick={() => { setMarks([]); try { localStorage.removeItem(KEY); } catch { /* */ } }} style={{ height: 48, fontSize: 17 }}>Очистить</button>
      </div>
      <ol reversed style={{ fontSize: 16, margin: 0, paddingLeft: 24 }}>
        {[...marks].reverse().map((m, i) => <li key={i}>{time(m.wall)} — {m.kind}{m.text ? `: ${m.text}` : ""}</li>)}
      </ol>
    </div>
  );
}

const observer = new URLSearchParams(location.search).has("observer");
createRoot(document.getElementById("root")!).render(observer ? <Observer /> : <Tablet />);
