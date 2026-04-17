"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import WalletButton from "../../../components/WalletButton";
import {
  approveWorkOnChain,
  assignDeveloperOnChain,
  cancelJobOnChain,
  submitWorkOnChain,
} from "../../../lib/evm";

const statusLabelMap = {
  OPEN: "Open",
  IN_PROGRESS: "InProgress",
  SUBMITTED: "Submitted",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
  DISPUTED: "Disputed",
};

export default function JobDetailsPage() {
  const params = useParams();
  const jobIdParam = Array.isArray(params?.id) ? params.id[0] : params?.id;
  const [walletAddress, setWalletAddress] = useState("");
  const [job, setJob] = useState(null);
  const [events, setEvents] = useState([]);
  const [developerInput, setDeveloperInput] = useState("");
  const [message, setMessage] = useState("");

  async function loadJob() {
    if (!jobIdParam) {
      setMessage("Invalid job id");
      return;
    }

    const response = await fetch(`/api/jobs/${jobIdParam}`, { cache: "no-store" });
    const result = await response.json();
    if (!response.ok) {
      setMessage(result?.error || "Failed to load job");
      return;
    }

    setJob(result.job);
    setEvents(Array.isArray(result.events) ? result.events : []);
    setDeveloperInput(result.job.developer || "");
  }

  useEffect(() => {
    loadJob().catch(() => {
      setMessage("Failed to load job");
    });
  }, [jobIdParam]);

  async function runAction(action) {
    if (!job) return;

    try {
      setMessage(`Submitting ${action} transaction...`);

      let txHash = "";

      if (action === "assign") {
        const assignResult = await assignDeveloperOnChain(job.jobId, developerInput);
        txHash = assignResult.txHash;
      }

      if (action === "submit") {
        const submitResult = await submitWorkOnChain(job.jobId);
        txHash = submitResult.txHash;
      }

      if (action === "approve") {
        const approveResult = await approveWorkOnChain(job.jobId);
        txHash = approveResult.txHash;
      }

      if (action === "cancel") {
        const cancelResult = await cancelJobOnChain(job.jobId);
        txHash = cancelResult.txHash;
      }

      const syncResponse = await fetch(`/api/jobs/${job.jobId}/actions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          actor: walletAddress || job.client,
          txHash,
          developer: action === "assign" ? developerInput : "",
        }),
      });

      const syncResult = await syncResponse.json();
      if (!syncResponse.ok) {
        throw new Error(syncResult?.error || `Failed to sync ${action} state to DB`);
      }

      setMessage(`${action} transaction confirmed. Refreshing DB view...`);
      await loadJob();
    } catch (error) {
      setMessage(error.message || "Action failed");
    }
  }

  const statusLabel = useMemo(() => {
    return statusLabelMap[job?.status] || job?.status || "Unknown";
  }, [job]);

  return (
    <main className="min-h-screen bg-zinc-50 px-6 py-10">
      <div className="mx-auto max-w-2xl rounded-xl bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-zinc-900">Job #{jobIdParam || "-"}</h1>
        <p className="mt-1 text-sm text-zinc-600">Escrow lifecycle with DB-backed status updates.</p>

        <div className="mt-3">
          <WalletButton label="Connect Wallet" onConnected={setWalletAddress} />
        </div>

        <div className="mt-6 space-y-2 text-sm text-zinc-700">
          <p>Client: {job?.client || "-"}</p>
          <p>Developer: {job?.developer || "Unassigned"}</p>
          <p>Amount: {job?.amount || "0"} ETH</p>
          <p>Status: {statusLabel}</p>
        </div>

        <div className="mt-4">
          <label htmlFor="developer" className="mb-1 block text-sm font-medium text-zinc-700">
            Developer Address (for assign)
          </label>
          <input
            id="developer"
            type="text"
            value={developerInput}
            onChange={(event) => setDeveloperInput(event.target.value)}
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-900"
            placeholder="0x..."
          />
        </div>

        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <button
            onClick={() => runAction("assign")}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700"
          >
            Assign Developer
          </button>
          <button
            onClick={() => runAction("submit")}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700"
          >
            Submit Work
          </button>
          <button
            onClick={() => runAction("approve")}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500"
          >
            Approve Work
          </button>
          <button
            onClick={() => runAction("cancel")}
            className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
          >
            Cancel Job
          </button>
        </div>

        {message ? <p className="mt-4 text-sm text-zinc-700">{message}</p> : null}

        <div className="mt-6 rounded-lg border border-zinc-200 p-3">
          <h2 className="text-sm font-semibold text-zinc-900">Events</h2>
          <ul className="mt-2 space-y-1 text-xs text-zinc-600">
            {events.map((event) => (
              <li key={`${event.txHash}-${event.eventType}`}>
                {event.eventType} by {event.triggeredBy}
              </li>
            ))}
            {events.length === 0 ? <li>No events yet.</li> : null}
          </ul>
        </div>
      </div>
    </main>
  );
}
