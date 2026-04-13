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
