"use client";

import { useEffect, useState } from "react";
import ProfileCard from "../../components/ProfileCard";
import WalletButton from "../../components/WalletButton";
import { mintProfileOnChain } from "../../lib/evm";

export default function ProfilePage() {
  const [walletAddress, setWalletAddress] = useState("");
  const [profile, setProfile] = useState(null);
  const [message, setMessage] = useState("");
  const [isMinting, setIsMinting] = useState(false);

  useEffect(() => {
    async function loadProfile() {
      if (!walletAddress) return;

      await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletAddress }),
      });

      const response = await fetch(`/api/profiles/${walletAddress}`, { cache: "no-store" });
      const result = await response.json();
      setProfile(result.profile || null);
    }

    loadProfile().catch(() => {
      setMessage("Failed to load profile.");
    });
  }, [walletAddress]);

  /**
   * Handles minting a DevCred profile NFT on-chain and syncing with database:
   * 1. Executes mintProfile transaction on blockchain
   * 2. Fetches updated profile data from API
   * 3. Updates local state with minted profile details
   * 
   * Ensures profile state is in sync between blockchain and MongoDB
   * after successful on-chain mint transaction.
   */
  async function handleMintProfile(address) {
    // Validate address before proceeding
    if (!address) return;

    try {
      setIsMinting(true);
      setMessage("Submitting mintProfile transaction...");
      
      // Step 1: Execute blockchain transaction to mint profile NFT
      await mintProfileOnChain();
      
      // Step 2: Fetch updated profile data from backend API
      // This pulls the minted profile details from database
      const response = await fetch(`/api/profiles/${address}`, { cache: "no-store" });
      const result = await response.json();
      
      // Step 3: Update local state with minted profile
      setProfile(result.profile || null);
      
      // Success: Notify user that transaction is confirmed
      // Event listener will sync any additional state changes
      setMessage("Profile transaction confirmed. If listener is running, DB will reflect it.");
    } catch (error) {
      // Display error message to user (from blockchain or API)
      setMessage(error.message || "Failed to mint profile.");
    } finally {
      // Always re-enable mint button, regardless of success/failure
      setIsMinting(false);
    }
  }

  const profileView = profile
    ? {
        wallet: profile.walletAddress,
        reputation: String(profile.reputation ?? 0),
        completedJobs: String(profile.completedJobs ?? 0),
      }
    : null;

  return (
    <main className="min-h-screen bg-zinc-50 px-6 py-10">
      <div className="mx-auto max-w-2xl space-y-6">
        <header className="flex items-center justify-between rounded-xl bg-white p-6 shadow-sm">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900">Profile</h1>
            <p className="text-sm text-zinc-600">Mint and view DevCred profile NFT details.</p>
          </div>
          <WalletButton
            label={isMinting ? "Minting..." : "Mint Profile"}
            onConnected={(address) => {
              setWalletAddress(address);
              handleMintProfile(address);
            }}
          />
        </header>

        {profileView ? (
          <ProfileCard profile={profileView} />
        ) : (
          <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-zinc-600">Connect wallet to load or create profile.</p>
          </div>
        )}

        {message ? <p className="text-sm text-zinc-700">{message}</p> : null}
      </div>
    </main>
  );
}
