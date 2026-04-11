"use client";

export default function WalletButton({ label = "Connect Wallet", onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-800"
    >
      {label}
    </button>
  );
}
