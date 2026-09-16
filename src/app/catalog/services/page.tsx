import { CatalogPage } from "@/components/CatalogPage";

export default async function ServicesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <CatalogPage
      kind="service"
      title="Каталог услуг"
      searchParams={searchParams}
    />
  );
}
