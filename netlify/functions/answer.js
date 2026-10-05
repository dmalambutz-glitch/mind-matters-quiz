import { getBlob, setBlob } from "./utils/db.js";
import { QUESTIONS } from "./questions.js";

export async function handler(event, context) {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Method not allowed" })
    };
  }

  try {
    const body = JSON.parse(event.body || "{}");
    const { token, choice, questionIndex } = body;

    if (!token || choice === undefined || !questionIndex) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Token, choice, and questionIndex are required." })
      };
    }

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
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          error: "Attempt is already completed.",
          completed: true,
          score: attempt.score
        })
      };
    }

    // Check sequence
    const expectedQuestionIndex = attempt.currentQuestionIndex + 1;
    if (questionIndex !== expectedQuestionIndex) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          error: `Invalid question sequence. Expected question ${expectedQuestionIndex}.`,
          currentQuestionIndex: expectedQuestionIndex
        })
      };
    }

    const now = Date.now();
    const startTime = attempt.questionStartTime || now;
    const elapsed = now - startTime;
    const GRACE_PERIOD_MS = 2000;
    const MAX_ALLOWED_MS = 15000 + GRACE_PERIOD_MS;

    const q = QUESTIONS[attempt.currentQuestionIndex];
    let isCorrect = false;
    let recordedChoice = choice;

    if (elapsed > MAX_ALLOWED_MS) {
      // Exceeded 15s + 2s network grace: score 0 & record timeout
      recordedChoice = "timeout";
      isCorrect = false;
    } else {
      // Convert choice to numeric index if sent as letter (A->0, B->1, C->2, D->3)
      let choiceIdx = choice;
      if (typeof choice === "string") {
        const letterMap = { A: 0, B: 1, C: 2, D: 3, a: 0, b: 1, c: 2, d: 3 };
        if (letterMap[choice] !== undefined) {
          choiceIdx = letterMap[choice];
        } else {
          choiceIdx = parseInt(choice, 10);
        }
      }

      isCorrect = choiceIdx === q.correctAnswer;
    }

    // Record answer
    attempt.answers.push({
      questionIndex: expectedQuestionIndex,
      choice: recordedChoice,
      isCorrect,
      timestamp: now
    });

    if (isCorrect) {
      attempt.score += 1;
    }

    attempt.currentQuestionIndex++;
    attempt.questionStartTime = null; // Reset timing clock for next question

    if (attempt.currentQuestionIndex >= QUESTIONS.length) {
      attempt.status = "completed";
      attempt.finishTime = now;

      const saved = await setBlob(`attempt:${token}`, attempt);
      if (!saved) {
        return {
          statusCode: 500,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ error: "Failed to save final attempt score." })
        };
      }

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

    const saved = await setBlob(`attempt:${token}`, attempt);
    if (!saved) {
      return {
        statusCode: 500,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Failed to save attempt answer." })
      };
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        completed: false,
        status: "in_progress",
        nextQuestionIndex: attempt.currentQuestionIndex + 1,
        score: attempt.score
      })
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Server error processing answer: " + err.message })
    };
  }
}
