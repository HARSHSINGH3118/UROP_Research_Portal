// src/models/paper.model.ts
import mongoose, { Schema, Document } from "mongoose";

export type PaperStatus = "submitted" | "processing" | "reviewed";
export type AdminStatus = "pending" | "approved" | "rejected";
export type ResultStatus = "submitted" | "selected" | "rejected" | "resultOut";

export interface IPaper extends Document {
  title: string;                           // Paper title
  track: string;                           // Track name, e.g. "AI/ML"
  fileUrl: string;                         // Local path for now (S3 later)
  publisher: mongoose.Types.ObjectId;      // Reference to User (author)
  eventId: mongoose.Types.ObjectId;        // Reference to Event
  insights?: string[];                     // AI-generated insights
  status?: PaperStatus;                    // AI processing lifecycle
  adminStatus?: AdminStatus;               // Coordinator approval state
  resultStatus?: ResultStatus;             // Author-visible selection/result state
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
    eventId: { type: Schema.Types.ObjectId, ref: "Event", required: true },

    // --- AI insight fields ---
    insights: [{ type: String }],
    status: {
      type: String,
      enum: ["submitted", "processing", "reviewed"],
      default: "submitted"
    },

    // --- Coordinator approval fields ---
    adminStatus: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending"
    },

    // --- Event result state visible to author ---
    resultStatus: {
      type: String,
      enum: ["submitted", "selected", "rejected", "resultOut"],
      default: "submitted"
    }
  },
  { timestamps: true }
);

// --- Indexes for faster dashboard queries ---
paperSchema.index({ eventId: 1, publisher: 1, createdAt: -1 });
paperSchema.index({ track: 1, createdAt: -1 });
paperSchema.index({ publisher: 1, createdAt: -1 });
paperSchema.index({ adminStatus: 1 });

export const PaperModel = mongoose.model<IPaper>("Paper", paperSchema);
