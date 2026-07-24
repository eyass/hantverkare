import { Fragment } from "react";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { SignForm } from "./SignForm";
import { DeclineForm } from "./DeclineForm";
import { CommentsThread } from "./CommentsThread";
import { DepositPayPrompt } from "./DepositPayPrompt";
import { groupLineItems } from "@/lib/quotes/groupLineItems";
import { groupPhotosByLineItem, photosForLineItem } from "@/lib/quotes/photosByLineItem";
import { QUOTE_PHOTOS_BUCKET } from "@/lib/quotes/photoValidation";
import { formatEuros, formatDate } from "@/lib/format";

const PHOTO_SIGNED_URL_TTL_SECONDS = 60 * 60; // 1 hour, plenty for a page view

export default async function PublicQuotePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = createAdminClient();

  const { data: quote, error: quoteError } = await supabase
    .from("quotes")
    .select(
      "id, customer_description, status, subtotal_cents, vat_cents, total_cents, signed_at, signer_name, declined_at, decline_reason, deposit_percent, deposit_amount_cents, deposit_paid_at, viewed_at",
    )
    .eq("share_token", token)
    .single();
  if (!quote) {
    if (quoteError) {
      console.error("Failed to load public quote by share_token", quoteError);
    }
    notFound();
  }

  // Defense in depth: a draft quote's pricing detail is never fetched or rendered for
  // the public link, even though an unguessable share_token is the primary access
  // control. Drafts aren't meant to be shared yet.
  if (quote.status === "draft") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0f172a] p-6">
        <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-xl">
          <h1 className="text-xl font-semibold text-[#0f172a]">Angebot</h1>
          <p className="mt-4 text-sm text-[#64748b]">
            Dieses Angebot ist noch nicht bereit zur Ansicht.
          </p>
        </div>
      </div>
    );
  }

  // Quote view tracking (issue #208) -- stamp viewed_at the first time this
  // page is loaded for the quote, set-once/never-unset like paid_at /
  // deposit_paid_at. Fire-and-forget: this must never slow down or block
  // rendering the page for the customer, and a failed write here is not
  // worth surfacing to them.
  if (!quote.viewed_at) {
    supabase
      .from("quotes")
      .update({ viewed_at: new Date().toISOString() })
      .eq("id", quote.id)
      .is("viewed_at", null)
      .then(({ error: viewedAtError }) => {
        if (viewedAtError) {
          console.error("Failed to stamp viewed_at for quote", quote.id, viewedAtError);
        }
      });
  }

  const { data: lineItems, error: lineItemsError } = await supabase
    .from("quote_line_items")
    .select("id, description, quantity, unit, unit_price_cents, line_total_cents, position, group_label")
    .eq("quote_id", quote.id)
    .order("position");
  if (lineItemsError) {
    console.error("Failed to load line items for public quote", quote.id, lineItemsError);
    notFound();
  }

  const { data: commentRows } = await supabase
    .from("quote_comments")
    .select("id, author_type, author_name, body, created_at")
    .eq("quote_id", quote.id)
    .order("created_at", { ascending: true });

  // Customer-visible photo-per-line-item (issue #208) -- tagged photos are
  // shown next to their line item below; untagged (general job) photos
  // aren't rendered on this page today and this change doesn't add that.
  const { data: photoRows } = await supabase
    .from("quote_photos")
    .select("id, storage_path, caption, quote_line_item_id")
    .eq("quote_id", quote.id);
  const taggedPhotoRows = (photoRows ?? []).filter((photo) => photo.quote_line_item_id !== null);
  const photosByLineItem = groupPhotosByLineItem(
    await Promise.all(
      taggedPhotoRows.map(async (photo) => {
        const { data: signed } = await supabase.storage
          .from(QUOTE_PHOTOS_BUCKET)
          .createSignedUrl(photo.storage_path, PHOTO_SIGNED_URL_TTL_SECONDS);
        return {
          id: photo.id,
          url: signed?.signedUrl ?? null,
          caption: photo.caption,
          quote_line_item_id: photo.quote_line_item_id,
        };
      }),
    ),
  );

  // Multi-room / multi-phase clustering (issue #205) -- renders exactly as
  // today (flat list) when no item has a group_label; see
  // lib/quotes/groupLineItems.ts.
  const grouped = groupLineItems(lineItems ?? [], {
    getGroupLabel: (item) => item.group_label,
    getLineTotalCents: (item) => item.line_total_cents,
    getPosition: (item) => item.position,
  });

  return (
    <div className="min-h-screen bg-[#0f172a] px-4 py-10 sm:px-8">
      <div className="mx-auto flex max-w-3xl flex-col gap-6 rounded-2xl bg-white p-6 shadow-xl sm:p-10">
        <div>
          <h1 className="text-2xl font-semibold text-[#0f172a]">Angebot</h1>
          <p className="mt-1 text-sm text-[#64748b]">{quote.customer_description}</p>
        </div>

        <div className="overflow-x-auto rounded-xl border border-[#e9edf2]">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-[#e9edf2] bg-[#f4f6f8] text-[#64748b]">
                <th className="px-4 py-3 font-medium">Beschreibung</th>
                <th className="px-4 py-3 font-medium">Menge</th>
                <th className="px-4 py-3 font-medium">Einheit</th>
                <th className="px-4 py-3 font-medium">Einzelpreis</th>
                <th className="px-4 py-3 font-medium">Gesamt</th>
              </tr>
            </thead>
            <tbody>
              {grouped.groups.map((group, groupIndex) => (
                <Fragment key={group.label ?? `ungrouped-${groupIndex}`}>
                  {grouped.hasGroups && (
                    <tr className="bg-[#f4f6f8]">
                      <td colSpan={5} className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-[#64748b]">
                        {group.label ?? "Weitere Positionen"}
                      </td>
                    </tr>
                  )}
                  {group.items.map((item) => (
                    <tr key={item.id} className="border-b border-[#e9edf2] last:border-b-0">
                      <td className="px-4 py-3 text-[#0f172a]">
                        {item.description}
                        {photosForLineItem(photosByLineItem, item.id).length > 0 && (
                          <div className="mt-1.5 flex flex-wrap gap-1.5">
                            {photosForLineItem(photosByLineItem, item.id).map((photo) =>
                              photo.url ? (
                                <a key={photo.id} href={photo.url} target="_blank" rel="noreferrer">
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img
                                    src={photo.url}
                                    alt={photo.caption ?? "Foto zur Position"}
                                    className="h-12 w-12 rounded-lg object-cover"
                                  />
                                </a>
                              ) : null,
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 font-mono text-[#0f172a]">{item.quantity}</td>
                      <td className="px-4 py-3 text-[#64748b]">{item.unit}</td>
                      <td className="px-4 py-3 font-mono text-[#0f172a]">{formatEuros(item.unit_price_cents)}</td>
                      <td className="px-4 py-3 font-mono text-[#0f172a]">{formatEuros(item.line_total_cents)}</td>
                    </tr>
                  ))}
                  {grouped.hasGroups && (
                    <tr className="border-b border-[#e9edf2] last:border-b-0 bg-[#f8fafc]">
                      <td colSpan={4} className="px-4 py-2 text-right text-xs font-medium text-[#64748b]">
                        Zwischensumme
                      </td>
                      <td className="px-4 py-2 font-mono text-xs font-semibold text-[#0f172a]">
                        {formatEuros(group.subtotalCents)}
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col items-end gap-1 self-end text-sm">
          <p className="text-[#64748b]">
            Zwischensumme: <span className="font-mono text-[#0f172a]">{formatEuros(quote.subtotal_cents)}</span>
          </p>
          <p className="text-[#64748b]">
            MwSt. (19%): <span className="font-mono text-[#0f172a]">{formatEuros(quote.vat_cents)}</span>
          </p>
          <p className="text-base font-semibold text-[#0f172a]">
            Gesamt: <span className="font-mono">{formatEuros(quote.total_cents)}</span>
          </p>
        </div>

        {quote.status === "final" && !quote.declined_at && (
          <>
            <SignForm token={token} />
            <DeclineForm token={token} />
          </>
        )}

        {quote.status === "signed" && !quote.declined_at && (
          <div className="rounded-2xl bg-[#dcfce7] p-6 text-center">
            <p className="text-sm font-medium text-[#16a34a]">
              Signiert am {quote.signed_at ? formatDate(quote.signed_at) : "-"} von {quote.signer_name ?? "-"}.
            </p>
          </div>
        )}

        {quote.status === "signed" && !quote.declined_at && quote.deposit_percent && !quote.deposit_paid_at && (
          <DepositPayPrompt
            token={token}
            depositPercent={quote.deposit_percent}
            depositAmountCents={quote.deposit_amount_cents}
          />
        )}

        {quote.status === "signed" && !quote.declined_at && quote.deposit_percent && quote.deposit_paid_at && (
          <div className="rounded-2xl bg-[#dcfce7] p-4 text-center">
            <p className="text-sm font-medium text-[#16a34a]">
              Anzahlung von {quote.deposit_percent}% erhalten am {formatDate(quote.deposit_paid_at)}.
            </p>
          </div>
        )}

        {quote.declined_at && (
          <div className="rounded-2xl bg-[#fee2e2] p-6 text-center">
            <p className="text-sm font-medium text-[#b91c1c]">
              Abgelehnt am {formatDate(quote.declined_at)}.
              {quote.decline_reason ? ` Grund: ${quote.decline_reason}` : ""}
            </p>
          </div>
        )}

        <CommentsThread token={token} initialComments={commentRows ?? []} />
      </div>
    </div>
  );
}
