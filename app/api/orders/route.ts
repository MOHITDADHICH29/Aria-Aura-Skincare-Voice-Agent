import { NextResponse } from "next/server";
import { getAllOrders, resetOrders } from "@/lib/orders";

export async function GET() {
  return NextResponse.json({ orders: getAllOrders() });
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    if (body.action === "reset") {
      resetOrders();
      return NextResponse.json({ success: true, orders: getAllOrders() });
    }
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("Orders API error:", error);
    return NextResponse.json({ error: "Failed to process orders action" }, { status: 500 });
  }
}
