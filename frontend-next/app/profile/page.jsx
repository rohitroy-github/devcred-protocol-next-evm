import ProfileCard from "../../components/ProfileCard";
import WalletButton from "../../components/WalletButton";

const mockProfile = {
  wallet: "0xC4...2D",
  reputation: "1200",
  completedJobs: "7",
};

export default function ProfilePage() {
  return (
    <main className="min-h-screen bg-zinc-50 px-6 py-10">
      <div className="mx-auto max-w-2xl space-y-6">
        <header className="flex items-center justify-between rounded-xl bg-white p-6 shadow-sm">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900">Profile</h1>
            <p className="text-sm text-zinc-600">Mint and view DevCred profile NFT details.</p>
          </div>
          <WalletButton label="Mint Profile" />
        </header>

        <ProfileCard profile={mockProfile} />
      </div>
    </main>
  );
}
