# Pilot readiness report (Prompt 8)

**Дата:** 2026-09-16  
**Стенд:** https://quat.esl.kz · app `0.2.0`  
**Вердикт:** коммерческий MVP пригоден для **закрытого пилота** на демо/согласованных данных. **Не** production-ready для открытых реальных пользователей.

## Что работает

- Каталог товаров/услуг, вход/выход, org/проект/смета, расчёт `commercial-v1`
- Версии, публичные ссылки, экспорт client/internal (закупка только internal)
- Заявки поставщикам с кабинетом; без кабинета — `notificationStatus=skipped`
- Публичные curated-прайсы ETL XXI / Elektrik24 (7A) + provenance
- Версии сборки, health, адресная инвалидация кэша (7B)
- Rate limits: login, export, import, public links, sources republish

## Что реально протестировано

| Слой | Результат |
|---|---|
| Vitest unit/integration | расчёт, каталог, 7R create, версии, заявки, import, public sources, cache, rate-limit, skipped notify |
| Playwright e2e | критический UI-путь: каталог → login → projects → services → logout; health/version |
| Staging smoke | `/api/health/*`, `/api/version`, HTTPS сайт |
| Backup restore drill | скрипт `restore-db-verify.sh` на отдельной БД |

Не заявляем полный ручной прогон всех edge-кейсов промпта 8 на каждом релизе; интеграционные тесты покрывают ядро.

## Источники цен

| Источник | Основание | Статус |
|---|---|---|
| Seed demo offers | учебные `isDemo` | только demo |
| ЭТЛ «XXI» | ручная курация с публичной страницы | published, не партнёр |
| Elektrik24 Алматы | ручная курация | published, не партнёр |
| Прочие из реестра 7A | — | не подключены |

Автопарсинг выключен; SSRF-guard в `sources/http.ts`.

## Ограничения до открытого запуска

- Демо-пароли на стенде
- CI workflow не в `.github/` (шаблон в `deploy/`)
- Деплой SSH in-place, не полный release-dir
- Уведомления — log only
- `.data/` на локальном диске
- Нет формального соглашения с поставщиками
- Rate limits in-memory (один инстанс)

## Перед размещением для реальных пользователей

См. `docs/PILOT_CHECKLIST.md` и промпт 9 (production infra).
