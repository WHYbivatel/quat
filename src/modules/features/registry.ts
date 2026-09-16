export const FeatureStatus = {
  AVAILABLE: "AVAILABLE",
  LIMITED: "LIMITED",
  COMING_SOON: "COMING_SOON",
  UNAVAILABLE_ENV: "UNAVAILABLE_ENV",
  NO_PERMISSION: "NO_PERMISSION",
  TEMPORARILY_UNAVAILABLE: "TEMPORARILY_UNAVAILABLE",
} as const;

export type FeatureStatus = (typeof FeatureStatus)[keyof typeof FeatureStatus];

export type FeatureId =
  | "catalog.browse"
  | "catalog.public_prices"
  | "catalog.auto_sync"
  | "auth.login"
  | "auth.password_reset"
  | "draft.local"
  | "draft.import"
  | "project.create"
  | "estimate.edit"
  | "estimate.issue"
  | "estimate.export_draft_pdf"
  | "estimate.export_draft_office"
  | "estimate.export_version"
  | "estimate.public_link"
  | "requests.inbox"
  | "requests.notify_email"
  | "requests.external_no_cabinet"
  | "supplier.offers"
  | "admin.panel"
  | "admin.import"
  | "storage.object"
  | "i18n.kk"
  | "normative.kz"
  | "orders.payments"
  | "release.autodeploy"
  | "notifications.sms";

export type FeatureDefinition = {
  id: FeatureId;
  title: string;
  status: FeatureStatus;
  routes?: string[];
  roles?: string[];
  limitation?: string;
  alternate?: string;
  planStage?: string;
  evidence?: string;
};

export const FEATURES: Record<FeatureId, FeatureDefinition> = {
  "catalog.browse": {
    id: "catalog.browse",
    title: "Каталог товаров и услуг",
    status: FeatureStatus.AVAILABLE,
    routes: ["/catalog/products", "/catalog/services", "/catalog/items/[id]"],
    evidence: "e2e + integration catalog-search",
  },
  "catalog.public_prices": {
    id: "catalog.public_prices",
    title: "Публичные прайсы (ETL XXI / Elektrik24)",
    status: FeatureStatus.LIMITED,
    routes: ["/catalog/services", "/app/admin/sources"],
    limitation:
      "Кураторский импорт с публичных страниц; не партнёрство и не подтверждённое наличие.",
    evidence: "prompt 7A curated publish + staging listings",
    planStage: "7A (частично)",
  },
  "catalog.auto_sync": {
    id: "catalog.auto_sync",
    title: "Автосинхронизация внешних прайсов",
    status: FeatureStatus.COMING_SOON,
    routes: ["/app/admin/sources"],
    alternate: "Доступен ручной republish curated-набора в админке.",
    planStage: "после договорённостей с источниками",
  },
  "auth.login": {
    id: "auth.login",
    title: "Вход / выход",
    status: FeatureStatus.AVAILABLE,
    routes: ["/login"],
    evidence: "e2e critical path",
  },
  "auth.password_reset": {
    id: "auth.password_reset",
    title: "Восстановление пароля",
    status: FeatureStatus.COMING_SOON,
    routes: ["/login"],
    alternate: "Сброс пароля выполняет администратор стенда.",
  },
  "draft.local": {
    id: "draft.local",
    title: "Локальный черновик",
    status: FeatureStatus.AVAILABLE,
    routes: ["/draft"],
    evidence: "hotfix + e2e CTA",
  },
  "draft.import": {
    id: "draft.import",
    title: "Перенос локального черновика в организацию",
    status: FeatureStatus.AVAILABLE,
    routes: ["/app/import-draft"],
    evidence: "hotfix transfer flow",
  },
  "project.create": {
    id: "project.create",
    title: "Создание проекта и организации",
    status: FeatureStatus.AVAILABLE,
    routes: ["/app/projects"],
    evidence: "7R + tests",
  },
  "estimate.edit": {
    id: "estimate.edit",
    title: "Редактирование коммерческой сметы",
    status: FeatureStatus.AVAILABLE,
    routes: ["/app/projects/[projectId]/estimates/[estimateId]"],
    evidence: "integration + hotfix",
  },
  "estimate.issue": {
    id: "estimate.issue",
    title: "Выпуск версии сметы",
    status: FeatureStatus.AVAILABLE,
    routes: ["/app/projects/[projectId]/estimates/[estimateId]", "/app/versions/[versionId]"],
    evidence: "hotfix + tests/estimate-versions",
  },
  "estimate.export_draft_pdf": {
    id: "estimate.export_draft_pdf",
    title: "Предварительный PDF черновика",
    status: FeatureStatus.AVAILABLE,
    routes: ["/api/exports/draft"],
    evidence: "staging smoke %PDF, revision unchanged",
  },
  "estimate.export_draft_office": {
    id: "estimate.export_draft_office",
    title: "Предварительный XLSX/DOCX/CSV черновика",
    status: FeatureStatus.AVAILABLE,
    routes: ["/api/exports/draft"],
    evidence: "exportDraftDocument supports formats; UI buttons added",
  },
  "estimate.export_version": {
    id: "estimate.export_version",
    title: "Экспорт выпущенной версии (PDF/XLSX/DOCX/CSV)",
    status: FeatureStatus.AVAILABLE,
    routes: ["/api/exports/version/[versionId]", "/app/versions/[versionId]"],
    evidence: "tests/exports.test.ts",
  },
  "estimate.public_link": {
    id: "estimate.public_link",
    title: "Публичная ссылка на версию",
    status: FeatureStatus.AVAILABLE,
    routes: ["/p/[token]", "/app/versions/[versionId]"],
    evidence: "estimate-versions tests",
  },
  "requests.inbox": {
    id: "requests.inbox",
    title: "Заявки поставщикам с кабинетом",
    status: FeatureStatus.AVAILABLE,
    routes: ["/app/requests", "/app/supplier/requests"],
    evidence: "tests/requests.test.ts",
  },
  "requests.notify_email": {
    id: "requests.notify_email",
    title: "Email/SMS уведомления о заявках",
    status: FeatureStatus.LIMITED,
    limitation:
      "На стенде используется журнал (log-адаптер); письма и SMS не отправляются.",
    evidence: "LogNotificationAdapter",
  },
  "requests.external_no_cabinet": {
    id: "requests.external_no_cabinet",
    title: "Заявка внешней компании без кабинета",
    status: FeatureStatus.LIMITED,
    limitation:
      "Заявка сохраняется со статусом уведомления skipped; доставка inbox не имитируется.",
    evidence: "tests/request-notification-skipped.test.ts",
  },
  "supplier.offers": {
    id: "supplier.offers",
    title: "Кабинет поставщика: предложения",
    status: FeatureStatus.AVAILABLE,
    routes: ["/app/supplier/offers"],
    evidence: "supplier offers UI + updateOfferAction",
  },
  "admin.panel": {
    id: "admin.panel",
    title: "Админ-панель",
    status: FeatureStatus.AVAILABLE,
    routes: ["/app/admin"],
    roles: ["platform_admin"],
    evidence: "admin pages + requirePlatformAdmin",
  },
  "admin.import": {
    id: "admin.import",
    title: "Импорт прайса CSV/XLSX",
    status: FeatureStatus.AVAILABLE,
    routes: ["/app/admin/import"],
    roles: ["platform_admin", "offer:manage"],
    evidence: "tests/import-admin.test.ts",
  },
  "storage.object": {
    id: "storage.object",
    title: "Объектное хранилище документов",
    status: FeatureStatus.UNAVAILABLE_ENV,
    limitation: "Файлы экспорта/импорта на стенде в локальном каталоге .data.",
    planStage: "9",
  },
  "i18n.kk": {
    id: "i18n.kk",
    title: "Полный казахский интерфейс",
    status: FeatureStatus.COMING_SOON,
    alternate: "Сейчас основной UI на русском; в документах поддерживается кириллица/қазақ мәтін.",
    planStage: "после пилота",
  },
  "normative.kz": {
    id: "normative.kz",
    title: "Нормативная смета РК / экспертиза",
    status: FeatureStatus.COMING_SOON,
    alternate: "Доступен только коммерческий расчёт commercial-v1.",
    planStage: "10",
  },
  "orders.payments": {
    id: "orders.payments",
    title: "Заказы и онлайн-оплата",
    status: FeatureStatus.COMING_SOON,
    alternate: "Закупка оформляется заявками; оплата вне платформы.",
    planStage: "9+",
  },
  "release.autodeploy": {
    id: "release.autodeploy",
    title: "Автодеплой release-dir / CI workflow",
    status: FeatureStatus.LIMITED,
    limitation:
      "Версия/health/инвалидация кэша есть; CI — шаблон, деплой стенда по SSH.",
    planStage: "7B/9",
    evidence: "docs/CACHING_AND_RELEASES.md",
  },
  "notifications.sms": {
    id: "notifications.sms",
    title: "SMS-уведомления",
    status: FeatureStatus.COMING_SOON,
    alternate: "События пишутся в серверный журнал стенда.",
  },
};

export function getFeature(id: FeatureId): FeatureDefinition {
  const f = FEATURES[id];
  if (!f) {
    throw new Error(`Unknown feature: ${id}`);
  }
  return f;
}

export function tryGetFeature(id: string): FeatureDefinition | null {
  if (id in FEATURES) return FEATURES[id as FeatureId];
  return null;
}

export function listFeatures(): FeatureDefinition[] {
  return Object.values(FEATURES);
}

export function isActionable(status: FeatureStatus): boolean {
  return (
    status === FeatureStatus.AVAILABLE || status === FeatureStatus.LIMITED
  );
}

export function publicFeatureSummary() {
  return listFeatures().map((f) => ({
    id: f.id,
    title: f.title,
    status: f.status,
    limitation: f.limitation ?? null,
    alternate: f.alternate ?? null,
  }));
}
