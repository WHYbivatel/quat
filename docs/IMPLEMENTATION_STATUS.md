# QuatHub — Implementation Status

**Обновлено:** 2026-09-16  
**Текущий этап:** Промпт 7B завершён → далее 8

## 1. Состояние репозитория

Стенд: https://quat.esl.kz · GitHub: WHYbivatel/quat · app `0.2.0`

## 2. Результаты этапов

### Промпт 0–7 ✅

### Промпт 7R ✅

### Промпт 7A — Публичные услуги/цены ✅

### Промпт 7B — Версии, кэш, деплой ✅

**Сделано:**
- `docs/CACHING_AND_RELEASES.md` — аудит Next 16.3.5
- `build-info.json` / `scripts/write-build-info.mjs` — APP_VERSION, GIT_SHA, BUILD_TIME, DEPLOYMENT_ID
- `/api/version`, `/api/health/live`, `/api/health/ready`
- Footer + admin version; `DeploymentWatcher`
- `cacheTags` + `invalidateCache` + `CacheInvalidationJob` outbox
- Каталог через `unstable_cache` (tags, 60s); мутации адресно инвалидируют
- Cache-Control headers в `next.config.ts`; пример Nginx
- CI `.github/workflows/ci.yml`; шаблон `scripts/deploy-release.sh`
- README: Релиз / версия / кэш / rollback; `CHANGELOG.md`
- Advisory lock на curated publish; SW не добавлялся

**Ограничения стенда:** полный release-dir pipeline — шаблон; текущий деплой ещё SSH. CDN purge — не используется.

## 3. Следующий этап

**8** — сквозная проверка MVP / пилот. Затем 9. Промпт 10 отдельно.

## 4. Журнал

| Дата | Этап | Результат |
|---|---|---|
| 2026-09-16 | 0–7 | OK |
| 2026-09-16 | 7R | OK |
| 2026-09-16 | 7A | OK |
| 2026-09-16 | 7B | OK — versioning + targeted cache invalidation |
