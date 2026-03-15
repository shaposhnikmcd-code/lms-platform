import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Немає доступу" }, { status: 403 });
  }

  const { id } = await params;
  const { userId } = await req.json();

  if (!userId) {
    return NextResponse.json({ error: "userId обовʼязковий" }, { status: 400 });
  }

  try {
    const ct = await prisma.courseTeacher.create({
      data: { courseId: id, userId },
      include: { user: { select: { id: true, name: true, email: true } } },
    });
    return NextResponse.json(ct);
  } catch {
    return NextResponse.json({ error: "Вже призначено або помилка БД" }, { status: 400 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Немає доступу" }, { status: 403 });
  }

  const { id } = await params;
  const { userId } = await req.json();

  await prisma.courseTeacher.deleteMany({
    where: { courseId: id, userId },
  });

  return NextResponse.json({ ok: true });
}