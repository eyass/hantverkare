"use client";

import { useState, useTransition } from "react";
import { setGallerySharing } from "./actions";

export function GallerySection({
  quoteId,
  galleryToken,
  initialEnabled,
  hasPhotos,
}: {
  quoteId: string;
  galleryToken: string;
  initialEnabled: boolean;
  hasPhotos: boolean;
}) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleToggle() {
    const previous = enabled;
    const next = !enabled;
    setEnabled(next);
    setError(null);
    startTransition(async () => {
      const result = await setGallerySharing(quoteId, next);
      if (result.error) {
        setEnabled(previous);
        setError(result.error);
      }
    });
  }

  const galleryUrl = `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/gallery/${galleryToken}`;

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-[#e9edf2] bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-[#0f172a]">Vorher/Nachher-Galerie</h2>
          <p className="mt-1 text-xs text-[#64748b]">
            Veröffentlicht die Baustellenfotos dieses Auftrags auf einer öffentlichen Seite, die du z. B. bei
            Social Media oder WhatsApp teilen kannst. Standardmäßig deaktiviert -- ohne deine ausdrückliche
            Freigabe wird nichts veröffentlicht.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          onClick={handleToggle}
          disabled={isPending || !hasPhotos}
          title={hasPhotos ? undefined : "Erst Fotos hinzufügen, um die Galerie zu aktivieren."}
          className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-40 ${
            enabled ? "bg-[#2563eb]" : "bg-[#cbd5e1]"
          }`}
        >
          <span
            className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
              enabled ? "translate-x-[22px]" : "translate-x-0.5"
            }`}
          />
        </button>
      </div>

      {error && <p className="text-sm text-[#dc2626]">{error}</p>}

      {!hasPhotos && (
        <p className="text-xs text-[#94a3b8]">Für diesen Auftrag sind noch keine Fotos vorhanden.</p>
      )}

      {enabled && (
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="text-[#64748b]">Öffentlicher Galerie-Link</span>
          <input
            readOnly
            value={galleryUrl}
            onFocus={(e) => e.target.select()}
            className="font-mono w-full rounded-xl border border-[#e9edf2] bg-[#f8fafc] px-3 py-2 text-xs text-[#0f172a]"
          />
        </label>
      )}
    </div>
  );
}
