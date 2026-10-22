const Razorpay = require("razorpay");

/**
 * Initializes and returns the official Razorpay SDK instance
 * Uses RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET from environment variables
 */
function getRazorpayInstance() {
  const keyId = process.env.RAZORPAY_KEY_ID?.trim();
  const keySecret = process.env.RAZORPAY_KEY_SECRET?.trim();

  if (!keyId || !keySecret) {
    const error = new Error(
      "Razorpay Test Mode credentials are not configured. Please set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in backend/.env"
    );
    error.statusCode = 503;
    error.code = "RAZORPAY_NOT_CONFIGURED";
    throw error;
  }

  return new Razorpay({
    key_id: keyId,
    key_secret: keySecret,
  });
}

function isRazorpayConfigured() {
  const keyId = process.env.RAZORPAY_KEY_ID?.trim();
  const keySecret = process.env.RAZORPAY_KEY_SECRET?.trim();
  return Boolean(keyId && keySecret && keyId.startsWith("rzp_test_"));
}

module.exports = {
  getRazorpayInstance,
  isRazorpayConfigured,
};
