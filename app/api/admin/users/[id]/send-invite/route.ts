/// DEPRECATED — invite-лист при створенні юзера скасовано на користь
/// first-login password claim (див. lib/auth.ts::authorize).
/// Файл лишений stub-ом, щоб випадково викликаний ендпоінт явно повертав 410.
/// TODO: видалити директорію `app/api/admin/users/[id]/send-invite/` вручну (`rm -rf`).

import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json(
    { error: 'Ендпоінт скасовано. Юзер сам задасть пароль при першому вході.' },
    { status: 410 },
  );
}
