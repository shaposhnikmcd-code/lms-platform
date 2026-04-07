'use client';

const GAME_PRICE = 1099;

interface Props {
  isUkraine: boolean;
  deliveryCost: number | null;
  loadingDeliveryCost: boolean;
  citySelected: boolean;
  labels: {
    gameLabel: string;
    total: string;
    calculating: string;
    selectCity: string;
    selectBranch: string;
    novaPoshtaDelivery: string;
    plusDelivery: string;
    euPickupNote: string;
  };
}

export default function DeliveryCostSummary({ isUkraine, deliveryCost, loadingDeliveryCost, citySelected, labels }: Props) {
  const totalAmount = deliveryCost ? GAME_PRICE + deliveryCost : GAME_PRICE;

  if (!isUkraine) {
    return (
      <div className="bg-gray-50 rounded-xl p-4 space-y-2">
        <div className="flex justify-between text-sm text-gray-600">
          <span>{labels.gameLabel}</span>
          <span>{`${GAME_PRICE} грн`}</span>
        </div>
        <div className="border-t border-gray-200 pt-2 flex justify-between font-bold text-[#1C3A2E]">
          <span>{labels.total}</span>
          <span className="text-[#D4A017]">{`${GAME_PRICE} грн`}</span>
        </div>
        <p className="text-xs text-gray-400 pt-1">
          {labels.euPickupNote}
        </p>
      </div>
    );
  }

  const renderDeliveryValue = () => {
    if (loadingDeliveryCost) return <span className="text-gray-400">{labels.calculating}</span>;
    if (deliveryCost) return <span>{`${deliveryCost} грн`}</span>;
    if (!citySelected) return <span className="text-gray-400">{labels.selectCity}</span>;
    return <span className="text-gray-400">{labels.selectBranch}</span>;
  };

  return (
    <div className="bg-gray-50 rounded-xl p-4 space-y-2">
      <div className="flex justify-between text-sm text-gray-600">
        <span>{labels.gameLabel}</span>
        <span>{`${GAME_PRICE} грн`}</span>
      </div>
      <div className="flex justify-between text-sm text-gray-600">
        <span>{labels.novaPoshtaDelivery}</span>
        {renderDeliveryValue()}
      </div>
      <div className="border-t border-gray-200 pt-2 flex justify-between font-bold text-[#1C3A2E]">
        <span>{labels.total}</span>
        <span className="text-[#D4A017]">
          {deliveryCost ? `${totalAmount} грн` : `${GAME_PRICE} грн ${labels.plusDelivery}`}
        </span>
      </div>
    </div>
  );
}
