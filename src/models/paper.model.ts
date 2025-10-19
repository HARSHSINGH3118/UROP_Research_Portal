import mongoose, { Schema, Document } from "mongoose";

export interface IPaper extends Document {
  title: string;
  track: string;
  fileUrl: string;  // for now local path, later S3
  publisher: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const paperSchema = new Schema<IPaper>(
  {
    title: { type: String, required: true },
    track: { type: String, required: true }, // e.g. "AI/ML", "Physics"
    fileUrl: { type: String, required: true },
    publisher: { type: Schema.Types.ObjectId, ref: "User", required: true }
  },
  { timestamps: true }
);

export const PaperModel = mongoose.model<IPaper>("Paper", paperSchema);
