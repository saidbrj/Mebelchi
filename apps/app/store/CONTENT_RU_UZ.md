# Mebely — landing sections + App Store screenshot captions (ru / uz)

Written 8 Aug 2026, against the real feature set. Structure follows the alternating
image ↔ text pattern of the Flatma reference, but **only for features we actually ship** — the
mapping and the three deliberate omissions are in §0.

Uzbek here reuses the app's **own** in-app vocabulary from `src/i18n/dicts.ts` (`kesim`, `chizmalar`,
`smeta`, `tortma`, `fasad`, `korpus`, `qoldiq`, `yoritish`) so the marketing and the product say the same words.
Do not machine-translate over it.

---

## 0. What we can and cannot claim

| Flatma section | Us | Verdict |
|---|---|---|
| Furniture design with **AI** | `AI_RENDER = false` in `src/config.ts` — not shipping | **OMIT** |
| Just draw your custom cabinet | Fill Editor (lines / doors / drawers) | ✅ direct match |
| Furniture from **Community** | no community, no marketplace | **OMIT** — replace with *your own* library |
| Visualize room design | room + walls + live 3D | ✅ |
| Realistic lighting & render | Day, Evening, Studio presets + PBR shading | ✅ direct match |
| Material catalog & custom pricing | Editable Catalog (add LDSP, edge, price/m²) | ✅ |
| Material specification drafting | parts list → XLSX/PDF | ✅ |
| Automated cutlist optimization | `model/nest.ts`, guillotine + offcuts | ✅ **stronger than theirs** |
| Quick drilling pattern drafting | drilling solver → sheet + SWJ008 | ✅ *but gated, see below* |

### ⚠️ Two features are OFF by default — decide before shooting screenshots

- **Смета / pricing** — `showPricing: false` (`model/settings.ts:160`). A fresh install shows no
  prices until the seller enters their own rates and switches it on. That is a defensible design
  (a price computed from someone else's rates is worthless), so the copy below sells it honestly as
  **«смета по вашим ценам»** rather than implying it works out of the box.
- **Drilling patterns + CNC file** — `advancedExport: false` (`model/settings.ts:174`). This gates
  the drill sheet, SWJ008 and the CSV. **Recommendation: default this to `true`.** It is fully
  built, it is one of our two strongest differentiators against Flatma, and a feature nobody can
  find is a feature we do not have. If you'd rather keep it off, cut §Landing 8 and screenshot 7.

### What we lead on that Flatma cannot

1. **It is a phone app.** Flatma is browser software for a desk. Ours is used standing in the
   client's kitchen, with the client watching. Lead with this.
2. **Остатки / qoldiqlar.** The nesting fills the workshop's existing offcuts *before* it opens a
   new sheet. Flatma's cutlist optimizer does not know your scrap pile. This is the single most
   concrete money claim we own.
3. **Uzbek, and UZS.** Not a translation layer — the whole product speaks the market's language.
4. **Telegram handoff.** How the trade actually sends files here.

---

## 1. Landing page — Russian

### Hero
**H1:** Кухни в 3D — прямо на телефоне
**Sub:** Соберите кухню по стенам клиента, покажите в 3D и отправьте в цех готовый пакет: раскрой, спецификацию и чертежи. Без черчения вручную.
**CTA:** Загрузить в App Store · *Бесплатно*

### 2 — Draw your own cabinet
**H:** Рисуйте модуль под себя
**Body:** Проведите линию — секция делится. Коснитесь ячейки — появится дверца или ящик. Любая начинка: ящики, полки, витрины, комбинированные фасады. Ничего не нужно выбирать из списка — вы просто рисуете то, что собираетесь построить.

### 3 — Room and 3D
**H:** По вашим стенам, а не по шаблону
**Body:** Задайте комнату, окна и двери — модули встанут по реальному периметру. Углы, ниши, техника и столешницы считаются автоматически. Клиент видит свою кухню, а не картинку из каталога.

### 4 — Realistic Render & Lighting
**H:** Реалистичная подача и настройка света
**Body:** Переключайте режим освещения прямо в 3D — дневной свет, вечерняя подсветка или студия. Настоящие текстуры дерева, глянца и матовых фасадов с мягкими тенями и отражениями. Клиент влюбляется в проект с первого взгляда.

### 5 — Cutlist optimization  ← their strongest section, and ours is better
**H:** Раскрой с учётом ваших остатков
**Body:** Алгоритм раскладывает детали по листам гильотинным резом — годится и для пилы, и для ЧПУ. Текстура не переворачивается. А главное: сначала заполняются обрезки, которые уже лежат у вас на складе, и только потом берётся новый лист.
**Micro:** Показывает листы, отходы в % и остаток в м².

### 6 — Material specification
**H:** Спецификация за один тап
**Body:** Полный перечень деталей в чистовых размерах — с кромкой, текстурой и количеством. Excel для закупа, PDF для цеха. Стекло и камень идут отдельной строкой поставщику, а не в распил.

### 7 — Estimate
**H:** Смета по вашим ценам
**Body:** Один раз внесите свои расценки — лист, кромка, распил, присадка, фурнитура — и приложение считает по ним, а не по чужим. UZS, KZT или USD. Цена собирается по корпусу, фасадам и работе, и её видно построчно.

### 8 — Drawings                                                                                                                                                                                                                                                                                  
**H:** Чертежи, которые понимает цех
**Body:** Фасадный вид, вид сверху и лист на каждый модуль — с размерами и номерами. Один PDF, который можно распечатать и положить на станок.

### 9 — Drilling  *(cut this section if `advancedExport` stays off)*
**H:** Карты сверловки автоматически
**Body:** Присадка под конфирматы, эксцентрики, полкодержатели и петли считается из конструкции модуля. Готовый файл для ЧПУ — SWJ008 и DXF.

### 10 — Material Catalog & Custom Pricing
**H:** Каталог материалов с вашими ценами
**Body:** Легко добавляйте свои плиты ЛДСП, МДФ, варианты кромки и фурнитуры. Указывайте закупочные или продажные цены за м² и метр. Добавленный материал сразу доступен во всех проектах и автоматически учитывается в смете.

### 11 — Your own library
**H:** Свои шкафы — один раз и навсегда
**Body:** Собрали удачный модуль — сохраните. В следующем проекте он уже готов, с вашими материалами и вашей фурнитурой.

### 12 — Shop standard
**H:** Стандарт цеха спрашивается один раз
**Body:** Толщина ЛДСП, задняя стенка, дно, цоколь, ручки или GOLA — вы отвечаете один раз в настройках, и каждый модуль каждого проекта строится так же. Не по одному вопросу на каждый шкаф.

### 13 — Handoff
**H:** В цех — через Telegram
**Body:** Весь пакет уходит одним сообщением: чертежи, раскрой, спецификация, файлы станка.

### Final CTA
**H:** Начните проект прямо сейчас
**Sub:** Бесплатно · Русский и узбекский · iOS 14+
**CTA:** Загрузить в App Store
**Muted:** Скоро в Google Play

---

## 2. Landing page — Uzbek

### Hero
**H1:** 3D oshxona — to'g'ridan-to'g'ri telefonda
**Sub:** Oshxonani mijozning devorlari bo'yicha yig'ing, 3D'da ko'rsating va sexga tayyor paketni yuboring: kesim, spetsifikatsiya va chizmalar. Qo'lda chizmasdan.
**CTA:** App Store'dan yuklab olish · *Bepul*

### 2
**H:** Modulni o'zingizga moslab chizing
**Body:** Chiziq torting — bo'lim bo'linadi. Katakchani bosing — eshik yoki tortma paydo bo'ladi. Istalgan ichki tuzilish: tortmalar, javonlar, vitrinalar, aralash fasadlar. Ro'yxatdan tanlash shart emas — siz quradigan narsangizni shunchaki chizasiz.

### 3
**H:** Shablon bo'yicha emas, sizning devorlaringiz bo'yicha
**Body:** Xona, deraza va eshiklarni belgilang — modullar haqiqiy perimetr bo'ylab joylashadi. Burchaklar, nishalar, texnika va stol usti avtomatik hisoblanadi. Mijoz katalogdagi rasmni emas, o'z oshxonasini ko'radi.

### 4
**H:** Realistik render va yoritish rejimlari
**Body:** Yoritishni 3D'da to'g'ridan-to'g'ri o'zgartiring — kunduzgi yorug'lik, kechki yoritish yoki studiya rejimi. Yog'och, glyanets va matli fasadlarning haqiqiy teksturalari yumshoq soyalar va akslar bilan. Mijoz loyihaga birinchi ko'rishdanoq oshiq bo'ladi.

### 5
**H:** Qoldiqlaringizni hisobga olgan kesim
**Body:** Algoritm detallarni listlarga gilyotin kesim bilan joylashtiradi — ham arra, ham ChPU uchun yaroqli. Tekstura ag'darilmaydi. Eng muhimi: avval omboringizda yotgan qirqindilar to'ldiriladi, yangi list faqat shundan keyin olinadi.
**Micro:** Listlar soni, chiqindi % va qoldiq m² ko'rsatiladi.

### 6
**H:** Spetsifikatsiya bir tegishda
**Body:** Barcha detallar toza o'lchamda — kromka, tekstura va soni bilan. Xarid uchun Excel, sex uchun PDF. Oyna va tosh kesimga emas, yetkazib beruvchiga alohida qator bo'lib ketadi.

### 7
**H:** Smeta — sizning narxlaringiz bo'yicha
**Body:** O'z narxlaringizni bir marta kiriting — list, kromka, kesim, teshik, furnitura — va ilova birovnikiga emas, o'shalarga qarab hisoblaydi. UZS, KZT yoki USD. Narx korpus, fasad va ish bo'yicha qatorma-qator ko'rinadi.

### 8
**H:** Sex tushunadigan chizmalar
**Body:** Fasad ko'rinishi, yuqoridan ko'rinish va har bir modul uchun alohida varaq — o'lchamlari va raqamlari bilan. Bitta PDF: chop eting va stanok yoniga qo'ying.

### 9  *(`advancedExport` o'chiq qolsa — bu bo'limni olib tashlang)*
**H:** Teshik kartalari avtomatik
**Body:** Konfirmat, ekssentrik, javon tayanchi va petlalar uchun teshiklar modul konstruksiyasidan hisoblanadi. ChPU uchun tayyor fayl — SWJ008 va DXF.

### 10
**H:** Materiallar katalogi va o'z narxlaringiz
**Body:** O'zingizning LDSP, MDF plitalaringizni, kromka va furnituralaringizni oson qo'shing. m² va metr uchun narxlaringizni kiriting. Qo'shilgan material barcha loyihalarda darhol paydo bo'ladi va smetada avtomatik hisoblanadi.

### 11
**H:** O'z shkaflaringiz — bir marta va butunlay
**Body:** Yaxshi modul yig'dingizmi — saqlab qo'ying. Keyingi loyihada u tayyor turadi, o'z materialingiz va furnituraringiz bilan.

### 12
**H:** Sex standarti bir marta so'raladi
**Body:** LDSP qalinligi, orqa devor, tag, tsokol, tutqich yoki GOLA — sozlamalarda bir marta javob berasiz, va har bir loyihaning har bir moduli shunday quriladi. Har bir shkaf uchun alohida savol emas.

### 13
**H:** Sexga — Telegram orqali
**Body:** Butun paket bitta xabar bilan ketadi: chizmalar, kesim, spetsifikatsiya, stanok fayllari.

### Final CTA
**H:** Loyihani hoziroq boshlang
**Sub:** Bepul · Rus va o'zbek tillari · iOS 14+
**CTA:** App Store'dan yuklab olish
**Muted:** Tez orada Google Play'da

---

## 3. App Store screenshots

**Format:** iPhone 6.9″ **1290 × 2796** (this one set covers all iPhone sizes; Apple down-scales).
Portrait. Max 10 per localization.

**Layout for every frame:** caption block top ~22% on a light background (`#F6F7F5`), device screen
below, bleeding off the bottom edge. Headline Inter Bold ~76px in `#0B0B0B`; subline Inter Regular
~40px in `#6B7280`. Keep the caption inside the top third — Apple crops the bottom in some
placements.

**Order matters:** the App Store shows only the **first 2–3** in search results. Frames 1–3 must
carry the whole pitch on their own.

| # | Screen to capture | RU headline | RU subline | UZ headline | UZ subline |
|---|---|---|---|---|---|
| 1 | Live 3D kitchen, full room, client-ready | **Кухня в 3D за минуты** | По стенам клиента, прямо на телефоне | **Bir necha daqiqada 3D oshxona** | Mijozning devorlari bo'yicha, telefonda |
| 2 | Fill Editor, cabinet split into drawers + doors | **Рисуйте модуль под себя** | Линия делит секцию, касание ставит ящик | **Modulni o'zingizga moslab chizing** | Chiziq bo'ladi, tegish tortma qo'yadi |
| 3 | 3D Lighting Switcher (Day / Evening / Studio) | **Реалистичный свет и 3D** | Дневной, вечерний и студийный режим | **Realistik yorug'lik va 3D** | Kunduzgi, kechki va studiya rejimi |
| 4 | Раскрой — CutMap with sheets + waste % | **Раскрой с учётом остатков** | Сначала обрезки со склада, потом новый лист | **Qoldiqlarni hisobga olgan kesim** | Avval ombordagi qirqindi, keyin yangi list |
| 5 | Смета, line items visible | **Смета по вашим ценам** | Ваши расценки, UZS или USD | **Smeta sizning narxlaringizda** | O'z narxlaringiz, UZS yoki USD |
| 6 | Drawings page — FacePlan + module sheet | **Чертежи для цеха** | Фасад, вид сверху и лист на каждый модуль | **Sex uchun chizmalar** | Fasad, yuqoridan va har modulga varaq |
| 7 | DrillSheet *(needs `advancedExport`)* | **Карты сверловки** | Присадка и файл ЧПУ автоматически | **Teshik kartalari** | Teshiklar va ChPU fayli avtomatik |
| 8 | Каталог → Добавление материала & цен | **Каталог материалов и цен** | Легко добавляйте свои ЛДСП, кромку и цены | **Materiallar va narxlar katalogi** | O'z LDSP, kromka va narxlaringizni oson qo'shing |
| 9 | Настройки → Стандарт цеха | **Стандарт цеха — один раз** | Толщина, задняя стенка, цоколь, ручки | **Sex standarti — bir marta** | Qalinlik, orqa devor, tsokol, tutqich |
| 10 | Передача / Telegram share | **В цех одним сообщением** | Чертежи, раскрой, спецификация, файлы станка | **Sexga bitta xabar bilan** | Chizmalar, kesim, spetsifikatsiya, fayllar |

### Rules for the shots themselves

- **Shoot a real, full kitchen** — 8–12 modules, corner unit, tall unit, appliances, a realistic
  finish. An empty room with two boxes looks like an unfinished product.
- **One project across every frame.** The same kitchen in 3D, in the editor, in the cut plan and in
  the estimate reads as one coherent tool. Different kitchens per frame read as a slideshow.
- **Use the simulator, not a device** — `npx cap run ios` in an iPhone 16 Pro Max sim gives exactly
  1290 × 2796 with no notch artefacts or personal data in the status bar.
- **Russian screenshots need a Russian UI, Uzbek ones Uzbek.** The language switch is in Настройки.
  Two full passes.
- **Kill the placeholders**: no «Проект 1», no `renvapp@gmail.com`, no empty client fields. Put a
  plausible project name and a plausible client on it.
- **Re-shoot everything.** The existing set predates the rename and still shows the old brand and
  the old IKEA-derived material names.

---

## 4. App Store text that should change with this

The current description (in `SUBMISSION.md` §4a) leads with the 3D constructor and lists «Точная
смета» flatly. Three edits keep it true and sharpen it:

- «Точная смета» → **«Смета по вашим ценам»** — accurate about the rates being the seller's own,
  and it stops sounding like we invented a price.
- Add a line that the cut plan uses the workshop's **existing offcuts**. It's the most concrete
  claim we have and nothing else in the listing says it.
- Highlight the **custom material catalog & lighting presets** (Day/Evening/Studio) for presenting realistic 3D kitchens on-site to clients.

