export const metadata = {
  title: "Job Details - Task, Status & Escrow",
  description:
    "View job details, assign developers, submit work, and approve completion. All actions tracked on-chain with transparent escrow management and reputation updates.",
  openGraph: {
    title: "DevCred Protocol - Job Details",
    description: "Track job lifecycle with blockchain-backed transparency",
    url: "https://devcred.protocol/jobs/[id]",
  },
};

export default function JobDetailsLayout({ children }) {
  return <>{children}</>;
}
