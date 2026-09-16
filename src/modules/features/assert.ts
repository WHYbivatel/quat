import { isActionable, tryGetFeature, type FeatureId } from "./registry";

export class FeatureUnavailableError extends Error {
  constructor(
    public featureId: FeatureId | string,
    message: string,
  ) {
    super(message);
    this.name = "FeatureUnavailableError";
  }
}

/** Server-side guard for actions that must not pretend to work. */
export function assertFeatureActionable(id: FeatureId | string): void {
  const feature = tryGetFeature(id);
  if (!feature) {
    throw new FeatureUnavailableError(id, "Неизвестная функция");
  }
  if (!isActionable(feature.status)) {
    throw new FeatureUnavailableError(
      id,
      feature.alternate ||
        feature.limitation ||
        `Функция ${feature.title} недоступна (${feature.status}).`,
    );
  }
}
