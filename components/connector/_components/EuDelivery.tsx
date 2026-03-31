'use client';

import { FaMapMarkerAlt, FaTruck, FaHome, FaRoad } from 'react-icons/fa';

interface Labels {
  cityLabel: string;
  cityPlaceholderEu: string;
  branchLabelEu: string;
  branchPlaceholderEu: string;
  branchSelectCity: string;
  notFound: string;
}

interface CourierAddress {
  street: string;
  building: string;
  corpus: string;
  apartment: string;
}

interface Props {
  city: string;
  postOffice: string;
  euCities: string[];
  euDivisions: any[];
  loadingEu: boolean;
  showEuCities: boolean;
  showEuDivisions: boolean;
  labels: Labels;
  deliveryType: 'warehouse' | 'courier';
  courierAddress: CourierAddress;
  onCityChange: (value: string) => void;
  onCitySelect: (city: string) => void;
  onPostOfficeChange: (value: string) => void;
  onPostOfficeFocus: () => void;
  onDivisionSelect: (div: any) => void;
  onEuCitiesClose: () => void;
  onEuDivisionsClose: () => void;
  onCourierAddressChange: (field: keyof CourierAddress, value: string) => void;
}

export default function EuDelivery({
  city, postOffice, euCities, euDivisions,
  loadingEu, showEuCities, showEuDivisions, labels,
  deliveryType, courierAddress,
  onCityChange, onCitySelect,
  onPostOfficeChange, onPostOfficeFocus, onDivisionSelect,
  onEuCitiesClose, onEuDivisionsClose, onCourierAddressChange,
}: Props) {
  return (
    <>
      {/* Місто */}
      <div className="relative">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {labels.cityLabel} <span className="text-red-500">{"*"}</span>
        </label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <FaMapMarkerAlt className="text-gray-400" />
          </div>
          <input
            type="text"
            value={city}
            onChange={(e) => onCityChange(e.target.value)}
            onBlur={() => setTimeout(onEuCitiesClose, 150)}
            required
            className="block w-full pl-10 pr-3 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#D4A017] focus:border-transparent"
            placeholder={labels.cityPlaceholderEu}
          />
        </div>
        {showEuCities && euCities.length > 0 && (
          <div className="absolute z-30 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
            {euCities.map((c) => (
              <button key={c} type="button"
                className="w-full text-left px-4 py-3 hover:bg-gray-50 border-b border-gray-100 last:border-0 transition-colors"
                onMouseDown={() => onCitySelect(c)}>
                <p className="font-medium text-gray-800">{c}</p>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Відділення або Кур'єр */}
      {deliveryType === 'warehouse' ? (
        <div className="relative">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {labels.branchLabelEu} <span className="text-red-500">{"*"}</span>
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <FaTruck className="text-gray-400" />
            </div>
            <input
              type="text"
              value={postOffice}
              onChange={(e) => onPostOfficeChange(e.target.value)}
              onFocus={onPostOfficeFocus}
              onBlur={() => setTimeout(onEuDivisionsClose, 150)}
              required
              disabled={!city}
              className="block w-full pl-10 pr-3 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#D4A017] focus:border-transparent disabled:bg-gray-50 disabled:text-gray-400"
              placeholder={city ? labels.branchPlaceholderEu : labels.branchSelectCity}
            />
            {loadingEu && (
              <div className="absolute right-3 top-3">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-[#D4A017]"></div>
              </div>
            )}
          </div>
          {showEuDivisions && euDivisions.length > 0 && (
            <div className="absolute z-30 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
              {euDivisions.map((div: any, index: number) => (
                <button key={div.id ?? index} type="button"
                  className="w-full text-left px-4 py-3 hover:bg-gray-50 border-b border-gray-100 last:border-0 transition-colors"
                  onMouseDown={() => onDivisionSelect(div)}>
                  <p className="font-medium text-gray-800">{div.name}</p>
                  <p className="text-sm text-gray-500">{div.address}</p>
                </button>
              ))}
            </div>
          )}
          {showEuDivisions && euDivisions.length === 0 && !loadingEu && city && (
            <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-4 text-center text-gray-500">
              {labels.notFound}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <FaHome className="text-gray-400" />
            <span className="text-sm font-medium text-gray-700">{"Адреса доставки кур'єром"}</span>
          </div>

          <div className="relative">
            <label className="block text-xs font-medium text-gray-600 mb-1">
              {"Вулиця"} <span className="text-red-500">{"*"}</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <FaRoad className="text-gray-400" size={12} />
              </div>
              <input
                type="text"
                value={courierAddress.street}
                onChange={(e) => onCourierAddressChange('street', e.target.value)}
                required
                disabled={!city}
                className="block w-full pl-8 pr-3 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#D4A017] focus:border-transparent text-sm disabled:bg-gray-50 disabled:text-gray-400"
                placeholder={city ? "Введіть назву вулиці" : "Спочатку оберіть місто"}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                {"Будинок"} <span className="text-red-500">{"*"}</span>
              </label>
              <input
                type="text"
                value={courierAddress.building}
                onChange={(e) => onCourierAddressChange('building', e.target.value)}
                required
                className="block w-full px-3 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#D4A017] focus:border-transparent text-sm"
                placeholder={"напр. 12"}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                {"Корпус"}
                <span className="text-gray-400 font-normal ml-1">{"(необов'язково)"}</span>
              </label>
              <input
                type="text"
                value={courierAddress.corpus}
                onChange={(e) => onCourierAddressChange('corpus', e.target.value)}
                className="block w-full px-3 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#D4A017] focus:border-transparent text-sm"
                placeholder={"напр. А"}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              {"Квартира / офіс"}
              <span className="text-gray-400 font-normal ml-1">{"(необов'язково)"}</span>
            </label>
            <input
              type="text"
              value={courierAddress.apartment}
              onChange={(e) => onCourierAddressChange('apartment', e.target.value)}
              className="block w-full px-3 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#D4A017] focus:border-transparent text-sm"
              placeholder={"напр. 45"}
            />
          </div>
        </div>
      )}
    </>
  );
}