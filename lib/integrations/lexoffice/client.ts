// lexoffice API client (issue #165).
//
// *** VERIFY BEFORE RELYING ON THIS IN PRODUCTION ***
// This module is a best-effort implementation written from general knowledge
// of lexoffice's public REST API shape (base URL, bearer-token auth, an
// "invoices" voucher-style endpoint, a "contacts" endpoint, a profile/company
// endpoint). It has NOT been verified against lexoffice's current, official
// API reference. Field names, required fields, endpoint paths, and response
// shapes may have changed or may be subtly wrong. Before this handles a real
// customer's real invoices:
//   1. Get a lexoffice developer/sandbox account.
//   2. Cross-check every endpoint path and payload shape below against
//      https://developers.lexoffice.io/docs/ (their current API reference).
//   3. Exercise createInvoiceVoucher against the sandbox and fix any
//      mismatches -- do not trust the shapes here as ground truth.
//
// Auth model: lexoffice does NOT require OAuth app registration for this kind
// of integration. Each organization generates its own "public API key" inside
// the lexoffice app (Settings -> API) and pastes it into our settings UI. We
// send it as a Bearer token on every request. There is no token refresh/expiry
// to manage -- these keys are long-lived until revoked by the user.

const LEXOFFICE_BASE_URL = "https://api.lexoffice.io/v1";

export class LexofficeApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body: unknown,
  ) {
    super(message);
    this.name = "LexofficeApiError";
  }
}

async function lexofficeFetch(
  apiKey: string,
  path: string,
  init: RequestInit = {},
): Promise<unknown> {
  const response = await fetch(`${LEXOFFICE_BASE_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: "application/json",
      "Content-Type": "application/json",
      ...init.headers,
    },
  });

  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    // Some lexoffice endpoints (or error responses) may return an empty body.
    body = null;
  }

  if (!response.ok) {
    throw new LexofficeApiError(
      `lexoffice API request failed: ${response.status} ${path}`,
      response.status,
      body,
    );
  }

  return body;
}

export type LexofficeCompanyProfile = {
  organizationId: string;
  companyName: string | null;
};

/**
 * Fetches lexoffice's company/profile info for the account owning the given
 * API key. Used purely as a "test connection" call when the user saves their
 * API key in settings -- a 200 response means the key is valid; a 401/403
 * means it's wrong or revoked.
 *
 * Best-effort field mapping: the "profile" endpoint's exact response shape is
 * one of the things flagged above as unverified. companyName falls back to
 * null rather than throwing if the expected field isn't present, since this
 * call's real purpose is just the auth check, not the company name itself.
 */
export async function getCompanyProfile(apiKey: string): Promise<LexofficeCompanyProfile> {
  const body = (await lexofficeFetch(apiKey, "/profile")) as Record<string, unknown> | null;
  return {
    organizationId: typeof body?.organizationId === "string" ? body.organizationId : "",
    companyName:
      typeof body?.companyName === "string"
        ? body.companyName
        : typeof body?.name === "string"
          ? body.name
          : null,
  };
}

export type LexofficeInvoiceLineItem = {
  description: string;
  quantity: number;
  unitName: string;
  unitPriceNetCents: number;
  vatRatePercent: number;
};

export type LexofficeInvoiceInput = {
  /** ISO date string (YYYY-MM-DD), the invoice's issue date. */
  voucherDate: string;
  /** Free-text customer/contact name. Best-effort: we don't create/link a
   * proper lexoffice "contact" record in v1, we pass the name inline. A
   * follow-up could look up/create a matching contact via the contacts
   * endpoint for better dedup on the lexoffice side. */
  customerName: string;
  lineItems: LexofficeInvoiceLineItem[];
  /** Our own invoice number, included as a reference/note so it's easy to
   * cross-reference between the two systems. */
  ourInvoiceNumber: string;
};

export type LexofficeInvoiceResult = {
  /** The lexoffice-side id, stored in invoices.lexoffice_voucher_id. */
  id: string;
};

/**
 * Pushes an invoice to lexoffice as an "invoice" voucher.
 *
 * Best-effort payload shape -- see the module-level warning. In particular,
 * lexoffice's real invoice-creation endpoint is known to take a nested
 * structure with an "address" block, a "lineItems" array with a "type"
 * discriminator per item (e.g. "custom"), and separate net/gross/tax
 * handling depending on whether the voucher is "taxConditions.taxType" net
 * or gross -- the flattened shape below is a simplification that should be
 * reconciled against the current docs before production use.
 */
export async function createInvoiceVoucher(
  apiKey: string,
  input: LexofficeInvoiceInput,
): Promise<LexofficeInvoiceResult> {
  const payload = {
    voucherDate: input.voucherDate,
    address: {
      name: input.customerName,
    },
    lineItems: input.lineItems.map((item) => ({
      type: "custom",
      name: item.description,
      quantity: item.quantity,
      unitName: item.unitName,
      unitPrice: {
        currency: "EUR",
        netAmount: item.unitPriceNetCents / 100,
        taxRatePercentage: item.vatRatePercent,
      },
    })),
    taxConditions: {
      taxType: "net",
    },
    remark: `Ref: ${input.ourInvoiceNumber}`,
  };

  // lexoffice's real endpoint requires a `finalize` query param to decide
  // between draft and finalized vouchers; we finalize immediately since our
  // own invoice is already immutable/issued by the time this runs.
  const body = (await lexofficeFetch(apiKey, "/invoices?finalize=true", {
    method: "POST",
    body: JSON.stringify(payload),
  })) as Record<string, unknown> | null;

  const id = typeof body?.id === "string" ? body.id : null;
  if (!id) {
    throw new LexofficeApiError(
      "lexoffice invoice creation returned no id",
      200,
      body,
    );
  }

  return { id };
}
