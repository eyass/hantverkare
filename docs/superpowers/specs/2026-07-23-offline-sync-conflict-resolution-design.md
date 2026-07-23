# Offline Sync + Multi-Device Conflict Resolution — Design Spec

## Context

Covers both #109 ("Design + implement full offline quote-drafting sync") and #118
("Design spec: multi-device conflict resolution for offline quote drafts/edits"). Both
issues, in their own text, scoped themselves as needing a **design spec before any
implementation** — #109's background note explicitly flags conflict resolution and
multi-device editing as "requir[ing] real product/design decisions that shouldn't be
made ad-hoc during implementation," and #118 repeats the same caveat verbatim, adding
that this app has "no offline-first data layer, no persistent background job queue
..., and no CRDT/OT library." This document is that spec. It contains no implementation
— matching what both issues asked for. Decisions below are made autonomously per the
project's standing full-autonomy override (`.harness/LOOP.md`).

This document supersedes neither issue's shipped work — it builds on top of it and
specifies what comes next.

## Current state (confirmed by reading the code)

The PR that closed the bulk of #109 shipped a narrower slice than the full sync engine
either issue originally imagined. As implemented today, in
`app/(app)/quotes/new/`:

- **Draft persistence** (`lib/quotes/draftStorage.ts`): the in-progress `/quotes/new`
  form (`customerId` + `description` only — no voice notes, which are session-only
  blob URLs and intentionally not persisted) is written to `localStorage` under
  `hantverkare:quote-draft:new` on every field change, and restored on mount. This is
  a single flat key holding the latest snapshot — not a queue, not versioned, no
  per-field timestamps.
- **Online/offline detection** (`lib/hooks/useOnlineStatus.ts`): a
  `useSyncExternalStore` hook wrapping `navigator.onLine` + the `online`/`offline`
  window events. No connectivity heuristics beyond what the browser reports (no
  active ping/heartbeat).
- **AI-generation queuing** (`lib/quotes/generationQueue.ts` +
  `lib/hooks/useQueuedGeneration.ts`): if the "Angebot erstellen" submit happens while
  `navigator.onLine` is already `false`, the submission is queued (a single-entry
  `localStorage` record under `hantverkare:quote-generation-queue:new`: `customerId`,
  `description`, `attempts`) instead of invoked. `NewQuoteForm.tsx` auto-retries the
  queued entry once `online` fires, capped at `MAX_AUTO_RETRY_ATTEMPTS = 3`
  (`shouldAutoRetry`); beyond that the item stays queued and manually resubmittable but
  auto-retry stops, and the UI shows "Die automatische Übertragung hat mehrfach nicht
  geklappt. Bitte sende das Angebot manuell erneut ab." While queued (below the retry
  cap) the UI shows "Wird gesendet, sobald du wieder online bist." While genuinely
  offline and nothing is queued yet, it shows "Du bist offline — Änderungen werden
  lokal gespeichert."
- **No storage backend beyond `localStorage`** — no IndexedDB, no `idb` or similar
  dependency (`grep` across `package.json` and `app/` confirms nothing). No queue table
  server-side, no CRDT/OT library, no background worker (confirmed: this is a
  serverless Next.js/Vercel deployment with no persistent process to run a queue
  worker).
- **Explicitly single-request, single-field-set scope**: only the *new*-quote
  creation flow is covered. Editing an *existing* quote (`/quotes/[id]`) offline is not
  handled at all today — no draft persistence, no queuing, no conflict awareness.
  This is the gap #118 is really about, since a genuine multi-device conflict can only
  occur once there is a record that both devices already know about and can both edit.

## Scope of this spec

1. Confirm/finalize AI-generation queuing UX (mostly already shipped — minor
   clarifications below).
2. Specify conflict resolution strategy: **last-write-wins per field**, not per record.
3. Specify the storage/sync backend: **IndexedDB-backed local queue**.
4. Specify queue lifecycle: retry/backoff, retention, and in-flight/failed UI states —
   building on, not contradicting, what #109 already shipped.
5. Give an explicit answer for the two-devices-offline-editing-the-same-draft scenario.
6. Flag two genuinely open architectural questions as future work, not resolved here.

## 1. AI-generation queuing UX — confirmed, mostly unchanged

Current behavior (above) is correct and stays as-is: queue silently, no explicit
"queue for later" button distinct from the normal submit (the submit button's label
already changes to "Für später vormerken" when offline, which *is* the explicit
affordance — no separate action needed), auto-retry with a capped attempt count,
manual resubmit path once the cap is hit.

Two refinements once this spec's IndexedDB queue lands (section 3):

- The single-entry `localStorage` queue key becomes one row in the general
  `pendingActions` IndexedDB store (type `"generateQuoteDraft"`), rather than a
  bespoke parallel mechanism. Behavior is unchanged from the user's point of view —
  this is an internal storage migration, not a UX change.
- The "never auto-queue a mid-flight failure" rule from the code comment in
  `NewQuoteForm.tsx` (a network drop *during* the actual `generateQuoteDraft` call,
  after the DB insert may have already committed, is NOT safely retryable —
  duplicate-quote risk) is preserved exactly as designed today and generalizes to
  every action type in the new queue: **only ever auto-queue an action that never left
  the client** (detected offline before invocation). Anything that failed mid-flight
  surfaces as a normal visible error for the user to consciously retry. This
  distinction is captured as a per-queue-item `state` (see section 4) rather than
  re-derived ad hoc per action type.

## 2. Conflict resolution: last-write-wins per field

**Decision: per-field last-write-wins, not per-record.** When a queued offline edit is
finally synced and the server-side record has *also* changed in the meantime (edited
from another device, or by a background process such as AI regeneration), the two
changes are reconciled field-by-field rather than one whole-record write clobbering the
other:

- For each field the offline queue entry touched, compare its local edit timestamp
  against the server row's `updated_at` (or a per-field timestamp — see below) captured
  at the moment the client last saw that field's value (i.e., when the draft was
  loaded or last synced). If the server's value for that field has NOT changed since
  the client last saw it, the client's queued value simply applies — no conflict,
  normal write.
- If the server's value for that field HAS changed since the client last saw it (a
  genuine concurrent edit), the field with the later timestamp wins, applied
  independently per field. Two different fields changed on two different devices (the
  scenario named explicitly in the task: description edited offline, price list
  changed server-side) never conflict with each other — both changes land, because
  they touch different fields.
- **Only when the SAME field was changed both places** (e.g. `description` edited
  offline on this device, and also edited server-side or from another device, since
  this device last saw it) does the user see anything: a conflict banner (see below).
  Even then, resolution is still automatic (later timestamp wins) — the banner is
  informational, not a blocking merge-conflict UI requiring the user to pick a side.
  This keeps the UX simple: sync never blocks or demands manual merge, it just tells
  the user afterward when it silently chose one version to keep.

**Which fields/entities this applies to.** Scoped to quote **drafts** (a record still
in an editable-by-the-owner state), which in this app's model means:
- Quotes with `status` in the pre-signed, editable range (drafts created via
  `/quotes/new` and edited on `/quotes/[id]` before signing). Field-level LWW applies
  to: `customerId`, `description`, and quote line items (`quote_items` rows — a line
  item add/edit/delete offline is tracked as its own queue entry keyed by
  `quote_id` + `item_id`, so two devices editing *different* line items on the same
  draft never conflict, and editing the *same* line item's *same* field is the only
  true per-field conflict case for line items too).
- Once a quote is `signed` it is immutable (per the existing invoicing design spec's
  RLS rules) — no offline editing or conflict resolution applies to signed quotes;
  this is out of scope by construction, not by omission.
- Customer records and price-list entries are **not** covered by this spec's
  conflict-resolution scope — those are edited through their own pages, which have no
  offline-editing support today and are not part of either #109 or #118's stated
  scope. If offline editing of customers/price-list is added later, it should get its
  own per-field-LWW treatment following this same pattern, not be silently assumed
  covered here.

**Per-field timestamps.** Add a `field_updated_at jsonb` column (or a `quote_field_versions`
side table, if `jsonb` merge semantics prove awkward in practice — implementation's
call) to `quotes` and `quote_items`, storing `{ field_name: iso_timestamp }` for each
field this scheme covers, updated by the Server Action whenever that field changes
(server-side edits, including AI regeneration, must also stamp this — not just
client-initiated queue syncs — otherwise the server's "last changed" time is unknown
and every sync looks like a conflict). This is additive, non-breaking schema — existing
rows simply start empty (`{}`) and every field looks unconflicted until first edited
under the new scheme.

**Conflict banner copy and behavior.** When a sync resolves at least one same-field
conflict, show, on `/quotes/[id]` immediately after sync completes:

> "Dieser Entwurf wurde auch auf einem anderen Gerät bearbeitet — es wird jeweils die
> neueste Version jedes Felds angezeigt. Bitte vor dem Absenden prüfen."
> ("This draft was also edited on another device — showing the latest version of each
> field; review before submitting.")

matching the exact behavior described in the task brief. The banner is dismissible,
non-blocking, and does not prevent submitting/signing the quote — it is a review nudge,
not a gate. It disappears on next successful sync with no new conflicts, or on manual
dismissal.

## 3. Storage/sync backend: IndexedDB-backed local queue

This repo has no `idb` (or any IndexedDB wrapper) dependency today (confirmed via
`grep` across `package.json`/`app/`). Given the queue's actual complexity — a handful
of record types (`generateQuoteDraft`, `updateQuoteField`, `upsertQuoteItem`,
`deleteQuoteItem`), each a small JSON payload, no complex querying beyond "give me all
pending items in insertion order" — a **raw IndexedDB wrapper, hand-written and kept
under ~100 lines** (not a dependency) is enough and avoids adding a library for what
amounts to a typed key-value store with one index. This matches the codebase's existing
style in `draftStorage.ts`/`generationQueue.ts`: small, pure, dependency-injected,
defensively-written modules with no external dependencies.

Proposed shape: `lib/offline/db.ts` exposing a thin `openQueueDb()` promise-wrapping
`indexedDB.open`, with a single object store `pendingActions` (keyPath `id`, an
auto-generated ULID so insertion order is naturally sortable), holding rows:

```ts
type PendingAction = {
  id: string; // ULID, sortable by creation time
  type: "generateQuoteDraft" | "updateQuoteField" | "upsertQuoteItem" | "deleteQuoteItem";
  payload: unknown; // action-specific, typed per `type` at the call site
  createdAt: string; // ISO timestamp, for retention (section 4)
  attempts: number;
  state: "pending" | "in-flight" | "failed";
  // true only for actions that never reached the server (safe to auto-retry);
  // false for anything that failed mid-flight (must surface as a visible error,
  // never silently retried) -- see section 1's duplicate-quote-risk rationale.
  safeToAutoRetry: boolean;
};
```

`localStorage`'s existing `draftStorage.ts` (the *unsent* in-progress form snapshot,
distinct from the queue of already-submitted-but-pending actions) stays exactly as-is
— it is not a queue and doesn't need IndexedDB's larger capacity or structure; no
reason to migrate a working, simple thing. Only the queue (currently
`generationQueue.ts`'s single-entry `localStorage` key) moves to IndexedDB, both to
support multiple concurrent pending actions (today only one fits) and because
`localStorage`'s synchronous, ~5MB, string-only API is a poor fit once queue entries
can include e.g. multiple line-item edits queued back-to-back.

## 4. Queue lifecycle

Builds on, does not contradict, #109's shipped behavior:

- **Retry/backoff**: exponential backoff on top of the existing "retry when the
  `online` event fires" trigger — not instead of it. On reconnect, attempt immediately
  (attempt 1, no delay — matches current behavior exactly). If that attempt fails
  (server error, not offline — e.g. a 500 or a genuine timeout while nominally online),
  back off: 5s, 20s, 60s for attempts 2–4, matching the existing
  `MAX_AUTO_RETRY_ATTEMPTS = 3` *additional automatic attempts beyond the first*
  (i.e. 4 total automatic tries, consistent with today's constant name/value —
  clarify in code that "3" means "3 retries after the initial attempt," which is what
  the current code already does). Beyond that, stop automatic retry and surface the
  existing "manual resend" state — this exactly matches today's
  `autoRetryExhausted` UI, just generalized to every queue-item type instead of only
  the single new-quote-generation slot.
- **Retention**: a queued item is retained indefinitely in IndexedDB until it either
  syncs successfully or the user explicitly discards it from a (new) "pending changes"
  indicator — there is no silent auto-expiry. Rationale: a Handwerker on a job site with
  no signal for hours or days should not lose a queued quote just because a timer
  elapsed; better to keep surfacing "still pending, retry manually" indefinitely than
  to silently drop real work. (No behavior change vs. today, which also never expires
  the single queued item — this generalizes the same policy to a multi-item queue.)
- **UI states**: three states, matching what's already shown for the single
  new-quote-generation case, generalized to any queued action and (new) surfaced in a
  small persistent indicator (e.g. a badge near the page header, not per-field) when
  more than the new-quote flow has pending items:
  - **Queued** (state `"pending"`, offline or awaiting next retry window): "Wird
    gesendet, sobald du wieder online bist." — matches current copy.
  - **In-flight** (state `"in-flight"`, actively retrying): existing "…wird
    erstellt…" / submit-button-disabled pattern generalizes to a small spinner on the
    relevant field/section.
  - **Failed / manual-retry-needed** (state `"failed"`, auto-retry cap hit): existing
    "Die automatische Übertragung hat mehrfach nicht geklappt. Bitte sende das Angebot
    manuell erneut ab." copy pattern, generalized per action type (e.g. for a line-item
    edit: "Diese Änderung konnte nicht synchronisiert werden. Bitte manuell erneut
    versuchen.").

## 5. Multi-device editing: explicit answer

**What happens if the same draft is edited offline on two devices before either
reconnects:** each device queues its own edits locally (IndexedDB, per-field, as
above) while offline, oblivious to the other device's queue. When each device
reconnects (independently, possibly at different times), it syncs its queued
per-field changes against whatever the server's current per-field-timestamped state is
at that moment:

- If Device A reconnects first and syncs cleanly (server had no newer value for any
  field Device A touched), its changes land normally, and the server's per-field
  timestamps are now stamped with Device A's sync time for those fields.
- When Device B reconnects later and syncs its own queued changes, each of its fields
  is compared against the server's *current* per-field timestamp (which may now
  reflect Device A's just-applied sync). Fields Device B touched that Device A didn't
  touch apply cleanly. Fields both devices touched resolve to whichever device's edit
  has the later *original edit timestamp* (captured at the moment the field was
  edited on-device, not at sync time — otherwise the device that happens to reconnect
  later would always "win" regardless of which edit is actually more recent, which
  would be the wrong LWW semantics). This requires each queued field-level action to
  carry the client-side edit timestamp, not just a sync-time timestamp — captured
  when the field change is first queued (i.e., `onChange` time on the editing device,
  matching the existing `persistDraft` pattern in `NewQuoteForm.tsx` which already
  updates `draftRef` per keystroke and could stamp at that point).
- Device B's UI shows the conflict banner from section 2 if and only if at least one
  field it tried to sync was also changed on the server (by Device A or otherwise)
  since Device B last saw that field.

This is the full answer to the scenario named in both issues' text — no merge UI, no
manual pick-a-version step, always resolves automatically per field, banner is purely
informational.

## 6. Explicitly out of scope / future work

Per the task brief, these are genuinely open architectural questions, not resolved
here — flagged for a follow-up design pass if/when they become relevant:

- **Whether this needs a dedicated queue table server-side, vs. staying fully
  client-side IndexedDB.** The design above is entirely client-side (IndexedDB on each
  device, ordinary Server Actions for the actual sync writes) — there is no
  server-side notion of "this device has N pending items." That's sufficient for the
  scope here (a single-user tool with occasional multi-device use, not a
  collaboration product), but if e.g. a "see what's pending across all your devices
  from any device" feature is ever wanted, that would need server-side visibility into
  each device's queue, which this spec does not provide and does not attempt to design.
- **Whether Supabase Realtime would simplify multi-device conflict detection vs. the
  polling/on-reconnect approach specified here.** The per-field-timestamp comparison
  above happens only at sync time (when a device reconnects and pushes its queue) — it
  is not a live subscription. A Realtime-based approach could in principle let an
  online device learn about a conflicting concurrent edit *before* it queues its own
  conflicting change, potentially avoiding some conflicts entirely rather than
  resolving them after the fact. That's a meaningfully different architecture
  (live subscriptions, presence, always-online assumptions) than the
  offline-first/on-reconnect model this spec assumes, and evaluating the tradeoff
  properly deserves its own pass rather than being folded in here.

## Risk

T2 per `.harness/RISK-TIERS.md` for the eventual implementation (schema-additive
`field_updated_at` column, no new tables in the base design, client-side IndexedDB
logic) — likely T3 if the "dedicated queue table server-side" follow-up question above
is later resolved in favor of adding one. This document itself is a spec-only change
(docs directory, no code/schema touched) and carries no deployment risk.
