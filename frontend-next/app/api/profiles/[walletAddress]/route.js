/**
 * GET /api/profiles/[walletAddress]
 *
 * Fetches the off-chain profile for a single user identified by their wallet address.
 *
 * Workflow:
 *   1. The client supplies a wallet address as a URL parameter.
 *   2. The address is normalised (trimmed, lowercased) before querying MongoDB,
 *      ensuring consistent lookups regardless of how the address was stored.
 *   3. If no profile exists for the address, a 200 is still returned with
 *      `profile: null` — allowing the front-end to distinguish "not found" from
 *      an error without special-casing status codes.
 *
 * Requirements:
 *   - `walletAddress` (URL param) : Ethereum wallet address of the user.
 *                                   Must be a non-empty string.
 *
 * Response:
 *   - `profile` : The Profile document if found, or `null` if no profile exists yet.
 */
import { NextResponse } from "next/server";
import { connectMongoose, Profile } from "@/db";

function normalizeWalletAddress(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

export async function GET(_request, { params }) {
  const walletAddress = normalizeWalletAddress(params?.walletAddress);

  if (!walletAddress) {
    return NextResponse.json({ error: "walletAddress is required" }, { status: 400 });
  }

  await connectMongoose();
  const profile = await Profile.findOne({ walletAddress }).lean();

  if (!profile) {
    return NextResponse.json({ profile: null }, { status: 200 });
  }

  return NextResponse.json({ profile }, { status: 200 });
}
