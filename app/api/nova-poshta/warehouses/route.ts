// app/api/nova-poshta/warehouses/route.ts
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { cityName, searchString } = await request.json();

    console.log('Пошук для міста:', cityName);

    // Отримуємо відділення直接用 назву міста
    const response = await fetch('https://api.novaposhta.ua/v2.0/json/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        apiKey: process.env.NOVA_POSHTA_API_KEY,
        modelName: 'Address',
        calledMethod: 'getWarehouses',
        methodProperties: {
          CityName: cityName,
          FindByString: searchString || '',
          Page: '1',
          Limit: '50',
          Language: 'UA'
        }
      })
    });

    const data = await response.json();
    console.log('Знайдено відділень:', data.data?.length || 0);
    
    return NextResponse.json({ 
      warehouses: data.data || [] 
    });
    
  } catch (error) {
    console.error('❌ Помилка:', error);
    return NextResponse.json({ warehouses: [] });
  }
}