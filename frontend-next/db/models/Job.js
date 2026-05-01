import mongoose, { Schema } from "mongoose";

const MilestoneSchema = new Schema(
  {
    index: {
      type: Number,
      required: true,
      min: 0,
    },
    amount: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ["Pending", "Submitted", "Approved", "Rejected"],
      default: "Pending",
    },
    submittedAt: {
      type: Date,
      default: null,
    },
  },
  { _id: false }
);

const JobSchema = new Schema(
  {
    jobId: {
      type: Number,
      required: true,
      min: 0,
    },
    client: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    developer: {
      type: String,
      lowercase: true,
      trim: true,
      default: "",
      index: true,
    },
    amount: {
      type: String,
      required: true,
      trim: true,
    },
    token: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      default: "ETH",
    },
    status: {
      type: String,
      enum: [
        "OPEN",
        "IN_PROGRESS",
        "SUBMITTED",
        "COMPLETED",
        "CANCELLED",
        "DISPUTED",
        "AUTO_RELEASED",
      ],
      default: "OPEN",
    },
    metadataURI: {
      type: String,
      trim: true,
      default: "",
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    tags: {
      type: [String],
      default: [],
    },
    txHash: {
      type: String,
      trim: true,
      default: "",
    },
    // Milestone-based job fields
    isMilestoneJob: {
      type: Boolean,
      default: false,
      index: true,
    },
    milestones: {
      type: [MilestoneSchema],
      default: [],
    },
    currentMilestoneIndex: {
      type: Number,
      default: 0,
      min: 0,
    },
    submittedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    collection: "jobs",
  }
);

JobSchema.index({ jobId: 1 }, { unique: true });
JobSchema.index({ client: 1, isMilestoneJob: 1 });

const existingJobModel = mongoose.models.Job;
if (existingJobModel && !existingJobModel.schema.path("isMilestoneJob")) {
  delete mongoose.models.Job;
}

const JobModel = mongoose.models.Job || mongoose.model("Job", JobSchema);

export default JobModel;
