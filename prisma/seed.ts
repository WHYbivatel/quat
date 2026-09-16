import { PrismaClient, type CatalogItemKind, type PriceType, type VatMode } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

const DEMO_PASSWORD = "Demo1234!";

async function main() {
  console.log("Seeding QuatHub demo data (учебные цены)…");

  await prisma.auditEvent.deleteMany();
  await prisma.organizationVerification.deleteMany();
  await prisma.importJob.deleteMany();
  await prisma.exportArtifact.deleteMany();
  await prisma.supplierResponse.deleteMany();
  await prisma.requestLine.deleteMany();
  await prisma.procurementRequest.deleteMany();
  await prisma.publicEstimateLink.deleteMany();
  await prisma.estimateVersion.deleteMany();
  await prisma.adjustment.deleteMany();
  await prisma.estimateLine.deleteMany();
  await prisma.estimateSection.deleteMany();
  await prisma.estimate.deleteMany();
  await prisma.estimateTemplate.deleteMany();
  await prisma.project.deleteMany();
  await prisma.offerCity.deleteMany();
  await prisma.offerRegion.deleteMany();
  await prisma.offer.deleteMany();
  await prisma.catalogItemAttribute.deleteMany();
  await prisma.catalogItem.deleteMany();
  await prisma.categoryAttribute.deleteMany();
  await prisma.attributeDefinition.deleteMany();
  await prisma.category.deleteMany();
  await prisma.unit.deleteMany();
  await prisma.city.deleteMany();
  await prisma.region.deleteMany();
  await prisma.userSession.deleteMany();
  await prisma.membership.deleteMany();
  await prisma.organization.deleteMany();
  await prisma.user.deleteMany();

  const passwordHash = await hash(DEMO_PASSWORD, 10);

  const buyerOrg = await prisma.organization.create({
    data: {
      name: "ТОО ЭнергоМонтаж Демо",
      type: "buyer",
      bin: "000000000001",
      isDemo: true,
    },
  });
  const supplier1 = await prisma.organization.create({
    data: {
      name: "ТОО КабельСнаб Демо",
      type: "supplier",
      bin: "000000000002",
      isDemo: true,
    },
  });
  const supplier2 = await prisma.organization.create({
    data: {
      name: "ТОО ЭлектроКомплект Демо",
      type: "supplier",
      bin: "000000000003",
      isDemo: true,
    },
  });
  const contractor = await prisma.organization.create({
    data: {
      name: "ИП МонтажСервис Демо",
      type: "contractor",
      bin: "000000000004",
      isDemo: true,
    },
  });
  const platform = await prisma.organization.create({
    data: {
      name: "QuatHub Platform",
      type: "mixed",
      isDemo: true,
    },
  });

  const users = await Promise.all(
    [
      { email: "buyer@demo.quathub.local", name: "Айгуль Сметчикова", org: buyerOrg.id, role: "estimator" as const },
      { email: "supplier1@demo.quathub.local", name: "Ерлан Поставщиков", org: supplier1.id, role: "supplier_manager" as const },
      { email: "supplier2@demo.quathub.local", name: "Марат Комплектов", org: supplier2.id, role: "supplier_manager" as const },
      { email: "contractor@demo.quathub.local", name: "Серик Монтажников", org: contractor.id, role: "supplier_manager" as const },
      { email: "admin@demo.quathub.local", name: "Админ QuatHub", org: platform.id, role: "platform_admin" as const },
    ].map(async (u) => {
      const user = await prisma.user.create({
        data: {
          email: u.email,
          name: u.name,
          passwordHash,
          locale: "ru",
        },
      });
      await prisma.membership.create({
        data: {
          userId: user.id,
          organizationId: u.org,
          role: u.role,
        },
      });
      await prisma.userSession.create({
        data: { userId: user.id, activeOrganizationId: u.org },
      });
      return user;
    }),
  );

  // Buyer also member of mixed view for multi-org demo
  await prisma.membership.create({
    data: {
      userId: users[0].id,
      organizationId: platform.id,
      role: "viewer",
    },
  });

  const almatyRegion = await prisma.region.create({
    data: { code: "ALA", nameRu: "Алматы", nameKk: "Алматы" },
  });
  const astanaRegion = await prisma.region.create({
    data: { code: "AST", nameRu: "Астана", nameKk: "Астана" },
  });
  const turkestanRegion = await prisma.region.create({
    data: { code: "TUR", nameRu: "Туркестанская область", nameKk: "Түркістан облысы" },
  });

  const almaty = await prisma.city.create({
    data: { regionId: almatyRegion.id, code: "almaty", nameRu: "Алматы", nameKk: "Алматы" },
  });
  const astana = await prisma.city.create({
    data: { regionId: astanaRegion.id, code: "astana", nameRu: "Астана", nameKk: "Астана" },
  });
  const shymkent = await prisma.city.create({
    data: { regionId: turkestanRegion.id, code: "shymkent", nameRu: "Шымкент", nameKk: "Шымкент" },
  });

  const units = {
    m: await prisma.unit.create({ data: { code: "m", nameRu: "м", nameKk: "м", dimension: "length" } }),
    pcs: await prisma.unit.create({ data: { code: "pcs", nameRu: "шт", nameKk: "дана", dimension: "count" } }),
    set: await prisma.unit.create({ data: { code: "set", nameRu: "компл.", nameKk: "жинақ", dimension: "count" } }),
    kg: await prisma.unit.create({ data: { code: "kg", nameRu: "кг", nameKk: "кг", dimension: "mass" } }),
    hour: await prisma.unit.create({ data: { code: "hour", nameRu: "чел·ч", nameKk: "адам·сағ", dimension: "time" } }),
    m2: await prisma.unit.create({ data: { code: "m2", nameRu: "м²", nameKk: "м²", dimension: "area" } }),
    mm2: await prisma.unit.create({ data: { code: "mm2", nameRu: "мм²", nameKk: "мм²", dimension: "area" } }),
  };

  const categoryDefs: { slug: string; nameRu: string; kind: CatalogItemKind }[] = [
    { slug: "cable", nameRu: "Кабель", kind: "product" },
    { slug: "protection", nameRu: "Автоматика и защита", kind: "product" },
    { slug: "panels", nameRu: "Распределительные щиты", kind: "product" },
    { slug: "lighting", nameRu: "Освещение", kind: "product" },
    { slug: "earthing", nameRu: "Заземление и молниезащита", kind: "product" },
    { slug: "metering", nameRu: "Учёт электроэнергии", kind: "product" },
    { slug: "backup", nameRu: "Генераторы / ИБП / резервное питание", kind: "product" },
    { slug: "installation", nameRu: "Электромонтаж", kind: "service" },
    { slug: "design", nameRu: "Проектирование", kind: "service" },
    { slug: "commissioning", nameRu: "Испытания и пусконаладка", kind: "service" },
  ];

  const categories: Record<string, string> = {};
  for (const [i, c] of categoryDefs.entries()) {
    const cat = await prisma.category.create({
      data: {
        slug: c.slug,
        nameRu: c.nameRu,
        kind: c.kind,
        isNavigable: true,
        sortOrder: i,
      },
    });
    categories[c.slug] = cat.id;
  }

  const attrCore = await prisma.attributeDefinition.create({
    data: {
      code: "conductor_material",
      nameRu: "Материал жил",
      valueType: "enum",
      enumOptions: ["Cu", "Al"],
      sortOrder: 1,
    },
  });
  const attrCores = await prisma.attributeDefinition.create({
    data: { code: "cores", nameRu: "Число жил", valueType: "number", sortOrder: 2 },
  });
  const attrSection = await prisma.attributeDefinition.create({
    data: {
      code: "cross_section_mm2",
      nameRu: "Сечение",
      valueType: "number",
      normalizedUnitId: units.mm2.id,
      sortOrder: 3,
    },
  });
  const attrVoltage = await prisma.attributeDefinition.create({
    data: { code: "voltage_v", nameRu: "Напряжение, В", valueType: "number", sortOrder: 4 },
  });
  const attrPoles = await prisma.attributeDefinition.create({
    data: { code: "poles", nameRu: "Полюса", valueType: "number", sortOrder: 1 },
  });
  const attrCurrent = await prisma.attributeDefinition.create({
    data: { code: "rated_current_a", nameRu: "Номинальный ток, А", valueType: "number", sortOrder: 2 },
  });
  const attrCurve = await prisma.attributeDefinition.create({
    data: {
      code: "trip_curve",
      nameRu: "Характеристика",
      valueType: "enum",
      enumOptions: ["B", "C", "D"],
      sortOrder: 3,
    },
  });

  for (const attrId of [attrCore.id, attrCores.id, attrSection.id, attrVoltage.id]) {
    await prisma.categoryAttribute.create({
      data: { categoryId: categories.cable, attributeDefinitionId: attrId },
    });
  }
  for (const attrId of [attrPoles.id, attrCurrent.id, attrCurve.id]) {
    await prisma.categoryAttribute.create({
      data: { categoryId: categories.protection, attributeDefinitionId: attrId },
    });
  }

  type ProductSeed = {
    category: string;
    name: string;
    sku: string;
    model?: string;
    unit: keyof typeof units;
    costTypeHint?: string;
    attrs?: { defId: string; value: unknown; normalized?: string }[];
  };

  const products: ProductSeed[] = [];

  // Cables — 10
  const cableSpecs = [
    { name: "Кабель ВВГнг 3×1.5", sku: "CBL-VVG-3X1.5", cores: 3, section: 1.5 },
    { name: "Кабель ВВГнг 3×2.5", sku: "CBL-VVG-3X2.5", cores: 3, section: 2.5 },
    { name: "Кабель ВВГнг 5×4", sku: "CBL-VVG-5X4", cores: 5, section: 4 },
    { name: "Кабель ВВГнг 5×6", sku: "CBL-VVG-5X6", cores: 5, section: 6 },
    { name: "Кабель ВВГнг 5×10", sku: "CBL-VVG-5X10", cores: 5, section: 10 },
    { name: "Кабель КГ 3×16", sku: "CBL-KG-3X16", cores: 3, section: 16 },
    { name: "Кабель АВВГ 4×25", sku: "CBL-AVVG-4X25", cores: 4, section: 25, mat: "Al" },
    { name: "Кабель NYM 3×2.5", sku: "CBL-NYM-3X2.5", cores: 3, section: 2.5 },
    { name: "Кабель ПВС 3×1.5", sku: "CBL-PVS-3X1.5", cores: 3, section: 1.5 },
    { name: "Кабель СИП-4 4×16", sku: "CBL-SIP4-4X16", cores: 4, section: 16, mat: "Al" },
  ];
  for (const c of cableSpecs) {
    products.push({
      category: "cable",
      name: c.name,
      sku: c.sku,
      unit: "m",
      attrs: [
        { defId: attrCore.id, value: c.mat ?? "Cu" },
        { defId: attrCores.id, value: c.cores, normalized: String(c.cores) },
        { defId: attrSection.id, value: c.section, normalized: String(c.section) },
        { defId: attrVoltage.id, value: 1000, normalized: "1000" },
      ],
    });
  }

  // Protection — 6
  const breakers = [
    { name: "Автомат 1P 16A C", sku: "MCB-1P-16C", poles: 1, a: 16, curve: "C" },
    { name: "Автомат 1P 25A C", sku: "MCB-1P-25C", poles: 1, a: 25, curve: "C" },
    { name: "Автомат 3P 32A C", sku: "MCB-3P-32C", poles: 3, a: 32, curve: "C" },
    { name: "Автомат 3P 63A C", sku: "MCB-3P-63C", poles: 3, a: 63, curve: "C" },
    { name: "УЗО 2P 40A 30мА", sku: "RCD-2P-40-30", poles: 2, a: 40, curve: "B" },
    { name: "Дифавтомат 1P+N 16A C", sku: "RCBO-16C", poles: 2, a: 16, curve: "C" },
  ];
  for (const b of breakers) {
    products.push({
      category: "protection",
      name: b.name,
      sku: b.sku,
      unit: "pcs",
      attrs: [
        { defId: attrPoles.id, value: b.poles, normalized: String(b.poles) },
        { defId: attrCurrent.id, value: b.a, normalized: String(b.a) },
        { defId: attrCurve.id, value: b.curve },
      ],
    });
  }

  // Panels, lighting, earthing, metering, backup — 16 more → total 32
  const moreProducts: ProductSeed[] = [
    { category: "panels", name: "Щит ЩРн-24з", sku: "PNL-SHR-24", unit: "pcs" },
    { category: "panels", name: "Щит ЩРв-36", sku: "PNL-SHRV-36", unit: "pcs" },
    { category: "panels", name: "Корпус ВРУ 400А", sku: "PNL-VRU-400", unit: "set" },
    { category: "lighting", name: "Светильник LED 36Вт IP65", sku: "LGT-LED-36", unit: "pcs" },
    { category: "lighting", name: "Светильник LED 50Вт IP65", sku: "LGT-LED-50", unit: "pcs" },
    { category: "lighting", name: "Прожектор LED 100Вт", sku: "LGT-FL-100", unit: "pcs" },
    { category: "lighting", name: "Лампа LED E27 12Вт", sku: "LGT-E27-12", unit: "pcs" },
    { category: "earthing", name: "Заземлитель стержневой 16мм", sku: "EAR-ROD-16", unit: "pcs" },
    { category: "earthing", name: "Полоса оцинкованная 40×4", sku: "EAR-STRIP-40X4", unit: "m" },
    { category: "earthing", name: "Зажим заземления", sku: "EAR-CLAMP", unit: "pcs" },
    { category: "metering", name: "Счётчик 1ф 5-60А", sku: "MTR-1P-60", unit: "pcs" },
    { category: "metering", name: "Счётчик 3ф 5-100А", sku: "MTR-3P-100", unit: "pcs" },
    { category: "metering", name: "Трансформатор тока 100/5", sku: "MTR-CT-100", unit: "pcs" },
    { category: "backup", name: "ИБП 1 кВА", sku: "UPS-1KVA", unit: "pcs" },
    { category: "backup", name: "ИБП 3 кВА", sku: "UPS-3KVA", unit: "pcs" },
    { category: "backup", name: "Генератор 5 кВт бензин", sku: "GEN-5KW", unit: "pcs" },
  ];
  products.push(...moreProducts);

  const productIds: { id: string; sku: string; unitCode: string }[] = [];
  for (const p of products) {
    const item = await prisma.catalogItem.create({
      data: {
        kind: "product",
        categoryId: categories[p.category],
        name: p.name,
        sku: p.sku,
        model: p.model,
        baseUnitId: units[p.unit].id,
        description: "Учебная позиция каталога QuatHub (демо).",
        isDemo: true,
        attributes: p.attrs
          ? {
              create: p.attrs.map((a) => ({
                attributeDefinitionId: a.defId,
                value: a.value as object,
                normalizedValue: a.normalized ?? null,
              })),
            }
          : undefined,
      },
    });
    productIds.push({ id: item.id, sku: p.sku, unitCode: p.unit });
  }

  const services: { category: string; name: string; sku: string; unit: keyof typeof units; scope: object }[] = [
    {
      category: "installation",
      name: "Прокладка кабеля в гофре",
      sku: "SRV-CABLE-LAY",
      unit: "m",
      scope: { works: ["прокладка"], included: ["крепёж"], excluded: ["кабель"], requiresSurvey: false },
    },
    {
      category: "installation",
      name: "Монтаж автомата в щите",
      sku: "SRV-MCB-MOUNT",
      unit: "pcs",
      scope: { works: ["монтаж"], included: [], excluded: ["автомат"], requiresSurvey: false },
    },
    {
      category: "installation",
      name: "Сборка распределительного щита",
      sku: "SRV-PANEL-ASSY",
      unit: "set",
      scope: { works: ["сборка"], included: ["маркировка"], excluded: ["оборудование"], requiresSurvey: true },
    },
    {
      category: "installation",
      name: "Монтаж светильника",
      sku: "SRV-LIGHT-MOUNT",
      unit: "pcs",
      scope: { works: ["монтаж"], included: [], excluded: ["светильник"], requiresSurvey: false },
    },
    {
      category: "installation",
      name: "Устройство контура заземления",
      sku: "SRV-EARTH-LOOP",
      unit: "set",
      scope: { works: ["монтаж контура"], included: [], excluded: ["материалы"], requiresSurvey: true },
    },
    {
      category: "installation",
      name: "Монтаж счётчика",
      sku: "SRV-METER-MOUNT",
      unit: "pcs",
      scope: { works: ["монтаж"], included: [], excluded: ["счётчик"], requiresSurvey: false },
    },
    {
      category: "installation",
      name: "Подключение генератора",
      sku: "SRV-GEN-CONNECT",
      unit: "set",
      scope: { works: ["подключение"], included: ["проверка фазировки"], excluded: ["генератор"], requiresSurvey: true },
    },
    {
      category: "installation",
      name: "Штробление стены под кабель",
      sku: "SRV-CHASE",
      unit: "m",
      scope: { works: ["штробление"], included: [], excluded: [], requiresSurvey: true },
    },
    {
      category: "design",
      name: "Проект электроснабжения объекта",
      sku: "SRV-DESIGN-ES",
      unit: "set",
      scope: { works: ["проект"], included: ["схемы"], excluded: ["согласования"], requiresSurvey: true },
    },
    {
      category: "design",
      name: "Схема щита однолинейная",
      sku: "SRV-DESIGN-SLD",
      unit: "set",
      scope: { works: ["чертеж"], included: [], excluded: [], requiresSurvey: false },
    },
    {
      category: "design",
      name: "Расчёт нагрузок (коммерческий)",
      sku: "SRV-DESIGN-LOAD",
      unit: "set",
      scope: { works: ["расчёт"], included: [], excluded: ["нормативная экспертиза"], requiresSurvey: false },
    },
    {
      category: "commissioning",
      name: "Измерение сопротивления изоляции",
      sku: "SRV-TEST-INS",
      unit: "pcs",
      scope: { works: ["измерение"], included: ["протокол"], excluded: [], requiresSurvey: false },
    },
    {
      category: "commissioning",
      name: "Проверка УЗО",
      sku: "SRV-TEST-RCD",
      unit: "pcs",
      scope: { works: ["проверка"], included: ["протокол"], excluded: [], requiresSurvey: false },
    },
    {
      category: "commissioning",
      name: "Пусконаладка щита",
      sku: "SRV-COMM-PANEL",
      unit: "set",
      scope: { works: ["ПНР"], included: [], excluded: [], requiresSurvey: true },
    },
    {
      category: "commissioning",
      name: "Испытание контура заземления",
      sku: "SRV-TEST-EARTH",
      unit: "set",
      scope: { works: ["испытание"], included: ["протокол"], excluded: [], requiresSurvey: false },
    },
    {
      category: "commissioning",
      name: "Комплексная проверка освещения",
      sku: "SRV-TEST-LIGHT",
      unit: "set",
      scope: { works: ["проверка"], included: [], excluded: [], requiresSurvey: false },
    },
  ];

  const serviceIds: { id: string; sku: string }[] = [];
  for (const s of services) {
    const item = await prisma.catalogItem.create({
      data: {
        kind: "service",
        categoryId: categories[s.category],
        name: s.name,
        sku: s.sku,
        baseUnitId: units[s.unit].id,
        description: "Учебная услуга (демо). Не является инженерным проектом.",
        serviceScope: s.scope,
        isDemo: true,
      },
    });
    serviceIds.push({ id: item.id, sku: s.sku });
  }

  const now = new Date();
  const in30 = new Date(now.getTime() + 30 * 86400000);
  const expired = new Date(now.getTime() - 7 * 86400000);

  async function createOffer(opts: {
    supplierId: string;
    itemId: string;
    sku: string;
    priceType: PriceType;
    price?: string;
    priceMin?: string;
    priceMax?: string;
    vatMode: VatMode;
    vatRate?: string;
    reason?: string;
    packQty?: string;
    moq?: string;
    validUntil?: Date;
    cityIds?: string[];
  }) {
    const offer = await prisma.offer.create({
      data: {
        supplierOrganizationId: opts.supplierId,
        catalogItemId: opts.itemId,
        priceType: opts.priceType,
        price: opts.price,
        priceMin: opts.priceMin,
        priceMax: opts.priceMax,
        currency: "KZT",
        inputVatMode: opts.vatMode,
        inputVatRate: opts.vatRate,
        unknownPriceReason: opts.reason,
        availability: opts.priceType === "on_request" ? "unknown" : "in_stock",
        moq: opts.moq,
        packQty: opts.packQty,
        leadTimeDays: opts.priceType === "on_request" ? null : 5,
        source: "manual",
        validFrom: now,
        validUntil: opts.validUntil ?? in30,
        moderationStatus: "approved",
        supplierSku: opts.sku,
        isDemo: true,
      },
    });
    for (const cityId of opts.cityIds ?? [almaty.id, astana.id, shymkent.id]) {
      await prisma.offerCity.create({ data: { offerId: offer.id, cityId } });
    }
    await prisma.offerRegion.create({ data: { offerId: offer.id, regionId: almatyRegion.id } });
  }

  // Multiple offers per product; special cases
  for (const [i, p] of productIds.entries()) {
    const base = 500 + i * 120;
    await createOffer({
      supplierId: supplier1.id,
      itemId: p.id,
      sku: `${p.sku}-S1`,
      priceType: "fixed",
      price: String(base),
      vatMode: "excluded",
      vatRate: "12", // synthetic demo rate, not a legal claim
      packQty: p.unitCode === "m" ? "100" : "1",
      moq: p.unitCode === "m" ? "100" : "1",
    });
    if (i % 2 === 0) {
      await createOffer({
        supplierId: supplier2.id,
        itemId: p.id,
        sku: `${p.sku}-S2`,
        priceType: "fixed",
        price: String(base + 40),
        vatMode: "included",
        vatRate: "12",
        packQty: p.unitCode === "m" ? "50" : "1",
      });
    }
  }

  // Special offers: on_request, expired, from, range, fractional pack
  const specialItem = productIds[0];
  await createOffer({
    supplierId: supplier2.id,
    itemId: specialItem.id,
    sku: `${specialItem.sku}-ONREQ`,
    priceType: "on_request",
    vatMode: "not_specified",
    reason: "Требуется уточнение объёма и срока",
  });
  await createOffer({
    supplierId: supplier1.id,
    itemId: productIds[1].id,
    sku: `${productIds[1].sku}-EXPIRED`,
    priceType: "fixed",
    price: "777",
    vatMode: "zero",
    vatRate: "0",
    validUntil: expired,
  });
  await createOffer({
    supplierId: supplier2.id,
    itemId: productIds[2].id,
    sku: `${productIds[2].sku}-FROM`,
    priceType: "from",
    priceMin: "900",
    vatMode: "excluded",
    vatRate: "12",
  });
  await createOffer({
    supplierId: supplier1.id,
    itemId: productIds[3].id,
    sku: `${productIds[3].sku}-RANGE`,
    priceType: "range",
    priceMin: "1000",
    priceMax: "1400",
    vatMode: "excluded",
    vatRate: "12",
  });

  for (const [i, s] of serviceIds.entries()) {
    await createOffer({
      supplierId: contractor.id,
      itemId: s.id,
      sku: `${s.sku}-C1`,
      priceType: i === serviceIds.length - 1 ? "on_request" : "fixed",
      price: i === serviceIds.length - 1 ? undefined : String(350 + i * 80),
      reason: i === serviceIds.length - 1 ? "Цена после обследования" : undefined,
      vatMode: "excluded",
      vatRate: "12",
      cityIds: [almaty.id, astana.id],
    });
  }

  // Isolation fixture projects
  await prisma.project.create({
    data: {
      organizationId: buyerOrg.id,
      name: "Демо: склад освещение (орг A)",
      cityId: almaty.id,
      objectName: "Склад №1",
      description: "Учебный проект организации покупателя",
      assumptions: "Все цены учебные",
    },
  });
  await prisma.project.create({
    data: {
      organizationId: supplier1.id,
      name: "Внутренний проект поставщика (орг B)",
      cityId: astana.id,
      objectName: "Склад поставщика",
      description: "Не должен быть виден покупателю",
    },
  });

  await prisma.estimateTemplate.createMany({
    data: [
      {
        code: "tpl-warehouse-lighting",
        nameRu: "Освещение небольшого склада",
        description: "Демо-шаблон. Требует проверки инженером. Учебные количества.",
        isDemo: true,
        isSystem: true,
        payload: {
          assumptions: [
            "учебные qty и цены",
            "запас кабеля не увеличивает длину прокладки",
          ],
          sections: ["Оборудование и материалы", "Работы"],
          lines: [
            {
              sku: "LGT-LED-36",
              name: "Светильник LED 36Вт IP65 (учебный)",
              unit: "pcs",
              qty: "20",
              costType: "equipment",
              unitSalePrice: "8500",
            },
            {
              sku: "CBL-VVG-3X1.5",
              name: "Кабель ВВГнг 3×1.5 (учебный)",
              unit: "m",
              qty: "150",
              costType: "material",
              unitSalePrice: "800",
            },
            {
              sku: "SRV-LIGHT-MOUNT",
              name: "Монтаж светильника (учебный)",
              unit: "pcs",
              qty: "20",
              costType: "labor",
              unitSalePrice: "2500",
            },
            {
              sku: "SRV-CABLE-LAY",
              name: "Прокладка кабеля в гофре (учебный)",
              unit: "m",
              qty: "150",
              costType: "labor",
              unitSalePrice: "350",
            },
          ],
        },
      },
      {
        code: "tpl-panel-install",
        nameRu: "Монтаж распределительного щита",
        description: "Демо-шаблон. Не готовый инженерный проект.",
        isDemo: true,
        isSystem: true,
        payload: {
          assumptions: ["обследование обязательно", "учебные позиции"],
          sections: ["Оборудование и материалы", "Работы"],
          lines: [
            {
              sku: "PNL-SHR-24",
              name: "Щит ЩРн-24з (учебный)",
              unit: "pcs",
              qty: "1",
              costType: "equipment",
              unitSalePrice: "45000",
            },
            {
              sku: "MCB-3P-32C",
              name: "Автомат 3P 32A C (учебный)",
              unit: "pcs",
              qty: "6",
              costType: "equipment",
              unitSalePrice: "4200",
            },
            {
              sku: "SRV-PANEL-ASSY",
              name: "Сборка распределительного щита (учебный)",
              unit: "set",
              qty: "1",
              costType: "labor",
              unitSalePrice: "35000",
            },
            {
              sku: "SRV-COMM-PANEL",
              name: "Пусконаладка щита (учебный)",
              unit: "set",
              qty: "1",
              costType: "labor",
              unitSalePrice: "18000",
            },
          ],
        },
      },
      {
        code: "tpl-backup-power",
        nameRu: "Подключение резервного питания",
        description: "Демо-шаблон. Учебные позиции.",
        isDemo: true,
        isSystem: true,
        payload: {
          assumptions: ["тип генератора уточняется", "учебные цены"],
          sections: ["Оборудование и материалы", "Работы"],
          lines: [
            {
              sku: "GEN-5KW",
              name: "Генератор 5 кВт бензин (учебный)",
              unit: "pcs",
              qty: "1",
              costType: "equipment",
              unitSalePrice: "380000",
            },
            {
              sku: "UPS-1KVA",
              name: "ИБП 1 кВА (учебный)",
              unit: "pcs",
              qty: "1",
              costType: "equipment",
              unitSalePrice: "95000",
            },
            {
              sku: "SRV-GEN-CONNECT",
              name: "Подключение генератора (учебный)",
              unit: "set",
              qty: "1",
              costType: "labor",
              unitSalePrice: "55000",
            },
          ],
        },
      },
    ],
  });

  const productCount = await prisma.catalogItem.count({ where: { kind: "product" } });
  const serviceCount = await prisma.catalogItem.count({ where: { kind: "service" } });
  const offerCount = await prisma.offer.count();

  console.log("Seed complete:");
  console.log(`  products=${productCount} services=${serviceCount} offers=${offerCount}`);
  console.log(`  demo password: ${DEMO_PASSWORD}`);
  console.log("  emails: buyer@ / supplier1@ / supplier2@ / contractor@ / admin@ demo.quathub.local");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
