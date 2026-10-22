/**
 * Dynamically loads the official Razorpay Checkout SDK script
 * Ensures the script is only loaded once in the client runtime.
 */
export function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === "undefined") {
      resolve(false);
      return;
    }

    // Check if script is already present in window
    if ((window as unknown as { Razorpay?: unknown }).Razorpay) {
      resolve(true);
      return;
    }

    const existingScript = document.getElementById("razorpay-checkout-script");
    if (existingScript) {
      existingScript.addEventListener("load", () => resolve(true));
      existingScript.addEventListener("error", () => resolve(false));
      return;
    }

    const script = document.createElement("script");
    script.id = "razorpay-checkout-script";
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;

    script.onload = () => resolve(true);
    script.onerror = () => {
      console.error("Failed to load Razorpay Checkout SDK from CDN.");
      resolve(false);
    };

    document.body.appendChild(script);
  });
}
