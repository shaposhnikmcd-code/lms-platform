import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET() {
  // Auto-resume suspended bundles whose resumeAt has passed
  await prisma.bundle.updateMany({
    where: {
      suspendedAt: { not: null },
      resumeAt: { not: null, lte: new Date() },
    },
    data: {
      suspendedAt: null,
      resumeAt: null,
    },
  });

  const bundles = await prisma.bundle.findMany({
    where: {
      published: true,
      suspendedAt: null,
    },
    include: { courses: true },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(bundles);
}
