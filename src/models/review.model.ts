import mongoose, { Schema, Document } from "mongoose";

export interface IReview extends Document {
  paper: mongoose.Types.ObjectId;
  reviewer: mongoose.Types.ObjectId;
  comments: string;
  insights: string[]; // bullet points
  createdAt: Date;
}

const reviewSchema = new Schema<IReview>(
  {
    paper: { type: Schema.Types.ObjectId, ref: "Paper", required: true },
    reviewer: { type: Schema.Types.ObjectId, ref: "User", required: true },
    comments: { type: String, required: true },
    insights: [{ type: String }]
  },
  { timestamps: true }
);

export const ReviewModel = mongoose.model<IReview>("Review", reviewSchema);
