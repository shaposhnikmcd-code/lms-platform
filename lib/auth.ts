// lib/auth.ts
import GoogleProvider from "next-auth/providers/google";
import FacebookProvider from "next-auth/providers/facebook";
import AppleProvider from "next-auth/providers/apple";
import CredentialsProvider from "next-auth/providers/credentials";
import type { NextAuthOptions } from "next-auth";
import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";
console.log('🔧 NEXTAUTH_URL:', process.env.NEXTAUTH_URL);

// Список адмінів
const ADMIN_EMAILS = [
  "shaposhnik.mcd@gmail.com",
  "saposniktana878@gmail.com"
];

// Список менеджерів
const MANAGER_EMAILS = [
  "Polandemigrants@gmail.com"
];

const getRole = (email: string) => {
  if (ADMIN_EMAILS.includes(email)) return "ADMIN";
  if (MANAGER_EMAILS.includes(email)) return "MANAGER";
  return "STUDENT";
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
        console.log('📧 Authorize called with:', { 
          email: credentials?.email, 
          password: credentials?.password ? '***' : 'missing' 
        });
        
        if (!credentials?.email || !credentials?.password) {
          console.log('❌ Missing credentials');
          return null;
        }

        // Тестовий студент
        if (credentials.email === "student@test.com" && credentials.password === "123456") {
          console.log('✅ Test student login');
          return {
            id: "test-student-1",
            email: "student@test.com",
            name: "Тестовий студент",
            role: "STUDENT"
          };
        }

        // Тестовий викладач — беремо реальний id з БД
        if (credentials.email === "teacher@test.com" && credentials.password === "123456") {
          console.log('✅ Test teacher login');
          const teacherUser = await prisma.user.findUnique({
            where: { email: "teacher@test.com" }
          });
          if (teacherUser) {
            return {
              id: teacherUser.id,
              email: teacherUser.email,
              name: teacherUser.name || "Тестовий викладач",
              role: "TEACHER"
            };
          }
        }

        try {
          const user = await prisma.user.findUnique({
            where: { email: credentials.email }
          });

          if (!user || !user.password) {
            console.log('❌ User not found or no password');
            return null;
          }

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
            role: user.role
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
        token.role = user.role || (user.email ? getRole(user.email) : "STUDENT");
        console.log('👤 User role set:', token.role);
      }
      
      return token;
    },
    async session({ session, token }) {
      console.log('🔑 Session:', { 
        hasSession: !!session,
        hasToken: !!token,
        tokenEmail: token?.email,
        tokenRole: token?.role
      });
      
      if (session.user) {
        session.user.id = token.id as string;
        session.user.email = token.email as string;
        session.user.name = token.name as string;
        session.user.image = token.picture as string | null;
        session.user.role = token.role as string;
      }
      
      return session;
    },
    async signIn({ user, account, profile }) {
      console.log('🚪 SignIn:', { 
        userEmail: user?.email,
        provider: account?.provider,
        hasProfile: !!profile
      });
      
      if (account?.provider !== "credentials") {
        try {
          const existingUser = await prisma.user.findUnique({
            where: { email: user.email! }
          });
          
          if (!existingUser) {
            await prisma.user.create({
              data: {
                email: user.email!,
                name: user.name,
                image: user.image,
                role: getRole(user.email!) as any
              }
            });
            console.log('✅ New user created via OAuth');
          } else {
            await prisma.user.update({
              where: { email: user.email! },
              data: {
                name: user.name,
                image: user.image
              }
            });
            console.log('✅ Existing user updated via OAuth');
          }
        } catch (error) {
          console.error('❌ Error syncing user:', error);
        }
      }
      
      return true;
    },
    async redirect({ url, baseUrl }) {
      console.log('🔄 Redirect:', { url, baseUrl });
      
      if (url === baseUrl) {
        return `${baseUrl}/dashboard`;
      }
      
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