export default function PrivacyPage() {
  return (
    <div className="container mx-auto px-4 py-12 max-w-4xl">
      <h1 className="text-3xl font-bold text-[#1C3A2E] mb-8">Політика конфіденційності</h1>
      
      <div className="space-y-6 text-gray-700">
        <section>
          <h2 className="text-xl font-semibold text-[#1C3A2E] mb-3">1. Загальні положення</h2>
          <p>Ця Політика конфіденційності визначає порядок обробки та захисту персональних даних користувачів сайту.</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-[#1C3A2E] mb-3">2. Збір та використання даних</h2>
          <p>Ми збираємо та використовуємо персональні дані виключно для забезпечення роботи платформи та надання доступу до курсів.</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-[#1C3A2E] mb-3">3. Видалення даних</h2>
          <p>Користувач має право вимагати видалення своїх персональних даних, надіславши запит на email.</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-[#1C3A2E] mb-3">4. Контакти</h2>
          <p>З питань конфіденційності: support@uimp.com</p>
        </section>

        <p className="text-sm text-gray-500 mt-8">Оновлено: Березень 2026</p>
      </div>
    </div>
  );
}