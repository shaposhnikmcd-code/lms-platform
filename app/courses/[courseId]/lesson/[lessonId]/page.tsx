'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { FaCheck, FaLock } from 'react-icons/fa';

interface Lesson {
  id: string;
  title: string;
  order: number;
  videoUrl: string | null;
  videoProvider: string;
  videoId: string | null;
  duration: number | null;
  isFree: boolean;
  module: {
    id: string;
    title: string;
    course: {
      id: string;
      title: string;
    };
  };
}

interface LessonProgress {
  watchedAt: number;
  completed: boolean;
}

export default function LessonPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const courseId = params.courseId as string;
  const lessonId = params.lessonId as string;

  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [progress, setProgress] = useState<LessonProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/');
  }, [status]);

  useEffect(() => {
    if (status === 'authenticated') {
      fetchLesson();
      fetchProgress();
      checkAccess();
    }
  }, [status, lessonId]);

  const fetchLesson = async () => {
    try {
      const res = await fetch(`/api/lessons/${lessonId}`);
      const data = await res.json();
      setLesson(data.lesson);
    } catch (error) {
      console.error('Помилка завантаження уроку:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchProgress = async () => {
    try {
      const res = await fetch(`/api/lesson-progress?lessonId=${lessonId}`);
      const data = await res.json();
      if (data.progress) {
        setProgress(data.progress);
        setCompleted(data.progress.completed);
      }
    } catch (error) {
      console.error('Помилка завантаження прогресу:', error);
    }
  };

  const checkAccess = async () => {
    try {
      const res = await fetch(`/api/courses/${courseId}/access`);
      const data = await res.json();
      setHasAccess(data.hasAccess);
    } catch (error) {
      console.error('Помилка перевірки доступу:', error);
    }
  };

  const markCompleted = async () => {
    setSaving(true);
    try {
      await fetch('/api/lesson-progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lessonId, completed: true, watchedAt: 0 }),
      });
      setCompleted(true);
    } catch (error) {
      console.error('Помилка збереження прогресу:', error);
    } finally {
      setSaving(false);
    }
  };

  const getVideoEmbed = (lesson: Lesson) => {
    if (!lesson.videoUrl && !lesson.videoId) return null;

    if (lesson.videoProvider === 'YOUTUBE' && lesson.videoId) {
      return (
        <iframe
          className="w-full aspect-video rounded-xl"
          src={`https://www.youtube.com/embed/${lesson.videoId}?rel=0&modestbranding=1`}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      );
    }

    if (lesson.videoProvider === 'SENDPULSE' && lesson.videoUrl) {
      return (
        <iframe
          className="w-full aspect-video rounded-xl"
          src={lesson.videoUrl}
          allow="autoplay; fullscreen"
          allowFullScreen
        />
      );
    }

    if (lesson.videoUrl) {
      return (
        <video
          className="w-full aspect-video rounded-xl bg-black"
          controls
          controlsList="nodownload"
          src={lesson.videoUrl}
        />
      );
    }

    return null;
  };

  if (loading || status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#D4A017]"></div>
      </div>
    );
  }

  if (!lesson) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Урок не знайдено</p>
      </div>
    );
  }

  if (!hasAccess && !lesson.isFree) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-lg p-10 max-w-md w-full text-center">
          <FaLock className="text-5xl text-gray-300 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-[#1C3A2E] mb-3">Доступ закрито</h2>
          <p className="text-gray-500 mb-6">Щоб переглянути цей урок, потрібно придбати курс</p>
          <Link
            href={`/courses/${courseId}`}
            className="inline-block bg-[#D4A017] text-white font-bold py-3 px-8 rounded-xl hover:bg-[#b88913] transition-colors"
          >
            Купити курс
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 py-8">

        {/* Хлібні крихти */}
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-6">
          <Link href="/dashboard/student/my-courses" className="hover:text-[#1C3A2E] transition-colors">
            Мої курси
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
          {getVideoEmbed(lesson) || (
            <div className="w-full aspect-video flex items-center justify-center bg-gray-900">
              <p className="text-gray-400">Відео недоступне</p>
            </div>
          )}
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