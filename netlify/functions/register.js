import crypto from "crypto";
import { getBlob, setBlob } from "./utils/db.js";

// In-memory rate limiting map for function lifetime (resets periodically)
const ipLimits = new Map();

export async function handler(event, context) {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Method not allowed" })
    };
  }

  try {
    const ip = event.headers["x-forwarded-for"] || event.headers["client-ip"] || "127.0.0.1";
    const now = Date.now();
    const windowMs = 60 * 1000;
    const maxRequests = 5;

    let ipData = ipLimits.get(ip);
    if (!ipData || now - ipData.startTime > windowMs) {
      ipData = { count: 1, startTime: now };
      ipLimits.set(ip, ipData);
    } else {
      ipData.count++;
      if (ipData.count > maxRequests) {
        return {
          statusCode: 429,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ error: "Too many registration attempts. Please wait a minute before trying again." })
        };
      }
    }

    const body = JSON.parse(event.body || "{}");
    const { email, ic } = body;

    if (!email || !ic) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Email address and IC number are required." })
      };
    }

    const emailClean = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailClean)) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Invalid email address format." })
      };
    }

    const icClean = ic.toString().replace(/[\s-]/g, "");
    if (!/^\d{12}$/.test(icClean)) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "IC number must be exactly 12 digits." })
      };
    }

    const salt = process.env.HASH_SALT || "mind_matters_default_salt_2026";
    const hashedIc = crypto.createHmac("sha256", salt).update(icClean).digest("hex");
    const hashedEmail = crypto.createHmac("sha256", salt).update(emailClean).digest("hex");

    // Check duplicate IC and Email
    const existingIc = await getBlob(`ic:${hashedIc}`);
    const existingEmail = await getBlob(`email:${hashedEmail}`);

    if (existingIc || existingEmail) {
      return {
        statusCode: 409,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          error: "already_participated",
          message: "You have already participated. Any participation after your first attempt will not be counted and is forfeited."
        })
      };
    }

    // Mask email: first 2 characters of local part + "****" + domain
    const [localPart, domainPart] = emailClean.split("@");
    const maskedLocal = localPart.length <= 2 ? localPart + "****" : localPart.substring(0, 2) + "****";
    const maskedEmail = `${maskedLocal}@${domainPart}`;

    const token = `att_${crypto.randomUUID()}`;
    const attemptData = {
      token,
      email: emailClean,
      ic: icClean,
      maskedEmail,
      hashedIc,
      hashedEmail,
      status: "in_progress",
      currentQuestionIndex: 0,
      questionStartTime: null,
      answers: [],
      score: 0,
      startTime: now,
      finishTime: null,
      ip
    };

    const savedIc = await setBlob(`ic:${hashedIc}`, { token, createdAt: now });
    const savedEmail = await setBlob(`email:${hashedEmail}`, { token, createdAt: now });
    const savedAttempt = await setBlob(`attempt:${token}`, attemptData);

    if (!savedAttempt || !savedIc || !savedEmail) {
      return {
        statusCode: 500,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Failed to save registration data. Please try again." })
      };
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token,
        maskedEmail,
        message: "Registration successful."
      })
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Server error during registration: " + err.message })
    };
  }
}
