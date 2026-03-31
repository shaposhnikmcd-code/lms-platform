import { useState, useEffect } from 'react';

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

interface UseLessonResult {
  lesson: Lesson | null;
  loading: boolean;
  hasAccess: boolean;
  completed: boolean;
  saving: boolean;
  markCompleted: () => Promise<void>;
}

export function useLesson(courseId: string, lessonId: string): UseLessonResult {
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!lessonId || !courseId) return;

    const load = async () => {
      setLoading(true);
      try {
        const [lessonRes, progressRes, accessRes] = await Promise.all([
          fetch(`/api/lessons/${lessonId}`),
          fetch(`/api/lesson-progress?lessonId=${lessonId}`),
          fetch(`/api/courses/${courseId}/access`),
        ]);

        const [lessonData, progressData, accessData] = await Promise.all([
          lessonRes.json(),
          progressRes.json(),
          accessRes.json(),
        ]);

        setLesson(lessonData.lesson);
        setHasAccess(accessData.hasAccess);
        if (progressData.progress) {
          setCompleted(progressData.progress.completed);
        }
      } catch (error) {
        console.error('Помилка завантаження уроку:', error);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [lessonId, courseId]);

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

  return { lesson, loading, hasAccess, completed, saving, markCompleted };
}