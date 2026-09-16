import { FeatureStatus, type FeatureStatus as Status } from "./registry";

export const STATUS_LABELS: Record<Status, string> = {
  [FeatureStatus.AVAILABLE]: "Доступно",
  [FeatureStatus.LIMITED]: "Ограниченный режим",
  [FeatureStatus.COMING_SOON]: "В разработке",
  [FeatureStatus.UNAVAILABLE_ENV]: "Недоступно на этом стенде",
  [FeatureStatus.NO_PERMISSION]: "Недостаточно прав",
  [FeatureStatus.TEMPORARILY_UNAVAILABLE]: "Временно недоступно",
};

export function statusLabel(status: Status): string {
  return STATUS_LABELS[status];
}
