// Prominent, unmissable compliance caveat for the GoBD/DATEV feature
// (#123). Intentional: this is the one part of this feature that keeps an
// explicit human-review flag even under full engineering autonomy, since
// incorrect tax-compliance tooling is a real audit-risk, not a UX judgment
// call (see docs/superpowers/specs/2026-07-22-gobd-datev-export-design.md,
// section 5, and the PR description for #123).
//
// This is intentionally NOT dismissible-and-gone: it always renders on the
// invoices page. Do not remove or water it down without explicit human
// sign-off -- it is decoration only in the sense that it has no onClick
// handlers, not in the sense that it's optional.
export function GobdComplianceNotice() {
  return (
    <div
      role="note"
      className="flex flex-col gap-1 rounded-2xl border-2 border-[#f59e0b] bg-[#fffbeb] p-4 text-sm text-[#92400e]"
    >
      <p className="font-semibold">Wichtiger Hinweis zur Steuer-Compliance</p>
      <p>
        Diese Rechnungsarchivierung (Unveränderbarkeit, fortlaufende Nummerierung, Gutschriften,
        Prüfprotokoll) und der DATEV-Export wurden nach bestem technischen Verständnis der
        GoBD-Anforderungen umgesetzt — sie stellen jedoch <strong>keine Rechts- oder Steuerberatung</strong>{" "}
        dar. Bitte lasse von deinem Steuerberater bzw. deiner Steuerberaterin bestätigen, dass dieser
        Ansatz (insbesondere Aufbewahrungsfrist, Gutschriftverfahren und DATEV-Format) den tatsächlichen
        Compliance-Pflichten deines Unternehmens entspricht, bevor du dich für echte Abgaben/Prüfungen
        darauf verlässt.
      </p>
    </div>
  );
}
