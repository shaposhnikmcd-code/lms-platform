// Документ юридично чинний українською — для pl показуємо оригінальний текст
// з поміткою мовою локалі; перекладено лише заголовок сторінки.
import { offerContent as uk, type OfferContent } from './uk';

export const offerContent: OfferContent = {
  ...uk,
  title: "Oferta publiczna",
  languageNote: "Prawnie wiążący tekst tego dokumentu jest w języku ukraińskim.",
};

export default offerContent;
