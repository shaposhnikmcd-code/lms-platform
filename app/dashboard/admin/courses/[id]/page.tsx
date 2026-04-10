"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { FaChalkboardTeacher, FaTrash, FaPlus } from "react-icons/fa";

interface Teacher {
  id: string;
  name: string | null;
  email: string;
}

interface CourseTeacher {
  id: string;
  user: Teacher;
}

interface Course {
  id: string;
  title: string;
  courseTeachers: CourseTeacher[];
}

export default function AdminCourseManage() {
  const { id } = useParams();
  const router = useRouter();

  const [course, setCourse] = useState<Course | null>(null);
  const [allTeachers, setAllTeachers] = useState<Teacher[]>([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetchData();
  }, [id]);

  const fetchData = async () => {
    setLoading(true);
    const [courseRes, teachersRes] = await Promise.all([
      fetch(`/api/admin/courses/${id}/details`),
      fetch(`/api/admin/teachers`),
    ]);
    const courseData = await courseRes.json();
    const teachersData = await teachersRes.json();
    setCourse(courseData);
    setAllTeachers(teachersData);
    setLoading(false);
  };

  const addTeacher = async () => {
    if (!selectedUserId) return;
    setSaving(true);
    const res = await fetch(`/api/admin/courses/${id}/teachers`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: selectedUserId }),
    });
    if (res.ok) {
      setMessage("✅ Викладача додано");
      setSelectedUserId("");
      fetchData();
    } else {
      setMessage("❌ Помилка або вже призначено");
    }
    setSaving(false);
    setTimeout(() => setMessage(""), 3000);
  };

  const removeTeacher = async (userId: string) => {
    setSaving(true);
    await fetch(`/api/admin/courses/${id}/teachers`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });
    setMessage("✅ Викладача видалено");
    fetchData();
    setSaving(false);
    setTimeout(() => setMessage(""), 3000);
  };

  const assignedIds = course?.courseTeachers.map((ct) => ct.user.id) || [];
  const availableTeachers = allTeachers.filter((t) => !assignedIds.includes(t.id));

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-[#1C3A2E] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!course) {
    return <p className="text-red-500">Курс не знайдено</p>;
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-[#1C3A2E] mb-2">{course.title}</h1>
      <p className="text-sm text-gray-500 mb-8">Управління викладачами курсу</p>

      {message && (
        <div className="mb-4 px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700">
          {message}
        </div>
      )}

      {/* Поточні викладачі */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-6">
        <h2 className="text-lg font-semibold text-[#1C3A2E] mb-4 flex items-center gap-2">
          <FaChalkboardTeacher />
          Призначені викладачі
        </h2>

        {course.courseTeachers.length === 0 ? (
          <p className="text-gray-400 text-sm">Викладачів ще не призначено</p>
        ) : (
          <div className="space-y-3">
            {course.courseTeachers.map((ct) => (
              <div
                key={ct.id}
                className="flex items-center justify-between p-3 bg-[#E8F5E0] rounded-lg"
              >
                <div>
                  <p className="text-sm font-medium text-[#1C3A2E]">
                    {ct.user.name || "Без імені"}
                  </p>
                  <p className="text-xs text-gray-500">{ct.user.email}</p>
                </div>
                <button
                  onClick={() => removeTeacher(ct.user.id)}
                  disabled={saving}
                  className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <FaTrash className="text-sm" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Додати викладача */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-lg font-semibold text-[#1C3A2E] mb-4 flex items-center gap-2">
          <FaPlus />
          Додати викладача
        </h2>

        {availableTeachers.length === 0 ? (
          <p className="text-gray-400 text-sm">
            Всі викладачі вже призначені або немає користувачів з роллю TEACHER
          </p>
        ) : (
          <div className="flex gap-3">
            <select
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
              className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1C3A2E]/20"
            >
              <option value="">Оберіть викладача...</option>
              {availableTeachers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name || t.email} — {t.email}
                </option>
              ))}
            </select>
            <button
              onClick={addTeacher}
              disabled={!selectedUserId || saving}
              className="px-4 py-2 bg-[#1C3A2E] text-white text-sm rounded-lg hover:bg-[#1C3A2E]/80 transition-colors disabled:opacity-50"
            >
              Додати
            </button>
          </div>
        )}
      </div>
    </div>
  );
}