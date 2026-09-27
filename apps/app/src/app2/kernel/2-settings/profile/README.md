# profile — профиль цеха (SPEC S01, S05, M03)

Читает **те же файлы**, что и Полигон: `things/profiles/qorasu/def.json` и
`things/tables/junction-rank/def.json`. Второй копии чисел нет (P04).

- `QORASU` — профиль как данные: значение, единица, диапазон каждого поля.
- `envOf(profile)` — то, что нужно графу: толщина по ключу (с происхождением
  «profile:qorasu carcassThicknessMm = 16 мм») и правило остатка.
- `setValue(profile, key, value)` — **новый** профиль (старый не меняется). Вне диапазона →
  `REF-OUT-OF-RANGE`; точнее 0.1 мм → `REF-PRECISION`. Это M03: принимает её `reprofile` (G19).
- `runsThrough(profile, a, b)` — какая доска проходит насквозь на стыке двух ролей, по рангу
  (сейчас боковина 70 > дно 50 = крышка 50 → дно и крышка между боковинами). Стратегия — это
  таблица, а не код (DECISIONS §7, ENGINE_FINDINGS E5).
