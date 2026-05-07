import { NextRequest, NextResponse } from 'next/server';
import { isAdmin } from '@/lib/adminAuth';
import { collectAllIssues } from '@/lib/yearlyProgramIssues';

/// GET /api/admin/yearly-program/issues
///
/// Повертає всі активні та заглушені issue-и Річної програми. Не має параметрів —
/// фільтрація (kind / план / cohort) виконується на клієнті, бо payload малий
/// (~ десятки рядків) і потрібно одночасно рахувати total для toolbar-badge.
///
/// Відповідь: { active: IssueRecord[], dismissed: IssueRecord[],
///              activeCounts: Record<IssueKind, number>, activeTotal: number }
export async function GET(req: NextRequest) {
  if (!(await isAdmin(req))) {
    return NextResponse.json({ error: 'Немає доступу' }, { status: 403 });
  }
  const payload = await collectAllIssues();
  return NextResponse.json(payload);
}
