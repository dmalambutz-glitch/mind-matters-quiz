import fs from "fs";
import path from "path";

const TOKEN = process.env.NETLIFY_AUTH_TOKEN || "nfp_PnAHWtSynZbN8rzj5aiSaT3tndG3C4UMa149";
const SITE_ID = process.env.NETLIFY_SITE_ID || "6abfd8f6-bf7b-4e88-add0-7c710e2e6eb8";
const STORE = "mind_matters";
const BASE_URL = `https://api.netlify.com/api/v1/blobs/${SITE_ID}/${STORE}`;

const LOCAL_FILE = path.join(process.cwd(), ".local-data.json");

function getLocalData() {
  try {
    if (fs.existsSync(LOCAL_FILE)) {
      return JSON.parse(fs.readFileSync(LOCAL_FILE, "utf8"));
    }
  } catch (e) {}
  return {};
}

function saveLocalData(data) {
  try {
    fs.writeFileSync(LOCAL_FILE, JSON.stringify(data, null, 2), "utf8");
  } catch (e) {}
}

/**
 * Gets a value from Netlify Blobs via REST API with local fallback.
 */
export async function getBlob(key) {
  try {
    // Normalise key encoding (prevent double-encoding %3A)
    const rawKey = decodeURIComponent(key);
    const encodedKey = encodeURIComponent(rawKey);
    const res = await fetch(`${BASE_URL}/${encodedKey}`, {
      headers: { Authorization: `Bearer ${TOKEN}` }
    });
    if (res.status === 200) {
      return await res.json();
    }
  } catch (err) {
    // Fallback
  }
  const local = getLocalData();
  return local[key] !== undefined ? local[key] : null;
}

/**
 * Saves a JSON value to Netlify Blobs via REST API with local fallback.
 */
export async function setBlob(key, value) {
  try {
    const rawKey = decodeURIComponent(key);
    const encodedKey = encodeURIComponent(rawKey);
    const res = await fetch(`${BASE_URL}/${encodedKey}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(value)
    });
    if (res.ok) {
      return true;
    }
  } catch (err) {
    // Fallback
  }
  const local = getLocalData();
  local[key] = value;
  saveLocalData(local);
  return true;
}

/**
 * Lists blob keys with a given prefix via Netlify Blobs REST API.
 * Automatically decodes URL-encoded keys (e.g. %3A -> :) for caller consistency.
 */
export async function listBlobs(prefix = "") {
  try {
    const res = await fetch(BASE_URL, {
      headers: { Authorization: `Bearer ${TOKEN}` }
    });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.blobs)) {
        const decodedKeys = data.blobs.map(b => {
          try {
            return decodeURIComponent(b.key);
          } catch (e) {
            return b.key;
          }
        });
        if (!prefix) return decodedKeys;
        const normalizedPrefix = decodeURIComponent(prefix);
        return decodedKeys.filter(k => k.startsWith(normalizedPrefix));
      }
    }
  } catch (err) {
    // Fallback
  }
  const local = getLocalData();
  return Object.keys(local).filter(k => k.startsWith(prefix));
}
