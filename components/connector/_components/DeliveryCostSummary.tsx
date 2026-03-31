'use client';

const GAME_PRICE = 1099;

interface Props {
  isUkraine: boolean;
  deliveryCost: number | null;
  loadingDeliveryCost: boolean;
  citySelected: boolean;
}

export default function DeliveryCostSummary({ isUkraine, deliveryCost, loadingDeliveryCost, citySelected }: Props) {
  const totalAmount = deliveryCost ? GAME_PRICE + deliveryCost : GAME_PRICE;

  if (!isUkraine) {
    return (
      <div className="bg-gray-50 rounded-xl p-4 space-y-2">
        <div className="flex justify-between text-sm text-gray-600">
          <span>{"Гра «Конектор»"}</span>
          <span>{`${GAME_PRICE} грн`}</span>
        </div>
        <div className="border-t border-gray-200 pt-2 flex justify-between font-bold text-[#1C3A2E]">
          <span>{"Разом"}</span>
          <span className="text-[#D4A017]">{`${GAME_PRICE} грн`}</span>
        </div>
        <p className="text-xs text-gray-400 pt-1">
          {"Вартість доставки оплачується окремо при отриманні у відділенні Nova Post."}
        </p>
      </div>
    );
  }

  const renderDeliveryValue = () => {
    if (loadingDeliveryCost) return <span className="text-gray-400">{"Розраховуємо..."}</span>;
    if (deliveryCost) return <span>{`${deliveryCost} грн`}</span>;
    if (!citySelected) return <span className="text-gray-400">{"Оберіть місто"}</span>;
    return <span className="text-gray-400">{"Оберіть відділення"}</span>;
  };

  return (
    <div className="bg-gray-50 rounded-xl p-4 space-y-2">
      <div className="flex justify-between text-sm text-gray-600">
        <span>{"Гра «Конектор»"}</span>
        <span>{`${GAME_PRICE} грн`}</span>
      </div>
      <div className="flex justify-between text-sm text-gray-600">
        <span>{"Доставка Нова Пошта"}</span>
        {renderDeliveryValue()}
      </div>
      <div className="border-t border-gray-200 pt-2 flex justify-between font-bold text-[#1C3A2E]">
        <span>{"Разом"}</span>
        <span className="text-[#D4A017]">
          {deliveryCost ? `${totalAmount} грн` : `${GAME_PRICE} грн + доставка`}
        </span>
      </div>
    </div>
  );
}