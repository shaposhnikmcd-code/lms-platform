'use client';

import { useState, useEffect } from 'react';
import { useRouter } from '@/i18n/navigation';
import { useSession } from 'next-auth/react';
import AuthModal from '@/components/_components/AuthModal';

export default function LoginPage() {
  const [isOpen, setIsOpen] = useState(true);
  const router = useRouter();
  const { data: session } = useSession();

  useEffect(() => {
    if (session?.user) {
      router.replace('/dashboard');
    }
  }, [session, router]);

  const handleClose = () => {
    setIsOpen(false);
    router.replace('/');
  };

  return (
    <AuthModal isOpen={isOpen} onClose={handleClose} />
  );
}