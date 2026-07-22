"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { isSearchableQuery, type GroupedSearchResults } from "@/lib/search/formatResults";

const DEBOUNCE_MS = 250;

const EMPTY_RESULTS: GroupedSearchResults = { quotes: [], customers: [] };

export function GlobalSearch() {
  const router = useRouter();
  const [term, setTerm] = useState("");
  const [results, setResults] = useState<GroupedSearchResults>(EMPTY_RESULTS);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const searchable = isSearchableQuery(term);

  useEffect(() => {
    if (!searchable) {
      return;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => {
      setLoading(true);
      fetch(`/api/search?q=${encodeURIComponent(term.trim())}`, {
        signal: controller.signal,
      })
        .then((res) => (res.ok ? res.json() : EMPTY_RESULTS))
        .then((data: GroupedSearchResults) => setResults(data))
        .catch((error) => {
          if (error?.name !== "AbortError") {
            console.error("Global search request failed:", error);
          }
        })
        .finally(() => setLoading(false));
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [term, searchable]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const hasQuery = isSearchableQuery(term);
  const hasResults = results.quotes.length > 0 || results.customers.length > 0;

  function goTo(href: string) {
    setOpen(false);
    setTerm("");
    router.push(href);
  }

  return (
    <div ref={containerRef} className="relative w-full max-w-sm">
      <input
        type="search"
        value={term}
        onChange={(event) => {
          setTerm(event.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder="Suchen..."
        aria-label="Suche nach Angeboten und Kunden"
        className="w-full rounded-full border border-[#e9edf2] bg-white px-4 py-2 text-sm text-[#0f172a] placeholder:text-[#94a3b8] focus:border-[#2563eb] focus:outline-none"
      />

      {open && hasQuery ? (
        <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-50 max-h-[70vh] overflow-y-auto rounded-2xl border border-[#e9edf2] bg-white p-2 shadow-lg">
          {loading ? (
            <p className="px-3 py-4 text-sm text-[#64748b]">Suche läuft...</p>
          ) : !hasResults ? (
            <p className="px-3 py-4 text-sm text-[#64748b]">Keine Ergebnisse gefunden.</p>
          ) : (
            <>
              {results.quotes.length > 0 ? (
                <div className="mb-2">
                  <div className="px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-[#94a3b8]">
                    Angebote
                  </div>
                  {results.quotes.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => goTo(item.href)}
                      className="flex w-full flex-col items-start gap-0.5 rounded-lg px-3 py-2 text-left hover:bg-[#f4f6f8]"
                    >
                      <span className="text-sm font-medium text-[#0f172a]">{item.title}</span>
                      <span className="font-mono text-xs text-[#94a3b8]">{item.subtitle}</span>
                    </button>
                  ))}
                </div>
              ) : null}

              {results.customers.length > 0 ? (
                <div>
                  <div className="px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-[#94a3b8]">
                    Kunden
                  </div>
                  {results.customers.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => goTo(item.href)}
                      className="flex w-full flex-col items-start gap-0.5 rounded-lg px-3 py-2 text-left hover:bg-[#f4f6f8]"
                    >
                      <span className="text-sm font-medium text-[#0f172a]">{item.title}</span>
                      {item.subtitle ? (
                        <span className="text-xs text-[#94a3b8]">{item.subtitle}</span>
                      ) : null}
                    </button>
                  ))}
                </div>
              ) : null}
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
