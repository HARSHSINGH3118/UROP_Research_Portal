// src/models/user.model.ts
import mongoose, { Schema, Document } from "mongoose";

export type CanonicalRole = "author" | "reviewer" | "coordinator"; // canonical names

export interface IUser extends Document {
  name: string;
  email: string;
  password: string;                  // hashed
  roles: CanonicalRole[];            // multi-role
  contactNumber?: string;            // optional for later reporting
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    roles: {
      type: [String],
      enum: ["author", "reviewer", "coordinator"],
      default: ["author"]
    },
    contactNumber: { type: String }
  },
  { timestamps: true }
);

userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ roles: 1, createdAt: -1 });

export const UserModel = mongoose.model<IUser>("User", userSchema);
