/**
 * POST /api/jobs/[id]/actions
 *
 * Off-chain sync endpoint for job state transitions triggered on-chain.
 *
 * Workflow:
 *   1. A user initiates a job action (currently only "cancel") on the smart contract.
 *   2. After the on-chain transaction is confirmed, the client calls this endpoint
 *      to mirror that state change in the MongoDB database.
 *   3. The endpoint validates the job ID and action, updates the Job document's
 *      status to "CANCELLED", and records a JobEvent for audit/history purposes.
 *
 * Requirements:
 *   - `id`     (URL param)   : Numeric job ID matching the on-chain jobId.
 *   - `action` (body string) : Must be "cancel". Other actions are not yet supported.
 *   - `actor`  (body string) : Wallet address of the user who triggered the action.
 *                              Falls back to job.client if omitted.
 *   - `txHash` (body string) : Transaction hash of the on-chain event (optional but recommended).
 *                              Stored against the job and the event for traceability.
 *
 * This route is intentionally kept append-only for events — it never deletes
 * existing JobEvent records, preserving a full audit trail.
 */
import { NextResponse } from "next/server";
import { connectMongoose, Job, JobEvent, Profile } from "@/db";

function normalizeWalletAddress(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

const actionConfig = {
  assign: { status: "IN_PROGRESS", eventType: "JobAssigned" },
  submit: { status: "SUBMITTED", eventType: "JobSubmitted" },
  approve: { status: "COMPLETED", eventType: "JobCompleted" },
  cancel: { status: "CANCELLED", eventType: "JobCancelled" },
  autorelease: { status: "AUTO_RELEASED", eventType: "AutoReleased" },
  submitmilestone: { status: "IN_PROGRESS", eventType: "MilestoneSubmitted" },
  approvemilestone: { status: "IN_PROGRESS", eventType: "MilestoneApproved" },
  rejectmilestone: { status: "IN_PROGRESS", eventType: "MilestoneRejected" },
  autoreleasemilestone: { status: "IN_PROGRESS", eventType: "MilestoneAutoReleased" },
};

export async function POST(request, context) {
  try {
    const resolvedParams = await Promise.resolve(context?.params);
    const id = Number(resolvedParams?.id);

    if (!Number.isInteger(id) || id < 0) {
      return NextResponse.json({ error: "Invalid job id" }, { status: 400 });
    }

    const body = await request.json();
    const action = typeof body?.action === "string" ? body.action.trim().toLowerCase() : "";
    const actor = normalizeWalletAddress(body?.actor);
    const txHash = typeof body?.txHash === "string" ? body.txHash.trim() : "";
    const developer = normalizeWalletAddress(body?.developer);

    const config = actionConfig[action];
    if (!config) {
      return NextResponse.json(
        { error: "Unsupported action. Use assign, submit, approve, cancel, autoRelease, submitMilestone, approveMilestone, rejectMilestone, or autoReleaseMilestone." },
        { status: 400 }
      );
    }

    await connectMongoose();

    const job = await Job.findOne({ jobId: id });
    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    const isMilestoneAction = [
      "submitmilestone",
      "approvemilestone",
      "rejectmilestone",
      "autoreleasemilestone",
    ].includes(action);

    if (isMilestoneAction && !job.isMilestoneJob) {
      return NextResponse.json(
        { error: "Milestone actions are only supported for milestone jobs." },
        { status: 400 }
      );
    }

    job.status = config.status;

    if (action === "assign" && developer) {
      job.developer = developer;
    }

    if (txHash) {
      job.txHash = txHash;
    }

    let milestoneIndex = null;

    if (isMilestoneAction) {
      milestoneIndex = Number(job.currentMilestoneIndex || 0);
      if (!Array.isArray(job.milestones) || milestoneIndex >= job.milestones.length) {
        return NextResponse.json({ error: "Invalid milestone index." }, { status: 400 });
      }

      const milestone = job.milestones[milestoneIndex];
      const now = new Date();

      if (action === "submitmilestone") {
        milestone.status = "Submitted";
        milestone.submittedAt = now;
      }

      if (action === "rejectmilestone") {
        milestone.status = "Pending";
        milestone.submittedAt = null;
        milestone.deadline = null;
      }

      if (action === "approvemilestone" || action === "autoreleasemilestone") {
        milestone.status = "Approved";

        const isLastMilestone = milestoneIndex + 1 >= job.milestones.length;
        if (isLastMilestone) {
          job.status = "COMPLETED";
        } else {
          job.currentMilestoneIndex = milestoneIndex + 1;
          job.status = "IN_PROGRESS";
        }
      }
    }

    await job.save();

    if ((action === "approve" || action === "autorelease") && job.developer) {
      const reputationIncrement = Number.parseFloat(job.amount ?? 0);

      await Profile.findOneAndUpdate(
        { walletAddress: normalizeWalletAddress(job.developer) },
        {
          $inc: {
            reputation: Number.isFinite(reputationIncrement)
              ? reputationIncrement
              : 0,
            completedJobs: 1,
          },
        },
        { new: true }
      );
    }

    await JobEvent.create({
      jobId: id,
      eventType: config.eventType,
      triggeredBy: actor || job.client,
      recipient: action === "assign" ? developer : "",
      txHash: txHash || `manual-${action}-${Date.now()}`,
      blockNumber: 0,
      timestamp: new Date(),
      milestoneIndex,
      amountReleased:
        action === "approvemilestone" || action === "autoreleasemilestone"
          ? String(job.milestones?.[milestoneIndex]?.amount || "")
          : "",
      isMilestoneJob: Boolean(job.isMilestoneJob),
    });

    return NextResponse.json({ job }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: error?.message || "Failed to sync job action." },
      { status: 500 }
    );
  }
}
