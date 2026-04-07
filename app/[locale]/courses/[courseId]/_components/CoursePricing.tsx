import Link from "next/link";
import { FaCheck } from "react-icons/fa";
import SendPulseButton from "@/components/SendPulseButton";
import { getTranslations } from "next-intl/server";

interface CoursePricingProps {
  course: {
    id: string;
    title: string;
    price: number;
    sendPulseUrl?: string;
  };
  totalLessons: number;
  isLoggedIn: boolean;
}

export default async function CoursePricing({ course, totalLessons, isLoggedIn }: CoursePricingProps) {
  const t = await getTranslations("DynamicCourse");
  return (
    <section id="price" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
      <div className="relative bg-gradient-to-r from-[#1C3A2E] to-[#2a4f3f] rounded-3xl overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 left-0 w-96 h-96 bg-[#D4A017] rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-0 w-96 h-96 bg-white rounded-full blur-3xl" />
        </div>
        <div className="relative p-12 md:p-16">
          <div className="text-center mb-12">
            <span className="inline-block px-4 py-2 bg-[#D4A017] text-white rounded-full text-sm mb-6">
              {t("investBadge")}
            </span>
            <h2 className="text-4xl font-bold text-white mb-4">{t("priceTitle")}</h2>
          </div>
          <div className="max-w-md mx-auto">
            <div className="bg-white/10 backdrop-blur-sm rounded-3xl p-8 text-center border-2 border-[#D4A017]/30 hover:border-[#D4A017] transition-all">
              <div className="text-sm text-[#D4A017] font-semibold mb-4">{t("fullAccess")}</div>
              <div className="flex items-center justify-center gap-2 mb-6">
                <span className="text-6xl font-black text-white">
                  {course.price.toLocaleString()}
                </span>
                <span className="text-white/60">{t("currency")}</span>
              </div>
              <div className="space-y-3 mb-8 text-white/80">
                <p className="flex items-center justify-center gap-2">
                  <FaCheck className="text-[#D4A017]" /> {totalLessons} {t("lessons")}
                </p>
                <p className="flex items-center justify-center gap-2">
                  <FaCheck className="text-[#D4A017]" /> {t("accessForever")}
                </p>
                <p className="flex items-center justify-center gap-2">
                  <FaCheck className="text-[#D4A017]" /> {t("certAfter")}
                </p>
              </div>
              {course.sendPulseUrl ? (
                <SendPulseButton url={course.sendPulseUrl} />
              ) : isLoggedIn ? (
                <SendPulseButton url="https://uimp-edu.sendpulse.online" />
              ) : (
                <Link
                  href="/"
                  className="block w-full bg-[#D4A017] text-white font-bold py-4 rounded-xl hover:bg-[#b88913] transition-colors text-center"
                >
                  {t("loginToBuy")}
                </Link>
              )}
              <p className="text-white/50 text-sm mt-4">{t("refundGuarantee")}</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
