"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { FiCopy } from "react-icons/fi";
import { FaEthereum } from "react-icons/fa";
import WalletButton from "../../../components/WalletButton";
import {
  autoReleaseFundsOnChain,
  autoReleaseMilestoneOnChain,
  approveWorkOnChain,
  approveMilestoneOnChain,
  assignDeveloperOnChain,
  cancelJobOnChain,
  rejectMilestoneOnChain,
  submitMilestoneOnChain,
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
        submitMilestone: "submit milestone",
        approveMilestone: "approve milestone",
        rejectMilestone: "reject milestone",
        autoReleaseMilestone: "auto-release milestone",
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

        if (action === "submitMilestone") {
          const submitMilestoneResult = await submitMilestoneOnChain(job.jobId);
          txHash = submitMilestoneResult.txHash;
        }

        if (action === "approve") {
          const approveResult = await approveWorkOnChain(job.jobId);
          txHash = approveResult.txHash;
        }

        if (action === "approveMilestone") {
          const approveMilestoneResult = await approveMilestoneOnChain(job.jobId);
          txHash = approveMilestoneResult.txHash;
        }

        if (action === "rejectMilestone") {
          const rejectMilestoneResult = await rejectMilestoneOnChain(job.jobId);
          txHash = rejectMilestoneResult.txHash;
        }

        if (action === "cancel") {
          const cancelResult = await cancelJobOnChain(job.jobId);
          txHash = cancelResult.txHash;
        }

        if (action === "autoRelease") {
          const autoReleaseResult = await autoReleaseFundsOnChain(job.jobId);
          txHash = autoReleaseResult.txHash;
        }

        if (action === "autoReleaseMilestone") {
          const autoReleaseMilestoneResult = await autoReleaseMilestoneOnChain(job.jobId);
          txHash = autoReleaseMilestoneResult.txHash;
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
  const isMilestoneJob = Boolean(job?.isMilestoneJob);
  const milestones = Array.isArray(job?.milestones) ? job.milestones : [];
  const currentMilestoneIndex = Number(job?.currentMilestoneIndex || 0);
  const currentMilestone = milestones[currentMilestoneIndex] || null;
  const currentMilestoneStatus = currentMilestone?.status || "Pending";
  const totalMilestoneBudget = milestones
    .reduce((sum, milestone) => sum + Number(milestone?.amount || 0), 0)
    .toFixed(4);

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
            Total Budget: {isMilestoneJob ? totalMilestoneBudget : job?.amount || "0"}
            <FaEthereum className="h-3.5 w-3.5 text-zinc-800" aria-hidden="true" />
          </p>
          <p>Status: {statusLabel}</p>
        </div>

                <div className="mt-4 rounded-lg border border-zinc-200 p-3">
          <h2 className="text-sm font-semibold text-zinc-900">Job Todo</h2>
          <p className="mt-2 text-xs text-zinc-600">{job?.description || "-"}</p>
        </div>


        {isMilestoneJob ? (
          <div className="mt-4 rounded-lg border border-zinc-200 p-3">
            <h2 className="text-sm font-semibold text-zinc-900">Milestones</h2>
            {milestones.length > 0 ? (
              <ol className="group mt-4 space-y-4 transition-colors rounded-lg p-2 -m-2">
                {milestones.map((milestone, index) => {
                  const status = milestone?.status || "Pending";
                  const isSubmitted = status === "Submitted";
                  const isApproved = status === "Approved";
                  const isRejected = status === "Rejected";
                  const nodeClass = isApproved
                    ? "bg-emerald-500"
                    : isSubmitted
                      ? "bg-amber-500"
                      : isRejected
                        ? "bg-rose-500"
                        : "bg-zinc-300";
                  const lineClass = isApproved || isSubmitted ? "bg-emerald-300" : "bg-zinc-200";
                  const statusTextClass = isApproved
                    ? "text-emerald-700"
                    : isSubmitted
                      ? "text-amber-700"
                      : isRejected
                        ? "text-rose-700"
                        : "text-zinc-600";

                  return (
                    <li key={`milestone-${index}`} className="relative pl-10 cursor-pointer">
                      <span
                        className={`absolute left-0 top-1.5 z-10 h-4 w-4 rounded-full ring-4 ring-white transition-all ${nodeClass} group-hover:ring-zinc-300`}
                        aria-hidden="true"
                      />
                      {index < milestones.length - 1 ? (
                        <span
                          className={`absolute left-[7px] top-5 h-[calc(100%+12px)] w-[2px] transition-opacity ${lineClass} group-hover:opacity-100`}
                          aria-hidden="true"
                        />
                      ) : null}

                      <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3 transition-all group-hover:bg-zinc-100 group-hover:shadow-sm">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-medium text-zinc-900">Milestone #{index + 1}</p>
                          <p className={`text-xs font-semibold ${statusTextClass}`}>{status}</p>
                        </div>
                        <p className="mt-1 inline-flex items-baseline gap-0.25 text-xs leading-none text-zinc-700">
                          Budget: {milestone?.amount || "0"}
                          <FaEthereum className="h-2.5 w-2.5 shrink-0 align-baseline text-zinc-800" aria-hidden="true" />
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ol>
            ) : (
              <p className="mt-2 text-xs text-zinc-600">No milestones recorded.</p>
            )}
          </div>
        ) : null}



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

          {!isMilestoneJob ? (
            <>
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
            </>
          ) : (
            <>
              <button
                onClick={() => submitAction("submitMilestone")}
                disabled={isJobLocked || !isDeveloperAssigned || currentMilestoneStatus !== "Pending" || job?.status !== "IN_PROGRESS"}
                className="cursor-pointer rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Submit Milestone
              </button>
              <button
                onClick={() => submitAction("approveMilestone")}
                disabled={isJobLocked || currentMilestoneStatus !== "Submitted" || job?.status !== "IN_PROGRESS"}
                className="cursor-pointer rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Approve Milestone
              </button>
              <button
                onClick={() => submitAction("rejectMilestone")}
                disabled={isJobLocked || currentMilestoneStatus !== "Submitted" || job?.status !== "IN_PROGRESS"}
                className="cursor-pointer rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-500 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Reject Milestone
              </button>
              <button
                onClick={() => submitAction("autoReleaseMilestone")}
                disabled={isJobLocked || currentMilestoneStatus !== "Submitted" || job?.status !== "IN_PROGRESS"}
                className="inline-flex cursor-pointer items-center justify-center gap-1 rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Auto-Release Milestone
                <FaEthereum className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </>
          )}

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
