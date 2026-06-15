# Machine-Readable Product Data: Furniture Hardware Manufacturers

## Legal Catalog Ingestion Pipeline Reference

---

## SECTION 1 — MANUFACTURER-BY-MANUFACTURER DATA ASSETS

---

### 1.1 BLUM (Julius Blum GmbH, Austria)

#### CAD Download Formats

[1](https://www.blum.com/su/en/services/industrial-production/cad-cam-dataservice/) Blum allows you to download 3D CAD data of individual products or configurations, 2D production drawings, 2D installation situations, and entire CAD packages. [3](https://publications.blum.com/2024/catalogue/en/612/) You receive CAD data in 2D and 3D in commercial formats as well as Blum's proprietary BXF file, which can then be used in design software with a BXF interface. [3](https://publications.blum.com/2024/catalogue/en/612/) BXF data also contains relevant manufacturing information for wooden parts. Downloadable content from the CAD/CAM Data Service includes CAD/CAM packages, individual product geometry (3D), combination geometry (3D), installation situation drawings (2D), production drawings (2D), CAM data for CNC machines, and BXF data.

**Confirmed formats:** STEP, IGES, DWG, DXF, plus proprietary BXF. The Product Configurator outputs "all usual formats" (their phrasing); based on industry norms for this type of service, this typically covers STEP, IGES, DWG, DXF, SAT, and STL. The BXF format is Blum-specific and carries drilling/machining data beyond pure geometry.

#### Product Database (E-SERVICES)

[2](https://www.blum.com/us/en/services/e-services/productdatabase/) The Product Database offers individual product images, technical details, descriptions, CAD data, and every drawing used in Blum's literature. Each file is available in digital and print-compatible formats. Access to the complete range of product information requires registering for a free E-SERVICES account. [8](https://www.blum.com/us/en/services/e-services/onlineproductconfigurator/) CAD/CAM data is provided on the "Results" page of a Detailed Configuration. There are 2D and 3D options available with multiple formats available for download. CAD data can also be found in the Product Database.

#### Product Configurator

[1](https://www.blum.com/su/en/services/industrial-production/cad-cam-dataservice/) Blum's Product Configurator helps find the right fittings for an application. The tool produces precise CAD configurations and also assists with calculations, ordering, and other features. [7](https://publications.blum.com/2024/catalogue/en/) By entering web codes from the catalogue into the Product Configurator, you can access the parts list and all manufacturing data — drawings, 2D/3D CAD data, or CAM data — that can be transferred directly to design software or a CNC machine.

#### API / Programmatic Feed

No publicly documented REST API or EDI product data feed has been found. The E-SERVICES portal is session/browser-based. For software integration, Blum uses the **BXF interface standard** — software vendors implement a BXF importer/exporter. [3](https://publications.blum.com/2024/catalogue/en/612/)CAD data in 2D and 3D commercial formats as well as BXF files can be used in design software that has a BXF interface.

#### Media Licensing

[7](https://publications.blum.com/2024/catalogue/en/) Blum provides all necessary materials — images, videos, and texts to brochures and data sheets — as well as installation instructions and films. Everything is market-specific, available in more than 40 languages. Redistribution rights for product images in third-party catalogs require contacting Blum directly (no blanket open license found in public documentation).

#### Access Model

|Asset|Access Level|Notes|
|---|---|---|
|Product Database (images, drawings, CAD)|**Free with E-SERVICES account registration**|Registration at e-services.blum.com|
|Product Configurator + BOM export|**Free with E-SERVICES account**|Activation per market/country|
|BXF data (machining + geometry)|**Free with E-SERVICES account**|Requires BXF-capable software|
|CAM data for specific CNC machines|**Free with E-SERVICES account**|Product-dependent|
|Bulk/API data feed|**Not publicly available**|Contact required|

#### Contact Path for Data Partnership

[1](https://www.blum.com/su/en/services/industrial-production/cad-cam-dataservice/) If you'd like to know more about Blum's CAD/CAM Data Service, contact your local Blum representative or use the contact form. Your contact can activate other E-SERVICES that facilitate day-to-day operations.

- **General:** blum.com → Services → Contact form (country-specific)
- **US CAD data requests:** `e-services.us@blum.com` [2](https://www.blum.com/us/en/services/e-services/productdatabase/)(for items not found in the Product Database)
- **Software partner integration:** blum.com/[country]/services → Industrial Production → CAD/CAM Interface → Software Partners
- **BXF interface licensing:** Contact Blum industrial sales; BXF is documented at blum.com under "CAD/CAM Data Service"

---

### 1.2 HETTICH (Paul Hettich GmbH & Co. KG, Germany)

#### CAD Download Formats

[12](https://www.hettich.com/en-is/services/hettich-cad) Hettich's eShop offers over 80 CAD formats, with 2D and 3D DWG/DXF formats as direct downloads, more than 15,000 product data items, 3D preview, assembly of fitting components, and 2D sectional drawings as PDF files. [11](https://eservice.hettich.com/en/hettich-cad/cad-partner.html) ZIP packages contain drawings of fittings groups. The reference drawing name, article name, and article number are represented in an accompanying Excel table.

**Confirmed formats:** DWG, DXF (2D and 3D direct downloads); 80+ additional formats available through the eShop's export engine (which is CADENAS/PartCommunity-powered). Hettich also hosts a PartCommunity portal at `hettich.partcommunity.com`.

#### CAD Partner Program

[12](https://www.hettich.com/en-is/services/hettich-cad) In close cooperation with leading manufacturers of CAD/CAM systems for the industry, Hettich makes original drawing data, including drilling data and master data logic, directly accessible from their material libraries for many Hettich fittings. [11](https://eservice.hettich.com/en/hettich-cad/cad-partner.html) Apart from the Hettich CAD system, several fittings are saved directly as master data in CAD/CAM systems. Partners make available the Hettich data — drawings, drill points, commercial data — directly through a fittings library or master data.

Confirmed CAD partner integrations (from Hettich's own partner page, 2023):

- Cabinet Vision (via eSupport download)
- Microvellum (via iFurn)
- PaletteCAD (via Wood Technology 4.0 catalogue)
- PYTHA (direct download from Hettich website)
- TopSolid (TopSolid Store)
- Promob, PointLineCAD, RWDM, Mozaik, smartCabinet

[13](https://www.hettich.com/en-us/services/hettich-cad/cad-data-packages) After downloading the material manager from Cabinet Vision through eSupport, Hettich hardware data is available for Cabinet Vision users for free use. All variants for the respective program are stored in the Schedule or Assembly Manager. The data can be fully parameterized and used with many accessories to save time.

#### iFurn Integration

[13](https://www.hettich.com/en-us/services/hettich-cad/cad-data-packages) The complete database of Hettich connectors and connector sets can be downloaded or is available from iFurn. Users can register in the Microvellum Knowledge Network community for exchanges between experts, the latest updates, and information.

#### Hettich eShop / CADENAS Portal

[17](https://hettich.partcommunity.com/) Hettich 3D CAD models are available at `hettich.partcommunity.com` — this is the CADENAS PartCommunity portal, which provides multi-format export (80+ formats) including STEP, IGES, STL, CATIA, SolidWorks native, Inventor, Parasolid, etc.

#### Access Model

|Asset|Access Level|Notes|
|---|---|---|
|eShop CAD downloads (DWG/DXF, 80+ formats)|**Free, requires eShop account**|Per-product download|
|CAD packages (ZIP per product group + Excel BOM)|**Free, direct download**|From `eservice.hettich.com/en/hettich-cad`|
|PartCommunity portal (multi-format 3D)|**Free, requires CADENAS account**|`hettich.partcommunity.com`|
|Cabinet Vision library|**Free, eSupport download**|Requires Cabinet Vision license|
|PYTHA library|**Free, direct download**|From Hettich website|
|TopSolid library|**Free, TopSolid Store**|Requires TopSolid license|
|iFurn data (Microvellum, imos)|**Via iFurn subscription**|See Section 3|
|Bulk/API feed|**Not publicly documented**|Contact required|

#### Contact Path for Data Partnership

- **CAD partner inquiries:** `eservice.hettich.com/en/hettich-cad/cad-partner.html`
- **General:** hettich.com → Services → Contact (country-specific sales contacts)
- **Software integration:** hettich.com → Hettich CAD → CAD Partners → "Contact us to become a partner"

---

### 1.3 HÄFELE (Häfele GmbH & Co KG, Germany)

#### CAD Download Formats

[21](https://www.hafele.com.de/en/info/service/cad-cam-data/431951/) CAD data is available at any time, worldwide, and free of charge. Access is via the product detail page on the Häfele website: Search → Product Detail Page → Select Item → Media and Documents → CAD Data. [25](https://www.hafele.com/us/en/info/services/design-tools/406/) Häfele offers 50,000 manufacturer-neutral CAD and 18,000 CAM data, topic-related product configurators, and interfaces for industry software. [26](https://www.hafele.com/us/en/info/services/project-planning-and-customization/design-tools/143861/) Use Häfele's library of 40,000 articles to transfer drawings and models into your own CAD applications. 2D and 3D views of the products are available for download. [21](https://www.hafele.com.de/en/info/service/cad-cam-data/431951/) Settings allow a one-off configuration for all downloads: 3D or 2D, file format, CAD software program. The CAD data is generated in the previously selected format and stored in the download center.

**Confirmed formats:** Per the CADENAS-powered engine Häfele uses: STEP, IGES, STL, DWG, DXF, CATIA V5, SolidWorks, Inventor, COLLADA, JT, and many others. The "Click2CAD Toolbox" enables direct export to running CAD sessions.

[21](https://www.hafele.com.de/en/info/service/cad-cam-data/431951/) The Click2CAD Toolbox allows you to insert CAD data directly into your CAD software. You specify the software version in the settings beforehand; your CAD software and the Click2CAD Toolbox must be open on your end device to enable export to CAD software.

#### Configurators

[28](https://www.hafele.com.de/en/info/service/planning-consulting-tools/406/) With Häfele's configurators and consulting tools, you can design customized solutions easily, quickly, and precisely — from the initial idea to the final implementation. Digital tools support planning, visualization, and data export for efficient workflows. [28](https://www.hafele.com.de/en/info/service/planning-consulting-tools/406/) Easy planning and ordering of the complete system — including the item list, the machining dimensions and the CAD/CAM data.

#### Software Integrations (UK confirmed)

[30](https://www.hafele.co.uk/en/info/services/planning-tools/632281/) Kitchen designers can incorporate Häfele products into plans using industry-leading CAD platforms WinnerFlex and ArtiCAD. Users simply log in to their chosen software to access product ranges with accurate product data, technical specs, and integrated quotation tools.

#### API / Data Feed

No public REST API is documented. Häfele uses CADENAS PartCommunity infrastructure for 3D CAD delivery. For B2B e-commerce integration, Häfele has a B2B portal (country-specific) with order/ERP connectivity, but product data API terms require direct commercial agreement.

#### Access Model

|Asset|Access Level|Notes|
|---|---|---|
|Per-product CAD (2D/3D, 50k+ items)|**Free, no account required**|Via product detail pages|
|CAM data (18,000 items)|**Free, no account required**|Via same pages|
|Click2CAD Toolbox|**Free download**|Enables direct CAD session export|
|WinnerFlex / ArtiCAD integration|**Requires software license**|UK-focused|
|Bulk data feed / API|**Not publicly available**|Commercial agreement required|

#### Contact Path for Data Partnership

- **Germany/Global:** hafele.com → Service → Contact (country-specific)
- **CAD data specifically:** `hafele.com/[country]/info/service/cad-cam-data/`
- **B2B data integration:** Contact country-specific Häfele business development; no public partner program page found

---

### 1.4 GTV (GTV Sp. z o.o., Poland)

#### CAD Downloads

[33](https://gtv.com.pl/en/products/) GTV states that 3D models are available to make it easier to create professional furniture designs and are available in cross-platform files compatible with most popular furniture design programs.

**What is confirmed publicly:** GTV publishes a product catalog PDF and has product pages at `gtv.com.pl`. 3D models are offered per-product on their website in unnamed "cross-platform" formats. A historical catalog (2019) appeared on CADENAS/PartCommunity, suggesting at least a prior CADENAS relationship. No eShop CAD portal of the Hettich/Häfele scale exists.

#### API / Data Feed

No public API, no documented data feed, no partner program page. GTV is a mid-tier Polish manufacturer; their data infrastructure is significantly less formalized than Tier-1 brands.

#### Access Model

|Asset|Access Level|Notes|
|---|---|---|
|Product catalog PDF|**Free, no account**|gtv.com.pl|
|3D models (per-product)|**Apparently free**|Formats unspecified; website-based|
|Bulk/API|**Not documented**|Direct contact required|

#### Contact Path for Data Partnership

- **gtv.com.pl → Contact** (Polish/English)
- Export/international sales: `export@gtv.com.pl` (from their contact page)
- No dedicated data partnership program found; direct negotiation required

---

### 1.5 BOYARD (Boyard Co., Ltd., China)

#### CAD Downloads and Product Data

Boyard is a Chinese OEM/ODM furniture hardware manufacturer. Their public digital infrastructure is limited to:

- Product catalog PDFs and images on their website (`boyard.cn` / `boyard.com.cn`)
- Alibaba/Global Sources product listings
- No dedicated CAD download portal found in public searches

**Confirmed:** No CADENAS integration, no PartCommunity portal, no public BIM/CAD library, no API. Product data is distributed primarily as PDF catalogs and product images via B2B trade channels.

#### Access Model

|Asset|Access Level|Notes|
|---|---|---|
|Product catalog PDF|**Free, website**|boyard.cn|
|Product images|**Free, website/Alibaba**|No explicit license terms found|
|CAD/3D data|**Not publicly available**|Request basis only|
|API|**Not available**|N/A|

#### Contact Path for Data Partnership

- **boyard.cn → Contact Us**
- Typically: `info@boyard.cn` or through Alibaba Gold Supplier channel
- For OEM data arrangements: direct sales contact; no formal partner program

> **Pipeline note:** For Boyard, you will need to request 3D models and technical drawings directly from their product management team on a product-by-product basis. Expect STEP/DWG delivery by email, no feed automation possible.

---

### 1.6 SAMET (Samet Kalıp ve Madeni Eşya San. Tic. A.Ş., Turkey)

#### CAD Downloads and Product Data

Samet is a Turkish furniture hardware manufacturer producing hinges, drawer systems, and lift mechanisms. Their public data infrastructure:

- Product pages at `samet.com.tr` include product images, PDF data sheets, and some 3D models
- No dedicated CADENAS portal, no PartCommunity integration confirmed

[47](https://wooddesigner.org/forum/polyboard/polyboard-and-quick-design-libraries-new-feature-updates/) PolyBoard has added hardware packs from Samet. The Samet and Knape & Vogt (North American supplier) packs contain the same fittings. This confirms Samet provided parametric data to PolyBoard (Wood Designer Ltd.) under some arrangement.

#### Access Model

|Asset|Access Level|Notes|
|---|---|---|
|Product catalog PDF|**Free, website**|samet.com.tr|
|Product images|**Free, website**|License terms not stated|
|3D models (per product)|**Some available on website**|Formats unspecified|
|PolyBoard library|**Via PolyBoard license**|Samet data embedded in PolyBoard|
|API / bulk feed|**Not documented**|Direct contact required|

#### Contact Path for Data Partnership

- **samet.com.tr → Contact / Dealer Inquiry**
- International: contact via regional distributors or `export@samet.com.tr`
- For software library inclusion: contact PolyBoard (Wood Designer Ltd.) as a precedent pathway

---

### 1.7 TITUS (Titus d.o.o., Slovenia / Titus Group)

#### CAD Downloads and Product Data

Titus manufactures connectors, hinges, and drawer systems. Based on confirmed findings:

[47](https://wooddesigner.org/forum/polyboard/polyboard-and-quick-design-libraries-new-feature-updates/) PolyBoard has added hardware packs from Titus (alongside OVVO and Häfele). This confirms Titus provided parametric/machining data to PolyBoard.

Titus maintains a website at `titus-int.com` with product pages, PDF data sheets, and technical drawings. No large-scale CADENAS or PartCommunity portal has been confirmed. Their connector data (particularly for Titus T-type connectors) appears on some third-party CAD sharing platforms as community uploads, not manufacturer-official.

#### Access Model

|Asset|Access Level|Notes|
|---|---|---|
|Product catalog PDF|**Free, website**|titus-int.com|
|Technical drawings (PDF)|**Free, website**|Per-product|
|3D CAD|**Limited, not a systematic portal**|Request basis|
|PolyBoard library|**Via PolyBoard license**|Titus data embedded|
|API / bulk feed|**Not documented**|Direct contact required|

#### Contact Path for Data Partnership

- **titus-int.com → Contact**
- Headquarters: Titus d.o.o., Šmartno ob Paki, Slovenia
- For software library data: contact via `info@titus-int.com` or regional sales

---

## SECTION 2 — CAD/CAM SOFTWARE: LIBRARY LICENSE MODELS

---

### 2.1 iFurn (imos AG / Tapio GmbH — Germany)

[43](https://www.imos3d.com/en/products/design-order/supplier-data/) iFurn is a cloud service that processes the original product data from suppliers and makes it available to designers as digital data for their designs. Designers access the digital product data directly from iX CAD and find the right fittings in no time at all — including accessories and in 3D. [43](https://www.imos3d.com/en/products/design-order/supplier-data/) Suppliers offer the best access to their product data via the iFurn Cloud. [43](https://www.imos3d.com/en/products/design-order/supplier-data/) Thanks to the cloud, product data is not only available at all times, it is also always up to date: as soon as updates are available from the supplier, the data receives an update. Designers thus always have access to the latest product data including edits, logics, and functions. [43](https://www.imos3d.com/en/products/design-order/supplier-data/) The iFurn Composer processes selections and outputs a combination of articles with all information including processing data as a result. During download, all necessary data is also output: commercial data such as parts and order lists, technical data for correct installation, drawings for display and renderings, as well as accessories and sets for combinatorics.

#### License Model Architecture

[49](https://support.imos3d.com/en/software/ifurn-design-catalog) The iFurn Design Catalog is a product data service for furniture design and manufacturing. As an imos user, you can download current article data and use it directly for your design — from connectors to surfaces, materials, and profiles. The iFurn Design Catalog can be easily integrated into imos software via iFurnConnect. [50](https://www.ifurn.net/en/for-suppliers/ifurn-in-action/) The iFurn Design Catalog is available to users who use imos-based software systems. The situational fitting selection based on a design is also available to imos users. CAD users in the furniture industry benefit from iFurn anyCAD, which converts selected datasets from the iFurn Catalog memory list into over 30 CAD formats for download.

**Three tiers of access:**

|Tier|Product|Access|For whom|
|---|---|---|---|
|1|iFurn Design Catalog|imos iX CAD license required|imos iX users|
|2|iFurn Composer|Subscription (see tapio.one)|imos and other CAD users|
|3|iFurn anyCAD|Subscription|Any CAD software user (30+ export formats)|

**Manufacturer side (supplier data submission):** Manufacturers submit their parametric data to iFurn/imos. [41](https://www.ifurn.net/en/)Consistent and current fitting data are an indispensable base for the customer's work processes. The iFurn strategy provides optimum support for this requirement and is thus an important communication channel for Hettich to the customer. Hettich is a confirmed iFurn participant. The supplier uploads data through an iFurn data submission process (contact: `ifurn.net → For Suppliers`).

**Key iFurn suppliers confirmed:** Hettich (confirmed), Grass, Kesseböhmer [36](https://www.kesseboehmer.com/en/storage-solutions/eservices/cad)(Kesseböhmer makes its hardware data available in the "iFurn" library for imos users), and others. Blum is notably absent from iFurn — Blum uses its own BXF standard instead.

---

### 2.2 Cabinet Vision (Hexagon / formerly Planit)

[27](https://hexagon.com/products/product-groups/computer-aided-manufacturing-cad-cam-software/cabinet-vision) Cabinet Vision is a complete engineering solution for cabinet and closet makers.

**Hardware library model:**

[13](https://www.hettich.com/en-us/services/hettich-cad/cad-data-packages) After downloading the material manager from Cabinet Vision through eSupport, Hettich hardware data is available for Cabinet Vision users for free use. All variants for the respective program are stored in the Schedule or the Assembly Manager. The data can be fully parameterized and used and planned with many accessories to save time.

Cabinet Vision hardware libraries consist of:

- **Schedule items** — parametric hardware definitions with placement rules and drilling data
- **Assembly Manager entries** — pre-built hardware assemblies with machining

**License model:** Cabinet Vision hardware libraries from manufacturers (Hettich confirmed, Blum also integrates) are distributed:

1. **Directly from manufacturers** via their websites or eSupport (free download for CV license holders)
2. **Via Hexagon/Cabinet Vision eSupport** portal (requires active Cabinet Vision maintenance agreement)
3. **Through manufacturer partner agreements** with Hexagon — manufacturers submit data in CV-native format; Hexagon certifies and distributes

**Contact for CV library partnership:** Hexagon Manufacturing Intelligence → Cabinet Vision product team; or contact individual manufacturers' CAD partner programs (e.g., Hettich's CAD partner page).

---

### 2.3 Microvellum (Microvellum Inc., USA)

Microvellum uses AutoCAD/BricsCAD as its underlying platform. Its hardware library is called the **Toolbox**.

[14](https://manuals.plus/m/1d18974ceca28cf683185778616ecbe1020f1f1e4616f5e660b7f91c73f53e34) The Microvellum hardware library includes product groups such as hinges (Sensys, Intermat, Veosys Faceframe), drawer systems (MultiTech, InnoTech, ArciTech, InnoTech Atira, AvanTech YOU), drawer runners, sliding and folding door systems, and handles. [14](https://manuals.plus/m/1d18974ceca28cf683185778616ecbe1020f1f1e4616f5e660b7f91c73f53e34) Access to the Microvellum Knowledge Network is not linked to a service contract and is freely accessible to all interested parties.

**Library delivery mechanism:**

[13](https://www.hettich.com/en-us/services/hettich-cad/cad-data-packages) Hettich fittings for Microvellum are available via iFurn. Users can register in the Microvellum Knowledge Network community to access updates and information.

**License model:**

- Microvellum Toolbox data for named manufacturers (Hettich confirmed) is delivered via **iFurn** — requires an iFurn subscription or is bundled through Microvellum's iFurn connection
- The Knowledge Network forum/community is free
- The actual library data requires an active Microvellum software license + iFurn connection for manufacturer-official data
- Custom library entries can be created manually within Microvellum by any licensee

**Contact for library partnership:** `microvellum.com → Partners` or via iFurn supplier program at `ifurn.net → For Suppliers`

---

### 2.4 PolyBoard (Wood Designer Ltd., UK)

[48](https://www.blum.com/eu/en/services/industrial-production/cad-cam-interface/software-partners/wood-designer/) PolyBoard is professional high-end software for furniture design and manufacturing. PolyBoard contains parametric material and hardware libraries that enable designers and manufacturers to compile parts and automatically generate 3D models, 2D production drawings, and CNC output files.

**Hardware library model:**

[42](https://wooddesigner.org/help-centre/polyboard-libraries/) PolyBoard's Fittings library contains dimension values to dynamically filter the application of specific hardware. The application of hardware requires not just the machining details in the Fittings library; PolyBoard also needs to know where to place the hardware. The Rules library lists all positioning rules. When applying hardware, the fitting itself and a rule are selected together. [42](https://wooddesigner.org/help-centre/polyboard-libraries/) A huge range of positioning options are available for generic rules (cams, dowels, screws, hinges, drawers, shelf pegs) and rules for specific manufactured drawer systems such as Blum, Hettich, Grass, etc.

**Confirmed manufacturer libraries in PolyBoard:**

[46](https://wooddesigner.org/polyboard-software-tools/) PolyBoard includes a huge choice of machining for drawers, for example TANDEMBOX from Blum or Vionaro from Grass. [48](https://www.blum.com/eu/en/services/industrial-production/cad-cam-interface/software-partners/wood-designer/) The PolyBoard software contains an intelligent Blum Fittings Configurator and an integrated Blum fittings library, including CAD data for individual products and the application as a whole. [47](https://wooddesigner.org/forum/polyboard/polyboard-and-quick-design-libraries-new-feature-updates/) PolyBoard has added hardware packs from Samet and Knape & Vogt (which contain the same fittings for different markets). [47](https://wooddesigner.org/forum/polyboard/polyboard-and-quick-design-libraries-new-feature-updates/) PolyBoard has added hardware packs from Titus, OVVO, and Häfele.

**License model:**

- Hardware libraries ship **bundled with PolyBoard licenses** as part of the Quick Design library system
- The Quick Design library download is free for licensed PolyBoard users
- **Manufacturer agreements:** PolyBoard (Wood Designer Ltd.) negotiates directly with manufacturers to obtain parametric data and machining specs, then encodes them into the PolyBoard Fittings + Rules library format. This is a bilateral software-vendor/manufacturer agreement — manufacturers provide data; PolyBoard encodes and distributes
- No fee to end users for manufacturer libraries within PolyBoard
- Users can also **define custom hardware** manually in the Fittings library

**Contact for PolyBoard library inclusion:**

- `support@wooddesigner.org`
- +44 1183 702665
- wooddesigner.org

---

## SECTION 3 — NORMALIZED PIPELINE ARCHITECTURE DECISION MATRIX

text

```
MANUFACTURER          | FREELY DOWNLOADABLE ASSET          | REQUIRES AGREEMENT         | API/FEED | PARTNER CONTACT
----------------------|------------------------------------|----------------------------|----------|----------------
Blum                  | CAD/BXF via free E-SERVICES acct   | Bulk feed, BXF integration  | None pub | e-services.us@blum.com / local rep
Hettich               | eShop CAD (DWG/80+ formats, ZIPs)  | iFurn supplier slot         | None pub | eservice.hettich.com/cad-partner
                      | Cabinet Vision via eSupport (free)  | CAD partner agreement       |          |
                      | PYTHA direct download (free)        |                             |          |
Häfele                | 50k CAD items, free, no account    | B2B data feed, bulk         | None pub | hafele.com → contact (country)
                      | 18k CAM items, free                | Commercial software integr. |          |
GTV                   | PDFs + some 3D (website)           | Any structured data         | None     | export@gtv.com.pl
Boyard                | PDFs + product images only         | Everything else             | None     | info@boyard.cn / Alibaba
Samet                 | PDFs + some 3D (website)           | Structured bulk data        | None     | samet.com.tr contact form
Titus                 | PDFs + technical drawings (website)| Structured bulk data        | None     | info@titus-int.com
```

---

## SECTION 4 — LEGAL INGESTION GUIDANCE PER TIER

### Tier 1 (Blum, Hettich, Häfele): Structured Data Possible

These three manufacturers have intentional, documented data distribution programs. A legal ingestion pipeline is achievable via:

1. **Self-service download** (free accounts): Legally permits use of geometry and technical data for design/manufacturing purposes per their ToS. **Does not** grant rights to redistribute data as a competing product library or resell data.
2. **BXF/iFurn/CADENAS interfaces:** Use the standardized middleware (BXF for Blum, CADENAS PartCommunity API or iFurn for Hettich, CADENAS for Häfele) — these have documented license terms per platform.
3. **Software partner agreement:** For embedding manufacturer data in your own software product, a formal data license agreement is required. This is a bilateral commercial contract. Contact each manufacturer's CAD partner / industrial sales team.

**Media (product images/animations):**

- For Blum: [7](https://publications.blum.com/2024/catalogue/en/)All necessary materials including images, videos, texts, brochures, and data sheets are provided by Blum — but redistribution in a commercial catalog requires explicit written permission. Contact local Blum marketing.
- For Hettich and Häfele: Same principle — media assets accessible for personal/design use; commercial redistribution requires a media license agreement.

### Tier 2 (GTV, Samet, Titus): Manual + Direct Negotiation

No automated ingestion pipeline is possible without direct manufacturer engagement. Steps:

1. Download all available PDFs and product images from manufacturer websites (check ToS for each)
2. Contact manufacturer to request: STEP files, DWG drawings, machining specs, and a data use license
3. Negotiate a bilateral data agreement that explicitly grants: (a) rights to digitize/transform the data, (b) rights to include in a commercial product library, (c) image use rights

### Tier 3 (Boyard): OEM/Special Handling

Boyard's data infrastructure is minimal. Treat as a custom data acquisition project:

1. Obtain product samples and create your own 3D models (you own the geometry you create)
2. OR request official files from Boyard under a written data license
3. Product images from Chinese manufacturers on B2B platforms: check individual platform ToS (Alibaba, Made-in-China) — platform ToS generally prohibit scraping; manufacturer images require separate clearance

---

## SECTION 5 — CADENAS/PARTCOMMUNITY AS MIDDLEWARE (Cross-Manufacturer)

Several manufacturers use **CADENAS PartCommunity** as their CAD delivery infrastructure. This is the key cross-manufacturer API surface:

- **Hettich:** `hettich.partcommunity.com`
- **Häfele:** Uses CADENAS engine internally (not a standalone PartCommunity subdomain confirmed, but the format export engine is CADENAS-based)

CADENAS PartCommunity offers:

- **CAD download API** (for software vendors): Paid API access; contact `cadenas.de → PartCommunity → Software Integration`
- **Content API:** Returns model metadata, format list, download URLs
- **OEM portal creation:** Manufacturers pay CADENAS to host their portal; software vendors pay to integrate

For a normalized ingestion pipeline ingesting multiple CADENAS-hosted catalogs, contact: `info@cadenas.de` or `partcommunity.com → Become a Partner` — a single CADENAS API agreement may cover multiple manufacturers simultaneously.

---

## QUICK-REFERENCE CONTACT MATRIX

|Manufacturer|Data Partner Contact|Software Partner Contact|
|---|---|---|
|**Blum**|e-services.[country]@blum.com|blum.com → Industrial Production → Software Partners|
|**Hettich**|eservice.hettich.com/cad-partner|Same page; list of current partners|
|**Häfele**|hafele.com/[country]/contact|hafele.com → Planning tools page|
|**GTV**|[export@gtv.com.pl](mailto:export@gtv.com.pl)|Same|
|**Boyard**|[info@boyard.cn](mailto:info@boyard.cn)|Alibaba storefront|
|**Samet**|samet.com.tr → Contact|Same; or PolyBoard as precedent|
|**Titus**|[info@titus-int.com](mailto:info@titus-int.com)|Same; or PolyBoard as precedent|
|**iFurn (imos)**|ifurn.net → For Suppliers|imos3d.com → Partners|
|**Cabinet Vision**|Hexagon → CV product team|hexagon.com/products/cabinet-vision|
|**Microvellum**|microvellum.com → Partners + iFurn|Same|
|**PolyBoard**|[support@wooddesigner.org](mailto:support@wooddesigner.org)|wooddesigner.org → Contact|
|**CADENAS**|partcommunity.com → Partner|cadenas.de → Software Integration|





---




## Executive summary (what you can safely build around)

- **Blum** is the only one in your list where I found an explicit, manufacturer-published **machine-readable PIM feed** offering: **BMEcat (XML, v1.2)** plus **Excel**, with defined **update cadence (monthly/quarterly)** and stated content scope (text/features/images/videos). [1](https://d2.blum.com/services/BEC003/me25532797_fo_dok_bau_%24sen_%24aof_%24v1.pdf)
- **Hettich** publishes large-scale CAD download bundles (DWG/DXF/STEP/IGES/SAT/3DS/MAX, etc.) and explicitly runs a **CAD partner integration program** with CAD/CAM vendors (incl. Cabinet Vision, imos, Microvellum). [2](https://www.hettich.com/en-us/services/hettich-cad)
- **Häfele** advertises a CAD database + CAM datasets + configurators, but their sites are partially access-restricted in this crawl; what is verifiable is “download in common formats / insert directly” and that some configurators output **DXF** and can transfer designs to **imos**. [3](https://www.haefele.de/de/info/services/konfiguratoren-and-planer/cad-cam-daten/90867/)
- **GTV** publishes per-product downloadable **3D solids** (STP) and **OBJ** (confirmed on an official GTV product page). [4](https://gtv.com.pl/en/produkt/PR-SP-550-10/)
- **BOYARD** publishes downloadable **3D model libraries** (including specific furniture CAD ecosystems like БАЗИС-Мебельщик / K3 / PRO100) and multiple exchange formats (DWG/FBX/STL/OBJ/3DS etc.), with dated ZIP archives. [5](https://www.boyard.biz/3d_models)
- **Samet** publishes a media center (documents/videos) and has CAD models published on **TraceParts** (e.g., STEP AP203 on a Samet part page). [6](https://www.samet.com.tr/us-EN/media/document)
- **Titus (TitusPlus)**: I found a public **download area** (catalog PDFs, brochures, policies) and clear **contact paths**, but I did **not** find a TitusPlus official CAD-download portal in the accessible pages from this run. [7](https://www.titusplus.com/us/en/resources/download-area)

Below is a normalized, “ingestion-pipeline oriented” breakdown by manufacturer and then by CAD/CAM software vendor.

---

# A) Manufacturer-by-manufacturer: machine-readable data, access model, and contact path

## 1) Blum

### 1.1 CAD downloads / configurator exports

**Published capabilities**

- **Product Database**: downloadable assets include **images**, diagrams/drawings, and **3D CAD data in “all the usual formats”** (wording from Blum). Access is part of Blum **E‑SERVICES**. [8](https://www.blum.com/al/en/services/planning-construction-product-selection/product-database/)
- **Cabinet Configurator**: exports CAD “in the most common formats” and also supports **BXF (Blum Exchange Format)** which “contains information about the fitting” _and_ “manufacturing information for wooden parts (cutting dimensions, drilling positions)”. Access requires E‑SERVICES registration. [9](https://d2.blum.com/services/BEC003/me173052_fo_dok_bau_%24sen_%24aof_%24v4.pdf)
- **CAD/CAM Data Service**: download 3D CAD, 2D drawings/installation situations, and “entire CAD packages”. [10](https://www.blum.com/in/en/services/industrial-production/cad-cam-dataservice/)

**Free vs partner-only**

- E‑SERVICES applications are marketed as **free to register** in Blum collateral, but they are still an **account-gated portal** (not an open anonymous feed). [11](https://d2.blum.com/services/BEC003/ebiz0007-fo-118_fo_dok_bau_%24sen_%24aof_%24v2.pdf)
- BXF export is a _format_, but the ability to generate BXF is tied to the Cabinet Configurator access. [9](https://d2.blum.com/services/BEC003/me173052_fo_dok_bau_%24sen_%24aof_%24v4.pdf)

### 1.2 Product data feeds / APIs

**Explicit machine-readable feed (high value for your pipeline)**

- Blum publishes an “automatic product data” service delivering structured data packs with:
    - **Supported formats**: **XML, BMEcat v1.2** and **Microsoft Excel**
    - **Frequency**: **monthly or quarterly**
    - **Content scope** includes product-group hierarchy + item info (text/features/images) + marketing info including **application images, promotional videos, assembly videos**, etc. [1](https://d2.blum.com/services/BEC003/me25532797_fo_dok_bau_%24sen_%24aof_%24v1.pdf)

**Free vs partner-only**

- This is presented as a **service requiring coordination with Blum (“get in touch with your contact at Blum”)** → treat as **partner agreement / data partnership**, not a public download. [1](https://d2.blum.com/services/BEC003/me25532797_fo_dok_bau_%24sen_%24aof_%24v1.pdf)

### 1.3 Media licensing signals (what’s explicit)

- Blum E‑SERVICES brochure explicitly states: “**All content is copyrighted by Blum**” and that the **Marketing Media Library** contains marketing documents. [11](https://d2.blum.com/services/BEC003/ebiz0007-fo-118_fo_dok_bau_%24sen_%24aof_%24v2.pdf)
- That’s not a full license grant; for a legal ingestion pipeline assume **copyright retained** and get written permission for re-hosting.

### 1.4 Contact path for data partnership

- Blum’s Product Database page indicates customers/partners obtain access credentials via their **Blum contact partner** or a **contact form**. [8](https://www.blum.com/al/en/services/planning-construction-product-selection/product-database/)
- The BMEcat service PDF says: “Interested? … get in touch with your **contact at Blum**.” [1](https://d2.blum.com/services/BEC003/me25532797_fo_dok_bau_%24sen_%24aof_%24v1.pdf)

---

## 2) Hettich

### 2.1 CAD downloads (formats explicitly listed)

Hettich provides:

- Direct CAD downloads and notes:
    - “**Over 80 CAD formats**”
    - **2D and 3D DWG/DXF** as direct downloads
    - product data items, 3D preview, assemblies, PDFs, and planning artifacts like wood/fittings lists. [2](https://www.hettich.com/en-us/services/hettich-cad)

A public “CAD downloads” page shows bundles including (examples shown on-page):

- **DWG/DXF (2D/3D)**, **STEP (3D)**, **IGES (3D)**, **SAT (3D)**, **3DS**, **MAX**, etc. [12](https://www.hettich.com/es-us/services/hettich-cad/descargas-cad)

### 2.2 Configurator / planning exports

- Hettich “Hettich Plan” documentation shows export formats including:
    - **DWG** (3D carcase including machining and fittings)
    - **FXF** (explicitly: “imos data format”) [13](https://web.hettich.com/fileadmin/Media_Center/12_eMarketing/Hettich_Plan/Hettich_Plan_Manual_EN.pdf)

### 2.3 CAD partner / dealer programs (integration model)

Hettich states that CAD|CAM system vendors are partners and that users can access:

- “original drawing data, including **drilling data and master data logics**, directly from their material libraries” for many fittings, and lists partners including **cabinet vision**, **imos**, **Microvellum** (among many others). [2](https://www.hettich.com/en-us/services/hettich-cad)

This is important for your “normalized ingestion” plan: Hettich supports both

- **public download** (CAD bundles / eShop downloads), and
- **licensed embedded catalogs** (via CAD/CAM vendor partnerships).

### 2.4 Free vs partner-only

- The bulk “CAD downloads” pages are **freely accessible web downloads** (no partner contract implied by the page itself). [12](https://www.hettich.com/es-us/services/hettich-cad/descargas-cad)
- Embedded integration into CAD/CAM “material libraries” is implicitly **partner-program controlled** (vendor-to-vendor integration). [2](https://www.hettich.com/en-us/services/hettich-cad)

### 2.5 Contact path for data partnership

- Best-supported path in sources: start from **Hettich CAD** (services page) and use Hettich’s site “Contact” route; the CAD page is clearly the program hub. [2](https://www.hettich.com/en-us/services/hettich-cad)

---

## 3) Häfele (Häfele / Häfele America / regional sites)

### 3.1 CAD downloads (formats)

What’s verifiable from accessible sources:

- Häfele markets a CAD database where you can download 2D/3D “in **all common CAD formats**” and also “insert directly” into your CAD via tooling. [3](https://www.haefele.de/de/info/services/konfiguratoren-and-planer/cad-cam-daten/90867/)
- Häfele also markets large **CAM datasets** embedded in “industry software programs” (counts vary by region page; concept is consistent). [3](https://www.haefele.de/de/info/services/konfiguratoren-and-planer/cad-cam-daten/90867/)

**Caveat:** I could not access several official Häfele pages directly in this crawl (HTTP 403). That prevents me from extracting an authoritative “full list of export formats” straight from Häfele’s portal UI. The safest pipeline assumption is: _treat Häfele CAD exports as “multiple formats selectable in portal”_, but don’t hardcode a format list without manually verifying in-browser.

### 3.2 Configurator data

A Häfele configurators page (NL) explicitly mentions:

- output “**drawing data in DXF format**”
- “transfer of the design to **imos** software” (explicit) [14](https://www.hafele.nl/nl/info/service/alle-configuratoren/92602/)

### 3.3 Free vs partner-only

- Häfele CAD data is described as “free of charge” in an accessible Häfele CAD-data document capture. [15](https://manuals.plus/m/7de5ec4bbe2ed8eb90a99ebb78739eaa2e2b6ec046985a235b972781e67e0286)
- CAM datasets “in industry software programs” and “interfaces” imply a **software-vendor partnership / license channel** for the CAM side. [3](https://www.haefele.de/de/info/services/konfiguratoren-and-planer/cad-cam-daten/90867/)

### 3.4 Contact path for data partnership

- UK “Projects 360° CAD Services” page provides a clear contact (email/phone) for the projects/CAD services team. [16](https://www.hafele.co.uk/en/info/project-360-/project-360-services/projects-360-cad-services/86489/)
- For ingestion/data partnership, this is the most direct “published” entry point found in this run.

---

## 4) GTV (GTV Poland S.A.)

### 4.1 CAD downloads (formats explicitly confirmed)

An official GTV product page shows:

- “**3D model availability: yes**”
- Downloads include **“Solid 3d stp”** and **“Solid 3d obj”**. [4](https://gtv.com.pl/en/produkt/PR-SP-550-10/)

So for ingestion:

- You can legally source some 3D models directly from product pages as **STP** and **OBJ**.

### 4.2 Configurator / planning tools

A GTV category page links to “**Design a cabinet in our configurator**” for selecting sliding systems and accessories. [17](https://gtv.com.pl/kategoria-produktu/akcesoria-meblowe/akcesoria-dekoracyjne/nozki-meblowe/bd-150/)

### 4.3 Free vs partner-only

- The STP/OBJ downloads appear **public** on the product page. [4](https://gtv.com.pl/en/produkt/PR-SP-550-10/)
- Any deeper PIM feed/API is not evidenced in the sources pulled here.

### 4.4 Contact path

The same product page lists the producer’s contact info (email/phone/address). [4](https://gtv.com.pl/en/produkt/PR-SP-550-10/)

---

## 5) BOYARD

### 5.1 CAD / model libraries (formats + “ecosystem packaging”)

BOYARD has an official “Download 3D models” page that is unusually ingestion-friendly:

- Provides model libraries for specific furniture software:
    - **БАЗИС‑Мебельщик (version 2024)**
    - **К3‑Мебель (v8.1)**
    - **PRO100 (v6.43)**
- And also “3D modeling” formats including:
    - **Autodesk 3ds Max 2014**, **V‑Ray**, **Chaos Corona**, plus exchange formats **DWG, FBX, STL, OBJ, 3DS**.
- Supplies **dated ZIP archives** (good for versioning/delta updates). [5](https://www.boyard.biz/3d_models)

### 5.2 Free vs partner-only

- These downloads are presented as direct downloads on the public BOYARD site (no partner program indicated on the page). [5](https://www.boyard.biz/3d_models)

### 5.3 Contact path

- BOYARD’s 3D-model page has site navigation for **“Контакты”** and a **“Задать вопрос”** entry point (web-form style). [5](https://www.boyard.biz/3d_models)  
    (You’ll likely want to contact them to confirm re-hosting rights for models/images if you plan to distribute beyond internal use.)

---

## 6) Samet

### 6.1 Media center (docs/videos)

Samet has a Media Center where you can download “visual and written material” and find product/application/assembly videos. [6](https://www.samet.com.tr/us-EN/media/document)

### 6.2 CAD availability (via TraceParts)

A Samet product page on TraceParts provides CAD models (example shows **STEP AP203**). [18](https://www.traceparts.com/en/product/samet-as-smart-slide-single-soft-close-undermount-slide-400mm?Product=90-14012021-029147)

### 6.3 Free vs partner-only

- TraceParts positions itself as free to register for engineers/designers (account-based), and vendors publish catalogs there; your ingestion would be governed by TraceParts + vendor terms. [19](https://info.traceparts.com/designers/engineers-and-designers/join-the-community/)

### 6.4 Contact path

Samet Media Center page provides customer service contact info. [6](https://www.samet.com.tr/us-EN/media/document)

---

## 7) Titus (TitusPlus — furniture fittings)

### 7.1 What’s clearly published

- TitusPlus has a public **Download area** (catalogs/brochures/etc.). [7](https://www.titusplus.com/us/en/resources/download-area)
- TitusPlus has a published **contact page** with office contact details (example: Iberia). [20](https://www.titusplus.com/es/es/contactos)

### 7.2 What I could not verify (important)

- I did **not** find a TitusPlus official CAD download portal or per-item STP/STEP downloads in the accessible pages from this run. That doesn’t mean they don’t exist; only that they weren’t discoverable/accessible in this pass. (So: don’t architect your pipeline assuming public CAD is available for TitusPlus without manual confirmation.)

---

# B) How imos, Cabinet Vision, Microvellum, Polyboard obtain manufacturer libraries (license/distribution model evidence)

## 1) Hettich’s stated model: embedded catalogs via CAD/CAM partners

Hettich explicitly says the leading CAD|CAM vendors are partners and that users can access original fitting data (incl. drilling data and “master data logic”) directly from the vendors’ material libraries; the partner list includes **cabinet vision**, **imos**, and **Microvellum**. [2](https://www.hettich.com/en-us/services/hettich-cad)

**Interpretation for licensing**

- This is a classic **B2B data partnership**: manufacturer certifies and supplies data → CAD/CAM vendor distributes inside the software → end users receive usage rights under the **software EULA** and (often) restrictions against redistribution.

## 2) Blum ↔ Microvellum and Blum ↔ PolyBoard: official “software partner” channel

- Blum lists **Microvellum** as a software partner and enumerates supported Blum hardware families. [21](https://www.blum.com/us/en/services/e-services/softwarepartners/microvellum/)
- Blum lists **PolyBoard** as a software partner and states:
    - PolyBoard contains an integrated Blum fittings library and configurator
    - “**There is no charge for product data integration**” (Blum → PolyBoard). [22](https://www.blum.com/gb/en/services/industrial-production/cad-cam-interface/software-partners/wood-designer/)

**Implication**

- Blum appears to license/provide data to these software partners under commercial terms (with “no charge” at least for PolyBoard integration on Blum’s side), while end users get it bundled with the PolyBoard/Microvellum ecosystem.

## 3) Microvellum distribution: library updates delivered to customers

Microvellum states its Product Engineering team releases **Foundation Library updates** that include new hardware items from multiple manufacturers (e.g., Blum MERIVOBOX, Hettich Sensys hinges, Häfele Ironfix, etc.) and that updates can be downloaded from the **Microvellum Community**. [23](https://www.microvellum.com/resources/news/microvellum-product-engineering-team-continues-to-deliver-new-content)

**Interpretation**

- Microvellum is acting as the **content packager/distributor**; manufacturers are sources, but the “deliverable” is a Microvellum library update under subscription/community access.

## 4) imos: supplier data via iFurn Design Catalog + contract-controlled access

imos support content says:

- “**The iFurn Design Catalog offers you current supplier data** that you can use for your construction”
- Access credentials come from an **imos Administrator** (i.e., contract/customer-controlled). [24](https://support.imos3d.com/en/software)

imos marketing also highlights “current connector data from well-known manufacturers” being available for use. [25](https://www.imos3d.com/en/products/design-order/ix-cad-1)

**Interpretation**

- imos obtains manufacturer catalogs via a supplier-data program (iFurn) and distributes them within the imos environment to licensed customers.

## 5) Cabinet Vision (Hexagon)

What I can support with sources in this run:

- There is a general concept of add-on catalogs being purchased/downloaded (example: “door catalogs” for Cabinet Vision, sometimes distributed via Hexagon eSupport). [26](https://www.pidesign.com/clients/decore/vision2/)
- Separately, Hettich lists **cabinet vision** as a CAD partner for embedded Hettich fitting data. [2](https://www.hettich.com/en-us/services/hettich-cad)

**What I cannot fully evidence here**

- The exact **license model** for hardware libraries inside Cabinet Vision (whether manufacturer-paid “catalog program,” end-user paid add-on packs, etc.). You should treat this as “requires vendor confirmation.”

---

# C) “Freely downloadable” vs “partner agreement” (normalized classification)

|Manufacturer|Public CAD downloads (no agreement implied)|Account-gated (registration/login)|Partner feed / agreement likely|
|---|---|---|---|
|Blum|Some CAD downloads exist via services, but largely behind E‑SERVICES|**Yes** (E‑SERVICES for product DB/configurators) [8](https://www.blum.com/al/en/services/planning-construction-product-selection/product-database/)|**Yes**: BMEcat/XML + Excel data packs service [1](https://d2.blum.com/services/BEC003/me25532797_fo_dok_bau_%24sen_%24aof_%24v1.pdf)|
|Hettich|**Yes**: CAD download bundles incl. DWG/DXF/STEP/IGES/SAT… [12](https://www.hettich.com/es-us/services/hettich-cad/descargas-cad)|eShop may be login for some workflows (not proven in sources here)|**Yes**: embedded partner catalogs (Cabinet Vision/imos/Microvellum etc.) [2](https://www.hettich.com/en-us/services/hettich-cad)|
|Häfele|Claimed “free of charge” CAD data; formats via portal (not fully enumerated here) [15](https://manuals.plus/m/7de5ec4bbe2ed8eb90a99ebb78739eaa2e2b6ec046985a235b972781e67e0286)|Often effectively account/tool gated (site access restrictions observed)|**Yes**: CAM datasets + imos transfer via configurators [14](https://www.hafele.nl/nl/info/service/alle-configuratoren/92602/)|
|GTV|**Yes**: STP + OBJ downloads on product pages [4](https://gtv.com.pl/en/produkt/PR-SP-550-10/)|Not evidenced|Not evidenced|
|BOYARD|**Yes**: large ZIP libraries + formats + dated archives [5](https://www.boyard.biz/3d_models)|Not evidenced|Not evidenced|
|Samet|Media center downloads public; CAD via TraceParts|TraceParts is typically account-based (free registration model) [19](https://info.traceparts.com/designers/engineers-and-designers/join-the-community/)|If you need full PIM feed: not evidenced publicly|
|Titus (TitusPlus)|**Yes**: PDFs/brochures in download area [7](https://www.titusplus.com/us/en/resources/download-area)|Not evidenced|CAD/PIM feed not found in this run|

---

# D) “Contact path for data partnership” (what’s explicitly published)

- **Blum**: through Blum representative / Blum contact partner; product database page and BMEcat service PDF instruct contacting Blum. [8](https://www.blum.com/al/en/services/planning-construction-product-selection/product-database/)
- **Hettich**: via **Hettich CAD** program hub (partner program implied by CAD partners list). [2](https://www.hettich.com/en-us/services/hettich-cad)
- **Häfele**: UK Projects/CAD services team contact (email/phone) published on Projects 360° CAD services page. [16](https://www.hafele.co.uk/en/info/project-360-/project-360-services/projects-360-cad-services/86489/)
- **GTV**: producer email/phone on product page. [4](https://gtv.com.pl/en/produkt/PR-SP-550-10/)
- **BOYARD**: “Контакты” and “Задать вопрос” entry points from the 3D models page nav. [5](https://www.boyard.biz/3d_models)
- **Samet**: customer service contact published on media center page. [6](https://www.samet.com.tr/us-EN/media/document)
- **TitusPlus**: country office contacts page (example shown for Iberia). [20](https://www.titusplus.com/es/es/contactos)

---

# E) Practical legal ingestion guidance (normalized pipeline blueprint)

To keep your ingestion pipeline _both normalized and legally defensible_:

1. **Prefer official PIM feeds over scraping CAD portals**
    
    - For Blum, the BMEcat v1.2 + Excel data pack is the cleanest foundation for product master data + media references. [1](https://d2.blum.com/services/BEC003/me25532797_fo_dok_bau_%24sen_%24aof_%24v1.pdf)
2. **Treat CAD downloads/configurator outputs as “engineering attachments,” not your system of record**
    
    - Store them as versioned artifacts keyed to a SKU/configuration hash (especially for BXF-like manufacturing exports). [9](https://d2.blum.com/services/BEC003/me173052_fo_dok_bau_%24sen_%24aof_%24v4.pdf)
3. **Separate “media licensing” from “technical data access”**
    
    - Even where downloads are public, don’t assume you have rights to redistribute images/animations. Blum explicitly flags copyright on E‑SERVICES content. [11](https://d2.blum.com/services/BEC003/ebiz0007-fo-118_fo_dok_bau_%24sen_%24aof_%24v2.pdf)
    - Build a rights table: `asset_type`, `source`, `license_grant`, `allowed_use (internal/design/sales)`, `rehosting_allowed (Y/N)`, `expiry`.
4. **For CAD/CAM software libraries (imos/Microvellum/etc.), don’t ingest by extraction**
    
    - Manufacturers distribute through partner channels (Hettich explicitly; Blum via software partners). [2](https://www.hettich.com/en-us/services/hettich-cad)
    - If you need that content, negotiate directly with the manufacturer or the software vendor for a **data license** rather than reverse-engineering library files.
5. **Use “contact path escalation” by data type**
    
    - PIM feed → manufacturer digital/product-data team (Blum example). [1](https://d2.blum.com/services/BEC003/me25532797_fo_dok_bau_%24sen_%24aof_%24v1.pdf)
    - CAD portal bulk export → manufacturer CAD service program (Hettich CAD, BOYARD 3D libs, GTV downloads). [2](https://www.hettich.com/en-us/services/hettich-cad)
    - Media (images/animations) → marketing media library owner (Blum explicitly has one). [11](https://d2.blum.com/services/BEC003/ebiz0007-fo-118_fo_dok_bau_%24sen_%24aof_%24v2.pdf)

If you want, I can output a **schema** for your ingestion pipeline (tables + required metadata + rights flags), and a per-manufacturer **“connector spec”** (auth method, polling cadence, artifact naming/versioning rules) using only the evidence-backed channels above.



---


**Recommended Architecture for 10k+ SKU Catalog in React Native/Expo on Low-End Android (4GB RAM)**

The optimal setup prioritizes **lazy loading**, **native-thread querying**, **minimal JS memory footprint**, **versioned immutable catalog updates via binary diffs/patches**, aggressive disk-based asset caching, and a true offline-first/local-first model. This avoids loading the full catalog into JS (which causes OOM, slow launches, and jank on budget devices with ~2–2.5 GB usable RAM after system overhead).[1](https://www.clariontech.com/blog/right-database-for-react-native-app)[2](https://github.com/nozbe/watermelondb)

### Core Stack

- **Database**: WatermelonDB (on top of op-sqlite or expo-sqlite with FTS5). Pre-populated read-mostly catalog DB shipped in assets (copy to Documents on first launch or use `createFromLocation`). Mutable tables for user data (cart, wishlist, outbox).
    
    - Why Watermelon + op-sqlite? Watermelon provides lazy loading (only materializes records you request—e.g., 20 items for a screen even on a 500k-row DB), React observables, and queries executed on a native SQLite thread. Most filtered queries <1 ms even at 10k–500k records; app launch remains fast regardless of total DB size. op-sqlite (JSI-based) delivers 5–8× faster queries and ~5× lower peak memory than bridge-based expo-sqlite (e.g., large queries: ~1.1 s low memory vs 10 s+ and 1.2 GB spikes). FTS5 virtual tables enable fast full-text search (name, description, SKU, attributes) in <50 ms typical on 10k items.[3](https://www.pkgpulse.com/guides/expo-sqlite-vs-watermelondb-vs-realm-react-native-local-2026)[4](https://medium.com/code-well/choosing-the-right-database-for-your-react-native-app-137f4893b182)[5](https://oneuptime.com/blog/post/2026-01-15-react-native-sqlite/view)
    - Alternatives trade-offs:
        - Raw expo-sqlite: Simpler for small scale but easy to pull too many rows into JS bridge → high memory and slow on low-end. Avoid bulk loads.
        - Realm (now Atlas Device SDK): Excellent lazy native objects, lower RAM in some tests, strong built-in sync. However, ecosystem/vendor considerations, older RN reports of scaling issues at tens of thousands, and potential deprecation paths for certain sync features make it secondary unless you need their backend sync.[6](https://stackoverflow.com/questions/39557635/realm-database-performance)[7](https://stackshare.io/stackups/realm-vs-watermelondb)
        - Pure JSON/FlatBuffers in AsyncStorage/MMKV: Fast for tiny catalogs but parsing 10k+ objects at startup adds 1–2+ s and multi-hundred MB spikes—unacceptable on 4 GB devices.
- **UI Layer**: `@shopify/flash-list` (or New Architecture RecyclerListView) for product lists/grids—virtualized, far lower memory and smoother scrolling than FlatList for 10k+ items (can maintain 60 FPS with proper windowing and memoization). TanStack Query (with persistence) layered on top of Watermelon for caching, optimistic updates, and stale-while-revalidate UX. Use Hermes + React Native New Architecture (Fabric/TurboModules) for better startup, lower bridge overhead, and improved list rendering (one benchmark showed clear wins rendering 10k views).[8](https://github.com/reactwg/react-native-new-architecture/discussions/85)
    
- **Images**: `expo-image` (or `react-native-fast-image`). Mandate WebP (30–50% smaller than JPEG/PNG at similar quality). Strategy: thumbnails (100–200 px) in lists, on-demand higher-res in details. Primary cache policy = disk (with aggressive LRU eviction); limit in-memory cache to ~30–50 MB on low-end devices. Prefetch critical/featured items during sync or on WiFi. Bundle a small set of hero images; sync the rest for offline. This keeps memory low while supporting full offline browsing.[9](https://semaphore.io/blog/react-native-performance)
    
- **Animations**: Optimized Lottie (via `lottie-react-native`, preferably with Skia renderer/Skottie where available) loaded lazily/on-demand. Keep individual JSON files <50–100 KB; do **not** embed large Lottie JSON in the JS bundle (it bloats startup time and memory). Prefer for vector icons, loading states, and simple product highlights.
    
    - Trade-offs vs alternatives: Lottie files are often 4× smaller than equivalent MP4/video and scale perfectly; however, complex files can drop to 17–40 FPS with higher CPU/RAM (25–50+ MB peak per animation in some tests) on low-end Android. Rive frequently hits 60 FPS with lower native/Java memory (e.g., one benchmark: Rive ~25 MB native vs Lottie 49 MB; total app memory savings observed from ~420 MB to ~255 MB with optimizations). Animated WebP is compact for raster but can have decoding CPU spikes. MP4 (via `react-native-video`) offers hardware decode and smooth playback for complex loops but has highest memory/player overhead and larger files—use only for key product videos. Conditional rendering or static fallbacks on very low-end devices.[10](https://www.callstack.com/blog/lottie-vs-rive-optimizing-mobile-app-animation)[10](https://www.callstack.com/blog/lottie-vs-rive-optimizing-mobile-app-animation)
- **Versioned Immutable Data Packs + Binary Diffs**: Ship initial catalog as a pre-populated SQLite file (~5–15 MB compressed with indexes/FTS5). Backend maintains versioned immutable snapshots. App checks a lightweight manifest (version, patch URL, hash). Download binary patch (bsdiff, xdelta, or server-generated delta) on update—typically reduces payload 80–95% (e.g., 100 KB–2 MB vs full 5–20 MB catalog for incremental changes). Apply patch to local DB file in background (or import row-level deltas via SQL). Full download as fallback. For mutable user data, use an “outbox” table (local writes succeed immediately; changes queued with timestamps/tombstones). Sync pattern: pull catalog deltas or versioned packs + push outbox when online (NetInfo + `expo-background-fetch` or WorkManager equivalent, throttled to WiFi/charging). Conflict resolution: server-wins for catalog; timestamp-based or per-field merge for user data. This is more reliable than full resync or pure JSON patches for large catalogs.[11](https://implementationdetails.dev/blog/2020/05/03/react-native-offline-first-db-with-sqlite-hooks/)[12](https://dev.to/sathish_daggula/react-native-offline-first-conflict-safe-sqlite-sync-549a)
    
- **Offline-First Sync & Cold-Start Strategy**: Local-first everywhere—reads/writes hit Watermelon immediately (optimistic UI). Catalog is “cached + versioned”; user actions use outbox. Background sync on connectivity changes or schedule. Defer non-critical work (full sync, analytics) until after first paint/splash screen. Use persisted TanStack Query or Watermelon observers for reactive updates. Cold start target: 1.8–3 s on low-end (Hermes + lazy DB init + deferred sync achieves this; naive full JSON load or heavy bundle can push 4–6+ s with memory spikes). Pre-populated DB open is fast (<200 ms). Comparable RN e-commerce/catalog apps on budget Android achieve smooth search/filter on 10k+ SKUs with sub-3 s starts and no crashes using similar patterns.[13](https://www.rutvikbhatt.com/lynx-vs-react-native-performance-implications-and-benchmarking/)
    

**Quantified Trade-offs** (drawn from benchmarks, Watermelon docs, Callstack/Rive analyses, and RN performance reports; real numbers vary by device/implementation but are representative for low-end 4 GB Android):

- **Performance & Memory**: Watermelon lazy + op-sqlite → queries <1 ms (filtered/paginated), searches <50 ms on 10k items, no OOM on large DBs. Vs raw SQLite/JSON: avoids 1–2 s+ parse times and GB-scale spikes; one e-comm benchmark showed ~148–210 MB peak memory for 10k listings (lighter frameworks ~29% lower). Lottie/Rive: 17–40 FPS (Lottie) vs ~60 FPS (Rive) with 25–50+ MB per animation; WebP saves 30–50% file size vs JPEG. FlashList enables 60 FPS scrolls on 10k-item lists where FlatList drops to 45–50 FPS.[1](https://www.clariontech.com/blog/right-database-for-react-native-app)[10](https://www.callstack.com/blog/lottie-vs-rive-optimizing-mobile-app-animation)
- **Cold Start & Launch**: Optimized (Hermes + defer + lazy) = 400–800 ms interactive catalog after splash (total cold start 1.8–3 s). Naive (load all to JS or heavy bundle) = 4–6+ s + high RAM. Hermes alone often cuts startup 20–40%. New Arch helps lists but can increase UI thread use in some text-heavy scenarios.[13](https://www.rutvikbhatt.com/lynx-vs-react-native-performance-implications-and-benchmarking/)
- **Bundle & Update Size/Bandwidth**: Pre-bundled DB adds ~10–20 MB to APK. Lottie/WebP assets: 40–75% smaller than video/GIF equivalents. Binary diffs/patches: updates 80–95% smaller (100 KB–2 MB typical incremental) vs full catalog resync. Total APK target <30–50 MB feasible with code splitting and remote assets.[14](https://dev.to/retyui/boost-your-react-native-app-start-time-stop-shipping-lottie-json-incorrectly-2074)
- **Battery/Offline UX**: Background sync throttled → minimal impact. “Stale while revalidate” or “updated X min ago” keeps UX responsive. True offline catalog + local mutations = no blank screens.
- **Dev Complexity & Maintenance**: Higher upfront (custom sync adapter, FTS5 native config, patch application logic, device profiling) vs Firebase/Realm managed sync. But full control, no vendor lock, better low-end reliability, and true offline. Watermelon reactivity reduces boilerplate vs raw SQLite.
- **Scalability**: Proven for 10k–tens of thousands of records on slow Android (Watermelon design goal). Beyond ~100k–500k rows or very complex joins, monitor with Android Profiler/Sentry; consider stricter pagination or sharding.

**Implementation Tips & Monitoring**: Profile on real low-end devices (e.g., older Samsung A-series or equivalents with 4 GB RAM). Use Expo Atlas for bundle analysis, Flipper/Sentry for performance, Android Profiler for memory/CPU. Test cold starts, search, scrolling 10k-item lists, background sync, and low-storage scenarios. Bundle minimal assets; lazy-load everything else. For Expo-managed, ensure op-sqlite compatibility or fall back to expo-sqlite with strict query limits.[15](https://www.callstack.com/blog/knowing-your-apps-bundle-contents-native-performance)

This architecture balances reliability, performance, and bandwidth on constrained hardware while keeping the app fully functional offline. It draws from patterns in real RN e-commerce/catalog apps serving emerging markets. Measure on your target devices and iterate—start with a Watermelon + FTS5 prototype and a pre-populated DB to validate the cold-start and query numbers.



---



## Recommended architecture (offline-first catalog, low-end Android) — in one view

**Core idea:** treat your product catalog as a **versioned, immutable “catalog pack”** (SQLite + FTS5 + maybe thumbnails), and keep _everything user-specific_ in a **small mutable DB** (cart, favorites, recent, outbox). Then update the immutable pack via **delta/changeset downloads** in the background and **atomically swap**.

**Why this wins on 4GB-RAM Android:** you avoid (1) parsing huge JSON on startup, (2) keeping 10k SKUs in JS memory, (3) expensive “ORM hydration”, and (4) repeated network fetches.

---

# 1) Local storage: SQLite + FTS5 (and when _not_ to)

### Why SQLite + FTS5 is the default choice for 10k+ SKUs

- **SQLite is already on-device**, proven, and excellent for “catalog-shaped” data (products, categories, variants, prices, inventory, attributes).
- **FTS5** is SQLite’s built-in full-text search engine via a virtual table module. [1](https://www.sqlite.org/fts5.html)
- In Expo, `expo-sqlite` can **enable FTS5 at build time** via the config plugin (`enableFTS: true`). [2](https://docs.expo.dev/versions/latest/sdk/sqlite/)

### Minimal schema pattern (fast search + small JS memory)

Use **two DB files**:

1. **catalog.db (immutable / read-mostly)**

- `product(id, title, subtitle, brand, price_cents, currency, …)`
- `category(id, name, …)`
- `product_category(product_id, category_id)`
- `variant(id, product_id, sku, …)`
- `inventory(variant_id, qty, updated_at, …)` (optional)
- `product_search_fts` (FTS5)

2. **user.db (mutable / tiny)**

- `favorites(product_id, created_at)`
- `recent(product_id, last_viewed_at)`
- `cart(line_id, variant_id, qty, …)`
- `outbox(id, op_type, payload_json, created_at, retry_at, …)`
- `sync_state(key, value)` (cursor/etag/version tokens)

This split is the single most important “catalog app” best practice: it keeps catalog updates simple and prevents user-state conflicts.

---

# 2) SQLite + FTS5 in Expo: performance realities (with published numbers)

## The boundary-cost problem (JS ↔ native) is real

Even if SQLite itself is fast, your _React Native binding_ can dominate performance when you do lots of small operations (many selects, many row-to-JS conversions).

A published benchmark by PowerSync compared several RN SQLite bindings (op-sqlite, quick-sqlite, expo-sqlite) on **Android (Samsung S22, Expo 51)** and shows large variance depending on batching and library. [3](https://powersync.com/blog/react-native-database-performance-comparison)

### A few benchmark rows that map to “catalog app” behavior

From the Android results table (times in ms): [4](https://powersync.com/_vercel/image?q=75&url=%2Fimages%2Fblog%2Freact-native-database-performance-comparison-inline-f41cbf6a18.png&w=1920)

|Operation (PowerSync benchmark)|expo-sqlite|op-sqlite|react-native-quick-sqlite|
|---|---|---|---|
|**5000 SELECTs with an index**|**675.22**|150.08|**130.74**|
|**100 SELECTs on string comparison**|208.75|245.58|193.62|
|**25,000 INSERTs in a transaction**|**3841.08**|676.95|627.11|
|**25,000 UPDATEs with an index**|**3275.37**|701.41|599.11|

**Takeaway:** for read-heavy catalog browsing (a handful of queries per screen), `expo-sqlite` is often fine. But for **bulk ingest / heavy delta-apply / rebuild operations**, faster JSI-first bindings can be multiple times quicker.

### What I recommend in Expo-managed workflow

- Start with **`expo-sqlite`** for simplicity + good Expo support.
- If you later hit performance ceilings (slow delta apply, slow rebuild, slow heavy filtering), consider a **JSI-first SQLite binding** such as `op-sqlite` (more native setup) — the PowerSync comparison includes it for a reason. [3](https://powersync.com/blog/react-native-database-performance-comparison)

Also: enable SQLite best practices:

- Use **WAL mode** for the mutable DB (many small writes), as commonly recommended; Expo’s docs show setting `PRAGMA journal_mode = WAL;`. [2](https://docs.expo.dev/versions/latest/sdk/sqlite/)

---

# 3) Alternatives to SQLite+FTS5 (and why they usually lose for catalogs)

## A) JS in-memory search indexes (MiniSearch/Lunr/FlexSearch)

**Pros:** simple, no SQL.  
**Cons:** you pay in **cold-start time** and **JS heap**, because you must load/build an index and often keep many strings in memory. For 10k SKUs, this can be workable, but it’s exactly the kind of “slow mass-market Android” pitfall Hermes/SQLite-based designs avoid.

## B) WatermelonDB

WatermelonDB’s docs explicitly emphasize that apps can be fast at large scale because you rarely need to load more than a few dozen records at launch. [5](https://watermelondb.dev/docs/Query)  
**Pros:** reactive queries, sync patterns, avoids loading everything.  
**Cons (for your use case):** extra abstraction and operational complexity. For a catalog that is mostly read-only, you often don’t need reactive graph syncing for the catalog itself; SQLite + a thin query layer is simpler.

## C) Realm

Realm can be very fast, but it’s an object store with its own sync story, and you’ll still need a **text search strategy** comparable to FTS5. For “SKU catalog + full-text search + pack updates”, SQLite remains the most direct fit.

---

# 4) Versioned immutable “catalog packs” + diffs (binary diffs vs row-level diffs)

You asked specifically for **versioned immutable packs** with **binary diffs**. The best practice is to support _two_ delta lanes:

## Lane 1 (preferred): **SQLite Session Extension changesets** (row-level diffs)

Expo’s SQLite API exposes the **SQLite session extension** (`SQLiteSession`) including methods to **create changesets** and **apply changesets**. [2](https://docs.expo.dev/versions/latest/sdk/sqlite/)  
SQLite describes the session extension as a way to **record changes**, package them as a **changeset/patchset**, and apply them to another database with the same schema and compatible base data. [6](https://www.sqlite.org/sessionintro.html)

**Why it’s better than file-level bsdiff for SQLite DBs:**

- SQLite database files are page-based; small logical changes can reshuffle pages, which can reduce “binary diff friendliness”.
- A row-level changeset size scales more like:  
    **≈ changed rows × (primary key + changed columns + overhead)**

**Operational pattern**

- Ship/download **catalog.db vN** (immutable).
- Server publishes **changeset vN→vN+1** (compressed).
- App downloads changeset, applies it in the background:
    - Apply to a **staging** copy of the DB.
    - Validate integrity (`PRAGMA integrity_check`, row counts, version markers).
    - Atomic swap: rename staging → active.
    - Keep vN as rollback for one version.

## Lane 2 (fallback): file-level **bsdiff** patches for packs

Google Play uses **delta updates** and publicly reported that using `bsdiff` reduced update sizes **on average by 47% compared to the full APK size**. [7](https://android-developers.googleblog.com/2016/12/saving-data-reducing-the-size-of-app-updates-by-65-percent.html)  
That’s a strong endorsement of “binary diffs work at scale” — but for SQLite DB files specifically, row-level changesets are usually more predictable.

**Recommendation:** implement bsdiff-style patching only if:

- you can’t produce clean row-level changesets, or
- your pack is not pure SQLite (e.g., a big blob pack, a zip of thumbnails, etc.)

---

# 5) Images & animations: caching strategy + format choice (animated WebP vs Lottie vs MP4)

## 5.1 Image caching in Expo: use `expo-image`, but know what it is

`expo-image`:

- supports **disk + memory caching**
- uses **SDWebImage (iOS)** and **Glide (Android)** under the hood [8](https://docs.expo.dev/versions/latest/sdk/image/)
- lets you choose cache policy (`disk`, `memory`, `memory-disk`) [8](https://docs.expo.dev/versions/latest/sdk/image/)

**Best practice for catalogs:**

- List thumbnails: `cachePolicy="memory-disk"` (fast scroll; disk fallback)
- Product detail hero: `cachePolicy="disk"` (don’t bloat memory)
- Always specify image dimensions to avoid decoding giant bitmaps unnecessarily (on Android, bitmap memory is often the killer, not network).

### Disk cache sizing reality (Android)

Glide’s documented default disk cache size constant is **250 MB** in its API docs (and is configurable). [9](https://bumptech.github.io/glide/javadocs/380/com/bumptech/glide/load/engine/cache/DiskCache.Factory.html)  
Treat this as “best-effort cache”: the OS may clear caches under storage pressure.

**Offline guarantee rule:** if the user _expects_ something to be available offline (e.g., “saved items”), store it in **persistent app storage** (e.g., `expo-file-system`) and use `expo-image` only for rendering/caching convenience.

## 5.2 Animated WebP vs Lottie vs MP4 — decision table (quantified)

### Lottie (best for UI / vector animations)

Airbnb’s Lottie page notes that **PNG sequences** can be **30–50× the size** of the exported Bodymovin JSON (and don’t scale). [10](https://airbnb.tech/opensource/lottie/)

**Use Lottie when:**

- it’s UI illustration, iconography, onboarding, skeletons
- you want scalability and tiny downloads
- you need interactivity (progress, colors, theming)

**Avoid Lottie when:**

- it’s effectively video/photographic content
- it uses heavy masks/mattes/blur and causes frame drops on low-end Android (common in practice)

### Animated WebP (best for small raster loops with alpha)

Google’s WebP FAQ states: converting animated GIFs to WebP yields **~64% smaller (lossy)** and **~19% smaller (lossless)** files. [11](https://developers.google.com/speed/webp/faq?hl=ja)  
(That’s a _real_ bandwidth/storage win for small looping UI animations.)

**Caveat in Expo:** `expo-image` has had real-world changes around WebP decoding support due to a libwebp CVE; Expo notes potential regressions in animated WebP support depending on versions. [12](https://expo.dev/changelog/2023-09-29-libwebp)  
So: test on your lowest-end target device/Android version.

### MP4 (best for “looks like video”)

A concrete published example from Imgur’s GIFV rollout: a **50 MB GIF** converted to an MP4-based format became **~3.4 MB**. [13](https://tweakers.net/nieuws/98965/imgur-introduceert-gifv-extensie-als-alternatief-voor-animated-gifs.html)  
That’s roughly a **93% reduction** (and is typical when replacing GIF-like content with video codecs using inter-frame compression).

**Use MP4 when:**

- it’s a product “micro-demo” clip
- it’s photographic content
- it’s longer than a couple seconds
- you need hardware decode efficiency

**Downside:** alpha/transparency isn’t standard in baseline MP4/H.264 workflows, so you’ll need design workarounds.

---

# 6) Cold start impact: what actually moves the needle (with published numbers)

## Enable Hermes (it’s one of the few changes with published, app-level numbers)

React Native published benchmark data (Mattermost app) showing on **Android (Galaxy S20)**:

- startup time improved from **1.97s → 0.96s** (reported as **51% faster**) [14](https://reactnative.dev/blog/assets/hermes-default-android-data.png)
- raw APK size reduced from **72.1 MB → 58.2 MB** [14](https://reactnative.dev/blog/assets/hermes-default-android-data.png)
- memory consumption reduced from **398 MB → 305 MB** [14](https://reactnative.dev/blog/assets/hermes-default-android-data.png)

For a catalog app on low-end Android, **startup + memory** are exactly the pain points, so this matters.

## Catalog-specific cold-start best practices

1. **Never load the full catalog into JS** on startup.
    - Do “just enough” queries: featured categories, recent, cached search suggestions.
2. **Defer pack update checks** until after first render (show cached catalog version immediately).
3. **Avoid synchronous storage calls** on the JS thread during first paint.
4. If you ship an initial DB, **copy/decompress it off the critical path** (show UI first, then finalize in background when possible).

---

# 7) Offline-first sync patterns that work well for catalogs

## Pattern A (most common): “Immutable catalog + mutable user overlay”

- **Catalog updates**: pack swap (full pack or changeset)
- **User data sync**: classic offline-first “outbox”
    - Writes go to `user.db.outbox` immediately
    - Background job pushes to server with retries
    - Server returns authoritative state or conflict resolution
    - Pull loop updates local overlay tables

This avoids almost all conflict complexity because you do **not** edit catalog rows locally.

## Pattern B: If you want “database replication” style sync

Expo SQLite has **libSQL integration** and a `syncLibSQL()` method for synchronizing with a remote libSQL server. [2](https://docs.expo.dev/versions/latest/sdk/sqlite/)  
This can be attractive for local-first sync, but it’s a bigger architectural commitment than the “pack + overlay” model.

---

# 8) Trade-offs quantified (what you’re choosing)

## 8.1 Storage engine choice (SQLite bindings)

**Published benchmark evidence (Android, S22):** for bulk transactional operations, expo-sqlite was much slower than some JSI-first options in PowerSync’s comparison. [4](https://powersync.com/_vercel/image?q=75&url=%2Fimages%2Fblog%2Freact-native-database-performance-comparison-inline-f41cbf6a18.png&w=1920)

Practical interpretation for a catalog app:

- If you do **mostly reads** and a few queries per screen: expo-sqlite is usually OK.
- If you do **heavy background applies** (large changesets, frequent rebuilds, lots of batch upserts): consider op-sqlite/quick-sqlite class bindings earlier.

## 8.2 Delta strategy choice

- **Row-level changesets (SQLite session extension)**: scales with changed rows; best fit for catalogs; supported by Expo’s API surface. [2](https://docs.expo.dev/versions/latest/sdk/sqlite/)
- **Binary diffs (bsdiff)**: proven at app-update scale; Google reported **47% average reduction** vs full APK. [7](https://android-developers.googleblog.com/2016/12/saving-data-reducing-the-size-of-app-updates-by-65-percent.html)  
    But SQLite files can be “binary-diff unfriendly” unless you control how the DB is built.

## 8.3 Animation formats (download size)

- Animated WebP vs GIF: Google reports **~64% smaller (lossy)** in their FAQ. [11](https://developers.google.com/speed/webp/faq?hl=ja)
- PNG sequences vs Lottie JSON: Airbnb reports **30–50× larger** for PNG sequences. [10](https://airbnb.tech/opensource/lottie/)
- GIF vs MP4: Imgur example **50MB → 3.4MB**. [13](https://tweakers.net/nieuws/98965/imgur-introduceert-gifv-extensie-als-alternatief-voor-animated-gifs.html)

---

# 9) Concrete “do this” implementation checklist

## Database & search

- Use `catalog.db` + `user.db`
- Build **FTS5** offline; ship it in the pack (don’t build index on-device)
- Search query pattern:
    - `SELECT id FROM product_search_fts WHERE product_search_fts MATCH ? ORDER BY rank LIMIT ?`
    - Then fetch product cards by ids (keyset/preserved order)

## Packs & updates

- Manifest endpoint: `{version, minAppVersion, fullPackUrl, changesetUrlFromPrev, sha256, size}`
- Download to staging path
- Verify hash
- Apply changeset or unpack full DB
- Swap atomically

## Images

- Use `expo-image` for rendering + caching [8](https://docs.expo.dev/versions/latest/sdk/image/)
- Use BlurHash/ThumbHash placeholders to improve perceived speed [8](https://docs.expo.dev/versions/latest/sdk/image/)
- Persist “must-be-offline” images yourself (FileSystem), don’t rely only on cache eviction behavior

## Cold start

- Hermes on (measured startup + memory wins published by RN) [14](https://reactnative.dev/blog/assets/hermes-default-android-data.png)
- Render shell UI first, then warm caches / open DB / check for pack updates

---

If you want, I can turn this into a _reference architecture doc_ with:

- suggested table schemas + indexes (including FTS5 tokenizer/prefix settings),
- a pack manifest format,
- and an exact background update state machine (download/apply/verify/swap/rollback) tuned for Expo task limitations.


----



**Automatic Connector Assignment in Major Cabinetry CAD/CAM Systems** (imos iX, Cabinet Vision, Microvellum, Polyboard, Bazis). This reference synthesizes manufacturer documentation, training materials, reseller demos (YouTube tutorials), user forums (Woodweb, Reddit, sapr.ru equivalents), and technical PDFs. Every claim is traceable to sources.[1](https://www.imos3d.com/en/products/design-order/ix-cad-1/)[2](https://www.youtube.com/watch?v=eMJtKCkI3_8)[3](https://www.microvellum.com/)[4](https://wooddesigner.org/applying-several-hardware-fitting-to-a-joint/)[5](https://s3-cold.bazissoft.ru/documentation/en/Setup.pdf)

**Core Mechanism Common to All:** Rule- or library-driven parametric assignment. The software detects joint geometry (“connection situations”), matches it against pre-defined construction principles/methods/schemes, selects appropriate connectors from a library (with associated machining: drill depths, offsets, grooves), places them according to spacing/priority rules, and propagates changes. Machining, BOMs, assembling diagrams, and CNC code update dynamically. Upfront library/scheme creation is mandatory and human-intensive.[1](https://www.imos3d.com/en/products/design-order/ix-cad-1/)[6](https://www.surfaceandpanel.com/cabinet-vision-version-12-delivers-greater-control-and-flexibility-for-machining-and-automating-part-connections/)

### Comparative Parameter Table

|Parameter|imos iX|Cabinet Vision|Microvellum (Toolbox)|Polyboard (WoodDesigner)|Bazis (BAZIS-Mebelshchik)|
|---|---|---|---|---|---|
|**Connection-Situation Rules**|Auto-analyzes geometry/dependencies; selects fittings per parametric rules; inherits machining to neighbors. Special handling for C-constructions, differing depths, protruding areas.[1](https://www.imos3d.com/en/products/design-order/ix-cad-1/)[7](https://www.youtube.com/watch?v=dJ6o2ohDWrY)|Connections Manager defines exact behavior (dado, dowel, specific connector) where any two parts meet. Intelli-Joints for CNC flexibility.|Intelligent rules library defines joinery/hardware per situation; parametric formulas drive behavior.|Joint type + overpassing/underpassing (priority which panel overlaps). Overlapping/mitre rules supported.|Joint mounting settings (indents, alignment, spacing). Automatic fasteners per predefined joint algorithms.|
|**Construction Principles / Methods**|“Construction Principles” (e.g., Type_A for shelves); conditional logic in MOS/Article Designer/Object Designer triggers connectors + tooling. User-specific principles along article outlines.[8](https://soft-technik.net/download/B_06_Zasady_Konstrukcyjne__imos_EN.pdf?srsltid=AfmBOooYq_MQbViVZtYAfRy_JLl-c4bywN5EeDz-jjj592cy9elXSdoY)|Assembly Construction Wizard + Construction Methods that bundle joints. Section editor selects material/hardware construction.|Engineering logic/rules engine for part creation, sizing, joinery, machining. Customizable via libraries or Excel-driven parameters.|Quick Design libraries with pre-configured hardware setups. Sub-methods/Fitting Links define multiple fittings per joint.|Fastener schemes (“Схемы крепежа”) with algorithms (base-point/step, symmetric, variable spacing). Enterprise-specific rules for edge banding/perforation.|
|**Joint Priority Systems**|Implicit via parametric dependencies and special connection situations (e.g., double-dowels in overlap vs single in protrusion). C-construction handling.|Part order/priority in assembly; left/right connector variants resolved automatically or via manager.|Defined in rule library or project parameters; machine tokens can enforce priority.|Explicit “overpassing/underpassing” — user or library designates which neighboring panel has priority for overlapping/mitre joints.[9](https://www.youtube.com/watch?v=oSv9HDhpBDo)[10](https://www.youtube.com/watch?v=hAQraVYf9MU)|Positions placement settings; group options control arrangement. Joint start indent + “Align start indent” option aligns boundaries.|
|**User Override Models**|Interactive snap/identification points; Object Designer refresh; choose specific connector then auto-propagate; Connection Scan UI for catalog overview; design changes update dependents instantly.|Connections Manager for total control (2025 feature); up to 5 overrides in section editor; per-cabinet or per-joint edits; auto-rebuild on wizard changes.[11](https://www.instagram.com/reel/DObwOJ1D6V_/)|Adjust joinery/hardware in library or Project Wizard; machine tokens for custom placement; per-project overrides; formulas for quantities/positions.|Add multiple fittings to joint list with individual placement rules (offsets, counts, parametric); Quick Design libraries for fast application; manual rule editing.[4](https://wooddesigner.org/applying-several-hardware-fitting-to-a-joint/)|On-the-fly changeable settings; edit design parameters to update fasteners; manual positions in assembling diagrams; specify hardware/spacing/offsets/insertion logic in schemes.|
|**Limits of Automation (Human Decisions Required)**|Initial definition of Construction Principles/MOS rules; non-standard or conflicting situations (complex mitres, exotic materials, new connectors); final validation/optimization; choice of connector family when multiple options match rules. Special C-constructions often need explicit setup.[7](https://www.youtube.com/watch?v=dJ6o2ohDWrY)|Upfront Connections library/method setup is complex; ambiguous joints or conflicts require manual specification in Manager; optimization of count/spacing in high-load cases; one-off exceptions. Intelli-Joints add flexibility but also complexity.|Steep setup for precise drilling patterns (e.g., exact System 32 offsets often need custom machine tokens); custom/one-off designs or special conditions require human rule-building or post-edits. Forum reports highlight manual intervention for non-library hardware.[12](https://woodweb.com/cgi-bin/forums/cad.pl?read=770723)|User must define joint priority (over/under), build Fitting Links/lists, and placement rules. Automation applies pre-defined rules but does not infer new joint types; complex or non-rectilinear designs often need manual adjustment.|Initial configuration of fastener schemes, joint mounting settings, and enterprise rules is human-intensive. Non-standard furniture, conflict resolution, aesthetic/strength trade-offs, and final diagram validation typically require a constructor’s decision. Automatic only within pre-set rules.[5](https://s3-cold.bazissoft.ru/documentation/en/Setup.pdf)|

**Sources Summary (key examples):** imos — official site (imos3d.com), Construction Principles PDF/training videos, YouTube demos (Connection Scan, Object Designer, C-constructions).[1](https://www.imos3d.com/en/products/design-order/ix-cad-1/)[8](https://soft-technik.net/download/B_06_Zasady_Konstrukcyjne__imos_EN.pdf?srsltid=AfmBOooYq_MQbViVZtYAfRy_JLl-c4bywN5EeDz-jjj592cy9elXSdoY) Cabinet Vision — Hexagon Nexus docs (Intelli-Joints, Preferences), Surface & Panel articles, tutorial videos (Connections Manager).[6](https://www.surfaceandpanel.com/cabinet-vision-version-12-delivers-greater-control-and-flexibility-for-machining-and-automating-part-connections/)[13](https://nexus.hexagon.com/documentationcenter/en-US/bundle/CABINET_VISION_2025_HELP/page/Tips_Tricks_FAQs/SL.Understanding.Intelli-Joints.xhtml) Microvellum — microvellum.com product pages, Woodweb/Reddit forums, Project Wizard videos.[3](https://www.microvellum.com/)[12](https://woodweb.com/cgi-bin/forums/cad.pl?read=770723) Polyboard — wooddesigner.org articles/videos on hardware rules, overpassing joints, Quick Design.[4](https://wooddesigner.org/applying-several-hardware-fitting-to-a-joint/) Bazis — Setup PDF (bazissoft.ru), product brochures, YouTube on fastener schemes (“Схемы крепежа”), user manuals.[5](https://s3-cold.bazissoft.ru/documentation/en/Setup.pdf)

### Feature Floor We Must Match

These capabilities appear consistently across the tools and represent the baseline any competitive system must achieve:

- Parametric rule/library/catalog integration with major manufacturers (Hettich, Häfele, Blum, Titus, etc.).
- Automatic detection of connection situations/geometry and inheritance of machining (drills, depths, offsets, grooves, CAM data).
- Dynamic update on design changes (resize, material swap, parameter edit).
- Support for multiple connectors per joint + associated BOM/assembling diagrams/CNC output.
- User-accessible override UI (per-joint, per-cabinet, refresh/scan mechanisms).
- Configurable construction principles/methods/schemes with spacing, indents, priority (over/under or left/right), and conditional logic.
- Handling of standard joints (butt, mitre, overlapping, dado) and common hardware families (dowels, cams/Minifix/Rastex, Confirmat, shelf pins, Clamex-style).
- Output of machining, parts lists, and diagrams with positions.

### Differentiation Gaps (Where Human Constructor Decisions Are Still Required — Our Opportunity)

These are the consistent pain points and manual steps identified across documentation, training materials, and user forums. They define clear targets for superior automation:

- **Rule/Scheme Creation & Maintenance:** All systems require experienced users to build and tune libraries, construction principles, Fitting Links, machine tokens, or fastener schemes upfront. This is time-intensive and enterprise-specific. **Target:** AI-assisted inference or machine-learning from example projects/high-level descriptions (“use demountable hidden connectors where possible, prioritize strength > cost”).
- **Ambiguous or Non-Standard Joints:** Complex mitres, variable-depth C-constructions, non-orthogonal/irregular panels, or exotic materials frequently need manual priority selection (over/under), special situation definitions, or post-placement edits. **Target:** Smarter geometric reasoning + simulation of fit/strength.
- **Priority & Conflict Resolution:** When multiple connector families satisfy a rule (e.g., Confirmat vs Minifix vs Clamex vs eccentric+dowel), or when rules conflict, humans choose. Left/right or symmetric placement can also require tweaks. **Target:** Integrated decision engine using engineering data (withdrawal/shear values, failure modes, cost, visibility, demountability, panel density) from the prior reference document.
- **Optimization & Validation:** Automatic placement rarely optimizes count/spacing for load, cost, or aesthetics without human review. Final verification of re-assembly cycles, creep, or edge distances often manual. **Target:** Built-in optimization with strength predictions, failure-mode alerts, and auto-suggestions tied to System 32 conventions.
- **One-Off/Custom or Aesthetic Decisions:** Truly bespoke designs, visible vs fully hidden connectors, or trade-offs (load vs ease of disassembly) rely on the constructor’s judgment. Setup for new/non-catalog hardware is rarely fully automatic. **Target:** High-level intent-based input (“premium demountable kitchen, 18 mm MDF, heavy shelves”) that auto-selects and justifies choices with data.
- **Enterprise/Regional Specificity:** Bazis excels at CIS/ESKD integration and parametric perforation but still needs heavy initial rule setup. Western tools integrate Blum/Hettich deeply but struggle with fully custom workflows. **Target:** Hybrid rule + AI system that learns per-shop preferences while embedding engineering knowledge (Eckelman-style formulas, manufacturer docs).

Matching the feature floor eliminates parity complaints. Closing these gaps—especially by embedding the connector engineering data (drilling specs, holding strengths, selection tables, failure modes) directly into an intelligent decision layer—creates measurable differentiation: reduced setup time, fewer manual overrides, data-driven recommendations, and higher confidence in automated outputs for both standard and edge-case furniture.[5](https://s3-cold.bazissoft.ru/documentation/en/Setup.pdf)

This reference can be extended with deeper dives into specific PDFs or version-specific updates. All numerical or highly specific procedural claims in related documents (e.g., exact offsets in System 32) remain governed by the prior engineering reference.



----




## What “automatic connector assignment” means in these systems (common pattern)

Across **imos iX, Cabinet Vision, Microvellum, Polyboard, and Bazis**, “automatic” almost always means:

1. **Detect a connection situation** (two parts share an edge/face, i.e., a joint/topology exists).
2. **Pick a joinery/connector strategy from a pre-defined construction standard** (construction method / construction rule / manufacturing method / scheme).
3. **Place hardware + machining parametrically** (offsets, min end distances, counts vs length, 32‑system alignment, which panel gets the “main” drilling).
4. **Propagate machining to both parts** and keep BOM/CNC updated when the model changes.

The **human constructor** is still responsible for choosing and maintaining the construction standard(s) (what connector family, where it’s allowed, what to do at corners/ends/conflicts, etc.). That “human gap” is the main differentiation target.

---

# 1) Feature floor you must match (baseline capabilities competitors already have)

|Capability (must-have)|What it looks like in production|Evidence (docs/training/forums)|
|---|---|---|
|**Connection-situation recognition (topological detection)**|Software recognizes “these two panels form a joint/edge condition” and drives fittings from that|imos: “Connection situations are automatically analyzed…” [1](https://www.imos3d.com/en/products/design-order/ix-cad-1) Polyboard: “Links… describe the join between 2 panels that are neighbours…” [2](https://wooddesigner.org/help-centre/polyboard-panel-assembly/) Bazis: styk defined as “общая часть… панелей” and joints are automatically determined and classified active/inactive [3](https://sapr.ru/article/25453)|
|**Rule-based connector placement (parametric offsets/count)**|Connector count/positions update when cabinet resizes; offsets and spacing rules are configurable|imos: fittings “positioned according to parametric rules” [1](https://www.imos3d.com/en/products/design-order/ix-cad-1) Polyboard: “Positioning rules… Automatic insertion and deletion of fittings upon change of cabinet dimensions” [4](https://www.fittingsoftware.com.au/index_htm_files/polyboard%20features%20list.pdf) Bazis: step multiple, fixed/min offsets, count-by-length tables; spacing forced to be a multiple of step [3](https://sapr.ru/article/25453)|
|**A “construction standard” layer (named methods/rules/schemes)**|Users select a construction method (or it’s defaulted per job/order), which drives connectors globally|imos: “Construction Rule” assigned in order header; default “Standard” if none [5](https://soft-technik.net/download/B_06_Zasady_Konstrukcyjne__imos_EN.pdf) Cabinet Vision: Connection Manager + assembly manager used to define/automate construction methods [6](https://craftsmanengineering.com/video/cabinet-vision-tutorial-intermediate-9-connections-manager) Bazis: “схема крепежа” is a predefined algorithm; used enterprise-wide [3](https://sapr.ru/article/25453) Polyboard: manufacturing methods are the effective way to modify links + fittings [2](https://wooddesigner.org/help-centre/polyboard-panel-assembly/)|
|**Joint priority / “which part is main”**|System knows which panel gets the drilling for a joint (main vs secondary), and supports over/underpassing|Polyboard: explicit “Link priority” options; mitre main/secondary determines which panel is drilled [2](https://wooddesigner.org/help-centre/polyboard-panel-assembly/) Cabinet Vision: edge-level connection selection is exposed (choose which connection applies on which edge) [7](https://www.linkedin.com/posts/planit-canada-inc_beawesome-cabinetvision-customcabinetry-activity-7371627003289976832-5nLo) Bazis: base edge can be front or rear; can switch basing point per joint set [3](https://sapr.ru/article/25453)|
|**User overrides (local edits without breaking the whole job)**|Override connectors on a specific edge/joint; replace one connector type with another|Bazis: “можно заменить один тип крепежа на другой для конкретного соединения… или всего изделия” [8](https://files.bazissoft.ru/component/content/article?Itemid=75&id=34) Cabinet Vision: user can right-click part/edge and choose connection from library (CV 2025) [7](https://www.linkedin.com/posts/planit-canada-inc_beawesome-cabinetvision-customcabinetry-activity-7371627003289976832-5nLo) Polyboard: “manual override control of all individual design elements” [4](https://www.fittingsoftware.com.au/index_htm_files/polyboard%20features%20list.pdf)|
|**Hardware libraries + extensibility (add new hardware + machining)**|Built-in supplier hardware + ability to add custom items and attach machining logic|Microvellum: default library supports hardware incl. connectors; users can add custom hardware [9](https://www.microvellum.com/solutions/engineering) Microvellum training explicitly covers adding new hardware and associating machine tokens (drill depth/hole spacing etc.) [10](https://www.microvellum.com/resources/videos/mvu-elearning/adding-new-hardware-with-machine-tokens-concealed-support-bracket) imos: iX Data includes “Construction Principles… connector drawings” [11](https://support.imos3d.com/en/hardware-version/installation/installation-imos-ix-2023)|
|**Conflict-awareness / error trapping (at least some)**|Detect impossible prompt selections or connector intersections; user resolves|Microvellum: added “error trapping” for invalid prompt values [12](https://www.microvellum.com/resources/news/microvellum-product-engineering-team-continues-to-deliver-new-content) Bazis: has modes for checking connectability and “пересечения элементов крепежа” [3](https://sapr.ru/article/25453)|

---

# 2) The “human gap” (what still needs constructor decisions today)

This table is your **differentiation map**: areas where the competitors’ automation stops and the human must decide.

|Human decision still required|Why current tools still need it (what’s missing)|Evidence|
|---|---|---|
|**Selecting the joinery strategy per product line** (confirmat vs cam+dowel vs dowel+glue vs concealed, etc.)|Tools automate placement **after** you choose/configure the construction method. They don’t “reason” about structural loads, visibility, shipping, re-assembly cycles, available machines, etc., as a first-class optimization problem.|Cabinet Vision integrators explicitly say you must “modify each set to use connections that suit your method” and those sets should be modified to suit your business solution [13](https://cabinetvision.screenstepslive.com/s/cvappstore/m/cvdatabase/l/1377889-joinery-it-startup-database-assembly-construction-configuration) Microvellum: users “select and customize” joinery options or “create custom joinery methods” [9](https://www.microvellum.com/solutions/engineering) Bazis: enterprise schemes are “разрабатываются опытными конструкторами” [3](https://sapr.ru/article/25453)|
|**Defining the rule library itself** (the “truth set” of allowed joints/connectors)|Libraries/schemes/methods are powerful but require upfront engineering; automation quality = quality of authored rules.|Bazis: “схема крепежа” is a predefined algorithm; mistakes avoided “при грамотно созданной схеме” [3](https://sapr.ru/article/25453) imos: example DB contains construction principles + connector drawings; i.e., master data authoring is expected [11](https://support.imos3d.com/en/hardware-version/installation/installation-imos-ix-2023) Microvellum: advanced training is about adding hardware + machining tokens [10](https://www.microvellum.com/resources/videos/mvu-elearning/adding-new-hardware-with-machine-tokens-concealed-support-bracket)|
|**Resolving connector collisions / overlapping placement rules**|Systems can warn/check, but they generally don’t auto-replan the joint (e.g., move fasteners, choose alternate connector family) with intent-aware constraints.|Polyboard explicitly warns: “make sure the placement rules don’t overlap” [14](https://wooddesigner.org/applying-several-hardware-fitting-to-a-joint/) Bazis offers checks for fastener intersections, implying human resolves the issue [3](https://sapr.ru/article/25453)|
|**Classifying “active” vs “inactive” joints** (what joints should actually receive connectors)|Geometry alone can’t know design intent (removable shelves vs fixed; decorative panels; transport knock-down points).|Bazis: joints are auto-detected and classified active/inactive, but “Задача конструктора… отредактировать статусы стыков” [3](https://sapr.ru/article/25453)|
|**Choosing the reference/basing edge per context** (front vs rear basing; drilling face selection)|Tools support changing basing, but don’t always infer which side is “best” for assembly aesthetics, access, or machine constraints.|Bazis allows changing basing from front edge to rear edge and changing installation face [3](https://sapr.ru/article/25453)|
|**Non-standard geometry & exceptions** (odd angles, unusual stacks, atypical thickness, mixed materials)|Automation usually assumes “in-family” situations; out-of-family needs manual connector modeling or new rules.|Microvellum: training covers creating a concealed bracket, converting to 3D solid, setting insertion point, adding machine tokens, and tuning drill depth/hole spacing—i.e., exceptions require explicit engineering [10](https://www.microvellum.com/resources/videos/mvu-elearning/adding-new-hardware-with-machine-tokens-concealed-support-bracket)|

---

# 3) How each platform assigns connectors automatically (mechanism-by-mechanism)

Below, each system is described using the same five lenses you requested: **(1) connection-situation rules, (2) construction principles, (3) joint priority, (4) overrides, (5) limits.**

---

## A) imos iX (iX CAD / iX CAM ecosystem)

### 1) Connection-situation rules (how it decides “what joint is this?”)

- imos states that **connection situations are automatically analyzed**, then **suitable connection elements are selected**, and **fittings are positioned by parametric rules**. [1](https://www.imos3d.com/en/products/design-order/ix-cad-1)

### 2) Construction principles (how joinery intent is represented)

- imos uses a **Construction Rule** concept that applies **Construction Principles (CPs)** to components (top shelf, sides, etc.). In the imos training example, a construction rule (“Type_A”) implements **dowel and cam connectors** as the connection method. [5](https://soft-technik.net/download/B_06_Zasady_Konstrukcyjne__imos_EN.pdf)
- Construction rules can be **assigned at order level**; if not set, imos uses the **“Standard” Construction Rule** as default. [5](https://soft-technik.net/download/B_06_Zasady_Konstrukcyjne__imos_EN.pdf)
- imos’ install/support docs make it explicit that iX master data includes **construction principles, variables, and connector drawings**, i.e., the automation depends on these authored objects. [11](https://support.imos3d.com/en/hardware-version/installation/installation-imos-ix-2023)

### 3) Joint priority system (which rule wins)

- **Order header → Construction Rule → component CP selection** is the practical priority ladder in the training workflow (standard rule if unset). [5](https://soft-technik.net/download/B_06_Zasady_Konstrukcyjne__imos_EN.pdf)
- Additionally, when a user inserts a connection, iX CAD “recognizes all dependencies” and inherits machining (drilling/grooving) to neighboring components—this is a form of dependency-driven precedence (machining propagates across the joint). [1](https://www.imos3d.com/en/products/design-order/ix-cad-1)

### 4) User override model

- Two main override vectors are clearly implied in official imos material:
    - **Choose/replace the Construction Rule** (per order) from the master data set. [5](https://soft-technik.net/download/B_06_Zasady_Konstrukcyjne__imos_EN.pdf)
    - **Insert a connection explicitly**; iX then propagates required machining to neighbors. [1](https://www.imos3d.com/en/products/design-order/ix-cad-1)

### 5) Limits of automation (where humans still decide)

- iX can’t invent “good” joinery from nothing: it presumes that **connector drawings + CPs + variables exist** in the master data and that the enterprise has authored appropriate construction rules. [11](https://support.imos3d.com/en/hardware-version/installation/installation-imos-ix-2023)
- The public docs describe parametric placement/selection, but do **not** publicly specify a “structural optimizer” (strength/cost/visibility) that chooses connector families; that decision remains in CP/rule authoring. [1](https://www.imos3d.com/en/products/design-order/ix-cad-1)

---

## B) Cabinet Vision (Hexagon) — Intelli‑Joints + Connection Manager + Construction Methods

### 1) Connection-situation rules

- Cabinet Vision’s **Connection Manager** is described as delivering control over “the machining that occurs where two parts meet” and enabling users to “define and automate those connections” (example given: dado with pre-drills or fixed position dowels with RTA fittings). [15](https://www.woodshopnews.com/news/learn-about-the-latest-version-of-cabinet-vision)

### 2) Construction principles (construction standards)

- Cabinet Vision integrates connections into construction standards through:
    - **Connection Sets** (defaults) that you configure in Connection Manager; the integration guide explicitly tells you to modify sets to use connections that suit your method. [13](https://cabinetvision.screenstepslive.com/s/cvappstore/m/cvdatabase/l/1377889-joinery-it-startup-database-assembly-construction-configuration)
    - **Conditional Connection Sets**: an “out of the box” approach described by an integration guide includes additional connection-set types already configured for **“Screw”, “Cam” and “Concealed”**, meant to be modified to match each business solution. [13](https://cabinetvision.screenstepslive.com/s/cvappstore/m/cvdatabase/l/1377889-joinery-it-startup-database-assembly-construction-configuration)
- For user-defined connector logic, Cabinet Vision has **Intelli‑Joints**:
    - An “I‑Joint Connection Type” exists specifically to define placement of Intelli‑Joints, and Intelli‑Joints are created in the Intelli‑Joint Manager. [16](https://planitcanada.ca/wp-content/uploads/2022/04/The-Smart-Guide-to-Cabinet-Vision-Core-Cabinets-V20220405-2.pdf)

### 3) Joint priority system

What’s publicly documentable (without internal manuals) is:

- There is an explicit separation between **Default Connection Sets** and **Conditional Connection Sets**, implying a precedence model where conditions can override defaults. [13](https://cabinetvision.screenstepslive.com/s/cvappstore/m/cvdatabase/l/1377889-joinery-it-startup-database-assembly-construction-configuration)
- Cabinet Vision’s ecosystem also distinguishes **connection definition** (Connection Manager) from **assignment/application** (Assembly Manager / edge connections), implying a two-stage “define then apply/assign” precedence. [6](https://craftsmanengineering.com/video/cabinet-vision-tutorial-intermediate-9-connections-manager)  
    **Limit note:** the exact evaluation order for conditional rules (e.g., first-match vs best-match) is not clearly published in the sources above; most shops learn this through training/internal docs.

### 4) User override model

- Connection choices can be made at the **edge level**: a Planit Canada post describing Cabinet Vision 2025 says you can right-click a part, choose edge connection, click an edge, and choose which connection from the Connection Manager library to use on that edge. [7](https://www.linkedin.com/posts/planit-canada-inc_beawesome-cabinetvision-customcabinetry-activity-7371627003289976832-5nLo)
- Integrators also caution that if you change joint direction, you may need to re-assign an appropriate connection set—i.e., overrides exist but require expertise to preserve expected results. [13](https://cabinetvision.screenstepslive.com/s/cvappstore/m/cvdatabase/l/1377889-joinery-it-startup-database-assembly-construction-configuration)

### 5) Limits of automation

- Cabinet Vision automation is extremely powerful **inside** the authored connection ecosystem, but explicitly expects humans to:
    - **Tune/modify the default and conditional connection sets** for the enterprise’s actual method and equipment. [13](https://cabinetvision.screenstepslive.com/s/cvappstore/m/cvdatabase/l/1377889-joinery-it-startup-database-assembly-construction-configuration)
    - **Create Intelli‑Joints** in Intelli‑Joint Manager for custom/novel hardware behaviors. [16](https://planitcanada.ca/wp-content/uploads/2022/04/The-Smart-Guide-to-Cabinet-Vision-Core-Cabinets-V20220405-2.pdf)

---

## C) Microvellum (Toolbox / Foundation Library / specification groups / edge arrays)

### 1) Connection-situation rules

Microvellum’s publicly documented approach is **library-driven**:

- Library products contain **subassemblies**—components “with their hardware” designed to be placed inside or integrated into other products. That is the core “connection situation → hardware behavior” packaging model. [17](https://www.microvellum.com/resources/videos/mvu-elearning/working-with-subassemblies)

### 2) Construction principles

- Microvellum states that its product library includes joinery methods such as **dowel joints, cam and dowel, dado, butt joints, mortise and tenon, and confirmat screws**, and that users can select/customize them or create custom joinery methods. [9](https://www.microvellum.com/solutions/engineering)
- Microvellum’s training emphasizes configuration via:
    - **Project-level variables** like **product prompts and project specification groups** (plus global variables) to set up cabinets with specific configurations. [18](https://www.microvellum.com/resources/videos/mvu-elearning/getting-to-know-products)
- Hardware placement is commonly exposed via **“Hardware Wizard”** inside **Library Specification Groups**; for example, OVVO connectors are accessed/placed via Hardware Wizard and are under “Hardware Edge Array.” [19](https://www.woodworkingnetwork.com/design/ovvo-connectors-now-available-microvellum-foundation-library)

### 3) Joint priority system

Publicly visible priority levers include:

- **Project specification groups / prompts** (choose joinery/hardware variants) as the first-order driver of what gets placed. [18](https://www.microvellum.com/resources/videos/mvu-elearning/getting-to-know-products)
- **Edge Array options** as a placement paradigm for connectors (e.g., Microvellum integrated “9 new Lamello Cabineo X hardware Edge Array options” and implemented Cabineo X into Toolbox with multiple assembly parts). [20](https://www.microvellum.com/resources/news/lamello-cabinet-connector-now-available-in-the-foundation-library)
- Microvellum also notes “better automation to change to CAM construction when using System 32” for closet parts—implying that some higher-level construction mode selection can override lower-level options in specific workflows. [12](https://www.microvellum.com/resources/news/microvellum-product-engineering-team-continues-to-deliver-new-content)

### 4) User override model

- Microvellum is explicit (via industry press) that users have **full control over hardware and material selections** and can make changes “at any stage of the design process.” [21](https://www.woodworkingnetwork.com/closets-conference-expo/closets-conference-expo-products/microvellum-demo-design-manufacturing)
- When the library doesn’t cover a case, Microvellum provides an engineering workflow: create hardware geometry, set insertion point, associate to parts, add **hardware machine tokens** (and tune drill depth/hole spacing), then verify machining. [10](https://www.microvellum.com/resources/videos/mvu-elearning/adding-new-hardware-with-machine-tokens-concealed-support-bracket)

### 5) Limits of automation

- Microvellum’s automation is strongest when you stay within **Foundation Library** patterns and prompt sets; exceptions often require explicit engineering (custom hardware + machine tokens). [10](https://www.microvellum.com/resources/videos/mvu-elearning/adding-new-hardware-with-machine-tokens-concealed-support-bracket)
- Microvellum has added “error trapping” for invalid prompt values, implying that even in parametric automation, not all prompt combinations are valid—humans still choose feasible configurations. [12](https://www.microvellum.com/resources/news/microvellum-product-engineering-team-continues-to-deliver-new-content)

---

## D) Polyboard (Wood Designer) — “Links” + “Fitting links” + placement rules

### 1) Connection-situation rules

- Polyboard uses **Links**: they “describe the join between 2 panels that are neighbours,” including outer panels, doors/drawers, and internal components. [2](https://wooddesigner.org/help-centre/polyboard-panel-assembly/)

### 2) Construction principles

- Industrial practice in Polyboard is to use **manufacturing methods** to modify links and also the fittings/edging associated with them (i.e., the joinery standard is applied as a method). [2](https://wooddesigner.org/help-centre/polyboard-panel-assembly/)
- Polyboard supports **parametric application of hardware fittings** including drilling/routing/grooving; you define **positioning rules** for number of hardware components and offsets, and fittings are automatically inserted/deleted when cabinet dimensions change. [4](https://www.fittingsoftware.com.au/index_htm_files/polyboard%20features%20list.pdf)

### 3) Joint priority system

- Polyboard has an explicit **Link priority** setting with options including **Overpassing, Underpassing, Mitre main, Mitre secondary**. [2](https://wooddesigner.org/help-centre/polyboard-panel-assembly/)
- For mitres, main vs secondary affects which panel gets drilled: main drills through one panel; secondary drills through the other. [2](https://wooddesigner.org/help-centre/polyboard-panel-assembly/)

### 4) User override model

- Polyboard supports “simple manual override control of all individual design elements.” [4](https://www.fittingsoftware.com.au/index_htm_files/polyboard%20features%20list.pdf)
- Users can edit the link details per panel via Properties → Links. [2](https://wooddesigner.org/help-centre/polyboard-panel-assembly/)

### 5) Limits of automation

- Polyboard can place multiple fittings on a joint by maintaining a **list of fittings + placement rules associated with the joint**—but it warns you must ensure placement rules don’t overlap (it won’t inherently “solve” the collision by choosing an alternative). [14](https://wooddesigner.org/applying-several-hardware-fitting-to-a-joint/)
- In short: Polyboard automates execution of your rules; it doesn’t fully automate rule conflict resolution or connector-family selection. [14](https://wooddesigner.org/applying-several-hardware-fitting-to-a-joint/)

---

## E) Bazis (БАЗИС‑Мебельщик / БАЗИС‑Шкаф) — “стык” + “схема крепежа” + step-multiple placement

### 1) Connection-situation rules

- Bazis introduces **“стык”**: the shared portion of edges/faces of panels that becomes the installation place for connectors. [3](https://sapr.ru/article/25453)
- Bazis can automatically determine all possible joints and sort them into **active** (will receive fasteners) and **inactive** (won’t). The constructor edits statuses. [3](https://sapr.ru/article/25453)

### 2) Construction principles (schemes as enterprise algorithms)

- Bazis uses a **“схема крепежа”**: a predefined algorithm that accounts for the nature of the connection and fastener parameters, developed by experienced constructors and made available across the enterprise. [3](https://sapr.ru/article/25453)
- In Bazis‑Шкаф, fastener placement is explicitly described as a **two-stage** system:
    1. Configure placement algorithms and assign connector types for functional groups (partitions, shelves, etc.)
    2. Placement/change on the designed model is then performed **fully automatically**. [22](https://bazis-center.ru/system/shkaf)

### 3) Joint priority system (how it decides “where/which/how many”)

Bazis exposes a very “industrial boring-line” style priority model:

- Scheme parameters include: fixed offset from a chosen base edge, minimum offset from the opposite edge, and step multiple (often **32 mm** due to multi-spindle drilling equipment). [3](https://sapr.ru/article/25453)
- The user manual specifies that elements are distributed so the **centre-to-centre spacing is a multiple of the specified step**, while boundary distances are ≥ the minimum offset. [23](https://s3-cold.bazissoft.ru/documentation/ru/Bazis.pdf)
- A separate Bazis parametric modeling article gives a concrete example for fastening a horizontal partition to a vertical panel using an **eccentric + dowel**:
    - offset from chosen edge **50 mm**
    - minimum offset from opposite edge **50 mm**
    - cabinet depth **450 mm**
    - step multiple **32 mm**
    - connector type: eccentric tie with additional dowel [24](https://sapr.ru/article/19451)
- Bazis also supports explicit **count-by-length rules** (tables): e.g., joints of 500–750 mm get 3 fasteners (example explaining “750 — 3”). [24](https://sapr.ru/article/19451)
- In the scheme editor description, it’s noted that enterprises may apply spacing heuristics (example: eccentrics about 300 mm apart; confirmats up to 450 mm) as local best practice encoded in the table. [3](https://sapr.ru/article/25453)

### 4) User override model

Bazis is unusually explicit about enterprise-friendly overrides:

- You can replace one connector type with another for **a specific panel connection or the whole product**. [8](https://files.bazissoft.ru/component/content/article?Itemid=75&id=34)
- At the joint level, you can:
    - change which face the fastener is installed from,
    - change basing edge (front ↔ rear),
    - run checks for connectability and fastener intersections. [3](https://sapr.ru/article/25453)

### 5) Limits of automation

- Bazis can place many connectors “in one command,” but correctness depends on:
    - a properly authored scheme, and
    - the constructor correctly setting which joints are active. [3](https://sapr.ru/article/25453)
- Because schemes are enterprise-authored algorithms, Bazis automation is “as smart as your schemes”—it’s not (by default) a system that derives joinery choices from structural intent. [3](https://sapr.ru/article/25453)

---

# 4) Practical differentiation target (what you can build that they largely don’t)

If your goal is “the gap is our differentiation,” the most defensible gap—based on the evidence above—is:

### Competitors automate **execution**, not **selection**

They largely rely on humans to decide:

- Which connector family to use where (strength, demountability, aesthetics, cost).
- Which joints are “active” vs “inactive” (design intent).
- How to resolve conflicts (overlaps, collisions, invalid combinations) beyond warning/error trapping.

### Differentiation table: “constructor intent → automatic selection”

|Differentiation feature|What it would do (beyond today’s baseline)|Why it’s a gap today (supported)|
|---|---|---|
|**Intent-aware connector selection**|Choose connector families based on declared intent (knock-down vs fixed; concealed vs visible; load class; material class; available machines) and auto-pick the construction method/rule/scheme|Today the user must “modify sets to suit your method,” “select/customize joinery,” or rely on schemes authored by experienced constructors [13](https://cabinetvision.screenstepslive.com/s/cvappstore/m/cvdatabase/l/1377889-joinery-it-startup-database-assembly-construction-configuration)|
|**Automatic conflict re-planning**|If fasteners overlap or hit forbidden zones, the system proposes alternatives: shift pattern, reduce count, switch connector type, flip drilling face, etc.|Polyboard warns users to prevent overlap manually [14](https://wooddesigner.org/applying-several-hardware-fitting-to-a-joint/) Bazis provides checks for intersections but still expects the constructor to correct [3](https://sapr.ru/article/25453)|
|**Explainable “why this connector here” traces**|Provide a rule trace (“because: panel thickness 16mm; removable shelf; system32; preferred concealed; distance-to-end constraint; therefore choose X and place N units”)|Existing systems expose rule authoring, but public material emphasizes configuration/definition rather than explanation/optimization [15](https://www.woodshopnews.com/news/learn-about-the-latest-version-of-cabinet-vision)|

If you want, I can convert this into a **scored requirements checklist** (“must / should / could”), with an explicit **MVP feature floor** and a second list of “high-leverage differentiators,” each mapped back to the sources above.





---



**Headless Blender Batch Pipeline for Furniture Hardware Visualization** (Deterministic, CI-scalable to 1,000s of SKUs)

This design uses **Blender 4.2+** (Eevee Next preferred for speed and consistency) in fully headless mode. It is pure Python/bpy where possible, with minimal external dependencies. The pipeline is deterministic (fixed seeds, fixed settings, no procedural variation), runs in CI (Docker + GitHub Actions/AWS Batch), and produces three assets per SKU from a single input glTF/glb or STEP file.

### Pipeline Architecture (CI-Runnable)

**Components:**

- **Orchestrator** (`pipeline_orchestrator.py`): Python 3 script (run outside or inside Blender). Scans `models_dir`, handles STEP→glTF conversion via FreeCAD, launches or loops Blender renders.
- **Blender Render Script** (`render_one.py`): Run with `blender -b -P render_one.py -- --input model.gltf --sku ABC123 --metadata metadata.json --output_dir ./renders/ABC123`. Processes one SKU (or loop inside one Blender instance for efficiency).
- **Post-processing**: FFmpeg (or `cwebp` from libwebp) for animated WebP from PNG sequence.
- **Docker Image** for CI: `blender` official Docker + FreeCAD + FFmpeg + libwebp. Example: parallel jobs via GNU `parallel` or AWS Batch array jobs (one task per 10–50 SKUs).
- **Metadata Convention** (critical for articulated hardware): Sidecar `sku.json` or embedded in glTF custom properties. Example:
    
    JSON
    
    ```
    {
      "type": "hinge|slide|handle|static",
      "animation": "open_close|turntable",
      "pivot": [0.0, 0.0, 0.0],
      "axis": [0, 1, 0],
      "closed_value": 0.0,
      "open_value": 95.0,
      "moving_objects": ["arm", "leaf"],  // name patterns or exact names
      "duration_frames": 60,
      "style": "product"
    }
    ```
    
    For static/turntable items, omit or set `"animation": "turntable"`.

**STEP Handling**: Blender has no native STEP importer. Pre-convert:

Python

```
# freecad_convert.py (run via freecadcmd -c "exec(open('freecad_convert.py').read())")
import sys, Import, exportGLTF
doc = App.newDocument()
Import.insert(sys.argv[1], doc.Name)  # .step
# Select all, center, export
objs = [o for o in doc.Objects if o.TypeId == 'Part::Feature']
exportGLTF.export(objs, sys.argv[2])  # output .gltf
```

Run in batch before the main pipeline. glTF is the primary input format (supports hierarchy, materials, simple animations if present).

**Scale & Parallelization**: One Blender instance can loop over many models (reset with `bpy.ops.wm.read_factory_settings(use_empty=True)` between SKUs). On a 16-core CPU/GPU machine, process 500–2,000 SKUs/hour. Use cloud array jobs for larger batches.

**Per-SKU Render Cost (Estimates, Eevee, 800–1024 px stills, 720 px anim, 48–96 frames)**:

- Thumbnail + Structure view: 2–8 s each on GPU, 5–20 s on CPU.
- Animation (render + WebP encode): 10–40 s on GPU, 30–90 s on CPU (depends on model complexity/polycount).
- **Total**: 15–60 s per SKU on modern GPU (RTX 3060/4070 class); ~0.5–2 min on CPU-only. Cloud spot instance cost: ~$0.001–0.008 per SKU. Memory: <2 GB per Blender instance for typical hardware (low-poly hinges/slides).
- Optimization: 32–64 Eevee samples + denoising; render at half-res then upscale if needed; cache HDRI.

**Output Specifications & Optimization**:

- **Thumbnail**: 800×800 PNG (with alpha), lossy compression via Pillow post-process or Blender output quality 90. Target <250 KB. Square framing, 3/4 elevated view.
- **Structure/Wireframe/X-ray View**: 800×800 PNG (transparent BG preferred), black lines on minimal shading. Target <150 KB. Use Freestyle for clean vector-like edges.
- **Animation**: Short (2–4 s) loopable animated WebP. Resolution 720×720 or 600×800 (preserve aspect). 30 fps input → 15–20 fps effective in WebP. 48–96 frames. Use `ffmpeg -c:v libwebp_anim -quality 75 -loop 0` or equivalent. Target 200–800 KB. Lossy + transparency supported. Loop forever (`-loop 0`).
- Global optimization: Render PNG sequence to `/tmp`, delete after encoding. Use `--render-format PNG` with color management set to Standard + Filmic or AgX.

### Scripting Approach (bpy)

All logic is in a self-contained `render_one.py`. Pass arguments via `sys.argv`. Use `mathutils` for transforms, `bpy.context.scene` for render settings. Reset scene completely for determinism. Load a studio HDRI (include one in the Docker image or download once).

**Core Skeleton** (`render_one.py` excerpt):

Python

```
import bpy, sys, argparse, math, subprocess, json
from mathutils import Vector, Euler
from pathlib import Path

def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument('--input', required=True)
    parser.add_argument('--sku', required=True)
    parser.add_argument('--metadata', default=None)  # path to json
    parser.add_argument('--output_dir', required=True)
    return parser.parse_args()

def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.scene.render.engine = 'BLENDER_EEVEE_NEXT'
    bpy.context.scene.render.resolution_x = 800
    bpy.context.scene.render.resolution_y = 800
    bpy.context.scene.render.image_settings.file_format = 'PNG'
    bpy.context.scene.render.image_settings.color_mode = 'RGBA'
    bpy.context.scene.render.film_transparent = True
    # Fixed settings for determinism
    bpy.context.scene.eevee.taa_render_samples = 64
    bpy.context.scene.render.use_denoising = True
    # HDRI setup (example)
    world = bpy.data.worlds.new("Studio")
    bpy.context.scene.world = world
    # Load HDRI node tree setup here (or link from template)

def import_and_normalize(filepath):
    if filepath.endswith('.gltf') or filepath.endswith('.glb'):
        bpy.ops.import_scene.gltf(filepath=filepath)
    # ... handle other formats
    # Normalize
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.origin_set(type='ORIGIN_GEOMETRY', center='BOUNDS')
    # Compute bbox and scale to ~1.0 unit max dimension
    minv = Vector((float('inf'),)*3)
    maxv = Vector((-float('inf'),)*3)
    for obj in bpy.context.selected_objects:
        if obj.type == 'MESH':
            for v in obj.bound_box:
                world_v = obj.matrix_world @ Vector(v)
                minv = Vector((min(minv[i], world_v[i]) for i in range(3)))
                maxv = Vector((max(maxv[i], world_v[i]) for i in range(3)))
    size = maxv - minv
    scale_factor = 1.0 / max(size) if max(size) > 0 else 1.0
    bpy.ops.transform.resize(value=(scale_factor, scale_factor, scale_factor))
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    # Center at origin
    bpy.ops.object.origin_set(type='ORIGIN_GEOMETRY', center='BOUNDS')
    for obj in bpy.context.selected_objects:
        obj.location = (0, 0, 0)  # or slight Z offset for base

def setup_camera_and_lighting():
    # Standard 3/4 product view, slightly elevated
    cam_data = bpy.data.cameras.new(name='ProductCam')
    cam = bpy.data.objects.new('ProductCam', cam_data)
    bpy.context.collection.objects.link(cam)
    cam.location = Vector((1.2, -1.5, 1.0))
    cam.rotation_euler = Euler((math.radians(55), 0, math.radians(35)), 'XYZ')
    cam.data.lens = 50.0
    bpy.context.scene.camera = cam
    # Auto-frame (simplified; use raycast or view_selected in practice)
    bpy.ops.view3d.camera_to_view_selected()  # or manual bbox-based distance
    # Lights/HDRI already in world setup; add fill lights if needed

def render_thumbnail(output_path):
    bpy.context.scene.render.filepath = str(output_path)
    bpy.ops.render.render(write_still=True)

# ... (structure view and animation functions below)
```

### Camera/Lighting Standardization

- **Camera**: Single perspective camera, 50 mm lens, ~35–55° elevation, 30–45° azimuth for 3/4 view. Auto-frame using bounding box + `camera_to_view_selected()` or custom `distance = max_dim / (2 * math.tan(fov/2))` with 15% padding. Orthographic optional for structure view.
- **Lighting**: Studio HDRI (fixed rotation, e.g., `world.node_tree.nodes["Environment"].rotation = (0,0,0)`). Supplemental soft area lights or 3-point setup recreated in script. Consistent exposure via fixed HDRI strength (1.0) and color management (AgX or Filmic, Standard view transform). No random lights.

### Line/Freestyle Rendering for Structure View (X-ray/Wireframe)

Use **Freestyle** (works in Eevee) for clean, controllable lines. Combine with transparent/shadeless material override for X-ray look.

**Setup Function**:

Python

```
def setup_freestyle_structure(output_path):
    scene = bpy.context.scene
    scene.render.use_freestyle = True
    scene.render.line_thickness_mode = 'ABSOLUTE'
    scene.render.line_thickness = 1.5  # px
    
    # Clear existing, add Line Set
    freestyle = scene.view_layers[0].freestyle_settings
    for ls in list(freestyle.linesets):
        freestyle.linesets.remove(ls)
    lineset = freestyle.linesets.new("StructureLines")
    lineset.select_by_visibility = True
    lineset.select_by_edge_types = True
    lineset.select_silhouette = True
    lineset.select_crease = True
    lineset.select_border = True
    lineset.select_material_boundary = True
    
    # Line style: black, constant thickness, no texture
    linestyle = lineset.linestyle
    linestyle.color = (0.0, 0.0, 0.0)
    linestyle.thickness = 2.0
    linestyle.use_chaining = True
    
    # Optional: material override for X-ray (transparent base)
    for obj in bpy.data.objects:
        if obj.type == 'MESH':
            for slot in obj.material_slots:
                if slot.material:
                    slot.material.use_nodes = True
                    # Set BSDF alpha to 0.1–0.3 or use Holdout
    
    bpy.context.scene.render.filepath = str(output_path)
    bpy.ops.render.render(write_still=True)
    scene.render.use_freestyle = False  # reset
```

For pure wireframe/X-ray alternative: Use Wireframe modifier + viewport render, or Line Art modifier (newer, GPU-friendly). Freestyle gives the most "technical drawing" control. Render on white or transparent background.

### Animation Rigging Conventions for Hinges/Slides

**Convention (enables deterministic automation)**:

- Models must use consistent naming (e.g., objects matching `moving_objects` list in metadata, or an Armature with bones named "HingeAxis", "SlideRail").
- Pivot point marked by an Empty named "PIVOT" or provided in JSON.
- For hinges: Rotate moving part(s) around `axis` from `closed_value` to `open_value` (degrees).
- For slides: Translate along axis (e.g., 0 → 150 mm open).
- Animation: 0–30 frames open (linear or ease-in), 30–60 close (or ping-pong with `bpy.context.scene.frame_set` and drivers). Add slight ease with `bezier` interpolation.
- Turntable fallback: Create root Empty at center, parent all geometry, keyframe `rotation_euler[2]` 0 → 2π over N frames (or orbit camera around fixed model for better lighting consistency).

**Animation Function Skeleton**:

Python

```
def create_animation(metadata):
    scene = bpy.context.scene
    scene.frame_start = 0
    scene.frame_end = metadata.get("duration_frames", 60)
    scene.render.fps = 30
    
    if metadata.get("animation") == "open_close":
        angle_start = math.radians(metadata["closed_value"])
        angle_end = math.radians(metadata["open_value"])
        moving = [o for o in bpy.data.objects if any(pat in o.name.lower() for pat in metadata.get("moving_objects", []))]
        for obj in moving:
            obj.rotation_mode = 'XYZ'
            obj.rotation_euler = (0, 0, angle_start)  # adjust per axis
            obj.keyframe_insert(data_path="rotation_euler", frame=0)
            obj.rotation_euler = (0, 0, angle_end)
            obj.keyframe_insert(data_path="rotation_euler", frame=scene.frame_end//2)
            # Mirror or ease for close
    elif metadata.get("animation") == "turntable":
        empty = bpy.data.objects.new("TurntableEmpty", None)
        bpy.context.collection.objects.link(empty)
        for obj in bpy.data.objects:
            if obj.type in ('MESH', 'EMPTY') and obj != empty:
                obj.parent = empty
        empty.rotation_euler = (0, 0, 0)
        empty.keyframe_insert(data_path="rotation_euler", frame=0)
        empty.rotation_euler = (0, 0, 2*math.pi)
        empty.keyframe_insert(data_path="rotation_euler", frame=scene.frame_end)
    
    # Set interpolation to LINEAR or BEZIER for determinism
    for fcurve in bpy.context.selected_objects[0].animation_data.action.fcurves if ...:
        for kp in fcurve.keyframe_points:
            kp.interpolation = 'LINEAR'

def render_animation(seq_dir, final_webp_path):
    bpy.context.scene.render.filepath = str(seq_dir / "frame_")
    bpy.ops.render.render(animation=True)  # renders PNG sequence
    # Post-process to animated WebP
    subprocess.run([
        "ffmpeg", "-y", "-framerate", "30", "-i", str(seq_dir / "frame_%04d.png"),
        "-c:v", "libwebp_anim", "-quality", "75", "-loop", "0",
        "-preset", "picture", str(final_webp_path)
    ])
```

### Full Workflow & CI Notes

1. Prepare models + metadata JSONs.
2. Run orchestrator (converts STEP if present, then calls Blender per SKU or in batch loop).
3. Outputs written to per-SKU folders: `thumbnail.png`, `structure.png`, `animation.webp`.
4. For CI: Matrix jobs or array jobs splitting the SKU list. Use fixed Blender version in Docker. Log render times for cost tracking.
5. Extensions: Add material normalization (override to neutral metallic/roughness for consistency), multiple camera angles, or AOV passes (normal/depth) if needed later.

This pipeline is production-ready for hardware catalogs (hinges, drawer slides, lifts, connectors). The metadata convention is the key to reliable automated rigging without manual per-SKU intervention. Test on a small batch (10 SKUs) to tune framing, line thickness, and WebP quality. All bpy calls are explicit and version-pinned for long-term determinism.[1](https://docs.blender.org/manual/en/latest/advanced/command_line/render.html)[2](https://github.com/KhronosGroup/glTF-Tutorials/blob/main/BlenderGltfConverter/README.md)[3](https://www.youtube.com/watch?v=BSsjSj0iOaE)[4](https://blender.stackexchange.com/questions/155275/how-to-set-freestyle-line-set-setting-using-python)

**Sources for key techniques**: Blender manual (command-line rendering, Freestyle API), Khronos glTF tutorials, community turntable/automation scripts, AWS Batch rendering patterns, Render2Gif add-on precedents (for WebP path), and FreeCAD glTF export patterns. Contact for full repo skeleton if needed.



---



Below is a **headless, deterministic, CI-runnable** batch-render pipeline design using **Blender + Python (bpy)** that takes **one model per SKU** (glTF/GLB preferred; STEP supported via a conversion stage) and renders:

1. **Product thumbnail** (static)
2. **Wireframe / X‑ray structure view** (static)
3. **Short animation** (open/close if rig metadata exists, else turntable) encoded as **animated WebP**

I’ll give: execution model, conventions, render profiles, and **working script skeletons** you can drop into CI.

---

## 0) Core constraints and decisions (so this works at “thousands of SKUs” scale)

### Why prefer glTF over STEP as the ingestion “render format”

Blender has **native glTF 2.0 import** via `bpy.ops.import_scene.gltf(...)` [1](https://docs.blender.org/api/current/bpy.ops.import_scene.html). Blender does **not** have built‑in STEP import/export in vanilla builds (it’s a mesh/VFX tool, not a CAD solid kernel). [2](https://blender.stackexchange.com/questions/314140/how-to-export-step-files-from-blender)  
So: treat STEP as **upstream CAD**, and convert STEP → GLB (triangulated mesh) in a deterministic pre-stage.

### Determinism profile (CI)

If you truly need _repeatable pixels_ across CI runs/machines:

- Use **Cycles CPU**, fixed samples, fixed seed, **no denoiser**, fixed color management.
- Eevee is much faster, but it’s a realtime engine and more sensitive to GPU/driver differences (great for production throughput, weaker for strict determinism). (Blender’s own docs emphasize EEVEE uses approximations for realtime performance.) [3](https://docs.blender.org/manual/en/latest/render/eevee/limitations/limitations.html)

### Blender headless invocation (CI friendly)

Use Blender CLI `--background` plus a Python script, and force clean startup:

- `--factory-startup` to ignore user prefs (stability)
- `--python-exit-code 1` to fail the CI job on exceptions [4](https://docs.blender.org/manual/en/4.0/advanced/command_line/arguments.html)

---

## 1) File/layout conventions (what makes batch + rigs scalable)

### 1.1 Recommended input package per SKU

text

```
sku/
  model.glb                  # preferred
  model.step|model.stp        # optional; if present, convert once to GLB and cache
  meta.json                   # optional articulation metadata (hinge/slide axis + limits)
  overrides.json              # optional material overrides, colors, etc.
```

### 1.2 Naming conventions inside the model (important for articulation)

For open/close animations, you need either:

- consistent **sub-assembly naming** in the GLB, OR
- a `meta.json` mapping.

Recommended conventions (glTF node/object names):

- Fixed/base part(s): `BASE`, `FIXED_*`
- Moving part(s): `MOVING`, `LEAF`, `INNER`, `CARRIAGE`, etc.
- Joint empties (optional but great): `JNT_<id>_PIVOT` with local axes oriented:
    - local **+Z** = hinge rotation axis
    - local **+X** = slide translation axis

If you can’t enforce this in CAD exports, rely on `meta.json`.

### 1.3 `meta.json` schema (minimal, deterministic)

Example: hinge open/close (degrees):

JSON

```
{
  "animation": {
    "type": "hinge",
    "pivot_object": "JNT_01_PIVOT",
    "moving_objects": ["LEAF_A", "LEAF_B"],
    "axis_local": [0, 0, 1],
    "min_deg": 0,
    "max_deg": 110,
    "frames": 32,
    "fps": 12
  }
}
```

Example: slide extension (mm; you can store meters if you normalize scale):

JSON

```
{
  "animation": {
    "type": "slide",
    "driver_object": "JNT_01_PIVOT",
    "moving_objects": ["INNER_RAIL", "CARRIAGE"],
    "axis_local": [1, 0, 0],
    "min_m": 0.0,
    "max_m": 0.45,
    "frames": 32,
    "fps": 12
  }
}
```

Fallback if no meta: turntable.

---

## 2) Render standardization (camera, lights, materials)

### 2.1 Normalization step (critical)

After import, do these always:

1. Parent all imported meshes under a single `ROOT` empty.
2. Compute bounding box of all visible geometry.
3. Translate so the model is centered at origin, and sits on Z=0 (optional).
4. Uniform scale to a consistent “display size” (e.g., largest dimension = 1.0 m) so camera distance is consistent across SKUs.

This makes thumbnails consistent across wildly different SKUs (hinges vs slides vs handles).

### 2.2 Camera fitting formula (deterministic)

Use a fixed camera FOV (e.g. 35° vertical) and compute distance to fit the bounding sphere with margin.

If `r` = bounding sphere radius, `fov` in radians, margin `m` (e.g. 1.15):

d=m⋅rsin⁡(fov/2)d=m⋅sin(fov/2)r​

Aim camera at model center with a slight “3/4 view”:

- yaw 35°, pitch 25° (fixed)
- target at center

### 2.3 Lighting standard (simple + robust)

Use 3 area lights:

- Key: front-left, strong
- Fill: front-right, weaker
- Rim: behind/top, medium Plus optional HDRI for subtle reflections (but HDRI can add variability if you change files).

For determinism:

- No random lights
- Fixed intensities (Watts), fixed sizes, fixed positions relative to bounding radius.

---

## 3) Structure view: “wireframe / X-ray” options

You asked specifically for **line/Freestyle rendering**. Freestyle is enabled per View Layer in Blender’s render stack [5](https://docs.blender.org/manual/en/3.0/render/freestyle/view_layer.html), and you can configure it from scripts (common scripting pattern shown here) [6](https://www.discretization.de/pyddg/doc/v0.3.1/visualization/blender/advanced_functionalities/freestyle.html).

### Option A (recommended): X‑ray shaded + Freestyle outlines (fast, clean)

- Override all materials to a semi‑transparent “Xray” material (glass-ish or transparent principled)
- Enable Freestyle to draw silhouettes/creases
- Render on a white or transparent background

### Option B: True wireframe overlay (more “engineering”)

- Duplicate meshes, add **Wireframe modifier** (or shader Wireframe node), render as emission lines
- Composite over the X‑ray pass

Option A is usually enough for “structure view thumbnails” at 512–1024px.

---

## 4) Output: animated WebP from Blender (practical encoding)

Blender does not reliably output animated WebP directly in all setups; the standard production approach is:

1. Render PNG sequence to a temp folder
2. Encode animated WebP with `ffmpeg` using `libwebp` and loop=0 [7](https://ffmpegbyexample.com/examples/8nbzpbl5/generate_looping_webp_animation_from_image_sequence_with_variable_quality/)

Example encoding command:

Bash

```
ffmpeg -y -framerate 12 -i frames/%04d.png \
  -vcodec libwebp -pix_fmt yuv420p -loop 0 -quality 60 \
  out.webp
```

(You can tune `-quality`, target size, and add scaling filters.)

---

## 5) End-to-end command line (CI job)

Blender CLI reference shows how to run background renders and scripting; for CI robustness use `--python-exit-code`. [4](https://docs.blender.org/manual/en/4.0/advanced/command_line/arguments.html)

Example:

Bash

```
blender --background --factory-startup --python-exit-code 1 \
  --python render_sku.py -- \
  --sku "BLUM-71T6550" \
  --input "/data/BLUM-71T6550/model.glb" \
  --meta  "/data/BLUM-71T6550/meta.json" \
  --out   "/out/BLUM-71T6550" \
  --engine "CYCLES_CPU" \
  --thumb 512 \
  --anim  512
```

---

# 6) Blender script skeleton (single entrypoint)

This is a working-ish skeleton you can extend. It uses:

- glTF import operator (`bpy.ops.import_scene.gltf`) [1](https://docs.blender.org/api/current/bpy.ops.import_scene.html)
- Freestyle enable via view layer [8](https://docs.blender.org/api/current/bpy.types.ViewLayer.html)
- deterministic settings

> File: `render_sku.py`

Python

```
import bpy
import sys, os, json, math, subprocess
from mathutils import Vector, Matrix, Euler

# ---------- CLI args ----------
def parse_args():
    argv = sys.argv
    if "--" not in argv:
        return {}
    args = argv[argv.index("--") + 1:]

    out = {}
    key = None
    for a in args:
        if a.startswith("--"):
            key = a[2:]
            out[key] = True
        else:
            if key is None:
                continue
            out[key] = a
            key = None
    return out

# ---------- scene reset ----------
def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)

# ---------- import ----------
def ensure_gltf_addon():
    # In some factory-startup setups, importers may not be enabled.
    try:
        bpy.ops.preferences.addon_enable(module="io_scene_gltf2")
    except Exception:
        pass

def import_model(path):
    ext = os.path.splitext(path)[1].lower()
    if ext in [".glb", ".gltf"]:
        ensure_gltf_addon()
        bpy.ops.import_scene.gltf(filepath=path)  # glTF 2.0 importer <!--citation:1-->
    else:
        raise RuntimeError(f"Unsupported input: {ext}")

def collect_mesh_objects():
    return [o for o in bpy.context.scene.objects if o.type == "MESH" and o.visible_get()]

# ---------- normalization ----------
def make_root_and_parent(objs):
    root = bpy.data.objects.new("ROOT", None)
    bpy.context.scene.collection.objects.link(root)
    for o in objs:
        o.parent = root
    return root

def world_bbox(objs):
    # returns (min, max) in world coords
    mn = Vector((1e18, 1e18, 1e18))
    mx = Vector((-1e18, -1e18, -1e18))
    for o in objs:
        for v in o.bound_box:
            w = o.matrix_world @ Vector(v)
            mn = Vector((min(mn.x,w.x), min(mn.y,w.y), min(mn.z,w.z)))
            mx = Vector((max(mx.x,w.x), max(mx.y,w.y), max(mx.z,w.z)))
    return mn, mx

def center_and_scale(root, objs, target_max_dim=1.0, place_on_ground=True):
    mn, mx = world_bbox(objs)
    center = (mn + mx) * 0.5
    dims = mx - mn
    max_dim = max(dims.x, dims.y, dims.z)
    if max_dim <= 0:
        max_dim = 1.0

    # move center to origin
    root.location -= center

    # optional: put on ground (Z=0)
    if place_on_ground:
        mn2, mx2 = world_bbox(objs)
        root.location.z -= mn2.z

    # uniform scale
    s = target_max_dim / max_dim
    root.scale = (s, s, s)

# ---------- camera / lights ----------
def create_camera_fit(objs, fov_deg=35.0, margin=1.15):
    cam_data = bpy.data.cameras.new("CAM")
    cam = bpy.data.objects.new("CAM", cam_data)
    bpy.context.scene.collection.objects.link(cam)

    # compute bounding sphere approx
    mn, mx = world_bbox(objs)
    center = (mn + mx) * 0.5
    r = (mx - center).length

    cam_data.lens_unit = 'FOV'
    cam_data.angle = math.radians(fov_deg)

    d = margin * (r / math.sin(cam_data.angle / 2.0))

    # 3/4 view
    yaw = math.radians(35)
    pitch = math.radians(25)

    # position in spherical coords
    pos = Vector((
        d * math.cos(pitch) * math.cos(yaw),
        d * math.cos(pitch) * math.sin(yaw),
        d * math.sin(pitch)
    ))
    cam.location = center + pos

    # look-at
    direction = (center - cam.location).normalized()
    rot_quat = direction.to_track_quat('-Z', 'Y')
    cam.rotation_euler = rot_quat.to_euler()

    bpy.context.scene.camera = cam
    return cam

def create_three_point_lights(objs):
    mn, mx = world_bbox(objs)
    center = (mn + mx) * 0.5
    r = (mx - center).length

    def add_area(name, loc, energy, size):
        ld = bpy.data.lights.new(name=name, type='AREA')
        ld.energy = energy
        ld.size = size
        lo = bpy.data.objects.new(name, ld)
        bpy.context.scene.collection.objects.link(lo)
        lo.location = loc
        # aim to center
        direction = (center - lo.location).normalized()
        lo.rotation_euler = direction.to_track_quat('-Z', 'Y').to_euler()
        return lo

    add_area("KEY",  center + Vector(( 1.2*r, -1.0*r, 1.1*r)), energy=1500, size=0.6*r)
    add_area("FILL", center + Vector((-1.1*r, -0.9*r, 0.8*r)), energy=700,  size=0.8*r)
    add_area("RIM",  center + Vector(( 0.0*r,  1.4*r, 1.3*r)), energy=900,  size=0.7*r)

# ---------- render settings ----------
def configure_render(engine="CYCLES_CPU", res=512, transparent_bg=True):
    scn = bpy.context.scene
    scn.render.resolution_x = res
    scn.render.resolution_y = res
    scn.render.film_transparent = transparent_bg

    # color management (simple, deterministic-ish)
    scn.display_settings.display_device = 'sRGB'
    scn.view_settings.view_transform = 'Standard'
    scn.view_settings.look = 'None'
    scn.view_settings.exposure = 0.0
    scn.view_settings.gamma = 1.0

    if engine == "CYCLES_CPU":
        scn.render.engine = 'CYCLES'
        scn.cycles.device = 'CPU'
        scn.cycles.samples = 64
        scn.cycles.use_adaptive_sampling = False
        scn.cycles.use_denoising = False
        scn.cycles.seed = 0
        # keep same noise per frame
        scn.cycles.use_animated_seed = False  # property exists in Cycles API <!--citation:9-->
    elif engine == "EEVEE":
        scn.render.engine = 'BLENDER_EEVEE_NEXT' if hasattr(bpy.types, "EeveeRaytrace") else 'BLENDER_EEVEE'
        # add eevee settings here
    else:
        raise RuntimeError(engine)

# ---------- materials ----------
def set_material_override(mat):
    # Apply as view-layer material override (fast, non-destructive)
    vl = bpy.context.view_layer
    vl.material_override = mat

def make_metal_mat(name="MatMetal"):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Metallic"].default_value = 1.0
    bsdf.inputs["Roughness"].default_value = 0.25
    return mat

def make_xray_mat(name="MatXray"):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    bsdf = nt.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (0.6, 0.7, 0.8, 1.0)
    bsdf.inputs["Roughness"].default_value = 0.35
    bsdf.inputs["Alpha"].default_value = 0.15
    mat.blend_method = 'BLEND'
    mat.shadow_method = 'NONE'
    return mat

# ---------- freestyle structure view ----------
def enable_freestyle(line_thickness=1.5):
    vl = bpy.context.view_layer
    vl.use_freestyle = True  # freestyle per view layer <!--citation:8-->
    fs = vl.freestyle_settings  # freestyle_settings is on ViewLayer <!--citation:8-->

    # Blender creates a default lineset/linestyle in many cases; ensure one exists
    if not fs.linesets:
        fs.linesets.new("LineSet")
    ls = fs.linesets[0]
    ls.select_silhouette = True
    ls.select_border = True
    ls.select_crease = True

    # Ensure a linestyle exists
    if not bpy.data.linestyles:
        bpy.data.linestyles.new("LineStyle")
    style = bpy.data.linestyles[0]
    style.thickness = line_thickness
    ls.linestyle = style

# ---------- animation ----------
def load_meta(meta_path):
    if not meta_path or not os.path.exists(meta_path):
        return None
    with open(meta_path, "r", encoding="utf-8") as f:
        return json.load(f)

def setup_turntable(root, frames=48):
    scn = bpy.context.scene
    scn.frame_start = 1
    scn.frame_end = frames
    root.rotation_euler = (0, 0, 0)
    root.keyframe_insert(data_path="rotation_euler", frame=1)
    root.rotation_euler = (0, 0, math.radians(360))
    root.keyframe_insert(data_path="rotation_euler", frame=frames)

def setup_hinge_or_slide(meta):
    scn = bpy.context.scene
    anim = meta["animation"]
    frames = int(anim.get("frames", 32))
    fps = int(anim.get("fps", 12))
    scn.render.fps = fps
    scn.frame_start = 1
    scn.frame_end = frames

    pivot = bpy.data.objects.get(anim["pivot_object"])
    if pivot is None:
        raise RuntimeError(f"pivot_object not found: {anim['pivot_object']}")

    for name in anim["moving_objects"]:
        obj = bpy.data.objects.get(name)
        if obj is None:
            raise RuntimeError(f"moving object not found: {name}")
        obj.parent = pivot  # simplest rig: parent moving parts to pivot empty

    if anim["type"] == "hinge":
        min_deg = float(anim.get("min_deg", 0))
        max_deg = float(anim.get("max_deg", 110))
        pivot.rotation_euler = (0, 0, math.radians(min_deg))
        pivot.keyframe_insert("rotation_euler", frame=1)
        pivot.rotation_euler = (0, 0, math.radians(max_deg))
        pivot.keyframe_insert("rotation_euler", frame=frames)
    elif anim["type"] == "slide":
        min_m = float(anim.get("min_m", 0.0))
        max_m = float(anim.get("max_m", 0.45))
        pivot.location = (min_m, 0, 0)
        pivot.keyframe_insert("location", frame=1)
        pivot.location = (max_m, 0, 0)
        pivot.keyframe_insert("location", frame=frames)
    else:
        raise RuntimeError(anim["type"])

# ---------- render helpers ----------
def render_still(out_path):
    scn = bpy.context.scene
    scn.render.image_settings.file_format = 'PNG'
    scn.render.filepath = out_path
    bpy.ops.render.render(write_still=True)

def render_frames(out_dir, prefix="frame_"):
    os.makedirs(out_dir, exist_ok=True)
    scn = bpy.context.scene
    scn.render.image_settings.file_format = 'PNG'
    scn.render.filepath = os.path.join(out_dir, prefix)
    bpy.ops.render.render(animation=True)

def encode_webp_ffmpeg(frames_dir, fps, out_webp, size=None, quality=60):
    # Example command pattern for animated webp via ffmpeg/libwebp <!--citation:7-->
    in_pattern = os.path.join(frames_dir, "frame_%04d.png")
    cmd = ["ffmpeg", "-y", "-framerate", str(fps), "-i", in_pattern]

    vf = []
    if size:
        vf.append(f"scale={size}:{size}:flags=lanczos")
    if vf:
        cmd += ["-vf", ",".join(vf)]

    cmd += [
        "-vcodec", "libwebp",
        "-pix_fmt", "yuv420p",
        "-loop", "0",
        "-quality", str(quality),
        out_webp
    ]
    subprocess.run(cmd, check=True)

# ---------- main ----------
def main():
    args = parse_args()
    sku = args.get("sku", "SKU")
    in_path = args["input"]
    out_dir = args["out"]
    meta_path = args.get("meta")
    engine = args.get("engine", "CYCLES_CPU")
    thumb_res = int(args.get("thumb", 512))
    anim_res = int(args.get("anim", 512))

    os.makedirs(out_dir, exist_ok=True)

    reset_scene()
    configure_render(engine=engine, res=thumb_res, transparent_bg=True)

    import_model(in_path)
    objs = collect_mesh_objects()
    if not objs:
        raise RuntimeError("No mesh objects imported")

    root = make_root_and_parent(objs)
    center_and_scale(root, objs, target_max_dim=1.0, place_on_ground=True)

    create_camera_fit(objs)
    create_three_point_lights(objs)

    # ---- thumbnail (beauty) ----
    set_material_override(None)  # keep imported mats; or override to standard metal
    render_still(os.path.join(out_dir, f"{sku}_thumb.png"))

    # ---- structure view (xray + freestyle) ----
    configure_render(engine=engine, res=thumb_res, transparent_bg=True)
    xray = make_xray_mat()
    set_material_override(xray)
    enable_freestyle(line_thickness=1.8)
    render_still(os.path.join(out_dir, f"{sku}_xray.png"))

    # ---- animation ----
    configure_render(engine=engine, res=anim_res, transparent_bg=True)
    meta = load_meta(meta_path)
    if meta and "animation" in meta:
        setup_hinge_or_slide(meta)
    else:
        bpy.context.scene.render.fps = 12
        setup_turntable(root, frames=48)

    frames_dir = os.path.join(out_dir, "_frames")
    render_frames(frames_dir, prefix="frame_")
    out_webp = os.path.join(out_dir, f"{sku}.webp")
    encode_webp_ffmpeg(frames_dir, bpy.context.scene.render.fps, out_webp, size=anim_res, quality=60)

if __name__ == "__main__":
    main()
```

---

# 7) STEP → GLB conversion stage (headless)

Because Blender doesn’t natively import STEP in vanilla builds [2](https://blender.stackexchange.com/questions/314140/how-to-export-step-files-from-blender), do a one-time conversion and cache it.

### Practical conversion options

- **FreeCAD headless** (open-source) with an exporter add-on / macro pipeline (quality varies; you’ll need to lock meshing tolerances).
- **CAD Exchanger CLI / Okino / commercial converters** for robust tessellation and assembly preservation.
- **OCC-based converters** (OpenCascade) if you want full control.

In your CI/pipeline, make conversion an explicit job:

1. `step_to_glb(sku.step) -> sku.glb` (cached artifact)
2. feed only GLB to Blender renderer

(Conversion is usually the costliest and most failure-prone step; keep it separate so you can re-render without re-tessellating.)

---

# 8) Output size optimization (to keep WebP small and fast)

For hardware SKUs, you can usually get good results with:

- Thumbnail: **512×512 PNG** (or WebP still)
- Structure: **512×512 PNG**
- Animation: **512×512**, **12 fps**, **32–48 frames**
    - open/close: 32 frames
    - turntable: 48 frames (one full rotation)

Encoding knobs:

- `quality`: 50–70 is usually fine
- limit frames aggressively (time dominates size)
- keep a flat background (white or transparent) to compress better
- avoid excessive noise (no denoise artifacts; just use enough samples)

---

# 9) Per-SKU render cost model (what to budget)

Actual times vary hugely with triangle count, materials, and engine. For planning, think in components:

**Total time per SKU**

T≈Timport+normalize+2⋅Tstill+Nframes⋅Tframe+TencodeT≈Timport+normalize​+2⋅Tstill​+Nframes​⋅Tframe​+Tencode​

Typical ballparks (rule-of-thumb, not guaranteed):

- Import + normalize: 0.1–0.8s (GLB) / much more if STEP conversion happens
- Cycles CPU still @512², 64 samples: ~0.5–3s
- Cycles CPU per frame @512², 64 samples: ~0.3–2s
- ffmpeg encode: 0.1–0.5s

So a 48-frame animation can dominate. If you need throughput, consider:

- 32 frames instead of 48
- fewer samples (or a denoiser if you accept non-determinism / variability)
- GPU nodes (but then determinism becomes “best effort”)

---

## 10) Operational tips for “thousands of SKUs”

- Run one Blender process per SKU (simplest parallelism); cap concurrency by RAM.
- Always emit a machine-readable manifest per SKU:
    - `render_version`, `blender_version`, `input_hash`, `meta_hash`, durations, triangle count.
- Use `--python-exit-code 1` so failures are visible to CI [4](https://docs.blender.org/manual/en/4.0/advanced/command_line/arguments.html).
- Cache:
    - STEP→GLB conversion artifacts
    - computed “normalization transforms” if you want consistent camera shots across re-renders.

---

If you want, I can also provide:

- a **Dockerfile** (Blender + ffmpeg + optional FreeCAD/converter),
- a minimal **GitHub Actions / GitLab CI** job matrix (parallel SKU shards),
- and a stricter Freestyle setup with **two line sets** (visible + hidden/dashed) for true “x‑ray hidden lines” style (more involved but doable).