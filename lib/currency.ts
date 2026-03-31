export function getCurrency(locale: string): string {
  switch (locale) {
    case 'pl': return 'UAH';
    case 'en': return 'UAH';
    default: return 'грн';
  }
}