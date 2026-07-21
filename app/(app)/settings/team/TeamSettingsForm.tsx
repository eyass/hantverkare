"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { inviteMember, removeMember } from "./actions";

export type TeamMember = {
  userId: string;
  email: string;
  role: "owner" | "member";
};

export type PendingInvite = {
  id: string;
  email: string;
};

export function TeamSettingsForm({
  members,
  pendingInvites,
  currentUserId,
}: {
  members: TeamMember[];
  pendingInvites: PendingInvite[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

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
