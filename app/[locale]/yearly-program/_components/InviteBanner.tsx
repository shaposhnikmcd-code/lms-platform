type Props = {
  email: string;
  cohortName: string | null;
};

/// Банер вгорі сторінки /yearly-program, коли студент перейшов за invite-посиланням
/// від менеджера. Показує email і назву cohort-у. План студент обирає на сторінці.
export default function InviteBanner({ email, cohortName }: Props) {
  return (
    <div className="bg-gradient-to-r from-[#1C3A2E] to-[#2a4f3f] border-b border-[#D4A017]/30">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-4">
        <div className="shrink-0 w-10 h-10 rounded-full bg-[#D4A017]/20 border border-[#D4A017]/40 flex items-center justify-center text-xl">
          📨
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[13px] sm:text-sm font-semibold text-white">
            Запрошення на Річну програму
            {cohortName ? (
              <span className="text-[#D4A017] font-medium ml-1">· {cohortName}</span>
            ) : null}
          </div>
          <div className="text-[11px] sm:text-xs text-white/70 mt-0.5 truncate">
            Для <span className="font-medium text-white">{email}</span> · оберіть зручний варіант оплати нижче
          </div>
        </div>
        <div className="hidden sm:block shrink-0 px-3 py-1.5 rounded-full bg-[#D4A017]/15 border border-[#D4A017]/30 text-[11px] font-semibold text-[#D4A017] uppercase tracking-wider">
          Тільки для вас
        </div>
      </div>
    </div>
  );
}
