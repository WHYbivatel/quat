# QuatHub — Implementation Status

**Обновлено:** 2026-09-16  
**Текущий этап:** Промпт 7A завершён → далее 7B

## 1. Состояние репозитория

Стенд: https://quat.esl.kz · GitHub: WHYbivatel/quat

## 2. Результаты этапов

### Промпт 0–7 ✅

### Промпт 7R — Исправления создания проекта / каталог / вход ✅

**Причина ERROR 3822074729 (подтверждена логами стенда):**  
`AccessDeniedError: Missing permission: project:write` — создание проекта под ролью без права (например `supplier_manager`), необработанное исключение → 500 Next.js digest.

**Исправлено:**
- Понятная RU-ошибка вместо 500; форма создания скрыта без `project:write`; подсказка сменить org / buyer.
- Idempotency key на создании проекта; переключатель организаций; создание org если нет membership.
- `/app` — ссылки на товары/услуги/проекты, не только форма.
- Логин: «В каталог», логотип на главную; если уже вошли — Продолжить / Выйти.
- Шапка: Выйти на desktop/mobile; org name; админ-ссылка только platform_admin.
- Пустая смета: «Выбрать товары/услуги»; кнопки + из списка проектов.
- Стабильный `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` (пример в `.env.example`).

**Проверено:** tests 53/53; typecheck; lint; build. Регресс: supplier denied, buyer idempotent, foreign orgId rejected.

### Промпт 7A — Публичные услуги/цены (SourceProvider) ✅

**Сделано:**
- Schema: `SourceProvider`, provenance на `Offer` / `PublicPriceListing`; миграция `20260916140000_public_price_sources`.
- Curated publish (ETL XXI ≥15, Elektrik24 ≥25), SSRF-safe HTTP, robots notes; autoSync=false.
- Admin `/app/admin/sources`; provenance на карточке позиции каталога.
- Docs: `docs/DATA_SOURCES.md`, `docs/data-sources/*.md`.
- Seed: cleanup + `publishCuratedPublicSources`.

**Проверено:** public-sources tests 6/6; typecheck; lint; build. Версии смет при publish не трогаются.

## 3. Следующий этап

**7B** — далее по плану. Затем 8 → 9.

## 4. Журнал

| Дата | Этап | Результат |
|---|---|---|
| 2026-09-16 | 0–7 | OK |
| 2026-09-16 | 7R | OK — root cause digest 3822074729 = project:write |
| 2026-09-16 | 7A | OK — curated public prices + SourceProvider |
