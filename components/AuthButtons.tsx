"use client";

import { useSession, signIn, signOut } from "next-auth/react";
import Link from "next/link";

export default function AuthButtons() {
  const { data: session } = useSession();

  if (session) {
    return (
      <div className="flex items-center gap-4">
        <span className="text-sm text-[#1C3A2E]">
          {session.user?.email}
        </span>
        <button
          onClick={() => signOut()}
          className="bg-[#1C3A2E] text-white px-4 py-2 rounded-lg text-sm hover:bg-opacity-90 transition-all"
        >
          Вийти
        </button>
      </div>
    );
  }

  return (
    <div className="flex gap-2">
      <Link
        href="/login"
        className="text-[#1C3A2E] hover:text-[#D4A843] px-3 py-2"
      >
        Увійти
      </Link>
      <Link
        href="/register"
        className="bg-[#D4A843] text-[#1C3A2E] px-4 py-2 rounded-lg text-sm hover:bg-opacity-90 transition-all"
      >
        Реєстрація
      </Link>
    </div>
  );
}