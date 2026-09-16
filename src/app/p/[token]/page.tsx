import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPublicEstimateByToken } from "@/modules/estimates/versions";

export const metadata: Metadata = {
  title: "Коммерческая смета QuatHub",
  robots: { index: false, follow: false },
};

export default async function PublicEstimatePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const data = await getPublicEstimateByToken(token);
  if (!data) notFound();

  const dto = data.clientDto;

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <p className="text-sm text-[var(--accent)]">QuatHub · публичная ссылка</p>
      <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl">
        {dto.estimate.title}
      </h1>
      <p className="mt-1 text-sm text-[var(--muted)]">
        {dto.estimate.number} · {dto.project.cityName ?? "город не указан"} ·{" "}
        {dto.project.objectName ?? "объект не указан"}
      </p>
      <p className="mt-3 rounded-md border border-[var(--border)] bg-[var(--surface)] p-3 text-sm text-[var(--muted)]">
        {dto.disclaimer}
      </p>

      <table className="mt-6 w-full text-sm">
        <thead>
          <tr className="border-b text-left text-[var(--muted)]">
            <th className="py-2">Позиция</th>
            <th className="py-2">Ед.</th>
            <th className="py-2">Кол-во</th>
            <th className="py-2">Цена</th>
            <th className="py-2">Сумма</th>
          </tr>
        </thead>
        <tbody>
          {dto.lines.map((l) => {
            const lr = dto.lineResults.find((r) => r.id === l.id);
            return (
              <tr key={String(l.id)} className="border-b align-top">
                <td className="py-2">
                  <div className="font-medium">{String(l.name)}</div>
                  {l.unknownPriceReason ? (
                    <div className="text-xs text-[var(--danger)]">
                      {String(l.unknownPriceReason)}
                    </div>
                  ) : null}
                </td>
                <td className="py-2">{String(l.unit)}</td>
                <td className="py-2">{String(l.qty)}</td>
                <td className="py-2">
                  {l.unitSalePrice != null ? String(l.unitSalePrice) : "по запросу"}
                </td>
                <td className="py-2">{lr?.lineNetExVat ?? "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="mt-6">
        {dto.totals.complete && dto.totals.grandTotal ? (
          <p className="text-2xl font-semibold">Итого: {dto.totals.grandTotal} {dto.currency}</p>
        ) : (
          <>
            <p className="text-sm text-[var(--muted)]">Известная часть стоимости</p>
            <p className="text-2xl font-semibold">
              {dto.totals.knownSubtotal} {dto.currency}
            </p>
            <p className="text-sm text-[var(--danger)]">
              Незаполненных позиций: {dto.totals.unknownLineCount}
            </p>
          </>
        )}
        <p className="mt-2 text-sm text-[var(--muted)]">
          В т.ч. выходной НДС: {dto.totals.outputVatTotal} · политика{" "}
          {dto.calculationPolicyVersion}
        </p>
      </div>

      {dto.estimate.terms ? (
        <section className="mt-8 text-sm">
          <h2 className="font-semibold">Условия</h2>
          <p className="mt-1 whitespace-pre-wrap text-[var(--muted)]">{dto.estimate.terms}</p>
        </section>
      ) : null}
    </main>
  );
}
