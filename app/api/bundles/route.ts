import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET() {
  const bundles = await prisma.bundle.findMany({
    where: { published: true },
    include: { courses: true },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(bundles);
}
