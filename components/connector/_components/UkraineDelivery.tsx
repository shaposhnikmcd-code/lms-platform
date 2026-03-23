'use client';

import { useState } from 'react';
import { FaMapMarkerAlt, FaTruck, FaHome, FaRoad } from 'react-icons/fa';

interface Labels {
  cityLabel: string;
  cityPlaceholder: string;
  branchLabel: string;
  branchPlaceholder: string;
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
  courierAddress: CourierAddress;
  cities: any[];
  branches: any[];
  loadingCities: boolean;
  loadingBranches: boolean;
  showCities: boolean;
  showBranches: boolean;
  labels: Labels;
  deliveryType: 'warehouse' | 'courier';
  selectedCityRef: string;
  onCityChange: (value: string) => void;
  onCitySelect: (city: any) => void;
  onPostOfficeChange: (value: string) => void;
  onPostOfficeSelect: (branch: any) => void;
  onPostOfficeFocus: () => void;
  onCitiesClose: () => void;
  onBranchesClose: () => void;
  onCourierAddressChange: (field: keyof CourierAddress, value: string) => void;
}

export default function UkraineDelivery({
  city, postOffice, courierAddress, cities, branches,
  loadingCities, loadingBranches,
  showCities, showBranches, labels,
  deliveryType, selectedCityRef,
  onCityChange, onCitySelect,
  onPostOfficeChange, onPostOfficeSelect, onPostOfficeFocus,
  onCitiesClose, onBranchesClose,
  onCourierAddressChange,
}: Props) {
  const [streets, setStreets] = useState<any[]>([]);
  const [showStreets, setShowStreets] = useState(false);
  const [loadingStreets, setLoadingStreets] = useState(false);
  const [selectedStreetRef, setSelectedStreetRef] = useState('');

  const [buildings, setBuildings] = useState<any[]>([]);
  const [showBuildings, setShowBuildings] = useState(false);
  const [loadingBuildings, setLoadingBuildings] = useState(false);
  const [buildingQuery, setBuildingQuery] = useState('');

  const searchStreets = async (query: string) => {
    if (!query || query.length < 2 || !selectedCityRef) { setShowStreets(false); return; }
    setLoadingStreets(true); setShowStreets(true);
    try {
      const res = await fetch('/api/nova-poshta/streets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cityRef: selectedCityRef, search: query }),
      });
      const data = await res.json();
      setStreets(data.streets || []);
    } catch (e) { console.error(e); }
    finally { setLoadingStreets(false); }
  };

  const searchBuildings = async (query: string, streetRef: string) => {
    if (!streetRef) { setShowBuildings(false); return; }
    setLoadingBuildings(true); setShowBuildings(true); setBuildingQuery(query);
    try {
      const res = await fetch('/api/nova-poshta/buildings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ streetRef, search: query }),
      });
      const data = await res.json();
      setBuildings(data.buildings || []);
    } catch (e) { console.error(e); }
    finally { setLoadingBuildings(false); }
  };

  const filteredBuildings = buildingQuery
    ? buildings.filter((b) =>
        b.Description?.toLowerCase().startsWith(buildingQuery.toLowerCase())
      )
    : buildings;

  const buildStreetName = (s: any): string => {
    const type = s.StreetsTypeDescription || '';
    const name = s.Description || '';
    return [type, name].filter(Boolean).join(' ');
  };

  return (
    <>
      {/* Населений пункт */}
      <div className="relative">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {labels.cityLabel} <span className="text-red-500">{"*"}</span>
        </label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <FaMapMarkerAlt className="text-gray-400" />
          </div>
          <input
            type="text" value={city}
            onChange={(e) => onCityChange(e.target.value)}
            onBlur={() => setTimeout(onCitiesClose, 150)}
            required
            autoComplete="new-password"
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

      {/* Відділення або Адреса кур'єра */}
      {deliveryType === 'warehouse' ? (
        <div className="relative">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {labels.branchLabel} <span className="text-red-500">{"*"}</span>
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <FaTruck className="text-gray-400" />
            </div>
            <input
              type="text" value={postOffice}
              onChange={(e) => onPostOfficeChange(e.target.value)}
              onFocus={onPostOfficeFocus}
              onBlur={() => setTimeout(onBranchesClose, 150)}
              required
              autoComplete="new-password"
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
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <FaHome className="text-gray-400" />
            <span className="text-sm font-medium text-gray-700">{"Адреса доставки кур'єром"}</span>
          </div>

          {/* Вулиця з пошуком */}
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
                onChange={(e) => {
                  onCourierAddressChange('street', e.target.value);
                  setSelectedStreetRef('');
                  setBuildings([]);
                  searchStreets(e.target.value);
                }}
                onBlur={() => setTimeout(() => setShowStreets(false), 150)}
                required
                autoComplete="new-password"
                disabled={!selectedCityRef}
                className="block w-full pl-8 pr-3 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#D4A017] focus:border-transparent text-sm disabled:bg-gray-50 disabled:text-gray-400"
                placeholder={selectedCityRef ? "Введіть назву вулиці" : "Спочатку оберіть місто"}
              />
              {loadingStreets && (
                <div className="absolute right-3 top-3">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[#D4A017]"></div>
                </div>
              )}
            </div>
            {showStreets && streets.length > 0 && (
              <div className="absolute z-30 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                {streets.map((s) => (
                  <button key={s.Ref} type="button"
                    className="w-full text-left px-4 py-2.5 hover:bg-gray-50 border-b border-gray-100 last:border-0 transition-colors text-sm"
                    onClick={() => {
                      onCourierAddressChange('street', buildStreetName(s));
                      setSelectedStreetRef(s.Ref);
                      setShowStreets(false);
                      setStreets([]);
                      onCourierAddressChange('building', '');
                      setBuildingQuery('');
                      setBuildings([]);
                    }}>
                    {s.StreetsTypeDescription && (
                      <span className="text-gray-500 text-xs mr-1">{s.StreetsTypeDescription}</span>
                    )}
                    <span className="font-medium text-gray-800">{s.Description}</span>
                  </button>
                ))}
              </div>
            )}
            {showStreets && streets.length === 0 && !loadingStreets && (
              <div className="absolute z-30 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-center text-gray-500 text-sm">
                {"Вулиць не знайдено"}
              </div>
            )}
          </div>

          {/* Будинок + Корпус */}
          <div className="grid grid-cols-2 gap-3">
            <div className="relative">
              <label className="block text-xs font-medium text-gray-600 mb-1">
                {"Будинок"} <span className="text-red-500">{"*"}</span>
              </label>
              <input
                type="text"
                value={courierAddress.building}
                onChange={(e) => {
                  onCourierAddressChange('building', e.target.value);
                  if (selectedStreetRef) searchBuildings(e.target.value, selectedStreetRef);
                }}
                onFocus={() => {
                  if (selectedStreetRef && !courierAddress.building) {
                    searchBuildings('', selectedStreetRef);
                  }
                }}
                onBlur={() => setTimeout(() => setShowBuildings(false), 150)}
                required
                autoComplete="new-password"
                disabled={!selectedStreetRef}
                className="block w-full px-3 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#D4A017] focus:border-transparent text-sm disabled:bg-gray-50 disabled:text-gray-400"
                placeholder={selectedStreetRef ? "напр. 12" : "Спочатку вулицю"}
              />
              {loadingBuildings && (
                <div className="absolute right-3 top-9">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[#D4A017]"></div>
                </div>
              )}
              {showBuildings && filteredBuildings.length > 0 && (
                <div className="absolute z-30 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                  {filteredBuildings.map((b) => (
                    <button key={b.Ref} type="button"
                      className="w-full text-left px-3 py-2 hover:bg-gray-50 border-b border-gray-100 last:border-0 transition-colors text-sm"
                      onClick={() => {
                        onCourierAddressChange('building', b.Description);
                        setShowBuildings(false);
                        setBuildings([]);
                        setBuildingQuery('');
                      }}>
                      <span className="font-medium text-gray-800">{b.Description}</span>
                    </button>
                  ))}
                </div>
              )}
              {showBuildings && filteredBuildings.length === 0 && !loadingBuildings && (
                <div className="absolute z-30 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-center text-gray-500 text-sm">
                  {"Будинків не знайдено"}
                </div>
              )}
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
                autoComplete="new-password"
                className="block w-full px-3 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#D4A017] focus:border-transparent text-sm"
                placeholder={"напр. А"}
              />
            </div>
          </div>

          {/* Квартира */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              {"Квартира"} <span className="text-red-500">{"*"}</span>
            </label>
            <input
              type="text"
              value={courierAddress.apartment}
              onChange={(e) => onCourierAddressChange('apartment', e.target.value)}
              required
              autoComplete="new-password"
              className="block w-full px-3 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#D4A017] focus:border-transparent text-sm"
              placeholder={"напр. 45"}
            />
          </div>
        </div>
      )}
    </>
  );
}