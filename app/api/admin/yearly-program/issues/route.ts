import { NextRequest, NextResponse } from 'next/server';
import { isAdmin } from '@/lib/adminAuth';
import { collectAllIssues } from '@/lib/yearlyProgramIssues';

/// GET /api/admin/yearly-program/issues?cohortId=<id|all|none>
///
/// Повертає активні та заглушені issue-и Річної програми. Набір фільтрується на СЕРВЕРІ
/// (`cohortId`), бо без нього у вкладку падають підписки всіх років одночасно — саме це
/// і робило її нечитабельною. `cohortId` відсутній або `all` → усі набори;
/// `none` → лише підписки без набору (їх не видно в жодному наборі, а серед них бувають
/// списання по закритих підписках).
/// Решта фільтрів (тип / план) лишаються клієнтськими: payload уже звужений, а
/// лічильники по типах потрібні одразу всі.
///
/// Відповідь: { active: IssueRecord[], dismissed: IssueRecord[],
///              activeCounts: Record<IssueKind, number>, activeTotal: number }
export async function GET(req: NextRequest) {
  if (!(await isAdmin(req))) {
    return NextResponse.json({ error: 'Немає доступу' }, { status: 403 });
  }
  const raw = req.nextUrl.searchParams.get('cohortId');
  const cohortId = raw && raw !== 'all' ? raw : null;
  const payload = await collectAllIssues({ cohortId });
  return NextResponse.json(payload);
}
