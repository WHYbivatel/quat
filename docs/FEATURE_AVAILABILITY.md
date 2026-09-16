# Feature Availability — QuatHub

Источник истины в коде: `src/modules/features/registry.ts`.  
Публично: [/capabilities](/capabilities) · API `GET /api/capabilities`.  
Админ: `/app/admin/capabilities`.

Статусы: **AVAILABLE** | **LIMITED** | **COMING_SOON** | **UNAVAILABLE_ENV** | **NO_PERMISSION** | **TEMPORARILY_UNAVAILABLE**.

| featureId | Название | Маршруты / API | Роли | Статус | Доказательство | UI | Ограничение | План |
|---|---|---|---|---|---|---|---|---|
| catalog.browse | Каталог | `/catalog/*` | все | AVAILABLE | e2e + catalog-search | Работает | — | — |
| catalog.public_prices | Публичные прайсы | `/catalog/services`, admin sources | все / admin | LIMITED | 7A curated + tests | Бейдж на услугах | Кураторский импорт, не партнёрство | 7A частично |
| catalog.auto_sync | Автосинхронизация | admin sources | admin | COMING_SOON | нет worker | UnavailableAction | Ручной republish | после договорённостей |
| auth.login | Вход/выход | `/login` | все | AVAILABLE | e2e | Работает | — | — |
| auth.password_reset | Восстановление пароля | login → coming-soon | — | COMING_SOON | нет flow | Ссылка «в разработке» | Сброс админом | — |
| draft.local | Локальный черновик | `/draft` | гость | AVAILABLE | hotfix + e2e | Работает | — | — |
| draft.import | Перенос черновика | `/app/import-draft` | auth | AVAILABLE | hotfix | Работает | — | — |
| project.create | Проекты | `/app/projects` | auth | AVAILABLE | 7R tests | Работает | — | — |
| estimate.edit | Редактор сметы | estimate routes | org | AVAILABLE | integration | Работает | — | — |
| estimate.issue | Выпуск версии | estimate + versions | org | AVAILABLE | hotfix + versions tests | Работает | — | — |
| estimate.export_draft_pdf | PDF черновика | `POST /api/exports/draft` | org | AVAILABLE | staging smoke | Кнопка | Без bump revision | — |
| estimate.export_draft_office | XLSX/DOCX/CSV черновика | draft API | org | AVAILABLE | exportDraftDocument | Кнопки в редакторе | — | — |
| estimate.export_version | Экспорт версии | version API + UI | org | AVAILABLE | exports.test | Кнопки на версии | — | — |
| estimate.public_link | Публичная ссылка | `/p/[token]` | org | AVAILABLE | versions tests | Работает | — | — |
| requests.inbox | Заявки с кабинетом | `/app/requests`, supplier | org | AVAILABLE | requests.test | Работает | — | — |
| requests.notify_email | Email/SMS | requests | — | LIMITED | LogNotificationAdapter | Бейдж + честный текст статуса | Только журнал | — |
| requests.external_no_cabinet | Внешняя без кабинета | create request | org | LIMITED | skipped test | Текст skipped | Без имитации доставки | — |
| supplier.offers | Кабинет поставщика | `/app/supplier/*` | supplier | AVAILABLE | UI + actions | Работает | — | — |
| admin.panel | Админ | `/app/admin` | platform_admin | AVAILABLE | requirePlatformAdmin | NO_PERMISSION при отказе | — | — |
| admin.import | Импорт прайса | `/app/admin/import` | admin | AVAILABLE | import-admin.test | Работает | — | — |
| storage.object | Object storage | — | — | UNAVAILABLE_ENV | .data local | Capabilities | Локальные файлы на стенде | 9 |
| i18n.kk | Полный қазақ UI | — | — | COMING_SOON | RU UI | Capabilities | Документы с кириллицей OK | после пилота |
| normative.kz | Нормативная смета РК | `/coming-soon` | — | COMING_SOON | нет модуля | Ссылка с главной | Только commercial-v1 | 10 |
| orders.payments | Заказы/оплата | — | — | COMING_SOON | нет UI кнопок | Только матрица | Заявки вне оплаты | 9+ |
| release.autodeploy | Автодеплой CI | admin version | admin | LIMITED | CACHING docs | Диагностика | SSH deploy, CI шаблон | 7B/9 |
| notifications.sms | SMS | — | — | COMING_SOON | log adapter | Capabilities | Журнал | — |

## Поиск заглушек (2026-09-16)

- `href="#"` / `TODO` UI-заглушек кнопок: не найдено.
- Email: log-адаптер → LIMITED, не «отправлено».
- Автосинк источников: COMING_SOON + UnavailableAction.
- Восстановление пароля: COMING_SOON на `/login`.

## Компоненты

- `FeatureStatusBadge`, `FeatureGate`, `UnavailableAction`
- Страницы: `/capabilities`, `/coming-soon`, `/app/admin/capabilities`
- Guard: `assertFeatureActionable` · probe `POST /api/features/probe`
