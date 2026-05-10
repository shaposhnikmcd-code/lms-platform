'use client';
import { EmailTemplatesModal, type EmailTemplatesModalConfig } from '../../yearly-program/_components/PaymentTemplatesModal';
import { PLACEHOLDER_DESCRIPTIONS } from '@/lib/emailTemplates/paymentTemplates';

const YEARLY_TG_CONFIG: EmailTemplatesModalConfig = {
  apiBase: '/api/admin/emails/yearly-telegram-templates',
  modalTitle: 'Річна Telegram',
  modalSubtitle: 'Запрошення до Telegram-каналу Річної програми',
  introText:
    'Лист, який менеджер вручну надсилає студенту з адмін-картки Річної підписки, щоб повторно дати посилання на Telegram-канал.',
  placeholderDescriptions: PLACEHOLDER_DESCRIPTIONS,
  groupAccents: { 'yearly-telegram': 'sky' },
  cacheKey: 'yearly-telegram',
  sideBySidePreview: true,
};

type Theme = 'light' | 'dark';

export default function YearlyTelegramTemplatesModal({
  theme,
  onClose,
}: {
  theme: Theme;
  onClose: () => void;
}) {
  return <EmailTemplatesModal config={YEARLY_TG_CONFIG} theme={theme} onClose={onClose} />;
}
