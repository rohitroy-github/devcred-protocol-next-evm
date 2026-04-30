import mongoose, { Schema } from "mongoose";

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
  },
  {
    timestamps: true,
    collection: "jobs",
  }
);

JobSchema.index({ jobId: 1 }, { unique: true });

export default mongoose.models.Job || mongoose.model("Job", JobSchema);
