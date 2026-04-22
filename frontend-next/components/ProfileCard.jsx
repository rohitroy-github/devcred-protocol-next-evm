export default function ProfileCard({ profile }) {
  return (
    <article className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
      <h2 className="mb-2 text-lg font-semibold text-zinc-900">Developer Profile NFT</h2>
      <p className="text-sm text-zinc-600">
        On-chain profile stats linked to your developer NFT.
      </p>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-lg bg-zinc-100 p-3">
          <p className="text-xs uppercase tracking-wide text-zinc-500">Reputation</p>
          <p className="mt-1 text-lg font-semibold text-zinc-900">{profile.reputation}</p>
        </div>
        <div className="rounded-lg bg-zinc-100 p-3">
          <p className="text-xs uppercase tracking-wide text-zinc-500">Completed Jobs</p>
          <p className="mt-1 text-lg font-semibold text-zinc-900">{profile.completedJobs}</p>
        </div>
      </div>
    </article>
  );
}
