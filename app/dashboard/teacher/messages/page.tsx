export const dynamic = 'force-dynamic';
import { Suspense } from 'react';
import TeacherMessages from './_components/TeacherMessagesClient';

export default function TeacherMessagesPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#D4A017]" /></div>}>
      <TeacherMessages />
    </Suspense>
  );
}