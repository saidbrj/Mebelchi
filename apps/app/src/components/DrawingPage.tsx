// On-screen preview of a drawing sheet — renders the SAME routine as the PDF (model/drawings.ts)
// through an SVG backend, so the thumbnail you see IS the page you download. A4 landscape
// viewBox (297×210mm), identical frame, footer, dimension chains and module table.

import {
  drawSheet, PAGE_W, PAGE_H,
  type Sheet, type ShapeStyle, type StrokeStyle, type TextStyle,
  type DrawingsData, type DrawingsLabels, type DrawingSel,
} from "../model/drawings";

const INK = "#222222";
const PT = 0.352778; // pt → mm, so font sizes match the PDF exactly

class SvgSheet implements Sheet {
  els: React.ReactNode[] = [];
  private k = 0;
  private key() {
    return `e${this.k++}`;
  }
  private strokeProps(s?: StrokeStyle) {
    return {
      stroke: s?.stroke ?? "none",
      strokeWidth: s?.lw ?? 0.2,
      strokeDasharray: s?.dash ? s.dash.join(" ") : undefined,
    };
  }
  rect(x: number, y: number, w: number, h: number, s?: ShapeStyle): void {
    this.els.push(<rect key={this.key()} x={x} y={y} width={w} height={h} fill={s?.fill ?? "none"} {...this.strokeProps(s)} />);
  }
  roundRect(x: number, y: number, w: number, h: number, r: number, s?: ShapeStyle): void {
    this.els.push(<rect key={this.key()} x={x} y={y} width={w} height={h} rx={r} ry={r} fill={s?.fill ?? "none"} {...this.strokeProps(s)} />);
  }
  line(x1: number, y1: number, x2: number, y2: number, s?: StrokeStyle): void {
    this.els.push(<line key={this.key()} x1={x1} y1={y1} x2={x2} y2={y2} {...this.strokeProps(s)} />);
  }
  circle(cx: number, cy: number, r: number, s?: ShapeStyle): void {
    this.els.push(<circle key={this.key()} cx={cx} cy={cy} r={r} fill={s?.fill ?? "none"} {...this.strokeProps(s)} />);
  }
  text(str: string, x: number, y: number, s?: TextStyle): void {
    const anchor = s?.align === "center" ? "middle" : s?.align === "right" ? "end" : "start";
    // jsPDF's `angle` rotates counter-clockwise; SVG's rotate() is clockwise → negate
    const transform = s?.angle ? `rotate(${-s.angle} ${x} ${y})` : undefined;
    this.els.push(
      <text
        key={this.key()}
        x={x}
        y={y}
        fontSize={(s?.size ?? 8) * PT}
        fill={s?.color ?? INK}
        textAnchor={anchor}
        dominantBaseline={s?.middle ? "middle" : undefined}
        transform={transform}
        fontFamily="Inter, sans-serif"
      >
        {str}
      </text>,
    );
  }
}

interface Props {
  data: DrawingsData;
  labels: DrawingsLabels;
  sel: DrawingSel;
  svgId?: string;
}

export function DrawingPage({ data, labels, sel, svgId }: Props) {
  const sh = new SvgSheet();
  drawSheet(sh, data, labels, sel, 1, 1);
  return (
    <svg id={svgId} viewBox={`0 0 ${PAGE_W} ${PAGE_H}`} width="100%" xmlns="http://www.w3.org/2000/svg" style={{ background: "#fff", display: "block" }}>
      {sh.els}
    </svg>
  );
}
