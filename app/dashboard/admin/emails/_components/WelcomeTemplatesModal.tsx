'use client';
import { EmailTemplatesModal, type EmailTemplatesModalConfig } from '../../yearly-program/_components/PaymentTemplatesModal';
import { PLACEHOLDER_DESCRIPTIONS } from '@/lib/emailTemplates/paymentTemplates';

const WELCOME_CONFIG: EmailTemplatesModalConfig = {
  apiBase: '/api/admin/emails/welcome-templates',
  modalTitle: 'Річна — Welcome',
  modalSubtitle: 'Вітальний лист на першу оплату Річної програми',
  introText:
    'Лист, який сайт автоматично надсилає кожному, хто записався на Річну програму (перша оплата). Містить запрошення в Telegram-канал — посилання підставляється персонально для кожного студента.',
  placeholderDescriptions: PLACEHOLDER_DESCRIPTIONS,
  groupAccents: { welcome: 'amber' },
  cacheKey: 'welcome',
  sideBySidePreview: true,
};

type Theme = 'light' | 'dark';

export default function WelcomeTemplatesModal({
  theme,
  onClose,
}: {
  theme: Theme;
  onClose: () => void;
}) {
  return <EmailTemplatesModal config={WELCOME_CONFIG} theme={theme} onClose={onClose} />;
}
