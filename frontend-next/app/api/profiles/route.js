/**
 * POST /api/profiles
 *
 * Creates a new off-chain profile for a wallet address, mirroring the on-chain
 * profile NFT minting flow.
 *
 * Workflow:
 *   1. After a user mints a DevCred profile NFT on-chain, the front-end calls
 *      this endpoint to register the wallet in MongoDB.
 *   2. If a profile for the given wallet already exists, the endpoint returns
 *      it immediately with `created: false` — making the call fully idempotent
 *      and safe to retry without creating duplicates.
 *   3. For new profiles, a `tokenId` is assigned by counting existing profiles
 *      and incrementing by 1, keeping the off-chain ID in sync with the
 *      sequential on-chain minting order.
 *   4. A User document is upserted in parallel so that the user record always
 *      reflects the latest `profileTokenId`.
 *
 * Requirements:
 *   - `walletAddress` (body string) : Ethereum wallet address of the user.
 *                                     Must be a non-empty string.
 *
 * Response:
 *   - `profile` : The newly created (or pre-existing) Profile document.
 *   - `created` : Boolean — `true` if a new profile was just created,
 *                 `false` if one already existed for this wallet.
 */
import { NextResponse } from "next/server";
import { connectMongoose, Profile, User } from "@/db";

function normalizeWalletAddress(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

export async function POST(request) {
  const body = await request.json();
  const walletAddress = normalizeWalletAddress(body?.walletAddress);

  if (!walletAddress) {
    return NextResponse.json({ error: "walletAddress is required" }, { status: 400 });
  }

  await connectMongoose();

  const existing = await Profile.findOne({ walletAddress }).lean();
  if (existing) {
    return NextResponse.json({ profile: existing, created: false }, { status: 200 });
  }

  const profileCount = await Profile.countDocuments();
  const tokenId = profileCount + 1;

  const profile = await Profile.create({
    walletAddress,
    tokenId,
    reputation: 0,
    completedJobs: 0,
    lastUpdatedBlock: 0,
  });

  await User.findOneAndUpdate(
    { walletAddress },
    {
      $setOnInsert: { walletAddress },
      $set: { profileTokenId: tokenId },
    },
    { upsert: true, new: true }
  );

  return NextResponse.json({ profile, created: true }, { status: 201 });
}
