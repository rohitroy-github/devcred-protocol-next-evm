export default function JobCard({ job }) {
  const statusColors = {
    Open: "bg-amber-100 text-amber-800",
    InProgress: "bg-emerald-100 text-emerald-800",
    inProgress: "bg-emerald-100 text-emerald-800",
    Submitted: "bg-violet-100 text-violet-800",
    Completed: "bg-emerald-100 text-emerald-800",
    Cancelled: "bg-zinc-200 text-zinc-700",
  };

  const shortenAddress = (value) => {
    if (typeof value !== "string") return "";
    const trimmed = value.trim();
    const isWalletAddress = /^0x[a-fA-F0-9]{40}$/.test(trimmed);
    return isWalletAddress ? `${trimmed.slice(0, 6)}...${trimmed.slice(-4)}` : trimmed;
  };

  const shortenText = (value, maxLength = 90) => {
    if (typeof value !== "string") return "";
    const trimmed = value.trim();
    if (trimmed.length <= maxLength) return trimmed;
    return `${trimmed.slice(0, maxLength).trimEnd()}...`;
  };

  return (
    <article className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-base font-semibold text-zinc-900">Job #{job.id}</h3>
        <span
          className={`rounded-full px-2 py-1 text-xs font-medium ${
            statusColors[job.status] || "bg-zinc-100 text-zinc-700"
          }`}
        >
          {job.status === "InProgress" || job.status === "inProgress"
            ? "In Porgress"
            : job.status}
        </span>
      </div>
      <p className="text-sm text-zinc-600">Client: {shortenAddress(job.client)}</p>
      <p className="text-sm text-zinc-600">
        Developer: {job.developer ? shortenAddress(job.developer) : "Unassigned"}
      </p>
      {job.description ? (
        <p className="mt-2 text-sm text-zinc-700">Description: {shortenText(job.description)}</p>
      ) : null}
      <p className="mt-2 text-sm font-medium text-zinc-900">Amount: {job.amountEth} ETH</p>
    </article>
  );
}
