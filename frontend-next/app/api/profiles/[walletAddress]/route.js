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

export async function GET(_request, context) {
  const resolvedParams = await Promise.resolve(context?.params);
  const walletAddress = normalizeWalletAddress(resolvedParams?.walletAddress);

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

export async function POST(request, context) {
  const resolvedParams = await Promise.resolve(context?.params);
  const walletAddress = normalizeWalletAddress(resolvedParams?.walletAddress);

  if (!walletAddress) {
    return NextResponse.json({ error: "walletAddress is required" }, { status: 400 });
  }

  const body = await request.json().catch(() => ({}));
  const tokenId = Number(body?.tokenId);
  const reputation = Number(body?.reputation ?? 0);
  const completedJobs = Number(body?.completedJobs ?? 0);
  const lastUpdatedBlock = Number(body?.lastUpdatedBlock ?? 0);

  if (!Number.isInteger(tokenId) || tokenId < 1) {
    return NextResponse.json({ error: "tokenId must be a positive integer" }, { status: 400 });
  }

  await connectMongoose();

  const profile = await Profile.findOneAndUpdate(
    { walletAddress },
    {
      $setOnInsert: { walletAddress },
      $set: {
        tokenId,
        reputation: Number.isFinite(reputation) ? reputation : 0,
        completedJobs: Number.isFinite(completedJobs) ? completedJobs : 0,
        lastUpdatedBlock: Number.isFinite(lastUpdatedBlock) ? lastUpdatedBlock : 0,
      },
    },
    { upsert: true, new: true }
  ).lean();

  return NextResponse.json({ profile }, { status: 200 });
}
