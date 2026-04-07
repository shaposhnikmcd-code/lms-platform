export const accessibilityContent = {
  title: 'Deklaracja dostępności',
  lastUpdated: 'Ostatnia aktualizacja: marzec 2026',
  sections: [
    {
      title: '1. Informacje ogólne',
      paragraphs: [
        'Ukraiński Instytut Służby i Psychoterapii (UIMP) dąży do zapewnienia dostępności swojej strony internetowej uimp.com.ua wszystkim użytkownikom, w tym osobom z niepełnosprawnościami.',
        'Niniejsza deklaracja dotyczy strony https://www.uimp.com.ua',
      ],
    },
    {
      title: '2. Standard zgodności',
      paragraphs: [
        'Stosujemy standard WCAG 2.1 na poziomie AA (Web Content Accessibility Guidelines) opracowany przez W3C.',
        'Obecny status: częściowa zgodność — niektóre elementy serwisu są wciąż udoskonalane.',
      ],
    },
    {
      title: '3. Co zrobiliśmy w zakresie dostępności',
      items: [
        'Semantyczna struktura HTML z prawidłową hierarchią nagłówków (H1 → H2 → H3)',
        'Atrybuty alt dla obrazów',
        'Obsługa nawigacji klawiaturą dla głównych elementów',
        'Kontrastowe kolory dla tekstu głównego',
        'Wsparcie dla trzech języków: ukraiński, polski, angielski',
        'HTTPS — bezpieczne połączenie',
      ],
    },
    {
      title: '4. Znane ograniczenia',
      items: [
        'Niektóre elementy nawigacji mogą mieć niewystarczający kontrast kolorów',
        'Niektóre elementy interaktywne są ulepszane w celu pełnej obsługi czytników ekranu',
      ],
    },
    {
      title: '5. Informacja zwrotna',
      paragraphs: [
        'Jeśli napotkasz problem z dostępnością na naszej stronie, prosimy o informację. Staramy się odpowiadać w ciągu 5 dni roboczych.',
      ],
      email: 'uimp.edu@gmail.com',
    },
    {
      title: '6. Organ nadzorczy',
      paragraphs: [
        'Jeśli nie jesteś zadowolony z naszej odpowiedzi, masz prawo skontaktować się z odpowiednim organem nadzorczym ds. dostępności w swoim kraju.',
      ],
    },
  ],
};

export type AccessibilityContent = typeof accessibilityContent;
export default accessibilityContent;
