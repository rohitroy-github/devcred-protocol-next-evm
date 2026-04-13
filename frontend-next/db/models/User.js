import mongoose, { Schema } from "mongoose";

const UserSchema = new Schema(
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
    profileTokenId: {
      type: Number,
      default: null,
      min: 0,
    },
    username: {
      type: String,
      trim: true,
      default: "",
    },
    avatarUrl: {
      type: String,
      trim: true,
      default: "",
    },
    bio: {
      type: String,
      trim: true,
      default: "",
    },
    githubUsername: {
      type: String,
      trim: true,
      default: "",
    },
    githubVerified: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    collection: "users",
  }
);

export default mongoose.models.User || mongoose.model("User", UserSchema);
