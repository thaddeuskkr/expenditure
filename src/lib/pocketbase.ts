import PocketBase from "pocketbase";
export const pocketbaseUrl = (
    process.env.NEXT_PUBLIC_POCKETBASE_URL || "https://e.tkkr.dev"
).replace(/\/$/, "");
export const pb = new PocketBase(pocketbaseUrl);
// Each view controls its own stale responses; independent queries must not
// accidentally cancel one another through the SDK's URL-based deduplication.
pb.autoCancellation(false);
