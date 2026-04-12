import mongoose, { Schema } from "mongoose";

const ProfileSchema = new Schema(
  {
    walletAddress: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    tokenId: {
      type: Number,
      required: true,
      min: 0,
      index: true,
    },
    reputation: {
      type: Number,
      default: 0,
      min: 0,
    },
    completedJobs: {
      type: Number,
      default: 0,
      min: 0,
    },
    lastUpdatedBlock: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: { createdAt: false, updatedAt: true },
    collection: "profiles",
  }
);

ProfileSchema.index({ walletAddress: 1 }, { unique: true });
ProfileSchema.index({ tokenId: 1 }, { unique: true });

export default mongoose.models.Profile ||
  mongoose.model("Profile", ProfileSchema);