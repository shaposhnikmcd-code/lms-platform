import { NextResponse } from 'next/server';

const LVIV_REF = '8d5a980d-391c-11dd-90d9-001a92567626';

export async function POST(request: Request) {
  try {
    const { cityRef, serviceType } = await request.json();

    const response = await fetch('https://api.novaposhta.ua/v2.0/json/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        apiKey: process.env.NOVA_POSHTA_API_KEY,
        modelName: 'InternetDocument',
        calledMethod: 'getDocumentPrice',
        methodProperties: {
          CitySender: LVIV_REF,
          CityRecipient: cityRef,
          ServiceType: serviceType,
          Weight: '0.5',
          Cost: '1099',
          CargoType: 'Parcel',
          SeatsAmount: '1',
        },
      }),
    });

    const data = await response.json();
    const cost = data.data?.[0]?.Cost || null;

    return NextResponse.json({ cost });
  } catch (error) {
    console.error('❌ Delivery cost error:', error);
    return NextResponse.json({ cost: null });
  }
}