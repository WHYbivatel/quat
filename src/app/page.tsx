import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { GuestDraftBadge } from "@/components/AddToEstimateButton";
import { auth } from "@/lib/auth";
import { listNavigableCategories } from "@/modules/catalog/queries";

export default async function HomePage() {
  const session = await auth();
  const categories = await listNavigableCategories();

  return (
    <>
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-10 px-4 py-12">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-2xl">
            <p className="text-sm font-medium tracking-wide text-[var(--accent)]">
              QuatHub / КуатХаб
            </p>
            <h1 className="mt-2 font-[family-name:var(--font-display)] text-4xl leading-tight md:text-5xl">
              Коммерческие сметы для электроснабжения
            </h1>
            <p className="mt-3 text-[var(--muted)]">
              Регион → товары и услуги → проект → смета → документы и заявки.
              Нормативная ПСД в MVP не заявляется.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <GuestDraftBadge />
            {session?.user ? (
              <Link
                href="/app/projects"
                className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent-2)]"
              >
                Создать смету
              </Link>
            ) : (
              <Link
                href="/login"
                className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent-2)]"
              >
                Войти и создать смету
              </Link>
            )}
          </div>
        </header>

        <form
          action="/catalog/products"
          method="get"
          className="flex flex-wrap gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4"
        >
          <label className="flex min-w-[240px] flex-1 flex-col gap-1 text-sm">
            Поиск по каталогу
            <input
              name="q"
              type="search"
              placeholder="Кабель, автомат, монтаж…"
              className="rounded-md border border-[var(--border)] px-3 py-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)]"
            />
          </label>
          <div className="flex items-end gap-2">
            <button
              type="submit"
              className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white"
            >
              Товары
            </button>
            <a
              href="/catalog/services"
              className="rounded-md border border-[var(--border)] px-4 py-2 text-sm"
            >
              Услуги
            </a>
          </div>
        </form>

        <section>
          <h2 className="font-semibold">Категории</h2>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2 md:grid-cols-3">
            {categories.map((c) => (
              <li key={c.id}>
                <Link
                  href={
                    c.kind === "product"
                      ? `/catalog/products?category=${c.slug}`
                      : `/catalog/services?category=${c.slug}`
                  }
                  className="block rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm hover:border-[var(--accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)]"
                >
                  {c.nameRu}
                  <span className="mt-1 block text-xs text-[var(--muted)]">
                    {c.kind === "product" ? "Товары" : "Услуги"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <p className="text-xs text-[var(--muted)]">
          Демо-цены учебные. Платёж и доставка согласуются вне платформы. Нет
          фиктивных отзывов, лицензий и партнёров.
        </p>
      </main>
    </>
  );
}
