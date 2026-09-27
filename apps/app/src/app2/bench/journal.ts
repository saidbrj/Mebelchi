// Журнал касаний. Пять полей для человека (время · жест · во что попал · результат · что было
// выделено) и соперники (candidates) — внутри, чтобы потом отличить геометрию зоны от приоритета
// и от ожидания мастера. Паузы > 3 с и «создал — сразу отменил» пишутся сами.
import type { Candidate } from "./hit";

export type Variant = "A" | "B" | "C";
export interface Ev {
  wall: number;            // Date.now(): сводится с журналом наблюдателя по часам
  t: number;               // мс от начала задания
  task: number;
  variant: Variant;
  gesture: string;         // tap · longpress · drag · twofinger · pause · button · auto
  hit: string | null;      // P5 · S3 · null
  result: string;          // SELECT P5 · SELECT_SPACE S3 · ADD_SHELF P8 · MOVE P5 -110 · REFUSED … · NOTHING
  selBefore: string | null;
  selAfter?: string | null;
  candidates?: Candidate[];
  rule?: number;
  x?: number; y?: number;
  dur?: number;
  flag?: string;           // FIRST_STALL · WRONG_CREATE_UNDONE · CAMERA · DRAG_ON_UNSELECTED
}

const KEY = "mebelchi-bench-journal";
const read = (): Ev[] => {
  try { return JSON.parse(localStorage.getItem(KEY) ?? "[]") as Ev[]; } catch { return []; }
};

export class Journal {
  private events: Ev[] = read();
  private startedAt = 0;
  task = 0;
  variant: Variant = "A";
  private last = 0;
  private pauseFrom: number | null = null;
  private stalled = false;
  private lastCreate: { id: string; at: number } | null = null;
  private timer: number | null = null;

  begin(task: number, variant: Variant) {
    this.task = task; this.variant = variant;
    this.startedAt = this.last = Date.now();
    this.stalled = false; this.pauseFrom = null; this.lastCreate = null;
    this.push({ gesture: "button", hit: null, result: `TASK_START ${task} ${variant}`, selBefore: null });
    if (this.timer) clearInterval(this.timer);
    this.timer = window.setInterval(() => {
      if (this.pauseFrom === null && Date.now() - this.last > 3000) this.pauseFrom = this.last;
    }, 250);
  }

  end() {
    this.touch();
    this.push({ gesture: "button", hit: null, result: `TASK_END ${this.task}`, selBefore: null });
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  /** Любое касание: закрывает паузу, если она была. */
  touch() {
    const now = Date.now();
    if (this.pauseFrom !== null) {
      const dur = now - this.pauseFrom;
      this.push({ gesture: "pause", hit: null, result: "PAUSE", selBefore: null, dur, ...(this.stalled ? {} : { flag: "FIRST_STALL" }) });
      this.stalled = true;
      this.pauseFrom = null;
    }
    this.last = now;
  }

  created(id: string) { this.lastCreate = { id, at: Date.now() }; }
  /** Отмена в течение 5 с после создания — отдельный класс ошибки (особенно для C). */
  undone(removed: string[]) {
    if (this.lastCreate && removed.includes(this.lastCreate.id) && Date.now() - this.lastCreate.at < 5000) {
      this.push({ gesture: "auto", hit: this.lastCreate.id, result: "CREATED_THEN_UNDONE", selBefore: null, flag: "WRONG_CREATE_UNDONE" });
    }
    this.lastCreate = null;
  }

  push(e: Omit<Ev, "wall" | "t" | "task" | "variant">) {
    const wall = Date.now();
    this.events.push({ wall, t: this.startedAt ? wall - this.startedAt : 0, task: this.task, variant: this.variant, ...e });
    try { localStorage.setItem(KEY, JSON.stringify(this.events)); } catch { /* журнал в памяти всё равно есть */ }
  }

  all(): Ev[] { return this.events; }
  clear() { this.events = []; try { localStorage.removeItem(KEY); } catch { /* ignore */ } }
}

export const journal = new Journal();

/** Скачать JSON (стенд открыт в обычном браузере планшета). */
export function download(name: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 1)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
