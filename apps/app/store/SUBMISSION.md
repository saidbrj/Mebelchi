# Jihozla — App Store submission runbook

Everything needed to get the app into App Store Connect (iOS). Work top to bottom.
Fields marked **⚠ REPLACE** contain placeholders you must swap for real values.

---

## 0. Current repo status (already done)

- `capacitor.config.ts` → `appName: "Jihozla"`, `webDir: "dist"`, Capacitor 7.
- Icon source `assets/icon.png` is 1024×1024; splash light/dark present.
- `public/privacy.html` — real privacy policy (needs the real email + hosting URL).
- No native permissions used (no camera / location / photos / contacts) → **no Info.plist usage strings needed**, minimal privacy declarations.
- Material catalog renamed off IKEA trademark names → generic finish names.
- Web build passes (`npm run build`).

## 0.1 Decisions — LOCKED

1. **Bundle ID = `uz.jihozla.app`** ✅ (set in `capacitor.config.ts`). Register this exact ID in the
   Developer portal (step 2). It is permanent after the first upload.
2. **Support email = `renvapp@gmail.com`** ✅ (temporary; in-app `privacy.html` updated, template
   note removed). Swap for a company address in v2.
3. **Privacy Policy hosting = Google Sites** (temporary landing + privacy until the v2 site).
   Publish the ru+uz privacy text (provided separately) and use that public URL as the
   Privacy Policy URL. In-app `public/privacy.html` mirrors the ru version.
4. **iPhone-only for v1** ✅ — set Targeted Device Family to iPhone in Xcode so you don't need iPad
   screenshots or iPad testing. Add iPad later.

---

## 1. Prerequisites (one-time, on this Mac)

- Apple Developer Program membership — **$99/yr**, must be active. (enroll at developer.apple.com)
- Xcode (latest) + Command Line Tools + CocoaPods:
  ```
  xcode-select --install
  sudo gem install cocoapods   # or: brew install cocoapods
  ```

## 2. Register the app in Apple's portals

1. **Developer portal → Identifiers** → new App ID → Bundle ID = your chosen `uz.jihozla.app`.
   Capabilities: none special needed (no push, no sign-in-with-apple for now).
2. **App Store Connect → My Apps → +** → New App:
   - Platform: iOS
   - Name: **Jihozla** (must be unique across the whole store — if taken, try `Jihozla — Кухни 3D`)
   - Primary language: Russian (add Uzbek as a localization later)
   - Bundle ID: the one from step 1
   - SKU: `jihozla-ios-01` (any private string)

## 3. Build & upload the iOS app

```
cd apps/app
npm run build
npx cap add ios          # generates the ios/ Xcode project (first time only)
npm run cap:assets       # generates all icon + splash sizes from assets/
npx cap sync ios
npx cap open ios         # opens Xcode
```

In **Xcode**, select the App target → Signing & Capabilities:
- Team: your Apple Developer team (enables automatic signing)
- Bundle Identifier: `uz.jihozla.app`
- Display Name: `Jihozla`
- Version: `1.0`  ·  Build: `1`
- Deployment target: iOS 14.0
- General → Targeted Device Family: **iPhone** (v1)
- Info.plist → **`ITSAppUsesNonExemptEncryption` = `NO` is already set** in
  `ios/App/App/Info.plist` (app only uses standard HTTPS/TLS → exempt; skips the export-compliance
  prompt on all future builds). Build 1 was uploaded before this key existed, so for that build
  answer the ASC dialog "None of the algorithms mentioned above" → no documentation needed.

Then: **Product → Archive** → Organizer → **Distribute App → App Store Connect → Upload**.
The build appears in App Store Connect after ~5–15 min of processing.

---

## 4. Listing copy — paste into App Store Connect

### 4a. Russian (primary)

**Name (≤30):**
```
Jihozla
```
**Subtitle (≤30):**
```
3D-кухни, смета, раскрой
```
**Promotional text (≤170, editable anytime):**
```
Проектируйте кухни в 3D, меняйте фасады вживую и сразу получайте смету и файлы для ЧПУ. От идеи до передачи на производство — в одном приложении.
```
**Keywords (≤100, comma-separated, no spaces):**
```
кухня,мебель,3d,конструктор,шкаф,смета,раскрой,чпу,дизайн,кухни,мебельщик,проект,фасад,столешница
```
**Description (≤4000):**
```
Jihozla — приложение для мебельщиков и дизайнеров кухонь. Соберите кухню в 3D за минуты, подберите материалы и сразу получите смету и файлы для производства.

ВОЗМОЖНОСТИ
• 3D-конструктор — расставляйте модули перетаскиванием, стройте кухню по своим стенам.
• Живой подбор отделки — меняйте фасады, столешницы и корпус прямо в 3D.
• Угловые и навесные модули, ящики, пеналы, техника.
• Точная смета — стоимость по корпусу, фасадам, фурнитуре, распилу и кромке.
• Раскрой и файлы для ЧПУ — передача на производство в один тап (SWJ008, DXF, чертежи).
• Мои шкафы — сохраняйте свои модули и переиспользуйте в любом проекте.
• Мультивалютность — UZS и USD с ручным курсом.
• Русский и узбекский языки.
• Синхронизация проектов между устройствами.

Для кого: мебельные производства, дизайнеры кухонь, замерщики.

Требуется бесплатная учётная запись для сохранения и синхронизации проектов.
```

### 4b. Uzbek (add as a localization)

**Subtitle (≤30):**
```
3D oshxona, smeta, kesim
```
**Promotional text:**
```
Oshxonani 3D'da loyihalang, fasadlarni jonli almashtiring va darhol smeta hamda CNC uchun fayllarni oling. G'oyadan ishlab chiqarishgacha — bitta ilovada.
```
**Keywords:**
```
oshxona,mebel,3d,konstruktor,shkaf,smeta,kesim,cnc,dizayn,loyiha,fasad,stol,jihoz
```
**Description:**
```
Jihozla — mebelchilar va oshxona dizaynerlari uchun ilova. Oshxonani bir necha daqiqada 3D'da yig'ing, materiallarni tanlang va darhol smeta hamda ishlab chiqarish fayllarini oling.

IMKONIYATLAR
• 3D konstruktor — modullarni surib joylashtiring, oshxonani o'z devorlaringizga qurib chiqing.
• Jonli materiallar — fasad, stol usti va korpusni to'g'ridan-to'g'ri 3D'da almashtiring.
• Burchak va osma modullar, tortmalar, penallar, texnika.
• Aniq smeta — korpus, fasad, furnitura, kesim va kromka bo'yicha narx.
• Kesim va CNC fayllari — ishlab chiqarishga bir tegishda uzatish (SWJ008, DXF, chizmalar).
• Mening shkaflarim — o'z modullaringizni saqlang va istalgan loyihada qayta ishlating.
• UZS va USD valyutalari qo'lda kurs bilan.
• Rus va o'zbek tillari.
• Loyihalarni qurilmalar o'rtasida sinxronlash.

Kim uchun: mebel ishlab chiqaruvchilar, oshxona dizaynerlari, o'lchovchilar.

Loyihalarni saqlash va sinxronlash uchun bepul hisob talab qilinadi.
```

### 4c. Other listing fields

- **Category:** Primary = *Graphics & Design*; Secondary = *Business*.
- **Support URL:** the Google Sites landing page (or a page with `renvapp@gmail.com` on it).
- **Marketing URL:** optional (same Google Sites landing).
- **Privacy Policy URL:** the Google Sites privacy page (ru+uz).
- **Copyright:** `2026 <Your company / name>`.
- **Screenshots:** 6.9" set (1290×2796) — the 6 you designed. Fix frame 6 caption to
  «Сохраняйте свои шкафы» and re-shoot frame 3 so material names aren't IKEA. Upload a ru set;
  optionally a uz set.

---

## 5. App Privacy (data collection questionnaire)

Declare these (all: used for **App Functionality**, **linked to identity**, **NOT** used for tracking):
- **Contact Info → Email Address** (account)
- **Contact Info → Name, Phone Number** (optional profile / company)
- **User Content → Other User Content** (your kitchen projects)
- **Identifiers → User ID** (auth user id)

Mark **NOT collected:** location, photos/media, contacts, browsing history, search history,
purchases, financial info, health, sensitive info, usage data, diagnostics, advertising data.
**Tracking:** No.

Third-party processors (mention in privacy policy, already done): Supabase (auth + DB), Netlify (hosting).

## 6. Other review answers

- **Age rating:** answer all "None" → **4+**.
- **Export compliance / encryption:** *Does your app use non-exempt encryption?* → **No**
  (only standard HTTPS). Matches the `ITSAppUsesNonExemptEncryption=NO` Info.plist key.
- **Sign in with Apple:** **not required** — you use email/password (not third-party social login).
  If you later add Google/Facebook login, Sign in with Apple becomes mandatory (Guideline 4.8).
- **Account deletion (Guideline 5.1.1(v)):** required and already present
  (Настройки → Опасная зона → Удалить аккаунт). **Verify it actually deletes** before submitting.

## 7. App Review Information (avoid the #1 rejection)

The app is behind a login, so App Review MUST get a working demo account.
**Use a dedicated demo account, NOT your personal login** — reviewers may edit/delete data, the
password must stay stable, and your real client projects shouldn't be exposed.
- **Sign-in required:** Yes
- **Demo account:** sign up in the app with a Gmail plus-alias you control, e.g.
  `renvapp+review@gmail.com` (still lands in renvapp@gmail.com), a simple fixed password,
  pre-seeded with 1–2 finished sample projects so the reviewer sees the full journey.
  Confirm the account works (email verified, can log in) before submitting.
- **Notes:** short EN note, e.g. "B2B kitchen design tool. Log in with the demo account. Create a
  project → place modules → configure → estimate → export. UZS pricing is expected (Uzbekistan)."
- Contact first/last name, phone, email.

## 8. Final pre-submit checklist

- [ ] Bundle ID locked (`capacitor.config.ts` + Developer portal match)
- [ ] Real support email in privacy.html (×2) + template note removed
- [ ] Privacy Policy URL is public and loads
- [ ] Frame 6 caption fixed; frame 3 re-shot without IKEA names
- [ ] Demo account created + seeded, entered in App Review Information
- [ ] Account deletion verified working
- [ ] `ITSAppUsesNonExemptEncryption=NO`, encryption question = No
- [ ] Version 1.0 / Build 1, iPhone-only
- [ ] Build uploaded and selected on the version
- [ ] Screenshots, description, keywords, category filled
- [ ] Submit for Review

---

## Notes / later

- **Play Store** reuses almost all of this (same screenshots ≥1080×1920, same description,
  Data Safety form mirrors the App Privacy answers). `npx cap add android` when ready.
- **AI render** Preview stays behind the `AI_RENDER` flag for v1 — don't mention it in the listing
  or screenshots until it ships.
