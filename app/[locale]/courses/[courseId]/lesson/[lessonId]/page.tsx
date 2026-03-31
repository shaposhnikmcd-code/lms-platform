'use client';

import { useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { FaCheck } from 'react-icons/fa';
import { useLesson } from './_hooks/useLesson';
import AccessDenied from './_components/AccessDenied';

// Відео — lazy, не вантажиться поки не потрібне
const VideoPlayer = dynamic(() => import('./_components/VideoPlayer'), { ssr: false });

export default function LessonPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const courseId = params.courseId as string;
  const lessonId = params.lessonId as string;

  const { lesson, loading, hasAccess, completed, saving, markCompleted } = useLesson(courseId, lessonId);

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/');
  }, [status]);

  if (loading || status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#D4A017]" />
      </div>
    );
  }

  if (!lesson) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">{"Урок не знайдено"}</p>
      </div>
    );
  }

  if (!hasAccess && !lesson.isFree) {
    return <AccessDenied courseId={courseId} />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 py-8">

        {/* Хлібні крихти */}
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-6">
          <Link href="/dashboard/student/my-courses" className="hover:text-[#1C3A2E] transition-colors">
            {"Мої курси"}
          </Link>
          <span>/</span>
          <Link href={`/courses/${courseId}`} className="hover:text-[#1C3A2E] transition-colors">
            {lesson.module.course.title}
          </Link>
          <span>/</span>
          <span className="text-[#1C3A2E] font-medium">{lesson.title}</span>
        </div>

        {/* Відео */}
        <div className="bg-black rounded-xl overflow-hidden mb-6 shadow-lg">
          <VideoPlayer
            videoUrl={lesson.videoUrl}
            videoProvider={lesson.videoProvider}
            videoId={lesson.videoId}
          />
        </div>

        {/* Інфо про урок */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm text-gray-500 mb-1">{lesson.module.title}</p>
              <h1 className="text-2xl font-bold text-[#1C3A2E]">{lesson.title}</h1>
            </div>
            <button
              onClick={markCompleted}
              disabled={completed || saving}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium text-sm transition-colors flex-shrink-0 ${
                completed
                  ? 'bg-green-100 text-green-700 cursor-default'
                  : 'bg-[#D4A017] text-white hover:bg-[#b88913]'
              } disabled:opacity-50`}
            >
              <FaCheck />
              {completed ? 'Завершено' : saving ? 'Збереження...' : 'Позначити як завершений'}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}