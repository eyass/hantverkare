"use client";

import { useState, useTransition } from "react";
import { addMemberComment, type QuoteCommentRow } from "./actions";

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("de-DE", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Tradesperson-side half of the #155 comment thread -- mirrors
// PhotosSection's "list + inline add form" shape. Visible regardless of
// quote status: a customer question can arrive at any point once a quote
// has been shared (final, signed, or declined).
export function CommentsSection({
  quoteId,
  comments,
}: {
  quoteId: string;
  comments: QuoteCommentRow[];
}) {
  const [items, setItems] = useState(comments);
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await addMemberComment(quoteId, body);
      if (result.error || !result.comment) {
        setError(result.error ?? "Nachricht konnte nicht gespeichert werden.");
        return;
      }
      setError(null);
      setItems((prev) => [...prev, result.comment as QuoteCommentRow]);
      setBody("");
    });
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-[#e9edf2] bg-white p-4">
      <h2 className="text-sm font-semibold text-[#0f172a]">Fragen &amp; Kommentare</h2>

      {items.length === 0 && (
        <p className="text-sm text-[#64748b]">Noch keine Nachrichten zu diesem Angebot.</p>
      )}

      {items.length > 0 && (
        <ul className="flex flex-col gap-3">
          {items.map((comment) => (
            <li
              key={comment.id}
              className={`flex flex-col gap-1 rounded-xl border px-3 py-2 ${
                comment.author_type === "customer"
                  ? "border-[#e9edf2] bg-[#f8fafc]"
                  : "border-[#dbeafe] bg-[#eff6ff]"
              }`}
            >
              <div className="flex items-center justify-between text-xs text-[#64748b]">
                <span className="font-medium text-[#0f172a]">
                  {comment.author_type === "customer" ? "Kunde" : comment.author_name}
                </span>
                <span>{formatDateTime(comment.created_at)}</span>
              </div>
              <p className="whitespace-pre-wrap text-sm text-[#0f172a]">{comment.body}</p>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-2">
        {error && <p className="text-sm text-[#dc2626]">{error}</p>}
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          disabled={isPending}
          rows={2}
          maxLength={2000}
          className="rounded-xl border border-[#e9edf2] bg-white px-3 py-2 text-sm text-[#0f172a] placeholder:text-[#94a3b8] focus:border-[#2563eb] focus:outline-none focus:ring-1 focus:ring-[#2563eb] disabled:opacity-50"
          placeholder="Antwort an den Kunden schreiben ..."
        />
        <button
          type="submit"
          disabled={isPending || body.trim().length === 0}
          className="self-end rounded-full bg-[#0f172a] px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-[#1e293b] disabled:opacity-50"
        >
          Senden
        </button>
      </form>
    </div>
  );
}
