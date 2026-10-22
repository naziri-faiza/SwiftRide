const { verifyToken } = require("../utils/token");
const userStore = require("../services/userStore");

/**
 * Middleware: Strictly requires authenticated user session
 */
async function authenticateUser(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Authentication required. Please sign in to access your customer dashboard.",
      });
    }

    const token = authHeader.split(" ")[1];
    const decoded = verifyToken(token);

    if (!decoded || !decoded.sub) {
      return res.status(401).json({
        success: false,
        message: "Your session has expired or is invalid. Please sign in again.",
      });
    }

    // Attach verified user to request
    req.user = {
      id: decoded.sub,
      email: decoded.email,
      fullName: decoded.fullName,
      role: decoded.role || "rider",
    };

    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Middleware: Optionally populates req.user if Bearer token is provided
 * Allows guest booking flow while seamlessly associating rides if signed in.
 */
async function optionalUser(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.split(" ")[1];
      const decoded = verifyToken(token);
      if (decoded && decoded.sub) {
        req.user = {
          id: decoded.sub,
          email: decoded.email,
          fullName: decoded.fullName,
          role: decoded.role || "rider",
        };
      }
    }
  } catch {
    // Guest fallback
    req.user = null;
  }
  next();
}

module.exports = {
  authenticateUser,
  optionalUser,
};
