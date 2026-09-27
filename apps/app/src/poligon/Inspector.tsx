// ПОЛИГОН · the right pane — "why is this board like that?"
//
// The wall is the index into the rules. You never look a rule up by name: you tap the thing in
// front of you and the decisions that made it appear here, each naming the tier that answered.
//
// This is the verdict's "provenance at selection" (§3.2), which three independent debates demanded
// and which is nearly free because the tap infrastructure exists anyway.

import { useMemo, useState } from "react";
import { linesOn, resolvePositions, type Sheet, type SheetProfile } from "./model/sheet";
import { resolveJunctions } from "./model/junctions";
import { deriveBoards, transportCheck } from "./model/runs";
import { legalDomain, type Op, type RefusalRecord, preventableRatio } from "./model/ops";
import { RANK } from "./model/roles";
import { deriveFacets } from "./model/facets";
import { sizeOn, bandedEdges, PLANES, PLANE_LABEL, type Plane } from "./model/release";
import { compile } from "./model/pipeline";
import { SHOP_MACHINE, SHOP_RULES, TRANSPORT_MAX_MM, SHEET_LENGTH_MM } from "./model/settings";
import type { Selection } from "./SheetView";

const ROLE_RU: Record<string, string> = {
  side: "Бок", top: "Крышка", bottom: "Дно", shelf: "Полка", back: "Задняя",
  front: "Фасад", plinth: "Цоколь", worktop: "Столешница", cornice: "Карниз", filler: "Добор",
};

const BY_RU: Record<string, string> = {
  rank: "ранг профиля",
  spanning: "блок перекрывает высоту",
  override: "ручное переопределение",
  tie: "ничья — отказано",
};

const STATE_RU: Record<string, string> = {
  "V-through": "вертикаль сквозная",
  "H-through": "горизонталь сквозная",
  neither: "обе упираются",
  both: "невозможно",
};

export function Inspector({
  sheet, profile, selection, refusals, onOp,
}: {
  sheet: Sheet;
  profile: SheetProfile;
  selection: Selection;
  refusals: RefusalRecord[];
  onOp: (op: Op) => void;
}) {
  const { mm } = useMemo(() => resolvePositions(sheet), [sheet]);
  const { junctions, violations } = useMemo(
    () => resolveJunctions(sheet, sheet.junctionOverrides ?? []), [sheet],
  );
  const boards = useMemo(() => deriveBoards(sheet, profile, junctions), [sheet, profile, junctions]);

  // THE THREE PLANES (`53` §1). The founder's ruling was "we should had all, and give option to
  // user" — so all three are on screen at once and the toggle says which one you are working in,
  // rather than the app quietly picking one and being wrong in someone else's workshop.
  const [plane, setPlane] = useState<Plane>("cut");
  const cuts = useMemo(
    () => compile({
      sheet, profile, rules: SHOP_RULES, shop: SHOP_MACHINE,
      wall: "measured", number: 1, at: "—", maxModuleWidthMm: TRANSPORT_MAX_MM,
      stockLengthMm: () => SHEET_LENGTH_MM,
    }).release,
    [sheet, profile, boards],
  );

  // ── nothing selected: the cut list, which is the thing this tool exists to get right ─────────
  if (!selection) {
    const transport = transportCheck(boards, TRANSPORT_MAX_MM);
    return (
      <aside className="pg-pane">
        <div className="pg-pane-head"><h2>Раскрой</h2><code className="pg-id">{boards.length} досок</code></div>

        <div className="pg-modes pg-planes" role="group" aria-label="Плоскость размера">
          {PLANES.map((pl) => (
            <button key={pl} className={pl === plane ? "on" : ""} onClick={() => setPlane(pl)}>
              {PLANE_LABEL[pl]}
            </button>
          ))}
        </div>

        <div className="pg-cut-wrap">
        <table className="pg-cut">
          <thead>
            <tr>
              <th>№</th><th>Деталь</th>
              <th className={plane === "nominal" ? "on" : ""}>Макет</th>
              <th className={plane === "finished" ? "on" : ""}>Готовый</th>
              <th className={plane === "cut" ? "on" : ""}>Рез</th>
              <th>Кромка</th>
            </tr>
          </thead>
          <tbody>
            {cuts.parts.map((pt) => (
              <tr key={pt.id}>
                <td className="num">{pt.no}</td>
                <td>{ROLE_RU[pt.role] ?? pt.role}</td>
                <td className={plane === "nominal" ? "num on" : "num"}>{pt.nominalMm}</td>
                <td className={plane === "finished" ? "num on" : "num"}>{pt.finishedMm}</td>
                <td className={plane === "cut" ? "num on" : "num"}>{pt.cutMm}</td>
                <td className="pg-band">
                  {bandedEdges(pt).map((e) => (
                    <span key={e.edge} title={e.name}>{e.band}</span>
                  ))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>

        <div className="pg-metric pg-kerf">
          {PLANE_LABEL[plane].toLowerCase()} · всего{" "}
          <b>{Math.round(cuts.parts.reduce((n, pt) => n + sizeOn(pt, plane), 0))}</b> мм длины ·
          пропил съедает <b>{cuts.kerfTotalMm.toFixed(1)}</b> мм листа
          <span>
            ширина пропила ({SHOP_MACHINE.kerfMm} мм) — это зазор МЕЖДУ деталями, а не убыль детали:
            толще диск — больше расход листа, размеры деталей те же.
          </span>
        </div>

        {transport.over.length > 0 && (
          <div className="pg-todo">
            <b>Не пройдёт в дверь</b>
            {transport.over.length} доск{transport.over.length === 1 ? "а" : "и"} шире 2000 мм —
            самая длинная {transport.widestMm} мм. Общий шов склеивает два шкафа в один модуль;
            расшейте один стык, и сборка распадётся.
          </div>
        )}

        {violations.length > 0 && (
          <div className="pg-todo">
            <b>Стыки без решения</b>
            {violations.map((v, i) => <div key={i}>{v.detail}</div>)}
          </div>
        )}

        <p className="pg-empty-note">
          Нажмите доску — увидите правило, которое задало её длину. Нажмите стык — увидите, какой
          уровень его решил. Потяните вертикальную линию — увидите допустимый диапазон.
        </p>

        {refusals.length > 0 && (
          <div className="pg-metric">
            отказов: <b>{refusals.length}</b> · предотвратимых запросом:{" "}
            <b>{Math.round(preventableRatio(refusals) * 100)}%</b>
            <span> — предотвратимый отказ это баг интерфейса, а не ошибка пользователя</span>
          </div>
        )}
      </aside>
    );
  }

  // ── a board ─────────────────────────────────────────────────────────────────────────────────
  if (selection.kind === "board") {
    const b = boards.find((x) => x.id === selection.id);
    if (!b) return <aside className="pg-pane"><div className="pg-empty"><h2>Доска исчезла</h2></div></aside>;

    const ends = [b.ends.from, b.ends.to];
    const atEnds = junctions.filter((j) =>
      b.axis === "v" ? j.v === b.line && ends.includes(j.h) : j.h === b.line && ends.includes(j.v));

    return (
      <aside className="pg-pane">
        <div className="pg-pane-head">
          <h2>{ROLE_RU[b.role] ?? b.role}</h2>
          <code className="pg-id">{b.lengthMm} × {b.thicknessMm} мм</code>
        </div>

        <section className="pg-facts">
          <div><span>Длина</span><b>{b.lengthMm} мм</b></div>
          <div><span>Толщина</span><b>{b.thicknessMm} мм</b></div>
          <div><span>Ось</span><b>{b.axis === "v" ? "вертикаль" : "горизонталь"}</b></div>
          <div><span>Ранг роли</span><b>{RANK[b.role]}</b></div>
          <div><span>Сегментов</span><b>{b.covers.length}</b></div>
          <div><span>Материал</span><b>{b.material ?? "по профилю"}</b></div>
        </section>

        <section className="pg-rules">
          <h3>Что задало длину</h3>
          {atEnds.length === 0 && <div className="pg-trace"><div className="pg-trace-head">
            <span className="pg-trace-label">оба конца свободны</span>
            <span className="pg-trace-value">до граней проёма</span></div></div>}
          {atEnds.map((j) => {
            const through = b.axis === "v" ? j.state === "V-through" : j.state === "H-through";
            return (
              <div className="pg-trace" key={`${j.v}|${j.h}`}>
                <div className="pg-trace-head">
                  <span className="pg-trace-label">{through ? "проходит насквозь" : "упирается"}</span>
                  <span className="pg-trace-value">{through ? "+ полтолщины" : "− полтолщины"}</span>
                </div>
                <code className="pg-trace-src">
                  {j.cls}-стык · {STATE_RU[j.state]} · {BY_RU[j.by]}
                  {j.roles.v && j.roles.h ? ` · ${j.roles.v}(${RANK[j.roles.v]}) ÷ ${j.roles.h}(${RANK[j.roles.h]})` : ""}
                </code>
              </div>
            );
          })}
          {b.covers.length > 1 && (
            <div className="pg-trace">
              <div className="pg-trace-head">
                <span className="pg-trace-label">склеена из сегментов</span>
                <span className="pg-trace-value">{b.covers.length}</span>
              </div>
              <code className="pg-trace-src">
                L6 · соседние сегменты сошлись по толщине, роли и материалу и соединены сквозным стыком
              </code>
            </div>
          )}
        </section>
      </aside>
    );
  }

  // ── a junction ──────────────────────────────────────────────────────────────────────────────
  const j = junctions.find((x) => x.v === selection.v && x.h === selection.h);
  if (!j) return <aside className="pg-pane"><div className="pg-empty"><h2>Стык исчез</h2></div></aside>;

  const domain = legalDomain(sheet, { kind: "flip-junction", v: j.v, h: j.h, to: "V-through" }, profile);
  const options = domain.kind === "set" ? (domain.values as string[]) : [];

  return (
    <aside className="pg-pane">
      <div className="pg-pane-head"><h2>Стык {j.cls}</h2><code className="pg-id">{j.v} × {j.h}</code></div>

      <section className="pg-facts">
        <div><span>Состояние</span><b>{STATE_RU[j.state]}</b></div>
        <div><span>Решил</span><b>{BY_RU[j.by]}</b></div>
        <div><span>Вертикаль</span><b>{j.roles.v ? `${ROLE_RU[j.roles.v]} (${RANK[j.roles.v]})` : "—"}</b></div>
        <div><span>Горизонталь</span><b>{j.roles.h ? `${ROLE_RU[j.roles.h]} (${RANK[j.roles.h]})` : "—"}</b></div>
      </section>

      <section className="pg-rules">
        <h3>Переключить</h3>
        <p className="pg-empty-note">
          Флип меняет РАЗМЕРЫ: сквозная доска тянется до дальней грани, упёртая встаёт у ближней.
          Недопустимые варианты сюда не попадают — их отсеял запрос допустимого, а не отказ.
        </p>
        <div className="pg-modes pg-modes-block">
          {(["V-through", "H-through", "neither"] as const).map((st) => (
            <button
              key={st}
              className={j.state === st ? "on" : ""}
              disabled={!options.includes(st)}
              onClick={() => onOp({ kind: "flip-junction", v: j.v, h: j.h, to: st })}
            >
              {STATE_RU[st]}
            </button>
          ))}
        </div>
        {j.by === "override" && (
          <div className="pg-trace">
            <code className="pg-trace-src">
              переопределено вручную · ключ структурный, поэтому переживёт сдвиг линий, а при
              исчезновении стыка всплывёт как конфликт, а не растворится
            </code>
          </div>
        )}
      </section>
    </aside>
  );
}
