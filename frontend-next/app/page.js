import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-zinc-50 px-6 py-8">
      <div className="mx-auto max-w-5xl">
        <nav className="flex flex-col gap-4 rounded-xl bg-white px-5 py-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <Link href="/" className="text-lg font-semibold text-zinc-900">
            DevCred Protocol
          </Link>
          <div className="flex flex-wrap gap-3 text-sm font-medium">
            <Link
              href="/jobs"
              className="rounded-lg border border-zinc-300 px-4 py-2 text-zinc-700 transition hover:bg-zinc-100"
            >
              Jobs
            </Link>
            <Link
              href="/profile"
              className="rounded-lg border border-zinc-300 px-4 py-2 text-zinc-700 transition hover:bg-zinc-100"
            >
              Profile
            </Link>
            <Link
              href="/create-job"
              className="rounded-lg bg-zinc-900 px-4 py-2 text-white transition hover:bg-zinc-700"
            >
              Create Job
            </Link>
          </div>
        </nav>

        <section className="mt-8 rounded-2xl bg-white p-8 shadow-sm sm:p-12">
          <span className="inline-flex rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-700">
            MVP Workflow
          </span>
          <h1 className="mt-4 max-w-2xl text-4xl font-bold tracking-tight text-zinc-900 sm:text-5xl">
            Ship freelance work through escrow and build on-chain reputation.
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-zinc-600">
            DevCred combines a profile NFT with a lightweight escrow flow so clients can fund jobs,
            assign developers, approve submissions, and update reputation after payment.
          </p>

          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl bg-zinc-100 p-5">
              <p className="text-sm font-semibold text-zinc-900">1. Mint Profile</p>
              <p className="mt-2 text-sm text-zinc-600">Create a developer identity with reputation and completed jobs.</p>
            </div>
            <div className="rounded-xl bg-zinc-100 p-5">
              <p className="text-sm font-semibold text-zinc-900">2. Fund Job</p>
              <p className="mt-2 text-sm text-zinc-600">Clients create escrow-backed jobs and optionally assign a developer.</p>
            </div>
            <div className="rounded-xl bg-zinc-100 p-5">
              <p className="text-sm font-semibold text-zinc-900">3. Approve Work</p>
              <p className="mt-2 text-sm text-zinc-600">Release payment and update developer reputation on completion.</p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
