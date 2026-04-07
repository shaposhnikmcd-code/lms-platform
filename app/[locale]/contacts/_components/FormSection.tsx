'use client';

import { useState } from 'react';

const sysFont = '-apple-system, BlinkMacSystemFont, sans-serif';

type Props = {
  form: {
    title: string;
    namLabel: string;
    namePlaceholder: string;
    emailLabel: string;
    messageLabel: string;
    messagePlaceholder: string;
    btnSubmit: string;
    sending: string;
    success: string;
    errorMsg: string;
  };
  social: { title: string; followLabel: string };
  telegram: { title: string; subtitle: string; btn: string };
};

const sectionStyle: React.CSSProperties = { padding: '40px 16px 60px' };
const cardStyle: React.CSSProperties = { maxWidth: 600, margin: '0 auto', background: 'white', borderRadius: 20, padding: '36px', boxShadow: '0 2px 12px rgba(28,58,46,0.06)' };
const titleStyle: React.CSSProperties = { fontFamily: sysFont, fontSize: 22, fontWeight: 700, color: '#1C3A2E', margin: '0 0 24px' };
const formStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column' as const, gap: 16 };
const labelStyle: React.CSSProperties = { display: 'block', fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 6, fontFamily: sysFont };
const inputStyle: React.CSSProperties = { width: '100%', borderWidth: 1, borderStyle: 'solid', borderColor: '#e5e7eb', borderRadius: 10, padding: '10px 14px', fontSize: 13, fontFamily: sysFont, outline: 'none', boxSizing: 'border-box' as const };
const textareaStyle: React.CSSProperties = { width: '100%', borderWidth: 1, borderStyle: 'solid', borderColor: '#e5e7eb', borderRadius: 10, padding: '10px 14px', fontSize: 13, fontFamily: sysFont, outline: 'none', resize: 'none' as const, boxSizing: 'border-box' as const };
const btnStyle: React.CSSProperties = { background: '#1C3A2E', color: 'white', fontFamily: sysFont, fontWeight: 600, fontSize: 14, padding: '12px', borderRadius: 12, border: 'none', cursor: 'pointer' };
const successStyle: React.CSSProperties = { fontFamily: sysFont, fontSize: 14, color: '#1C3A2E', textAlign: 'center' as const, padding: '16px', backgroundColor: 'rgba(28,58,46,0.06)', borderRadius: 12 };
const errorStyle: React.CSSProperties = { fontFamily: sysFont, fontSize: 14, color: '#dc2626', textAlign: 'center' as const, padding: '16px', backgroundColor: 'rgba(220,38,38,0.06)', borderRadius: 12 };

export default function FormSection({ form }: Props) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus('loading');
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, message }),
      });
      const data = await res.json();
      if (data.success) {
        setStatus('success');
        setName('');
        setEmail('');
        setMessage('');
      } else {
        setStatus('error');
      }
    } catch {
      setStatus('error');
    }
  }

  return (
    <section style={sectionStyle}>
      <div style={cardStyle}>
        <h2 style={titleStyle}>{form.title}</h2>
        {status === 'success' && (
          <p style={successStyle}>{form.success}</p>
        )}
        {status === 'error' && (
          <p style={errorStyle}>{form.errorMsg}</p>
        )}
        {status !== 'success' && (
          <form onSubmit={handleSubmit} style={formStyle}>
            <div>
              <label style={labelStyle}>{form.namLabel}</label>
              <input type="text" required placeholder={form.namePlaceholder} value={name} onChange={e => setName(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>{form.emailLabel}</label>
              <input type="email" required placeholder="your@email.com" value={email} onChange={e => setEmail(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>{form.messageLabel}</label>
              <textarea required rows={5} placeholder={form.messagePlaceholder} value={message} onChange={e => setMessage(e.target.value)} style={textareaStyle} />
            </div>
            <button type="submit" style={btnStyle} disabled={status === 'loading'}>
              {status === 'loading' ? form.sending : form.btnSubmit}
            </button>
          </form>
        )}
      </div>
    </section>
  );
}