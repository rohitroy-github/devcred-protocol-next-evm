import { NextResponse } from "next/server";
import { connectMongoose, User } from "@/db";

function normalizeWalletAddress(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const walletAddress = normalizeWalletAddress(searchParams.get("walletAddress"));

  if (!walletAddress) {
    return NextResponse.json({ error: "walletAddress query param is required" }, { status: 400 });
  }

  await connectMongoose();
  const user = await User.findOne({ walletAddress }).lean();

  if (!user) {
    return NextResponse.json({ user: null }, { status: 200 });
  }

  return NextResponse.json({ user }, { status: 200 });
}

export async function POST(request) {
  const body = await request.json();
  const walletAddress = normalizeWalletAddress(body?.walletAddress);

  if (!walletAddress) {
    return NextResponse.json({ error: "walletAddress is required" }, { status: 400 });
  }

  await connectMongoose();

  const user = await User.findOneAndUpdate(
    { walletAddress },
    {
      $setOnInsert: {
        walletAddress,
      },
    },
    { upsert: true, new: true }
  ).lean();

  return NextResponse.json({ user }, { status: 200 });
}
