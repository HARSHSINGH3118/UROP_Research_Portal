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
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    password: { type: String, required: true },
    role: { type: String, enum: ["reviewer", "publisher", "admin"], default: "reviewer" }
  },
  { timestamps: true }
);

export const UserModel = mongoose.model<IUser>("User", userSchema);
