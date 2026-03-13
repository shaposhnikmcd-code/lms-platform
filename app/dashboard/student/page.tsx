import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import Link from "next/link";
import { FaBook, FaCertificate, FaCreditCard, FaCog } from "react-icons/fa";

export default async function StudentDashboard() {
  const session = await getServerSession(authOptions);

  // Тут потім буде запит до бази за курсами користувача
  const mockCourses = [
    { id: 1, title: "Психологія стосунків", progress: 45, lastLesson: "Основи комунікації" },
    { id: 2, title: "Самооцінка", progress: 70, lastLesson: "Як полюбити себе" },
  ];

  return (
    <div className="max-w-6xl mx-auto">
      {/* Вітання */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-[#1C3A2E]">
          Вітаємо, {session?.user?.name}!
        </h1>
        <p className="text-gray-600">Продовжуйте навчання</p>
      </div>

      {/* Continue Learning */}
      <div className="mb-12">
        <h2 className="text-xl font-semibold text-[#1C3A2E] mb-4">Продовжити навчання</h2>
        <div className="grid md:grid-cols-2 gap-6">
          {mockCourses.map((course) => (
            <div key={course.id} className="bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition">
              <h3 className="font-semibold text-lg mb-2">{course.title}</h3>
              <p className="text-sm text-gray-500 mb-3">Останнє: {course.lastLesson}</p>
              <div className="mb-3">
                <div className="flex justify-between text-sm mb-1">
                  <span>Прогрес</span>
                  <span>{course.progress}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-[#D4A017] h-2 rounded-full" 
                    style={{ width: `${course.progress}%` }}
                  />
                </div>
              </div>
              <Link 
                href={`/courses/${course.id}`}
                className="text-[#D4A017] hover:text-[#b88913] text-sm font-medium"
              >
                Продовжити →
              </Link>
            </div>
          ))}
        </div>
      </div>

      {/* Навігація по розділах */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Link href="/dashboard/student/my-courses" 
          className="bg-white p-6 rounded-xl shadow-sm hover:shadow-md transition text-center">
          <FaBook className="text-3xl text-[#1C3A2E] mx-auto mb-2" />
          <span className="font-medium">Мої курси</span>
        </Link>
        
        <Link href="/dashboard/student/certificates"
          className="bg-white p-6 rounded-xl shadow-sm hover:shadow-md transition text-center">
          <FaCertificate className="text-3xl text-[#1C3A2E] mx-auto mb-2" />
          <span className="font-medium">Сертифікати</span>
        </Link>
        
        <Link href="/dashboard/student/payments"
          className="bg-white p-6 rounded-xl shadow-sm hover:shadow-md transition text-center">
          <FaCreditCard className="text-3xl text-[#1C3A2E] mx-auto mb-2" />
          <span className="font-medium">Платежі</span>
        </Link>
        
        <Link href="/dashboard/student/settings"
          className="bg-white p-6 rounded-xl shadow-sm hover:shadow-md transition text-center">
          <FaCog className="text-3xl text-[#1C3A2E] mx-auto mb-2" />
          <span className="font-medium">Налаштування</span>
        </Link>
      </div>
    </div>
  );
}