import mongoose, { Schema } from "mongoose";

const ProfileSchema = new Schema(
  {
    walletAddress: {
      type: String,
      required: true,
      default: null,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    name: {
      type: String,
      default: "",
      trim: true,
    },
    bio: {
      type: String,
      default: "",
      trim: true,
      maxlength: 120,
    },
    githubProfileUrl: {
      type: String,
      default: "",
      trim: true,
    },
    tokenId: {
      type: Number,
      required: true,
      min: 0,
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

ProfileSchema.index({ tokenId: 1 }, { unique: true });

if (mongoose.models.Profile && !mongoose.models.Profile.schema.path("bio")) {
  mongoose.models.Profile.schema.add({
    bio: {
      type: String,
      default: "",
      trim: true,
      maxlength: 120,
    },
  });
}

export default mongoose.models.Profile ||
  mongoose.model("Profile", ProfileSchema);