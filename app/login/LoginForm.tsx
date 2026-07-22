"use client";

import { useActionState } from "react";
import Link from "next/link";
import { sendMagicLink, type LoginState } from "./actions";
import { LogoMark } from "@/components/marketing/illustrations/LogoMark";

const USPS = [
  {
    title: "Sprich, statt zu tippen",
    body: "Diktiere den Auftrag vor Ort — die KI baut Positionen, Mengen und Preise.",
  },
  {
    title: "Rechtssicher & DSGVO-konform",
    body: "Angebote mit digitaler Unterschrift, Server in Deutschland.",
  },
  {
    title: "Kunde unterschreibt digital",
    body: "Angebot per Link, Freigabe mit einem Klick, direkt zur Rechnung.",
  },
];

export function LoginForm({
  initialError,
  next,
  ref,
}: {
  initialError: string | null;
  next: string | null;
  ref?: string | null;
}) {
  const initialState: LoginState = { error: initialError, sent: false };
  const [state, formAction, isPending] = useActionState(sendMagicLink, initialState);

  return (
    <div className="grid min-h-screen bg-white lg:grid-cols-[1fr_1.05fr]">
      {/* ============ FORM PANEL ============ */}
      <div className="flex min-h-screen flex-col p-6 sm:p-10 lg:p-12">
        <div className="flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <LogoMark />
            <span className="text-lg font-bold tracking-tight text-[#0f172a]">hantverkare</span>
          </Link>
          <Link
            href="/"
            className="hidden text-sm font-semibold text-[#64748b] transition hover:text-[#0f172a] sm:inline"
          >
            ← Zur Startseite
          </Link>
        </div>

        <div className="flex flex-1 flex-col items-center justify-center">
          <div className="mx-auto flex w-full max-w-sm flex-col">
            {state.sent ? (
              <div className="text-center">
                <div className="mx-auto mb-6 flex h-[66px] w-[66px] items-center justify-center rounded-[20px] bg-[#eff6ff]">
                  <svg
                    width="30"
                    height="30"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#2563eb"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden
                  >
                    <rect x="3" y="5" width="18" height="14" rx="2" />
                    <path d="m3 7 9 6 9-6" />
                  </svg>
                </div>
                <h1 className="mb-3 text-[27px] font-bold tracking-tight text-[#0f172a]">
                  Prüfe dein Postfach
                </h1>
                <p
                  role="status"
                  aria-live="polite"
                  className="mb-6 text-[15.5px] leading-relaxed text-[#64748b]"
                >
                  Wir haben dir einen Anmeldelink per E-Mail geschickt. Klick auf den Link, um dich
                  anzumelden — kein Passwort nötig.
                </p>
              </div>
            ) : (
              <div>
                <h1 className="mb-2 text-[29px] font-bold tracking-tight text-[#0f172a]">
                  Willkommen zurück
                </h1>
                <p className="mb-7 text-[15.5px] leading-snug text-[#64748b]">
                  Melde dich mit einem sicheren Link an — kein Passwort, das du dir merken musst.
                </p>

                <form action={formAction} className="flex flex-col gap-0">
                  {next && <input type="hidden" name="next" value={next} />}
                  {ref && <input type="hidden" name="ref" value={ref} />}
                  <label htmlFor="email" className="mb-2 text-[13.5px] font-semibold text-[#334155]">
                    E-Mail-Adresse
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    required
                    disabled={isPending}
                    placeholder="du@beispiel.de"
                    className="mb-4 w-full rounded-xl border-[1.5px] border-[#e2e8f0] px-4 py-[15px] text-[15.5px] text-[#0f172a] outline-none focus:border-[#2563eb]"
                  />
                  {state.error && (
                    <p role="alert" aria-live="polite" className="mb-4 text-sm text-[#dc2626]">
                      {state.error}
                    </p>
                  )}
                  <button
                    type="submit"
                    disabled={isPending}
                    className="flex w-full items-center justify-center gap-2.5 rounded-xl bg-[#0f172a] py-4 text-[15.5px] font-semibold text-white shadow-[0_8px_20px_rgba(15,23,42,0.22)] transition hover:-translate-y-px disabled:opacity-50"
                  >
                    <svg
                      width="17"
                      height="17"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#fff"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden
                    >
                      <rect x="3" y="5" width="18" height="14" rx="2" />
                      <path d="m3 7 9 6 9-6" />
                    </svg>
                    {isPending ? "Wird gesendet…" : "Anmeldelink senden"}
                  </button>
                </form>

                <p className="mt-6 text-center text-[12.5px] leading-relaxed text-[#94a3b8]">
                  Mit der Anmeldung stimmst du unseren AGB und der Datenschutzerklärung zu.
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-center gap-2 text-[12.5px] text-[#94a3b8]">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#22a06b"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
          </svg>
          DSGVO-konform · Server in Frankfurt
        </div>
      </div>

      {/* ============ VISUAL PANEL ============ */}
      <div className="relative hidden overflow-hidden bg-[#0f172a] lg:block">
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(120% 100% at 15% 0%, rgba(37,99,235,.45), rgba(15,23,42,0) 55%), linear-gradient(180deg, #0f172a 0%, #111c34 100%)",
          }}
        />
        <div className="relative flex h-full flex-col p-12">
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3.5 py-1.5 text-[13px] font-semibold text-white backdrop-blur-md">
            <span className="h-[7px] w-[7px] rounded-full bg-[#4ade80]" />
            Für Handwerksbetriebe in Deutschland
          </div>

          <div className="flex flex-1 flex-col justify-center">
            <h2 className="mb-7 max-w-[440px] text-[33px] leading-[1.15] font-bold tracking-tight text-white text-balance">
              Angebote diktieren. In 90 Sekunden versendet.
            </h2>
            <div className="flex max-w-[400px] flex-col gap-[18px]">
              {USPS.map((u) => (
                <div key={u.title} className="flex items-start gap-3">
                  <div className="mt-px flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-lg bg-white/15 backdrop-blur-md">
                    <svg
                      width="15"
                      height="15"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#fff"
                      strokeWidth="2.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden
                    >
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                  </div>
                  <div>
                    <div className="mb-0.5 text-[15.5px] font-bold text-white">{u.title}</div>
                    <div className="text-[13.5px] leading-relaxed text-white/72">{u.body}</div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-8 max-w-[400px] rounded-2xl border border-white/16 bg-white/10 p-5 backdrop-blur-md">
              <div className="mb-3 text-[14.5px] leading-relaxed text-white italic">
                „Ich schreibe Angebote jetzt auf der Fahrt zur nächsten Baustelle — spart mir jeden
                Abend zwei Stunden Büro.”
              </div>
              <div className="flex items-center gap-2.5">
                <div className="flex h-[34px] w-[34px] items-center justify-center rounded-full bg-white/20 text-[13px] font-bold text-white">
                  MK
                </div>
                <div className="text-[13px] font-semibold text-white">
                  Martin Krause
                  <span className="block text-[12px] font-normal text-white/65">
                    Elektro Krause GmbH, Köln
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
