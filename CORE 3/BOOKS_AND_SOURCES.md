# Books & Sources — what to get me, verified to exist (June 2026)

Answer to "should I give you furniture books?" — **yes.** Give me PDFs/scans and I will extract rule tables with page-level citations into the doc-16 rule catalog (every rule gets `source: {book, page}`). Priority order below.

---

## Tier 1 — the four that matter most

| # | Book | Why for us | Access |
|---|---|---|---|
| 1 | **Carl Eckelman — "Product Engineering and Strength Design of Furniture"** (Purdue, 2003) + his joint-strength papers | THE physics engine source: load cases, joint strength equations, withdrawal/shear in particleboard, frame analysis (his CODOFF is our Grade-2 blueprint) | Much of his work is free on the [Purdue publications page](https://ag.purdue.edu/department/fnr/lab-sites/woodresearch/extension-programs/publications-carl-eckelman.html) ([background](https://ag.purdue.edu/news/department/fnr/2023/02/tales-from-fnr-with-professor-emeritus-carl-eckelman.html)) |
| 2 | **Bill Hylton — "Illustrated Cabinetmaking: How to Design and Construct Furniture That Works"** | 100+ joints and which construction uses which — the normative layer for `jointResolver`; 1300 drawings of joint applications | [Fox Chapel](https://foxchapelpublishing.com/products/illustrated-cabinetmaking) / [Amazon](https://www.amazon.com/Illustrated-Cabinetmaking-Construct-Publishing-Subassemblies/dp/1565233697); also on [Internet Archive](https://archive.org/details/illustrated-cabinetmaking-how-to-design-and-construct-furniture-that-works) |
| 3 | **Барташевич, Онегин, Трофимов, Гайдук — «Конструирование мебели»** (учебник, 2-е изд., ИНФРА-М 2022; older editions fine) | The CIS furniture engineering textbook — terminology, norms and construction rules in the exact tradition Bazis and your constructors come from; includes normative reference data | [Znanium (2022 ed.)](https://znanium.com/catalog/document?id=380137); the 2006 edition circulates as PDF ([booksite.ru full text](https://www.booksite.ru/fulltext/rusles/bartachevic/text.pdf)) |
| 4 | **USDA Forest Products Laboratory — "Wood Handbook: Wood as an Engineering Material"** (FPL-GTR-282, 2021) | Free, authoritative material property tables (E, MOR, density) for the physics spec JSON | [Free official PDF](https://research.fs.usda.gov/treesearch/62200) |

## Tier 2 — strongly useful

| # | Book/Source | Why |
|---|---|---|
| 5 | **Bob Buckley — "True32 Flow Manufacturing"** (2nd ed. 2024) | System 32 as an industrial *system* — row setbacks, indexing conventions, CNC chapter; closes the doc-15 System-32 unknowns. [Amazon](https://www.amazon.com/True32-Flow-Manufacturing-Putting-System/dp/B0CRKCZLLN) |
| 6 | **Manufacturer technical manuals (free!)** — Blum technical brochures + drilling patterns, Hettich Technik handbook, Häfele "The Complete Häfele" technical sections | The real gold for SKU drilling patterns at manufacturing grade — these are the documents your constructor's numbers ultimately come from. Downloadable from manufacturer sites; I can mine them directly |
| 7 | **Strength/test standards texts:** EN 16121/16122, EN 14749, ANSI/BIFMA X5.9, plus the GOST 16371-class CIS standards | Load-case definitions for the physics gate ([overview](https://www.eurofins.com/toys-hardlines/resources/articles/ensuring-furniture-durability-strength-and-load-bearing-tests-explained/), [EN 16121 summary](https://hem.com/en-us/certifications/strength-and-stability)); R3 prompt finds the exact clauses; buying the actual standard texts is worth it later |

## Tier 3 — if easy to obtain

- Any **Russian-language ЛДСП furniture construction handbooks** your constructors actually respect — tell me what's on their shelves at the factory; the book *they* trust is the book whose conventions our defaults must match.
- **imos / Cabinet Vision training materials** (any PDFs from resellers) — for R7.
- Your friend's **internal drilling cards / спецификации** — not a book, but the highest-value documents in this entire list.

## What NOT to bother with

General woodworking/joinery books about solid wood (mortise & tenon, dovetails) — wrong material system; particleboard panel construction is its own engineering discipline, and that's all of our market.
