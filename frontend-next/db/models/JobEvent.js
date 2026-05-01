import mongoose, { Schema } from "mongoose";

const JobEventSchema = new Schema(
  {
    jobId: {
      type: Number,
      required: true,
      min: 0,
      index: true,
    },
    eventType: {
      type: String,
      required: true,
      trim: true,
      index: true,
      enum: [
        "JobCreated",
        "JobAssigned",
        "JobSubmitted",
        "JobCompleted",
        "JobCancelled",
        "AutoReleased",
        "MilestoneSubmitted",
        "MilestoneApproved",
        "MilestoneRejected",
        "MilestoneAutoReleased",
        "AllMilestonesCompleted",
      ],
    },
    triggeredBy: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    txHash: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    blockNumber: {
      type: Number,
      required: true,
      min: 0,
      index: true,
    },
    recipient: {
      type: String,
      trim: true,
      lowercase: true,
      default: "",
    },
    timestamp: {
      type: Date,
      required: true,
      default: Date.now,
      index: true,
    },
    // Milestone-specific fields
    milestoneIndex: {
      type: Number,
      default: null,
      min: 0,
    },
    amountReleased: {
      type: String,
      trim: true,
      default: "",
    },
    deadline: {
      type: Date,
      default: null,
    },
    isMilestoneJob: {
      type: Boolean,
      default: false,
    },
  },
  {
    collection: "jobEvents",
  }
);

JobEventSchema.index({ jobId: 1, timestamp: -1 });
JobEventSchema.index({ eventType: 1, timestamp: -1 });
JobEventSchema.index({ milestoneIndex: 1 }, { sparse: true });

export default mongoose.models.JobEvent ||
  mongoose.model("JobEvent", JobEventSchema);
