const jobDetails = {
  id: 1,
  client: "0xA1...9F",
  developer: "0xC4...2D",
  amountEth: "0.30",
  status: "Submitted",
};

export default function JobDetailsPage({ params }) {
  return (
    <main className="min-h-screen bg-zinc-50 px-6 py-10">
      <div className="mx-auto max-w-2xl rounded-xl bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-zinc-900">Job #{params.id}</h1>
        <p className="mt-1 text-sm text-zinc-600">Escrow lifecycle placeholder for MVP.</p>

        <div className="mt-6 space-y-2 text-sm text-zinc-700">
          <p>Client: {jobDetails.client}</p>
          <p>Developer: {jobDetails.developer}</p>
          <p>Amount: {jobDetails.amountEth} ETH</p>
          <p>Status: {jobDetails.status}</p>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <button className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700">
            Assign Developer
          </button>
          <button className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700">
            Submit Work
          </button>
          <button className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500">
            Approve Work
          </button>
          <button className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100">
            Cancel Job
          </button>
        </div>
      </div>
    </main>
  );
}
