"use client";

import { useState } from "react";
import {
  Badge,
  Button,
  CatalogRow,
  Dialog,
  EmptyState,
  EstimateLine,
  EstimatePanel,
  EstimatePanelBody,
  EstimatePanelFooter,
  Field,
  FilterChip,
  InlineFeedback,
  Input,
  Menu,
  MenuItem,
  Panel,
  PanelDivider,
  PanelHeader,
  PanelToolbar,
  PanelToolbarRow,
  Price,
  QuantityStepper,
  SearchInput,
  SegmentedControl,
  Select,
  Sheet,
  Summary,
  Textarea,
  useToast,
} from "@/components/ui";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Panel padding="md" className="space-y-0">
      <h2 className="mb-4 text-lg font-semibold">{title}</h2>
      <div className="flex flex-col gap-4">{children}</div>
    </Panel>
  );
}

export function UiKitClient() {
  const toast = useToast();
  const [kind, setKind] = useState<"product" | "service">("product");
  const [qty, setQty] = useState(2);
  const [dialog, setDialog] = useState(false);
  const [sheet, setSheet] = useState(false);

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 space-y-6 px-5 py-8">
      <header>
        <p className="text-sm text-[var(--text-secondary)]">Внутренняя страница · не в меню покупателя</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">QuatHub UI kit</h1>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          page <code className="text-xs">#E2E2E2</code> · header{" "}
          <code className="text-xs">#ECEDE9</code> · panel{" "}
          <code className="text-xs">#F7F8F4</code> · control{" "}
          <code className="text-xs">#FFFFFF</code>
        </p>
      </header>

      <Section title="Surfaces / hierarchy">
        <div className="space-y-3 rounded-[14px] bg-[var(--page)] p-4">
          <div className="flex h-16 items-center border border-[var(--border)] bg-[var(--header-background)] px-4 text-sm">
            <span className="font-semibold">QuatHub</span>
            <span className="ml-6 border-b border-[var(--text-primary)] font-semibold">Каталог</span>
            <span className="ml-5 text-[var(--text-secondary)]">Мои сметы</span>
            <span className="ml-auto rounded-[var(--radius-button)] bg-[var(--brand)] px-3 py-1.5 text-xs font-semibold text-[var(--brand-foreground)]">
              Войти
            </span>
          </div>
          <div className="grid h-[420px] grid-cols-[minmax(0,62fr)_minmax(0,38fr)] gap-6">
            <Panel padding="none" className="qh-catalog-panel">
              <PanelToolbar>
                <PanelToolbarRow>
                  <SegmentedControl
                    ariaLabel="Тип"
                    value={kind}
                    onChange={setKind}
                    options={[
                      { value: "product", label: "Товары" },
                      { value: "service", label: "Услуги" },
                    ]}
                  />
                  <span className="text-sm text-[var(--text-secondary)]">Найдено: 32</span>
                </PanelToolbarRow>
                <PanelToolbarRow className="gap-3">
                  <SearchInput className="min-w-0 flex-[1.4]" />
                  <Select className="w-36 shrink-0" defaultValue="">
                    <option value="">Категория</option>
                  </Select>
                  <Button size="sm" variant="secondary" className="shrink-0">
                    Фильтры
                  </Button>
                </PanelToolbarRow>
              </PanelToolbar>
              <PanelDivider />
              <div className="min-h-0 flex-1 overflow-y-auto">
                <CatalogRow name="Автомат 1P 16A" price="1820" unit="шт." action={<Button size="sm">Добавить</Button>} />
                <CatalogRow name="Кабель NYM" price="1340" unit="м" action={<Button size="sm">Добавить</Button>} />
              </div>
            </Panel>
            <EstimatePanel>
              <PanelHeader>
                <p className="text-lg font-semibold">Смета</p>
                <p className="text-xs text-[var(--text-secondary)]">Итог закреплён внизу</p>
              </PanelHeader>
              <EstimatePanelBody>
                <p className="text-sm text-[var(--text-secondary)]">Позиции…</p>
              </EstimatePanelBody>
              <EstimatePanelFooter>
                <Summary total={10340} complete>
                  <Menu label="Скачать смету ▾" className="mt-2 w-full" variant="primary" size="md">
                    <MenuItem>PDF</MenuItem>
                    <MenuItem disabled>XLSX · после сохранения</MenuItem>
                  </Menu>
                  <Button variant="secondary" size="md" className="mt-2 w-full">
                    Войти и сохранить
                  </Button>
                </Summary>
              </EstimatePanelFooter>
            </EstimatePanel>
          </div>
        </div>
      </Section>

      <Section title="Buttons">
        <div className="flex flex-wrap gap-2">
          <Button>Primary</Button>
          <Button pending>Pending</Button>
          <Button disabled>Disabled</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="danger">Danger</Button>
          <Button variant="icon" aria-label="Иконка">
            ⋯
          </Button>
        </div>
      </Section>

      <Section title="Fields">
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Название">
            <Input placeholder="Смета от 17.09.2026" />
          </Field>
          <Field label="Категория">
            <Select defaultValue="">
              <option value="">Все</option>
              <option value="cable">Кабель</option>
            </Select>
          </Field>
          <Field label="Поиск" className="md:col-span-2">
            <SearchInput />
          </Field>
          <Field label="Комментарий" optional className="md:col-span-2">
            <Textarea rows={3} />
          </Field>
          <Field label="С ошибкой" error="Обязательное поле">
            <Input invalid />
          </Field>
        </div>
      </Section>

      <Section title="Segmented / chips / badges">
        <SegmentedControl
          ariaLabel="Тип каталога"
          value={kind}
          onChange={setKind}
          options={[
            { value: "product", label: "Товары" },
            { value: "service", label: "Услуги" },
          ]}
        />
        <div className="flex flex-wrap gap-2">
          <FilterChip active onRemove={() => undefined}>
            Автоматика
          </FilterChip>
          <FilterChip>Алматы</FilterChip>
          <Badge tone="brand">бренд</Badge>
          <Badge tone="success">сохранено</Badge>
          <Badge tone="warning">по запросу</Badge>
          <Badge tone="error">ошибка</Badge>
          <Badge tone="info">демо</Badge>
        </div>
      </Section>

      <Section title="Quantity stepper">
        <div className="flex flex-wrap items-start gap-6">
          <div className="space-y-1">
            <p className="text-xs text-[var(--text-secondary)]">qty 1</p>
            <QuantityStepper value={1} onChange={() => undefined} />
          </div>
          <div className="space-y-1">
            <p className="text-xs text-[var(--text-secondary)]">qty 91 + presets</p>
            <QuantityStepper value={qty} onChange={setQty} presets={[10, 100]} />
          </div>
          <div className="space-y-1">
            <p className="text-xs text-[var(--text-secondary)]">disabled −</p>
            <QuantityStepper value={1} min={1} onChange={() => undefined} />
          </div>
          <div className="space-y-1">
            <p className="text-xs text-[var(--text-secondary)]">pending</p>
            <QuantityStepper value={3} pending onChange={() => undefined} />
          </div>
          <div className="space-y-1">
            <p className="text-xs text-[var(--text-secondary)]">error</p>
            <QuantityStepper value={2} error onChange={() => undefined} />
          </div>
        </div>
      </Section>

      <Section title="Catalog / estimate rows">
        <div className="overflow-hidden rounded-[var(--radius-panel)] border border-[var(--border)] bg-[var(--panel)]">
          <CatalogRow
            name="Автомат 1P 16A"
            meta="C · 1 полюс · демо-цена"
            price="1820"
            unit="шт."
            demo
            action={<Button size="sm">Добавить</Button>}
          />
          <CatalogRow name="Монтаж точки" price={null} unit="точка" unknownPrice action={<Button size="sm">Добавить</Button>} />
        </div>
        <EstimateLine
          name="Автомат 1P 16A"
          unitPrice="1820"
          unit="шт."
          lineTotal="3640"
          stepper={<QuantityStepper value={qty} onChange={setQty} />}
          onRemove={() => undefined}
        />
        <Summary total="10340" complete>
          <InlineFeedback tone="info" className="mt-3">
            Что входит в сумму — раскрывается в рабочей смете
          </InlineFeedback>
        </Summary>
        <Price value="8960" size="lg" />
      </Section>

      <Section title="Feedback / overlays">
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            onClick={() => toast.push({ title: "Смета сохранена", tone: "success", description: "Черновик обновлён" })}
          >
            Toast success
          </Button>
          <Button
            variant="secondary"
            onClick={() =>
              toast.push({
                title: "Не удалось скачать PDF",
                tone: "error",
                description: "Повторите действие",
                durationMs: null,
                action: { label: "Повторить", onClick: () => undefined },
              })
            }
          >
            Toast error
          </Button>
          <Button variant="secondary" onClick={() => toast.push({ title: "Предупреждение", tone: "warning" })}>
            Warning
          </Button>
          <Button variant="secondary" onClick={() => toast.push({ title: "Информация", tone: "info" })}>
            Info
          </Button>
          <Button variant="secondary" onClick={() => toast.push({ title: "Нейтральное", tone: "neutral" })}>
            Neutral
          </Button>
          <Button variant="secondary" onClick={() => setDialog(true)}>
            Dialog
          </Button>
          <Button variant="secondary" onClick={() => setSheet(true)}>
            Sheet
          </Button>
          <Menu label="Скачать смету ▾">
            <MenuItem>PDF</MenuItem>
            <MenuItem>XLSX</MenuItem>
            <MenuItem disabled>DOCX · временно недоступно</MenuItem>
          </Menu>
        </div>
        <EmptyState
          title="Добавьте товары или услуги из каталога"
          description="Смета уже видна — позиции появятся здесь."
          action={<Button size="sm">К каталогу</Button>}
        />
        <InlineFeedback tone="error">Ошибка PDF. Повторить</InlineFeedback>
      </Section>

      <Dialog open={dialog} onClose={() => setDialog(false)} title="Пример диалога">
        <p className="text-sm text-[var(--text-secondary)]">Компактный диалог UI kit.</p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setDialog(false)}>
            Отмена
          </Button>
          <Button onClick={() => setDialog(false)}>Ок</Button>
        </div>
      </Dialog>
      <Sheet open={sheet} onClose={() => setSheet(false)} title="Смета · 2 позиции">
        <p className="text-sm text-[var(--text-secondary)]">Мобильная панель сметы.</p>
      </Sheet>
    </main>
  );
}
