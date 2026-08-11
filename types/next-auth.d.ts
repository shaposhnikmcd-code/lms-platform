import "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name?: string | null;
      image?: string | null;
      role: string;
      activeRole: string;
    };
  }

  interface User {
    id: string;
    email: string;
    name?: string | null;
    image?: string | null;
    role?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: string;
    activeRole?: string;
    /// Timestamp (ms) останньої звірки ролі/deletedAt з БД — див. ROLE_REVALIDATE_MS.
    roleCheckedAt?: number;
    /// true — юзера видалили або понизили; сесія віддається без `user`.
    revoked?: boolean;
  }
}