import { NextResponse } from "next/server";
import { connectMongoose, Job, JobEvent } from "@/db";

const statusMap = {
  open: "OPEN",
  inprogress: "IN_PROGRESS",
  submitted: "SUBMITTED",
  completed: "COMPLETED",
  cancelled: "CANCELLED",
  disputed: "DISPUTED",
};

function toStatus(value) {
  if (typeof value !== "string") return "OPEN";
  const normalized = value.replace(/[^a-z]/gi, "").toLowerCase();
  return statusMap[normalized] || "OPEN";
}

function normalizeWalletAddress(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");

  await connectMongoose();

  const query = {};
  if (status) {
    query.status = toStatus(status);
  }

  const jobs = await Job.find(query).sort({ createdAt: -1 }).lean();
  return NextResponse.json({ jobs }, { status: 200 });
}

export async function POST(request) {
  const body = await request.json();

  const jobId = Number(body?.jobId);
  const client = normalizeWalletAddress(body?.client);
  const amount = typeof body?.amount === "string" ? body.amount.trim() : "";
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  const description = typeof body?.description === "string" ? body.description.trim() : "";
  const metadataURI = typeof body?.metadataURI === "string" ? body.metadataURI.trim() : "";
  const developer = normalizeWalletAddress(body?.developer);
  const txHash = typeof body?.txHash === "string" ? body.txHash.trim() : "";

  if (!Number.isInteger(jobId) || jobId < 1 || !client || !amount || !title || !description) {
    return NextResponse.json(
      { error: "jobId, client, amount, title, and description are required" },
      { status: 400 }
    );
  }

  await connectMongoose();

  const job = await Job.findOneAndUpdate(
    { jobId },
    {
      $setOnInsert: {
        jobId,
        client,
        amount,
        token: "ETH",
        status: developer ? "IN_PROGRESS" : "OPEN",
      },
      $set: {
        client,
        developer,
        amount,
        metadataURI,
        title,
        description,
        tags: Array.isArray(body?.tags) ? body.tags : [],
        txHash,
      },
    },
    { upsert: true, new: true }
  ).lean();

  if (txHash) {
    await JobEvent.findOneAndUpdate(
      { txHash, eventType: "JobCreated" },
      {
        $setOnInsert: {
          jobId,
          eventType: "JobCreated",
          triggeredBy: client,
          txHash,
          blockNumber: 0,
          timestamp: new Date(),
        },
      },
      { upsert: true, new: true }
    );
  }

  return NextResponse.json({ job }, { status: 201 });
}
