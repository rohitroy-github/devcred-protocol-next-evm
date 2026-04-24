import { FiAward, FiCheckCircle, FiUser } from "react-icons/fi";

export default function ProfileCard({ profile }) {
  const reputation = profile?.reputation ?? 0;
  const completedJobs = profile?.completedJobs ?? 0;

  return (
    <article className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
      <div className="border-b border-zinc-200 bg-zinc-50/70 px-5 py-4 text-center">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
          Developer Identity
        </p>
        <h2 className="mt-2 text-lg font-semibold text-zinc-900">Developer Profile NFT</h2>
        <p className="mx-auto mt-1 max-w-xs text-sm text-zinc-600">
          On-chain profile stats linked to your devcred NFT.
        </p>
      </div>

      <div className="px-5 pb-5 pt-4">
        <div className="mb-5 flex justify-center">
          <div className="relative">
            <div className="flex h-20 w-20 items-center justify-center rounded-full border border-zinc-200 bg-zinc-100 text-zinc-700 shadow-inner">
              <FiUser className="h-10 w-10" aria-hidden="true" />
            </div>
            <span className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full border border-white bg-zinc-900 text-white shadow-sm">
              <FiCheckCircle className="h-4 w-4" aria-hidden="true" />
            </span>
          </div>
        </div>

        <div className="flex overflow-hidden rounded-lg border border-zinc-200 bg-zinc-50">
          <div className="flex flex-1 flex-col items-center justify-center p-3 text-center">
            <div className="flex items-center justify-center gap-2 text-zinc-500">
              <FiAward className="h-4 w-4" aria-hidden="true" />
              <p className="text-xs uppercase tracking-wide">Reputation</p>
            </div>
            <p className="mt-2 text-xl font-semibold leading-none text-zinc-900">{reputation}</p>
          </div>

          <div className="w-px bg-zinc-200" aria-hidden="true" />

          <div className="flex flex-1 flex-col items-center justify-center p-3 text-center">
            <div className="flex items-center justify-center gap-2 text-zinc-500">
              <FiCheckCircle className="h-4 w-4" aria-hidden="true" />
              <p className="text-xs uppercase tracking-wide">Jobs</p>
            </div>
            <p className="mt-2 text-xl font-semibold leading-none text-zinc-900">{completedJobs}</p>
          </div>
        </div>
      </div>
    </article>
  );
}
