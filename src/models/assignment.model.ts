import mongoose, { Schema, Document } from "mongoose";

export interface IAssignment extends Document {
  eventId: mongoose.Types.ObjectId;
  paperId: mongoose.Types.ObjectId;
  reviewerId: mongoose.Types.ObjectId;
  assignedBy: mongoose.Types.ObjectId;
  assignedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const assignmentSchema = new Schema<IAssignment>(
  {
    eventId: { type: Schema.Types.ObjectId, ref: "Event", required: true },
    paperId: { type: Schema.Types.ObjectId, ref: "Paper", required: true },
    reviewerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    assignedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    assignedAt: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

// Prevent duplicate reviewer↔paper within the same event
assignmentSchema.index({ eventId: 1, paperId: 1, reviewerId: 1 }, { unique: true });
// Helpful lookups
assignmentSchema.index({ reviewerId: 1, eventId: 1 });
assignmentSchema.index({ eventId: 1 });

export const AssignmentModel = mongoose.model<IAssignment>("Assignment", assignmentSchema);
