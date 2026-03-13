import { FaUsers, FaGraduationCap, FaDollarSign, FaChartLine } from "react-icons/fa";
import Link from "next/link";

export default function AdminDashboard() {
  // Тимчасові дані для демонстрації
  const stats = [
    { icon: FaUsers, label: "Користувачів", value: "156", change: "+12%", color: "blue" },
    { icon: FaGraduationCap, label: "Активних студентів", value: "89", change: "+5%", color: "green" },
    { icon: FaDollarSign, label: "Дохід (місяць)", value: "45 600 грн", change: "+18%", color: "yellow" },
    { icon: FaChartLine, label: "Проданих курсів", value: "234", change: "+8%", color: "purple" },
  ];

  const popularCourses = [
    { name: "Психологія стосунків", students: 45 },
    { name: "Самооцінка", students: 38 },
    { name: "Емоційний інтелект", students: 32 },
    { name: "Комунікація", students: 28 },
  ];

  return (
    <div className="max-w-7xl mx-auto">
      <h1 className="text-3xl font-bold text-[#1C3A2E] mb-8">Адмін-панель</h1>
      
      {/* Статистика */}
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {stats.map((stat, i) => (
          <div key={i} className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-between mb-2">
              <stat.icon className={`text-2xl text-${stat.color}-600`} />
              <span className="text-sm text-green-600 bg-green-50 px-2 py-1 rounded">
                {stat.change}
              </span>
            </div>
            <div className="text-2xl font-bold mb-1">{stat.value}</div>
            <div className="text-sm text-gray-500">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Дві колонки */}
      <div className="grid md:grid-cols-3 gap-6">
        {/* Популярні курси */}
        <div className="md:col-span-2 bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-xl font-semibold mb-4">Популярні курси</h2>
          <div className="space-y-4">
            {popularCourses.map((course, i) => (
              <div key={i} className="flex items-center justify-between">
                <span>{course.name}</span>
                <span className="text-[#D4A017] font-medium">{course.students} студентів</span>
              </div>
            ))}
          </div>
        </div>

        {/* Швидкі дії */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-xl font-semibold mb-4">Швидкі дії</h2>
          <div className="space-y-3">
            <Link href="/dashboard/admin/users" className="block p-3 bg-gray-50 rounded-lg hover:bg-gray-100">
              👥 Управління користувачами
            </Link>
            <Link href="/dashboard/admin/courses" className="block p-3 bg-gray-50 rounded-lg hover:bg-gray-100">
              📚 Управління курсами
            </Link>
            <Link href="/dashboard/admin/analytics" className="block p-3 bg-gray-50 rounded-lg hover:bg-gray-100">
              📊 Детальна аналітика
            </Link>
            <Link href="/dashboard/admin/payments" className="block p-3 bg-gray-50 rounded-lg hover:bg-gray-100">
              💰 Фінанси
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}