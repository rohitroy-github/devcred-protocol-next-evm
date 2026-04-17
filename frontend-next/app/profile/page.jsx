"use client";

import { useEffect, useState } from "react";
import ProfileCard from "../../components/ProfileCard";
import WalletButton from "../../components/WalletButton";
import { getProfileOnChain, mintProfileOnChain } from "../../lib/evm";

export default function ProfilePage() {
  const [walletAddress, setWalletAddress] = useState("");
  const [profile, setProfile] = useState(null);
  const [message, setMessage] = useState("");
  const [isMinting, setIsMinting] = useState(false);

  async function syncProfileToDb(address, chainProfile) {
    if (!address || !chainProfile) return;

    await fetch(`/api/profiles/${address}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tokenId: chainProfile.tokenId,
        reputation: chainProfile.reputation,
        completedJobs: chainProfile.completedJobs,
        lastUpdatedBlock: chainProfile.lastUpdatedBlock || 0,
      }),
    });
  }

  useEffect(() => {
    async function loadProfile() {
      if (!walletAddress) return;

      setMessage("");

      await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletAddress }),
      });

      const response = await fetch(`/api/profiles/${walletAddress}`, { cache: "no-store" });
      const result = await response.json().catch(() => ({}));

      if (response.ok && result?.profile) {
        setProfile(result.profile);
        return;
      }

      const chainProfile = await getProfileOnChain(walletAddress);
      setProfile(chainProfile || null);

      if (chainProfile) {
        await syncProfileToDb(walletAddress, chainProfile);
        setMessage("Profile loaded from on-chain data. DB listener is not synced yet.");
      }
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

      const existingOnChainProfile = await getProfileOnChain(address);
      if (existingOnChainProfile) {
        setProfile(existingOnChainProfile);
        await syncProfileToDb(address, existingOnChainProfile);
        setMessage("Profile already exists on-chain. Loaded existing profile.");
        return;
      }

      setMessage("Submitting mintProfile transaction...");
      
      // Step 1: Execute blockchain transaction to mint profile NFT
      await mintProfileOnChain();

      // Step 2: Read freshly minted profile from chain and sync it to DB
      const mintedOnChainProfile = await getProfileOnChain(address);
      setProfile(mintedOnChainProfile || null);
      await syncProfileToDb(address, mintedOnChainProfile);
      
      // Success: Notify user that transaction is confirmed
      // Event listener will sync any additional state changes
      setMessage("Profile transaction confirmed. If listener is running, DB will reflect it.");
    } catch (error) {
      const rawMessage = String(error?.message || "");
      if (rawMessage.toLowerCase().includes("profile exists")) {
        const existingOnChainProfile = await getProfileOnChain(address);
        setProfile(existingOnChainProfile || null);
        await syncProfileToDb(address, existingOnChainProfile);
        setMessage("Profile already exists on-chain. Loaded existing profile.");
        return;
      }

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
          <WalletButton label="Connect Wallet" onConnected={setWalletAddress} />
        </header>

        <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
          <button
            type="button"
            disabled={!walletAddress || isMinting || Boolean(profile?.tokenId)}
            onClick={() => handleMintProfile(walletAddress)}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isMinting ? "Minting..." : profile?.tokenId ? "Profile Minted" : "Mint Profile"}
          </button>
          {!walletAddress ? (
            <p className="mt-2 text-sm text-zinc-600">Connect your wallet first to mint a profile.</p>
          ) : null}
        </div>

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
