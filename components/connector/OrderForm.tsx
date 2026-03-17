'use client';

import { useState } from 'react';
import { FaTimes, FaShoppingCart, FaPhone, FaEnvelope, FaUser, FaGlobe } from 'react-icons/fa';
import UkraineDelivery from './_components/UkraineDelivery';
import EuDelivery from './_components/EuDelivery';
import DeliveryInfo from './_components/DeliveryInfo';

interface OrderFormProps {
  isOpen: boolean;
  onClose: () => void;
}

const COUNTRIES = [
  { code: 'UA', name: 'Україна 🇺🇦' },
  { code: 'PL', name: 'Польща 🇵🇱' },
  { code: 'DE', name: 'Німеччина 🇩🇪' },
  { code: 'CZ', name: 'Чехія 🇨🇿' },
  { code: 'LT', name: 'Литва 🇱🇹' },
  { code: 'LV', name: 'Латвія 🇱🇻' },
  { code: 'EE', name: 'Естонія 🇪🇪' },
  { code: 'IT', name: 'Італія 🇮🇹' },
  { code: 'ES', name: 'Іспанія 🇪🇸' },
  { code: 'SK', name: 'Словаччина 🇸🇰' },
  { code: 'HU', name: 'Угорщина 🇭🇺' },
  { code: 'RO', name: 'Румунія 🇷🇴' },
  { code: 'MD', name: 'Молдова 🇲🇩' },
  { code: 'FR', name: 'Франція 🇫🇷' },
  { code: 'GB', name: 'Велика Британія 🇬🇧' },
  { code: 'AT', name: 'Австрія 🇦🇹' },
  { code: 'NL', name: 'Нідерланди 🇳🇱' },
];

export default function OrderForm({ isOpen, onClose }: OrderFormProps) {
  const [formData, setFormData] = useState({
    email: '',
    fullName: '',
    phone: '',
    country: 'UA',
    city: '',
    postOffice: '',
    callMe: false,
  });

  const [cities, setCities] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [loadingCities, setLoadingCities] = useState(false);
  const [loadingBranches, setLoadingBranches] = useState(false);
  const [showCities, setShowCities] = useState(false);
  const [showBranches, setShowBranches] = useState(false);

  const [euCities, setEuCities] = useState<string[]>([]);
  const [showEuCities, setShowEuCities] = useState(false);
  const [euDivisions, setEuDivisions] = useState<any[]>([]);
  const [loadingEu, setLoadingEu] = useState(false);
  const [showEuDivisions, setShowEuDivisions] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'error' | null>(null);

  const isUkraine = formData.country === 'UA';

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
    }));
  };

  const handleCountryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setFormData(prev => ({ ...prev, country: e.target.value, city: '', postOffice: '' }));
    setCities([]); setBranches([]); setEuCities([]); setEuDivisions([]);
    setShowCities(false); setShowBranches(false); setShowEuCities(false); setShowEuDivisions(false);
  };

  const searchCities = async (query: string) => {
    if (!query || query.length < 2) { setShowCities(false); return; }
    setLoadingCities(true); setShowCities(true);
    try {
      const res = await fetch('/api/nova-poshta/cities', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cityName: query }),
      });
      const data = await res.json();
      setCities(data.cities || []);
    } catch (e) { console.error(e); }
    finally { setLoadingCities(false); }
  };

  const searchBranches = async (city: string, query: string) => {
    if (!city) return;
    setLoadingBranches(true); setShowBranches(true);
    try {
      const res = await fetch('/api/nova-poshta/warehouses', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cityName: city, searchString: query }),
      });
      const data = await res.json();
      setBranches(data.warehouses || []);
    } catch (e) { console.error(e); }
    finally { setLoadingBranches(false); }
  };

  const searchEuCities = async (query: string) => {
    if (!query || query.length < 2) { setShowEuCities(false); return; }
    setShowEuCities(true);
    try {
      const res = await fetch('/api/nova-poshta-eu/cities', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ countryCode: formData.country, search: query }),
      });
      const data = await res.json();
      setEuCities(data.cities || []);
    } catch (e) { console.error(e); }
  };

  const searchEuDivisions = async (city: string, query: string) => {
    if (!city) return;
    setLoadingEu(true); setShowEuDivisions(true);
    try {
      const res = await fetch('/api/nova-poshta-eu', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ countryCode: formData.country, city, search: query }),
      });
      const data = await res.json();
      setEuDivisions(data.divisions || []);
    } catch (e) { console.error(e); }
    finally { setLoadingEu(false); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitStatus(null);

    try {
      const orderReference = `connector_${Date.now()}`;
      const amount = 1099;

      const orderRes = await fetch('/api/connector', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderReference,
          email: formData.email,
          fullName: formData.fullName,
          phone: formData.phone,
          city: isUkraine ? formData.city : `${COUNTRIES.find(c => c.code === formData.country)?.name}, ${formData.city}`,
          postOffice: formData.postOffice,
          amount,
          callMe: formData.callMe,
        }),
      });

      if (!orderRes.ok) throw new Error('Помилка збереження замовлення');

      const paymentRes = await fetch('/api/wayforpay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderReference, amount,
          productName: 'Гра Конектор',
          productPrice: amount,
          productCount: 1,
          clientEmail: formData.email,
        }),
      });

      if (!paymentRes.ok) throw new Error('Помилка сервера оплати');

      const paymentData = await paymentRes.json();
      const form = document.createElement('form');
      form.method = 'POST';
      form.action = 'https://secure.wayforpay.com/pay';
      form.style.display = 'none';

      Object.entries(paymentData).forEach(([key, value]) => {
        if (Array.isArray(value)) {
          (value as string[]).forEach((v) => {
            const input = document.createElement('input');
            input.type = 'hidden'; input.name = key; input.value = String(v);
            form.appendChild(input);
          });
        } else {
          const input = document.createElement('input');
          input.type = 'hidden'; input.name = key; input.value = String(value);
          form.appendChild(input);
        }
      });

      document.body.appendChild(form);
      form.submit();
    } catch (error) {
      console.error('Помилка оплати:', error);
      setSubmitStatus('error');
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] overflow-y-auto">
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="min-h-screen px-4 py-8 flex items-center justify-center">
        <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl" onClick={(e) => e.stopPropagation()}>
          <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors z-10">
            <FaTimes size={20} />
          </button>

          <div className="p-8">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-[#1C3A2E] mb-2">{"Форма замовлення"}</h2>
              <p className="text-gray-500">{"Психологічна гра для пар"}</p>
              <div className="flex items-center justify-center gap-2 mt-2">
                <span className="text-2xl font-bold text-[#D4A017]">{"1099 UAH"}</span>
              </div>
            </div>

            {submitStatus === 'error' && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-center">
                {"✗ Помилка при оформленні замовлення. Спробуйте ще раз."}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {"Email"} <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <FaEnvelope className="text-gray-400" />
                  </div>
                  <input type="email" name="email" value={formData.email} onChange={handleChange} required
                    className="block w-full pl-10 pr-3 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#D4A017] focus:border-transparent"
                    placeholder="username@gmail.com" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {"ПІБ"} <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <FaUser className="text-gray-400" />
                  </div>
                  <input type="text" name="fullName" value={formData.fullName} onChange={handleChange} required
                    className="block w-full pl-10 pr-3 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#D4A017] focus:border-transparent"
                    placeholder="Прізвище Ім'я По батькові" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {"Номер телефону"} <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <FaPhone className="text-gray-400" />
                  </div>
                  <input type="tel" name="phone" value={formData.phone} onChange={handleChange} required
                    className="block w-full pl-10 pr-3 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#D4A017] focus:border-transparent"
                    placeholder="+380 (__) ___-__-__" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {"Країна доставки"} <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <FaGlobe className="text-gray-400" />
                  </div>
                  <select value={formData.country} onChange={handleCountryChange}
                    className="block w-full pl-10 pr-3 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#D4A017] focus:border-transparent bg-white">
                    {COUNTRIES.map(c => (
                      <option key={c.code} value={c.code}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {isUkraine ? (
                <UkraineDelivery
                  city={formData.city}
                  postOffice={formData.postOffice}
                  cities={cities}
                  branches={branches}
                  loadingCities={loadingCities}
                  loadingBranches={loadingBranches}
                  showCities={showCities}
                  showBranches={showBranches}
                  onCityChange={(value) => {
                    setFormData({ ...formData, city: value, postOffice: '' });
                    searchCities(value);
                  }}
                  onCitySelect={(city) => {
                    setFormData({ ...formData, city: city.Description, postOffice: '' });
                    setShowCities(false); setCities([]);
                  }}
                  onPostOfficeChange={(value) => {
                    setFormData({ ...formData, postOffice: value });
                    if (formData.city) searchBranches(formData.city, value);
                  }}
                  onPostOfficeSelect={(branch) => {
                    setFormData({ ...formData, postOffice: branch.Description });
                    setShowBranches(false); setBranches([]);
                  }}
                  onPostOfficeFocus={() => {
                    if (formData.city && formData.city.length >= 2) {
                      searchBranches(formData.city, formData.postOffice);
                      setShowBranches(true);
                    }
                  }}
                />
              ) : (
                <EuDelivery
                  city={formData.city}
                  postOffice={formData.postOffice}
                  euCities={euCities}
                  euDivisions={euDivisions}
                  loadingEu={loadingEu}
                  showEuCities={showEuCities}
                  showEuDivisions={showEuDivisions}
                  onCityChange={(value) => {
                    setFormData({ ...formData, city: value, postOffice: '' });
                    setEuDivisions([]); setShowEuDivisions(false);
                    searchEuCities(value);
                  }}
                  onCitySelect={(city) => {
                    setFormData({ ...formData, city, postOffice: '' });
                    setShowEuCities(false); setEuCities([]);
                    searchEuDivisions(city, '');
                  }}
                  onPostOfficeChange={(value) => {
                    setFormData({ ...formData, postOffice: value });
                    searchEuDivisions(formData.city, value);
                  }}
                  onPostOfficeFocus={() => {
                    if (formData.city) searchEuDivisions(formData.city, formData.postOffice);
                  }}
                  onDivisionSelect={(div) => {
                    setFormData({ ...formData, postOffice: div.address || div.name });
                    setShowEuDivisions(false); setEuDivisions([]);
                  }}
                />
              )}

              <DeliveryInfo />

              <div className="flex items-center">
                <input type="checkbox" name="callMe" id="callMe" checked={formData.callMe} onChange={handleChange}
                  className="w-4 h-4 text-[#D4A017] border-gray-300 rounded focus:ring-[#D4A017]" />
                <label htmlFor="callMe" className="ml-2 text-sm text-gray-600">
                  {"Я хочу, щоб мені перетелефонували"}
                </label>
              </div>

              <button type="submit" disabled={isSubmitting}
                className="w-full bg-[#D4A017] text-white font-bold py-4 px-6 rounded-xl hover:bg-[#b88913] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-lg">
                {isSubmitting ? (
                  <>
                    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>{"Обробка..."}</span>
                  </>
                ) : (
                  <>
                    <FaShoppingCart />
                    <span>{"Замовити та оплатити"}</span>
                  </>
                )}
              </button>

              <p className="text-xs text-gray-400 text-center">
                {"Натискаючи \"Замовити\", ви погоджуєтесь з умовами обробки персональних даних"}
              </p>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}