import { NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import * as bcrypt from "bcryptjs";

export async function POST(request: Request) {
  const {
    razorpay_payment_id,
    razorpay_order_id,
    razorpay_signature,
    email,
    username,
    password,
    balance,
  } = await request.json();

  const body = razorpay_order_id + "|" + razorpay_payment_id;
  const expectedSignature = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET!)
    .update(body.toString())
    .digest("hex");

  if (expectedSignature === razorpay_signature) {
    console.log("signature verified");

    try {
      const hashedPassword = await bcrypt.hash(password, 10);

      const result = await prisma.$transaction(
        async (prisma) => {
          const user = await prisma.user.create({
            data: {
              email,
              username,
              password: hashedPassword,
              balance: parseInt(balance),
            },
          });

          const transaction = await prisma.transaction.create({
            data: {
              userId: user.id,
              amount: parseInt(balance),
              type: "credit",
              status: "completed",
              razorpayPaymentId: razorpay_payment_id,
            },
          });

          return { user, transaction };
        },
        {
          timeout: 30000, // Set timeout to 10 seconds
        }
      );

      return NextResponse.json({
        status: "success",
        message: "Payment verified and user registered",
      });
    } catch (error: any) {
      console.error("Error processing registration:", error.message || error);
      return NextResponse.json(
        { error: "Registration failed" },
        { status: 500 }
      );
    }
  } else {
    return NextResponse.json(
      { error: "Invalid payment signature" },
      { status: 400 }
    );
  }
}
