# Caching and Releases (QuatHub)

**Дата аудита:** 2026-09-16  
**Next.js:** 16.3.5 (App Router) · React 19.2

## Аудит текущего состояния

| Механизм | Факт |
|---|---|
| App Router | Да, `src/app` |
| `fetch` cache / `next.tags` | Почти не используется (данные через Prisma) |
| `unstable_cache` | Каталог: `src/modules/catalog/cached.ts` (tags + revalidate 60s) |
| `'use cache'` / `cacheTag` | Не включено глобально; API Next 16 доступны |
| `revalidatePath` / `updateTag` / `revalidateTag(tag, profile)` | Централизовано в `src/modules/cache/invalidate.ts` |
| Service Worker / PWA | Нет — не добавлялся |
| CDN | Нет; reverse proxy — Nginx на VPS |
| Proxy cache HTML | Не включён глобально (см. пример Nginx) |

Версии **раздельны**: `package.json` / `APP_VERSION`, Prisma migration name, `CatalogDataVersion`, `calculationPolicyVersion=commercial-v1`. Релиз UI не меняет `commercial-v1`.

## Cache tags

Определены в `src/modules/cache/tags.ts`:

- `catalog`, `sitemap`
- `category:<id>`, `region:<id>`, `item:<id>`, `offer:<id>`, `provider:<id>`
- `public-estimate:<linkId>` — id ссылки, не сырой token
- `organization-projects:<orgId>`

Секреты и PII в имена тегов не попадают.

## Инвалидация

После commit БД вызывается `invalidateCache`. В Server Actions — `updateTag` (read-your-own-writes). Вне action / background — `revalidateTag(tag, "max")` + `revalidatePath`.

При сбое revalidate создаётся `CacheInvalidationJob` (outbox). Повтор: `pnpm cache:retry` (`processPendingInvalidations`). Идемпотентно.

## Cache-Control

- `/app/*`, `/login`, auth/export API — `private, no-store`
- `/api/version`, `/api/health/*` — `no-store`
- `/_next/static/*` — `public, max-age=31536000, immutable`
- Публичный каталог — короткая revalidation (60s) + tag invalidation

## Клиентское обновление

`DeploymentWatcher` сравнивает `deploymentId` из `/api/version` (poll + visibility). При смене версии — баннер «Доступна новая версия». ChunkLoadError — один reload. Service worker отсутствует.

## Релизы

Сборка пишет `build-info.json` (`scripts/write-build-info.mjs`): `version`, `gitSha`, `buildTime`, `deploymentId`. Runtime **не** вызывает git.

Целевой pipeline: `deploy/ci.github-actions.yml` + `scripts/deploy-release.sh` (release-dir, migrate deploy, health check по `DEPLOYMENT_ID`). На текущем staging основной путь ещё может быть ручным/SSH; template описан в README.

## Nginx

Пример: `deploy/nginx-quat.esl.kz.conf.example` — без `proxy_cache` на authenticated HTML/API, уважение `Cache-Control`.

## Rollback

Откат приложения = предыдущий release-dir + restart. Миграции Prisma **не** откатываются автоматически. Seed в production не запускается.
