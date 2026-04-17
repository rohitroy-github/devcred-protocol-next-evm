/**
 * GET /api/jobs/[id]
 *
 * Fetches the details of a single job and its full event history from the
 * off-chain MongoDB database.
 *
 * Workflow:
 *   1. The client provides a numeric job ID in the URL (matching the on-chain jobId).
 *   2. The endpoint concurrently queries the Job document and all associated
 *      JobEvent records, returning both in a single response.
 *   3. Events are sorted newest-first to make it easy to display the latest
 *      activity at the top of a job detail view.
 *
 * Requirements:
 *   - `id` (URL param) : Numeric job ID. Must be a non-negative integer.
 *
 * Response:
 *   - `job`    : The Job document (lean, read-only object).
 *   - `events` : Array of JobEvent records for this job, ordered by timestamp descending.
 */
import { NextResponse } from "next/server";
import { connectMongoose, Job, JobEvent } from "@/db";

export async function GET(_request, context) {
  const resolvedParams = await Promise.resolve(context?.params);
  const id = Number(resolvedParams?.id);

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
