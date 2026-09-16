# QuatHub — Architecture

**Версия:** 0.1  
**Дата:** 2026-09-16  
**Статус:** подготовка (Промпт 0)

## 1. Состояние репозитория

Репозиторий инициализирован в Prompt 1 (модульный монолит в корне).

## 2. Стек (MVP)

| Слой | Выбор | Версия / примечание |
|---|---|---|
| Language | TypeScript (strict) | 5.9 |
| App | Next.js App Router | 16.3.5 |
| UI | Tailwind CSS (+ shadcn позже) | Tailwind 4; shadcn — с Prompt 2 |
| DB | PostgreSQL | локальный |
| ORM | Prisma | **6.19.0** (не RC 7/8) |
| Auth | Auth.js (next-auth) | 5.0.0-beta.32, credentials |
| Validation | Zod | 4.x |
| Money | decimal.js | 10.x; Decimal в JSON строками |
| PDF / XLSX / DOCX | Playwright / ExcelJS / docx | с Prompt 5 |
| Tests | Vitest | 3.2.x |
| Package manager | pnpm | 12.4.2, lockfile |

### Отклонения
- Prisma 6.x вместо последних RC: стабильные migrate + знакомый `schema.prisma` datasource url.

## 3. Архитектурный стиль

**Модульный монолит** в одном Next.js-приложении.

```
apps/web (или корень репо)
├── app/                 # маршруты App Router (UI + route handlers)
├── modules/             # доменные модули
│   ├── identity/
│   ├── organizations/
│   ├── catalog/
│   ├── offers/
│   ├── projects/
│   ├── estimates/
│   ├── pricing/         # CalcEngine — единственный расчёт
│   ├── exports/
│   ├── requests/
│   └── administration/
├── lib/                 # shared: db, auth, decimal, errors
├── prisma/
└── docs/
```

Микросервисы не вводятся без отдельного решения.

## 4. Доменные модули

| Модуль | Ответственность |
|---|---|
| identity | пользователи, сессии, auth adapters |
| organizations | компании, membership, роли/permissions, active org |
| catalog | категории, атрибуты, единицы, CatalogItem |
| offers | предложения поставщиков, сроки, НДС входа, наличие |
| projects | проекты, объект, регион, клиентские реквизиты |
| estimates | сметы, разделы, строки, версии, шаблоны, публичные ссылки |
| pricing | CalcEngine, политики округления, CalcResult |
| exports | артефакты PDF/XLSX/DOCX/CSV, очередь при необходимости |
| requests | заявки, строки, ответы поставщиков, idempotency |
| administration | модерация, импорт, справочники, audit |

### Правила зависимостей
- UI и route handlers вызывают application/services модулей.
- `pricing` не зависит от UI/exports; exports и estimates зависят от `pricing`.
- Доступ к данным — через серверные сервисы с проверкой membership/permission.
- Клиент получает DTO с явным allowlist полей (особенно client/public).

## 5. Ключевые инварианты (реализация)

1. CatalogItem ≠ Offer.  
2. Цена unknown → `null` + reason.  
3. Типы цены разделены enum’ом.  
4. Закупка/наценка/доходность не в client API.  
5. EstimateVersion = immutable snapshot (+ CalcResult).  
6. Документы одной версии из одного снимка.  
7. Предупреждение о дубле материал↔услуга; автоудаление запрещено.  
8. Входной НДС Offer ≠ выходной НДС продажи.  
9. Markup ≠ margin; отдельные формулы.  
10. Нет «чистой прибыли»; допустим «расчётный результат до налогов на прибыль».  
11. Demo flagged.  
12. Public link opt-in.

## 6. Авторизация и multi-tenancy

- Пользователь ∈ нескольких Organization через Membership.  
- Active organization выбирается в сессии/контексте и **проверяется на сервере**.  
- Permission = `(membership role ∪ action-scoped grants)`.  
- Каждый запрос к Project/Estimate/Request/Export проверяет org boundary.  
- Поставщик видит только RequestLine, адресованные его organizationId.

## 7. Расчёт и деньги

```
UI preview ──► CalcEngine ──► CalcResult
Server save/version/export ──► тот же CalcEngine
```

- Вход: строки, скидки, adjustments, tax policy version, packing/MOQ.  
- Выход: построчная детализация, известный подытог / полный итог, флаги incomplete.  
- Округление: ROUND_HALF_UP до 2 знаков на зафиксированных шагах (детали в `CALCULATION_RULES.md`, Prompt 3).  
- `calculationPolicyVersion` сохраняется в версии.

## 8. Экспорт и файлы

- Генерация только на сервере после authz.  
- Storage adapter: `LocalFsStorage` (dev) / `S3Storage` (prod).  
- Rate limit + размер; cleanup temp.  
- PDF: только локальные шаблоны/ассеты (без произвольных URL).  
- При больших документах: job `queued|running|ready|failed`.

## 9. Уведомления

```
NotificationPort
├── LogAdapter      # default MVP
└── EmailAdapter    # позже
```

Состояние заявки отделено от доставки уведомления.

## 10. i18n и время

- next-intl (или аналог): RU default, KK keys с первой итерации UI.  
- DB timestamps UTC (`timestamptz`).  
- Project.timezone default `Asia/Almaty`.

## 11. Окружения

| Env | Назначение |
|---|---|
| development | локальный Postgres, seed, demo users |
| test | ephemeral DB, интеграционные тесты |
| staging | после Prompt 9 |
| production | после согласования ПДн и пилота |

Секреты только в env; `.env.example` без секретов.

## 12. Порядок реализации (промпты)

| Этап | Результат |
|---|---|
| 0 | PRD, Architecture, Data Model, Status ← **сейчас** |
| 1 | App scaffold, Prisma schema/migrations, auth, orgs, seed, isolation tests |
| 2 | Каталог UI + карточки + фильтры + «В смету» |
| 3 | CalcEngine + CALCULATION_RULES + тесты |
| 4 | Проекты, редактор, версии, шаблоны, public link |
| 5 | Экспорт PDF/XLSX/DOCX/CSV |
| 6 | Кабинет поставщика, заявки, ответы |
| 7 | Админка, импорт прайсов |
| 8 | Аудит MVP, e2e, README, pilot checklist |
| 9 | Deploy plan (после пилота) |
| 10 | Исследование нормативной сметы (отдельно) |

## 13. Отклонения от брифа

Нет: стек совпадает с рекомендованным. Любые отклонения фиксируются здесь при изменении.
