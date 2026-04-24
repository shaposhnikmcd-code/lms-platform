'use client';

import { useState, useEffect } from 'react';
import { useRouter as useIntlRouter } from '@/i18n/navigation';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import AuthModal from '@/components/_components/AuthModal';

export default function LoginPage() {
  const [isOpen, setIsOpen] = useState(true);
  const intlRouter = useIntlRouter();
  const router = useRouter();
  const { data: session } = useSession();

  useEffect(() => {
    if (session?.user) {
      // /dashboard — поза [locale], тому використовуємо нативний next/navigation router.
      router.replace('/dashboard');
    }
  }, [session, router]);

  const handleClose = () => {
    setIsOpen(false);
    intlRouter.replace('/');
  };

  return (
    <AuthModal isOpen={isOpen} onClose={handleClose} />
  );
}