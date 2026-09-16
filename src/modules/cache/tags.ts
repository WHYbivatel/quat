/** Public cache tag names — never embed secrets or PII. */

export const cacheTags = {
  catalog: "catalog",
  sitemap: "sitemap",
  category: (id: string) => `category:${id}`,
  region: (id: string) => `region:${id}`,
  item: (id: string) => `item:${id}`,
  offer: (id: string) => `offer:${id}`,
  provider: (id: string) => `provider:${id}`,
  /** Use PublicEstimateLink.id, never the raw share token. */
  publicEstimate: (linkId: string) => `public-estimate:${linkId}`,
  organizationProjects: (orgId: string) => `organization-projects:${orgId}`,
} as const;

export type CacheInvalidationPayload = {
  tags?: string[];
  paths?: string[];
};
