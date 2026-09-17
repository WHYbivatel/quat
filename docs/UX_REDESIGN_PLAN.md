# QuatHub UX Redesign — Plan (UX-1)

Дата аудита: 2026-09-17. Источник требований: `docs/UX_REDESIGN_BRIEF.md`.  
Инфраструктурные этапы 9/10 **не** входят в scope. Расчёты, ACL, ревизии, экспорт — сохранить.

## 1. Карта маршрутов (факт)

| Маршрут | Роль | Сейчас | Целевое |
|---|---|---|---|
| `/` | все | лендинг + поиск + ссылки на future | свернуть: CTA в рабочую область каталог+смета |
| `/catalog/products` | все | таблица, только «Открыть» | **оставить маршрут**; встроить Workspace (каталог\|смета) |
| `/catalog/services` | все | то же | то же, сегмент «Услуги» |
| `/catalog/items/[id]` | все | карточка + AddToEstimate | **свернуть**: опциональный drawer; add из списка |
| `/draft` | гость | отдельная страница черновика | **перенести** панель сметы в workspace; `/draft` → redirect |
| `/app/import-draft` | auth | перенос guest → org | **оставить** логику; UI компактный шаг при сохранении |
| `/app/projects` | auth | «Мои проекты» + создание | переименовать UX в «Мои сметы»; Project entity **оставить** |
| `/app/projects/.../estimates/[id]` | org | EstimateWorkspace 3 колонки | **оставить URL**; UI → тот же Workspace |
| `/login` | все | форма | UI kit; компактный контейнер |
| `/app/requests`, `/app/supplier/*` | роли | в верхнем баре у всех auth | **перенести** в меню аккаунта по роли |
| `/app/admin/*` | admin | в баре у admin | меню аккаунта |
| `/capabilities`, `/coming-soon` | все | в шапке «Возможности» / стенд | **убрать из UI** покупателя; admin/capabilities OK |
| `/p/[token]`, `/app/versions/*` | — | работают | стиль UI kit; тексты без техкодов |
| `/ui` (новый) | dev/admin | нет | внутренняя страница UI kit |

## 2. Компоненты и данные

### Каталог
- `CatalogPage` + `CatalogFilters` + `cachedSearchCatalogItems` — **оставить** серверный поиск.
- Список: сейчас только Link «Открыть» → **перенести** add на строку (`AddToEstimateButton` / новый `CatalogRow`).
- `AddToEstimateButton`: guest → localStorage; auth → `addToEstimateAction` **и redirect** на редактор — **изменить**: stay on workspace, merge qty, без обязательного выбора проекта на каждое add.
- Атрибут `poles` в seed: `nameRu: "Полюса"` → исправить на **«Число полюсов»** (данные/seed + отображение).

### Черновик / смета
- Guest: `quathub.guestDraft.v1` — **оставить** ключ; добавить updateQty/merge одинаковых offer; stepper.
- Server: `src/modules/estimates/draft.ts`, `editor.ts`, actions в `estimate.ts` — **оставить** revision/idempotency; адаптировать qty stepper к `updateLineQtyAction` / `saveLineFieldsAction` без UI цен.
- `EstimateWorkspace` — **переписать UI** (не движок): убрать meta-форму с экрана, ручные цены, OK, manual line, adjustments UI, постоянную историю; итог внутри панели; меню «Скачать» / «⋯».

### Экспорт
- `POST /api/exports/draft`, version export — **оставить**.
- PDF primary; XLSX/DOCX/CSV в dropdown; issue version → «Зафиксировать версию» в ⋯.
- Feedback PDF рядом с кнопкой — уже частично есть; унифицировать с toast (UX-6).

### Навигация
- `SiteHeader`: сейчас Товары|Услуги|Мои проекты|Заявки|Поставщик|Входящие|Возможности|email|Выйти.
- Цель: QuatHub | Каталог | Мои сметы | Аккаунт▾ / Войти.

## 3. Блоки UI: оставить / свернуть / перенести / убрать

| Блок | Решение | Куда |
|---|---|---|
| Поиск + категория | оставить | toolbar workspace |
| Товары / Услуги как отдельные страницы в меню | свернуть | SegmentedControl в каталоге; один пункт «Каталог» |
| Кнопка «Применить» фильтров | убрать из UI | автоприменение (+ debounce поиска) |
| «Открыть» карточку из списка | свернуть | «Подробнее» → drawer; Add не триггерит |
| Выбор проекта на каждое add | перенести | только при первом save в аккаунт |
| Redirect после add | убрать | остаёмся на workspace |
| Meta title/object/client/terms сверху | перенести | «Данные для документа» |
| proposalStatus + «Сохранить реквизиты» | убрать из UI | данные в БД сохранить |
| qty/price/discount textbox + OK | убрать | QuantityStepper; цена текстом |
| unitPurchasePrice колонка | убрать из UI | internal details при необходимости |
| Ручная строка | убрать из обычного пути | API/данные не удалять |
| Дублировать раздел / начисления UI | убрать из UI | расчёт adjustments сохранить |
| Третья колонка «Итог» | свернуть | низ панели сметы |
| 4 кнопки экспорта | свернуть | «Скачать смету ▾» |
| История версий постоянно | перенести | меню ⋯ |
| commercial-v1 / revision в UI | убрать | admin/diagnostics |
| Заявки/Поставщик/Входящие/Возможности в баре | перенести / убрать | меню по роли / capabilities только admin |
| max-w-6xl на рабочем экране | убрать | wide layout ~viewport − 20–32px |
| Teal `#0f766e` primary + white text | убрать | Arctic Lime `#D9FE54` + dark text |
| Source Serif display на рабочих экранах | убрать | единый sans (Manrope уже есть) |
| Toast система | нет | создать (UX-6) |

## 4. Сохранение данных старых смет

- Не слать пустые поля meta/adjustments при partial UI: saveMeta только из панели «Данные для документа»; qty-only через `updateLineQtyAction`.
- `unitSalePrice` / `discountPercent` snapshot: не трогать при смене qty; не показывать editor; бейдж «Индивидуальные условия» если отличаются от offer.
- Issued versions / public links — без изменений API.
- Guest draft clear только после confirmed import.

## 5. Wireframe

### Desktop ≥1200px
```
[QuatHub] [Каталог] [Мои сметы]                    [Аккаунт ▾]
[search…………] [Товары|Услуги] [Фильтры]
──────────────────────────┬────────────────────────
 Catalog ~60%             │ Estimate ~40% (min ~380)
 rows + [Добавить]        │ lines − N + · sum · del
 independent scroll       │ ─────────────────────
                          │ Итого · [Скачать ▾] · ⋯
                          │ статус «Сохранено»
```

### Mobile ~390px
```
header compact
catalog full height
────────────────
[ Смета · N · sum ₸ ]  ← sticky bottom; opens sheet
```

## 6. UI kit — перечень (UX-2)

Токены из brief §6. Компоненты в `src/components/ui/`:
Button, Input, SearchInput, Select, Textarea, QuantityStepper, CatalogRow, EstimateLine, Price, Summary, SegmentedControl, FilterChip, Menu, Drawer/Sheet, Dialog, Tooltip, Badge, EmptyState, InlineFeedback, Toast (+ provider).

Страница `/ui` — не в меню покупателя.

## 7. Карта обработчиков

| UI действие | Handler | Изменение |
|---|---|---|
| Add из списка (guest) | `useGuestDraft.add` | merge same catalogItemId+offerId+unit |
| Add (auth, есть active draft) | новый/расширенный action | без redirect; return line+revision |
| Add (auth, нет проекта) | локально + soft prompt | как brief |
| Qty ± | `updateLineQtyAction` / guest setQty | stepper, hold/+10 |
| Remove | `removeLineAction` / guest.remove | undo via toast (UX-6) |
| Download PDF | draft export API | menu formats |
| Issue version | `issueVersionAction` | меню ⋯ |
| Import guest | `importGuestDraftAction` | после login |

## 8. FEATURE_AVAILABILITY — актуальность

Проверено по коду + стенду `https://quat.esl.kz` (2026-09-17):

- Каталог products: **AVAILABLE**, 32 позиции, только «Открыть» (нет Add в списке).
- Header перегружен ролевыми ссылками даже у buyer-сессии на стенде.
- PDF/export/versions/draft/import — по registry **AVAILABLE**; не откатывать по старым датам.
- `catalog.public_prices` LIMITED — кураторские источники; бейдж убрать с основного пути покупателя (честность → capabilities/admin).
- Toast-библиотеки нет; уведомления — inline текст / DeploymentWatcher.

Полная матрица остаётся в `docs/FEATURE_AVAILABILITY.md`; обновление статусов UI — UX-7.

## 9. Порядок реализации

1. **UX-2** — токены + ui/* + `/ui`
2. **UX-3** — SiteHeader + Workspace shell + wide layout + merge catalog routes UX
3. **UX-4** — one-click add + stepper sync + guest merge
4. **UX-5** — simplify EstimateWorkspace + forms + download menu
5. **UX-6** — Toast graphite + React Bits-compatible motion
6. **UX-7** — cleanup menus, honest unavailable, migrate leftover pages
7. **UX-8** — acceptance, tests, report

## 10. Риски

- `addToEstimateAction` создаёт/открывает estimate и редиректит — нужна ветка «active workspace estimate» без navigation.
- Дубли guest lines при каждом add — исправить merge в UX-4.
- Скрытые adjustments влияют на grandTotal — показать в «Что входит в сумму».
- Не менять financial engine / ACL tests поведение.
