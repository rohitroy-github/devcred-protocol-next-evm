import Link from "next/link";
import JobCard from "../../components/JobCard";
import WalletButton from "../../components/WalletButton";

const mockJobs = [
  {
    id: 1,
    client: "0xA1...9F",
    developer: "0xC4...2D",
    amountEth: "0.30",
    status: "InProgress",
  },
  {
    id: 2,
    client: "0xB2...7E",
    developer: "",
    amountEth: "0.75",
    status: "Open",
  },
];

export default function JobsPage() {
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
            <WalletButton />
          </div>
        </header>

        <section className="grid gap-4 sm:grid-cols-2">
          {mockJobs.map((job) => (
            <Link key={job.id} href={`/jobs/${job.id}`} className="block">
              <JobCard job={job} />
            </Link>
          ))}
        </section>
      </div>
    </main>
  );
}
