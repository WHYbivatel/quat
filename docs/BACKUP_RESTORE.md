# Backup and restore

## Окружение

| Переменная | Назначение |
|---|---|
| `DATABASE_URL` | Postgres приложение |
| `DATABASE_URL_TEST` | Тесты Vitest |
| `AUTH_SECRET` | Auth.js |
| `AUTH_URL` | Публичный URL |
| `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` | Стабильный ключ Server Actions |
| `APP_VERSION` / `GIT_SHA` / `DEPLOYMENT_ID` / `BUILD_TIME` | Опционально на CI/релизе |

Миграции: `pnpm db:migrate` (dev) / `pnpm db:migrate:deploy` (staging/prod).  
Seed только demo/test: `pnpm db:seed`.

## Backup

```bash
mkdir -p .data/backups
./scripts/backup-db.sh .data/backups/quathub-manual.dump
```

Формат: `pg_dump --format=custom`. Хранить вне web-root, с ограничением доступа.

## Restore verify (обязательно на отдельной БД)

```bash
./scripts/backup-db.sh /tmp/quathub-drill.dump
./scripts/restore-db-verify.sh /tmp/quathub-drill.dump quathub_restore_verify
```

Скрипт создаёт БД `quathub_restore_verify`, восстанавливает дамп, проверяет `prisma migrate status` и `SELECT COUNT(*) FROM organizations`.

**Не** восстанавливать поверх боевой БД «для проверки».

## Журнал ошибок

- Клиенту: русское сообщение + короткий ref (`publicErrorRef`), без stack/ПДн
- Серверу: `console.error` с ref; не логировать пароли, токены публичных ссылок целиком, cookies
- Уведомления MVP: `LogNotificationAdapter` — только служебные поля заявки

## Экспорты / импорты

Файлы сейчас в `.data/exports` и `.data/imports` на диске приложения. Для production (промпт 9) — вынести в приватное object storage.
