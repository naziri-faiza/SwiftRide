/**
 * Centralized Error Handling Middleware
 * Ensures consistent JSON error responses across all endpoints
 */
function errorHandler(err, req, res, next) {
  const statusCode = err.statusCode || 500;
  const message = err.message || "Internal server error occurred.";

  // Log error on server without leaking private keys or credentials
  if (statusCode === 500) {
    console.error("[ServerError]", err);
  } else {
    console.warn(`[ClientError ${statusCode}]`, message);
  }

  return res.status(statusCode).json({
    success: false,
    statusCode,
    error: err.code || "REQUEST_FAILED",
    message,
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
}

module.exports = errorHandler;
