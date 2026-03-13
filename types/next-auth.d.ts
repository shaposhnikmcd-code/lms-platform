import "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name?: string | null;
      image?: string | null;
      role: string;  // Додаємо роль
    };
  }

  interface User {
    id: string;
    email: string;
    name?: string | null;
    image?: string | null;
    role?: string;  // Додаємо роль
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: string;  // Додаємо роль в JWT
  }
}