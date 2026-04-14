/**
 * GET  /api/jobs
 * POST /api/jobs
 *
 * Collection-level endpoint for querying and creating jobs in the off-chain
 * MongoDB database, kept in sync with the on-chain contract state.
 *
 * --- GET ---
 * Returns a list of all jobs, optionally filtered by status.
 * Jobs are sorted newest-first (createdAt descending).
 *
 * Query params:
 *   - `status` (optional) : Case-insensitive status filter. Accepted values:
 *                           open | inprogress | submitted | completed | cancelled | disputed.
 *                           Unmapped values fall back to "OPEN".
 *
 * --- POST ---
 * Creates or updates a job document (upsert by jobId). Called after a JobCreated
 * event is emitted on-chain so the off-chain database reflects the latest state.
 *
 * Workflow:
 *   1. A client posts a job to the smart contract. Once confirmed, the front-end
 *      calls this endpoint with the on-chain jobId and transaction details.
 *   2. The endpoint upserts the Job document — inserting on first call, updating
 *      mutable fields (title, description, developer, etc.) on subsequent calls.
 *   3. If a txHash is supplied and no JobCreated event exists for it yet, a
 *      JobEvent record is created (idempotent via upsert) to start the audit trail.
 *
 * Required body fields:
 *   - `jobId`       : Positive integer matching the on-chain job ID.
 *   - `client`      : Wallet address of the job poster.
 *   - `amount`      : Payment amount as a string (e.g. "0.5").
 *   - `title`       : Short human-readable job title.
 *   - `description` : Full job description.
 *
 * Optional body fields:
 *   - `developer`   : Wallet address of the assigned developer. If present,
 *                     the initial status is set to "IN_PROGRESS" instead of "OPEN".
 *   - `metadataURI` : IPFS or other URI pointing to extended job metadata.
 *   - `tags`        : Array of tag strings for categorisation.
 *   - `txHash`      : Transaction hash of the JobCreated event for traceability.
 */
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
