# QuatHub — Implementation Status

**Обновлено:** 2026-09-16  
**Текущий этап:** Fix PDF Content-Disposition + version link → далее 9

## 1. Состояние репозитория

Стенд: https://quat.esl.kz · GitHub: WHYbivatel/quat · app `0.2.0`  
**Не production-ready** для открытого доступа.

## 2. Результаты этапов

### Feature Availability Audit ✅

### Fix: PDF Export failed + ссылка на версию ✅

**Причина `Export failed` на публичном стенде:** PDF генерировался успешно (файлы в `.data/exports` с именами `СМ-001_…`), но ответ падал на установке заголовка `Content-Disposition` с кириллицей — `TypeError: Cannot convert argument to a ByteString`. Клиент показывал сырое `Export failed`.

**Почему прежняя проверка не поймала:** смотрели сигнатуру `%PDF`/файл на диске, а не полный HTTP-ответ с кириллическим `filename` в Headers.

**Исправлено:**
- RFC 5987 `filename`/`filename*` без non-ASCII в ByteString
- Отдельный feedback у кнопок PDF и выпуска; русские тексты + requestId
- Ссылка «Открыть версию №N» как настоящий `<Link>`
- `/api/health/ready` → `checks.pdf`

## 3. Следующий этап

**9** — production-инфраструктура после закрытого пилота.

## 4. Журнал

| Дата | Этап | Результат |
|---|---|---|
| 2026-09-16 | Feature Availability Audit | OK |
| 2026-09-16 | Fix PDF ByteString + version link | OK |
