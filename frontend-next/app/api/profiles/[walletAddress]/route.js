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
