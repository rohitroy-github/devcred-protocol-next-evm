"use client";

import { useState } from "react";
import WalletButton from "../../components/WalletButton";
import { createJobOnChain } from "../../lib/evm";

const initialForm = {
  title: "",
  description: "",
  budget: "",
  developer: "",
  metadataURI: "",
};

export default function CreateJobPage() {
  const [form, setForm] = useState(initialForm);
  const [walletAddress, setWalletAddress] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  /**
   * Orchestrates the complete job creation flow:
   * 1. Registers or updates user wallet on backend
   * 2. Creates escrow job transaction on-chain (blockchain)
   * 3. Persists job details to MongoDB database
   * 
   * Syncs off-chain data with on-chain state to maintain consistency
   * between smart contract and MongoDB records.
   */
  async function handleSubmit(event) {
    event.preventDefault();

    // Validate that wallet is connected before proceeding
    if (!walletAddress) {
      setMessage("Connect wallet first.");
      return;
    }

    setIsSubmitting(true);
    setMessage("");

    try {
      // Step 1: Register/update user profile with wallet address
      await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletAddress }),
      });

      setMessage("Submitting createJob transaction...");

      // Step 2: Execute blockchain transaction to create escrow job
      // Returns jobId, client address, amount, and transaction hash
      const txResult = await createJobOnChain({
        amountEth: form.budget,
        developer: form.developer,
      });

      // Step 3: Persist job data to MongoDB after on-chain confirmation
      // Includes blockchain transaction hash for audit trail
      const response = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobId: txResult.jobId,
          client: txResult.client,
          amount: txResult.amount,
          title: form.title,
          description: form.description,
          developer: form.developer,
          metadataURI: form.metadataURI,
          txHash: txResult.createTxHash,
        }),
      });

      // Validate database operation succeeded
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result?.error || "Failed to create job");
      }

      // Success: Reset form and notify user
      // Event listener will sync additional state changes from blockchain
      setMessage(`Job #${txResult.jobId} created on-chain. Listener sync will refresh DB state.`);
      setForm(initialForm);
    } catch (error) {
      // Display error message to user (from blockchain or API)
      setMessage(error.message || "Unexpected error");
    } finally {
      // Always re-enable submit button, regardless of success/failure
      setIsSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-zinc-50 px-6 py-10">
      <div className="mx-auto max-w-xl rounded-xl bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-zinc-900">Create Job</h1>
        <div className="mt-2">
          <WalletButton label="Connect Wallet" onConnected={setWalletAddress} />
        </div>
        <p className="mt-3 text-sm text-zinc-600">Create an escrow job and persist it to MongoDB.</p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label htmlFor="title" className="mb-1 block text-sm font-medium text-zinc-700">
              Title
            </label>
            <input
              id="title"
              name="title"
              type="text"
              value={form.title}
              onChange={handleChange}
              placeholder="Build profile page"
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900"
            />
          </div>

          <div>
            <label htmlFor="description" className="mb-1 block text-sm font-medium text-zinc-700">
              Description
            </label>
            <textarea
              id="description"
              name="description"
              value={form.description}
              onChange={handleChange}
              rows={4}
              placeholder="Add wallet-based profile and status transitions"
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900"
            />
          </div>

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

          <div>
            <label htmlFor="metadataURI" className="mb-1 block text-sm font-medium text-zinc-700">
              Metadata URI (optional)
            </label>
            <input
              id="metadataURI"
              name="metadataURI"
              type="text"
              value={form.metadataURI}
              onChange={handleChange}
              placeholder="ipfs://..."
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700"
          >
            {isSubmitting ? "Creating..." : "Create Escrow Job"}
          </button>

          {message ? <p className="text-sm text-zinc-700">{message}</p> : null}
        </form>
      </div>
    </main>
  );
}
