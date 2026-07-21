"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import {
  createCustomer,
  updateCustomer,
  deleteCustomer,
  type CustomerInput,
} from "./actions";

type Customer = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
};

export function CustomerEditor({ customers: initialCustomers }: { customers: Customer[] }) {
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
      <h1 className="text-2xl font-semibold">Kunden</h1>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <table className="w-full border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-zinc-300 dark:border-zinc-700">
            <th className="py-2">Name</th>
            <th className="py-2">E-Mail</th>
            <th className="py-2">Telefon</th>
            <th className="py-2">Adresse</th>
            <th className="py-2"></th>
          </tr>
        </thead>
        <tbody>
          {customers.map((customer) => (
            <tr key={customer.id} className="border-b border-zinc-200 dark:border-zinc-800">
              <td className="py-2">
                <input
                  value={customer.name}
                  onChange={(e) => handleFieldChange(customer.id, "name", e.target.value)}
                  onBlur={() => handleBlurSave(customer)}
                  className="w-full bg-transparent"
                />
              </td>
              <td className="py-2">
                <input
                  value={customer.email ?? ""}
                  onChange={(e) => handleFieldChange(customer.id, "email", e.target.value)}
                  onBlur={() => handleBlurSave(customer)}
                  className="w-full bg-transparent"
                />
              </td>
              <td className="py-2">
                <input
                  value={customer.phone ?? ""}
                  onChange={(e) => handleFieldChange(customer.id, "phone", e.target.value)}
                  onBlur={() => handleBlurSave(customer)}
                  className="w-32 bg-transparent"
                />
              </td>
              <td className="py-2">
                <input
                  value={customer.address ?? ""}
                  onChange={(e) => handleFieldChange(customer.id, "address", e.target.value)}
                  onBlur={() => handleBlurSave(customer)}
                  className="w-full bg-transparent"
                />
              </td>
              <td className="py-2">
                <div className="flex items-center gap-3">
                  <Link href={`/customers/${customer.id}`} className="underline">
                    Verlauf
                  </Link>
                  <button
                    onClick={() => handleDelete(customer.id)}
                    className="text-red-600 underline"
                  >
                    Löschen
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex flex-col gap-2 border-t border-zinc-300 pt-4 dark:border-zinc-700">
        <h2 className="text-lg font-medium">Neuer Kunde</h2>
        <div className="flex flex-wrap gap-2">
          <input
            value={newCustomer.name}
            onChange={(e) => setNewCustomer((prev) => ({ ...prev, name: e.target.value }))}
            placeholder="Name"
            className="flex-1 rounded-md border border-zinc-300 p-2 dark:border-zinc-700 dark:bg-zinc-900"
          />
          <input
            value={newCustomer.email}
            onChange={(e) => setNewCustomer((prev) => ({ ...prev, email: e.target.value }))}
            placeholder="E-Mail"
            className="flex-1 rounded-md border border-zinc-300 p-2 dark:border-zinc-700 dark:bg-zinc-900"
          />
          <input
            value={newCustomer.phone}
            onChange={(e) => setNewCustomer((prev) => ({ ...prev, phone: e.target.value }))}
            placeholder="Telefon"
            className="w-32 rounded-md border border-zinc-300 p-2 dark:border-zinc-700 dark:bg-zinc-900"
          />
          <input
            value={newCustomer.address}
            onChange={(e) => setNewCustomer((prev) => ({ ...prev, address: e.target.value }))}
            placeholder="Adresse"
            className="flex-1 rounded-md border border-zinc-300 p-2 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </div>
        <button
          onClick={handleAdd}
          disabled={isPending}
          className="self-start rounded-full bg-foreground px-5 py-3 text-background disabled:opacity-50"
        >
          Kunde hinzufügen
        </button>
      </div>
    </div>
  );
}
