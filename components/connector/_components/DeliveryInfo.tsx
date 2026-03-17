const SUPPORT_EMAIL = 'support@uimp.com.ua';

export default function DeliveryInfo() {
  return (
    <div className="p-4 bg-[#E8F5E0] rounded-lg text-sm text-[#1C3A2E]">
      <p className="font-medium mb-1">{"📦 Доставка Nova Post"}</p>
      <p>{"Доставляємо до відділень Nova Post в: Україні, Польщі, Німеччині, Чехії, Литві, Латвії, Естонії, Італії, Іспанії, Словаччині, Угорщині, Румунії, Молдові, Франції, Великій Британії, Австрії, Нідерландах."}</p>
      <p className="mt-1">
        {"Якщо вашої країни немає у списку — напишіть нам: "}
        <a href={`mailto:${SUPPORT_EMAIL}`} className="text-[#D4A017] underline">{SUPPORT_EMAIL}</a>
      </p>
    </div>
  );
}