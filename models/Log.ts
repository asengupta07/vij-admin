import { Schema, model, models } from "mongoose";

export interface LogDoc {
  appId: string;
  message: string;
  stack?: string;
  timestamp: Date;
  severity: "error" | "warning" | "info";
  metadata?: Record<string, unknown>;
  environment: "production" | "development";
  userAgent?: string;
  ai_summary?: string;
  ai?: Record<string, unknown>;
  fingerprint?: string;
  groupId?: Schema.Types.ObjectId;
  tags?: string[];
}

const LogSchema = new Schema<LogDoc>(
  {
    appId: { type: String, required: true, index: true },
    message: { type: String, required: true, index: true },
    stack: { type: String },
    timestamp: { type: Date, required: true, index: true },
    severity: { type: String, enum: ["error", "warning", "info"], required: true, index: true },
    metadata: { type: Schema.Types.Mixed },
    environment: { type: String, enum: ["production", "development"], required: true, index: true },
    userAgent: { type: String },
    ai_summary: { type: String },
    ai: { type: Schema.Types.Mixed },
    fingerprint: { type: String, index: true },
    groupId: { type: Schema.Types.ObjectId, ref: "ErrorGroup", index: true },
    tags: { type: [String], index: true }
  },
  { timestamps: false, versionKey: false }
);

LogSchema.index({ appId: 1, timestamp: -1 });
LogSchema.index({ message: "text" });

export const LogModel = models.Log || model<LogDoc>("Log", LogSchema, "logs");


