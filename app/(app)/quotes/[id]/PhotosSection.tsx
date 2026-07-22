"use client";

import { useRef, useState, useTransition } from "react";
import { addQuotePhoto, deleteQuotePhoto } from "./actions";
import { validatePhotoFile } from "@/lib/quotes/photoValidation";

type LineItem = {
  id: string;
  description: string;
};

type Photo = {
  id: string;
  url: string | null;
  caption: string | null;
  quote_line_item_id: string | null;
};

export function PhotosSection({
  quoteId,
  lineItems,
  photos: initialPhotos,
}: {
  quoteId: string;
  lineItems: LineItem[];
  photos: Photo[];
}) {
  const [photos, setPhotos] = useState(initialPhotos);
  const [lineItemId, setLineItemId] = useState<string>("");
  const [caption, setCaption] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

  function lineItemLabel(id: string | null): string | null {
    if (!id) return null;
    return lineItems.find((item) => item.id === id)?.description ?? null;
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const validation = validatePhotoFile({ type: file.type, size: file.size });
    if (!validation.ok) {
      setError(validation.error);
      e.target.value = "";
      return;
    }

    const formData = new FormData();
    formData.set("quoteId", quoteId);
    if (lineItemId) formData.set("lineItemId", lineItemId);
    if (caption.trim()) formData.set("caption", caption.trim());
    formData.set("file", file);

    startTransition(async () => {
      const result = await addQuotePhoto(formData);
      if (result.error !== null) {
        setError(result.error);
        return;
      }
      setError(null);
      setCaption("");
      if (fileInputRef.current) fileInputRef.current.value = "";
      // The uploaded photo needs a fresh signed URL; the page doesn't have
      // one yet for this brand-new row, so we show it without a preview
      // image until the page next reloads. Keeping it simple over adding a
      // second server round-trip just to fetch a signed URL for one photo.
      setPhotos((prev) => [
        {
          id: result.photo.id,
          url: null,
          caption: result.photo.caption,
          quote_line_item_id: result.photo.quote_line_item_id,
        },
        ...prev,
      ]);
    });
  }

  function handleDelete(photoId: string) {
    startTransition(async () => {
      const result = await deleteQuotePhoto(photoId);
      if (result.error !== null) {
        setError(result.error);
        return;
      }
      setError(null);
      setPhotos((prev) => prev.filter((photo) => photo.id !== photoId));
    });
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-[#e9edf2] bg-[#f8fafc] p-4">
      <h2 className="text-sm font-semibold text-[#0f172a]">Fotos hinzufügen</h2>
      <p className="text-xs text-[#64748b]">Baustelle vorher/nachher, Zustand vor Ort dokumentieren.</p>

      {error && <p className="text-sm text-[#dc2626]">{error}</p>}

      <div className="flex flex-col gap-2">
        {lineItems.length > 0 && (
          <select
            value={lineItemId}
            onChange={(e) => setLineItemId(e.target.value)}
            className="w-full rounded-xl border border-[#e9edf2] bg-white p-2.5 text-sm text-[#0f172a] outline-none focus:border-[#2563eb]"
          >
            <option value="">Gesamtes Angebot</option>
            {lineItems.map((item) => (
              <option key={item.id} value={item.id}>
                {item.description}
              </option>
            ))}
          </select>
        )}
        <input
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          placeholder="Beschreibung (optional), z. B. Vorher-Zustand"
          className="w-full rounded-xl border border-[#e9edf2] bg-white p-2.5 text-sm text-[#0f172a] outline-none focus:border-[#2563eb]"
        />
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
          disabled={isPending}
          onChange={handleFileChange}
          className="w-full rounded-xl border border-dashed border-[#cbd5e1] bg-white p-2.5 text-sm text-[#0f172a] outline-none file:mr-3 file:rounded-full file:border-0 file:bg-[#2563eb] file:px-4 file:py-1.5 file:text-sm file:font-medium file:text-white disabled:opacity-50"
        />
      </div>

      {photos.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {photos.map((photo) => (
            <div key={photo.id} className="flex flex-col gap-1.5 rounded-xl border border-[#e9edf2] bg-white p-2">
              {photo.url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={photo.url}
                  alt={photo.caption ?? "Baustellenfoto"}
                  className="aspect-square w-full rounded-lg object-cover"
                />
              ) : (
                <div className="flex aspect-square w-full items-center justify-center rounded-lg bg-[#f1f5f9] text-xs text-[#94a3b8]">
                  Wird geladen…
                </div>
              )}
              {lineItemLabel(photo.quote_line_item_id) && (
                <span className="truncate text-xs font-medium text-[#2563eb]">
                  {lineItemLabel(photo.quote_line_item_id)}
                </span>
              )}
              {photo.caption && <span className="truncate text-xs text-[#64748b]">{photo.caption}</span>}
              <button
                onClick={() => handleDelete(photo.id)}
                disabled={isPending}
                className="text-xs font-medium text-[#dc2626] transition-colors hover:text-[#b91c1c] disabled:opacity-50"
              >
                Löschen
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
