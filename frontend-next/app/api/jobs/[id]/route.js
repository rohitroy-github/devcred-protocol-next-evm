import { NextResponse } from "next/server";
import { connectMongoose, Job, JobEvent } from "@/db";

export async function GET(_request, { params }) {
  const id = Number(params?.id);

  if (!Number.isInteger(id) || id < 0) {
    return NextResponse.json({ error: "Invalid job id" }, { status: 400 });
  }

  await connectMongoose();

  const [job, events] = await Promise.all([
    Job.findOne({ jobId: id }).lean(),
    JobEvent.find({ jobId: id }).sort({ timestamp: -1 }).lean(),
  ]);

  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  return NextResponse.json({ job, events }, { status: 200 });
}
