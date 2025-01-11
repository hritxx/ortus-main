import { NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]/route";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { razorpay_payment_id, razorpay_order_id, razorpay_signature, amount } =
    await request.json();

  const body = razorpay_order_id + "|" + razorpay_payment_id;
  const expectedSignature = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET!)
    .update(body.toString())
    .digest("hex");

  if (expectedSignature === razorpay_signature) {
    try {
      const user = await prisma.user.findUnique({
        where: { email: session.user.email },
      });

      if (!user) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }

      // Update user balance and create transaction in a transaction
      await prisma.$transaction([
        prisma.user.update({
          where: { email: session.user.email },
          data: { balance: { increment: parseFloat(amount) } },
        }),
        prisma.transaction.create({
          data: {
            userId: user.id,
            amount: parseFloat(amount),
            type: "credit",
            status: "completed",
            razorpayPaymentId: razorpay_payment_id,
          },
        }),
      ]);

      return NextResponse.json({
        status: "success",
        message: "Payment verified and balance updated",
      });
    } catch (error) {
      console.error("Error processing payment:", error);
      return NextResponse.json(
        { error: "Payment processing failed" },
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
