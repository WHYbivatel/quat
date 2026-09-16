# QuatHub — Calculation Rules (commercial-v1)

**Policy version:** `commercial-v1`  
**Дата:** 2026-09-16  
**Область:** коммерческая смета. Это **не** нормативная ПСД РК и не заявление об актуальных налоговых ставках.

Все денежные и количественные вычисления — `Decimal` (decimal.js), rounding mode **ROUND_HALF_UP**.  
В JSON/API Decimal передаётся **строкой**. JS `Number` для денег запрещён.

## 1. Входные сущности

### 1.1 Строка (`CalcLineInput`)

| Поле | Смысл |
|---|---|
| id | стабильный id строки |
| costType | equipment / material / labor / machinery / logistics / other |
| qty | требуемый объём работ/потребления (не увеличивается из‑за упаковки закупки) |
| unit | единица qty |
| purchase.unitPrice | входная цена за единицу закупки (может быть null) |
| purchase.vatMode | included / excluded / zero / not_specified |
| purchase.vatRate | ставка как доля процента, напр. `"12"`; null если not_specified |
| purchase.packQty / moq | кратность и минимум закупки |
| purchaseQtyOverride | явный закупаемый объём; иначе считается из qty+pack+moq |
| sale.unitPriceExVat | явная продажная цена ед. без НДС (ручная) |
| sale.markupPercent | наценка m на базу затрат; взаимно исключается с targetMargin |
| sale.targetMarginPercent | целевая маржа g &lt; 100; формула cost/(1−g/100) |
| sale.costBaseExVat | явная база затрат для наценки/маржи; иначе purchase ex-VAT × purchaseQty / qty |
| sale.vatMode / vatRate | выходной НДС строки |
| priceType | fixed / from / range / on_request |
| lineDiscountPercent / lineDiscountAmount | скидка строки (не оба одновременно; amount приоритетнее если задан) |
| includeInKnownTotal | false если цена неизвестна / on_request без допущения |
| assumptionNote | для from/range: текст допущения |

### 1.2 Общая скидка (`GlobalDiscount`)

- `amount` — сумма скидки в валюте сметы (без НДС).  
- `lineIds` — строки-участники (после строковых скидок).  
- Запрет: скидка &gt; суммы баз; отрицательные строки.

### 1.3 Начисление (`AdjustmentInput`)

- `type`: `amount` | `percent`  
- `value`  
- `baseLineIds` — база = суммы этих строк **после** строковых и общей скидки, **без** других начислений  
- `vatMode` / `vatRate` — выходной НДС начисления  
- `applyOrder` — возрастающий порядок; проценты не зависят друг от друга  
- Циклические базы и «процент от процента начислений» запрещены

### 1.4 Политика расчёта (`CalcContext`)

- `calculationPolicyVersion`: `"commercial-v1"`  
- `currency`: `"KZT"`  
- `inputVatRecoverable`: `true` | `false` | `unknown` — задаёт пользователь; не угадывается  
- `taxRuleDate` — дата зафиксированных налоговых параметров (информативно в результате)

## 2. Порядок операций

### Шаг A — Закупка и нормализация входной цены

1. Если `purchase.unitPrice == null` или `priceType ∈ {on_request}` без явной цены → строка **неизвестна** для известного подытога (`includeInKnownTotal = false`), если не задана ручная продажа.  
2. Нормализация к **без НДС** (`purchaseUnitExVat`):
   - `excluded` → цена как есть  
   - `zero` → цена как есть; ставка 0% — отдельное состояние от «без НДС»  
   - `included` + известная ставка r → `price / (1 + r/100)`  
   - `not_specified` → нельзя подтвердить ex-VAT; для внутреннего cost — `unknown`  
3. `purchaseQty`:
   - если override — он  
   - иначе: `ceil_to_pack(max(qty, moq ?? 0), packQty)`  
   - `ceil_to_pack(x, pack)`: если pack пуст/≤0 → x; иначе `ceil(x/pack)*pack`  
4. Объём работ `qty` **не** меняется из‑за `purchaseQty`.

### Шаг B — Продажная цена единицы без НДС

Приоритет (ровно один способ):

1. Если заданы **и** markup, **и** targetMargin → **ошибка валидации**.  
2. Ручная `sale.unitPriceExVat` → использовать.  
3. Иначе markup m: `unitSaleExVat = costBase × (1 + m/100)`.  
4. Иначе target margin g (g &lt; 100): `unitSaleExVat = costBase / (1 − g/100)`.  
5. Иначе если есть `purchaseUnitExVat` → принять её как продажную (перепродажа 1:1) для MVP preview.  
6. Иначе → неизвестная продажа.

`costBase` (на единицу qty):  
`sale.costBaseExVat` если задан, иначе при известной закупке  
`(purchaseUnitExVat × purchaseQty) / qty` (если qty &gt; 0).

Округление: `unitSaleExVatRounded = ROUND_HALF_UP(unitSaleExVat, 2)`.

### Шаг C — Сумма строки до общей скидки

1. `lineGross = unitSaleExVatRounded × qty` (точная промежуточная арифметика).  
2. Скидка строки:
   - если `lineDiscountAmount` → вычесть amount  
   - иначе если `lineDiscountPercent` → вычесть `lineGross × percent/100`  
3. `lineAfterLineDiscount = ROUND_HALF_UP(lineGross − discount, 2)`.  
4. Если результат &lt; 0 → **ошибка** (отрицательная строка запрещена).  
5. Если скидка &gt; lineGross → **ошибка**.

Строки с `includeInKnownTotal = false` не входят в базы общей скидки/начислений по умолчанию и не в «известную часть», но могут храниться в детализации как `unknown`.

### Шаг D — Общая скидка

1. База = сумма `lineAfterLineDiscount` по `GlobalDiscount.lineIds` (только known).  
2. Если `amount > база` → ошибка.  
3. Для каждой строки i: `share_i = ROUND_HALF_UP(amount × line_i / база, 2)`.  
4. Остаток `amount − Σ share` распределить по +0.01 / −0.01 детерминированно: сортировка lineIds lexicographically ascending, накапливать остаток по кругу пока |остаток| ≥ 0.01.  
5. `lineNet = lineAfterLineDiscount − allocated`.  
6. `Σ allocated === amount` (проверка).  
7. `lineNet < 0` → ошибка.

### Шаг E — Начисления

Для каждого adjustment по `applyOrder`:

- `amount`: `adjExVat = ROUND_HALF_UP(value, 2)`  
- `percent`: `base = Σ lineNet` по `baseLineIds` (known); `adjExVat = ROUND_HALF_UP(base × value/100, 2)`  
- База **не** включает другие adjustments.

### Шаг F — Выходной НДС

Для каждой known-строки и каждого начисления:

- `excluded` + rate r → `vat = ROUND_HALF_UP(net × r/100, 2)`  
- `included` — в MVP продажные суммы уже ex-VAT; `included` на выходе трактуем как ошибку конфигурации **или** выделяем налог: если по ошибке передали included, нормализуем net как gross и выделяем (предпочтительно валидировать и требовать excluded/zero/not_specified на продаже). **Политика v1:** для продажи допускаются `excluded`, `zero`, `not_specified`. `included` на sale → валидационная ошибка.  
- `zero` → vat = 0  
- `not_specified` → vat unknown; строка/начисление не даёт подтверждённый налог; известный подытог без этого НДС, флаг incomplete tax  

`totalOutputVat = Σ` известных vat.

### Шаг G — Итоги

- `linesExVat = Σ lineNet` (known)  
- `adjustmentsExVat = Σ adjExVat`  
- `grandTotal = linesExVat + adjustmentsExVat + totalOutputVat` — только если нет unknown обязательных данных и tax complete  
- Иначе: `knownSubtotal = linesExVat + adjustmentsExVat + knownVat` с меткой **«Известная часть стоимости»**, `complete = false`, `unknownLineCount`

Разбивки: по `costType`, по `vatMode`.

### Шаг H — Внутренний взгляд (не для client DTO)

- `purchaseCostExVat = Σ purchaseUnitExVat × purchaseQty` (known purchase)  
- Входной НДС: если recoverable=true — учитывается отдельно; false — в cost; unknown — profitability = `unavailable`  
- `contributionBeforeProfitTax = saleExVatSide − costSide` (явный состав)  
- Не называть «чистой прибылью».

## 3. Контрольный пример (учебные цены)

Без НДС (sale vatMode=zero), без скидок строк:

| Строка | qty | цена | сумма |
|---|---|---|---|
| Кабель | 100 | 800 | 80 000 |
| Монтаж | 100 | 350 | 35 000 |
| Доставка (adjustment amount) | — | 5 000 | 5 000 |
| **Итого** | | | **120 000** |

Скидка 10% только на кабель → кабель 72 000; монтаж 35 000; доставка 5 000; **итого 112 000**.

+ строка «Испытания, цена по запросу» → известная часть **112 000**, `complete=false`, `unknownLineCount=1`.

## 4. Версионирование

`CalcResult.calculationPolicyVersion` всегда `"commercial-v1"`.  
Смена порядка округления = новая версия политики, без тихой правки.

## 5. Что не делает движок

- Нормативные коэффициенты РК / российские нормы  
- Инженерный подбор сечений/токов  
- Угадывание возмещаемости НДС  
- Приём клиентского «итога» как истины
