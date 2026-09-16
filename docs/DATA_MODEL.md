# QuatHub — Data Model

**Версия:** 0.1  
**Дата:** 2026-09-16  
**Статус:** подготовка (Промпт 0)  
Деньги, количества, ставки, коэффициенты — `Decimal`/`Numeric`. В API Decimal → string.

## 1. ER-обзор (логические группы)

```
Identity / Orgs          Catalog / Offers              Projects / Estimates
─────────────────        ─────────────────             ─────────────────────
User                     Region / City                 Project
Organization             Category                      Estimate
Membership               AttributeDefinition           EstimateSection
Permission*              Unit                          EstimateLine
                         CatalogItem                   Adjustment
                         CatalogItemAttribute          EstimateVersion
                         Offer                         EstimateTemplate
                                                       PublicEstimateLink

Requests / Export        Admin
─────────────────        ─────
ProcurementRequest       AuditEvent
RequestLine              ImportJob*
SupplierResponse         ExportArtifact
```

\* Permission может быть enum на Membership + action checks; ImportJob — Prompt 7.

## 2. Identity & Organizations

### User
| Поле | Тип | Примечание |
|---|---|---|
| id | uuid | PK |
| email | citext unique | |
| name | string? | |
| locale | string | default `ru` |
| createdAt / updatedAt | timestamptz | UTC |

### Organization
| Поле | Тип | Примечание |
|---|---|---|
| id | uuid | |
| name | string | |
| type | enum | buyer / supplier / contractor / mixed |
| bin | string? | ИИН/БИН при наличии; не валидируем как «проверено» без источника |
| timezone | string | default Asia/Almaty |
| isDemo | boolean | |
| status | enum | active / suspended |

### Membership
| Поле | Тип | Примечание |
|---|---|---|
| id | uuid | |
| userId | fk | |
| organizationId | fk | |
| role | enum | owner / admin / estimator / buyer / supplier_manager / viewer |
| unique | (userId, organizationId) | |

Права проверяются сервером по role + действию. Компания mixed: пользователь может и закупать, и отвечать на заявки в рамках org.

## 3. Справочники каталога

### Region / City
Иерархия: Region → City. Города Казахстана для фильтра доставки/услуг.

### Unit
Код (`m`, `pcs`, `set`, …), название RU/KK, размерность.

### Category
Дерево категорий; `kind` product/service; `isNavigable` (пустые будущие вертикали скрыты).

### AttributeDefinition
Имя, тип (enum/number/text/boolean), `normalizedUnitId?`, категория(и), sortOrder.  
Числовые физ. величины хранятся нормализованно + отображаемая единица.

### CatalogItem
| Поле | Тип | Примечание |
|---|---|---|
| id | uuid | |
| kind | product \| service | |
| categoryId | fk | |
| name | string | |
| sku | string? | внутренний артикул платформы |
| model | string? | |
| baseUnitId | fk | |
| description | text? | |
| serviceScope | jsonb? | included/excluded/works/requiresSurvey |
| status | active \| archived | архив не ломает старые сметы |
| isDemo | boolean | |

### CatalogItemAttribute
itemId + attributeDefinitionId + value (typed jsonb) + normalizedValue?

## 4. Offers

### Offer
| Поле | Тип | Примечание |
|---|---|---|
| id | uuid | |
| supplierOrganizationId | fk | |
| catalogItemId | fk | |
| regionIds / cityIds | M2M или jsonb | зона поставки/услуг |
| priceType | enum | fixed / from / range / on_request |
| price | Decimal? | null если unknown/on_request |
| priceMin / priceMax | Decimal? | для range / from |
| currency | char(3) | KZT |
| inputVatMode | enum | included / excluded / zero / not_specified |
| inputVatRate | Decimal? | null если not_specified; synthetic в demo |
| unknownPriceReason | string? | |
| availability | enum | in_stock / made_to_order / limited / unknown |
| moq | Decimal? | |
| packQty | Decimal? | кратность/упаковка |
| leadTimeDays | int? | |
| source | string | manual / import / api |
| validFrom / validUntil | timestamptz? | |
| updatedAt | timestamptz | |
| moderationStatus | enum | draft / pending / approved / rejected |
| supplierSku | string? | unique (supplierId, supplierSku) |
| isDemo | boolean | |

**Правило:** изменение Offer не трогает EstimateVersion snapshot.

## 5. Projects & Estimates

### Project
| Поле | Тип | Примечание |
|---|---|---|
| id | uuid | |
| organizationId | fk | владелец |
| name | string | |
| cityId | fk? | |
| objectName / objectAddress | string? | |
| clientName / clientContacts | string?/jsonb | минимизация ПДн |
| description | text? | |
| assumptions | text? | |
| timezone | string | |
| status | active \| archived | |

### Estimate
| Поле | Тип | Примечание |
|---|---|---|
| id | uuid | |
| projectId | fk | |
| number | string | внутри org/project |
| title | string | |
| currency | KZT | |
| draftRevision | int | optimistic concurrency |
| status | draft \| … | рабочий статус документа |
| proposalStatus | prepared \| sent \| accepted \| declined | отдельно от версии |
| calculationPolicyVersion | string | на черновике текущая политика |

### EstimateSection
estimateId, title, sortOrder, costType hint?

### EstimateLine
| Поле | Тип | Примечание |
|---|---|---|
| id | uuid | |
| estimateId / sectionId | fk | |
| catalogItemId | fk? | nullable для ручных |
| offerId | fk? | выбранное предложение |
| sortOrder | int | |
| costType | equipment \| material \| labor \| machinery \| logistics \| other | |
| **snapshot** name, unit, … | strings | всегда заполнены |
| qty | Decimal | требуемый объём |
| purchaseQty | Decimal? | с учётом MOQ/pack |
| unitPurchasePrice | Decimal? | вход |
| purchaseVatMode/Rate | … | |
| unitSalePrice | Decimal? | |
| saleVatMode/Rate | … | |
| priceType / confirmationStatus | enum | |
| discountPercent / discountAmount | Decimal? | |
| markupPercent / targetMarginPercent | Decimal? | взаимоисключающие |
| supplierOrganizationId | fk? | snapshot id+name |
| sourceLabel / sourcedAt | | |
| manualOverrideReason | string? | |
| includedInServiceLineId | fk? | для контроля дублей |
| notesInternal | text? | только internal DTO |

### Adjustment
estimateId; name; type amount|percent; baseLineIds[]; tax mode; applyOrder; costType logistics/overhead/reserve/…

### EstimateVersion
| Поле | Тип | Примечание |
|---|---|---|
| id | uuid | |
| estimateId | fk | |
| versionNumber | int | |
| issuedAt / issuedBy | | |
| snapshot | jsonb | полный снимок строк, реквизитов, taxes, assumptions |
| calcResult | jsonb | CalcResult |
| calculationPolicyVersion | string | |
| documentKind | commercial_preliminary \| commercial_fixed | |
| immutable | true | |

Пересчёт старых версий новой логикой **запрещён**.

### EstimateTemplate
org-scoped или system; секции/строки с qty links и assumptions; 3 demo-шаблона в seed.

### PublicEstimateLink
versionId; token (crypto random); expiresAt; revokedAt; createdBy; noindex.

## 6. Requests

### ProcurementRequest
| Поле | Тип | Примечание |
|---|---|---|
| id | uuid | |
| buyerOrganizationId | fk | |
| supplierOrganizationId | fk | |
| estimateVersionId | fk | источник |
| status | draft \| submitted \| viewed \| responded \| accepted \| declined \| cancelled | |
| idempotencyKey | string unique | |
| objectInfoVisible | jsonb | согласованный минимум |
| createdAt | | |

### RequestLine
requestId; sourceEstimateLineId; snapshot name/qty/unit; **без** sale price / margin.

### SupplierResponse
requestId; version; proposed price/lead/availability; alternativeCatalogItemId?; message; createdAt.  
Не переписывает EstimateVersion.

## 7. Exports & Audit

### ExportArtifact
versionId или preliminarySnapshotId; format pdf|xlsx|docx|csv; variant client|internal; storageKey; status; createdBy; checksum.

### AuditEvent
actorUserId; organizationId?; entityType; entityId; action; before/after (без секретов); createdAt.

## 8. Индексы и ограничения (минимум)

- Membership (userId, organizationId) unique  
- Offer (supplierOrganizationId, supplierSku) unique where sku not null  
- Project (organizationId, …) + index organizationId  
- Estimate (projectId)  
- EstimateVersion (estimateId, versionNumber) unique  
- ProcurementRequest idempotencyKey unique  
- Partial indexes: active offers by catalogItemId + region  
- Check: price null ⇒ priceType in (on_request) OR unknownPriceReason not null  
- Check: не одновременно markupPercent и targetMarginPercent  
- Decimal ranges: qty ≥ 0, rates в допустимых границах политики

## 9. Soft-delete / archive

- CatalogItem/Offer: archive, не hard-delete при ссылках из версий.  
- Исторические снимки самодостаточны (названия и цены внутри snapshot).

## 10. Seed-требования (Prompt 1)

- Вымышленные orgs/users (buyer + 2 suppliers + 1 contractor + admin).  
- Города: минимум Алматы, Астана, Шымкент.  
- ≥30 товаров, ≥15 услуг, несколько offers на один item.  
- fixed / on_request / expired / разные VAT / pack / дробные qty.  
- Все цены `isDemo=true`, подпись «учебные».
