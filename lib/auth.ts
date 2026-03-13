// lib/auth.ts
import GoogleProvider from "next-auth/providers/google";
import FacebookProvider from "next-auth/providers/facebook";
import AppleProvider from "next-auth/providers/apple";
import CredentialsProvider from "next-auth/providers/credentials";
import type { NextAuthOptions } from "next-auth";
import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";

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
        console.log('📧 Authorize called with:', { 
          email: credentials?.email, 
          password: credentials?.password ? '***' : 'missing' 
        });
        
        if (!credentials?.email || !credentials?.password) {
          console.log('❌ Missing credentials');
          return null;
        }

        // Спочатку перевіряємо тестового користувача (для зручності)
        if (credentials.email === "test@test.com" && credentials.password === "123456") {
          console.log('✅ Test user login');
          return {
            id: "1",
            email: "test@test.com",
            name: "Тестовий користувач"
          };
        }

        try {
          // Шукаємо користувача в базі даних
          const user = await prisma.user.findUnique({
            where: { email: credentials.email }
          });

          if (!user || !user.password) {
            console.log('❌ User not found or no password');
            return null;
          }

          // Перевіряємо пароль
          const isValid = await bcrypt.compare(credentials.password, user.password);

          if (!isValid) {
            console.log('❌ Invalid password');
            return null;
          }

          console.log('✅ Login successful:', user.email);
          return {
            id: user.id,
            email: user.email,
            name: user.name,
            image: user.image,
          };
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
    async jwt({ token, user, account }) {
      console.log('📝 JWT:', { 
        hasToken: !!token, 
        hasUser: !!user,
        hasAccount: !!account,
        userEmail: user?.email 
      });
      if (user) {
        token.id = user.id;
        token.email = user.email;
        token.name = user.name;
        token.picture = user.image;
      }
      return token;
    },
    async session({ session, token }) {
      console.log('🔑 Session:', { 
        hasSession: !!session,
        hasToken: !!token,
        tokenEmail: token?.email 
      });
      if (session.user) {
        session.user.id = token.id as string;
        session.user.email = token.email as string;
        session.user.name = token.name as string;
        session.user.image = token.picture as string | null;
      }
      return session;
    },
    async signIn({ user, account, profile }) {
      console.log('🚪 SignIn:', { 
        userEmail: user?.email,
        provider: account?.provider,
        hasProfile: !!profile
      });
      return true;
    },
    async redirect({ url, baseUrl }) {
      console.log('🔄 Redirect:', { url, baseUrl });
      return url.startsWith("/") ? `${baseUrl}${url}` : url;
    }
  },
  pages: {
    signIn: '/',
    error: '/auth/error',
  },
  debug: true,
  secret: process.env.NEXTAUTH_SECRET,
};