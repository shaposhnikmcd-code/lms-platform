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

  const senderId = session.user.id;
  const senderRole = (session.user as { role?: string }).role;
  const { receiverId, text } = await req.json();
  if (!receiverId || !text || typeof receiverId !== 'string' || typeof text !== 'string') {
    return NextResponse.json({ error: "Невірні дані" }, { status: 400 });
  }
  if (text.length > 4000) {
    return NextResponse.json({ error: "Повідомлення занадто довге" }, { status: 400 });
  }

  // M1 fix: відправник може писати лише тому, з ким має реальний звʼязок (курс/роль).
  // ADMIN — всім. TEACHER — своїм студентам. STUDENT — своїм вчителям.
  if (senderRole !== 'ADMIN') {
    const receiver = await prisma.user.findUnique({
      where: { id: receiverId },
      select: { id: true, role: true },
    });
    if (!receiver) {
      return NextResponse.json({ error: "Отримувача не знайдено" }, { status: 404 });
    }
    // ADMIN може отримати від будь-кого (support flow).
    if (receiver.role !== 'ADMIN') {
      let hasLink = false;
      if (senderRole === 'TEACHER' && receiver.role === 'STUDENT') {
        // вчитель → студент лише якщо студент enrolled на курс, який він викладає
        const shared = await prisma.courseTeacher.findFirst({
          where: {
            userId: senderId,
            course: { enrollments: { some: { userId: receiverId } } },
          },
          select: { id: true },
        });
        hasLink = !!shared;
      } else if (senderRole === 'STUDENT' && receiver.role === 'TEACHER') {
        // студент → вчитель лише якщо вчитель викладає курс, на який студент enrolled
        const shared = await prisma.courseTeacher.findFirst({
          where: {
            userId: receiverId,
            course: { enrollments: { some: { userId: senderId } } },
          },
          select: { id: true },
        });
        hasLink = !!shared;
      }
      if (!hasLink) {
        return NextResponse.json({ error: "Немає звʼязку з цим користувачем" }, { status: 403 });
      }
    }
  }

  const message = await prisma.message.create({
    data: {
      senderId,
      receiverId,
      text,
    },
  });

  return NextResponse.json(message);
}