"use client";

import { useState, useTransition } from "react";
import { convertQuoteToContract } from "./actions";
import { CONTRACT_INTERVALS, CONTRACT_INTERVAL_LABELS, type ContractInterval } from "@/lib/contracts/interval";
import { formatDateShort as formatDate } from "@/lib/format";

type Contract = {
  id: string;
  interval: ContractInterval;
  status: string;
  next_due_date: string;
};

export function ContractSection({
  quoteId,
  contract: initialContract,
}: {
  quoteId: string;
  contract: Contract | null;
}) {
  const [contract, setContract] = useState(initialContract);
  const [interval, setInterval] = useState<ContractInterval>("yearly");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleConvert() {
    startTransition(async () => {
      const result = await convertQuoteToContract(quoteId, interval);
      if (result.error !== null) {
        setError(result.error);
        return;
      }
      setError(null);
      setContract(result.contract);
    });
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-[#e9edf2] bg-[#f8fafc] p-4">
      <h2 className="text-sm font-semibold text-[#0f172a]">Wartungsvertrag</h2>
      {error && <p className="text-sm text-[#dc2626]">{error}</p>}
      {contract ? (
        <dl className="flex flex-col gap-1.5 text-sm">
          <div className="flex justify-between">
            <dt className="text-[#64748b]">Intervall</dt>
            <dd className="font-medium text-[#0f172a]">{CONTRACT_INTERVAL_LABELS[contract.interval]}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-[#64748b]">Status</dt>
            <dd className="font-medium text-[#0f172a]">
              {contract.status === "active" ? "Aktiv" : contract.status === "paused" ? "Pausiert" : "Gekündigt"}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-[#64748b]">Nächste Fälligkeit</dt>
            <dd className="font-mono text-[#0f172a]">{formatDate(contract.next_due_date)}</dd>
          </div>
        </dl>
      ) : (
        <div className="flex flex-col gap-2">
          <label className="flex flex-col gap-1 text-xs text-[#64748b]">
            Intervall
            <select
              value={interval}
              onChange={(e) => setInterval(e.target.value as ContractInterval)}
              className="rounded-xl border border-[#e9edf2] bg-white px-3 py-2 text-sm text-[#0f172a]"
            >
              {CONTRACT_INTERVALS.map((value) => (
                <option key={value} value={value}>
                  {CONTRACT_INTERVAL_LABELS[value]}
                </option>
              ))}
            </select>
          </label>
          <button
            onClick={handleConvert}
            disabled={isPending}
            className="w-full rounded-full bg-[#2563eb] px-5 py-2.5 text-sm font-medium text-white shadow-[0_6px_16px_rgba(37,99,235,0.3)] transition-colors hover:bg-[#1d4ed8] disabled:opacity-50"
          >
            In Wartungsvertrag umwandeln
          </button>
        </div>
      )}
    </div>
  );
}
