"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { FiCopy } from "react-icons/fi";
import { FaEthereum } from "react-icons/fa";
import WalletButton from "../../../components/WalletButton";
import {
  autoReleaseFundsOnChain,
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
  AUTO_RELEASED: "AutoReleased",
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

  async function readJsonSafely(response) {
    let raw = "";
    try {
      raw = await response.text();
    } catch {
      throw new Error("Server response could not be read.");
    }

    if (!raw) {
      return null;
    }

    try {
      return JSON.parse(raw);
    } catch {
      throw new Error("Server returned invalid JSON.");
    }
  }

  function normalizeErrorMessage(error, fallback) {
    if (typeof error === "string" && error.trim()) return error;
    if (error instanceof Error && error.message.trim()) return error.message;
    if (error && typeof error.message === "string" && error.message.trim()) {
      return error.message;
    }
    return fallback;
  }

  function mapActionTxError(action, txError) {
    const actionLabel =
      {
        assign: "assign developer",
        submit: "submit work",
        approve: "approve work",
        cancel: "cancel job",
        autoRelease: "auto-release funds",
      }[action] || action;

    const message = String(txError?.message || "").toLowerCase();

    if (message.includes("insufficient")) {
      return "Insufficient funds or gas for transaction.";
    }

    if (message.includes("rejected") || message.includes("user denied")) {
      return "Transaction was rejected by wallet.";
    }

    if (message.includes("network") || message.includes("chain")) {
      return `Wallet network mismatch or chain error while trying to ${actionLabel}.`;
    }

    return normalizeErrorMessage(txError, `Failed to ${actionLabel} on-chain.`);
  }

  async function handleCopyAddress(value, label = "Address") {
    const address = typeof value === "string" ? value.trim() : "";
    if (!address || address === "-" || address === "Unassigned") return;

    try {
      await navigator.clipboard.writeText(address);
      setMessage(`${label} copied to clipboard.`);
      setTimeout(() => setMessage(""), 2000);
    } catch {
      setMessage(`Failed to copy ${label.toLowerCase()}.`);
    }
  }

  function renderAddressWithCopy(value, label, fallback = "-") {
    const address = typeof value === "string" ? value : "";
    const hasAddress = Boolean(address && address !== fallback && address !== "Unassigned");

    return (
      <span className="inline-flex items-center gap-2 align-middle">
        <span className="rounded-md bg-zinc-200 px-1.5 py-0.5 font-[Montserrat] text-xs text-zinc-800">
          {hasAddress ? address : fallback}
        </span>
        {hasAddress ? (
          <button
            type="button"
            onClick={() => handleCopyAddress(address, label)}
            aria-label={`Copy ${label}`}
            title={`Copy ${label}`}
            className="cursor-pointer rounded-full p-1 text-zinc-700 hover:bg-zinc-100"
          >
            <FiCopy className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        ) : null}
      </span>
    );
  }

  async function postJson(url, payload, contextLabel) {
    let response;
    try {
      response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } catch {
      throw new Error(
        `${contextLabel}: network error. Please check connection and try again.`,
      );
    }

    const result = await readJsonSafely(response);
    if (!response.ok) {
      throw new Error(
        result?.error || `${contextLabel} failed (HTTP ${response.status}).`,
      );
    }

    return result;
  }

  async function loadJob() {
    if (!jobIdParam) {
      setMessage("Invalid job id");
      return;
    }

    try {
      const response = await fetch(`/api/jobs/${jobIdParam}`, {
        cache: "no-store",
      });
      const result = await readJsonSafely(response);

      if (!response.ok) {
        setMessage(result?.error || "Failed to load job");
        return;
      }

      if (!result?.job) {
        setMessage("Job payload was missing in server response.");
        return;
      }

      setJob(result.job);
      setEvents(Array.isArray(result.events) ? result.events : []);
      setDeveloperInput(result.job.developer || "");
    } catch (error) {
      setMessage(normalizeErrorMessage(error, "Failed to load job"));
    }
  }

  useEffect(() => {
    loadJob().catch(() => {
      setMessage("Failed to load job");
    });
  }, [jobIdParam]);

  async function submitAction(action) {
    if (!job) return;

    // Step 1: Validate required input before sending any transaction.
    if (action === "assign" && !developerInput.trim()) {
      setMessage("Developer address is required to assign the job.");
      return;
    }

    if (action === "cancel" && !isClientActor) {
      setMessage("Only the client can cancel this job.");
      return;
    }

    try {
      setMessage(`Submitting ${action} transaction on-chain 🔃.`);

      let txHash = "";

      // Step 2: Execute the selected on-chain action and capture tx hash.
      try {
        if (action === "assign") {
          const assignResult = await assignDeveloperOnChain(
            job.jobId,
            developerInput,
          );
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

        if (action === "autoRelease") {
          const autoReleaseResult = await autoReleaseFundsOnChain(job.jobId);
          txHash = autoReleaseResult.txHash;
        }
      } catch (txError) {
        throw new Error(mapActionTxError(action, txError));
      }

      // Step 3: Ensure blockchain call returned a transaction hash.
      if (!txHash) {
        throw new Error(`No transaction hash returned for ${action} action.`);
      }

      // Step 4: Sync the confirmed action into the off-chain DB.
      await postJson(
        `/api/jobs/${job.jobId}/actions`,
        {
          action,
          actor: walletAddress || job.client,
          txHash,
          developer: action === "assign" ? developerInput : "",
        },
        `Failed to sync ${action} state to DB`,
      );

      // Step 5: Reload job and event state so UI reflects latest status.
      setMessage(`Transaction: ${action} confirmed. Syncing UI accordingly ✅.`);
      await loadJob();

      // Step 6: Clear transient success message after UI sync finishes.
      setTimeout(() => setMessage(""), 2000);
    } catch (error) {
      setMessage(normalizeErrorMessage(error, "Action failed"));
    }
  }

  const statusLabel = useMemo(() => {
    return statusLabelMap[job?.status] || job?.status || "Unknown";
  }, [job]);

  const connectedWallet = String(walletAddress || "").trim().toLowerCase();
  const jobClientWallet = String(job?.client || "").trim().toLowerCase();
  const isClientActor =
    Boolean(connectedWallet) &&
    Boolean(jobClientWallet) &&
    connectedWallet === jobClientWallet;

  const assignedDeveloperLabel = job?.developer || developerInput || "";
  const isDeveloperAssigned =
    Boolean(job?.developer) &&
    job?.developer !== "Unassigned" &&
    job?.developer !== "0x0000000000000000000000000000000000000000";
  const isJobLocked =
    job?.status === "CANCELLED" ||
    job?.status === "COMPLETED" ||
    job?.status === "AUTO_RELEASED";

  return (
    <main className="min-h-screen bg-zinc-50 px-6 py-10">
      <div className="mx-auto max-w-2xl rounded-xl bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900">
              Job #{jobIdParam || "-"}
            </h1>
            <p className="mt-1 text-sm text-zinc-600">
              Escrow lifecycle with DB-backed status updates.
            </p>
          </div>
          <WalletButton label="Connect Wallet" onConnected={setWalletAddress} />
        </div>

        <div className="mt-6 space-y-2 text-sm text-zinc-700">
          <p>Client: {renderAddressWithCopy(job?.client, "Client wallet")}</p>
          <p>
            Developer: {renderAddressWithCopy(job?.developer, "Developer wallet", "Unassigned")}
          </p>
          <p className="inline-flex items-center gap-0.5">
            Amount: {job?.amount || "0"}
            <FaEthereum className="h-3.5 w-3.5 text-zinc-800" aria-hidden="true" />
          </p>
          <p>Status: {statusLabel}</p>
        </div>

        <div className="mt-4 rounded-lg border border-zinc-200 p-3">
          <h2 className="text-sm font-semibold text-zinc-900">Job Todo</h2>
          <p className="mt-2 text-xs text-zinc-600">{job?.description || "-"}</p>
        </div>

        <div className="mt-4">
          <label
            htmlFor="developer"
            className="mb-1 block text-sm font-medium text-zinc-700"
          >
            Developer Address (for assign)
          </label>
          <input
            id="developer"
            type="text"
            value={developerInput}
            onChange={(event) => setDeveloperInput(event.target.value)}
            disabled={Boolean(job?.developer)}
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-900 disabled:bg-zinc-100 disabled:cursor-not-allowed disabled:text-zinc-500"
            placeholder="0x..."
          />
        </div>

        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <button
            onClick={() => submitAction("assign")}
            disabled={Boolean(job?.developer) || job?.status === "IN_PROGRESS" || isJobLocked}
            className="cursor-pointer rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Assign Developer
          </button>
          <button
            onClick={() => submitAction("submit")}
            disabled={isJobLocked || !isDeveloperAssigned}
            className="cursor-pointer rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Submit Work
          </button>
          <button
            onClick={() => submitAction("approve")}
            disabled={job?.status !== "SUBMITTED" || isJobLocked}
            className="cursor-pointer rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Approve Work
          </button>
          <button
            onClick={() => submitAction("autoRelease")}
            disabled={job?.status !== "SUBMITTED" || isJobLocked}
            className="inline-flex cursor-pointer items-center justify-center gap-1 rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Auto-Release Escrow
            <FaEthereum className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
          <button
            onClick={() => submitAction("cancel")}
            disabled={isJobLocked || !isClientActor}
            className="cursor-pointer rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Cancel Job
          </button>
        </div>

        {message ? (
          <p className="mt-4 text-sm text-zinc-700">{message}</p>
        ) : null}

        <div className="mt-6 rounded-lg border border-zinc-200 p-3">
          <h2 className="text-sm font-semibold text-zinc-900">Events</h2>
          <ul className="mt-2 space-y-1 text-xs text-zinc-600">
            {events.map((event) => (
              <li key={`${event.txHash}-${event.eventType}`}>
                {event.eventType}{" "}
                {event.eventType === "JobAssigned" && (event.recipient || assignedDeveloperLabel) ? (
                  <>
                    to{" "}
                    {renderAddressWithCopy(
                      event.recipient || assignedDeveloperLabel,
                      "Assigned developer",
                    )}
                  </>
                ) : (
                  <>
                    by {renderAddressWithCopy(event.triggeredBy, "Triggered by")}
                  </>
                )}
              </li>
            ))}
            {events.length === 0 ? <li>No events yet.</li> : null}
          </ul>
        </div>
      </div>
    </main>
  );
}
