"use client";

import { useMemo, useState, useTransition } from "react";

type City = { id: string; nameRu: string };
type Template = { code: string; nameRu: string };

export function CreateProjectForm(props: {
  cities: City[];
  templates: Template[];
  organizationId: string;
  action: (formData: FormData) => Promise<void>;
  defaultName?: string;
}) {
  const [pending, startTransition] = useTransition();
  const idempotencyKey = useMemo(() => crypto.randomUUID(), []);
  const [name, setName] = useState(props.defaultName ?? "");

  return (
    <form
      className="mt-6 flex flex-wrap items-end gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (pending) return;
        const fd = new FormData(e.currentTarget);
        startTransition(async () => {
          await props.action(fd);
        });
      }}
    >
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
      <input type="hidden" name="organizationId" value={props.organizationId} />
      <label className="flex min-w-[200px] flex-1 flex-col gap-1 text-sm">
        Название
        <input
          name="name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Например: Освещение склада"
          className="rounded-md border border-[var(--border)] px-3 py-2"
        />
      </label>
      <label className="flex min-w-[160px] flex-col gap-1 text-sm">
        Город
        <select name="cityId" className="rounded-md border border-[var(--border)] px-3 py-2">
          <option value="">Не выбран</option>
          {props.cities.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nameRu}
            </option>
          ))}
        </select>
      </label>
      <label className="flex min-w-[200px] flex-col gap-1 text-sm">
        Шаблон (опц.)
        <select name="templateCode" className="rounded-md border border-[var(--border)] px-3 py-2">
          <option value="">Без шаблона</option>
          {props.templates.map((t) => (
            <option key={t.code} value={t.code}>
              {t.nameRu}
            </option>
          ))}
        </select>
      </label>
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
      >
        {pending ? "Создаём…" : "Создать смету"}
      </button>
    </form>
  );
}
