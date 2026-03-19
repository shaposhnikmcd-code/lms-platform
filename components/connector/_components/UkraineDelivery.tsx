'use client';

import { FaMapMarkerAlt, FaTruck } from 'react-icons/fa';

interface Labels {
  cityLabel: string;
  cityPlaceholder: string;
  branchLabel: string;
  branchPlaceholder: string;
  notFound: string;
}

interface Props {
  city: string;
  postOffice: string;
  cities: any[];
  branches: any[];
  loadingCities: boolean;
  loadingBranches: boolean;
  showCities: boolean;
  showBranches: boolean;
  labels: Labels;
  onCityChange: (value: string) => void;
  onCitySelect: (city: any) => void;
  onPostOfficeChange: (value: string) => void;
  onPostOfficeSelect: (branch: any) => void;
  onPostOfficeFocus: () => void;
}

export default function UkraineDelivery({
  city, postOffice, cities, branches,
  loadingCities, loadingBranches,
  showCities, showBranches, labels,
  onCityChange, onCitySelect,
  onPostOfficeChange, onPostOfficeSelect, onPostOfficeFocus,
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
            placeholder={labels.cityPlaceholder}
          />
          {loadingCities && (
            <div className="absolute right-3 top-3">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-[#D4A017]"></div>
            </div>
          )}
        </div>
        {showCities && cities.length > 0 && (
          <div className="absolute z-30 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
            {cities.map((c) => (
              <button key={c.Ref} type="button"
                className="w-full text-left px-4 py-3 hover:bg-gray-50 border-b border-gray-100 last:border-0 transition-colors"
                onClick={() => onCitySelect(c)}>
                <p className="font-medium text-gray-800">{c.Description}</p>
                <p className="text-sm text-gray-500">{c.AreaDescription}</p>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="relative">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {labels.branchLabel} <span className="text-red-500">{"*"}</span>
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
            className="block w-full pl-10 pr-3 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#D4A017] focus:border-transparent"
            placeholder={labels.branchPlaceholder}
          />
          {loadingBranches && (
            <div className="absolute right-3 top-3">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-[#D4A017]"></div>
            </div>
          )}
        </div>
        {showBranches && branches.length > 0 && (
          <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
            {branches.map((b) => (
              <button key={b.Ref} type="button"
                className="w-full text-left px-4 py-3 hover:bg-gray-50 border-b border-gray-100 last:border-0 transition-colors"
                onClick={() => onPostOfficeSelect(b)}>
                <p className="font-medium text-gray-800">{b.Description}</p>
                <p className="text-sm text-gray-500">{b.ShortAddress || b.Address}</p>
              </button>
            ))}
          </div>
        )}
        {showBranches && branches.length === 0 && !loadingBranches && city && (
          <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-4 text-center text-gray-500">
            {labels.notFound}
          </div>
        )}
      </div>
    </>
  );
}