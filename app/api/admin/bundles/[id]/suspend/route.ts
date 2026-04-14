import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { isAdmin } from "@/lib/adminAuth";

// POST { action: "suspend", resumeAt? } — suspend bundle
// POST { action: "resume" } — resume bundle immediately
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdmin(req))) {
    return NextResponse.json({ error: "Немає доступу" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();

  if (body.action === "resume") {
    const bundle = await prisma.bundle.update({
      where: { id },
      data: {
        suspendedAt: null,
        resumeAt: null,
      },
    });
    return NextResponse.json(bundle);
  }

  // Default: suspend
  const bundle = await prisma.bundle.update({
    where: { id },
    data: {
      suspendedAt: new Date(),
      resumeAt: body.resumeAt ? new Date(body.resumeAt) : null,
    },
  });

  return NextResponse.json(bundle);
}
