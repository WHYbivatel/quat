# QuatHub — Implementation Status

**Обновлено:** 2026-09-16  
**Текущий этап:** Промпт 7 завершён → далее Промпт 8

## 1. Состояние репозитория

| Факт | Значение |
|---|---|
| Админ | `/app/admin/*` (platform_admin) |
| Импорт | CSV/XLSX preview → commit; шаблон `/api/admin/import-template` |
| Audit | `AuditEvent` без секретов |
| Verification | источник + дата; файл ≠ verified |

## 2. Результаты этапов

### Промпт 0–6 ✅

### Промпт 7 — Админка и импорт прайсов ✅

**Сделано:**
- Справочники: категории, единицы, регионы, шаблоны; компании + verification; moderation queue; фильтры offers `stale` / `no_price`.
- Импорт: шаблон → upload → column mapping → preview с ошибками по строкам → commit только валидных (без needs_review) либо cancel; транзакция; `source=import`, moderation pending.
- Сопоставление: supplierSku → update; catalogSku / exact name+unit → match; похожее имя → needs_review (без авто-merge).
- Пустая цена → on_request (не 0); decimal comma; formula text sanitized; лимиты размера/строк; rate limit.
- Снимки смет не меняются при импорте.

**Проверено:**
- `pnpm test` 50/50; typecheck; lint; build OK.
- Повторный импорт обновляет цену без дубля; bad unit; comma; on_request; sku conflict; dangerous text; buyer denied; snapshot intact.

**Ограничения:**
- Импорт UI в MVP — у platform_admin (не отдельный кабинет поставщика).
- Регион из файла не привязывается к OfferRegion автоматически.
- Атрибуты категорий — просмотр через seed; отдельный CRUD атрибутов минимален.

## 3. Следующий этап

**Промпт 8:** аудит MVP, e2e-путь, README/пилот.

## 4. Журнал проверок

| Дата | Этап | Что проверено | Результат |
|---|---|---|---|
| 2026-09-16 | 0–6 | prep…requests | OK |
| 2026-09-16 | 7 | import/reimport, ACL, snapshot safety | OK |
