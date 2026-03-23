'use client';

interface Props {
  deliveryType: 'warehouse' | 'courier';
  onChange: (type: 'warehouse' | 'courier') => void;
}

export default function DeliveryTypeSelector({ deliveryType, onChange }: Props) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">{"Тип доставки"}</label>
      <div className="grid grid-cols-2 gap-3">
        <button type="button"
          onClick={() => onChange('warehouse')}
          className={`py-3 px-4 rounded-lg border-2 text-sm font-medium transition-all ${deliveryType === 'warehouse' ? 'border-[#D4A017] bg-[#D4A017]/10 text-[#1C3A2E]' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}>
          {"📦 До відділення НП"}
        </button>
        <button type="button"
          onClick={() => onChange('courier')}
          className={`py-3 px-4 rounded-lg border-2 text-sm font-medium transition-all ${deliveryType === 'courier' ? 'border-[#D4A017] bg-[#D4A017]/10 text-[#1C3A2E]' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}>
          {"🚗 Кур'єром за адресою"}
        </button>
      </div>
    </div>
  );
}