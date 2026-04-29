import { NextResponse } from "next/server";

/// Публічна самореєстрація вимкнена. Платформа доступна лише ADMIN/MANAGER,
/// яких створює адмін через /dashboard/admin/users.
export async function POST() {
  return NextResponse.json(
    { message: "Реєстрація недоступна" },
    { status: 410 }
  );
}
