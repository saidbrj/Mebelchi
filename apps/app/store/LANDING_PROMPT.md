# Landing page — build prompt (paste into v0 / Lovable / Bolt / Cursor)

Everything below the line is the prompt. It is written to be pasted whole. The facts in it were
verified against the live App Store listing and the repo on 6 Aug 2026 — do not let the generator
invent replacements for any of them.

**Before you paste, decide two things:**

1. **The App Store listing is still named `Jihozla`** (live since 7 Jul 2026). Every link in this
   prompt uses the ID-only form `https://apps.apple.com/app/id6787715848`, which keeps working
   after you rename — Apple redirects it and the slug is cosmetic. Rename in ASC → App Information
   → Name while `1.0.1` is in *Prepare for Submission* (it is), so the page and the store agree.
2. **Google Play is not live yet.** The prompt marks the Play badge as "скоро / tez orada". Delete
   that block if you'd rather not advertise it.

---

## PROMPT STARTS HERE

Build a production-quality bilingual (Russian + Uzbek) marketing landing page for a **real, shipping
iOS app**. Deploy target is **Vercel**. This is a real business page for a real product — accuracy
matters more than flourish.

### The product

**Mebely** — a mobile app for kitchen-furniture makers. The user designs a kitchen in 3D against
their own room's walls, picks materials live, and gets a costed estimate plus the actual production
files (cut plan, drilling, drawings, DXF, CNC). It replaces an evening of manual drafting.

- **Audience: B2B, Uzbekistan.** Furniture workshops (мебельные цеха), kitchen designers, and
  measurers (замерщики). These are working professionals on phones, not consumers browsing. Speak
  to time saved and mistakes avoided, not to "lifestyle".
- Live on the App Store: `https://apps.apple.com/app/id6787715848`
- Android: coming, not yet released.
- Support email: `renvapp@gmail.com`
- Category: Graphics & Design. Requires iOS 14+.

### Tech stack — required

- **Next.js (App Router) + TypeScript + Tailwind CSS.** Static-first; no database, no CMS, no auth,
  no client-side data fetching. Everything is content in the repo.
- **Routing-based i18n, not a client-side toggle:** `/ru` and `/uz` are real routes that render on
  the server. `/` redirects to `/ru`. Reason: App Store Connect takes a *separate* marketing and
  support URL per language localization, so each language must have its own crawlable, linkable URL.
- Language switcher in the header (`Русский · O'zbekcha`) links to the same page in the other
  language — not a JS state toggle.
- Also build `/ru/privacy`, `/uz/privacy`, `/ru/terms`, `/uz/terms` as real routes with the same
  header/footer. Use lorem-length placeholder bodies with a clear `{/* PASTE POLICY TEXT HERE */}`
  marker — the real legal text gets pasted in afterwards. **The privacy route must exist and be
  publicly reachable**: Apple requires a working privacy-policy URL on the listing, and this page
  is going to be it.
- Metadata per route: title, description, canonical, `hreflang` alternates linking ru↔uz,
  OpenGraph + Twitter card. `sitemap.ts` and `robots.ts`. JSON-LD `SoftwareApplication` with
  `applicationCategory: DesignApplication` and `operatingSystem: iOS`.
- No external requests at runtime — self-host the font (Inter), inline the SVGs. The page must be
  fast on a mid-range Android phone over 3G, which is what this audience actually carries.

### Brand

```
--brand:      #00AC7A   /* primary green — buttons, links, accents */
--brand-ink:  #00875F   /* hover/pressed */
--ink:        #0B0B0B   /* body text */
--muted:      #6B7280   /* secondary text */
--bg:         #FFFFFF
--surface:    #F6F7F5   /* section bands, cards */
--radius:     14px
font: Inter (400/500/700), self-hosted
```

Wordmark is the word **Mebely** set in Inter Bold, tight tracking, in `--brand`. No logo file
exists yet — render it as styled text, and structure the component so an SVG can replace it later.

**Design direction:** clean, technical, confident. Think Linear or Vercel's own marketing pages —
generous whitespace, strong type hierarchy, one accent colour used sparingly. Light theme only.
Avoid: gradient meshes, glassmorphism, floating 3D blobs, emoji as icons, stock photos of smiling
people in offices. Use simple line icons (inline SVG, 1.5px stroke, currentColor).

Fully responsive, mobile-first — assume most visitors arrive on a phone from a Telegram link.

### Page structure

1. **Header** — wordmark left; language switcher + "App Store" text link right. Sticky, subtle
   bottom border after scroll.
2. **Hero** — H1, one-sentence subhead, App Store badge (official black badge, links to the ID URL),
   and a phone mockup frame on the right (desktop) / below (mobile). Leave the screenshot as a
   labelled placeholder `[SCREENSHOT: 3D constructor]` at iPhone aspect (1290×2796) — real ones get
   dropped in later.
3. **Trust strip** — three plain stats. Use **only** these, they are true and verifiable:
   `Русский и узбекский` · `UZS · USD` · `iOS 14+`. **Do not invent download counts, user numbers,
   ratings, testimonials, company logos, or "trusted by" rows.** If a section needs social proof,
   leave a commented placeholder instead of fabricating one.
4. **Features** — 6 cards in a 3×2 grid (1 column on mobile), copy given verbatim below.
5. **How it works** — 5 numbered steps, horizontal on desktop, vertical timeline on mobile.
6. **Who it's for** — one short band, three roles.
7. **Final CTA** — App Store badge again + a muted "Скоро в Google Play / Tez orada Google Play'da"
   line, visually secondary.
8. **Footer** — support email (mailto), privacy + terms links, language switcher, `© 2026 Mebely`.

### Copy — use exactly this, do not rewrite or "improve" it

The Russian and Uzbek below are final. Translate nothing yourself; the Uzbek is Latin-script
Uzbek written for this market and machine translation makes it wrong.

#### 🇷🇺 Russian (`/ru`)

- **H1:** Кухни в 3D — от идеи до производства
- **Subhead:** Проектируйте кухни в 3D, подбирайте материалы вживую и сразу получайте смету и файлы для ЧПУ. Всё в одном приложении.
- **CTA:** Загрузить в App Store
- **What it is (section lead):** Mebely — мобильное приложение для мебельщиков и дизайнеров кухонь. Соберите кухню за минуты, покажите клиенту в 3D и передайте на производство готовый пакет — без чертежей вручную.
- **Features heading:** Возможности
  1. **3D-конструктор** — расставляйте модули перетаскиванием по своим стенам.
  2. **Живой подбор отделки** — меняйте фасады, столешницы и корпус прямо в 3D.
  3. **Точная смета** — стоимость по корпусу, фасадам, фурнитуре, распилу и кромке.
  4. **Файлы для производства** — раскрой, сверловка, чертежи, DXF в один тап.
  5. **Мои шкафы** — сохраняйте свои модули и переиспользуйте в проектах.
  6. **Два языка, две валюты** — русский и узбекский, UZS и USD.
- **How it works heading:** Как это работает
  1. Задайте комнату и стены.
  2. Расставьте модули в 3D.
  3. Подберите материалы и фасады.
  4. Получите смету.
  5. Отправьте пакет на производство.
- **Who it's for heading:** Для кого
  Мебельные производства · Дизайнеры кухонь · Замерщики
- **Footer contact label:** По вопросам и поддержке
- **Footer links:** Политика конфиденциальности · Условия использования

#### 🇺🇿 Uzbek (`/uz`)

- **H1:** 3D oshxona — g'oyadan ishlab chiqarishgacha
- **Subhead:** Oshxonani 3D'da loyihalang, materiallarni jonli tanlang va darhol smeta hamda CNC uchun fayllarni oling. Barchasi bitta ilovada.
- **CTA:** App Store'dan yuklab olish
- **What it is:** Mebely — mebelchilar va oshxona dizaynerlari uchun mobil ilova. Oshxonani bir necha daqiqada yig'ing, mijozga 3D'da ko'rsating va ishlab chiqarishga tayyor paketni uzating — chizmalarni qo'lda chizmasdan.
- **Features heading:** Imkoniyatlar
  1. **3D konstruktor** — modullarni o'z devorlaringiz bo'ylab surib joylashtiring.
  2. **Jonli materiallar** — fasad, stol usti va korpusni to'g'ridan-to'g'ri 3D'da almashtiring.
  3. **Aniq smeta** — korpus, fasad, furnitura, kesim va kromka bo'yicha narx.
  4. **Ishlab chiqarish fayllari** — kesim, teshiklar, chizmalar, DXF bir tegishda.
  5. **Mening shkaflarim** — o'z modullaringizni saqlang va loyihalarda qayta ishlating.
  6. **Ikki til, ikki valyuta** — rus va o'zbek tillari, UZS va USD.
- **How it works heading:** Qanday ishlaydi
  1. Xona va devorlarni belgilang.
  2. Modullarni 3D'da joylashtiring.
  3. Materiallar va fasadlarni tanlang.
  4. Smetani oling.
  5. Paketni ishlab chiqarishga yuboring.
- **Who it's for heading:** Kimlar uchun
  Mebel ishlab chiqaruvchilar · Oshxona dizaynerlari · O'lchovchilar
- **Footer contact label:** Savollar va yordam uchun
- **Footer links:** Maxfiylik siyosati · Foydalanish shartlari

**SEO strings**

- ru title: `Mebely — кухни в 3D, смета и файлы для ЧПУ`
- ru description: `Мобильное приложение для мебельщиков: соберите кухню в 3D, получите точную смету и готовые файлы для производства — раскрой, сверловка, чертежи, DXF.`
- uz title: `Mebely — 3D oshxona, smeta va CNC fayllari`
- uz description: `Mebelchilar uchun mobil ilova: oshxonani 3D'da yig'ing, aniq smeta va ishlab chiqarish uchun tayyor fayllarni oling — kesim, teshiklar, chizmalar, DXF.`

### Hard constraints

- **Invent no facts.** No fabricated statistics, testimonials, customer logos, press mentions,
  award badges, pricing, or founding dates. Where an asset is missing, emit a visible labelled
  placeholder, never a plausible-looking fake.
- **Do not translate or reword the supplied copy** in either language.
- Every App Store link must be exactly `https://apps.apple.com/app/id6787715848`.
- No cookie banner, no analytics, no tracking scripts, no third-party embeds. The app collects no
  device data and the site should match; adding a tracker would make the privacy policy untrue.
- Accessible: semantic landmarks, one `h1` per page, visible focus rings, ≥4.5:1 text contrast,
  alt text on every image, `lang` attribute set correctly per route.

### Deliver

A complete Next.js project that runs with `npm install && npm run dev` and deploys to Vercel with
zero configuration. Include a short `README.md` covering: where to drop the real screenshots, where
to paste the privacy/terms text, and how to add the Google Play badge when Android ships.

## PROMPT ENDS HERE

---

## After the page is generated

1. **Screenshots.** Take fresh ones from the current build — the old App Store set was shot under
   the previous brand and shows the pre-rename material names.
2. **Legal text.** Paste from `apps/app/public/privacy.html` and `apps/app/public/terms.html` —
   those are the versions the app itself ships and links to, so the two must not drift.
3. **Point App Store Connect at it.** ASC → App Information:
   - Privacy Policy URL → `https://<domain>/ru/privacy`
   - Marketing URL / Support URL → `https://<domain>/ru` (and the `/uz` variants on the Uzbek
     localization, if you add one)
   This replaces the Google Sites plan in `LANDING.md` §hosting — once the Vercel page is live,
   that document is superseded.
4. **Update the in-app links.** `apps/app/public/privacy.html` and `terms.html` are bundled into
   the binary; the Settings screen links to them locally. Leave that as is — it works offline —
   but keep the wording identical to the web copy.
