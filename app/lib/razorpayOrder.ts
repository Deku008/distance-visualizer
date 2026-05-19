import crypto from "node:crypto";
import Razorpay from "razorpay";

let razorpay: Razorpay | undefined;

export const PRO_MONTHLY_AMOUNT_PAISE = 10000;
export const PRO_MONTHLY_CURRENCY = "INR";

export function getRazorpayKeyId() {
  const keyId = process.env.RAZORPAY_KEY_ID ?? process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;

  if (!keyId) {
    throw new Error("RAZORPAY_KEY_ID is not configured.");
  }

  return keyId;
}

export function getRazorpayKeySecret() {
  if (!process.env.RAZORPAY_KEY_SECRET) {
    throw new Error("RAZORPAY_KEY_SECRET is not configured.");
  }

  return process.env.RAZORPAY_KEY_SECRET;
}

export function getRazorpay() {
  if (razorpay) {
    return razorpay;
  }

  razorpay = new Razorpay({
    key_id: getRazorpayKeyId(),
    key_secret: getRazorpayKeySecret(),
  });

  return razorpay;
}

export function isValidRazorpaySignature(orderId: string, paymentId: string, signature: string) {
  const expectedSignature = crypto
    .createHmac("sha256", getRazorpayKeySecret())
    .update(`${orderId}|${paymentId}`)
    .digest("hex");

  if (expectedSignature.length !== signature.length) {
    return false;
  }

  return crypto.timingSafeEqual(Buffer.from(expectedSignature), Buffer.from(signature));
}
