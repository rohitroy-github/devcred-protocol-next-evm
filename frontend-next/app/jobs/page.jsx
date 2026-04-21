"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import JobCard from "../../components/JobCard";
import WalletButton from "../../components/WalletButton";

const statusLabelMap = {
  OPEN: "Open",
  IN_PROGRESS: "InProgress",
  SUBMITTED: "Submitted",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
  DISPUTED: "Cancelled",
};

export default function JobsPage() {
  const [jobs, setJobs] = useState([]);
  const [walletAddress, setWalletAddress] = useState("");
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("ALL");

  useEffect(() => {
    async function loadJobs() {
      try {
        const response = await fetch("/api/jobs", { cache: "no-store" });
        const result = await response.json();
        setJobs(Array.isArray(result.jobs) ? result.jobs : []);
      } finally {
        setLoading(false);
      }
    }

    loadJobs();
  }, []);

  useEffect(() => {
    async function upsertUser() {
      if (!walletAddress) return;
      await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletAddress }),
      });
    }

    upsertUser().catch(() => {});
  }, [walletAddress]);

  const formattedJobs = useMemo(() => {
    let filtered = jobs.map((job) => ({
      id: job.jobId,
      client: job.client,
      developer: job.developer,
      description: job.description,
      amountEth: job.amount,
      status: statusLabelMap[job.status] || "Open",
      rawStatus: job.status,
    }));

    if (statusFilter !== "ALL") {
      filtered = filtered.filter((job) => job.rawStatus === statusFilter);
    }

    return filtered;
  }, [jobs, statusFilter]);

  return (
    <main className="min-h-screen bg-zinc-50 px-6 py-10">
      <div className="mx-auto max-w-4xl space-y-6">
        <header className="flex flex-col gap-4 rounded-xl bg-white p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900">Jobs</h1>
            <p className="text-sm text-zinc-600">Browse and track escrow jobs.</p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/create-job"
              className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100"
            >
              Create Job
            </Link>
            <WalletButton onConnected={setWalletAddress} />
          </div>
        </header>

        <div className="flex items-center justify-end gap-3">
          <label htmlFor="status-filter" className="text-sm font-medium text-zinc-700">
            Filter by job status:
          </label>
          <select
            id="status-filter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-900 outline-none focus:border-zinc-900 bg-white cursor-pointer"
          >
            <option value="ALL">All</option>
            <option value="OPEN">Open</option>
            <option value="IN_PROGRESS">In Progress</option>
          </select>
        </div>

        <section className="grid gap-4 sm:grid-cols-2">
          {loading ? <p className="text-sm text-zinc-600">Loading jobs...</p> : null}
          {!loading && formattedJobs.length === 0 ? (
            <p className="text-sm text-zinc-600">No jobs yet. Create one from the button above.</p>
          ) : null}
          {formattedJobs.map((job) => (
            <Link key={job.id} href={`/jobs/${job.id}`} className="block">
              <JobCard job={job} />
            </Link>
          ))}
        </section>
      </div>
    </main>
  );
}
