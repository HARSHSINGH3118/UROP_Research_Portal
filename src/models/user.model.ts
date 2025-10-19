// src/models/user.model.ts
import mongoose, { Schema, Document } from "mongoose";

export type UserRole = "reviewer" | "publisher" | "admin";

export interface IUser extends Document {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    // User's full name
    name: { type: String, required: true, trim: true },

    // Unique email (login credential)
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    // Hashed password
    password: { type: String, required: true },

    // Role determines permissions
    role: {
      type: String,
      enum: ["reviewer", "publisher", "admin"],
      default: "reviewer",
      required: true,
    },
  },
  {
    timestamps: true, 
  }
);

 
userSchema.index({ email: 1 });
userSchema.index({ role: 1, createdAt: -1 });


export const UserModel = mongoose.model<IUser>("User", userSchema);
