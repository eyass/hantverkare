"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import {
  createCustomer,
  updateCustomer,
  deleteCustomer,
  type CustomerInput,
} from "./actions";
import { useAppLanguage } from "@/lib/i18n/AppLanguageProvider";
import { CUSTOMERS_DICTIONARY } from "./customers.dictionary";

type Customer = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
};

const inputClass =
  "w-full rounded-lg border border-transparent bg-transparent px-2 py-1.5 text-sm text-[#0f172a] outline-none transition-colors focus:border-[#e9edf2] focus:bg-[#f4f6f8]";

export function CustomerEditor({ customers: initialCustomers }: { customers: Customer[] }) {
  const { language } = useAppLanguage();
  const t = CUSTOMERS_DICTIONARY[language];
  const [customers, setCustomers] = useState(initialCustomers);
  const [lastSavedCustomers, setLastSavedCustomers] = useState(initialCustomers);
  const [error, setError] = useState<string | null>(null);
  const [newCustomer, setNewCustomer] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
  });
  const [isPending, startTransition] = useTransition();

  function handleAdd() {
    const input: CustomerInput = {
      name: newCustomer.name,
      email: newCustomer.email,
      phone: newCustomer.phone,
      address: newCustomer.address,
    };
    startTransition(async () => {
      const result = await createCustomer(input);
      if (result.error !== null) {
        setError(result.error);
        return;
      }
      setError(null);
      setCustomers((prev) => [...prev, result.customer]);
      setLastSavedCustomers((prev) => [...prev, result.customer]);
      setNewCustomer({ name: "", email: "", phone: "", address: "" });
    });
  }

  function handleFieldChange(
    id: string,
    field: "name" | "email" | "phone" | "address",
    value: string,
  ) {
    setCustomers((prev) =>
      prev.map((customer) => (customer.id === id ? { ...customer, [field]: value } : customer)),
    );
  }

  function handleBlurSave(customer: Customer) {
    startTransition(async () => {
      const result = await updateCustomer(customer.id, {
        name: customer.name,
        email: customer.email ?? "",
        phone: customer.phone ?? "",
        address: customer.address ?? "",
      });
      if (result.error !== null) {
        setError(result.error);
        setCustomers((prev) =>
          prev.map((c) =>
            c.id === customer.id
              ? (lastSavedCustomers.find((saved) => saved.id === customer.id) ?? c)
              : c,
          ),
        );
        return;
      }
      setError(null);
      setLastSavedCustomers((prev) => prev.map((c) => (c.id === customer.id ? customer : c)));
    });
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      const result = await deleteCustomer(id);
      if (result.error !== null) {
        setError(result.error);
        return;
      }
      setError(null);
      setCustomers((prev) => prev.filter((customer) => customer.id !== id));
      setLastSavedCustomers((prev) => prev.filter((customer) => customer.id !== id));
    });
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-[#0f172a]">{t.title}</h1>
        <div className="flex items-center gap-2">
          <Link
            href="/customers/import"
            className="rounded-full border border-[#e9edf2] bg-white px-4 py-3 text-sm font-medium text-[#0f172a] transition-colors hover:bg-[#f4f6f8]"
          >
            {t.importCustomers}
          </Link>
          <a
            href="/api/export/customers"
            download
            className="rounded-full border border-[#e9edf2] bg-white px-4 py-3 text-sm font-medium text-[#0f172a] transition-colors hover:bg-[#f4f6f8]"
          >
            {t.exportCsv}
          </a>
        </div>
      </div>
      {error && <p className="text-sm text-[#dc2626]">{error}</p>}
      <div className="overflow-hidden rounded-2xl border border-[#e9edf2] bg-white">
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-[#e9edf2] text-xs font-medium uppercase tracking-wide text-[#94a3b8]">
              <th className="px-4 py-3">{t.colName}</th>
              <th className="px-4 py-3">{t.colEmail}</th>
              <th className="px-4 py-3">{t.colPhone}</th>
              <th className="px-4 py-3">{t.colAddress}</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {customers.map((customer) => (
              <tr key={customer.id} className="border-b border-[#e9edf2] last:border-b-0">
                <td className="px-4 py-2">
                  <input
                    value={customer.name}
                    onChange={(e) => handleFieldChange(customer.id, "name", e.target.value)}
                    onBlur={() => handleBlurSave(customer)}
                    className={inputClass}
                  />
                </td>
                <td className="px-4 py-2">
                  <input
                    value={customer.email ?? ""}
                    onChange={(e) => handleFieldChange(customer.id, "email", e.target.value)}
                    onBlur={() => handleBlurSave(customer)}
                    className={inputClass}
                  />
                </td>
                <td className="px-4 py-2">
                  <input
                    value={customer.phone ?? ""}
                    onChange={(e) => handleFieldChange(customer.id, "phone", e.target.value)}
                    onBlur={() => handleBlurSave(customer)}
                    className={`w-32 ${inputClass}`}
                  />
                </td>
                <td className="px-4 py-2">
                  <input
                    value={customer.address ?? ""}
                    onChange={(e) => handleFieldChange(customer.id, "address", e.target.value)}
                    onBlur={() => handleBlurSave(customer)}
                    className={inputClass}
                  />
                </td>
                <td className="px-4 py-2">
                  <div className="flex items-center gap-3">
                    <Link
                      href={`/customers/${customer.id}`}
                      className="text-sm font-medium text-[#2563eb] hover:text-[#1d4ed8]"
                    >
                      {t.history}
                    </Link>
                    <button
                      onClick={() => handleDelete(customer.id)}
                      className="text-sm font-medium text-[#dc2626] hover:text-[#b91c1c]"
                    >
                      {t.delete}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-col gap-3 rounded-2xl border border-[#e9edf2] bg-white p-6">
        <h2 className="text-lg font-medium text-[#0f172a]">{t.newCustomerTitle}</h2>
        <div className="flex flex-wrap gap-2">
          <input
            value={newCustomer.name}
            onChange={(e) => setNewCustomer((prev) => ({ ...prev, name: e.target.value }))}
            placeholder={t.namePlaceholder}
            className="flex-1 rounded-xl border border-[#e9edf2] p-2.5 text-sm text-[#0f172a] outline-none focus:border-[#2563eb]"
          />
          <input
            value={newCustomer.email}
            onChange={(e) => setNewCustomer((prev) => ({ ...prev, email: e.target.value }))}
            placeholder={t.emailPlaceholder}
            className="flex-1 rounded-xl border border-[#e9edf2] p-2.5 text-sm text-[#0f172a] outline-none focus:border-[#2563eb]"
          />
          <input
            value={newCustomer.phone}
            onChange={(e) => setNewCustomer((prev) => ({ ...prev, phone: e.target.value }))}
            placeholder={t.phonePlaceholder}
            className="w-32 rounded-xl border border-[#e9edf2] p-2.5 text-sm text-[#0f172a] outline-none focus:border-[#2563eb]"
          />
          <input
            value={newCustomer.address}
            onChange={(e) => setNewCustomer((prev) => ({ ...prev, address: e.target.value }))}
            placeholder={t.addressPlaceholder}
            className="flex-1 rounded-xl border border-[#e9edf2] p-2.5 text-sm text-[#0f172a] outline-none focus:border-[#2563eb]"
          />
        </div>
        <button
          onClick={handleAdd}
          disabled={isPending}
          className="self-start rounded-full bg-[#2563eb] px-5 py-2.5 text-sm font-medium text-white shadow-[0_6px_16px_rgba(37,99,235,0.3)] transition-colors hover:bg-[#1d4ed8] disabled:opacity-50"
        >
          {t.addCustomer}
        </button>
      </div>
    </div>
  );
}
