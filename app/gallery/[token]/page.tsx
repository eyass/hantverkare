import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { QUOTE_PHOTOS_BUCKET } from "@/lib/quotes/photoValidation";

const PHOTO_SIGNED_URL_TTL_SECONDS = 60 * 60; // 1 hour, plenty for a page view

/**
 * Public before/after job photo gallery (issue #156). Mirrors the security
 * model of app/q/[token]/page.tsx: the unguessable gallery_token is the only
 * lookup key, and there is no session/auth here at all -- this route must
 * work for a customer's friends and family with no account.
 *
 * Unlike the quote link, this page ALSO requires `gallery_enabled = true` on
 * every request (not just at token-issue time), so a tradesperson turning
 * the toggle back off in the dashboard closes public access immediately,
 * without needing to invalidate or rotate the token.
 */
export default async function PublicGalleryPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = createAdminClient();

  const { data: quote, error: quoteError } = await supabase
    .from("quotes")
    .select("id, customer_description, gallery_enabled")
    .eq("gallery_token", token)
    .eq("gallery_enabled", true)
    .maybeSingle();
  if (!quote) {
    if (quoteError) {
      console.error("Failed to load public gallery by gallery_token", quoteError);
    }
    notFound();
  }

  const { data: photoRows, error: photosError } = await supabase
    .from("quote_photos")
    .select("id, storage_path, caption, created_at")
    .eq("quote_id", quote.id)
    .order("created_at", { ascending: true });
  if (photosError) {
    console.error("Failed to load photos for public gallery", quote.id, photosError);
    notFound();
  }

  const photos = await Promise.all(
    (photoRows ?? []).map(async (photo) => {
      const { data: signed } = await supabase.storage
        .from(QUOTE_PHOTOS_BUCKET)
        .createSignedUrl(photo.storage_path, PHOTO_SIGNED_URL_TTL_SECONDS);
      return { id: photo.id, url: signed?.signedUrl ?? null, caption: photo.caption };
    }),
  );

  return (
    <div className="min-h-screen bg-[#0f172a] px-4 py-10 sm:px-8">
      <div className="mx-auto flex max-w-4xl flex-col gap-6 rounded-2xl bg-white p-6 shadow-xl sm:p-10">
        <div>
          <h1 className="text-2xl font-semibold text-[#0f172a]">Vorher/Nachher-Galerie</h1>
          {quote.customer_description && (
            <p className="mt-1 text-sm text-[#64748b]">{quote.customer_description}</p>
          )}
        </div>

        {photos.length === 0 ? (
          <p className="text-sm text-[#64748b]">Für diesen Auftrag sind noch keine Fotos vorhanden.</p>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {photos.map((photo) => (
              <figure key={photo.id} className="flex flex-col gap-2 rounded-xl border border-[#e9edf2] p-2">
                {photo.url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={photo.url}
                    alt={photo.caption ?? "Baustellenfoto"}
                    className="aspect-square w-full rounded-lg object-cover"
                  />
                ) : (
                  <div className="flex aspect-square w-full items-center justify-center rounded-lg bg-[#f1f5f9] text-xs text-[#94a3b8]">
                    Bild nicht verfügbar
                  </div>
                )}
                {photo.caption && (
                  <figcaption className="text-xs text-[#64748b]">{photo.caption}</figcaption>
                )}
              </figure>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
