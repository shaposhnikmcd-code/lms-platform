/// Користувачі з ролями ADMIN/MANAGER оплачують через WFP за символічною ціною
/// 1 ₴ (курс/пакет) або 2 ₴ (річна програма) — див. правило в [app/api/wayforpay/route.ts]
/// та CLAUDE.md секція "Admin/Manager test price". Такі enrollment-и/підписки не повинні
/// потрапляти в кандидати на сертифікат: ні в адмінку (ручна видача), ні в cron (авто-видача).
///
/// Фільтр за роллю — єдине джерело правди (а не за amount), бо:
///  • покриває прямі курси, пакети (де Payment.bundleId, не courseId) і річну в один спосіб;
///  • не залежить від конфіга цін;
///  • детермінований (рядок enum, не сума, яка може збігтися з реальною знижкою).

import { UserRole } from '@prisma/client';

export const TEST_PURCHASE_ROLES: UserRole[] = [UserRole.ADMIN, UserRole.MANAGER];
