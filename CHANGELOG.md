# Changelog

## 0.2.0 — 2026-09-16

- Версионирование сборки: `APP_VERSION`, `GIT_SHA`, `BUILD_TIME`, `DEPLOYMENT_ID` (`build-info.json`)
- `/api/version`, `/api/health/live`, `/api/health/ready`
- Адресная инвалидация кэша каталога + outbox `CacheInvalidationJob`
- Баннер обновления при смене `deploymentId`
- CI workflow и шаблон release-dir deploy

## 0.1.0

- MVP: каталог, сметы, заявки, админка, публичные источники (7A)
