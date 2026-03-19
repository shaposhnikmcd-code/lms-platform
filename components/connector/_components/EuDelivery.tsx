'use client';

import { FaMapMarkerAlt, FaTruck } from 'react-icons/fa';

interface Labels {
  cityLabel: string;
  cityPlaceholderEu: string;
  branchLabelEu: string;
  branchPlaceholderEu: string;
  branchSelectCity: string;
  notFound: string;
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
  onCityChange: (value: string) => void;
  onCitySelect: (city: string) => void;
  onPostOfficeChange: (value: string) => void;
  onPostOfficeFocus: () => void;
  onDivisionSelect: (div: any) => void;
}

export default function EuDelivery({
  city, postOffice, euCities, euDivisions,
  loadingEu, showEuCities, showEuDivisions, labels,
  onCityChange, onCitySelect,
  onPostOfficeChange, onPostOfficeFocus, onDivisionSelect,
}: Props) {
  return (
    <>
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
                onClick={() => onCitySelect(c)}>
                <p className="font-medium text-gray-800">{c}</p>
              </button>
            ))}
          </div>
        )}
      </div>

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
            {euDivisions.map((div: any) => (
              <button key={div.id} type="button"
                className="w-full text-left px-4 py-3 hover:bg-gray-50 border-b border-gray-100 last:border-0 transition-colors"
                onClick={() => onDivisionSelect(div)}>
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
    </>
  );
}