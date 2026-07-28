// Phase Г — "Инженерия": the engineering spec, between the constructor and the quote.
// Real construction options (усиление + класс фурнитуры) wired into state, plus a
// "узлы" summary derived from the SAME drilling solver that drives the machine file.

import { useMemo } from "react";
import { useStore, type HwGrade } from "../store";
import { useProduction } from "../pricing/usePrice";
import { useT } from "../i18n/useT";
import { machiningReport, type Part } from "../model/machining";
import { production, cabLabel } from "../model/cncExport";
import { CarcassBoxes, mergeableRows, mergedSummary } from "../components/CarcassBoxes";
import { reinforcementReport, REINFORCE_SPAN_MM } from "../model/reinforce";

/** Count fittings from the solved drill operations (by diameter, in mm10). */
function joints(parts: Part[]) {
  let cam = 0, dowel = 0, pin = 0, hinge = 0;
  for (const p of parts) {
    for (const op of p.operations) {
      if (op.op !== "drill") continue;
      if (op.diameter_mm10 === 150) cam++;
      else if (op.diameter_mm10 === 80) dowel++;
      else if (op.diameter_mm10 === 50) pin++;
      else if (op.diameter_mm10 === 350) hinge++;
    }
  }
  return { cam, dowel, pin, hinge };
}

export function EngineeringScreen() {
  const t = useT();
  const cabs = useStore((s) => s.cabs);
  const hwGrade = useStore((s) => s.hwGrade);
  const setHwGrade = useStore((s) => s.setHwGrade);

  const toggleCarcassMerge = useStore((s) => s.toggleCarcassMerge);
  const toggleSeam = useStore((s) => s.toggleSeam);
  const toggleHangerAt = useStore((s) => s.toggleHangerAt);
  const resetHangers = useStore((s) => s.resetHangers);
  const points = useStore((s) => s.roomPoints);
  const openings = useStore((s) => s.openings);
  const waterWall = useStore((s) => s.waterWall);
  const runLayout = useStore((s) => s.runLayout);
  const ceiling = useStore((s) => s.ceiling);
  const room = useMemo(() => ({ points, waterWall, layout: runLayout, openings }), [points, waterWall, runLayout, openings]);

  const report = useMemo(() => machiningReport(cabs), [cabs]);
  // the shop's build conventions (hangers per carcass) — the hardware list must show what
  // this workshop actually fits, and a merged row hangs on one set, not one per cabinet
  const shop = useProduction();
  const prod = useMemo(() => production(cabs, shop), [cabs, shop]);

  const GRADES: { id: HwGrade; name: string; note: string }[] = [
    { id: "eco", name: t.eng.gradeEco, note: t.eng.gradeEcoNote },
    { id: "std", name: t.eng.gradeStd, note: t.eng.gradeStdNote },
    { id: "premium", name: t.eng.gradePremium, note: t.eng.gradePremiumNote },
  ];

  if (!report || !prod) {
    return (
      <section className="screen">
        <div className="qnum">{t.eng.num}</div>
        <h1 className="h1">{t.eng.title}</h1>
        <p className="sub" style={{ marginTop: 12 }}>{t.eng.emptySub}</p>
      </section>
    );
  }

  const j = joints(report.parts);
  const rein = useMemo(() => reinforcementReport(cabs), [cabs]);


  // WHAT THE MERGE ACTUALLY BOUGHT YOU — measured, not asserted.
  //
  // Build the SAME kitchen with every box broken back into separate carcasses, and diff the two cut
  // lists. That is the only honest way to state a saving: it is the difference between two real
  // BOMs, in the units a workshop counts, not a percentage from a brochure.
  //
  // The numbers come from `production()`, NOT from `machiningReport()`. The report is per-CABINET and
  // knows nothing about boxes, so its panel and hole counts are identical merged or not — quoting
  // them here would have shown a confident "−0" while the board area really did drop. `production`
  // groups the carcasses (that is what a merged box IS), so its panel, hardware and board figures are
  // the ones that actually move.
  const bare = useMemo(() => cabs.map(({ carcassGroup: _g, ...c }) => c as typeof cabs[number]), [cabs]);
  const bareProd = useMemo(() => production(bare, shop), [bare, shop]);
  const boxes = mergedSummary(cabs);
  const canMerge = mergeableRows(cabs);
  const hw = (p: { hardware: { qty: number }[] }) => p.hardware.reduce((a, h) => a + h.qty, 0);
  const saved = bareProd && prod
    ? {
        panels: bareProd.panels.length - prod.panels.length,
        hw: hw(bareProd) - hw(prod),
        board: Math.round((bareProd.boardM2 - prod.boardM2) * 100) / 100,
        boxes: bareProd.boxCount - prod.boxCount,
      }
    : null;

  return (
    <section className="screen eng-screen">
      <div className="qnum">{t.eng.num}</div>
      <h1 className="h1">{t.eng.title}</h1>

      {/* ── УСИЛЕНИЕ ── a FACT, not a switch.
          A shop does not reinforce a kitchen, it reinforces a SHELF, and only because that shelf is
          too wide to carry a load without sagging. That is a property of the span, so it is computed
          and reported. (It used to be a global toggle that tagged one arbitrary module with one
          preset — a stub: it reinforced nothing in particular and a seller flipping it had no way to
          know what they had bought.) */}
      <div className="cost-sec-title">{t.eng.reinforce}</div>
      <div className="eng-summary">
        {rein.shelves > 0 ? (
          <>
            <div className="eng-row"><span>{t.eng.reinShelves}</span><span className="eng-ok">{t.eng.reinShelvesVal(rein.shelves, rein.totalShelves)}</span></div>
            {rein.midSupports > 0 && (
              <div className="eng-row"><span>{t.eng.reinMid}</span><span className="eng-ok">{rein.midSupports}</span></div>
            )}
            <div className="eng-row"><span>{t.eng.reinWidest}</span><span>{rein.widest} мм</span></div>
          </>
        ) : (
          <div className="eng-row"><span>{t.eng.reinNone}</span><span>{t.eng.reinNoneVal(REINFORCE_SPAN_MM)}</span></div>
        )}
      </div>

      <div className="cost-sec-title">{t.eng.hwClass}</div>
      <div className="eng-grades">
        {GRADES.map((g) => (
          <button key={g.id} className={`eng-grade ${hwGrade === g.id ? "on" : ""}`} onClick={() => setHwGrade(g.id)} type="button">
            <span className="eng-grade-name">{g.name}</span>
            <span className="eng-grade-note">{g.note}</span>
          </button>
        ))}
      </div>

      <div className="cost-sec-title">{t.eng.joints}</div>
      <div className="ho-stats">
        <div className="ho-stat"><span className="ho-stat-n">{j.cam}</span><span className="ho-stat-l">{t.eng.cams}</span></div>
        <div className="ho-stat"><span className="ho-stat-n">{j.dowel}</span><span className="ho-stat-l">{t.eng.dowels}</span></div>
        <div className="ho-stat"><span className="ho-stat-n">{j.pin}</span><span className="ho-stat-l">{t.eng.pins}</span></div>
        <div className="ho-stat"><span className="ho-stat-n">{j.hinge}</span><span className="ho-stat-l">{t.eng.hinges}</span></div>
      </div>
      {/* ── КОРПУСА ── which cabinets are built as ONE box, and what that buys.
          A design decision changes what the client sees; this one does not — the fronts do not move.
          It changes what the workshop saws and drills. That is why it lives here and not in the
          module editor, and why the saving is stated in panels and holes rather than in a percentage. */}
      <div className="eng-sec-title">{t.eng.boxesTitle}</div>
      <p className="eng-sec-note">{t.eng.boxesNote}</p>
      <CarcassBoxes
        cabs={cabs}
        room={room}
        ceiling={ceiling}
        onToggle={toggleCarcassMerge}
        onSeam={toggleSeam}
        onHangerAt={toggleHangerAt}
        onHangersReset={resetHangers}
        hangRule={{ per: shop.hangingsPerCarcass, spanMm: shop.hangingSpanMm }}
      />
      <div className="eng-summary">
        {boxes.boxes > 0 ? (
          <>
            <div className="eng-row"><span>{t.eng.boxesMerged}</span><span>{t.eng.boxesMergedVal(boxes.boxes, boxes.cabs)}</span></div>
            {saved && (
              <>
                <div className="eng-row"><span>{t.eng.boxesSavedParts}</span><span className="eng-ok">−{saved.panels}</span></div>
                <div className="eng-row"><span>{t.eng.boxesSavedHw}</span><span className="eng-ok">−{saved.hw}</span></div>
                <div className="eng-row"><span>{t.eng.boxesSavedBoard}</span><span className="eng-ok">−{saved.board} {t.labels.m2}</span></div>
              </>
            )}
          </>
        ) : (
          <div className="eng-row"><span>{t.eng.boxesNone}</span><span>{canMerge > 0 ? t.eng.boxesCan(canMerge) : "—"}</span></div>
        )}
      </div>

      <div className="eng-sec-title">{t.eng.specTitle}</div>
      <div className="eng-summary">
        <div className="eng-row"><span>{t.eng.joint}</span><span>{t.eng.jointVal}</span></div>
        <div className="eng-row"><span>{t.eng.holes}</span><span>{report.holeCount}</span></div>
        <div className="eng-row"><span>{t.eng.parts}</span><span>{report.partCount}</span></div>
        <div className="eng-row"><span>{t.eng.board}</span><span>{prod.boardM2} {t.labels.m2}</span></div>
        <div className="eng-row"><span>{t.eng.check}</span><span className={report.ok ? "eng-ok" : "eng-bad"}>{report.ok ? t.eng.passed : t.eng.errors}</span></div>
      </div>

      {report.skipped.length > 0 && (
        <p className="cost-note eng-skipped">
          {t.eng.skipped}{" "}
          {report.skipped.map((c) => cabLabel(c)).join(", ")}
        </p>
      )}

      <p className="cost-note">{t.eng.note}</p>
    </section>
  );
}
