const SUPPORT_EMAIL = 'support@uimp.com.ua';

interface Labels {
  deliveryTitle: string;
  deliveryText: string;
  deliveryContact: string;
}

export default function DeliveryInfo({ labels }: { labels: Labels }) {
  return (
    <div className="p-4 bg-[#E8F5E0] rounded-lg text-sm text-[#1C3A2E]">
      <p className="font-medium mb-1">{"📦 "}{labels.deliveryTitle}</p>
      <p>{labels.deliveryText}</p>
      <p className="mt-1">
        {labels.deliveryContact}{" "}
        <a href={`mailto:${SUPPORT_EMAIL}`} className="text-[#D4A017] underline">{SUPPORT_EMAIL}</a>
      </p>
    </div>
  );
}