"use client";

import { useEffect, useMemo, useState } from "react";

const LOCAL_CHAIN_ID = "0x7a69";

function isPreferredMetaMaskProvider(provider) {
  return Boolean(
    provider?.isMetaMask &&
      !provider?.isBraveWallet &&
      !provider?.isRabby &&
      !provider?.isFrame &&
      !provider?.isOkxWallet &&
      !provider?.isOKExWallet &&
      !provider?.isBitKeep &&
      !provider?.isBitgetWallet &&
      !provider?.isCoinbaseWallet
  );
}

function getInjectedProvider() {
  if (typeof window === "undefined") return null;
  const injected = window.ethereum;
  if (!injected) return null;

  if (Array.isArray(injected.providers) && injected.providers.length > 0) {
    return injected.providers.find(isPreferredMetaMaskProvider) || injected.providers[0];
  }

  return injected;
}

async function ensureLocalHardhatNetwork(provider) {
  const chainId = await provider.request({ method: "eth_chainId" });
  if (chainId === LOCAL_CHAIN_ID) {
    return;
  }

  try {
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: LOCAL_CHAIN_ID }],
    });
  } catch (switchError) {
    if (switchError?.code === 4902) {
      await provider.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: LOCAL_CHAIN_ID,
            chainName: "Hardhat Localhost",
            nativeCurrency: {
              name: "Ether",
              symbol: "ETH",
              decimals: 18,
            },
            rpcUrls: ["http://127.0.0.1:8545"],
          },
        ],
      });
      return;
    }

    throw new Error("Switch MetaMask to Hardhat Localhost (chain id 31337).");
  }
}

function shortenAddress(address) {
  if (!address) return "";
  return `${address.slice(0, 5)}...${address.slice(-5)}`;
}

export default function WalletButton({ label = "Connect Wallet", onConnected }) {
  const [address, setAddress] = useState("");

  useEffect(() => {
    async function bootstrapWallet() {
      const provider = getInjectedProvider();
      if (!provider) return;
      if (!isPreferredMetaMaskProvider(provider)) return;
      const accounts = await provider.request({ method: "eth_accounts" });
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
    const provider = getInjectedProvider();

    if (!provider) {
      alert("MetaMask not detected. Install MetaMask to continue.");
      return;
    }

    try {
      if (!isPreferredMetaMaskProvider(provider)) {
        throw new Error("MetaMask is not the active wallet provider. Disable other wallet extensions or make MetaMask the active provider.");
      }

      await ensureLocalHardhatNetwork(provider);
      const accounts = await provider.request({ method: "eth_requestAccounts" });
      const activeAddress = accounts?.[0] || "";
      setAddress(activeAddress);
      if (activeAddress && onConnected) {
        onConnected(activeAddress);
      }
    } catch (error) {
      const message = error?.message || "Wallet connection failed.";
      alert(message);
    }
  }

  return (
    <button
      type="button"
      onClick={handleConnect}
      className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-800 cursor-pointer"
    >
      {buttonLabel}
    </button>
  );
}
