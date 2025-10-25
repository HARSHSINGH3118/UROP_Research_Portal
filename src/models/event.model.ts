import mongoose, { Schema, Document } from "mongoose";

export interface IEvent extends Document {
  title: string;
  description: string;
  date: Date;
  reviewDeadline?: Date;                 // ← NEW (optional, for reminders)
  bannerUrl?: string;
  createdBy: mongoose.Types.ObjectId;    // coordinator user
  createdAt: Date;
  updatedAt: Date;
}

const eventSchema = new Schema<IEvent>(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    date: { type: Date, required: true },
    reviewDeadline: { type: Date },      // ← NEW
    bannerUrl: { type: String },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true }
  },
  { timestamps: true }
);

eventSchema.index({ date: 1 });
eventSchema.index({ reviewDeadline: 1 }); // helpful for reminders
eventSchema.index({ createdAt: -1 });

export const EventModel = mongoose.model<IEvent>("Event", eventSchema);
