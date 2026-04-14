export interface CatalogCourse {
  slug: string;
  titleUk: string;
  titleKey: string;
  price: number;
  icon: string;
  accent: string;
  accentRgb: string;
  tagKey: string;
  descKey: string;
}

export const COURSES_CATALOG: CatalogCourse[] = [
  {
    slug: 'psychology-basics',
    titleUk: 'Основи психології',
    titleKey: 'courses.psychology.title',
    price: 3500,
    icon: '🧠',
    accent: '#D4A843',
    accentRgb: '212,168,67',
    tagKey: 'tags.biblicalTherapy',
    descKey: 'courses.psychology.description',
  },
  {
    slug: 'psychiatry-basics',
    titleUk: 'Основи психіатрії',
    titleKey: 'courses.psychiatry.title',
    price: 3500,
    icon: '🩺',
    accent: '#C4919A',
    accentRgb: '196,145,154',
    tagKey: 'tags.forPsychologists',
    descKey: 'courses.psychiatry.description',
  },
  {
    slug: 'mentorship',
    titleUk: 'Основи душеопікунства',
    titleKey: 'courses.mentorship.title',
    price: 3500,
    icon: '🫂',
    accent: '#1C3A2E',
    accentRgb: '28,58,46',
    tagKey: 'tags.forBeginners',
    descKey: 'courses.mentorship.description',
  },
  {
    slug: 'psychotherapy-of-biblical-heroes',
    titleUk: 'Психотерапія біблійних героїв',
    titleKey: 'courses.biblicalHeroes.title',
    price: 1400,
    icon: '📖',
    accent: '#C4919A',
    accentRgb: '196,145,154',
    tagKey: 'tags.newPerspective',
    descKey: 'courses.biblicalHeroes.description',
  },
  {
    slug: 'sex-education',
    titleUk: 'Статеве виховання',
    titleKey: 'courses.sexEd.title',
    price: 4300,
    icon: '👨‍👩‍👧',
    accent: '#D4A843',
    accentRgb: '212,168,67',
    tagKey: 'tags.forParents',
    descKey: 'courses.sexEd.description',
  },
  {
    slug: 'military-psychology',
    titleUk: 'Військова психологія',
    titleKey: 'courses.militaryPsy.title',
    price: 5999,
    icon: '🪖',
    accent: '#1C3A2E',
    accentRgb: '28,58,46',
    tagKey: 'tags.forMilitary',
    descKey: 'courses.militaryPsy.description',
  },
  {
    slug: 'emotional-intelligence',
    titleUk: 'Емоційний інтелект',
    titleKey: 'courses.emotionalIQ.title',
    price: 1499,
    icon: '🧠',
    accent: '#D4A843',
    accentRgb: '212,168,67',
    tagKey: 'tags.forEveryone',
    descKey: 'courses.emotionalIQ.description',
  },
];

export const COURSES_BY_SLUG: Record<string, CatalogCourse> = Object.fromEntries(
  COURSES_CATALOG.map((c) => [c.slug, c])
);
