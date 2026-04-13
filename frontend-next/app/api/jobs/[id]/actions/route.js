import { NextResponse } from "next/server";
import { connectMongoose, Job, JobEvent } from "@/db";

function normalizeWalletAddress(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

export async function POST(request, { params }) {
  const id = Number(params?.id);

  if (!Number.isInteger(id) || id < 0) {
    return NextResponse.json({ error: "Invalid job id" }, { status: 400 });
  }

  const body = await request.json();
  const action = typeof body?.action === "string" ? body.action.trim().toLowerCase() : "";
  const actor = normalizeWalletAddress(body?.actor);
  const txHash = typeof body?.txHash === "string" ? body.txHash.trim() : "";

  if (action !== "cancel") {
    return NextResponse.json({ error: "Only cancel sync is supported here" }, { status: 400 });
  }

  await connectMongoose();

  const job = await Job.findOne({ jobId: id });
  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  job.status = "CANCELLED";
  if (txHash) {
    job.txHash = txHash;
  }
  await job.save();

  await JobEvent.create({
    jobId: id,
    eventType: "JobCancelled",
    triggeredBy: actor || job.client,
    txHash: txHash || "chain-cancel-without-event",
    blockNumber: 0,
    timestamp: new Date(),
  });

  return NextResponse.json({ job }, { status: 200 });
}
