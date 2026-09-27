import { useRef } from "react";
import { clampEl, HALF_PI } from "../three/lighting";

export interface SunDialProps {
  azimuth: number;
  elevation: number;
  onChange: (azimuth: number, elevation: number) => void;
}

export function SunDial({ azimuth, elevation, onChange }: SunDialProps) {
  const ref = useRef<SVGSVGElement>(null);
  const R = 40; // the horizon
  const C = 48; // centre of the 96×96 box

  // elevation → radius. Overhead sits at the centre, the horizon at the rim.
  const r = (1 - Math.min(1, Math.max(0, elevation / HALF_PI))) * R;
  // the scene's +z reads as DOWN on a plan, so the knob's screen offset is (sin az, cos az)
  const kx = C + Math.sin(azimuth) * r;
  const ky = C + Math.cos(azimuth) * r;

  const aim = (clientX: number, clientY: number) => {
    const box = ref.current?.getBoundingClientRect();
    if (!box) return;
    const dx = ((clientX - box.left) / box.width) * 96 - C;
    const dy = ((clientY - box.top) / box.height) * 96 - C;
    const d = Math.hypot(dx, dy);
    if (d < 0.5) return; // dead centre has no bearing — keep the one we have
    onChange(Math.atan2(dx, dy), clampEl((1 - Math.min(1, d / R)) * HALF_PI));
  };

  return (
    <svg
      ref={ref}
      className="sun-dial"
      viewBox="0 0 96 96"
      onPointerDown={(e) => {
        (e.target as Element).setPointerCapture?.(e.pointerId);
        aim(e.clientX, e.clientY);
      }}
      onPointerMove={(e) => e.buttons === 1 && aim(e.clientX, e.clientY)}
    >
      <circle className="sd-sky" cx={C} cy={C} r={R} />
      <circle className="sd-ring" cx={C} cy={C} r={R * 0.5} />
      <line className="sd-cross" x1={C} y1={C - R} x2={C} y2={C + R} />
      <line className="sd-cross" x1={C - R} y1={C} x2={C + R} y2={C} />
      {/* the ray, so you can see WHICH WAY the light travels — from the sun, across the room */}
      <line className="sd-ray" x1={kx} y1={ky} x2={C} y2={C} />
      <circle className="sd-sun" cx={kx} cy={ky} r={7} />
    </svg>
  );
}
