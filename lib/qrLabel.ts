export function getQrLabel(locale: string): { line1: string; line2: string } {
  switch (locale) {
    case 'en':
      return { line1: 'Scan', line2: 'to open the course' };
    case 'pl':
      return { line1: 'Zeskanuj,', line2: 'aby otworzyć kurs' };
    default:
      return { line1: 'Скануйте,', line2: 'щоб відкрити курс' };
  }
}
