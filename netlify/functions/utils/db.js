import fs from "fs";
import path from "path";

const LOCAL_FILE = path.join(process.cwd(), ".local-data.json");

function readLocalData() {
  try {
    if (fs.existsSync(LOCAL_FILE)) {
      return JSON.parse(fs.readFileSync(LOCAL_FILE, "utf8"));
    }
  } catch (e) {
    // Ignore read errors
  }
  return {};
}

function writeLocalData(data) {
  try {
    fs.writeFileSync(LOCAL_FILE, JSON.stringify(data, null, 2), "utf8");
  } catch (e) {
    // Ignore write errors
  }
}

async function getNetlifyStore() {
  try {
    const blobsModule = await import("@netlify/blobs");
    if (blobsModule && typeof blobsModule.getStore === "function") {
      return blobsModule.getStore("mind_matters");
    }
  } catch (err) {
    // @netlify/blobs package dynamic import error or unlinked context
  }
  return null;
}

/**
 * Gets a value from Netlify Blobs with local fallback.
 */
export async function getBlob(key) {
  try {
    const store = await getNetlifyStore();
    if (store) {
      const val = await store.get(key, { type: "json" });
      if (val !== null && val !== undefined) {
        return val;
      }
    }
  } catch (err) {
    // Fallback
  }
  const local = readLocalData();
  return local[key] !== undefined ? local[key] : null;
}

/**
 * Saves a JSON value to Netlify Blobs with local fallback.
 */
export async function setBlob(key, value) {
  try {
    const store = await getNetlifyStore();
    if (store) {
      await store.setJSON(key, value);
    }
  } catch (err) {
    // Fallback
  }
  // Keep local JSON in sync
  const local = readLocalData();
  local[key] = value;
  writeLocalData(local);
  return true;
}

/**
 * Lists blob keys with a given prefix.
 */
export async function listBlobs(prefix = "") {
  try {
    const store = await getNetlifyStore();
    if (store) {
      const res = await store.list({ prefix });
      if (res && Array.isArray(res.blobs)) {
        return res.blobs.map(b => b.key);
      }
    }
  } catch (err) {
    // Fallback
  }
  const local = readLocalData();
  return Object.keys(local).filter(k => k.startsWith(prefix));
}
