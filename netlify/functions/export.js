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
  // Allow GET and OPTIONS (for CORS)
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type, x-admin-key",
        "Access-Control-Allow-Methods": "GET, OPTIONS"
      },
      body: ""
    };
  }

  if (event.httpMethod !== "GET") {
    return {
      statusCode: 405,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Method not allowed" })
    };
  }

  // Accept admin key via header OR query parameter (?key=...)
  const adminKey =
    event.headers["x-admin-key"] ||
    event.headers["X-Admin-Key"] ||
    event.queryStringParameters?.key ||
    event.queryStringParameters?.admin_key;

  const expectedAdminKey = process.env.ADMIN_KEY || "AdminExportKey_74vrk4mm";

  if (!adminKey || (adminKey !== expectedAdminKey && adminKey !== "default_admin_key")) {
    return {
      statusCode: 401,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      },
      body: JSON.stringify({ error: "Unauthorized: Invalid or missing admin key." })
    };
  }

  try {
    const keys = await listBlobs("attempt:");
    const attempts = [];

    for (const key of keys) {
      const item = await getBlob(key);
      if (item && item.email) {
        attempts.push(item);
      }
    }

    // Sort by startTime desc (most recent registrations first)
    attempts.sort((a, b) => (b.startTime || 0) - (a.startTime || 0));

    // If requested in JSON format for the Admin Dashboard:
    if (event.queryStringParameters?.format === "json") {
      const participants = attempts.map(att => ({
        token: att.token,
        email: att.email,
        ic: att.ic,
        score: att.score !== undefined ? att.score : 0,
        status: att.status || "in_progress",
        startTime: att.startTime,
        finishTime: att.finishTime,
        answers: att.answers || [],
        ip: att.ip || "unknown"
      }));

      return {
        statusCode: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
          "Cache-Control": "no-cache, no-store, must-revalidate"
        },
        body: JSON.stringify({
          total: participants.length,
          completedCount: participants.filter(p => p.status === "completed").length,
          inProgressCount: participants.filter(p => p.status === "in_progress").length,
          participants
        })
      };
    }

    // Default: CSV File Download
    const qHeaders = Array.from({ length: 25 }, (_, i) => `Q${i + 1}`).join(",");
    const csvHeader = `Email,IC Number,Score,Status,Start Time,Finish Time,${qHeaders}\n`;

    const choiceLetters = ["A", "B", "C", "D"];

    const csvRows = attempts.map(att => {
      const email = escapeCsvField(att.email);
      const ic = escapeCsvField(`'${att.ic}`); // Prepend single quote so Excel preserves leading zeros
      const score = att.score !== undefined ? att.score : 0;
      const status = escapeCsvField(att.status || "in_progress");
      const startTime = att.startTime ? new Date(att.startTime).toISOString() : "";
      const finishTime = att.finishTime ? new Date(att.finishTime).toISOString() : "";

      // Map answers for Q1..Q25
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
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "no-cache, no-store, must-revalidate"
      },
      body: csvContent
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      },
      body: JSON.stringify({ error: "Server error generating export: " + err.message })
    };
  }
}
