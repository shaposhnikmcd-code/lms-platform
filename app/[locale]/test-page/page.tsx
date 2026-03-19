// app/test-page/page.tsx
'use client';

import { useState } from "react";

export default function TestPage() {
  const [show, setShow] = useState(false);

  return (
    <div style={{ padding: '50px' }}>
      <button 
        onClick={() => setShow(true)}
        style={{
          padding: '15px 30px',
          background: '#1C3A2E',
          color: 'white',
          border: 'none',
          borderRadius: '5px',
          fontSize: '18px',
          cursor: 'pointer'
        }}
      >
        Відкрити модалку
      </button>

      {show && (
        <>
          {/* Затемнення */}
          <div 
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0,0,0,0.5)',
              zIndex: 999998
            }}
            onClick={() => setShow(false)}
          />
          
          {/* Модалка */}
          <div
            style={{
              position: 'fixed',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              backgroundColor: 'white',
              padding: '40px',
              borderRadius: '10px',
              zIndex: 999999,
              maxWidth: '400px',
              width: '90%',
              boxShadow: '0 10px 25px rgba(0,0,0,0.2)'
            }}
          >
            <h2 style={{ fontSize: '24px', marginBottom: '20px' }}>Тест</h2>
            <p style={{ marginBottom: '30px' }}>Це вікно має бути по центру</p>
            <button 
              onClick={() => setShow(false)}
              style={{
                padding: '10px 20px',
                background: '#1C3A2E',
                color: 'white',
                border: 'none',
                borderRadius: '5px',
                cursor: 'pointer'
              }}
            >
              Закрити
            </button>
          </div>
        </>
      )}
    </div>
  );
}