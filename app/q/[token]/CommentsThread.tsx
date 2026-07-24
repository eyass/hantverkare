"use client";

import { useState, useTransition } from "react";
import { addCustomerComment } from "./actions";
import { formatDateTime } from "@/lib/format";

export type PublicCommentRow = {
  id: string;
  author_type: "customer" | "member";
  author_name: string;
  body: string;
  created_at: string;
};

// Customer-side half of the #155 comment thread, shown on the public
// share-token quote page alongside SignForm/DeclineForm. No auth: the
// share_token is the only credential, exactly like those two forms.
export function CommentsThread({
  token,
  initialComments,
}: {
  token: string;
  initialComments: PublicCommentRow[];
}) {
  const [items, setItems] = useState(initialComments);
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = body.trim();
    if (trimmed.length === 0) return;
    startTransition(async () => {
      const result = await addCustomerComment(token, trimmed);
      if (result.error) {
        setError(result.error);
        return;
      }
      setError(null);
      setItems((prev) => [
        ...prev,
        {
          id: `local-${Date.now()}`,
          author_type: "customer",
          author_name: "Kunde",
          body: trimmed,
          created_at: new Date().toISOString(),
        },
      ]);
      setBody("");
    });
  }

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-[#e9edf2] bg-white p-6">
      <h2 className="text-lg font-semibold text-[#0f172a]">Fragen zu diesem Angebot</h2>

      {items.length > 0 && (
        <ul className="flex flex-col gap-3">
          {items.map((comment) => (
            <li
              key={comment.id}
              className={`flex flex-col gap-1 rounded-xl border px-3 py-2 ${
                comment.author_type === "customer"
                  ? "border-[#dbeafe] bg-[#eff6ff]"
                  : "border-[#e9edf2] bg-[#f8fafc]"
              }`}
            >
              <div className="flex items-center justify-between text-xs text-[#64748b]">
                <span className="font-medium text-[#0f172a]">
                  {comment.author_type === "customer" ? "Sie" : comment.author_name}
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
          rows={3}
          maxLength={2000}
          className="rounded-xl border border-[#e9edf2] bg-white px-3 py-2 text-sm text-[#0f172a] placeholder:text-[#94a3b8] focus:border-[#2563eb] focus:outline-none focus:ring-1 focus:ring-[#2563eb] disabled:opacity-50"
          placeholder="Frage zum Angebot stellen ..."
        />
        <button
          type="submit"
          disabled={isPending || body.trim().length === 0}
          className="self-end rounded-full bg-[#0f172a] px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-[#1e293b] disabled:opacity-50"
        >
          Frage senden
        </button>
      </form>
    </div>
  );
}
