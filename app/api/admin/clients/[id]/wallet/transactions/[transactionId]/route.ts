import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

async function checkAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return false;
  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { role: true },
  });
  return user?.role === "ADMIN" || user?.role === "SUPER_ADMIN";
}

// PATCH - Edit a wallet transaction (description only  for manual admin credits/debits)
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; transactionId: string } }
) {
  if (!(await checkAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    const { description } = await req.json();

    const tx = await prisma.walletTransaction.findUnique({
      where: { id: params.transactionId },
    });

    if (!tx) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
    }

    // Only allow editing description  never change amounts on system transactions
    const updated = await prisma.walletTransaction.update({
      where: { id: params.transactionId },
      data: { description },
    });

    return NextResponse.json({ success: true, transaction: updated });
  } catch (error) {
    console.error("Edit transaction error:", error);
    return NextResponse.json({ error: "Failed to update transaction" }, { status: 500 });
  }
}

// DELETE - Remove a wallet transaction
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string; transactionId: string } }
) {
  if (!(await checkAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    const tx = await prisma.walletTransaction.findUnique({
      where: { id: params.transactionId },
    });

    if (!tx) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
    }

    await prisma.walletTransaction.delete({
      where: { id: params.transactionId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete transaction error:", error);
    return NextResponse.json({ error: "Failed to delete transaction" }, { status: 500 });
  }
}
