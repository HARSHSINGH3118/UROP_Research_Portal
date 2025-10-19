// src/models/paper.model.ts
import mongoose, { Schema, Document } from "mongoose";

export type PaperStatus = "submitted" | "processing" | "reviewed";
export type AdminStatus = "pending" | "approved" | "rejected";

export interface IPaper extends Document {
  title: string;                           // Paper title
  track: string;                           // Track name, e.g. "AI/ML"
  fileUrl: string;                         // Local path for now (S3 later)
  publisher: mongoose.Types.ObjectId;      // Reference to User (publisher)
  insights?: string[];                     // AI-generated insights
  status?: PaperStatus;                    // AI processing lifecycle
  adminStatus?: AdminStatus;               // Admin approval state
  createdAt: Date;
  updatedAt: Date;
}

const paperSchema = new Schema<IPaper>(
  {
    // --- Paper details ---
    title: { type: String, required: true, trim: true },
    track: { type: String, required: true, trim: true },

    // --- File reference ---
    fileUrl: { type: String, required: true },

    // --- Relations ---
    publisher: { type: Schema.Types.ObjectId, ref: "User", required: true },

    // --- AI insight fields ---
    insights: [{ type: String }],
    status: {
      type: String,
      enum: ["submitted", "processing", "reviewed"],
      default: "submitted",
    },

    // --- Admin approval fields ---
    adminStatus: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
  },
  { timestamps: true }
);

// --- Indexes for faster dashboard queries ---
paperSchema.index({ track: 1, createdAt: -1 });
paperSchema.index({ publisher: 1, createdAt: -1 });
paperSchema.index({ adminStatus: 1 });

export const PaperModel = mongoose.model<IPaper>("Paper", paperSchema);
