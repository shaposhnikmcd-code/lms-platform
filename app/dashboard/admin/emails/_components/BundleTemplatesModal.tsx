'use client';
import { EmailTemplatesModal, type EmailTemplatesModalConfig } from '../../yearly-program/_components/PaymentTemplatesModal';
import { PLACEHOLDER_DESCRIPTIONS } from '@/lib/emailTemplates/paymentTemplates';

const BUNDLE_CONFIG: EmailTemplatesModalConfig = {
  apiBase: '/api/admin/emails/bundle-templates',
  modalTitle: 'Курси і Пакети',
  modalSubtitle: 'Підтвердження покупки пакета · 1 шаблон',
  introText:
    'Лист, що надсилається студенту відразу після успішної оплати пакета. Містить перелік курсів і кнопку до особистого кабінету.',
  placeholderDescriptions: PLACEHOLDER_DESCRIPTIONS,
  groupAccents: { bundle: 'amber' },
  cacheKey: 'bundle',
  sideBySidePreview: true,
};

type Theme = 'light' | 'dark';

export default function BundleTemplatesModal({
  theme,
  onClose,
}: {
  theme: Theme;
  onClose: () => void;
}) {
  return <EmailTemplatesModal config={BUNDLE_CONFIG} theme={theme} onClose={onClose} />;
}
