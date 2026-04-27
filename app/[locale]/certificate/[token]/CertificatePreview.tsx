'use client';

/// Простий PDF preview через iframe. Браузер сам покаже завантаження.
export function CertificatePreview({
  pdfUrl,
  certNumber,
  fallbackUrl,
}: {
  pdfUrl: string;
  certNumber: string;
  fallbackUrl: string;
}) {
  return (
    <div className="rounded-2xl border border-stone-200 bg-stone-100 shadow-md overflow-hidden">
      <iframe
        src={`${pdfUrl}#toolbar=0&navpanes=0&view=FitH`}
        title={`Сертифікат ${certNumber}`}
        className="w-full border-0 block"
        style={{ height: 'min(80vh, 700px)' }}
      />
      <div className="p-3 text-center text-[12px] text-stone-500 border-t border-stone-200 bg-white">
        Не бачите попередній перегляд?{' '}
        <a href={fallbackUrl} className="text-amber-700 font-semibold underline">
          Завантажити PDF
        </a>
      </div>
    </div>
  );
}
