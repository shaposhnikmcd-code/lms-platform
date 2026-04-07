export const accessibilityContent = {
  title: 'Accessibility Statement',
  lastUpdated: 'Last updated: March 2026',
  sections: [
    {
      title: '1. General Information',
      paragraphs: [
        'The Ukrainian Institute of Ministry and Psychotherapy (UIMP) is committed to making its website uimp.com.ua accessible to all users, including people with disabilities.',
        'This statement applies to the website https://www.uimp.com.ua',
      ],
    },
    {
      title: '2. Conformance Standard',
      paragraphs: [
        'We aim to comply with the WCAG 2.1 Level AA standard (Web Content Accessibility Guidelines) developed by the W3C.',
        'Current status: partial conformance — some elements of the site are still being improved.',
      ],
    },
    {
      title: '3. What We Have Done for Accessibility',
      items: [
        'Semantic HTML structure with a proper heading hierarchy (H1 → H2 → H3)',
        'Alt attributes for images',
        'Keyboard navigation support for the main elements',
        'High-contrast colors for body text',
        'Support for three languages: Ukrainian, Polish, English',
        'HTTPS — secure connection',
      ],
    },
    {
      title: '4. Known Limitations',
      items: [
        'Some navigation elements may have insufficient color contrast',
        'Certain interactive elements are being improved for full screen reader support',
      ],
    },
    {
      title: '5. Feedback',
      paragraphs: [
        'If you encounter an accessibility issue on our website, please let us know. We try to respond within 5 business days.',
      ],
      email: 'uimp.edu@gmail.com',
    },
    {
      title: '6. Supervisory Authority',
      paragraphs: [
        'If you are not satisfied with our response, you have the right to contact the relevant accessibility supervisory authority in your country.',
      ],
    },
  ],
};

export type AccessibilityContent = typeof accessibilityContent;
export default accessibilityContent;
