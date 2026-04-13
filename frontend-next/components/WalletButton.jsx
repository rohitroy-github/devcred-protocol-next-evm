"use client";

import { useEffect, useMemo, useState } from "react";

function shortenAddress(address) {
  if (!address) return "";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export default function WalletButton({ label = "Connect Wallet", onConnected }) {
  const [address, setAddress] = useState("");

  useEffect(() => {
    async function bootstrapWallet() {
      if (typeof window === "undefined" || !window.ethereum) return;
      const accounts = await window.ethereum.request({ method: "eth_accounts" });
      const activeAddress = accounts?.[0] || "";
      setAddress(activeAddress);
      if (activeAddress && onConnected) {
        onConnected(activeAddress);
      }
    }

    bootstrapWallet().catch(() => {});
  }, [onConnected]);

  const buttonLabel = useMemo(() => {
    return address ? shortenAddress(address) : label;
  }, [address, label]);

  async function handleConnect() {
    if (typeof window === "undefined" || !window.ethereum) {
      alert("MetaMask not detected. Install MetaMask to continue.");
      return;
    }

    const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
    const activeAddress = accounts?.[0] || "";
    setAddress(activeAddress);
    if (activeAddress && onConnected) {
      onConnected(activeAddress);
    }
  }

  return (
    <button
      type="button"
      onClick={handleConnect}
      className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-800"
    >
      {buttonLabel}
    </button>
  );
}
