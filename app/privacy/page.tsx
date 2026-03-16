export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-gray-50 py-16">
      <div className="max-w-3xl mx-auto px-4">
        <h1 className="text-3xl font-bold text-[#1C3A2E] mb-2">{"Політика конфіденційності"}</h1>
        <p className="text-gray-400 text-sm mb-10">{"Останнє оновлення: січень 2025"}</p>

        <div className="bg-white rounded-2xl shadow-sm p-8 space-y-8 text-gray-700 text-sm leading-relaxed">

          <section>
            <h2 className="text-lg font-bold text-[#1C3A2E] mb-3">{"1. Загальні положення"}</h2>
            <p>{"Ця Політика конфіденційності описує, як Український інститут психотерапії та душеопікунства (далі — «UIMP», «ми») збирає, використовує та захищає персональні дані користувачів платформи dr-shaposhnik-platform.vercel.app."}</p>
            <p className="mt-2">{"Використовуючи наш сайт, ви погоджуєтесь з умовами цієї Політики. Якщо ви не погоджуєтесь — будь ласка, не використовуйте наш сервіс."}</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[#1C3A2E] mb-3">{"2. Які дані ми збираємо"}</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>{"Імʼя та email — при реєстрації або вході через Google/Facebook"}</li>
              <li>{"Фото профілю — якщо надано через OAuth провайдера"}</li>
              <li>{"Дані про проходження курсів та прогрес навчання"}</li>
              <li>{"Платіжна інформація — обробляється виключно сервісом WayForPay, ми не зберігаємо дані карток"}</li>
              <li>{"Дані про використання сайту — через cookies (технічні та аналітичні)"}</li>
              <li>{"Повідомлення — якщо ви пишете нам через форму зворотного звʼязку"}</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[#1C3A2E] mb-3">{"3. Навіщо ми збираємо дані"}</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>{"Для надання доступу до навчальних матеріалів"}</li>
              <li>{"Для відстеження прогресу навчання та видачі сертифікатів"}</li>
              <li>{"Для обробки платежів за курси"}</li>
              <li>{"Для звʼязку з вами щодо вашого акаунту чи замовлень"}</li>
              <li>{"Для покращення роботи платформи"}</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[#1C3A2E] mb-3">{"4. Cookies"}</h2>
            <p>{"Ми використовуємо такі типи cookies:"}</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>{"Обовʼязкові (Strictly Necessary) — необхідні для роботи сайту, авторизації та безпеки. Вимкнути неможливо."}</li>
              <li>{"Аналітичні (Performance) — допомагають нам розуміти як користувачі взаємодіють з сайтом."}</li>
              <li>{"Функціональні (Functional) — запамʼятовують ваші налаштування."}</li>
              <li>{"Рекламні (Advertising) — наразі не використовуються."}</li>
            </ul>
            <p className="mt-2">{"Ви можете керувати cookies через налаштування на нашому сайті або в браузері."}</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[#1C3A2E] mb-3">{"5. Передача даних третім сторонам"}</h2>
            <p>{"Ми не продаємо та не передаємо ваші персональні дані третім сторонам, крім випадків:"}</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>{"WayForPay — для обробки платежів (сертифікований PCI DSS)"}</li>
              <li>{"Google, Facebook — якщо ви обрали вхід через ці сервіси"}</li>
              <li>{"Cloudinary — для зберігання медіафайлів"}</li>
              <li>{"Vercel, Neon — хостинг та база даних (сервери в ЄС)"}</li>
              <li>{"FormSubmit — для обробки форми зворотного звʼязку"}</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[#1C3A2E] mb-3">{"6. Ваші права (GDPR)"}</h2>
            <p>{"Якщо ви знаходитесь в ЄС або Україні, ви маєте право:"}</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>{"Отримати копію своїх даних"}</li>
              <li>{"Виправити неточні дані"}</li>
              <li>{"Видалити свій акаунт та всі повʼязані дані"}</li>
              <li>{"Відкликати згоду на обробку даних"}</li>
              <li>{"Подати скаргу до наглядового органу"}</li>
            </ul>
            <p className="mt-2">{"Для видалення акаунту перейдіть на сторінку "}<a href="/delete-data" className="text-[#D4A843] hover:underline">{"/delete-data"}</a>{" або напишіть на uimp.edu@gmail.com."}</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[#1C3A2E] mb-3">{"7. Зберігання даних"}</h2>
            <p>{"Ми зберігаємо ваші дані поки ваш акаунт активний. Після видалення акаунту дані видаляються протягом 30 днів."}</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[#1C3A2E] mb-3">{"8. Безпека"}</h2>
            <p>{"Ми використовуємо шифрування HTTPS, хешування паролів (bcrypt) та захищені сервери в ЄС для захисту ваших даних."}</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[#1C3A2E] mb-3">{"9. Контакти"}</h2>
            <p>{"З питань конфіденційності звертайтесь:"}</p>
            <p className="mt-1">{"Email: "}<a href="mailto:uimp.edu@gmail.com" className="text-[#D4A843] hover:underline">{"uimp.edu@gmail.com"}</a></p>
          </section>

        </div>
      </div>
    </main>
  );
}