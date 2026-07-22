import Link from "next/link";

// Deliberately OUTSIDE the (app) route group. Landing here right after
// deleteOrganization() means the user's org (and possibly their auth account)
// is already gone and their session has been signed out. (app)/layout.tsx
// would otherwise run ensureOrganization() and silently create a brand new
// empty org for them the instant they were routed back into the app -- this
// page exists specifically so that never happens.
export default function AccountDeletedPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f4f6f8] p-8">
      <div className="max-w-md rounded-2xl border border-[#e9edf2] bg-white p-8 text-center">
        <h1 className="text-xl font-semibold text-[#0f172a]">
          Deine Organisation wurde gelöscht
        </h1>
        <p className="mt-3 text-sm text-[#64748b]">
          Alle zugehörigen Daten wurden gemäß Art. 17 DSGVO endgültig entfernt.
          Falls du keiner weiteren Organisation angehört hast, wurde auch dein
          Benutzerkonto gelöscht. Du wurdest abgemeldet.
        </p>
        <Link
          href="/login"
          className="mt-6 inline-block rounded-xl bg-[#2563eb] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#1d4ed8]"
        >
          Zur Anmeldung
        </Link>
      </div>
    </div>
  );
}
