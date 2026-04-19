import GoogleProvider from "next-auth/providers/google";
import FacebookProvider from "next-auth/providers/facebook";
import AppleProvider from "next-auth/providers/apple";
import CredentialsProvider from "next-auth/providers/credentials";
import type { NextAuthOptions } from "next-auth";
import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";
import { checkRateLimitRaw } from "@/lib/ratelimit";

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || "").split(",").map(e => e.trim()).filter(Boolean);

const MANAGER_EMAILS = (process.env.MANAGER_EMAILS || "").split(",").map(e => e.trim()).filter(Boolean);

const getRole = (email: string) => {
  if (ADMIN_EMAILS.includes(email)) return "ADMIN";
  if (MANAGER_EMAILS.includes(email)) return "MANAGER";
  return "STUDENT";
};

const ROLE_HIERARCHY: Record<string, string[]> = {
  ADMIN: ["ADMIN", "MANAGER", "TEACHER", "STUDENT"],
  MANAGER: ["MANAGER", "STUDENT"],
  TEACHER: ["TEACHER", "STUDENT"],
  STUDENT: ["STUDENT"],
};

export const getAllowedRoles = (role: string): string[] => {
  return ROLE_HIERARCHY[role] ?? ["STUDENT"];
};

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
    FacebookProvider({
      clientId: process.env.FACEBOOK_CLIENT_ID || "",
      clientSecret: process.env.FACEBOOK_CLIENT_SECRET || "",
      authorization: {
        params: {
          scope: "public_profile",
        },
      },
      userinfo: {
        url: "https://graph.facebook.com/me?fields=id,name,email,picture",
      },
      profile(profile) {
        return {
          id: profile.id,
          name: profile.name,
          email: profile.email,
          image: profile.picture?.data?.url,
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
          if (!user || !user.password) return null;
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
    maxAge: 30 * 24 * 60 * 60,
  },
  jwt: {
    maxAge: 30 * 24 * 60 * 60,
  },
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id;
        token.email = user.email;
        token.name = user.name;
        token.picture = user.image;
        token.role = user.role || (user.email ? getRole(user.email) : "STUDENT");
        token.activeRole = token.role;
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
      if (account?.provider !== "credentials") {
        try {
          const existingUser = await prisma.user.findUnique({ where: { email: user.email! } });
          if (!existingUser) {
            await prisma.user.create({
              data: {
                email: user.email!,
                name: user.name,
                image: user.image,
                role: getRole(user.email!) as any,
                lastLoginAt: new Date(),
              }
            });
          } else {
            await prisma.user.update({
              where: { email: user.email! },
              data: {
                name: user.name,
                image: user.image,
                lastLoginAt: new Date(),
              }
            });
          }
        } catch (error) {
          console.error('❌ Error syncing user:', error);
        }
      }
      return true;
    },
    async redirect({ url, baseUrl }) {
      if (url === baseUrl) return `${baseUrl}/dashboard`;
      return url.startsWith("/") ? `${baseUrl}${url}` : url;
    }
  },
  pages: {
    signIn: '/',
    error: '/auth/error',
  },
  debug: process.env.NODE_ENV === "development",
  secret: process.env.NEXTAUTH_SECRET,
};