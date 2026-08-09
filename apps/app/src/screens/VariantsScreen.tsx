// Phase B — "Выберите вариант". On entering the screen we generate four realistic kitchen
// layouts straight away (no intro/CTA screen — that was friction): a short loading screen
// while the solver runs, then one big 3D preview + a 1·2·3·4 stepper to flip between the
// four layouts. "↻ Заново" regenerates. The footer's "Открыть в конструкторе" commits it.

import { useEffect, useState } from "react";
import { useStore } from "../store";
import { useT } from "../i18n/useT";
import { priceCabs, sqmPrice } from "../model/toProject";
import { useMoney } from "../useMoney";
import { useRateTable } from "../pricing/usePrice";
import { VariantScene } from "../three/VariantScene";
import { QuizScreen } from "./QuizScreen";
import { FLOOR_COVERINGS } from "../model/floors";
import { IconTabSettings } from "../components/icons";
import { JourneyBar } from "../components/JourneyBar";

export function VariantsScreen() {
  const t = useT();
  const money = useMoney();
  const rates = useRateTable();
  const showPricing = useStore((s) => s.settings.showPricing);
  const pricingItems = useStore((s) => s.settings.pricingItems);
  const pricingSqm = useStore((s) => s.settings.pricingSqm);
  const sqmRate = useStore((s) => s.settings.sqmRate);
  const genVariants = useStore((s) => s.genVariants);
  const variant = useStore((s) => s.variant);
  const points = useStore((s) => s.roomPoints);
  const ceiling = useStore((s) => s.ceiling);
  const reveal = useStore((s) => s.reveal);
  const openings = useStore((s) => s.openings);
  const interiorWalls = useStore((s) => s.interiorWalls);
  const fittings = useStore((s) => s.fittings);
  const wallSurfaces = useStore((s) => s.wallSurfaces);
  const floorCovering = useStore((s) => s.floorCovering);
  const waterWall = useStore((s) => s.waterWall);
  const generateVariants = useStore((s) => s.generateVariants);
  const selectVariant = useStore((s) => s.selectVariant);
  const startBlank = useStore((s) => s.startBlank);
  const next = useStore((s) => s.next);
  const requestWater = useStore((s) => s.requestWater);

  const [loading, setLoading] = useState(false);
  // ask about water ONCE on entry if none was placed (non-blocking — you can continue)
  const [warn, setWarn] = useState(() => genVariants.length === 0 && waterWall == null);
  // the onboarding questions, now HERE. They used to be a gate in front of the room editor — four
  // abstract questions before you'd seen a single kitchen, one of them ("what shape?") asked before
  // you'd drawn a wall. They drive the same generator; they just belong next to the thing they
  // change. Unanswered ones fall back to defaults, so most kitchens never open this at all.
  const [opts, setOpts] = useState(false);

  const coveringColor = FLOOR_COVERINGS[floorCovering]?.color ?? "#ecd9b4";
  const floorId = FLOOR_COVERINGS[floorCovering]?.id;

  const run = () => {
    setLoading(true);
    window.setTimeout(() => {
      generateVariants();
      setLoading(false);
    }, 900);
  };

  // on entry: auto-generate if water is set; otherwise the water prompt (above) handles it
  useEffect(() => {
    if (genVariants.length === 0 && waterWall != null) run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading || genVariants.length === 0) {
    return (
      <section className="screen var-screen">
        {warn ? (
          <WaterWarn onAdd={requestWater} onContinue={() => { setWarn(false); run(); }} />
        ) : (
          <div className="loader-wrap">
            <div className="spinner" />
            <div className="loader-title">{t.variants.loadingTitle}</div>
            <div className="loader-sub">{t.variants.loadingSub}</div>
          </div>
        )}
      </section>
    );
  }

  const cur = genVariants[variant] ?? genVariants[0];

  return (
    <section className="var-screen-3d">
      {/* the same bar as every other journey step, carrying this step's forward CTA */}
      <JourneyBar
        className="var-bar"
        right={<button className="step-next" onClick={next} type="button">{t.footer.toConstructor}</button>}
      />

      {/* The layout TYPE («П-образная» / «Угловая» / …) used to be the bar's heading — the bar says
          whose kitchen this is now, so the type moved down here beside the price, where it reads as
          a caption for the kitchen on the stage. (When the room supports one shape this is the
          strategy name instead — generateVariants sets `name` accordingly.) */}
      <div className={`var-main-content${opts ? " opts-open" : ""}`}>
        <div className="var-stage-wrap">
          <div className="var-caption">
            <span className="var-kind">{cur.name}</span>
            {showPricing && (
              <span className="var-price">
                {money(pricingItems || !pricingSqm ? priceCabs(cur.cabs, rates) : sqmPrice(cur.cabs, sqmRate))}
              </span>
            )}
          </div>

          <div className="var-stage">
            <VariantScene
              points={points}
              ceiling={ceiling}
              reveal={reveal}
              openings={openings}
              coveringColor={coveringColor}
              floorId={floorId}
              interiorWalls={interiorWalls}
              fittings={fittings}
              wallSurfaces={wallSurfaces}
              waterWall={waterWall}
              layout={cur.layout}
              style={cur.style}
              cabs={cur.cabs}
            />
            <button className="var-gear" onClick={() => setOpts(true)} type="button">
              <IconTabSettings /> {t.variants.options}
            </button>
            <button className="var-regen" onClick={run} type="button">{t.variants.again}</button>
            <span className="var-hint">{t.variants.rotate}</span>
          </div>
        </div>

        <div className="var-controls-sidebar">
          <div className="var-blurb">{cur.blurb}</div>

          <div className="var-steps">
            {genVariants.map((v, i) => (
              <button
                key={v.id}
                className={`var-step${i === variant ? " on" : ""}`}
                onClick={() => selectVariant(i)}
                type="button"
                aria-label={v.name}
              >
                {i + 1}
              </button>
            ))}
          </div>

          <button className="var-scratch" onClick={startBlank} type="button">
            <span className="var-scratch-name">{t.variants.scratch} →</span>
            <span className="var-scratch-sub">{t.variants.scratchSub}</span>
          </button>
        </div>
      </div>

      {opts && (
        <div className="var-opts-sheet" onClick={() => { setOpts(false); run(); }}>
          <div className="var-opts-card" onClick={(e) => e.stopPropagation()}>
            <button className="sheet-x" onClick={() => { setOpts(false); run(); }} type="button" aria-label={t.fe.close}>✕</button>
            <QuizScreen />
            <button className="btn btn-next var-opts-apply" onClick={() => { setOpts(false); run(); }} type="button">
              {t.variants.optionsApply}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

// no water supply placed → offer to add it (opens the room's water picker) or continue.
// Non-blocking: "Не важно" generates anyway (the sink defaults to a sensible wall).
function WaterWarn({ onAdd, onContinue }: { onAdd: () => void; onContinue: () => void }) {
  const t = useT();
  return (
    <div className="confirm-overlay">
      <div className="confirm-box" onClick={(e) => e.stopPropagation()}>
        <div className="confirm-title">{t.variants.waterTitle}</div>
        <div className="confirm-body">{t.variants.waterBody}</div>
        <div className="confirm-actions">
          <button className="btn btn-back" onClick={onContinue} type="button">{t.variants.waterSkip}</button>
          <button className="btn btn-next" onClick={onAdd} type="button">{t.variants.waterAdd}</button>
        </div>
      </div>
    </div>
  );
}
