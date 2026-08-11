import GoogleProvider from "next-auth/providers/google";
import AppleProvider from "next-auth/providers/apple";
import CredentialsProvider from "next-auth/providers/credentials";
import type { NextAuthOptions } from "next-auth";
import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";
import { checkRateLimitRaw } from "@/lib/ratelimit";
import { validatePasswordFull } from "@/lib/passwordPolicy";

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || "").split(",").map(e => e.trim()).filter(Boolean);

const MANAGER_EMAILS = (process.env.MANAGER_EMAILS || "").split(",").map(e => e.trim()).filter(Boolean);

/// Платформа доступна лише ADMIN/MANAGER. STUDENT/TEACHER — legacy enum-значення:
/// нікому новому не присвоюються, login для них заблокований у signIn / authorize.
const getRole = (email: string): "ADMIN" | "MANAGER" | null => {
  if (ADMIN_EMAILS.includes(email)) return "ADMIN";
  if (MANAGER_EMAILS.includes(email)) return "MANAGER";
  return null;
};

const ROLE_HIERARCHY: Record<string, string[]> = {
  ADMIN: ["ADMIN", "MANAGER"],
  MANAGER: ["MANAGER"],
};

export const getAllowedRoles = (role: string): string[] => {
  return ROLE_HIERARCHY[role] ?? [];
};

/// Як часто перезчитувати роль/deletedAt з БД у jwt-callback. JWT сам по собі
/// незмінний до кінця свого строку життя, тож без цієї звірки понижений або
/// видалений адмін тримав би доступ до адмінки всі 7 днів. 60с — компроміс між
/// свіжістю прав і навантаженням на БД (один SELECT на юзера раз на хвилину).
const ROLE_REVALIDATE_MS = 60_000;

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
      authorization: {
        params: {
          prompt: "consent",
          access_type: "offline",
          response_type: "code"
        }
      }
    }),
    AppleProvider({
      clientId: process.env.APPLE_CLIENT_ID || "",
      clientSecret: process.env.APPLE_CLIENT_SECRET || "",
    }),
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        // Rate limit за email — обмежує брутфорс паролів на конкретний акаунт.
        // IP-based ліміт тут зробити складно (NextAuth не передає req у authorize),
        // але email-based + стандартний NextAuth CSRF + NEXTAUTH_SECRET дають
        // достатній захист.
        const normalizedEmail = credentials.email.toLowerCase().trim();
        const { success } = await checkRateLimitRaw('login', `email:${normalizedEmail}`);
        if (!success) {
          console.warn('🚫 Login rate limit exceeded for:', normalizedEmail);
          return null;
        }

        try {
          const user = await prisma.user.findUnique({ where: { email: credentials.email } });
          if (!user) return null;
          if (user.deletedAt) return null;
          // Платформа лише для ADMIN/MANAGER. STUDENT/TEACHER (legacy) — login blocked.
          if (user.role !== "ADMIN" && user.role !== "MANAGER") return null;

          // First-login password claim — спрацьовує ТІЛЬКИ якщо акаунт щойно створений
          // адміном і ніхто ще нічим його не торкався:
          //   - password === null (не було самореєстрації через /register)
          //   - lastLoginAt === null (не заходив ні через Credentials, ні через OAuth —
          //     OAuth-флоу в signIn-callback завжди ставить lastLoginAt)
          // Перший успішний логін фіксує введений пароль як постійний. Атомарно
          // через updateMany(where: { password: null, lastLoginAt: null }) — якщо
          // паралельний запит встигне раніше, у нас count=0 і ми відмовляємо.
          if (!user.password && !user.lastLoginAt) {
            const policy = await validatePasswordFull(credentials.password);
            if (!policy.ok) return null;

            const hashed = await bcrypt.hash(credentials.password, 12);
            const claimed = await prisma.user.updateMany({
              where: { id: user.id, password: null, lastLoginAt: null, deletedAt: null },
              data: { password: hashed, lastLoginAt: new Date() },
            });
            if (claimed.count !== 1) return null;

            return { id: user.id, email: user.email, name: user.name, image: user.image, role: user.role };
          }

          // Звичайний флоу: OAuth-only юзер (password=null, але lastLoginAt є) —
          // credentials-логін недоступний. Потрібно `/forgot-password` щоб додати пароль.
          if (!user.password) return null;

          const isValid = await bcrypt.compare(credentials.password, user.password);
          if (!isValid) return null;
          await prisma.user.update({
            where: { id: user.id },
            data: { lastLoginAt: new Date() },
          });
          return { id: user.id, email: user.email, name: user.name, image: user.image, role: user.role };
        } catch (error) {
          console.error('❌ Database error:', error);
          return null;
        }
      }
    })
  ],
  session: {
    strategy: "jwt",
    maxAge: 7 * 24 * 60 * 60,
  },
  jwt: {
    maxAge: 7 * 24 * 60 * 60,
  },
  // Унікальні назви cookie з префіксом `uimp.` — щоб на localhost не конфліктувати
  // з іншими NextAuth-проєктами (tetyana-website:3001, cleartax). Браузер ділить
  // cookies між портами одного хоста; з дефолтним `next-auth.session-token` сусідні
  // проєкти не могли розшифрувати наш JWT своїм секретом і видаляли cookie як
  // invalid → нас викидало з admin-кабінету після переходу на ті сайти.
  cookies: {
    sessionToken: {
      name: process.env.NODE_ENV === "production" ? "__Secure-uimp.session-token" : "uimp.session-token",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
      },
    },
    callbackUrl: {
      name: process.env.NODE_ENV === "production" ? "__Secure-uimp.callback-url" : "uimp.callback-url",
      options: {
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
      },
    },
    csrfToken: {
      name: process.env.NODE_ENV === "production" ? "__Host-uimp.csrf-token" : "uimp.csrf-token",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
      },
    },
  },
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id;
        token.email = user.email;
        token.name = user.name;
        token.picture = user.image;
        token.role = user.role;
        token.activeRole = token.role;
        token.revoked = undefined;
        token.roleCheckedAt = token.role ? Date.now() : 0;
      }

      // Звірка токена з БД. Покриває два випадки:
      //   1) hydrate — токен без ролі (OAuth-флоу не передає role через user-об'єкт,
      //      або старий JWT створено до додавання поля);
      //   2) revalidation — роль могли понизити чи юзера видалити вже після видачі
      //      токена, тож раз на ROLE_REVALIDATE_MS перечитуємо стан з БД.
      const lastChecked = typeof token.roleCheckedAt === "number" ? token.roleCheckedAt : 0;
      const isStale = Date.now() - lastChecked > ROLE_REVALIDATE_MS;
      if (token.email && (isStale || (!token.role && !token.revoked))) {
        try {
          const dbUser = await prisma.user.findUnique({
            where: { email: token.email as string },
            select: { id: true, role: true, deletedAt: true },
          });
          token.roleCheckedAt = Date.now();
          if (!dbUser || dbUser.deletedAt || (dbUser.role !== "ADMIN" && dbUser.role !== "MANAGER")) {
            // Юзера видалили / понизили до legacy-ролі — токен більше не дає доступу.
            token.revoked = true;
            token.role = undefined;
            token.activeRole = undefined;
          } else {
            token.revoked = undefined;
            token.id = dbUser.id;
            if (dbUser.role !== token.role) {
              token.role = dbUser.role;
              token.activeRole = dbUser.role;
            }
          }
        } catch (error) {
          // БД тимчасово недоступна — не викидаємо всіх залогінених, лишаємо
          // токен як є і пробуємо звірку на наступному запиті (roleCheckedAt не оновлено).
          console.error("❌ JWT role revalidation failed:", error);
        }
      }

      if (trigger === "update" && session?.activeRole) {
        const allowedRoles = getAllowedRoles(token.role as string);
        if (allowedRoles.includes(session.activeRole)) {
          token.activeRole = session.activeRole;
        }
      }
      return token;
    },
    async session({ session, token }) {
      // Токен відкликано у jwt-callback (юзера видалили або понизили роль) —
      // віддаємо сесію без user, усі гарди (`if (!session?.user) redirect`) її відсіють.
      if (token.revoked) {
        return { ...session, user: undefined, expires: new Date(0).toISOString() } as unknown as typeof session;
      }
      if (session.user) {
        session.user.id = token.id as string;
        session.user.email = token.email as string;
        session.user.name = token.name as string;
        session.user.image = token.picture as string | null;
        session.user.role = token.role as string;
        session.user.activeRole = (token.activeRole as string) ?? (token.role as string);
      }
      return session;
    },
    async signIn({ user, account }) {
      if (account?.provider === "credentials") return true;

      const email = user.email?.toLowerCase();
      if (!email) return false;

      try {
        const existingUser = await prisma.user.findUnique({ where: { email } });

        // Існуючий юзер — пускаємо за роллю в БД (адмін міг призначити через адмінку,
        // env-whitelist не обов'язковий).
        if (existingUser) {
          if (existingUser.deletedAt) return false;
          if (existingUser.role !== "ADMIN" && existingUser.role !== "MANAGER") return false;
          await prisma.user.update({
            where: { email },
            data: {
              name: user.name,
              image: user.image,
              lastLoginAt: new Date(),
            },
          });
          return true;
        }

        // Новий юзер (немає в БД) — авто-створюємо лише якщо email у env-whitelist
        // (bootstrap для перших адмінів, у яких ще немає User-рядка).
        const allowedRole = getRole(email);
        if (!allowedRole) return false;

        const created = await prisma.user.create({
          data: {
            email,
            name: user.name,
            image: user.image,
            role: allowedRole,
            lastLoginAt: new Date(),
          },
        });
        await prisma.userAuditLog.create({
          data: {
            userId: created.id,
            eventType: 'CREATED',
            targetName: created.name,
            targetEmail: created.email,
            targetRole: created.role,
            actorId: null,
            actorName: 'System (OAuth первинний логін)',
            actorEmail: null,
          },
        });
      } catch (error) {
        console.error('❌ Error syncing user:', error);
        return false;
      }
      return true;
    },
    async redirect({ url, baseUrl }) {
      if (url.startsWith("/")) return `${baseUrl}${url}`;
      if (url.startsWith(baseUrl)) return url;
      return baseUrl;
    }
  },
  pages: {
    signIn: '/',
    error: '/auth/error',
  },
  debug: process.env.NODE_ENV === "development",
  secret: process.env.NEXTAUTH_SECRET,
};