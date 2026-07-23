"use client";

import { useState, useTransition } from "react";
import { requestPortalAccess } from "./actions";

export function RequestForm() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await requestPortalAccess(email);
      setMessage(result.message);
    });
  }

  if (message) {
    return (
      <div className="rounded-2xl bg-[#dcfce7] p-6 text-center">
        <p className="text-sm font-medium text-[#16a34a]">{message}</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-left text-sm text-[#0f172a]">
        E-Mail-Adresse
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={isPending}
          placeholder="ihre.email@beispiel.de"
          className="rounded-xl border border-[#e9edf2] bg-white px-3 py-2 text-[#0f172a] placeholder:text-[#94a3b8] focus:border-[#0f172a] focus:outline-none focus:ring-1 focus:ring-[#0f172a] disabled:opacity-50"
        />
      </label>
      <button
        type="submit"
        disabled={isPending}
        className="rounded-full bg-[#0f172a] px-5 py-3 text-sm font-medium text-white shadow-[0_6px_16px_rgba(15,23,42,0.3)] transition-colors hover:bg-[#1e293b] disabled:opacity-50"
      >
        {isPending ? "Wird gesendet ..." : "Zugangslink anfordern"}
      </button>
    </form>
  );
}
