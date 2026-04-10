'use client';

import { useState, useRef } from 'react';
import { FaTimes, FaShoppingCart, FaEnvelope, FaUser } from 'react-icons/fa';
import UkraineDelivery from './_components/UkraineDelivery';
import EuDelivery from './_components/EuDelivery';
import DeliveryInfo from './_components/DeliveryInfo';
import DeliveryTypeSelector from './_components/DeliveryTypeSelector';
import DeliveryCostSummary from './_components/DeliveryCostSummary';
import PhoneInput from './_components/PhoneInput';
import CountrySelector from './_components/CountrySelector';
import { ALL_COUNTRIES, COUNTRY_PHONE } from './_constants/countries';

interface FormLabels {
  title: string;
  subtitle: string;
  emailLabel: string;
  nameLabel: string;
  namePlaceholder: string;
  phoneLabel: string;
  phonePlaceholder: string;
  countryLabel: string;
  callMe: string;
  btnSubmit: string;
  btnLoading: string;
  errorMsg: string;
  agree: string;
  cityLabel: string;
  cityPlaceholder: string;
  cityPlaceholderEu: string;
  branchLabel: string;
  branchLabelEu: string;
  branchPlaceholder: string;
  branchPlaceholderEu: string;
  branchSelectCity: string;
  notFound: string;
  deliveryTitle: string;
  deliveryText: string;
  deliveryContact: string;
  countries: { code: string; name: string }[];
  deliveryType: string;
  deliveryWarehouse: string;
  deliveryCourier: string;
  gameLabel: string;
  total: string;
  calculating: string;
  selectCity: string;
  selectBranch: string;
  novaPoshtaDelivery: string;
  plusDelivery: string;
  euPickupNote: string;
  courierAddressTitle: string;
  streetLabel: string;
  houseLabel: string;
  corpusLabel: string;
  apartmentLabel: string;
  apartmentOrOfficeLabel: string;
  optional: string;
  enterStreet: string;
  firstSelectCity: string;
  firstSelectStreet: string;
  streetsNotFound: string;
  buildingsNotFound: string;
  exampleHouse: string;
  exampleCorpus: string;
  exampleApt: string;
  nameUkrainianError: string;
  nameFullError: string;
}

interface OrderFormProps {
  isOpen: boolean;
  onClose: () => void;
  labels?: FormLabels;
}

const GAME_PRICE = 1099;

const defaultLabels: FormLabels = {
  title: "Форма замовлення",
  subtitle: "Психологічна гра для пар",
  emailLabel: "Email",
  nameLabel: "ПІБ",
  namePlaceholder: "Прізвище Ім'я По батькові",
  phoneLabel: "Номер телефону",
  phonePlaceholder: "+380 (__) ___-__-__",
  countryLabel: "Країна доставки",
  callMe: "Я хочу, щоб мені перетелефонували",
  btnSubmit: "Замовити та оплатити",
  btnLoading: "Обробка...",
  errorMsg: "✗ Помилка при оформленні замовлення. Спробуйте ще раз.",
  agree: "Натискаючи \"Замовити\", ви погоджуєтесь з умовами обробки персональних даних",
  cityLabel: "Населений пункт",
  cityPlaceholder: "Введіть назву міста або села",
  cityPlaceholderEu: "Введіть назву міста",
  branchLabel: "Відділення Нової Пошти",
  branchLabelEu: "Відділення Nova Post",
  branchPlaceholder: "Почніть вводити адресу або номер",
  branchPlaceholderEu: "Почніть вводити адресу відділення",
  branchSelectCity: "Спочатку оберіть місто",
  notFound: "Відділень не знайдено",
  deliveryTitle: "Доставка Nova Post",
  deliveryText: "Доставляємо до відділень Nova Post в: Україні, Польщі, Німеччині, Чехії, Литві, Латвії, Естонії, Італії, Іспанії, Словаччині, Угорщині, Румунії, Молдові, Франції, Великій Британії, Австрії, Нідерландах.",
  deliveryContact: "Якщо вашої країни немає у списку — напишіть нам:",
  countries: ALL_COUNTRIES,
  deliveryType: "Тип доставки",
  deliveryWarehouse: "📦 До відділення НП",
  deliveryCourier: "🚗 Кур'єром за адресою",
  gameLabel: "Гра «Конектор»",
  total: "Разом",
  calculating: "Розраховуємо...",
  selectCity: "Оберіть місто",
  selectBranch: "Оберіть відділення",
  novaPoshtaDelivery: "Доставка Нова Пошта",
  plusDelivery: "+ доставка",
  euPickupNote: "Вартість доставки оплачується окремо при отриманні у відділенні Nova Post.",
  courierAddressTitle: "Адреса доставки кур'єром",
  streetLabel: "Вулиця",
  houseLabel: "Будинок",
  corpusLabel: "Корпус",
  apartmentLabel: "Квартира",
  apartmentOrOfficeLabel: "Квартира / офіс",
  optional: "(необов'язково)",
  enterStreet: "Введіть назву вулиці",
  firstSelectCity: "Спочатку оберіть місто",
  firstSelectStreet: "Спочатку вулицю",
  streetsNotFound: "Вулиць не знайдено",
  buildingsNotFound: "Будинків не знайдено",
  exampleHouse: "напр. 12",
  exampleCorpus: "напр. А",
  exampleApt: "напр. 45",
  nameUkrainianError: "Введіть ПІБ українськими літерами",
  nameFullError: "Введіть повне ПІБ: Прізвище Ім'я По батькові",
};

export default function OrderForm({ isOpen, onClose, labels }: OrderFormProps) {
  const l = labels ?? defaultLabels;

  const [formData, setFormData] = useState({
    email: '', fullName: '', phone: '',
    country: 'UA', city: '', postOffice: '', callMe: false,
  });

  const [phoneCountry, setPhoneCountry] = useState('UA');

  const [courierAddress, setCourierAddress] = useState({
    street: '', building: '', corpus: '', apartment: '',
  });

  const [selectedCityRef, setSelectedCityRef] = useState('');
  const [deliveryType, setDeliveryType] = useState<'warehouse' | 'courier'>('warehouse');
  const [deliveryCost, setDeliveryCost] = useState<number | null>(null);
  const [loadingDeliveryCost, setLoadingDeliveryCost] = useState(false);

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
  const [nameError, setNameError] = useState<string | null>(null);

  const euCityDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isUkraine = formData.country === 'UA';
  const totalAmount = deliveryCost ? GAME_PRICE + deliveryCost : GAME_PRICE;

  const buildCourierAddress = () => {
    return [
      courierAddress.street,
      courierAddress.building,
      courierAddress.corpus ? `корп. ${courierAddress.corpus}` : '',
      courierAddress.apartment ? `кв. ${courierAddress.apartment}` : '',
    ].filter(Boolean).join(', ');
  };

  const calculateDeliveryCost = async (cityRef: string, type: 'warehouse' | 'courier') => {
    if (!cityRef || !isUkraine) return;
    setLoadingDeliveryCost(true);
    setDeliveryCost(null);
    try {
      const serviceType = type === 'warehouse' ? 'WarehouseWarehouse' : 'WarehouseDoors';
      const res = await fetch('/api/nova-poshta/delivery-cost', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cityRef, serviceType }),
      });
      const data = await res.json();
      if (data.cost) setDeliveryCost(data.cost);
    } catch (e) { console.error(e); }
    finally { setLoadingDeliveryCost(false); }
  };

  const handleDeliveryTypeChange = (type: 'warehouse' | 'courier') => {
    setDeliveryType(type);
    setDeliveryCost(null);
    setFormData(prev => ({ ...prev, postOffice: '' }));
    setCourierAddress({ street: '', building: '', corpus: '', apartment: '' });
    if (type === 'courier' && selectedCityRef && isUkraine) {
      calculateDeliveryCost(selectedCityRef, 'courier');
    }
  };

  const validateFullName = (value: string, country: string): string | null => {
    if (country === 'UA') {
      const cyrillicOnly = /^[а-яА-ЯіІїЇєЄґҐʼ''\-\s]+$/;
      if (value && !cyrillicOnly.test(value)) {
        return l.nameUkrainianError;
      }
      const words = value.trim().split(/\s+/).filter(Boolean);
      if (value.trim() && words.length < 3) {
        return l.nameFullError;
      }
    }
    return null;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type } = e.target;
    if (name === 'fullName') {
      setNameError(validateFullName(value, formData.country));
    }
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
    }));
  };

  const handleCountrySelect = (code: string) => {
    setFormData(prev => ({ ...prev, country: code, city: '', postOffice: '' }));
    setNameError(validateFullName(formData.fullName, code));
    setCities([]); setBranches([]); setEuCities([]); setEuDivisions([]);
    setShowCities(false); setShowBranches(false); setShowEuCities(false); setShowEuDivisions(false);
    setSelectedCityRef(''); setDeliveryCost(null);
    setCourierAddress({ street: '', building: '', corpus: '', apartment: '' });
    setDeliveryType('warehouse');
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

  const searchEuCities = (query: string) => {
    if (!query || query.length < 2) { setShowEuCities(false); return; }
    if (euCityDebounceRef.current) clearTimeout(euCityDebounceRef.current);
    setLoadingEu(true); setShowEuCities(true);
    euCityDebounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch('/api/nova-poshta-eu/cities', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ countryCode: formData.country, search: query }),
        });
        const data = await res.json();
        setEuCities(data.cities || []);
      } catch (e) { console.error(e); }
      finally { setLoadingEu(false); }
    }, 500);
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
    const nameErr = validateFullName(formData.fullName, formData.country);
    if (nameErr) {
      setNameError(nameErr);
      return;
    }
    setIsSubmitting(true);
    setSubmitStatus(null);
    try {
      const orderReference = `connector_${Date.now()}`;
      const selectedCountry = ALL_COUNTRIES.find(c => c.code === formData.country);
      const deliveryAddress = deliveryType === 'courier' ? buildCourierAddress() : formData.postOffice;
      const phonePrefix = COUNTRY_PHONE[phoneCountry]?.prefix ?? '+380';
      const fullPhone = `${phonePrefix} ${formData.phone}`.trim();

      const orderRes = await fetch('/api/connector', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderReference, email: formData.email, fullName: formData.fullName,
          phone: fullPhone,
          city: isUkraine ? formData.city : `${selectedCountry?.name}, ${formData.city}`,
          postOffice: deliveryAddress,
          amount: totalAmount,
          gamePrice: GAME_PRICE,
          shippingCost: deliveryCost ?? 0,
          callMe: formData.callMe,
        }),
      });
      if (!orderRes.ok) throw new Error('Order save error');

      const paymentRes = await fetch('/api/wayforpay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderReference, amount: totalAmount, productName: 'Гра Конектор',
          productPrice: totalAmount, productCount: 1, clientEmail: formData.email,
        }),
      });
      if (!paymentRes.ok) throw new Error('Payment server error');

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
      console.error('Payment error:', error);
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
              <h2 className="text-3xl font-bold text-[#1C3A2E] mb-2">{l.title}</h2>
              <p className="text-gray-500">{l.subtitle}</p>
            </div>

            {submitStatus === 'error' && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-center">
                {l.errorMsg}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {l.nameLabel} <span className="text-red-500">{"*"}</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <FaUser className="text-gray-400" />
                  </div>
                  <input type="text" name="fullName" value={formData.fullName} onChange={handleChange} required
                    className={`block w-full pl-10 pr-3 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#D4A017] focus:border-transparent ${nameError ? 'border-red-400' : 'border-gray-200'}`}
                    placeholder={l.namePlaceholder} />
                </div>
                {nameError && (
                  <p className="mt-1 text-xs text-red-500">{nameError}</p>
                )}
              </div>

              <PhoneInput
                label={l.phoneLabel}
                phoneCountry={phoneCountry}
                phone={formData.phone}
                onPhoneCountryChange={(code) => {
                  setPhoneCountry(code);
                  setFormData(prev => ({ ...prev, phone: '' }));
                }}
                onPhoneChange={(value) => setFormData(prev => ({ ...prev, phone: value }))}
              />

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {l.emailLabel} <span className="text-red-500">{"*"}</span>
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

              <CountrySelector
                label={l.countryLabel}
                selectedCode={formData.country}
                onSelect={handleCountrySelect}
              />

              <DeliveryTypeSelector
                deliveryType={deliveryType}
                onChange={handleDeliveryTypeChange}
                labels={l}
              />

              {isUkraine ? (
                <UkraineDelivery
                  city={formData.city} postOffice={formData.postOffice}
                  courierAddress={courierAddress}
                  cities={cities} branches={branches}
                  loadingCities={loadingCities} loadingBranches={loadingBranches}
                  showCities={showCities} showBranches={showBranches}
                  labels={l} deliveryType={deliveryType}
                  selectedCityRef={selectedCityRef}
                  onCityChange={(value) => {
                    setFormData(prev => ({ ...prev, city: value, postOffice: '' }));
                    setSelectedCityRef(''); setDeliveryCost(null);
                    searchCities(value);
                  }}
                  onCitySelect={(city) => {
                    setFormData(prev => ({ ...prev, city: city.Description, postOffice: '' }));
                    setShowCities(false); setCities([]);
                    setSelectedCityRef(city.Ref);
                    setDeliveryCost(null);
                    if (deliveryType === 'courier') calculateDeliveryCost(city.Ref, 'courier');
                  }}
                  onPostOfficeChange={(value) => {
                    setFormData(prev => ({ ...prev, postOffice: value }));
                    if (!value) setDeliveryCost(null);
                    if (formData.city && deliveryType === 'warehouse') searchBranches(formData.city, value);
                  }}
                  onPostOfficeSelect={(branch) => {
                    setFormData(prev => ({ ...prev, postOffice: branch.Description }));
                    setShowBranches(false); setBranches([]);
                    if (deliveryType === 'warehouse' && selectedCityRef) {
                      calculateDeliveryCost(selectedCityRef, 'warehouse');
                    }
                  }}
                  onPostOfficeFocus={() => {
                    if (formData.city && formData.city.length >= 2 && deliveryType === 'warehouse') {
                      searchBranches(formData.city, formData.postOffice);
                      setShowBranches(true);
                    }
                  }}
                  onCitiesClose={() => setShowCities(false)}
                  onBranchesClose={() => setShowBranches(false)}
                  onCourierAddressChange={(field, value) =>
                    setCourierAddress(prev => ({ ...prev, [field]: value }))
                  }
                />
              ) : (
                <EuDelivery
                  city={formData.city} postOffice={formData.postOffice}
                  euCities={euCities} euDivisions={euDivisions}
                  loadingEu={loadingEu} showEuCities={showEuCities} showEuDivisions={showEuDivisions}
                  labels={l}
                  deliveryType={deliveryType}
                  courierAddress={courierAddress}
                  onCityChange={(value) => {
                    setFormData(prev => ({ ...prev, city: value, postOffice: '' }));
                    setEuDivisions([]); setShowEuDivisions(false);
                    searchEuCities(value);
                  }}
                  onCitySelect={(city) => {
                    setFormData(prev => ({ ...prev, city, postOffice: '' }));
                    setShowEuCities(false); setEuCities([]);
                    if (deliveryType === 'warehouse') searchEuDivisions(city, '');
                  }}
                  onPostOfficeChange={(value) => {
                    setFormData(prev => ({ ...prev, postOffice: value }));
                    searchEuDivisions(formData.city, value);
                  }}
                  onPostOfficeFocus={() => {
                    if (formData.city) searchEuDivisions(formData.city, formData.postOffice);
                  }}
                  onDivisionSelect={(div) => {
                    setFormData(prev => ({ ...prev, postOffice: div.address || div.name || '' }));
                    setShowEuDivisions(false); setEuDivisions([]);
                  }}
                  onEuCitiesClose={() => setShowEuCities(false)}
                  onEuDivisionsClose={() => setShowEuDivisions(false)}
                  onCourierAddressChange={(field, value) =>
                    setCourierAddress(prev => ({ ...prev, [field]: value }))
                  }
                />
              )}

              <DeliveryInfo labels={l} />

              <DeliveryCostSummary
                isUkraine={isUkraine}
                deliveryCost={deliveryCost}
                loadingDeliveryCost={loadingDeliveryCost}
                citySelected={!!selectedCityRef}
                labels={l}
              />

              <div className="flex items-center">
                <input type="checkbox" name="callMe" id="callMe" checked={formData.callMe} onChange={handleChange}
                  className="w-4 h-4 text-[#D4A017] border-gray-300 rounded focus:ring-[#D4A017]" />
                <label htmlFor="callMe" className="ml-2 text-sm text-gray-600">{l.callMe}</label>
              </div>

              <button type="submit" disabled={isSubmitting}
                className="w-full bg-[#D4A017] text-white font-bold py-4 px-6 rounded-xl hover:bg-[#b88913] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-lg">
                {isSubmitting ? (
                  <>
                    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>{l.btnLoading}</span>
                  </>
                ) : (
                  <>
                    <FaShoppingCart />
                    <span>{l.btnSubmit}</span>
                  </>
                )}
              </button>
              <p className="text-xs text-gray-400 text-center">{l.agree}</p>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}