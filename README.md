# QuatHub

Портал товаров, услуг и коммерческих смет в энергетике Казахстана.

MVP: коммерческий расчёт + заявки без онлайн-оплаты. Нормативная ПСД не заявляется.

## Стек

- Next.js (App Router) + TypeScript
- PostgreSQL + Prisma
- Auth.js (credentials)
- Tailwind CSS
- Vitest

## Требования

- Node.js 20+ (проверено на 26)
- pnpm 9+
- PostgreSQL (локально)

## Быстрый старт

```bash
cp .env.example .env
# при необходимости поправьте DATABASE_URL

createdb quathub        # если ещё нет
pnpm install
pnpm approve-builds @prisma/client @prisma/engines prisma esbuild -y   # один раз на чистой машине
pnpm db:migrate         # prisma migrate dev — имя: init
pnpm db:seed
pnpm dev
```

Откройте http://localhost:3000

### Демо-учётки (только dev/test)

| Email | Пароль | Роль |
|---|---|---|
| buyer@demo.quathub.local | Demo1234! | сметчик покупателя |
| supplier1@demo.quathub.local | Demo1234! | поставщик |
| supplier2@demo.quathub.local | Demo1234! | поставщик |
| contractor@demo.quathub.local | Demo1234! | подрядчик |
| admin@demo.quathub.local | Demo1234! | platform admin |

Все цены в seed учебные (`isDemo=true`).

## Скрипты

| Команда | Назначение |
|---|---|
| `pnpm dev` | dev-сервер |
| `pnpm db:migrate` | миграции |
| `pnpm db:seed` | демо-данные |
| `pnpm test` | интеграционные/юнит тесты |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm lint` | ESLint |
| `pnpm build` | production build |

## Документация

- `docs/PROJECT_BRIEF.md` — исходное задание и промпты
- `docs/PRD.md` — продукт и границы MVP
- `docs/ARCHITECTURE.md` — архитектура
- `docs/DATA_MODEL.md` — модель данных
- `docs/IMPLEMENTATION_STATUS.md` — статус этапов

## Безопасность

- Не коммитьте `.env`
- Не публикуйте демо-пароли в production
- Не отправляйте реальные заявки из тестового окружения
