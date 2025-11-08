import mongoose from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.warn("[vij-admin] MONGODB_URI is not set. Set it in your environment to enable DB.");
}

declare global {
  // eslint-disable-next-line no-var
  var __mongooseConn: Promise<typeof mongoose> | undefined;
}

export async function getDb() {
  if (!MONGODB_URI) {
    throw new Error("MONGODB_URI not set");
  }
  if (!global.__mongooseConn) {
    global.__mongooseConn = mongoose.connect(MONGODB_URI, {
      dbName: "vij"
    });
  }
  return global.__mongooseConn;
}


