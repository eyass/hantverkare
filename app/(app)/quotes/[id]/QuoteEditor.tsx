"use client";

import { Fragment, useMemo, useState, useTransition } from "react";
import {
  updateLineItem,
  finalizeQuote,
  assignQuote,
  addSuggestedLineItem,
  addManualLineItem,
  bulkAdjustLineItemPrices,
} from "./actions";
import { groupLineItems } from "@/lib/quotes/groupLineItems";
import { formatEuros, formatDate } from "@/lib/format";
import { InvoiceSection } from "./InvoiceSection";
import { WarrantySection, type WarrantyRecord } from "./WarrantySection";
import { ContractSection } from "./ContractSection";
import { SaveAsTemplateSection } from "./SaveAsTemplateSection";
import type { ContractInterval } from "@/lib/contracts/interval";
import { computeQuoteDisplayStatus } from "@/lib/quotes/status";
import { computeProfitability } from "@/lib/quotes/profitability";
import type { CostEstimationSuggestion } from "@/lib/quotes/costEstimation";
import { PhotosSection } from "./PhotosSection";
import { GallerySection } from "./GallerySection";
import { ScheduleSection } from "./ScheduleSection";
import { CommentsSection } from "./CommentsSection";
import { DepositSection } from "./DepositSection";
import { RiskFlagsNotice, type RiskFlag } from "./RiskFlagsNotice";
import { ClarifyingQuestionsSection } from "./ClarifyingQuestionsSection";
import type { QuoteCommentRow } from "./actions";

type LineItem = {
  id: string;
  description: string;
  quantity: number;
  unit: string;
  unit_price_cents: number;
  cost_cents: number | null;
  line_total_cents: number;
  position: number;
  price_list_item_id?: string | null;
  item_type?: "labor" | "material" | null;
  quantity_reasoning?: string | null;
  confidence?: "high" | "medium" | "low" | null;
  group_label?: string | null;
};

type Quote = {
  id: string;
  customer_description: string;
  status: string;
  subtotal_cents: number;
  vat_cents: number;
  total_cents: number;
  share_token: string;
  gallery_token: string;
  gallery_enabled: boolean;
  declined_at: string | null;
  decline_reason: string | null;
  assigned_to: string | null;
  deposit_percent: number | null;
  deposit_amount_cents: number | null;
  deposit_paid_at: string | null;
  ai_risk_flags: RiskFlag[] | null;
  ai_risk_flags_acknowledged_at: string | null;
  ai_clarifying_questions: string[] | null;
  ai_clarifying_questions_resolved_at: string | null;
  viewed_at: string | null;
};

type Member = {
  userId: string;
  email: string;
  role: "owner" | "member";
};

type Invoice = {
  id: string;
  invoice_number: string;
  issued_at: string;
  subtotal_cents: number;
  vat_cents: number;
  total_cents: number;
  payment_status: "unpaid" | "partial" | "paid";
  amount_paid_cents: number;
};

type Photo = {
  id: string;
  url: string | null;
  caption: string | null;
  quote_line_item_id: string | null;
};

type ScheduledJob = {
  id: string;
  scheduled_start: string;
  scheduled_end: string | null;
  notes: string | null;
};

function statusLabel(status: string): string {
  if (status === "declined") return "Abgelehnt";
  if (status === "final") return "Final";
  if (status === "signed") return "Signiert";
  return "Entwurf";
}

function statusBadgeClasses(status: string): string {
  if (status === "declined") return "bg-[#fee2e2] text-[#b91c1c]";
  if (status === "final") return "bg-[#dbeafe] text-[#1d4ed8]";
  if (status === "signed") return "bg-[#dcfce7] text-[#16a34a]";
  return "bg-[#f1f5f9] text-[#64748b]";
}

function formatPercent(ratio: number): string {
  return ratio.toLocaleString("de-DE", { style: "percent", maximumFractionDigits: 1 });
}

function centsToEuroString(cents: number): string {
  return (cents / 100).toFixed(2);
}

type Contract = {
  id: string;
  interval: ContractInterval;
  status: string;
  next_due_date: string;
};

type UpsellSuggestion = {
  priceListItemId: string;
  label: string;
  unit: string;
  unitPriceCents: number;
  coOccurrenceCount: number;
};

export function QuoteEditor({
  quote,
  lineItems,
  invoice,
  unbilledHours = 0,
  connectOnboarded,
  contract,
  photos,
  warranty,
  scheduledJob,
  members,
  upsellSuggestions,
  comments,
  costSuggestions = {},
}: {
  quote: Quote;
  lineItems: LineItem[];
  invoice: Invoice | null;
  unbilledHours?: number;
  connectOnboarded: boolean;
  contract: Contract | null;
  photos: Photo[];
  warranty: WarrantyRecord | null;
  scheduledJob: ScheduledJob | null;
  members: Member[];
  upsellSuggestions: UpsellSuggestion[];
  comments: QuoteCommentRow[];
  costSuggestions?: Record<string, CostEstimationSuggestion>;
}) {
  const [items, setItems] = useState(lineItems);
  const [dismissedSuggestionIds, setDismissedSuggestionIds] = useState<Set<string>>(new Set());
  const [lastSavedItems, setLastSavedItems] = useState(lineItems);
  const [totals, setTotals] = useState({
    subtotalCents: quote.subtotal_cents,
    vatCents: quote.vat_cents,
    totalCents: quote.total_cents,
  });
  const [status, setStatus] = useState(quote.status);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [assignedTo, setAssignedTo] = useState(quote.assigned_to);
  const [isAssignPending, startAssignTransition] = useTransition();
  const [suggestions, setSuggestions] = useState(upsellSuggestions);
  const [addingSuggestionId, setAddingSuggestionId] = useState<string | null>(null);
  const [manualDescription, setManualDescription] = useState("");
  const [isManualAddPending, startManualAddTransition] = useTransition();
  const [bulkAdjustPercent, setBulkAdjustPercent] = useState("");
  const [isBulkAdjustPending, startBulkAdjustTransition] = useTransition();
  const isDraft = status === "draft";
  const displayStatus = computeQuoteDisplayStatus({ status, declinedAt: quote.declined_at });
  const profitability = computeProfitability(
    items.map((item) => ({ lineTotalCents: item.line_total_cents, costCents: item.cost_cents })),
  );

  // Multi-room / multi-phase clustering (issue #205) -- renders exactly as
  // today (flat list, `grouped.hasGroups === false`) when no item has a
  // group_label; see lib/quotes/groupLineItems.ts.
  const grouped = useMemo(
    () =>
      groupLineItems(items, {
        getGroupLabel: (item) => item.group_label,
        getLineTotalCents: (item) => item.line_total_cents,
        getPosition: (item) => item.position,
      }),
    [items],
  );
  const existingGroupLabels = useMemo(
    () =>
      Array.from(
        new Set(
          items
            .map((item) => item.group_label?.trim())
            .filter((label): label is string => !!label && label.length > 0),
        ),
      ),
    [items],
  );

  function handleFieldChange(
    itemId: string,
    field: "description" | "quantity" | "unit_price_cents" | "cost_cents",
    value: string,
  ) {
    setItems((prev) =>
      prev.map((item) =>
        item.id === itemId
          ? {
              ...item,
              [field]:
                field === "quantity" || field === "unit_price_cents" || field === "cost_cents"
                  ? field === "cost_cents" && value === ""
                    ? null
                    : Number(value)
                  : value,
            }
          : item,
      ),
    );
  }

  function handleGroupChange(itemId: string, value: string) {
    setItems((prev) =>
      prev.map((item) => (item.id === itemId ? { ...item, group_label: value } : item)),
    );
  }

  function handleBlurSave(item: LineItem) {
    startTransition(async () => {
      const result = await updateLineItem(quote.id, item.id, {
        description: item.description,
        quantity: item.quantity,
        unit: item.unit,
        unitPriceCents: item.unit_price_cents,
        costCents: item.cost_cents,
        groupLabel: item.group_label ?? null,
      });
      if (result.error !== null) {
        setError(result.error);
        setItems((prev) =>
          prev.map((i) => (i.id === item.id ? (lastSavedItems.find((saved) => saved.id === item.id) ?? i) : i)),
        );
        return;
      }
      setError(null);
      setItems(result.lineItems);
      setLastSavedItems(result.lineItems);
      setTotals(result.totals);
    });
  }

  function handleAssign(nextUserId: string) {
    const previous = assignedTo;
    const nextValue = nextUserId === "" ? null : nextUserId;
    setAssignedTo(nextValue);
    startAssignTransition(async () => {
      const result = await assignQuote(quote.id, nextValue);
      if (result.error) {
        setAssignedTo(previous);
        setError(result.error);
        return;
      }
      setError(null);
    });
  }

  function handleAddSuggestion(suggestion: UpsellSuggestion) {
    setAddingSuggestionId(suggestion.priceListItemId);
    startTransition(async () => {
      const result = await addSuggestedLineItem(quote.id, suggestion.priceListItemId);
      setAddingSuggestionId(null);
      if (result.error !== null) {
        setError(result.error);
        return;
      }
      setError(null);
      setItems(result.lineItems);
      setLastSavedItems(result.lineItems);
      setTotals(result.totals);
      setSuggestions((prev) => prev.filter((s) => s.priceListItemId !== suggestion.priceListItemId));
    });
  }

  function handleAddManualLineItem() {
    const description = manualDescription.trim();
    if (description.length === 0) return;
    startManualAddTransition(async () => {
      const result = await addManualLineItem(quote.id, description);
      if (result.error !== null) {
        setError(result.error);
        return;
      }
      setError(null);
      setItems(result.lineItems);
      setLastSavedItems(result.lineItems);
      setTotals(result.totals);
      setManualDescription("");
    });
  }

  function handleBulkAdjustPrices() {
    const percent = Number(bulkAdjustPercent);
    if (!Number.isFinite(percent) || percent === 0) return;
    const direction = percent > 0 ? "erhöht" : "reduziert";
    const confirmed = window.confirm(
      `Alle Einzelpreise um ${Math.abs(percent)}% ${direction}. Fortfahren?`,
    );
    if (!confirmed) return;
    startBulkAdjustTransition(async () => {
      const result = await bulkAdjustLineItemPrices(quote.id, percent);
      if (result.error !== null) {
        setError(result.error);
        return;
      }
      setError(null);
      setItems(result.lineItems);
      setLastSavedItems(result.lineItems);
      setTotals(result.totals);
      setBulkAdjustPercent("");
    });
  }

  function handleFinalize() {
    startTransition(async () => {
      const result = await finalizeQuote(quote.id);
      if (result.error) {
        setError(result.error);
        return;
      }
      setError(null);
      setStatus("final");
    });
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 p-6 sm:p-8">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold text-[#0f172a]">Angebot</h1>
        <span
          className={`rounded-full px-3 py-1 text-xs font-medium ${statusBadgeClasses(displayStatus)}`}
        >
          {statusLabel(displayStatus)}
        </span>
        {(displayStatus === "final" || displayStatus === "signed") && (
          <span className="text-xs text-[#94a3b8]">
            {quote.viewed_at
              ? `Angesehen am ${formatDate(quote.viewed_at)}`
              : "Noch nicht vom Kunden angesehen"}
          </span>
        )}
      </div>
      <p className="text-[#64748b]">{quote.customer_description}</p>

      {quote.ai_clarifying_questions &&
        quote.ai_clarifying_questions.length > 0 &&
        !quote.ai_clarifying_questions_resolved_at && (
          <ClarifyingQuestionsSection
            quoteId={quote.id}
            questions={quote.ai_clarifying_questions}
          />
        )}

      {quote.declined_at && (
        <p className="rounded-xl border border-[#fecaca] bg-red-50 px-4 py-2 text-sm text-[#b91c1c]">
          Vom Kunden abgelehnt.{quote.decline_reason ? ` Grund: ${quote.decline_reason}` : ""}
        </p>
      )}

      {members.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-[#e9edf2] bg-white px-4 py-3">
          <label htmlFor="assign-to" className="text-sm font-medium text-[#0f172a]">
            Zugewiesen an
          </label>
          <select
            id="assign-to"
            value={assignedTo ?? ""}
            disabled={isAssignPending}
            onChange={(e) => handleAssign(e.target.value)}
            className="rounded-md border border-[#e9edf2] px-3 py-2 text-sm disabled:opacity-50"
          >
            <option value="">Niemand</option>
            {members.map((member) => (
              <option key={member.userId} value={member.userId}>
                {member.email}
              </option>
            ))}
          </select>
        </div>
      )}

      {error && (
        <p className="rounded-xl border border-[#fecaca] bg-red-50 px-4 py-2 text-sm text-[#dc2626]">{error}</p>
      )}

      {quote.ai_risk_flags && quote.ai_risk_flags.length > 0 && (
        <RiskFlagsNotice
          quoteId={quote.id}
          riskFlags={quote.ai_risk_flags}
          acknowledgedAt={quote.ai_risk_flags_acknowledged_at}
        />
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">
        {/* Line items card */}
        <div className="rounded-2xl border border-[#e9edf2] bg-white overflow-x-auto">
          <table className="w-full min-w-[880px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-[#e9edf2] bg-[#f8fafc] text-xs uppercase tracking-wide text-[#94a3b8]">
                <th className="px-4 py-3 font-medium min-w-[240px]">Beschreibung</th>
                <th className="px-4 py-3 font-medium">Menge</th>
                <th className="px-4 py-3 font-medium">Einheit</th>
                <th className="px-4 py-3 font-medium">Einzelpreis</th>
                <th className="px-4 py-3 font-medium">
                  Kosten (intern)
                </th>
                <th className="px-4 py-3 font-medium">Gesamt</th>
                <th className="px-4 py-3 font-medium">Bereich</th>
              </tr>
            </thead>
            <tbody>
              {grouped.groups.map((group, groupIndex) => (
                <Fragment key={group.label ?? `ungrouped-${groupIndex}`}>
                  {grouped.hasGroups && (
                    <tr className="bg-[#f8fafc]">
                      <td
                        colSpan={7}
                        className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-[#64748b]"
                      >
                        {group.label ?? "Weitere Positionen"}
                      </td>
                    </tr>
                  )}
                  {group.items.map((item) => {
                const suggestion = costSuggestions[item.id];
                const showSuggestion = suggestion !== undefined && !dismissedSuggestionIds.has(item.id);
                return (
                <Fragment key={item.id}>
                <tr className="border-b border-[#e9edf2] last:border-b-0">
                  <td className="px-4 py-2 min-w-[240px]">
                    <div className="flex items-center gap-2">
                      {item.item_type && (
                        <span
                          className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${
                            item.item_type === "labor"
                              ? "bg-blue-50 text-blue-700"
                              : "bg-emerald-50 text-emerald-700"
                          }`}
                        >
                          {item.item_type === "labor" ? "Arbeit" : "Material"}
                        </span>
                      )}
                      {(item.confidence === "low" || item.confidence === "medium") && (
                        <span
                          className="flex shrink-0 items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-[#94a3b8]"
                          title={
                            item.confidence === "low"
                              ? "Niedrige Sicherheit -- bitte vor dem Versenden prüfen."
                              : "Mittlere Sicherheit -- bitte kurz prüfen."
                          }
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${
                              item.confidence === "low" ? "bg-amber-500" : "bg-amber-300"
                            }`}
                          />
                          {item.confidence === "low" ? "Niedrig" : "Mittel"}
                        </span>
                      )}
                      <input
                        value={item.description}
                        disabled={!isDraft}
                        onChange={(e) => handleFieldChange(item.id, "description", e.target.value)}
                        onBlur={() => handleBlurSave(item)}
                        className="w-full rounded-lg border border-transparent bg-transparent px-2 py-1.5 transition-colors focus:border-[#e9edf2] focus:bg-[#f8fafc] focus:outline-none disabled:opacity-60"
                      />
                    </div>
                    {item.quantity_reasoning && (
                      <p
                        className="line-clamp-2 px-2 pt-0.5 text-xs text-[#94a3b8]"
                        title={item.quantity_reasoning}
                      >
                        {item.quantity_reasoning}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    <input
                      type="number"
                      value={item.quantity}
                      disabled={!isDraft}
                      onChange={(e) => handleFieldChange(item.id, "quantity", e.target.value)}
                      onBlur={() => handleBlurSave(item)}
                      className="w-20 rounded-lg border border-transparent bg-transparent px-2 py-1.5 transition-colors focus:border-[#e9edf2] focus:bg-[#f8fafc] focus:outline-none disabled:opacity-60"
                    />
                  </td>
                  <td className="px-4 py-2 text-[#64748b]">{item.unit}</td>
                  <td className="px-4 py-2">
                    <input
                      type="number"
                      value={item.unit_price_cents / 100}
                      disabled={!isDraft}
                      onChange={(e) =>
                        handleFieldChange(
                          item.id,
                          "unit_price_cents",
                          String(Math.round(Number(e.target.value) * 100)),
                        )
                      }
                      onBlur={() => handleBlurSave(item)}
                      className="font-mono w-24 rounded-lg border border-transparent bg-transparent px-2 py-1.5 transition-colors focus:border-[#e9edf2] focus:bg-[#f8fafc] focus:outline-none disabled:opacity-60"
                    />
                  </td>
                  <td className="px-4 py-2">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="optional"
                      value={item.cost_cents === null ? "" : centsToEuroString(item.cost_cents)}
                      disabled={!isDraft}
                      onChange={(e) =>
                        handleFieldChange(
                          item.id,
                          "cost_cents",
                          e.target.value === "" ? "" : String(Math.round(Number(e.target.value) * 100)),
                        )
                      }
                      onBlur={() => handleBlurSave(item)}
                      className="font-mono w-24 rounded-lg border border-transparent bg-transparent px-2 py-1.5 text-[#64748b] transition-colors placeholder:text-[#cbd5e1] focus:border-[#e9edf2] focus:bg-[#f8fafc] focus:outline-none disabled:opacity-60"
                    />
                  </td>
                  <td className="font-mono px-4 py-2 font-medium text-[#0f172a]">
                    {formatEuros(item.line_total_cents)}
                  </td>
                  <td className="px-4 py-2">
                    <input
                      list="quote-group-labels"
                      value={item.group_label ?? ""}
                      disabled={!isDraft}
                      placeholder="z. B. Küche"
                      onChange={(e) => handleGroupChange(item.id, e.target.value)}
                      onBlur={() => handleBlurSave(item)}
                      className="w-28 rounded-lg border border-transparent bg-transparent px-2 py-1.5 text-xs transition-colors focus:border-[#e9edf2] focus:bg-[#f8fafc] focus:outline-none disabled:opacity-60"
                    />
                  </td>
                </tr>
                {showSuggestion && (
                  <tr key={`${item.id}-suggestion`} className="border-b border-[#e9edf2] last:border-b-0 bg-amber-50">
                    <td colSpan={7} className="px-4 py-2.5">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-amber-900">
                        <span>
                          Ähnliche Positionen aus früheren Aufträgen kosteten im Schnitt{" "}
                          <strong className="font-mono">{formatEuros(suggestion.avgActualCostUnitCents)}</strong> pro
                          Einheit, kalkuliert waren im Schnitt{" "}
                          <strong className="font-mono">{formatEuros(suggestion.avgQuotedUnitCents)}</strong> (
                          {suggestion.sampleSize} Aufträge). Preis anpassen?
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setDismissedSuggestionIds((prev) => {
                              const next = new Set(prev);
                              next.add(item.id);
                              return next;
                            })
                          }
                          className="shrink-0 rounded-full px-2 py-1 font-medium text-amber-700 transition-colors hover:bg-amber-100"
                        >
                          Verwerfen
                        </button>
                      </div>
                    </td>
                  </tr>
                )}
                </Fragment>
                );
              })}
                  {grouped.hasGroups && (
                    <tr className="border-b border-[#e9edf2] last:border-b-0 bg-[#f8fafc]">
                      <td colSpan={5} className="px-4 py-2 text-right text-xs font-medium text-[#64748b]">
                        Zwischensumme
                      </td>
                      <td className="font-mono px-4 py-2 text-xs font-semibold text-[#0f172a]">
                        {formatEuros(group.subtotalCents)}
                      </td>
                      <td />
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
          <datalist id="quote-group-labels">
            {existingGroupLabels.map((label) => (
              <option key={label} value={label} />
            ))}
          </datalist>
          {isDraft && suggestions.length > 0 && (
            <div className="flex flex-col gap-3 border-t border-[#e9edf2] bg-[#f8fafc] px-4 py-4">
              <span className="text-xs font-medium uppercase tracking-wide text-[#94a3b8]">
                Häufig dazu gebucht
              </span>
              <ul className="flex flex-col gap-2">
                {suggestions.map((suggestion) => (
                  <li
                    key={suggestion.priceListItemId}
                    className="flex items-center justify-between gap-3 rounded-xl border border-[#e9edf2] bg-white px-3 py-2 text-sm"
                  >
                    <div className="flex flex-col">
                      <span className="font-medium text-[#0f172a]">{suggestion.label}</span>
                      <span className="text-xs text-[#64748b]">
                        {formatEuros(suggestion.unitPriceCents)} / {suggestion.unit}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleAddSuggestion(suggestion)}
                      disabled={isPending}
                      className="shrink-0 rounded-full border border-[#2563eb] px-3 py-1.5 text-xs font-medium text-[#2563eb] transition-colors hover:bg-[#eff6ff] disabled:opacity-50"
                    >
                      {addingSuggestionId === suggestion.priceListItemId ? "Wird hinzugefügt…" : "+ Hinzufügen"}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {isDraft && (
            <div className="flex flex-col gap-2 border-t border-[#e9edf2] px-4 py-4 sm:flex-row sm:items-center">
              <span className="shrink-0 text-xs font-medium uppercase tracking-wide text-[#94a3b8]">
                Weitere Position hinzufügen
              </span>
              <input
                type="text"
                value={manualDescription}
                onChange={(e) => setManualDescription(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddManualLineItem();
                  }
                }}
                placeholder="z. B. zusätzlicher Wasserhahn"
                disabled={isManualAddPending}
                className="flex-1 rounded-lg border border-[#e9edf2] px-3 py-2 text-sm disabled:opacity-50"
              />
              <button
                type="button"
                onClick={handleAddManualLineItem}
                disabled={isManualAddPending || manualDescription.trim().length === 0}
                className="shrink-0 rounded-full border border-[#2563eb] px-3 py-2 text-xs font-medium text-[#2563eb] transition-colors hover:bg-[#eff6ff] disabled:opacity-50"
              >
                {isManualAddPending ? "Wird ermittelt…" : "+ Hinzufügen"}
              </button>
            </div>
          )}
        </div>

        {/* Summary card */}
        <div className="flex h-fit flex-col gap-4 rounded-2xl border border-[#e9edf2] bg-white p-5 lg:sticky lg:top-6">
          <div className="flex flex-col gap-2 text-sm">
            <div className="flex justify-between text-[#64748b]">
              <span>Zwischensumme</span>
              <span className="font-mono">{formatEuros(totals.subtotalCents)}</span>
            </div>
            <div className="flex justify-between text-[#64748b]">
              <span>MwSt. (19%)</span>
              <span className="font-mono">{formatEuros(totals.vatCents)}</span>
            </div>
            <div className="flex justify-between border-t border-[#e9edf2] pt-2 text-base font-semibold text-[#0f172a]">
              <span>Gesamt</span>
              <span className="font-mono">{formatEuros(totals.totalCents)}</span>
            </div>
          </div>

          {isDraft && (
            <div className="flex flex-col gap-2 rounded-xl border border-[#e9edf2] p-4 text-sm">
              <span className="text-xs font-medium uppercase tracking-wide text-[#94a3b8]">
                Alle Preise anpassen
              </span>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  step="1"
                  value={bulkAdjustPercent}
                  onChange={(e) => setBulkAdjustPercent(e.target.value)}
                  placeholder="z. B. 10 oder -5"
                  disabled={isBulkAdjustPending}
                  className="w-24 rounded-lg border border-[#e9edf2] px-3 py-2 text-sm disabled:opacity-50"
                />
                <span className="text-[#64748b]">%</span>
                <button
                  type="button"
                  onClick={handleBulkAdjustPrices}
                  disabled={isBulkAdjustPending || bulkAdjustPercent.trim().length === 0}
                  className="shrink-0 rounded-full border border-[#e9edf2] px-3 py-2 text-xs font-medium text-[#0f172a] transition-colors hover:bg-[#f8fafc] disabled:opacity-50"
                >
                  {isBulkAdjustPending ? "Wird angepasst…" : "Anwenden"}
                </button>
              </div>
            </div>
          )}

          <div className="flex flex-col gap-2 rounded-xl border border-[#e9edf2] bg-[#f8fafc] p-4 text-sm">
            <span className="text-xs font-medium uppercase tracking-wide text-[#94a3b8]">
              Rohertrag (intern, nicht für Kunden sichtbar)
            </span>
            {profitability.itemsWithCostCount === 0 ? (
              <span className="text-[#64748b]">–</span>
            ) : (
              <>
                <div className="flex justify-between text-[#64748b]">
                  <span>Marge</span>
                  <span className="font-mono text-[#0f172a]">
                    {formatEuros(profitability.marginCents)}
                    {profitability.marginPercent !== null && (
                      <> ({formatPercent(profitability.marginPercent)})</>
                    )}
                  </span>
                </div>
                {profitability.hasIncompleteData && (
                  <span className="text-xs text-[#94a3b8]">
                    Unvollständig: nicht für alle Positionen sind Kosten hinterlegt.
                  </span>
                )}
              </>
            )}
          </div>

          <DepositSection
            quoteId={quote.id}
            status={status}
            totalCents={totals.totalCents}
            depositPercent={quote.deposit_percent}
            depositAmountCents={quote.deposit_amount_cents}
            depositPaidAt={quote.deposit_paid_at}
          />

          {isDraft && (
            <button
              onClick={handleFinalize}
              disabled={isPending}
              className="w-full rounded-full bg-[#2563eb] px-5 py-3 text-sm font-medium text-white shadow-[0_6px_16px_rgba(37,99,235,0.3)] transition-colors hover:bg-[#1d4ed8] disabled:opacity-50"
            >
              Angebot finalisieren
            </button>
          )}

          {(status === "final" || status === "signed") && (
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="text-[#64748b]">Link für den Kunden</span>
              <input
                readOnly
                value={`${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/q/${quote.share_token}`}
                onFocus={(e) => e.target.select()}
                className="font-mono w-full rounded-xl border border-[#e9edf2] bg-[#f8fafc] px-3 py-2 text-xs text-[#0f172a]"
              />
            </label>
          )}

          <a
            href={`/quotes/${quote.id}/pdf`}
            download
            className="w-full rounded-xl border border-[#e9edf2] bg-white px-5 py-2.5 text-center text-sm font-medium text-[#0f172a] transition-colors hover:bg-[#f8fafc]"
          >
            Als PDF herunterladen
          </a>

          {status === "signed" && (
            <InvoiceSection
              quoteId={quote.id}
              invoice={invoice}
              unbilledHours={unbilledHours}
              connectOnboarded={connectOnboarded}
            />
          )}
          {status === "signed" && <WarrantySection warranty={warranty} />}

          {status === "signed" && <ContractSection quoteId={quote.id} contract={contract} />}

          {isDraft && <SaveAsTemplateSection quoteId={quote.id} />}
        </div>
      </div>

      {status === "signed" && <ScheduleSection quoteId={quote.id} job={scheduledJob} />}

      <PhotosSection
        quoteId={quote.id}
        lineItems={items.map((item) => ({ id: item.id, description: item.description }))}
        photos={photos}
      />

      <GallerySection
        quoteId={quote.id}
        galleryToken={quote.gallery_token}
        initialEnabled={quote.gallery_enabled}
        hasPhotos={photos.length > 0}
      />

      <CommentsSection quoteId={quote.id} comments={comments} />
    </div>
  );
}
