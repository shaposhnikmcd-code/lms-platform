// Документ юридично чинний українською — для en показуємо оригінальний текст
// з поміткою мовою локалі; перекладено лише заголовок сторінки.
import { offerContent as uk, type OfferContent } from './uk';

export const offerContent: OfferContent = {
  ...uk,
  title: "Public Offer",
  languageNote: "The legally binding text of this document is in Ukrainian.",
};

export default offerContent;
