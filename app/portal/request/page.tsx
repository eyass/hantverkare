import { RequestForm } from "./RequestForm";

// Customer-portal magic-link request page (issue #154). Public, no auth --
// this is the entry point a repeat customer bookmarks or is pointed to,
// distinct from the org/team /login. Submitting always shows the same
// generic confirmation regardless of whether the email matched a customer
// record (see app/portal/request/actions.ts) to avoid enumeration.
export default function PortalRequestPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0f172a] p-6">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-xl">
        <h1 className="text-xl font-semibold text-[#0f172a]">Kundenportal</h1>
        <p className="mt-2 text-sm text-[#64748b]">
          Geben Sie Ihre E-Mail-Adresse ein, um einen Zugangslink zu Ihren Angeboten, Rechnungen, Terminen und
          Gewährleistungen zu erhalten.
        </p>
        <div className="mt-6">
          <RequestForm />
        </div>
      </div>
    </div>
  );
}
