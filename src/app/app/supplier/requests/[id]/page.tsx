import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { SiteHeader } from "@/components/SiteHeader";
import { auth } from "@/lib/auth";
import {
  getSupplierRequest,
  markRequestViewed,
  toSupplierRequestDto,
} from "@/modules/requests/service";
import { respondRequestAction } from "@/app/actions/requests";

export default async function SupplierRequestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const { id } = await params;

  let req;
  try {
    await markRequestViewed(session.user.id, id);
    req = await getSupplierRequest(session.user.id, id);
  } catch {
    notFound();
  }

  const dto = toSupplierRequestDto(req);
  const json = JSON.stringify(dto);

  // Hard guarantee: no sale/margin fields in supplier DTO
  if (
    json.includes("unitSalePrice") ||
    json.includes("markup") ||
    json.includes("contribution")
  ) {
    throw new Error("Supplier DTO leaked internal fields");
  }

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 py-8">
        <p className="text-sm text-[var(--muted)]">
          <Link href="/app/supplier/requests">← Входящие</Link>
        </p>
        <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl">
          Заявка от {dto.buyerName}
        </h1>
        <p className="text-sm text-[var(--muted)]">
          статус: {dto.status} · {dto.disclaimer}
        </p>
        <pre className="mt-3 overflow-auto rounded bg-[var(--bg)] p-2 text-xs">
          {JSON.stringify(dto.objectInfo, null, 2)}
        </pre>

        <h2 className="mt-6 font-semibold">Позиции</h2>
        <ul className="mt-2 space-y-1 text-sm">
          {dto.lines.map((l) => (
            <li key={l.id} className="rounded border border-[var(--border)] px-3 py-2">
              {l.name} · {l.qty} {l.unit}
            </li>
          ))}
        </ul>

        <h2 className="mt-6 font-semibold">Ответ</h2>
        <form action={respondRequestAction} className="mt-3 grid gap-3 text-sm md:grid-cols-2">
          <input type="hidden" name="requestId" value={id} />
          <label>
            Цена (KZT)
            <input name="proposedPrice" className="mt-1 w-full rounded-md border px-2 py-1" />
          </label>
          <label>
            Срок, дн.
            <input
              name="proposedLeadTimeDays"
              type="number"
              className="mt-1 w-full rounded-md border px-2 py-1"
            />
          </label>
          <label>
            Наличие
            <select name="proposedAvailability" className="mt-1 w-full rounded-md border px-2 py-1">
              <option value="in_stock">in_stock</option>
              <option value="made_to_order">made_to_order</option>
              <option value="limited">limited</option>
              <option value="unknown">unknown</option>
            </select>
          </label>
          <label className="md:col-span-2">
            Сообщение
            <textarea name="message" rows={3} className="mt-1 w-full rounded-md border px-2 py-1" />
          </label>
          <label className="md:col-span-2 text-xs text-[var(--muted)]">
            ID альтернативного CatalogItem (опц.)
            <input
              name="alternativeCatalogItemId"
              className="mt-1 w-full rounded-md border px-2 py-1"
              placeholder="cuid…"
            />
          </label>
          <button
            type="submit"
            className="rounded-md bg-[var(--accent)] px-4 py-2 font-semibold text-white"
          >
            Отправить предложение
          </button>
          <button
            type="submit"
            name="decline"
            value="1"
            className="rounded-md border border-[var(--border)] px-4 py-2"
          >
            Отклонить
          </button>
        </form>

        {dto.responses.length > 0 ? (
          <div className="mt-6 text-sm">
            <h3 className="font-semibold">История ответов</h3>
            <ul className="mt-2 space-y-2">
              {dto.responses.map((r) => (
                <li key={r.version} className="rounded border border-[var(--border)] p-2">
                  v{r.version}: {r.proposedPrice ?? "—"} · {r.message}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </main>
    </>
  );
}
