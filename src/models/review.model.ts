import mongoose, { Schema, Document } from "mongoose";

export type ReviewDecision = "pending" | "selected" | "rejected";

export interface IReview extends Document {
  paper: mongoose.Types.ObjectId;
  reviewer: mongoose.Types.ObjectId;
  comments: string;
  insights: string[];          // optional bullet points
  decision?: ReviewDecision;   // mirrors paper resultStatus when reviewer decides
  createdAt: Date;
  updatedAt: Date;
}

const reviewSchema = new Schema<IReview>(
  {
    paper: { type: Schema.Types.ObjectId, ref: "Paper", required: true },
    reviewer: { type: Schema.Types.ObjectId, ref: "User", required: true },
    comments: { type: String, required: true },
    insights: [{ type: String }],
    decision: {
      type: String,
      enum: ["pending", "selected", "rejected"],
      default: "pending"
    }
  },
  { timestamps: true }
);

/** A reviewer should have at most one review per paper */
reviewSchema.index({ paper: 1, reviewer: 1 }, { unique: true });
reviewSchema.index({ reviewer: 1, paper: 1 });

export const ReviewModel = mongoose.model<IReview>("Review", reviewSchema);
