import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const withUserId = req.nextUrl.searchParams.get("withUserId");
  if (!withUserId) return NextResponse.json([]);

  const myId = session.user.id;

  const messages = await prisma.message.findMany({
    where: {
      OR: [
        { senderId: myId, receiverId: withUserId },
        { senderId: withUserId, receiverId: myId },
      ],
    },
    orderBy: { createdAt: "asc" },
  });

  // Позначити як прочитані
  await prisma.message.updateMany({
    where: { senderId: withUserId, receiverId: myId, read: false },
    data: { read: true },
  });

  return NextResponse.json(messages);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { receiverId, text } = await req.json();
  if (!receiverId || !text) {
    return NextResponse.json({ error: "Невірні дані" }, { status: 400 });
  }

  const message = await prisma.message.create({
    data: {
      senderId: session.user.id,
      receiverId,
      text,
    },
  });

  return NextResponse.json(message);
}