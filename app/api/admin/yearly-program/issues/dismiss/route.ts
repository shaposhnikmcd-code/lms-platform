import { NextRequest, NextResponse } from 'next/server';
import { isAdmin, getAdminActor } from '@/lib/adminAuth';
import { dismissIssue, ISSUE_KIND_VALUES, type IssueKind } from '@/lib/yearlyProgramIssues';

/// POST /api/admin/yearly-program/issues/dismiss
/// Body: { subscriptionId: string, kind: IssueKind, reason?: string }
///
/// Заглушує issue. Idempotent: повторний виклик з тими ж (subId, kind) оновлює
/// `dismissedBy`/`reason`/`dismissedAt`. Issue знову стане активним, якщо для цієї
/// пари виникне нова failure-подія після поточного `dismissedAt` (collector
/// порівнює timestamp-и автоматично).
export async function POST(req: NextRequest) {
  if (!(await isAdmin(req))) {
    return NextResponse.json({ error: 'Немає доступу' }, { status: 403 });
  }
  const body = (await req.json().catch(() => ({}))) as {
    subscriptionId?: string;
    kind?: string;
    reason?: string;
  };
  if (!body.subscriptionId || !body.kind) {
    return NextResponse.json({ error: 'subscriptionId і kind обов\'язкові' }, { status: 400 });
  }
  if (!ISSUE_KIND_VALUES.includes(body.kind as IssueKind)) {
    return NextResponse.json({ error: `Невідомий kind: ${body.kind}` }, { status: 400 });
  }
  const actor = await getAdminActor(req);
  const dismissedBy = actor?.email ?? actor?.name ?? 'admin';

  await dismissIssue({
    subscriptionId: body.subscriptionId,
    kind: body.kind as IssueKind,
    dismissedBy,
    reason: body.reason ?? null,
  });

  return NextResponse.json({ ok: true });
}
