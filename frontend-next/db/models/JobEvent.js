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
  },
  {
    collection: "jobEvents",
  }
);

JobEventSchema.index({ jobId: 1, timestamp: -1 });

export default mongoose.models.JobEvent ||
  mongoose.model("JobEvent", JobEventSchema);
