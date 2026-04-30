"use client";

import { useEffect, useState } from "react";
import { FaUserCircle } from "react-icons/fa";
import ProfileCard from "../../components/ProfileCard";
import WalletButton from "../../components/WalletButton";
import { getProfileOnChain, mintProfileOnChain } from "../../lib/evm";

const initialDeveloperDetails = {
  name: "",
  githubProfileUrl: "",
  walletAddress: "",
};

export default function ProfilePage() {
  const [walletAddress, setWalletAddress] = useState("");
  const [profile, setProfile] = useState(null);
  const [message, setMessage] = useState("");
  const [isMinting, setIsMinting] = useState(false);
  const [developerDetails, setDeveloperDetails] = useState(initialDeveloperDetails);
  const [isSavingDetails, setIsSavingDetails] = useState(false);

  function hydrateDeveloperDetails(profileData, fallbackWallet = "") {
    const resolvedWallet =
      profileData?.walletAddress || fallbackWallet.toLowerCase() || "";

    return {
      name: profileData?.name || "",
      githubProfileUrl: profileData?.githubProfileUrl || "",
      walletAddress: resolvedWallet,
    };
  }

  async function syncProfileToDb(address, chainProfile, extraFields = {}) {
    if (!address || !chainProfile) return false;

    const payload = {
      tokenId: chainProfile.tokenId,
      reputation: chainProfile.reputation,
      completedJobs: chainProfile.completedJobs,
      lastUpdatedBlock: chainProfile.lastUpdatedBlock || 0,
    };

    if (Object.prototype.hasOwnProperty.call(extraFields, "name")) {
      payload.name = extraFields.name;
    }

    if (Object.prototype.hasOwnProperty.call(extraFields, "githubProfileUrl")) {
      payload.githubProfileUrl = extraFields.githubProfileUrl;
    }

    try {
      const response = await fetch(`/api/profiles/${address}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      return response.ok;
    } catch {
      return false;
    }
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
        setDeveloperDetails(hydrateDeveloperDetails(result.profile, walletAddress));
        return;
      }

      const chainProfile = await getProfileOnChain(walletAddress);
      setProfile(chainProfile || null);
      if (chainProfile) {
        setDeveloperDetails(
          hydrateDeveloperDetails(chainProfile, walletAddress),
        );
      }

      if (chainProfile) {
        const isSynced = await syncProfileToDb(walletAddress, chainProfile);
        if (!isSynced) {
          setMessage("Failed to sync profile from chain to DB.");
          return;
        }
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
        setDeveloperDetails(
          hydrateDeveloperDetails(existingOnChainProfile, address),
        );
        await syncProfileToDb(address, existingOnChainProfile);
        setMessage("Profile already exists on-chain. Loaded existing profile.");
        setTimeout(() => setMessage(""), 2000);
        return;
      }

      setMessage("Submitting mintProfile transaction on-chain 🔃");
      
      // Step 1: Execute blockchain transaction to mint profile NFT
      await mintProfileOnChain();

      // Step 2: Read freshly minted profile from chain and sync it to DB
      const mintedOnChainProfile = await getProfileOnChain(address);
      setProfile(mintedOnChainProfile || null);
      const baseDetails = hydrateDeveloperDetails(mintedOnChainProfile, address);
      setDeveloperDetails(baseDetails);
      const isSynced = await syncProfileToDb(address, mintedOnChainProfile, {
        ...baseDetails,
      });

      if (mintedOnChainProfile && isSynced) {
        setMessage("Profile successfully minted and synced with DB.");
        setTimeout(() => setMessage(""), 2000);
      } else if (mintedOnChainProfile) {
        setMessage("Profile minted on-chain, but failed to sync with DB.");
      } else {
        setMessage("Profile minted, but failed to load on-chain profile.");
      }
    } catch (error) {
      const rawMessage = String(error?.message || "");
      if (rawMessage.toLowerCase().includes("profile exists")) {
        const existingOnChainProfile = await getProfileOnChain(address);
        setProfile(existingOnChainProfile || null);
        const baseDetails = hydrateDeveloperDetails(existingOnChainProfile, address);
        setDeveloperDetails(baseDetails);
        await syncProfileToDb(address, existingOnChainProfile);
        setMessage("Profile already exists on-chain. Loaded existing profile.");
        setTimeout(() => setMessage(""), 2000);
        return;
      }

      // Display error message to user (from blockchain or API)
      setMessage(error.message || "Failed to mint profile.");
    } finally {
      // Always re-enable mint button, regardless of success/failure
      setIsMinting(false);
    }
  }

  function handleDeveloperDetailsChange(event) {
    const { name, value } = event.target;
    setDeveloperDetails((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSaveDeveloperDetails() {
    if (!walletAddress || !profile?.tokenId) {
      setMessage("Mint or load profile first before saving details.");
      return;
    }

    const trimmedName = developerDetails.name.trim();
    const trimmedGithubUrl = developerDetails.githubProfileUrl.trim();

    setIsSavingDetails(true);

    try {
      const response = await fetch(`/api/profiles/${walletAddress}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tokenId: profile.tokenId,
          reputation: profile.reputation,
          completedJobs: profile.completedJobs,
          lastUpdatedBlock: profile.lastUpdatedBlock || 0,
          name: trimmedName,
          githubProfileUrl: trimmedGithubUrl,
        }),
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        setMessage(result?.error || "Failed to save developer details.");
        return;
      }

      setProfile(result.profile);
      setDeveloperDetails(hydrateDeveloperDetails(result.profile, walletAddress));
      setMessage("Developer details saved successfully in DB ✅");
      setTimeout(() => setMessage(""), 2000);
    } catch {
      setMessage("Failed to save developer details.");
    } finally {
      setIsSavingDetails(false);
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

        <div className="rounded-xl border border-zinc-200 bg-white p-5 text-center shadow-sm">
          <button
            type="button"
            disabled={!walletAddress || isMinting || Boolean(profile?.tokenId)}
            onClick={() => handleMintProfile(walletAddress)}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
          >
            {isMinting ? "Minting..." : profile?.tokenId ? "Profile NFT Minted" : "Mint Your Devcred Profile"}
          </button>
          {!walletAddress ? (
            <p className="mt-2 text-sm text-zinc-600">Connect your wallet first to mint a profile.</p>
          ) : null}
        </div>

        {profileView ? (
          <div className="grid gap-6 lg:grid-cols-2">
            <ProfileCard profile={profileView} />

            <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold text-zinc-900">Developer Details</h2>
              <p className="mt-1 text-sm text-zinc-600">
                Store your personal information in MongoDB.
              </p>

              <div className="mt-4 space-y-4">
                <div>
                  <label
                    htmlFor="name"
                    className="mb-1 block text-sm font-medium text-zinc-700"
                  >
                    Name
                  </label>
                  <input
                    id="name"
                    name="name"
                    type="text"
                    value={developerDetails.name}
                    onChange={handleDeveloperDetailsChange}
                    placeholder="Jane Developer"
                    className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-900"
                  />
                </div>

                <div>
                  <label
                    htmlFor="githubProfileUrl"
                    className="mb-1 block text-sm font-medium text-zinc-700"
                  >
                    GitHub Profile URL
                  </label>
                  <input
                    id="githubProfileUrl"
                    name="githubProfileUrl"
                    type="url"
                    value={developerDetails.githubProfileUrl}
                    onChange={handleDeveloperDetailsChange}
                    placeholder="https://github.com/username"
                    className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-900"
                  />
                </div>

                <div>
                  <label
                    htmlFor="walletAddress"
                    className="mb-1 block text-sm font-medium text-zinc-700"
                  >
                    Wallet Address
                  </label>
                  <input
                    id="walletAddress"
                    name="walletAddress"
                    type="text"
                    value={developerDetails.walletAddress || walletAddress.toLowerCase()}
                    readOnly
                    className="w-full rounded-lg border border-zinc-300 bg-zinc-100 px-3 py-2 text-sm text-zinc-600 outline-none"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleSaveDeveloperDetails}
                  disabled={!profile?.tokenId || isSavingDetails}
                  className="w-full rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isSavingDetails ? "Saving..." : "Save Developer Details"}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {!profileView && walletAddress ? (
          <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-zinc-600">Click the Mint button above to create your profile and add your details.</p>
          </div>
        ) : null}

        {message ? <p className="text-sm text-zinc-700">{message}</p> : null}
      </div>
    </main>
  );
}