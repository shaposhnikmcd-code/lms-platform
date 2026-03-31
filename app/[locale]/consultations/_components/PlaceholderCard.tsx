interface Props {
  soon: string;
  soonSubtitle: string;
}

export default function PlaceholderCard({ soon, soonSubtitle }: Props) {
  return (
    <div className="bg-white rounded-3xl shadow-sm overflow-hidden border-2 border-dashed border-gray-200">
      <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 2fr 0.9fr' }}>

        <div className="bg-gray-50 min-h-[280px] flex flex-col items-center justify-center gap-4 p-8" style={{ borderRight: '1px solid #f3f4f6' }}>
          <div className="w-24 h-24 rounded-full bg-gray-200 flex items-center justify-center">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="8" r="4" fill="#d1d5db" />
              <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke="#d1d5db" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </div>
          <div className="text-center">
            <div className="h-3 w-28 bg-gray-200 rounded-full mx-auto mb-2" />
            <div className="h-2 w-20 bg-gray-100 rounded-full mx-auto" />
          </div>
        </div>

        <div className="flex flex-col">
          <div className="grid grid-cols-2 gap-0" style={{ borderBottom: '1px solid #f3f4f6' }}>
            <div className="px-6 py-5 space-y-2" style={{ borderRight: '1px solid #f3f4f6' }}>
              <div className="h-2 bg-gray-100 rounded-full w-full" />
              <div className="h-2 bg-gray-100 rounded-full w-5/6" />
              <div className="h-2 bg-gray-100 rounded-full w-4/6" />
            </div>
            <div className="px-6 py-5 space-y-2">
              {[1, 2, 3].map((_, j) => (
                <div key={j} className="h-8 bg-gray-50 rounded-lg border border-gray-100" />
              ))}
            </div>
          </div>
          <div className="px-6 py-5 space-y-2 flex-1 bg-[#fafbfa]">
            {[1, 2, 3, 4, 5].map((_, j) => (
              <div key={j} className="h-6 bg-gray-100 rounded-lg" />
            ))}
          </div>
        </div>

        <div className="flex flex-col" style={{ borderLeft: '1px solid #f3f4f6' }}>
          <div className="h-1 bg-gray-200 w-full" />
          <div className="px-6 py-8 flex flex-col flex-1 justify-center items-center gap-6">
            <div className="text-center">
              <div className="h-2 w-16 bg-gray-200 rounded-full mx-auto mb-3" />
              <div className="h-8 w-28 bg-gray-100 rounded-xl mx-auto" />
            </div>
            <div className="w-1.5 h-1.5 bg-gray-200 rounded-full" />
            <div className="text-center w-full">
              <div className="h-2 w-16 bg-gray-200 rounded-full mx-auto mb-3" />
              <div className="h-4 w-20 bg-gray-100 rounded-full mx-auto" />
            </div>
            <div className="w-full rounded-xl border-2 border-dashed border-gray-200 py-4 flex flex-col items-center gap-1">
              <p className="text-sm font-semibold text-gray-400">{soon}</p>
              <p className="text-xs text-gray-300">{soonSubtitle}</p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}