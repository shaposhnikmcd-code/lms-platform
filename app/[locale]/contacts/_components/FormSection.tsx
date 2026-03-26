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
  };
  social: { title: string; followLabel: string };
  telegram: { title: string; subtitle: string; btn: string };
};

export default function FormSection({ form }: Props) {
  return (
    <section style={{ padding: '0 48px 64px' }}>
      <div style={{ maxWidth: 600, margin: '0 auto' }}>
        <div style={{ background: 'white', borderRadius: 20, padding: '36px', boxShadow: '0 2px 12px rgba(28,58,46,0.06)' }}>
          <h2 style={{ fontFamily: sysFont, fontSize: 22, fontWeight: 700, color: '#1C3A2E', margin: '0 0 24px' }}>{form.title}</h2>
          <form action="https://formsubmit.co/uimp.edu@gmail.com" method="POST" style={{ display: 'flex', flexDirection: 'column' as const, gap: 16 }}>
            <input type="hidden" name="_subject" value="Новий запит з сайту UIMP" />
            <input type="hidden" name="_captcha" value="false" />
            <input type="hidden" name="_next" value="https://www.uimp.com.ua/contacts?sent=true" />
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 6, fontFamily: sysFont }}>{form.namLabel}</label>
              <input type="text" name="name" required placeholder={form.namePlaceholder} style={{ width: '100%', borderWidth: 1, borderStyle: 'solid', borderColor: '#e5e7eb', borderRadius: 10, padding: '10px 14px', fontSize: 13, fontFamily: sysFont, outline: 'none', boxSizing: 'border-box' as const }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 6, fontFamily: sysFont }}>{form.emailLabel}</label>
              <input type="email" name="email" required placeholder="your@email.com" style={{ width: '100%', borderWidth: 1, borderStyle: 'solid', borderColor: '#e5e7eb', borderRadius: 10, padding: '10px 14px', fontSize: 13, fontFamily: sysFont, outline: 'none', boxSizing: 'border-box' as const }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 6, fontFamily: sysFont }}>{form.messageLabel}</label>
              <textarea name="message" required rows={5} placeholder={form.messagePlaceholder} style={{ width: '100%', borderWidth: 1, borderStyle: 'solid', borderColor: '#e5e7eb', borderRadius: 10, padding: '10px 14px', fontSize: 13, fontFamily: sysFont, outline: 'none', resize: 'none' as const, boxSizing: 'border-box' as const }} />
            </div>
            <button type="submit" style={{ background: '#1C3A2E', color: 'white', fontFamily: sysFont, fontWeight: 600, fontSize: 14, padding: '12px', borderRadius: 12, border: 'none', cursor: 'pointer' }}>
              {form.btnSubmit}
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}