# Jihozla — Supabase auth email templates

Paste into Supabase dashboard → **Authentication → Email Templates**. Branded (green `#00a961`),
Russian. Requires Custom SMTP to also fix the SENDER address (see below).

## Sender address (Custom SMTP) — temporary Gmail setup
Default emails come from `noreply@mail.app.supabase.io` and are rate-limited (~2–4/hour) — not
production-ready. Until the v2 domain exists, use Gmail SMTP so mail shows as
**"Jihozla <renvapp@gmail.com>"**:
- Google account (renvapp@gmail.com): enable 2-Step Verification → create an **App Password**.
- Supabase → Authentication → Settings → SMTP Settings → Enable Custom SMTP:
  - Sender name: `Jihozla`  ·  Sender email: `renvapp@gmail.com`
  - Host: `smtp.gmail.com`  ·  Port: `587`
  - Username: `renvapp@gmail.com`  ·  Password: the App Password
- Limits: Gmail forces the from-address to renvapp@gmail.com (only the display name changes);
  ~500 emails/day free. v2: move to Resend / Amazon SES on `noreply@jihozla.uz` with SPF/DKIM.

Template variables: `{{ .ConfirmationURL }}`, `{{ .Token }}`, `{{ .SiteURL }}`, `{{ .Email }}`.

---

## Confirm signup
**Subject:** `Подтвердите регистрацию в Jihozla`

```html
<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#1a1a1a">
  <h1 style="font-size:22px;margin:0 0 12px;color:#00a961">Jihozla</h1>
  <p style="font-size:16px;line-height:1.5">Здравствуйте! Спасибо за регистрацию в Jihozla — приложении для проектирования кухонь.</p>
  <p style="font-size:16px;line-height:1.5">Подтвердите адрес электронной почты, чтобы начать:</p>
  <p style="margin:24px 0">
    <a href="{{ .ConfirmationURL }}" style="background:#00a961;color:#fff;text-decoration:none;padding:13px 26px;border-radius:10px;font-weight:600;display:inline-block">Подтвердить email</a>
  </p>
  <p style="font-size:13px;color:#777;line-height:1.5">Если кнопка не работает, откройте ссылку вручную:<br><a href="{{ .ConfirmationURL }}" style="color:#00794a">{{ .ConfirmationURL }}</a></p>
  <p style="font-size:13px;color:#777">Если вы не регистрировались в Jihozla, проигнорируйте это письмо.</p>
</div>
```

## Reset password
**Subject:** `Сброс пароля — Jihozla`

```html
<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#1a1a1a">
  <h1 style="font-size:22px;margin:0 0 12px;color:#00a961">Jihozla</h1>
  <p style="font-size:16px;line-height:1.5">Вы запросили сброс пароля для вашего аккаунта Jihozla.</p>
  <p style="margin:24px 0">
    <a href="{{ .ConfirmationURL }}" style="background:#00a961;color:#fff;text-decoration:none;padding:13px 26px;border-radius:10px;font-weight:600;display:inline-block">Задать новый пароль</a>
  </p>
  <p style="font-size:13px;color:#777;line-height:1.5">Если кнопка не работает, откройте ссылку вручную:<br><a href="{{ .ConfirmationURL }}" style="color:#00794a">{{ .ConfirmationURL }}</a></p>
  <p style="font-size:13px;color:#777">Если вы не запрашивали сброс, просто проигнорируйте это письмо — пароль останется прежним.</p>
</div>
```
