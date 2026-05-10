'use client';
import { EmailTemplatesModal, type EmailTemplatesModalConfig } from '../../yearly-program/_components/PaymentTemplatesModal';
import { PLACEHOLDER_DESCRIPTIONS } from '@/lib/emailTemplates/paymentTemplates';

const SYSTEM_CONFIG: EmailTemplatesModalConfig = {
  apiBase: '/api/admin/emails/system-templates',
  modalTitle: 'Системні листи',
  modalSubtitle: 'Скидання пароля · Тест Конектор-менеджера · Telegram-invite Річної',
  introText:
    'Сервісні листи поза основним продажним флоу. Текст шаблонів редагується тут — вступ до листа, кнопки, підпис.',
  placeholderDescriptions: PLACEHOLDER_DESCRIPTIONS,
  groupAccents: { system: 'rose' },
  cacheKey: 'system',
  sideBySidePreview: true,
};

type Theme = 'light' | 'dark';

export default function SystemTemplatesModal({
  theme,
  onClose,
}: {
  theme: Theme;
  onClose: () => void;
}) {
  return <EmailTemplatesModal config={SYSTEM_CONFIG} theme={theme} onClose={onClose} />;
}
