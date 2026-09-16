/**
 * Curated public price facts for first fill (Prompt 7A).
 * Prices checked manually against public pages; not provider_verified.
 * QuatHub is not affiliated with these organizations.
 */
export type CuratedRow = {
  key: string;
  name: string;
  unitCode: string;
  unitLabelRaw: string;
  priceType: "fixed" | "from" | "range" | "on_request";
  price?: string | null;
  priceMin?: string | null;
  priceMax?: string | null;
  taxStatus: "unknown" | "with_vat" | "without_vat" | "not_specified";
  requiresInspection?: boolean;
  note?: string;
};

export const ETL_XXI = {
  code: "etl-xxi",
  name: "ЭТЛ «XXI» (публичный прайс)",
  domain: "etlxxi.kz",
  websiteUrl: "https://etlxxi.kz/",
  sourceUrl: "https://etlxxi.kz/",
  regionNote: "Алматы и область",
  sourcePublishedAt: "2026-01-01T00:00:00.000Z",
  sourceKind: "provider_public_price" as const,
  verificationStatus: "source_checked" as const,
  rows: [
    { key: "etl-1", name: "Испытание монтажных поясов и привязей", unitCode: "pcs", unitLabelRaw: "услуга", priceType: "fixed", price: "7000", taxStatus: "with_vat" },
    { key: "etl-2", name: "Испытания лестниц и стремянок", unitCode: "pcs", unitLabelRaw: "услуга", priceType: "fixed", price: "10000", taxStatus: "with_vat" },
    { key: "etl-3", name: "Испытания УВН-10кВ", unitCode: "pcs", unitLabelRaw: "услуга", priceType: "fixed", price: "5000", taxStatus: "with_vat" },
    { key: "etl-4", name: "Испытания УНН-0,4кВ", unitCode: "pcs", unitLabelRaw: "услуга", priceType: "fixed", price: "5000", taxStatus: "with_vat" },
    { key: "etl-5", name: "Испытания диэлектрических перчаток", unitCode: "pcs", unitLabelRaw: "услуга", priceType: "fixed", price: "5000", taxStatus: "with_vat" },
    { key: "etl-6", name: "Испытания диэлектрических бот", unitCode: "pcs", unitLabelRaw: "услуга", priceType: "fixed", price: "5000", taxStatus: "with_vat" },
    { key: "etl-7", name: "Испытания диэлектрического инструмента", unitCode: "pcs", unitLabelRaw: "услуга", priceType: "fixed", price: "1000", taxStatus: "with_vat" },
    { key: "etl-8", name: "Испытания в.в. фазировщика", unitCode: "pcs", unitLabelRaw: "услуга", priceType: "fixed", price: "7000", taxStatus: "with_vat" },
    { key: "etl-9", name: "Испытания н.н. фазировщика", unitCode: "pcs", unitLabelRaw: "услуга", priceType: "fixed", price: "5000", taxStatus: "with_vat" },
    { key: "etl-10", name: "Испытания диэлектрических галош", unitCode: "pcs", unitLabelRaw: "услуга", priceType: "fixed", price: "5000", taxStatus: "with_vat" },
    { key: "etl-11", name: "Испытания в.в. оперативных штанг", unitCode: "pcs", unitLabelRaw: "услуга", priceType: "fixed", price: "5000", taxStatus: "with_vat" },
    { key: "etl-12", name: "Испытания диэлектрических ковриков", unitCode: "pcs", unitLabelRaw: "услуга", priceType: "fixed", price: "5000", taxStatus: "with_vat" },
    { key: "etl-13", name: "Испытания н.в. оперативных штанг", unitCode: "pcs", unitLabelRaw: "услуга", priceType: "fixed", price: "5000", taxStatus: "with_vat" },
    { key: "etl-14", name: "Испытания масло на пробой / сокращённый анализ", unitCode: "pcs", unitLabelRaw: "услуга", priceType: "range", priceMin: "35000", priceMax: "55000", taxStatus: "with_vat" },
    { key: "etl-15", name: "Испытания силового трансформатора", unitCode: "pcs", unitLabelRaw: "услуга", priceType: "fixed", price: "90000", taxStatus: "with_vat" },
    { key: "etl-16", name: "Испытания КЛ-6/10кВ", unitCode: "cable_line", unitLabelRaw: "кабельная линия", priceType: "fixed", price: "50000", taxStatus: "with_vat" },
    { key: "etl-17", name: "Испытания КЛ-0,4кВ", unitCode: "cable_line", unitLabelRaw: "кабельная линия", priceType: "fixed", price: "25000", taxStatus: "with_vat" },
    { key: "etl-18", name: "Поиск повреждения КЛ-0,4/6/10кВ / уточнение места", unitCode: "pcs", unitLabelRaw: "услуга", priceType: "range", priceMin: "45000", priceMax: "90000", taxStatus: "with_vat", note: "поиск 90000 / уточнение 45000" },
    { key: "etl-19", name: "Определение трассы КЛ-0,4/6/10кВ", unitCode: "pcs", unitLabelRaw: "услуга", priceType: "fixed", price: "55000", taxStatus: "with_vat" },
    { key: "etl-20", name: "Измерение контура заземления", unitCode: "contour", unitLabelRaw: "контур", priceType: "fixed", price: "45000", taxStatus: "with_vat" },
    { key: "etl-21", name: "Испытания РУ-6/10кВ", unitCode: "pcs", unitLabelRaw: "услуга", priceType: "fixed", price: "80000", taxStatus: "with_vat" },
    { key: "etl-22", name: "Испытания РУ-0,4кВ", unitCode: "pcs", unitLabelRaw: "услуга", priceType: "fixed", price: "55000", taxStatus: "with_vat" },
    { key: "etl-23", name: "Услуги тепловизионного обследования", unitCode: "pcs", unitLabelRaw: "услуга", priceType: "on_request", taxStatus: "with_vat" },
    { key: "etl-24", name: "Прогрузка автоматических выключателей и УЗО", unitCode: "pcs", unitLabelRaw: "услуга", priceType: "on_request", taxStatus: "with_vat" },
    { key: "etl-25", name: "Замеры сопротивления изоляции; измерения петля-фаза", unitCode: "pcs", unitLabelRaw: "услуга", priceType: "on_request", taxStatus: "with_vat" },
  ] satisfies CuratedRow[],
};

export const ELEKTRIK24 = {
  code: "elektrik24-almaty",
  name: "Elektrik24 Алматы (публичный прайс)",
  domain: "elektrik24almaty.kz",
  websiteUrl: "https://elektrik24almaty.kz/",
  sourceUrl:
    "https://elektrik24almaty.kz/rastcenki-na-lektromontazhnye-raboty-v-almaty-2019",
  regionNote: "Алматы",
  sourcePublishedAt: "2026-01-01T00:00:00.000Z",
  sourceKind: "provider_public_price" as const,
  verificationStatus: "source_checked" as const,
  rows: [
    { key: "e24-visit", name: "Выезд мастера / смета / консультация (Алматы)", unitCode: "visit", unitLabelRaw: "выезд", priceType: "range", priceMin: "1000", priceMax: "6000", taxStatus: "unknown" },
    { key: "e24-no-voltage", name: "Выявление причины отсутствия напряжения в сети", unitCode: "pcs", unitLabelRaw: "услуга", priceType: "range", priceMin: "5000", priceMax: "8000", taxStatus: "unknown" },
    { key: "e24-emergency", name: "Аварийный вызов электрика (20:00–04:00)", unitCode: "visit", unitLabelRaw: "выезд", priceType: "from", priceMin: "8000", taxStatus: "unknown" },
    { key: "e24-panel-12-in", name: "Установка щита встраиваемого, 12 модуля, бетон/кирпич", unitCode: "pcs", unitLabelRaw: "шт.", priceType: "fixed", price: "8200", taxStatus: "unknown" },
    { key: "e24-panel-24-in", name: "Установка щита встраиваемого, 24 модуля, бетон/кирпич", unitCode: "pcs", unitLabelRaw: "шт.", priceType: "fixed", price: "15600", taxStatus: "unknown" },
    { key: "e24-panel-36-in", name: "Установка щита встраиваемого, 36 модуля, бетон/кирпич", unitCode: "pcs", unitLabelRaw: "шт.", priceType: "fixed", price: "20100", taxStatus: "unknown" },
    { key: "e24-panel-54-in", name: "Установка щита встраиваемого, 54 модуля, бетон/кирпич", unitCode: "pcs", unitLabelRaw: "шт.", priceType: "fixed", price: "31900", taxStatus: "unknown" },
    { key: "e24-panel-12-out", name: "Установка щита накладного, 12 модуля", unitCode: "pcs", unitLabelRaw: "шт.", priceType: "fixed", price: "6500", taxStatus: "unknown" },
    { key: "e24-panel-24-out", name: "Установка щита накладного, 24 модуля", unitCode: "pcs", unitLabelRaw: "шт.", priceType: "fixed", price: "8500", taxStatus: "unknown" },
    { key: "e24-panel-36-out", name: "Установка щита накладного, 36 модуля", unitCode: "pcs", unitLabelRaw: "шт.", priceType: "fixed", price: "8500", taxStatus: "unknown" },
    { key: "e24-panel-54-out", name: "Установка щита накладного, 54 модуля", unitCode: "pcs", unitLabelRaw: "шт.", priceType: "fixed", price: "11000", taxStatus: "unknown" },
    { key: "e24-strobe-b15", name: "Штробление бетонных стен (штроба до 15×20 мм)", unitCode: "m", unitLabelRaw: "п.м.", priceType: "fixed", price: "1120", taxStatus: "unknown" },
    { key: "e24-strobe-b30", name: "Штробление бетонных стен (штроба до 30×30 мм)", unitCode: "m", unitLabelRaw: "п.м.", priceType: "fixed", price: "1280", taxStatus: "unknown" },
    { key: "e24-strobe-b20x50", name: "Штробление бетонных стен (штроба до 20×50 мм)", unitCode: "m", unitLabelRaw: "п.м.", priceType: "fixed", price: "1800", taxStatus: "unknown" },
    { key: "e24-strobe-brick20", name: "Штробление кирпичных/блочных стен (20×20 мм)", unitCode: "m", unitLabelRaw: "п.м.", priceType: "fixed", price: "800", taxStatus: "unknown" },
    { key: "e24-strobe-brick50", name: "Штробление кирпичных/блочных стен (20×50 мм)", unitCode: "m", unitLabelRaw: "п.м.", priceType: "fixed", price: "1500", taxStatus: "unknown" },
    { key: "e24-point-mono", name: "Монтаж точки (подрозетник) в монолите", unitCode: "point", unitLabelRaw: "точка", priceType: "fixed", price: "3600", taxStatus: "unknown" },
    { key: "e24-point-brick", name: "Монтаж точки выключателя в кирпиче", unitCode: "point", unitLabelRaw: "точка", priceType: "fixed", price: "4600", taxStatus: "unknown" },
    { key: "e24-point-gkl", name: "Монтаж точки выключателя в ГКЛ", unitCode: "point", unitLabelRaw: "точка", priceType: "fixed", price: "2200", taxStatus: "unknown" },
    { key: "e24-box-mono", name: "Отверстие под распределительную коробку в монолите", unitCode: "pcs", unitLabelRaw: "шт.", priceType: "fixed", price: "6300", taxStatus: "unknown" },
    { key: "e24-box-brick", name: "Отверстие под распределительную коробку в кирпиче", unitCode: "pcs", unitLabelRaw: "шт.", priceType: "fixed", price: "4000", taxStatus: "unknown" },
    { key: "e24-box-gkl", name: "Отверстие под распределительную коробку в ГКЛ", unitCode: "pcs", unitLabelRaw: "шт.", priceType: "fixed", price: "3400", taxStatus: "unknown" },
    { key: "e24-box-surface", name: "Монтаж накладной распределительной коробки", unitCode: "pcs", unitLabelRaw: "шт.", priceType: "fixed", price: "1300", taxStatus: "unknown" },
    { key: "e24-box-wire", name: "Расключение распределительной коробки", unitCode: "pcs", unitLabelRaw: "шт.", priceType: "from", priceMin: "2500", taxStatus: "unknown", requiresInspection: true },
    { key: "e24-socket-in", name: "Установка внутренней розетки/выключателя в готовое отверстие", unitCode: "pcs", unitLabelRaw: "шт.", priceType: "from", priceMin: "900", taxStatus: "unknown" },
    { key: "e24-socket-out", name: "Установка наружной розетки/выключателя", unitCode: "pcs", unitLabelRaw: "шт.", priceType: "from", priceMin: "800", taxStatus: "unknown" },
    { key: "e24-replace-point", name: "Демонтаж/замена старой электроточки", unitCode: "pcs", unitLabelRaw: "шт.", priceType: "fixed", price: "400", taxStatus: "unknown" },
    { key: "e24-end-points", name: "Подключение конечных точек потребителей", unitCode: "pcs", unitLabelRaw: "шт.", priceType: "from", priceMin: "1000", taxStatus: "unknown" },
    { key: "e24-tray-5x10", name: "Монтаж лотков (5×10 мм)", unitCode: "m", unitLabelRaw: "п.м.", priceType: "fixed", price: "1800", taxStatus: "unknown" },
    { key: "e24-tray-5x40", name: "Монтаж лотков (5×40 мм)", unitCode: "m", unitLabelRaw: "п.м.", priceType: "fixed", price: "2700", taxStatus: "unknown" },
    { key: "e24-cable-tray-35p", name: "Укладка силового кабеля в лотке, сечением от 35 мм²", unitCode: "m", unitLabelRaw: "п.м.", priceType: "fixed", price: "1000", taxStatus: "unknown" },
    { key: "e24-cable-tray-35m", name: "Укладка кабеля в лотке, сечением до 35 мм²", unitCode: "m", unitLabelRaw: "п.м.", priceType: "fixed", price: "600", taxStatus: "unknown" },
    { key: "e24-cable-corrug-fix", name: "Прокладка кабеля в гофре с креплением", unitCode: "m", unitLabelRaw: "п.м.", priceType: "fixed", price: "700", taxStatus: "unknown" },
    { key: "e24-cable-corrug", name: "Прокладка кабеля в гофре без креплений", unitCode: "m", unitLabelRaw: "п.м.", priceType: "fixed", price: "600", taxStatus: "unknown" },
    { key: "e24-cable-strobe", name: "Прокладка кабеля в подготовленной штробе", unitCode: "m", unitLabelRaw: "п.м.", priceType: "fixed", price: "320", taxStatus: "unknown" },
    { key: "e24-cable-channel", name: "Прокладка кабеля в кабельном канале", unitCode: "m", unitLabelRaw: "п.м.", priceType: "from", priceMin: "600", taxStatus: "unknown" },
    { key: "e24-cable-open", name: "Прокладка кабеля открытого типа без крепления", unitCode: "m", unitLabelRaw: "п.м.", priceType: "fixed", price: "300", taxStatus: "unknown" },
    { key: "e24-cable-pnd", name: "Прокладка кабеля в ПНД трубе", unitCode: "m", unitLabelRaw: "п.м.", priceType: "fixed", price: "800", taxStatus: "unknown" },
    { key: "e24-light-ceil", name: "Установка светильника потолочного типа (плафоны, люстры)", unitCode: "pcs", unitLabelRaw: "шт.", priceType: "from", priceMin: "1200", taxStatus: "unknown" },
    { key: "e24-light-wall", name: "Установка настенных светильников (бра, плафоны)", unitCode: "pcs", unitLabelRaw: "шт.", priceType: "from", priceMin: "1000", taxStatus: "unknown" },
    { key: "e24-light-arm", name: "Установка светильника в подвесной потолок «Армстронг»", unitCode: "pcs", unitLabelRaw: "шт.", priceType: "from", priceMin: "1300", taxStatus: "unknown" },
    { key: "e24-light-lpo", name: "Монтаж и подключение светильников типа ЛПО", unitCode: "pcs", unitLabelRaw: "шт.", priceType: "fixed", price: "1200", taxStatus: "unknown" },
    { key: "e24-light-street", name: "Монтаж и подключение уличных светильников", unitCode: "pcs", unitLabelRaw: "шт.", priceType: "fixed", price: "2000", taxStatus: "unknown" },
    { key: "e24-light-high", name: "Монтаж светильников на высоте более 3 м", unitCode: "pcs", unitLabelRaw: "шт.", priceType: "from", priceMin: "4000", taxStatus: "unknown", requiresInspection: true },
    { key: "e24-spot-hole", name: "Подготовка отверстия под точечный светильник (спот)", unitCode: "pcs", unitLabelRaw: "шт.", priceType: "fixed", price: "900", taxStatus: "unknown" },
    { key: "e24-spot-conn", name: "Подключение точечного светильника (спот)", unitCode: "pcs", unitLabelRaw: "шт.", priceType: "from", priceMin: "700", taxStatus: "unknown" },
    { key: "e24-chandelier", name: "Сборка люстр (в зависимости от сложности)", unitCode: "pcs", unitLabelRaw: "шт.", priceType: "from", priceMin: "1200", taxStatus: "unknown", requiresInspection: true },
  ] satisfies CuratedRow[],
};
