import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  console.log("API /api/register called");
  
  try {
    const body = await request.json();
    console.log("Request body:", body);
    
    const { name, email, password } = body;

    if (!name || !email || !password) {
      return NextResponse.json(
        { message: "Всі поля обов'язкові" },
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
    console.error("Register error:", error);
    return NextResponse.json(
      { message: "Помилка сервера: " + (error instanceof Error ? error.message : "Невідома помилка") },
      { status: 500 }
    );
  }
}