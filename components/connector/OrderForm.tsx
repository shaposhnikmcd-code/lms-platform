'use client';

import { useState } from 'react';
import { FaTimes, FaShoppingCart, FaPhone, FaEnvelope, FaUser, FaMapMarkerAlt, FaTruck } from 'react-icons/fa';

interface OrderFormProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function OrderForm({ isOpen, onClose }: OrderFormProps) {
  const [formData, setFormData] = useState({
    email: '',
    fullName: '',
    phone: '',
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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'error' | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
    }));
  };

  const searchCities = async (query: string) => {
    if (!query || query.length < 2) {
      setShowCities(false);
      return;
    }
    setLoadingCities(true);
    setShowCities(true);
    try {
      const response = await fetch('/api/nova-poshta/cities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cityName: query }),
      });
      const data = await response.json();
      setCities(data.cities || []);
    } catch (error) {
      console.error('❌ Помилка пошуку міст:', error);
    } finally {
      setLoadingCities(false);
    }
  };

  const searchBranches = async (city: string, query: string) => {
    if (!city) return;
    setLoadingBranches(true);
    setShowBranches(true);
    try {
      const response = await fetch('/api/nova-poshta/warehouses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cityName: city, searchString: query }),
      });
      const data = await response.json();
      setBranches(data.warehouses || []);
    } catch (error) {
      console.error('❌ Помилка пошуку відділень:', error);
    } finally {
      setLoadingBranches(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitStatus(null);

    try {
      const orderReference = `connector_${Date.now()}`;
      const amount = 1;

      // 1. Зберігаємо замовлення в БД
      const orderRes = await fetch('/api/connector', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderReference,
          email: formData.email,
          fullName: formData.fullName,
          phone: formData.phone,
          city: formData.city,
          postOffice: formData.postOffice,
          amount,
        }),
      });

      if (!orderRes.ok) throw new Error('Помилка збереження замовлення');

      // 2. Отримуємо дані для WayForPay
      const paymentRes = await fetch('/api/wayforpay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderReference,
          amount,
          productName: 'Гра Конектор',
          productPrice: amount,
          productCount: 1,
          clientEmail: formData.email,
        }),
      });

      if (!paymentRes.ok) throw new Error('Помилка сервера оплати');

      const paymentData = await paymentRes.json();

      // 3. Відправляємо на WayForPay
      const form = document.createElement('form');
      form.method = 'POST';
      form.action = 'https://secure.wayforpay.com/pay';
      form.style.display = 'none';

      Object.entries(paymentData).forEach(([key, value]) => {
        if (Array.isArray(value)) {
          (value as string[]).forEach((v) => {
            const input = document.createElement('input');
            input.type = 'hidden';
            input.name = key;
            input.value = String(v);
            form.appendChild(input);
          });
        } else {
          const input = document.createElement('input');
          input.type = 'hidden';
          input.name = key;
          input.value = String(value);
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
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      <div className="min-h-screen px-4 py-8 flex items-center justify-center">
        <div
          className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors z-10"
          >
            <FaTimes size={20} />
          </button>

          <div className="p-8">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-[#1C3A2E] mb-2">{"Форма замовлення"}</h2>
              <p className="text-gray-500">{"Психологічна гра для пар"}</p>
              <div className="flex items-center justify-center gap-2 mt-2">
                <span className="text-2xl font-bold text-[#D4A017]">{"1 UAH (ТЕСТ)"}</span>
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
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    required
                    className="block w-full pl-10 pr-3 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#D4A017] focus:border-transparent"
                    placeholder="username@gmail.com"
                  />
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
                  <input
                    type="text"
                    name="fullName"
                    value={formData.fullName}
                    onChange={handleChange}
                    required
                    className="block w-full pl-10 pr-3 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#D4A017] focus:border-transparent"
                    placeholder="Прізвище Ім'я По батькові"
                  />
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
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    required
                    className="block w-full pl-10 pr-3 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#D4A017] focus:border-transparent"
                    placeholder="+380 (__) ___-__-__"
                  />
                </div>
              </div>

              <div className="relative">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {"Населений пункт"} <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <FaMapMarkerAlt className="text-gray-400" />
                  </div>
                  <input
                    type="text"
                    name="city"
                    value={formData.city}
                    onChange={(e) => {
                      const value = e.target.value;
                      setFormData({ ...formData, city: value, postOffice: '' });
                      searchCities(value);
                    }}
                    onFocus={() => {
                      if (formData.city.length >= 2) setShowCities(true);
                    }}
                    required
                    className="block w-full pl-10 pr-3 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#D4A017] focus:border-transparent"
                    placeholder="Введіть назву міста або села"
                  />
                  {loadingCities && (
                    <div className="absolute right-3 top-3">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-[#D4A017]"></div>
                    </div>
                  )}
                </div>

                {showCities && cities.length > 0 && (
                  <div className="absolute z-30 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    {cities.map((city) => (
                      <button
                        key={city.Ref}
                        type="button"
                        className="w-full text-left px-4 py-3 hover:bg-gray-50 border-b border-gray-100 last:border-0 transition-colors"
                        onClick={() => {
                          setFormData({ ...formData, city: city.Description, postOffice: '' });
                          setShowCities(false);
                          setCities([]);
                        }}
                      >
                        <p className="font-medium text-gray-800">{city.Description}</p>
                        <p className="text-sm text-gray-500">{city.AreaDescription}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="relative">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {"Відділення Нової Пошти"} <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <FaTruck className="text-gray-400" />
                  </div>
                  <input
                    type="text"
                    name="postOffice"
                    value={formData.postOffice}
                    onChange={(e) => {
                      const value = e.target.value;
                      setFormData({ ...formData, postOffice: value });
                      if (formData.city) searchBranches(formData.city, value);
                    }}
                    onFocus={() => {
                      if (formData.city && formData.city.length >= 2) {
                        searchBranches(formData.city, formData.postOffice);
                        setShowBranches(true);
                      }
                    }}
                    required
                    className="block w-full pl-10 pr-3 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#D4A017] focus:border-transparent"
                    placeholder="Почніть вводити адресу або номер"
                  />
                  {loadingBranches && (
                    <div className="absolute right-3 top-3">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-[#D4A017]"></div>
                    </div>
                  )}
                </div>

                {showBranches && branches.length > 0 && (
                  <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    {branches.map((branch) => (
                      <button
                        key={branch.Ref}
                        type="button"
                        className="w-full text-left px-4 py-3 hover:bg-gray-50 border-b border-gray-100 last:border-0 transition-colors"
                        onClick={() => {
                          setFormData({ ...formData, postOffice: branch.Description });
                          setShowBranches(false);
                          setBranches([]);
                        }}
                      >
                        <p className="font-medium text-gray-800">{branch.Description}</p>
                        <p className="text-sm text-gray-500">{branch.ShortAddress || branch.Address}</p>
                      </button>
                    ))}
                  </div>
                )}

                {showBranches && branches.length === 0 && !loadingBranches && formData.city && (
                  <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-4 text-center text-gray-500">
                    {"Відділень не знайдено"}
                  </div>
                )}
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  name="callMe"
                  id="callMe"
                  checked={formData.callMe}
                  onChange={handleChange}
                  className="w-4 h-4 text-[#D4A017] border-gray-300 rounded focus:ring-[#D4A017]"
                />
                <label htmlFor="callMe" className="ml-2 text-sm text-gray-600">
                  {"Я хочу, щоб мені перетелефонували"}
                </label>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-[#D4A017] text-white font-bold py-4 px-6 rounded-xl hover:bg-[#b88913] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-lg"
              >
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