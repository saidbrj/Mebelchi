# Research Prompts — copy-paste into a deep research tool

Each prompt is self-contained. Run them in this order; 1–3 unblock the joint/physics engines, 4–6 unblock the catalog platform, 7–8 are supporting. Require sources/citations in every output — uncited claims do not enter our rule tables (doc 16 §2).

---

## R1 — Connector taxonomy & selection criteria (feeds `jointResolver`)

> Produce an engineering reference on demountable and fixed connectors for 16–18mm particleboard (ЛДСП) and MDF panel furniture: wooden dowels, cam-and-dowel systems (Minifix/Rastex/VB class), confirmat screws, rafix/shelf supports, Clamex/Lamello, screws, and eccentric+dowel pairings. For EACH family give: (a) exact drilling requirements (diameters, depths, edge offsets, both panels), (b) holding strength data — withdrawal and shear in particleboard, with numbers and sources, (c) when professional cabinetmakers choose it vs alternatives (visibility, demountability, load, cost, machine requirements), (d) typical spacing/count rules vs panel length, (e) known failure modes. Prefer manufacturer technical documentation (Häfele, Hettich, Blum, Titus), peer-reviewed furniture engineering literature (Eckelman et al.), and established cabinetmaking references. Present selection criteria as decision tables, not prose. Cite every number.

## R2 — Structural calculations for panel furniture (feeds physics Grade 1)

> Compile the closed-form structural engineering methods used for panel (particleboard/MDF) furniture: shelf deflection formulas with E (modulus of elasticity) and MOR values for 16/18mm ЛДСП, MDF, and plywood, with accepted sag limits (span/200 etc.); fastener withdrawal and shear strength equations for screws, confirmats and dowels in particleboard (Carl Eckelman's Purdue publications are the key corpus); moment capacity of common cabinet joints; cabinet tipping/stability calculations with open doors and loaded drawers. For each: the formula, the constants with units, validity limits, and the source. Goal: implementable pure functions, so exact equations and numeric constants matter more than narrative.

## R3 — Furniture test standards as automatable load cases (feeds the physics gate)

> Map the strength/durability/stability test standards relevant to storage furniture and kitchens — EN 16121/16122, EN 14749, EN 1022, ANSI/BIFMA X5.9, and the GOST equivalents used in CIS countries (Uzbekistan/Russia) — into a table of concrete load cases: applied load (N/kg), where applied, duration/cycles, acceptance criterion. Identify which cases can be verified by calculation (deflection, moment balance, tipping) vs only by physical test. Include the GOST numbers actually referenced in CIS furniture commerce. Cite the standard clause for every load case.

## R4 — System 32 industrial conventions (closes doc-15 unknowns)

> Document the System 32 drilling conventions as practiced industrially (not hobbyist): front and back row setbacks from panel edges and their dependence on construction type; first-hole offset conventions; how hinge mounting plates, drawer slides, and shelf pins all index off the same rows; deviations common in CIS workshops using Bazis. Sources: True32 (Buckley), manufacturer system documentation (Hettich, Häfele, Blum process documentation), industrial cabinetmaking references. Output as a parameter table: name, value(s), condition, source.

## R5 — Machine-readable hardware catalog data (feeds the catalog compiler)

> For Blum, Hettich, Häfele, GTV, Boyard, Samet, and Titus: what machine-readable product data does each manufacturer publish or license — CAD downloads (formats), product data APIs or feeds, configurator data, dealer/partner data programs, media licensing terms for product images and animations? How do imos, Cabinet Vision, Microvellum, and Polyboard obtain manufacturer hardware libraries (license model)? Determine what's freely downloadable vs requires a partner agreement, and the contact path for data partnership at each. Goal: build a normalized catalog ingestion pipeline legally.

## R6 — On-device catalog scale (feeds doc 17 §3/§6)

> Best practices for shipping a 10,000+ SKU product catalog inside a React Native/Expo app for low-end Android (4GB RAM): SQLite + FTS5 vs alternatives, versioned immutable data packs with binary diffs, image/animation caching strategies (animated WebP vs Lottie vs MP4 in RN), cold-start impact, and offline-first sync patterns. Include measured numbers from comparable apps where published. Output: recommended architecture with the trade-offs quantified.

## R7 — How incumbents auto-select joints (competitive floor for doc 16)

> How do imos iX, Cabinet Vision, Microvellum, Polyboard, and Bazis assign connectors automatically? Specifically: connection-situation rules, construction principles, joint priority systems, user override models, and the limits of their automation (what still requires a human constructor's decision). Source from their documentation, training materials, reseller demos, and user forums. Goal: a feature floor we must match and the gaps where they still rely on the human — that gap is our differentiation target.

## R8 — Batch 3D media pipeline (feeds doc 17 §5)

> Design a headless Blender (or equivalent) batch pipeline that, from one glTF/STEP model per furniture-hardware SKU, renders: a product thumbnail, a wireframe/X-ray structure view, and a short open/close or turntable animation as animated WebP — deterministic, scripted, CI-runnable, thousands of SKUs. Cover scripting approach (bpy), camera/lighting standardization, line/Freestyle rendering for the structure view, animation rigging conventions for hinges/slides, output size optimization, and per-SKU render cost. Include working script skeletons.
