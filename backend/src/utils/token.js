const crypto = require("crypto");

/**
 * Standard RFC 7519 HMAC-SHA256 JWT Generator and Verifier
 * Implemented using Node.js standard crypto module without external vulnerabilities.
 */

const JWT_SECRET = process.env.JWT_SECRET || "swiftride_super_secret_signing_key_2026_cab_app";
const TOKEN_EXPIRY_SECONDS = 7 * 24 * 60 * 60; // 7 days

function base64UrlEncode(str) {
  return Buffer.from(str)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function base64UrlDecode(str) {
  let base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4) {
    base64 += "=";
  }
  return Buffer.from(base64, "base64").toString("utf-8");
}

function sign(content, secret) {
  return crypto
    .createHmac("sha256", secret)
    .update(content)
    .digest("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

/**
 * Generates a signed JWT token
 */
function generateToken(payload) {
  const header = {
    alg: "HS256",
    typ: "JWT",
  };

  const now = Math.floor(Date.now() / 1000);
  const fullPayload = {
    ...payload,
    iat: now,
    exp: now + TOKEN_EXPIRY_SECONDS,
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(fullPayload));
  const signature = sign(`${encodedHeader}.${encodedPayload}`, JWT_SECRET);

  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

/**
 * Verifies and decodes a signed JWT token
 */
function verifyToken(token) {
  if (!token || typeof token !== "string") {
    return null;
  }

  const parts = token.split(".");
  if (parts.length !== 3) {
    return null;
  }

  const [encodedHeader, encodedPayload, signature] = parts;
  const expectedSignature = sign(`${encodedHeader}.${encodedPayload}`, JWT_SECRET);

  // Timing safe comparison to prevent timing attacks
  const sigBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (sigBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(sigBuffer, expectedBuffer)) {
    return null;
  }

  try {
    const payload = JSON.parse(base64UrlDecode(encodedPayload));
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      return null; // Expired
    }
    return payload;
  } catch {
    return null;
  }
}

module.exports = {
  generateToken,
  verifyToken,
};
