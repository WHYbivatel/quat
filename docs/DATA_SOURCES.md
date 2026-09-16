# QuatHub — публичные источники цен

**Обновлено:** 2026-09-16  
**Статус:** первое наполнение (Prompt 7A), manual curated

| Код | Источник | Домен | Способ | Разрешение автосбора | Частота | Поля | Последняя проверка |
|---|---|---|---|---|---|---|---|
| etl-xxi | ЭТЛ «XXI» | etlxxi.kz | manual curated from public page | robots.txt → 404; автосбор не включён | по запросу админа | name, unit, priceType, price*, tax with VAT, region Almaty | 2026-09-16 |
| elektrik24-almaty | Elektrik24 Алматы | elektrik24almaty.kz | manual curated from public page | robots Allow: *; автосбор пока выключен | по запросу админа | name, unit, priceType fixed/from/range, tax unknown | 2026-09-16 |

## Ограничения
- Не партнёрство и не `provider_verified`.
- Внешний SourceProvider не получает кабинет и не видит заявки.
- Агрегаторы рынка не подключены в этом этапе.
- Выпущенные EstimateVersion не пересчитываются при обновлении прайса.

Детали решений: `docs/data-sources/`.
