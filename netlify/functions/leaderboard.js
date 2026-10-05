import { listBlobs, getBlob } from "./utils/db.js";

export async function handler(event, context) {
  if (event.httpMethod !== "GET") {
    return {
      statusCode: 405,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Method not allowed" })
    };
  }

  try {
    const keys = await listBlobs("attempt:");
    const attempts = [];

    for (const key of keys) {
      const item = await getBlob(key);
      if (item && item.status === "completed") {
        attempts.push(item);
      }
    }

    // Sort: score desc, then finishTime asc (earlier finish ranks higher)
    attempts.sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      return (a.finishTime || 0) - (b.finishTime || 0);
    });

    const leaderboard = attempts.map((item, index) => ({
      rank: index + 1,
      maskedEmail: item.maskedEmail,
      score: item.score
    }));

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache, no-store, must-revalidate"
      },
      body: JSON.stringify({
        leaderboard,
        updatedAt: Date.now()
      })
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Server error fetching leaderboard: " + err.message })
    };
  }
}
