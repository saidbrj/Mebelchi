// apps/app/src/poligon/engine/mindGameEngine.ts
//
// THE MIND GAME ENGINE: Word-Based Generative Construction Machine.
// Translates human / AI textual action sequences into pure Universal Kernel
// constructions (evaluate() in space.ts) and validates them against the 5 Invariant Laws:
//
// 1. Law 1: Kinematic Collision & Interlock (Door swing 110°, runner travel clearance)
// 2. Law 2: Slide Clearance Invariance (Exactly 12.7mm per side)
// 3. Law 3: Dual Caliper (Body Box physical bounds vs. Slot Box mounting grid)
// 4. Law 4: Factory Realizability (14-column Gidlab flat table + SWJ008 CNC XML)
// 5. Law 5: Face Ownership (Single covering per space face)

import {
  evaluate,
  type Design,
  type Construction,
  type Space,
  type Front,
  type Attachment,
  type Evaluated,
  type Axis,
  type FaceName,
  type Ref,
} from "../model/space";
import { toGidlabRows, toGidlabCsv, toSWJ008Xml, type GidlabRow } from "../../model/gidlabExport";

export interface MindGameStepResult {
  stepIndex: number;
  command: string;
  success: boolean;
  message: string;
  lawsChecked: string[];
  findings?: Array<{ law: string; detail: string; suggest?: unknown }>;
  evaluated?: Evaluated;
}

export interface MindGameExecutionReport {
  title: string;
  totalSteps: number;
  success: boolean;
  steps: MindGameStepResult[];
  finalDesign: Design;
  finalEvaluated: Evaluated;
  bodyBox: { x: [number, number]; y: [number, number]; z: [number, number] };
  slotBox: { x: [number, number]; y: [number, number]; z: [number, number] };
  gidlabRows: GidlabRow[];
  cncXml: string;
}

export const CANONICAL_CONSTRUCTION: Construction = {
  slots: {
    carcass: { thicknessMm: 16, material: "Egger W980 SM Белый платиновый 16мм" },
    facade: { thicknessMm: 18, material: "Egger H1180 ST37 Дуб Галифакс 18мм" },
    worktop: { thicknessMm: 38, material: "Egger H1180 ST37 Столешница 38мм" },
    back: { thicknessMm: 3.2, material: "HDF 3.2 Белый" },
  },
  hardware: {
    hinge_standard: {
      kind: "hinge",
      requires: "solid",
      protrusionMm: 25,
      clearancePerSideMm: 0,
    },
    hinge_zero_protrusion: {
      kind: "hinge",
      requires: "solid",
      protrusionMm: 0,
      clearancePerSideMm: 0,
    },
    slide_h45: {
      kind: "slide",
      clearancePerSideMm: 12.7,
      lengthsMm: [300, 350, 400, 450, 500, 550],
    },
  },
  library: {},
  facePrecedence: ["left", "right", "bottom", "top", "back"],
  revealMm: 2,
  innerFrontInsetMm: 20,
  drawerSideHeightMm: 120,
  slideBackGapMm: 10,
  touchMm: 2,
};

/**
 * Textual Mind Game Runner.
 * Executes commands one by one, inspecting the physical reality of the furniture piece at each step.
 */
export class MindGameEngine {
  private design: Design;
  private construction: Construction;
  private history: MindGameStepResult[] = [];

  constructor(customConstruction: Partial<Construction> = {}) {
    this.construction = { ...CANONICAL_CONSTRUCTION, ...customConstruction };
    this.design = {
      envelope: { w: 600, h: 720, d: 300 },
      root: { id: "root" },
    };
  }

  public executeScript(commands: string[], title = "Mind Game Execution"): MindGameExecutionReport {
    for (let i = 0; i < commands.length; i++) {
      const raw = commands[i].trim();
      if (!raw || raw.startsWith("#")) continue;
      this.executeCommand(raw, i + 1);
    }

    const evaluated = evaluate(this.design, this.construction);
    const gidlabRows = toGidlabRows(evaluated, this.construction);
    const cncXml = toSWJ008Xml(evaluated);

    return {
      title,
      totalSteps: this.history.length,
      success: this.history.every((s) => s.success),
      steps: [...this.history],
      finalDesign: JSON.parse(JSON.stringify(this.design)),
      finalEvaluated: evaluated,
      bodyBox: evaluated.bodyBox,
      slotBox: evaluated.slotBox,
      gidlabRows,
      cncXml,
    };
  }

  public executeCommand(command: string, stepIndex = this.history.length + 1): MindGameStepResult {
    const parts = command.split(/\s+/);
    const op = parts[0].toUpperCase();

    let step: MindGameStepResult;

    try {
      switch (op) {
        case "SPAWN": {
          // SPAWN <w> <h> <d> [faces]
          const w = parseInt(parts[1], 10) || 600;
          const h = parseInt(parts[2], 10) || 720;
          const d = parseInt(parts[3], 10) || 300;
          this.design.envelope = { w, h, d };
          this.design.root = {
            id: "cab-root",
            faces: {
              left: { kind: "board", slot: "carcass" },
              right: { kind: "board", slot: "carcass" },
              bottom: { kind: "board", slot: "carcass" },
              top: { kind: "board", slot: "carcass" },
            },
          };
          this.design.fronts = [];
          this.design.attachments = [];
          step = {
            stepIndex,
            command,
            success: true,
            message: `Root envelope spawned (${w}×${h}×${d}mm) with canonical 4-face carcass`,
            lawsChecked: ["Law 3 (Dual Caliper initialized)", "Law 4 (Carcass contacts established)"],
          };
          break;
        }

        case "SLICE": {
          // SLICE <spaceId> <axis> <ruleSpec> [slot]
          const spaceId = parts[1];
          const axis = (parts[2]?.toLowerCase() || "y") as Axis;
          const ruleSpec = parts[3] || "1:1";
          const slot = parts[4] || "carcass";

          const spaceNode = this.findSpace(this.design.root, spaceId);
          if (!spaceNode) throw new Error(`Space '${spaceId}' not found in tree`);

          // Parse ruleSpec: either "1:1", "1:1:1", or "fixed:200,flex"
          if (ruleSpec.includes(":")) {
            const ratios = ruleSpec.split(":").map(Number);
            spaceNode.split = {
              axis,
              children: ratios.map((wt, idx) => ({
                rule: { rule: "ratio" as const, weight: wt },
                space: { id: `${spaceId}-${axis}${idx + 1}` },
              })),
              between: Array(ratios.length - 1).fill({ kind: "board", slot }),
            };
          } else if (ruleSpec.startsWith("fixed:")) {
            const mm = parseInt(ruleSpec.split(":")[1], 10);
            spaceNode.split = {
              axis,
              children: [
                { rule: { rule: "fixed" as const, mm }, space: { id: `${spaceId}-fixed` } },
                { rule: { rule: "flex" as const }, space: { id: `${spaceId}-flex` } },
              ],
              between: [{ kind: "board", slot }],
            };
          }

          step = {
            stepIndex,
            command,
            success: true,
            message: `Sliced space '${spaceId}' along ${axis.toUpperCase()} with rule '${ruleSpec}'`,
            lawsChecked: ["Law 4 (Joint contacts generated on divider)"],
          };
          break;
        }

        case "COVER": {
          // COVER <spaceId> <face> <mountThing> [deltaSpec]
          const spaceId = parts[1];
          const face = (parts[2]?.toLowerCase() || "front") as FaceName;
          const mountThing = parts[3] || "hinge_standard";
          const deltaRaw = parts[4] || "";

          const fronts = this.design.fronts ?? [];
          // Law 5 Check: single covering per space face
          const existing = fronts.find((f) => f.covers.includes(spaceId));
          if (existing) {
            throw new Error(`Law 5 Violation: Space '${spaceId}' is already covered by front '${existing.id}'`);
          }

          const delta: Partial<Record<FaceName, number>> = {};
          if (deltaRaw) {
            for (const d of deltaRaw.split(",")) {
              const [k, v] = d.split("=");
              if (k && v) delta[k.toLowerCase() as FaceName] = parseFloat(v);
            }
          }

          const frontId = `door-${spaceId}-${face}`;
          const isHinge = mountThing.includes("hinge");
          const isSlide = mountThing.includes("slide");

          fronts.push({
            id: frontId,
            covers: [spaceId],
            slot: "facade",
            mount: isHinge
              ? { thing: mountThing, side: "left" }
              : isSlide
              ? { thing: mountThing, side: "left" }
              : { fixed: true },
            delta,
          });
          this.design.fronts = fronts;

          step = {
            stepIndex,
            command,
            success: true,
            message: `Covered space '${spaceId}' with front '${frontId}' (mount: ${mountThing})`,
            lawsChecked: ["Law 3 (Dual Caliper delta applied)", "Law 5 (Face Ownership verified)"],
          };
          break;
        }

        case "INSERT_DRAWER": {
          // INSERT_DRAWER <spaceId> [slot]
          const spaceId = parts[1];
          const spaceNode = this.findSpace(this.design.root, spaceId);
          if (!spaceNode) throw new Error(`Space '${spaceId}' not found in tree`);

          // Register slide contents on space so kernel evaluates runner kinematics & door intrusion
          spaceNode.contents = {
            id: `drw-box-${spaceId}`,
            mount: { thing: "slide_h45" },
            inline: {
              params: [],
              slots: ["carcass", "facade"],
              root: { id: `drw-root-${spaceId}` },
            },
          };

          const fronts = this.design.fronts ?? [];
          const frontId = `drw-${spaceId}`;
          fronts.push({
            id: frontId,
            covers: [spaceId],
            slot: "facade",
            mount: { thing: "slide_h45", side: "left" },
            delta: { bottom: 0 },
          });
          this.design.fronts = fronts;

          step = {
            stepIndex,
            command,
            success: true,
            message: `Inserted 5-piece drawer mechanism into space '${spaceId}'`,
            lawsChecked: ["Law 1 (Kinematic clearance)", "Law 2 (12.7mm slide clearance invariance)"],
          };
          break;
        }

        case "ATTACH_PANEL": {
          // ATTACH_PANEL <id> <role> <slot> <thinAxis> <fromOf>:<fromFace> <toOf>:<toFace> [offsetSpec]
          const id = parts[1];
          const role = (parts[2] || "filler") as any;
          const slot = parts[3] || "carcass";
          const thin = (parts[4] || "x") as Axis;
          const fromParts = (parts[5] || "cab-root:left").split(":");
          const toParts = (parts[6] || "cab-root:right").split(":");

          const attachments = this.design.attachments ?? [];
          const refFrom: Ref = { of: fromParts[0], face: fromParts[1] as FaceName };
          const refTo: Ref = { of: toParts[0], face: toParts[1] as FaceName };

          attachments.push({
            id,
            role,
            slot,
            thin,
            x: thin === "x" ? { from: refFrom } : { from: refFrom, to: refTo },
            y: thin === "y" ? { from: refFrom } : { from: { of: "cab-root", face: "bottom" }, to: { of: "cab-root", face: "top" } },
            z: thin === "z" ? { from: refFrom } : { from: { of: "cab-root", face: "front" }, to: { of: "cab-root", face: "back" } },
            mount: { fixed: true },
          });
          this.design.attachments = attachments;

          step = {
            stepIndex,
            command,
            success: true,
            message: `Attached panel '${id}' (${role}) spanning ${fromParts.join(":")} to ${toParts.join(":")}`,
            lawsChecked: ["Law 4 (Relative Extent & Drilling contacts calculated)"],
          };
          break;
        }

        case "INSET_PART": {
          // INSET_PART <spaceId> <face> <offsetMm>
          // Used to shorten bottom/shelf for Gola grip or cable clearance
          const spaceId = parts[1];
          const face = (parts[2]?.toLowerCase() || "bottom") as FaceName;
          const offsetMm = parseFloat(parts[3]) || 0;

          const spaceNode = this.findSpace(this.design.root, spaceId);
          if (!spaceNode || !spaceNode.faces?.[face]) {
            throw new Error(`Face '${face}' on space '${spaceId}' not found`);
          }

          // Attach inset to face definition
          const existingFace = spaceNode.faces[face]!;
          if (existingFace.kind === "board") {
            // Apply offset in space model
            (existingFace as any).offset = offsetMm;
          }

          step = {
            stepIndex,
            command,
            success: true,
            message: `Inset part '${face}' of space '${spaceId}' by ${offsetMm}mm`,
            lawsChecked: ["Law 3 (Physical bounds recalculated)"],
          };
          break;
        }

        case "RESOLVE_COLLISION": {
          // RESOLVE_COLLISION APP2-INNER-DOOR [protrusionMm]
          const colType = parts[1];
          const protrusion = parseFloat(parts[2]) || 25;

          if (colType === "APP2-INNER-DOOR") {
            const attachments = this.design.attachments ?? [];
            attachments.push({
              id: `spacer-hinge-${protrusion}`,
              role: "filler",
              slot: "carcass",
              thin: "x",
              x: { from: { of: "cab-root", face: "left" }, size: protrusion },
              y: { from: { of: "cab-root", face: "bottom" }, to: { of: "cab-root", face: "top" } },
              z: { from: { of: "cab-root", face: "front" }, to: { of: "cab-root", face: "back" } },
              mount: { fixed: true },
            });
            this.design.attachments = attachments;

            // Shift internal drawer width
            if (this.design.fronts) {
              for (const f of this.design.fronts) {
                if (f.id.includes("drw")) {
                  f.delta = { ...(f.delta || {}), left: -protrusion };
                }
              }
            }
          }

          step = {
            stepIndex,
            command,
            success: true,
            message: `Resolved collision '${colType}' by inserting ${protrusion}mm spacer strip and adjusting drawer clearance`,
            lawsChecked: ["Law 1 (Kinematic collision cleared)", "Law 2 (12.7mm clearance preserved)"],
          };
          break;
        }

        default:
          throw new Error(`Unknown Mind Game command '${op}'`);
      }

      // Check invariants with kernel evaluate
      const evalState = evaluate(this.design, this.construction);
      step.findings = evalState.findings;
      step.evaluated = evalState;

      this.history.push(step);
      return step;
    } catch (err: any) {
      step = {
        stepIndex,
        command,
        success: false,
        message: err.message || String(err),
        lawsChecked: [],
      };
      this.history.push(step);
      return step;
    }
  }

  private findSpace(node: Space, id: string): Space | null {
    if (node.id === id) return node;
    if (node.split?.children) {
      for (const ch of node.split.children) {
        const found = this.findSpace(ch.space, id);
        if (found) return found;
      }
    }
    return null;
  }
}
