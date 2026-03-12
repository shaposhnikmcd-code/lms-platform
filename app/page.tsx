import Link from "next/link";

export default function HomePage() {
  return (
    <div className="min-h-screen">
      {/* Hero секція */}
      <div className="bg-gradient-to-b from-blue-50 to-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="text-center">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 mb-6">
              Онлайн курси психології
              <span className="text-blue-600"> та саморозвитку</span>
            </h1>
            <p className="text-xl text-gray-600 mb-10 max-w-3xl mx-auto">
              Професійна підтримка для вашого психологічного здоров&apos;я. 
              Навчайтеся у власному темпі з доступом до психолога.
            </p>
            <Link
              href="/courses"
              className="inline-block bg-blue-600 text-white px-8 py-4 rounded-lg text-lg font-semibold hover:bg-blue-700 transition-colors"
            >
              Почати навчання
            </Link>
          </div>
        </div>
      </div>

      {/* Секція "Що ви отримаєте" */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">
          Що ви отримаєте
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Картка 1 */}
          <div className="bg-white p-6 rounded-lg shadow-lg text-center">
            <div className="text-4xl mb-4">🎥</div>
            <h3 className="text-xl font-semibold mb-2">Відеоуроки</h3>
            <p className="text-gray-600">
              Професійно записані відеоуроки з психології та саморозвитку
            </p>
          </div>

          {/* Картка 2 */}
          <div className="bg-white p-6 rounded-lg shadow-lg text-center">
            <div className="text-4xl mb-4">📝</div>
            <h3 className="text-xl font-semibold mb-2">Практичні завдання</h3>
            <p className="text-gray-600">
              Завдання для закріплення матеріалу та самоаналізу
            </p>
          </div>

          {/* Картка 3 */}
          <div className="bg-white p-6 rounded-lg shadow-lg text-center">
            <div className="text-4xl mb-4">🎓</div>
            <h3 className="text-xl font-semibold mb-2">Сертифікат після курсу</h3>
            <p className="text-gray-600">
              Офіційний сертифікат про проходження курсу
            </p>
          </div>
        </div>
      </div>

      {/* Секція заклику до дії */}
      <div className="bg-blue-600">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">
            Готові почати?
          </h2>
          <p className="text-xl text-blue-100 mb-8">
            Оберіть курс, який підходить саме вам
          </p>
          <Link
            href="/courses"
            className="inline-block bg-white text-blue-600 px-8 py-4 rounded-lg text-lg font-semibold hover:bg-gray-100 transition-colors"
          >
            Переглянути курси
          </Link>
        </div>
      </div>
    </div>
  );
}