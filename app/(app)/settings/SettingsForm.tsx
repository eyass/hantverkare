"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { saveBusinessSettings, updateLanguage } from "./actions";
import { SETTINGS_DICTIONARY } from "./settings.dictionary";
import { useAppLanguage } from "@/lib/i18n/AppLanguageProvider";
import type { AppLanguage } from "@/lib/i18n/dictionary";

type BusinessSettings = {
  company_name: string | null;
  address: string | null;
  vat_id: string | null;
  tax_number: string | null;
};

export function SettingsForm({
  initialSettings,
  referralUrl,
}: {
  initialSettings: BusinessSettings | null;
  referralUrl: string | null;
}) {
  const [companyName, setCompanyName] = useState(initialSettings?.company_name ?? "");
  const [address, setAddress] = useState(initialSettings?.address ?? "");
  const [vatId, setVatId] = useState(initialSettings?.vat_id ?? "");
  const [taxNumber, setTaxNumber] = useState(initialSettings?.tax_number ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [copied, setCopied] = useState(false);

  const router = useRouter();
  const { language, setLanguage } = useAppLanguage();
  const [languageError, setLanguageError] = useState<string | null>(null);
  const [languageSaved, setLanguageSaved] = useState(false);
  const [isLanguagePending, startLanguageTransition] = useTransition();

  const t = SETTINGS_DICTIONARY[language];

  async function handleCopyReferralLink() {
    if (!referralUrl) return;
    try {
      await navigator.clipboard.writeText(referralUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy referral link:", err);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await saveBusinessSettings({
        companyName,
        address,
        vatId,
        taxNumber,
      });
      if (result.error !== null) {
        setError(result.error);
        setSaved(false);
        return;
      }
      setError(null);
      setSaved(true);
    });
  }

  function handleLanguageChange(next: AppLanguage) {
    // Update the client context immediately for an instant re-render, then
    // persist server-side and refresh so Server Components (nav labels,
    // other page copy) pick up the new language too. If the save fails,
    // revert the optimistic client-side change (issue #116).
    const previous = language;
    setLanguage(next);
    startLanguageTransition(async () => {
      const result = await updateLanguage(next);
      if (result.error !== null) {
        setLanguage(previous);
        setLanguageError(result.error);
        setLanguageSaved(false);
        return;
      }
      setLanguageError(null);
      setLanguageSaved(true);
      router.refresh();
    });
  }

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6 p-6 sm:p-8">
      <h1 className="text-2xl font-semibold text-[#0f172a]">{t.businessTitle}</h1>

      <div className="rounded-2xl border border-[#e9edf2] bg-white p-6">
        <h2 className="text-base font-semibold text-[#0f172a]">{t.languageTitle}</h2>
        <p className="mt-1 text-sm text-[#64748b]">{t.languageDescription}</p>
        {languageError && <p className="mt-3 text-sm text-[#dc2626]">{languageError}</p>}
        {languageSaved && !languageError && (
          <p className="mt-3 text-sm text-[#16a34a]">{t.languageSaved}</p>
        )}
        <select
          value={language}
          disabled={isLanguagePending}
          onChange={(e) => {
            setLanguageSaved(false);
            handleLanguageChange(e.target.value as AppLanguage);
          }}
          className="mt-4 rounded-xl border border-[#e9edf2] p-2.5 text-sm font-normal text-[#0f172a] outline-none focus:border-[#2563eb]"
        >
          <option value="de">{t.languageDe}</option>
          <option value="en">{t.languageEn}</option>
        </select>
      </div>

      <div className="rounded-2xl border border-[#e9edf2] bg-white p-6">
        {error && <p className="mb-4 text-sm text-[#dc2626]">{error}</p>}
        {saved && !error && <p className="mb-4 text-sm text-[#16a34a]">{t.saved}</p>}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5 text-sm font-medium text-[#0f172a]">
            {t.companyName}
            <input
              value={companyName}
              onChange={(e) => {
                setCompanyName(e.target.value);
                setSaved(false);
              }}
              className="rounded-xl border border-[#e9edf2] p-2.5 text-sm font-normal text-[#0f172a] outline-none focus:border-[#2563eb]"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-medium text-[#0f172a]">
            {t.address}
            <textarea
              value={address}
              onChange={(e) => {
                setAddress(e.target.value);
                setSaved(false);
              }}
              rows={3}
              className="rounded-xl border border-[#e9edf2] p-2.5 text-sm font-normal text-[#0f172a] outline-none focus:border-[#2563eb]"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-medium text-[#0f172a]">
            {t.vatId}
            <input
              value={vatId}
              onChange={(e) => {
                setVatId(e.target.value);
                setSaved(false);
              }}
              className="rounded-xl border border-[#e9edf2] p-2.5 text-sm font-normal text-[#0f172a] outline-none focus:border-[#2563eb]"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-medium text-[#0f172a]">
            {t.taxNumber}
            <input
              value={taxNumber}
              onChange={(e) => {
                setTaxNumber(e.target.value);
                setSaved(false);
              }}
              className="rounded-xl border border-[#e9edf2] p-2.5 text-sm font-normal text-[#0f172a] outline-none focus:border-[#2563eb]"
            />
          </label>
          <button
            type="submit"
            disabled={isPending}
            className="mt-2 self-start rounded-full bg-[#2563eb] px-5 py-2.5 text-sm font-medium text-white shadow-[0_6px_16px_rgba(37,99,235,0.3)] transition-colors hover:bg-[#1d4ed8] disabled:opacity-50"
          >
            {t.save}
          </button>
        </form>
      </div>
      <div className="rounded-2xl border border-[#e9edf2] bg-white p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-[#0f172a]">{t.securityTitle}</h2>
            <p className="mt-1 text-sm text-[#64748b]">{t.securityDescription}</p>
          </div>
          <Link
            href="/settings/security"
            className="rounded-full border border-[#e9edf2] px-4 py-2 text-sm font-medium text-[#0f172a] hover:bg-[#f4f6f8]"
          >
            {t.manage}
          </Link>
        </div>
      </div>

      <div className="rounded-2xl border border-[#e9edf2] bg-white p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-[#0f172a]">{t.paymentsTitle}</h2>
            <p className="mt-1 text-sm text-[#64748b]">{t.paymentsDescription}</p>
          </div>
          <Link
            href="/settings/payments"
            className="rounded-full border border-[#e9edf2] px-4 py-2 text-sm font-medium text-[#0f172a] hover:bg-[#f4f6f8]"
          >
            {t.manage}
          </Link>
        </div>
      </div>

      {referralUrl && (
        <div className="rounded-2xl border border-[#e9edf2] bg-white p-6">
          <h2 className="text-base font-semibold text-[#0f172a]">{t.referralTitle}</h2>
          <p className="mt-1.5 text-sm text-[#64748b]">{t.referralDescription}</p>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
            <input
              readOnly
              value={referralUrl}
              onFocus={(e) => e.target.select()}
              className="flex-1 rounded-xl border border-[#e9edf2] bg-[#f4f6f8] p-2.5 text-sm font-normal text-[#0f172a] outline-none"
            />
            <button
              type="button"
              onClick={handleCopyReferralLink}
              className="rounded-xl border border-[#e9edf2] px-4 py-2.5 text-sm font-semibold text-[#0f172a] hover:bg-[#f4f6f8]"
            >
              {copied ? t.copied : t.copyLink}
            </button>
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-[#e9edf2] bg-white p-6">
        <h2 className="text-base font-semibold text-[#0f172a]">{t.exportTitle}</h2>
        <p className="mt-1.5 text-sm text-[#64748b]">{t.exportDescription}</p>
        <a
          href="/settings/export"
          className="mt-4 inline-block rounded-xl border border-[#e9edf2] px-4 py-2.5 text-sm font-semibold text-[#0f172a] hover:bg-[#f4f6f8]"
        >
          {t.exportButton}
        </a>
      </div>
    </div>
  );
}
