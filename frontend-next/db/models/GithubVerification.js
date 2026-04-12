import mongoose, { Schema } from "mongoose";

const GithubVerificationSchema = new Schema(
  {
    walletAddress: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    githubUsername: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    proofType: {
      type: String,
      required: true,
      enum: ["PR_MERGED", "ISSUE_CLOSED", "COMMIT", "RELEASE"],
    },
    repo: {
      type: String,
      required: true,
      trim: true,
    },
    prNumber: {
      type: Number,
      default: null,
      min: 0,
    },
    verified: {
      type: Boolean,
      default: false,
    },
    verificationTxHash: {
      type: String,
      trim: true,
      default: "",
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    collection: "githubVerifications",
  }
);

GithubVerificationSchema.index({ walletAddress: 1, githubUsername: 1 });

export default mongoose.models.GithubVerification ||
  mongoose.model("GithubVerification", GithubVerificationSchema);