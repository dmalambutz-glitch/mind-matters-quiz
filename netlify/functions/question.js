import { getBlob, setBlob } from "./utils/db.js";
import { QUESTIONS, getPublicQuestion } from "./questions.js";

export async function handler(event, context) {
  if (event.httpMethod !== "GET") {
    return {
      statusCode: 405,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Method not allowed" })
    };
  }

  const token = event.queryStringParameters?.token || event.headers["x-quiz-token"];
  if (!token) {
    return {
      statusCode: 400,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Attempt token is required." })
    };
  }

  try {
    const attempt = await getBlob(`attempt:${token}`);
    if (!attempt) {
      return {
        statusCode: 404,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Attempt not found." })
      };
    }

    if (attempt.status === "completed") {
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          completed: true,
          status: "completed",
          score: attempt.score,
          finishTime: attempt.finishTime
        })
      };
    }

    const now = Date.now();
    const GRACE_PERIOD_MS = 2000;
    const QUESTION_TIMEOUT_MS = 15000 + GRACE_PERIOD_MS;

    // Check if the current question has timed out while the user was away or idle
    let updated = false;
    while (attempt.currentQuestionIndex < QUESTIONS.length) {
      if (!attempt.questionStartTime) {
        attempt.questionStartTime = now;
        updated = true;
        break;
      }

      const elapsed = now - attempt.questionStartTime;
      if (elapsed > QUESTION_TIMEOUT_MS) {
        // Automatically mark unanswered question as timeout (0 points)
        attempt.answers.push({
          questionIndex: attempt.currentQuestionIndex + 1,
          choice: "timeout",
          isCorrect: false,
          timestamp: now
        });
        attempt.currentQuestionIndex++;
        attempt.questionStartTime = now; // Start clock for next question
        updated = true;
      } else {
        break;
      }
    }

    if (attempt.currentQuestionIndex >= QUESTIONS.length) {
      attempt.status = "completed";
      attempt.finishTime = attempt.finishTime || now;
      updated = true;
    }

    if (updated) {
      await setBlob(`attempt:${token}`, attempt);
    }

    if (attempt.status === "completed") {
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          completed: true,
          status: "completed",
          score: attempt.score,
          finishTime: attempt.finishTime
        })
      };
    }

    const publicQ = getPublicQuestion(attempt.currentQuestionIndex);
    const elapsed = Date.now() - attempt.questionStartTime;
    const timeRemainingMs = Math.max(0, 15000 - elapsed);

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        completed: false,
        status: "in_progress",
        questionIndex: attempt.currentQuestionIndex + 1,
        totalQuestions: QUESTIONS.length,
        questionText: publicQ.questionText,
        choices: publicQ.choices,
        timeRemainingMs,
        score: attempt.score
      })
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Server error fetching question: " + err.message })
    };
  }
}
