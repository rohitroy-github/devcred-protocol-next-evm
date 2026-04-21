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

  async function readJsonSafely(response) {
    const raw = await response.text();
    if (!raw) {
      return null;
    }

    try {
      return JSON.parse(raw);
    } catch {
      throw new Error("Server returned an invalid response.");
    }
  }

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

    // Validate required form fields
    if (!form.title.trim()) {
      setMessage("Job title is required.");
      return;
    }

    if (!form.description.trim()) {
      setMessage("Job description is required.");
      return;
    }

    if (!form.budget || parseFloat(form.budget) <= 0) {
      setMessage("Budget must be greater than 0.");
      return;
    }

    setIsSubmitting(true);
    setMessage("");

    try {
      // Step 1: Register/update user profile with wallet address
      const userResponse = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletAddress }),
      });

      const userResult = await readJsonSafely(userResponse);

      if (!userResponse.ok) {
        throw new Error(
          userResult?.error ||
            "Failed to register owner (connected wallet) in DB.",
        );
      }

      setMessage("Submitting createJob transaction...");

      // Step 2: Execute blockchain transaction to create escrow job first
      // Returns jobId, client address, amount, and transaction hash
      let txResult;
      try {
        txResult = await createJobOnChain({
          amountEth: form.budget,
          developer: form.developer,
        });
      } catch (txError) {
        const txErrorMessage = String(txError?.message || "");
        if (txErrorMessage.toLowerCase().includes("insufficient")) {
          throw new Error("Insufficient funds or gas for transaction.");
        } else if (txErrorMessage.toLowerCase().includes("rejected")) {
          throw new Error("Transaction was rejected by wallet.");
        } else {
          throw new Error(txError?.message || "Failed to create job on-chain.");
        }
      }

      if (!txResult || !txResult.jobId) {
        throw new Error(
          "Transaction failed. No job ID was returned from blockchain.",
        );
      }

      // Step 3: After on-chain confirmation, persist job data to DB
      // Includes blockchain transaction hash for audit trail
      let response;
      try {
        response = await fetch("/api/jobs", {
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
      } catch (dbError) {
        // If DB sync fails, still show partial success since blockchain succeeded
        console.error("DB sync error:", dbError);
        setMessage(
          `Job #${txResult.jobId} created on-chain, but failed to sync with DB. Please try again.`,
        );
        setForm(initialForm);
        return;
      }

      const result = await readJsonSafely(response);

      // Set message based on both blockchain and DB sync status
      if (txResult && response.ok) {
        setMessage(
          `Job #${txResult.jobId} successfully created and synced with DB.`,
        );
        setForm(initialForm);
        setTimeout(() => setMessage(""), 2000);
      } else if (txResult && !response.ok) {
        const dbErrorMsg = result?.error || "Unknown database error.";
        setMessage(
          `Job #${txResult.jobId} created on-chain, but failed to sync with DB: ${dbErrorMsg}`,
        );
      } else {
        throw new Error("Job creation failed. No transaction ID returned.");
      }
    } catch (error) {
      // Display error message to user (from blockchain or API)
      const errorMsg = error?.message || "An unexpected error occurred.";
      setMessage(errorMsg);
      console.error("Job creation error:", error);
    } finally {
      // Always re-enable submit button, regardless of success/failure
      setIsSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-zinc-50 px-6 py-10">
      <div className="mx-auto max-w-xl rounded-xl bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900">Create Job</h1>
            <p className="mt-3 text-sm text-zinc-600">
              Create an escrow job for your development needs.
            </p>
          </div>
          <WalletButton label="Connect Wallet" onConnected={setWalletAddress} />
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label
              htmlFor="title"
              className="mb-1 block text-sm font-medium text-zinc-700"
            >
              Title
            </label>
            <input
              id="title"
              name="title"
              type="text"
              value={form.title}
              onChange={handleChange}
              placeholder="Build profile page"
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-900"
            />
          </div>

          <div>
            <label
              htmlFor="description"
              className="mb-1 block text-sm font-medium text-zinc-700"
            >
              Description
            </label>
            <textarea
              id="description"
              name="description"
              value={form.description}
              onChange={handleChange}
              rows={4}
              placeholder="Add wallet-based profile and status transitions"
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-900"
            />
          </div>

          <div>
            <label
              htmlFor="budget"
              className="mb-1 block text-sm font-medium text-zinc-700"
            >
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
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-900"
            />
          </div>

          <div>
            <label
              htmlFor="owner"
              className="mb-1 block text-sm font-medium text-zinc-700"
            >
              Owner (Connected Wallet)
            </label>
            <input
              id="owner"
              name="owner"
              type="text"
              value={walletAddress}
              disabled
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 bg-zinc-100 cursor-not-allowed outline-none"
            />
          </div>

          <div>
            <label
              htmlFor="developer"
              className="mb-1 block text-sm font-medium text-zinc-700"
            >
              Developer Wallet (optional)
            </label>
            <input
              id="developer"
              name="developer"
              type="text"
              value={form.developer}
              onChange={handleChange}
              placeholder="0x..."
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-900"
            />
          </div>

          <div>
            <label
              htmlFor="metadataURI"
              className="mb-1 block text-sm font-medium text-zinc-700"
            >
              Metadata URI (optional)
            </label>
            <input
              id="metadataURI"
              name="metadataURI"
              type="text"
              value={form.metadataURI}
              onChange={handleChange}
              placeholder="ipfs://..."
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-900"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 cursor-pointer"
          >
            {isSubmitting ? "Creating..." : "Create Escrow Job"}
          </button>

          {message ? <p className="text-sm text-zinc-700">{message}</p> : null}
        </form>
      </div>
    </main>
  );
}
