'use client';

type OrderStatus = 'NEW' | 'PROCESSING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED';
type PaymentStatus = 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED';

interface Order {
  id: string;
  createdAt: string;
  email: string;
  fullName: string;
  phone: string;
  city: string;
  postOffice: string;
  orderReference: string;
  amount: number;
  paymentStatus: PaymentStatus;
  orderStatus: OrderStatus;
  trackingNumber: string | null;
  managerNote: string | null;
  paidAt: string | null;
  callMe: boolean;
}

interface OrderDetailsModalProps {
  order: Order;
  trackingNumber: string;
  managerNote: string;
  saving: boolean;
  onClose: () => void;
  onTrackingChange: (value: string) => void;
  onNoteChange: (value: string) => void;
  onSave: () => void;
}

export default function OrderDetailsModal({
  order,
  trackingNumber,
  managerNote,
  saving,
  onClose,
  onTrackingChange,
  onNoteChange,
  onSave,
}: OrderDetailsModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 p-6">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
        >
          {"X"}
        </button>

        <h3 className="text-lg font-bold text-[#1C3A2E] mb-4">{"Деталі замовлення"}</h3>

        <div className="space-y-3 mb-6">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-gray-500">{"Клієнт"}</p>
              <p className="font-medium">{order.fullName}</p>
            </div>
            <div>
              <p className="text-gray-500">{"Телефон"}</p>
              <p className="font-medium">{order.phone}</p>
            </div>
            <div>
              <p className="text-gray-500">{"Email"}</p>
              <p className="font-medium">{order.email}</p>
            </div>
            <div>
              <p className="text-gray-500">{"Сума"}</p>
              <p className="font-medium text-green-600">{order.amount} {"UAH"}</p>
            </div>
            <div>
              <p className="text-gray-500">{"Дата замовлення"}</p>
              <p className="font-medium">
                {new Date(order.createdAt).toLocaleDateString('uk-UA')}{' '}
                {new Date(order.createdAt).toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
            <div>
              <p className="text-gray-500">{"Номер замовлення"}</p>
              <p className="font-medium text-xs text-gray-600">{order.orderReference}</p>
            </div>
            <div className="col-span-2">
              <p className="text-gray-500">{"Адреса доставки"}</p>
              <p className="font-medium">{order.city}, {order.postOffice}</p>
            </div>
            <div className="col-span-2">
              <p className="text-gray-500">{"Передзвонити"}</p>
              <p className="font-medium">
                {order.callMe ? (
                  <span className="text-green-600 font-semibold">{"✅ Так — клієнт просить передзвонити"}</span>
                ) : (
                  <span className="text-gray-400">{"Ні"}</span>
                )}
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {"Номер ТТН (трекінг)"}
            </label>
            <input
              type="text"
              value={trackingNumber}
              onChange={(e) => onTrackingChange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#D4A017]"
              placeholder="20450000000000"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {"Нотатка менеджера"}
            </label>
            <textarea
              value={managerNote}
              onChange={(e) => onNoteChange(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#D4A017] resize-none"
              placeholder="Внутрішня нотатка..."
            />
          </div>
          <button
            onClick={onSave}
            disabled={saving}
            className="w-full bg-[#D4A017] text-white font-bold py-3 rounded-xl hover:bg-[#b88913] transition-colors disabled:opacity-50"
          >
            {saving ? 'Збереження...' : 'Зберегти'}
          </button>
        </div>
      </div>
    </div>
  );
}