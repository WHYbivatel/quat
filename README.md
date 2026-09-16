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
pnpm db:migrate         # prisma migrate dev
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

Все цены в seed учебные (`isDemo=true`). Seed **не** запускать автоматически на production.

## Скрипты

| Команда | Назначение |
|---|---|
| `pnpm dev` | dev-сервер |
| `pnpm db:migrate` | миграции (dev) |
| `pnpm db:migrate:deploy` | миграции (prod/staging) |
| `pnpm db:seed` | демо-данные |
| `pnpm test` | интеграционные/юнит тесты |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm lint` | ESLint |
| `pnpm build` | production build (+ `build-info.json`) |
| `pnpm cache:retry` | повтор outbox инвалидации кэша |

## Релиз

1. CI на push/PR: typecheck, lint, test, build (`.github/workflows/ci.yml`).
2. Сборка пишет неизменяемый `build-info.json` (`APP_VERSION` / `GIT_SHA` / `BUILD_TIME` / `DEPLOYMENT_ID`).
3. Staging/prod: `pnpm db:migrate:deploy`, затем новая сборка; seed не автоматически.
4. Целевой VPS-путь: `scripts/deploy-release.sh` (отдельный release-dir + health по `DEPLOYMENT_ID`). Пока на quat.esl.kz допустим контролируемый SSH-деплой; in-place `git pull` не считать целевой моделью.
5. Rollback приложения = предыдущий release / предыдущий commit + restart **без** автоотката миграций БД.

## Как проверить текущую версию

- UI: подвал сайта или админка
- API: `GET /api/version` — appVersion, gitSha, deploymentId, schemaVersion, catalogDataVersion, calculationPolicyVersion
- Health: `GET /api/health/live`, `GET /api/health/ready`

## Кэш и обновление данных

См. `docs/CACHING_AND_RELEASES.md`. Публичный каталог кэшируется с тегами; мутации вызывают адресную инвалидацию. Приватные кабинеты — `private, no-store`. Service worker нет.

## Rollback

1. Вернуть предыдущий артефакт/release-dir или `git reset --hard <sha>` на стенде.
2. `systemctl restart quat.esl.kz` (или эквивалент).
3. Проверить `/api/health/ready` и `/api/version`.
4. Не выполнять destructive DB rollback автоматически.

## Документация

- `docs/PROJECT_BRIEF.md` — исходное задание и промпты
- `docs/PRD.md` — продукт и границы MVP
- `docs/ARCHITECTURE.md` — архитектура
- `docs/DATA_MODEL.md` — модель данных
- `docs/CACHING_AND_RELEASES.md` — кэш и релизы
- `docs/IMPLEMENTATION_STATUS.md` — статус этапов
- `CHANGELOG.md` — release notes

## Безопасность

- Не коммитьте `.env`
- Не публикуйте демо-пароли в production
- Не отправляйте реальные заявки из тестового окружения
