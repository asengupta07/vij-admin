import { Schema, model, models } from "mongoose";

export interface AiCacheDoc {
  appId: string;
  fingerprint: string;
  ai: Record<string, unknown>;
  updatedAt: Date;
}

const AiCacheSchema = new Schema<AiCacheDoc>(
  {
    appId: { type: String, required: true, index: true },
    fingerprint: { type: String, required: true, index: true, unique: true },
    ai: { type: Schema.Types.Mixed, required: true },
    updatedAt: { type: Date, required: true }
  },
  { versionKey: false }
);

AiCacheSchema.index({ appId: 1, fingerprint: 1 }, { unique: true });

export const AiCacheModel = models.AiCache || model<AiCacheDoc>("AiCache", AiCacheSchema, "ai_cache");


