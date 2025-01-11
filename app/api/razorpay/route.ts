import { NextResponse } from "next/server";
import Razorpay from "razorpay";

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID!,
  key_secret: process.env.RAZORPAY_KEY_SECRET!,
});

export async function POST(request: Request) {
  const { amount } = await request.json();

  const payment_capture = 1;
  const amountInPaise = parseInt(amount) * 100;
  const currency = "INR";

  const options = {
    amount: amountInPaise,
    currency,
    receipt: `receipt_${Date.now()}`,
    payment_capture,
  };

  try {
    const order = await razorpay.orders.create(options);
    return NextResponse.json(order);
  } catch (error) {
    console.error("Error creating Razorpay order:", error);
    return NextResponse.json(
      { error: "Error creating payment order" },
      { status: 500 }
    );
  }
}
