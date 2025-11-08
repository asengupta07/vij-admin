import { Schema, model, models } from "mongoose";

export interface ErrorGroupDoc {
  appId: string;
  fingerprint: string;
  messageSample: string;
  stackSample?: string;
  severity: "error" | "warning" | "info";
  occurrenceCount: number;
  lastSeen: Date;
  environment?: "production" | "development";
  tags?: string[];
}

const ErrorGroupSchema = new Schema<ErrorGroupDoc>(
  {
    appId: { type: String, required: true, index: true },
    fingerprint: { type: String, required: true, index: true, unique: false },
    messageSample: { type: String, required: true },
    stackSample: { type: String },
    severity: { type: String, enum: ["error", "warning", "info"], required: true },
    occurrenceCount: { type: Number, default: 0 },
    lastSeen: { type: Date, required: true },
    environment: { type: String, enum: ["production", "development"] },
    tags: { type: [String], index: true }
  },
  { timestamps: false, versionKey: false }
);

ErrorGroupSchema.index({ appId: 1, fingerprint: 1 }, { unique: false });

export const ErrorGroupModel = models.ErrorGroup || model<ErrorGroupDoc>("ErrorGroup", ErrorGroupSchema, "error_groups");


