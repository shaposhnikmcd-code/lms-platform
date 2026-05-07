import { NextRequest, NextResponse } from 'next/server';
import { isAdmin, getAdminActor } from '@/lib/adminAuth';
import { undismissIssue, ISSUE_KIND_VALUES, type IssueKind } from '@/lib/yearlyProgramIssues';

/// POST /api/admin/yearly-program/issues/undismiss
/// Body: { subscriptionId: string, kind: IssueKind }
///
/// Знімає заглушення (видаляє dismissal-запис). Issue одразу повертається в активні.
/// Корисно якщо менеджер передумав, або помилково заглушив.
export async function POST(req: NextRequest) {
  if (!(await isAdmin(req))) {
    return NextResponse.json({ error: 'Немає доступу' }, { status: 403 });
  }
  const body = (await req.json().catch(() => ({}))) as {
    subscriptionId?: string;
    kind?: string;
  };
  if (!body.subscriptionId || !body.kind) {
    return NextResponse.json({ error: 'subscriptionId і kind обов\'язкові' }, { status: 400 });
  }
  if (!ISSUE_KIND_VALUES.includes(body.kind as IssueKind)) {
    return NextResponse.json({ error: `Невідомий kind: ${body.kind}` }, { status: 400 });
  }
  const actor = await getAdminActor(req);
  const undismissedBy = actor?.email ?? actor?.name ?? 'admin';

  await undismissIssue({
    subscriptionId: body.subscriptionId,
    kind: body.kind as IssueKind,
    undismissedBy,
  });

  return NextResponse.json({ ok: true });
}
