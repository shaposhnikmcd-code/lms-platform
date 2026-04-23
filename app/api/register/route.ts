import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { validatePasswordFull } from "@/lib/passwordPolicy";
import { checkRateLimit } from "@/lib/ratelimit";

export async function POST(request: NextRequest) {
  try {
    const rl = await checkRateLimit(request, 'register');
    if (!rl.ok) return rl.response!;

    const body = await request.json();
    const { name, email, password } = body;

    if (!name || !email || !password || typeof email !== 'string' || typeof name !== 'string') {
      return NextResponse.json(
        { message: "Всі поля обов'язкові" },
        { status: 400 }
      );
    }

    // Єдина політика пароля (min 8 + HIBP). Див. lib/passwordPolicy.ts.
    const policy = await validatePasswordFull(password);
    if (!policy.ok) {
      return NextResponse.json({ message: policy.message }, { status: 400 });
    }

    // Базова валідація email (повний regex некорисний — robust RFC неможливий).
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { message: "Невірний формат email" },
        { status: 400 }
      );
    }

    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      return NextResponse.json(
        { message: "Користувач з таким email вже існує" },
        { status: 400 }
      );
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
      },
    });

    return NextResponse.json(
      { 
        message: "Користувача успішно створено",
        user: { 
          id: user.id,
          name: user.name, 
          email: user.email 
        } 
      },
      { status: 201 }
    );
  } catch (error) {
    // Не пропускаємо raw error message до клієнта — це може протекти Prisma/schema деталі (L1 fix).
    console.error("Register error:", error);
    return NextResponse.json(
      { message: "Помилка сервера" },
      { status: 500 }
    );
  }
}