"use client";

import { useState } from "react";

const initialForm = {
  budget: "",
  developer: "",
};

export default function CreateJobPage() {
  const [form, setForm] = useState(initialForm);

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  function handleSubmit(event) {
    event.preventDefault();
    // Placeholder for createJob + optional assignDeveloper calls.
    console.log("Create job payload", form);
  }

  return (
    <main className="min-h-screen bg-zinc-50 px-6 py-10">
      <div className="mx-auto max-w-xl rounded-xl bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-zinc-900">Create Job</h1>
        <p className="mt-1 text-sm text-zinc-600">Super basic form for escrow job creation.</p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label htmlFor="budget" className="mb-1 block text-sm font-medium text-zinc-700">
              Budget (ETH)
            </label>
            <input
              id="budget"
              name="budget"
              type="number"
              step="0.01"
              value={form.budget}
              onChange={handleChange}
              placeholder="0.10"
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900"
            />
          </div>

          <div>
            <label htmlFor="developer" className="mb-1 block text-sm font-medium text-zinc-700">
              Developer Wallet (optional)
            </label>
            <input
              id="developer"
              name="developer"
              type="text"
              value={form.developer}
              onChange={handleChange}
              placeholder="0x..."
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900"
            />
          </div>

          <button
            type="submit"
            className="w-full rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700"
          >
            Create Escrow Job
          </button>
        </form>
      </div>
    </main>
  );
}
