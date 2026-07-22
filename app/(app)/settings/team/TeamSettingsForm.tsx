"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { inviteMember, removeMember, updateTeamPermissions } from "./actions";

export type TeamMember = {
  userId: string;
  email: string;
  role: "owner" | "member";
};

export type PendingInvite = {
  id: string;
  email: string;
};

export type TeamPermissions = {
  membersCanDeleteCustomers: boolean;
  membersCanViewBilling: boolean;
  membersCanEditBusinessSettings: boolean;
  smsNotificationsEnabled: boolean;
  dunningEnabled: boolean;
  dunningReminderDays: number;
  dunningMahnungDays: number;
  dunningEscalationDays: number;
  dunningTone: "freundlich" | "neutral" | "streng";
  inventoryDecrementEnabled: boolean;
};

export function TeamSettingsForm({
  members,
  pendingInvites,
  currentUserId,
  permissions,
}: {
  members: TeamMember[];
  pendingInvites: PendingInvite[];
  currentUserId: string;
  permissions: TeamPermissions;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [perms, setPerms] = useState(permissions);
  const [permsError, setPermsError] = useState<string | null>(null);
  const [permsNotice, setPermsNotice] = useState<string | null>(null);
  const [isPermsPending, startPermsTransition] = useTransition();

  function handleTogglePerm(key: keyof TeamPermissions) {
    const next = { ...perms, [key]: !perms[key] };
    setPerms(next);
    setPermsError(null);
    setPermsNotice(null);
    startPermsTransition(async () => {
      const result = await updateTeamPermissions(next);
      if (result.error) {
        setPerms(perms); // revert optimistic toggle
        setPermsError(result.error);
        return;
      }
      setPermsNotice("Gespeichert.");
      router.refresh();
    });
  }

  // Generic committer for the non-checkbox dunning fields (day thresholds,
  // tone). Mirrors handleTogglePerm's optimistic-update-then-revert-on-error
  // shape, but takes an already-computed next state rather than toggling a
  // boolean, since day counts and tone aren't binary.
  function commitPerms(next: TeamPermissions) {
    const previous = perms;
    setPerms(next);
    setPermsError(null);
    setPermsNotice(null);
    startPermsTransition(async () => {
      const result = await updateTeamPermissions(next);
      if (result.error) {
        setPerms(previous);
        setPermsError(result.error);
        return;
      }
      setPermsNotice("Gespeichert.");
      router.refresh();
    });
  }

  function handleInvite(formData: FormData) {
    const value = String(formData.get("email") ?? "");
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const result = await inviteMember(value);
      if (result.error) {
        setError(result.error);
        return;
      }
      setEmail("");
      setNotice("Einladung gesendet.");
      router.refresh();
    });
  }

  function handleRemove(userId: string) {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const result = await removeMember(userId);
      if (result.error) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 p-8">
      <h1 className="text-2xl font-semibold text-[#0f172a]">Team</h1>

      <section className="rounded-2xl border border-[#e9edf2] bg-white p-6">
        <h2 className="text-lg font-medium text-[#0f172a]">Mitglied einladen</h2>
        <p className="mt-1 text-sm text-[#64748b]">
          Wir senden eine Einladung per E-Mail. Neue Mitglieder melden sich per
          Anmeldelink an und treten dann eurem Unternehmen bei.
        </p>
        <form action={handleInvite} className="mt-4 flex flex-col gap-3 sm:flex-row">
          <input
            name="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={isPending}
            placeholder="kollege@beispiel.de"
            className="flex-1 rounded-md border border-[#e9edf2] p-3 text-sm"
          />
          <button
            type="submit"
            disabled={isPending}
            className="rounded-full bg-[#2563eb] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
          >
            {isPending ? "Wird gesendet…" : "Einladen"}
          </button>
        </form>
        {error && (
          <p role="alert" className="mt-3 text-sm text-red-600">
            {error}
          </p>
        )}
        {notice && (
          <p role="status" className="mt-3 text-sm text-[#16a34a]">
            {notice}
          </p>
        )}
      </section>

      <section className="rounded-2xl border border-[#e9edf2] bg-white p-6">
        <h2 className="text-lg font-medium text-[#0f172a]">Mitglieder</h2>
        <ul className="mt-4 flex flex-col divide-y divide-[#e9edf2]">
          {members.map((member) => (
            <li
              key={member.userId}
              className="flex items-center justify-between gap-3 py-3"
            >
              <div className="flex min-w-0 flex-col">
                <span className="truncate text-sm font-medium text-[#0f172a]">
                  {member.email}
                  {member.userId === currentUserId ? " (du)" : ""}
                </span>
                <span className="text-xs text-[#94a3b8]">
                  {member.role === "owner" ? "Inhaber" : "Mitglied"}
                </span>
              </div>
              {member.role === "member" && member.userId !== currentUserId && (
                <button
                  type="button"
                  onClick={() => handleRemove(member.userId)}
                  disabled={isPending}
                  className="rounded-md border border-[#e9edf2] px-3 py-1.5 text-sm font-medium text-red-600 disabled:opacity-50"
                >
                  Entfernen
                </button>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-2xl border border-[#e9edf2] bg-white p-6">
        <h2 className="text-lg font-medium text-[#0f172a]">Mitgliederrechte</h2>
        <p className="mt-1 text-sm text-[#64748b]">
          Als Inhaber kannst du festlegen, was Mitglieder tun dürfen. Diese
          Einschränkungen gelten nicht für dich.
        </p>
        <ul className="mt-4 flex flex-col divide-y divide-[#e9edf2]">
          <li className="flex items-center justify-between gap-3 py-3">
            <span className="text-sm text-[#0f172a]">
              Mitglieder dürfen Kunden löschen
            </span>
            <input
              type="checkbox"
              checked={perms.membersCanDeleteCustomers}
              disabled={isPermsPending}
              onChange={() => handleTogglePerm("membersCanDeleteCustomers")}
              className="h-5 w-5"
            />
          </li>
          <li className="flex items-center justify-between gap-3 py-3">
            <span className="text-sm text-[#0f172a]">
              Mitglieder dürfen Rechnungen einsehen
            </span>
            <input
              type="checkbox"
              checked={perms.membersCanViewBilling}
              disabled={isPermsPending}
              onChange={() => handleTogglePerm("membersCanViewBilling")}
              className="h-5 w-5"
            />
          </li>
          <li className="flex items-center justify-between gap-3 py-3">
            <span className="text-sm text-[#0f172a]">
              Mitglieder dürfen Unternehmenseinstellungen ändern
            </span>
            <input
              type="checkbox"
              checked={perms.membersCanEditBusinessSettings}
              disabled={isPermsPending}
              onChange={() => handleTogglePerm("membersCanEditBusinessSettings")}
              className="h-5 w-5"
            />
          </li>
        </ul>
        {permsError && (
          <p role="alert" className="mt-3 text-sm text-red-600">
            {permsError}
          </p>
        )}
        {permsNotice && (
          <p role="status" className="mt-3 text-sm text-[#16a34a]">
            {permsNotice}
          </p>
        )}
      </section>

      <section className="rounded-2xl border border-[#e9edf2] bg-white p-6">
        <h2 className="text-lg font-medium text-[#0f172a]">Benachrichtigungen</h2>
        <p className="mt-1 text-sm text-[#64748b]">
          SMS-Versand verursacht Kosten pro Nachricht und ist deshalb standardmäßig
          deaktiviert. Bei Aktivierung werden zusätzlich zur bestehenden
          E-Mail-Benachrichtigung SMS verschickt (z. B. wenn ein Angebot
          signiert wird oder bald abläuft), sofern eine Telefonnummer hinterlegt ist.
        </p>
        <ul className="mt-4 flex flex-col divide-y divide-[#e9edf2]">
          <li className="flex items-center justify-between gap-3 py-3">
            <span className="text-sm text-[#0f172a]">
              SMS-Benachrichtigungen aktivieren
            </span>
            <input
              type="checkbox"
              checked={perms.smsNotificationsEnabled}
              disabled={isPermsPending}
              onChange={() => handleTogglePerm("smsNotificationsEnabled")}
              className="h-5 w-5"
            />
          </li>
        </ul>
      </section>

      <section className="rounded-2xl border border-[#e9edf2] bg-white p-6">
        <h2 className="text-lg font-medium text-[#0f172a]">Mahnwesen</h2>
        <p className="mt-1 text-sm text-[#64748b]">
          Überfällige Rechnungen erhalten automatisch eine gestufte Erinnerung:
          zuerst eine freundliche Zahlungserinnerung, dann eine formelle Mahnung
          mit Verzugszinsen, zuletzt eine Eskalationsmitteilung. Die Fristen
          zählen ab dem Fälligkeitsdatum der Rechnung.
        </p>
        <ul className="mt-4 flex flex-col divide-y divide-[#e9edf2]">
          <li className="flex items-center justify-between gap-3 py-3">
            <span className="text-sm text-[#0f172a]">Mahnwesen aktivieren</span>
            <input
              type="checkbox"
              checked={perms.dunningEnabled}
              disabled={isPermsPending}
              onChange={() => handleTogglePerm("dunningEnabled")}
              className="h-5 w-5"
            />
          </li>
          <li className="flex items-center justify-between gap-3 py-3">
            <span className="text-sm text-[#0f172a]">
              Zahlungserinnerung nach (Tagen)
            </span>
            <input
              type="number"
              min={0}
              defaultValue={perms.dunningReminderDays}
              disabled={isPermsPending || !perms.dunningEnabled}
              onBlur={(e) =>
                commitPerms({ ...perms, dunningReminderDays: Number(e.target.value) })
              }
              className="w-20 rounded-md border border-[#e9edf2] p-2 text-right text-sm"
            />
          </li>
          <li className="flex items-center justify-between gap-3 py-3">
            <span className="text-sm text-[#0f172a]">Mahnung nach (Tagen)</span>
            <input
              type="number"
              min={0}
              defaultValue={perms.dunningMahnungDays}
              disabled={isPermsPending || !perms.dunningEnabled}
              onBlur={(e) =>
                commitPerms({ ...perms, dunningMahnungDays: Number(e.target.value) })
              }
              className="w-20 rounded-md border border-[#e9edf2] p-2 text-right text-sm"
            />
          </li>
          <li className="flex items-center justify-between gap-3 py-3">
            <span className="text-sm text-[#0f172a]">Eskalation nach (Tagen)</span>
            <input
              type="number"
              min={0}
              defaultValue={perms.dunningEscalationDays}
              disabled={isPermsPending || !perms.dunningEnabled}
              onBlur={(e) =>
                commitPerms({ ...perms, dunningEscalationDays: Number(e.target.value) })
              }
              className="w-20 rounded-md border border-[#e9edf2] p-2 text-right text-sm"
            />
          </li>
          <li className="flex items-center justify-between gap-3 py-3">
            <span className="text-sm text-[#0f172a]">Tonfall</span>
            <select
              value={perms.dunningTone}
              disabled={isPermsPending || !perms.dunningEnabled}
              onChange={(e) =>
                commitPerms({
                  ...perms,
                  dunningTone: e.target.value as TeamPermissions["dunningTone"],
                })
              }
              className="rounded-md border border-[#e9edf2] p-2 text-sm"
            >
              <option value="freundlich">Freundlich</option>
              <option value="neutral">Neutral</option>
              <option value="streng">Streng</option>
            </select>
          </li>
        </ul>
      </section>

      <section className="rounded-2xl border border-[#e9edf2] bg-white p-6">
        <h2 className="text-lg font-medium text-[#0f172a]">Lagerbestand</h2>
        <p className="mt-1 text-sm text-[#64748b]">
          Standardmäßig deaktiviert. Bei Aktivierung wird der Lagerbestand von
          Preislistenpositionen automatisch verringert, sobald ein Kunde ein
          Angebot unterschreibt (nur für Positionen, bei denen die
          Bestandsverfolgung in der Preisliste aktiviert ist).
        </p>
        <ul className="mt-4 flex flex-col divide-y divide-[#e9edf2]">
          <li className="flex items-center justify-between gap-3 py-3">
            <span className="text-sm text-[#0f172a]">
              Lagerbestand bei Unterschrift automatisch verringern
            </span>
            <input
              type="checkbox"
              checked={perms.inventoryDecrementEnabled}
              disabled={isPermsPending}
              onChange={() => handleTogglePerm("inventoryDecrementEnabled")}
              className="h-5 w-5"
            />
          </li>
        </ul>
      </section>

      {pendingInvites.length > 0 && (
        <section className="rounded-2xl border border-[#e9edf2] bg-white p-6">
          <h2 className="text-lg font-medium text-[#0f172a]">Offene Einladungen</h2>
          <ul className="mt-4 flex flex-col divide-y divide-[#e9edf2]">
            {pendingInvites.map((invite) => (
              <li key={invite.id} className="py-3 text-sm text-[#0f172a]">
                {invite.email}
                <span className="ml-2 text-xs text-[#94a3b8]">ausstehend</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
