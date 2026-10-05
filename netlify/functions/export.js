import { listBlobs, getBlob } from "./utils/db.js";

function escapeCsvField(field) {
  if (field === null || field === undefined) return '""';
  const str = String(field);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export async function handler(event, context) {
  if (event.httpMethod !== "GET") {
    return {
      statusCode: 405,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Method not allowed" })
    };
  }

  const adminKeyHeader = event.headers["x-admin-key"] || event.headers["X-Admin-Key"];
  const expectedAdminKey = process.env.ADMIN_KEY || "default_admin_key";

  if (!adminKeyHeader || adminKeyHeader !== expectedAdminKey) {
    return {
      statusCode: 401,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Unauthorized: Invalid x-admin-key header." })
    };
  }

  try {
    const keys = await listBlobs("attempt:");
    const attempts = [];

    for (const key of keys) {
      const item = await getBlob(key);
      if (item) {
        attempts.push(item);
      }
    }

    // Sort by startTime asc
    attempts.sort((a, b) => (a.startTime || 0) - (b.startTime || 0));

    const qHeaders = Array.from({ length: 25 }, (_, i) => `Q${i + 1}`).join(",");
    const csvHeader = `Email,IC Number,Score,Status,Start Time,Finish Time,${qHeaders}\n`;

    const choiceLetters = ["A", "B", "C", "D"];

    const csvRows = attempts.map(att => {
      const email = escapeCsvField(att.email);
      const ic = escapeCsvField(`'${att.ic}`); // Lead with quote to prevent Excel truncation of leading zeros
      const score = att.score !== undefined ? att.score : 0;
      const status = escapeCsvField(att.status);
      const startTime = att.startTime ? new Date(att.startTime).toISOString() : "";
      const finishTime = att.finishTime ? new Date(att.finishTime).toISOString() : "";

      // Map Q1..Q25 choices
      const answersMap = {};
      if (Array.isArray(att.answers)) {
        att.answers.forEach(ans => {
          let choiceStr = ans.choice;
          if (typeof ans.choice === "number" && choiceLetters[ans.choice]) {
            choiceStr = choiceLetters[ans.choice];
          }
          answersMap[ans.questionIndex] = choiceStr;
        });
      }

      const qAnswers = Array.from({ length: 25 }, (_, i) => {
        const val = answersMap[i + 1];
        return escapeCsvField(val !== undefined ? val : "unanswered");
      }).join(",");

      return `${email},${ic},${score},${status},${escapeCsvField(startTime)},${escapeCsvField(finishTime)},${qAnswers}`;
    });

    const csvContent = csvHeader + csvRows.join("\n");

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="mind_matters_quiz_export.csv"',
        "Cache-Control": "no-cache"
      },
      body: csvContent
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Server error generating export: " + err.message })
    };
  }
}
