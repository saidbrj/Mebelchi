# Mebely — App Store submission runbook

Everything needed to get the app into App Store Connect (iOS). Work top to bottom.
Fields marked **⚠ REPLACE** contain placeholders you must swap for real values.

---

## 0. Current repo status (already done)

*Verified 6 Aug 2026.*

- `capacitor.config.ts` → `appName: "Mebely"`, `webDir: "dist"`, Capacitor 7.
- **`ios/` and `android/` Xcode/Gradle projects both exist in the repo** — do NOT run `cap add`.
- **iOS `CFBundleDisplayName` = `Mebely`** (was still `Jihozla` until 6 Aug 2026 — see §3.4).
- **Version `1.0.1`, build `5`**, signed and archived; the .ipa exports clean under an
  *Apple Distribution* identity. Only the ASC upload credential is outstanding — §3.3.
- Icon source `assets/icon.png` is 1024×1024; splash light/dark present.
- `public/privacy.html` — real privacy policy (needs the real email + hosting URL).
- No native permissions used (no camera / location / photos / contacts) → **no Info.plist usage strings needed**, minimal privacy declarations.
- Material catalog renamed off IKEA trademark names → generic finish names.
- Web build passes (`npm run build`); 295 app + 53 pricing unit tests pass; typecheck clean.

### Still open before the store listing can be submitted

0. **⚠️ The App Store Connect app record is still called `Jihozla`.** App id `6787715848`, bundle
   `uz.jihozla.app`. The binary, the Android build and every in-app string say *Mebely*, but the
   **store listing name was never renamed** — so the App Store would publish it under the old
   brand. Fix in ASC → your app → **App Information → Name** (editable only while no version is
   "Waiting for Review"; if one is, remove it from review first). The `Name` in §4a is the value
   to use. This is invisible from the repo — nothing in the codebase can tell you it is wrong.
1. **Screenshots** — the existing set was shot under the old brand and shows the old IKEA-style
   material names on frame 3. Re-shoot on the current build. Frame 6's caption is a copy of
   frame 2's and should read «Сохраняйте свои шкафы».
2. **Demo account** for App Review — the app is guest-first, but anything behind login needs a
   seeded Supabase account in ASC → App Review Information. Top rejection cause.
3. **Privacy Policy URL** must be publicly reachable (Google Sites plan, §Landing).
4. **Support email** is still the temporary `renvapp@gmail.com`.

## 0.1 Decisions — LOCKED

1. **Bundle ID = `uz.jihozla.app`** ✅ (set in `capacitor.config.ts`). Register this exact ID in the
   Developer portal (step 2). It is permanent after the first upload.
   > ⚠️ The ID deliberately keeps the **old** brand spelling. The app was renamed Jihozla → Mebely,
   > but a bundle/application ID cannot change once uploaded (Play already has an `app-release.aab`
   > under it), so it stays as-is. Do not "fix" it to `uz.mebely.app` — that would create a
   > separate listing that existing installs cannot update to. The user-facing name is Mebely
   > everywhere (`appName`, `strings.xml`, store listing); only this opaque identifier lags.
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
   - Name: **Mebely** (must be unique across the whole store — if taken, try `Mebely — Кухни 3D`)
   - Primary language: Russian (add Uzbek as a localization later)
   - Bundle ID: the one from step 1
   - SKU: `mebely-ios-01` (any private string)

## 3. Build & upload the iOS app

> **Step 2 of this section used to say `npx cap add ios` "first time only". That is DONE** —
> `apps/app/ios/` and `apps/app/android/` are both in the repo. Running `cap add` again does
> nothing useful and can clobber the Xcode project. Skip it.

### 3.1 Build the archive (no Xcode GUI needed)

```
cd apps/app
npm run build
npx cap sync ios          # copies dist/ into ios/App/App/public + pod install

cd ios/App
xcodebuild -workspace App.xcworkspace -scheme App -configuration Release \
  -destination "generic/platform=iOS" \
  -archivePath /tmp/Mebely.xcarchive archive -allowProvisioningUpdates
```

`-allowProvisioningUpdates` is what lets this run headless: it creates the **Apple Distribution**
certificate and the App Store provisioning profile through the Xcode-signed-in account, which is
otherwise the one thing a plain `xcodebuild` cannot do (the Mac only carries an *Apple Development*
identity by default, and that one cannot sign a store build).

To make the archive visible in Xcode → Window → Organizer, put it where Organizer looks:

```
cp -R /tmp/Mebely.xcarchive ~/Library/Developer/Xcode/Archives/$(date +%F)/"Mebely 1.0.1 (5).xcarchive"
```

### 3.2 Export the signed .ipa

```
cat > /tmp/ExportOptions.plist <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>method</key><string>app-store-connect</string>
  <key>teamID</key><string>LK8WRDDB7X</string>
  <key>uploadSymbols</key><true/>
  <key>signingStyle</key><string>automatic</string>
</dict></plist>
PLIST

xcodebuild -exportArchive -archivePath /tmp/Mebely.xcarchive \
  -exportOptionsPlist /tmp/ExportOptions.plist \
  -exportPath /tmp/MebelyExport -allowProvisioningUpdates
```

Verify before uploading — the app inside must be signed **Apple Distribution**, not Development:

```
cd /tmp && rm -rf ipacheck && mkdir ipacheck && cd ipacheck
unzip -q /tmp/MebelyExport/App.ipa
codesign -dvv Payload/App.app 2>&1 | grep Authority
plutil -p Payload/App.app/Info.plist | grep -E "DisplayName|Version"
```

### 3.3 Upload — needs a credential, pick one

**A. App Store Connect API key (headless, repeatable — do this once).**
App Store Connect → Users and Access → **Integrations** → App Store Connect API → **+** →
Access: *App Manager*. Download `AuthKey_XXXXXXXXXX.p8` (**one download only, Apple never
shows it again**), and note the **Key ID** and the **Issuer ID** on that page. Then:

```
mkdir -p ~/.appstoreconnect/private_keys
mv ~/Downloads/AuthKey_XXXXXXXXXX.p8 ~/.appstoreconnect/private_keys/

xcrun altool --upload-app -f /tmp/MebelyExport/App.ipa -t ios \
  --apiKey XXXXXXXXXX --apiIssuer 00000000-0000-0000-0000-000000000000
```

**B. Xcode Organizer (GUI, no key needed).**
Xcode → Window → Organizer → pick the archive → **Distribute App** → *App Store Connect* →
*Upload* → Next through the defaults → Upload.

Either way the build lands in App Store Connect and takes ~5–15 min to finish processing before
it can be assigned to TestFlight.

> **Path A is live on this Mac.** Working keys are already in `~/.appstoreconnect/private_keys/`.
> The Key ID is the filename (`AuthKey_<KEYID>.p8`); the Issuer ID is on the ASC Integrations page.
> More than one key may sit there and **only some of them authenticate** — a key belongs to one
> team, and a wrong pairing fails with a bare `401 / -19209` that names nothing. Find the right one
> without touching a build:
>
> ```
> xcrun altool --list-apps --apiKey <KEYID> --apiIssuer <ISSUERID>
> ```
>
> The one that works prints the app list (you should see `uz.jihozla.app`). Then always
> `--validate-app` before `--upload-app` — same arguments, no upload, and it catches a bad
> build number or an unsigned binary in ~30 seconds instead of by email ten minutes later.

### 3.4 Target settings (already set in the repo — verify, don't re-enter)

- Team: `LK8WRDDB7X` · Bundle Identifier: `uz.jihozla.app` · Display Name: `Mebely`
- **Version `1.0.1` · Build `5`** (in `App.xcodeproj/project.pbxproj` as `MARKETING_VERSION` /
  `CURRENT_PROJECT_VERSION` — bump `CURRENT_PROJECT_VERSION` for *every* upload; App Store Connect
  rejects a build number it has already seen, and the rejection comes ~10 minutes later by email,
  not at upload time)
- Deployment target: iOS 14.0 · Targeted Device Family: **iPhone** (v1)
- `ITSAppUsesNonExemptEncryption = NO` is set in `ios/App/App/Info.plist` (standard HTTPS/TLS →
  exempt; skips the export-compliance prompt on every build). Build 1 predates the key — if ASC
  asks about that one, answer "None of the algorithms mentioned above".
- `CFBundleDisplayName` was **`Jihozla`** until 6 Aug 2026 — a leftover from the first rename that
  would have put the wrong name under the icon on the phone regardless of what the store listing
  said. It is `Mebely` now.

> ⚠️ **`apps/app/ios/` is gitignored** (`apps/app/.gitignore` line 9), so everything in §3.4 —
> the display name, the version, the build number, the signing team — exists **only on this Mac**
> and is in no commit. Two consequences worth knowing before you trust them:
>
> - Re-running `cap add ios`, or building on a different machine, starts from a fresh scaffold and
>   **the `Jihozla` display name comes back**. `cap sync` does *not* rewrite `CFBundleDisplayName`
>   from `appName` — Capacitor only writes it when it first creates the project. Check that key
>   after any regeneration.
> - The build number lives only here too, so "which build did I last upload" is answered by App
>   Store Connect, not by the repo. Check ASC before bumping.

### 3.5 TestFlight — getting it onto your own phone

TestFlight needs **no App Review and no store listing**. Once §3.3's upload finishes processing:

1. App Store Connect → your app → **TestFlight** tab → the build shows *Processing* for
   ~5–15 min, then *Ready to Submit*.
2. **Export compliance**: it should not ask, because `ITSAppUsesNonExemptEncryption = NO` is in
   the plist. If it does, answer *No*.
3. **Internal testing** — the fast path, no review at all, up to 100 people, all of whom must be
   users on your App Store Connect team:
   *TestFlight → Internal Testing → + → create a group → add yourself → enable the build.*
   The invite arrives by email within a minute or two.
4. On the phone: install **TestFlight** from the App Store, sign in with the **same Apple ID that
   received the invite**, accept, install. Builds expire after **90 days**.
5. **External testing** (anyone by email or a public link, up to 10 000) *does* need a
   Beta App Review — usually a day, and much lighter than a store review. Not needed to test
   it yourself.

A build number can never be reused, so every TestFlight push means bumping
`CURRENT_PROJECT_VERSION` first (§3.4).

---

## 4. Listing copy — paste into App Store Connect

### 4a. Russian (primary)

**Name (≤30):**
```
Mebely
```
**Subtitle (≤30):**
```
3D-кухни, смета, раскрой
```
**Promotional text (≤170, editable anytime):**
```
Бета-версия: соберите кухню в 3D на телефоне с реалистичным светом, раскроем по остаткам и сметой по вашим ценам. Помогите нам довести приложение до идеала.
```
**Keywords (≤100, comma-separated, no spaces):**
```
кухня,мебель,3d,конструктор,шкаф,смета,раскрой,чпу,дизайн,кухни,мебельщик,проект,фасад,столешница
```
**Description (≤4000):**
```
Mebely — приложение для мебельщиков и дизайнеров кухонь. Соберите кухню в 3D за минуты прямо на телефоне, покажите клиенту с реалистичным освещением, подготовьте смету и файлы для производства.

ВОЗМОЖНОСТИ

• 3D-конструктор — расставляйте модули по реальным стенам клиента. Углы, ниши, техника и столешницы считаются автоматически.
• Рисуйте модуль под себя — проведите линию, чтобы разделить секцию, коснитесь ячейки — появится дверца или ящик. Любая начинка без выбора из списка.
• Реалистичный свет и 3D — переключайте режим освещения: дневной, вечерний или студийный. Настоящие текстуры дерева, глянца и матовых фасадов.
• Живой подбор отделки — меняйте фасады, столешницы и корпус прямо в 3D.
• Каталог материалов с вашими ценами — добавляйте свои ЛДСП, МДФ, кромку и фурнитуру.
• Смета по вашим ценам — приложение считает по вашим расценкам. UZS, KZT или USD.
• Раскрой с учётом остатков — сначала заполняются обрезки со склада, потом новый лист.
• Файлы для производства — чертежи, карты сверловки SWJ008 и DXF для станка.
• Мои шкафы — сохраняйте свои модули и переиспользуйте в любом проекте.
• Стандарт цеха — настройте один раз, применяется ко всем проектам.
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
Oshxonani 3D'da telefonda yig'ing — realistik yoritish, qoldiqlarni hisobga olgan kesim va o'z narxlaringiz bo'yicha smeta.
```
**Keywords:**
```
oshxona,mebel,3d,konstruktor,shkaf,smeta,kesim,cnc,dizayn,loyiha,fasad,stol,jihoz
```
**Description:**
```
Mebely — mebelchilar va oshxona dizaynerlari uchun ilova. Oshxonani bir necha daqiqada 3D'da telefonda yig'ing, mijozga realistik yoritishda ko'rsating, smeta va ishlab chiqarish fayllarini tayyorlang.

IMKONIYATLAR

• 3D konstruktor — modullarni mijozning haqiqiy devorlari bo'ylab joylashtiring. Burchaklar, nishalar, texnika va stol usti avtomatik hisoblanadi.
• Modulni o'zingizga moslab chizing — chiziq torting, bo'lim bo'linadi. Katakchani bosing — eshik yoki tortma paydo bo'ladi.
• Realistik yorug'lik va 3D — kunduzgi, kechki yoki studiya rejimi. Haqiqiy teksturalar yumshoq soyalar bilan.
• Jonli materiallar — fasad, stol usti va korpusni to'g'ridan-to'g'ri 3D'da almashtiring.
• Materiallar katalogi va o'z narxlaringiz — LDSP, MDF, kromka va furnituralaringizni oson qo'shing.
• Smeta sizning narxlaringiz bo'yicha — ilova o'z narxlaringizga qarab hisoblaydi. UZS, KZT yoki USD.
• Qoldiqlarni hisobga olgan kesim — avval ombordagi qirqindilar, keyin yangi list.
• Ishlab chiqarish fayllari — chizmalar, SWJ008 teshik kartalari va stanok uchun DXF.
• Mening shkaflarim — modullaringizni saqlang va qayta ishlating.
• Sex standarti — bir marta sozlang, barcha loyihalarga qo'llaniladi.
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
- **Screenshots:** 6.9" set (1290×2796) — see CONTENT_RU_UZ.md §3 for the 10-frame plan.
  Upload a ru set; optionally a uz set.

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
