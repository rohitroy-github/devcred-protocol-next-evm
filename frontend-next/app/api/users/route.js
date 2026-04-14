/**
 * GET  /api/users
 * POST /api/users
 *
 * Lightweight user identity endpoint for wallet-based accounts in MongoDB.
 *
 * --- GET ---
 * Fetches a user by wallet address (provided as a query param).
 *
 * Workflow:
 *   1. Client sends `walletAddress` in the query string.
 *   2. Address is normalised (trim + lowercase) for consistent lookups.
 *   3. Endpoint returns `user` if found, otherwise returns `user: null` with 200.
 *
 * Requirements:
 *   - `walletAddress` (query param) : Required non-empty wallet address.
 *
 * --- POST ---
 * Idempotently ensures a user record exists for a wallet address.
 *
 * Workflow:
 *   1. Client sends `walletAddress` in the request body.
 *   2. Endpoint normalises the address and performs an upsert.
 *   3. If user exists, it is returned unchanged; if not, it is created.
 *
 * Requirements:
 *   - `walletAddress` (body string) : Required non-empty wallet address.
 *
 * Response:
 *   - `user` : Existing or newly created User document.
 */
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
