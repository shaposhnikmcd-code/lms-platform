"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FaPause, FaPlay } from "react-icons/fa";

interface SuspendButtonProps {
  bundleId: string;
  suspendedAt: string | null;
  resumeAt: string | null;
}

export default function SuspendButton({ bundleId, suspendedAt }: SuspendButtonProps) {
  const router = useRouter();
  const [showModal, setShowModal] = useState(false);
  const [date, setDate] = useState("");
  const [loading, setLoading] = useState(false);
  const isSuspended = !!suspendedAt;

  const patch = (data: Record<string, unknown>) =>
    fetch(`/api/admin/bundles/${bundleId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
      credentials: "include",
    });

  const handleSuspend = async () => {
    setLoading(true);
    try {
      const res = await patch({
        suspendedAt: new Date().toISOString(),
        resumeAt: date || null,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(JSON.stringify(data, null, 2));
        return;
      }
      router.refresh();
    } catch (err) {
      alert(`Fetch помилка: ${err}`);
    } finally {
      setLoading(false);
      setShowModal(false);
      setDate("");
    }
  };

  const handleResume = async () => {
    setLoading(true);
    try {
      await patch({ suspendedAt: null, resumeAt: null });
      router.refresh();
    } finally {
      setLoading(false);
    }
  };

  if (isSuspended) {
    return (
      <button
        onClick={handleResume}
        disabled={loading}
        className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 text-xs font-medium rounded-lg hover:bg-emerald-100 ring-1 ring-emerald-200 transition-colors disabled:opacity-50 w-full"
      >
        <FaPlay className="text-[10px]" />
        {loading ? "..." : "Увімкнути"}
      </button>
    );
  }

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-amber-50 text-amber-700 text-xs font-medium rounded-lg hover:bg-amber-100 ring-1 ring-amber-200 transition-colors w-full"
      >
        <FaPause className="text-[10px]" />
        Призупинити
      </button>

      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm mx-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-slate-800 mb-1">Призупинити пакет</h3>
            <p className="text-sm text-slate-500 mb-5">Пакет зникне з вітрини. Можна задати дату автоматичного повернення.</p>

            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Повернути автоматично (необов&apos;язково)
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              min={new Date().toISOString().split("T")[0]}
              onClick={(e) => (e.target as HTMLInputElement).showPicker()}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 mb-5 cursor-pointer"
            />

            {date && (
              <p className="text-xs text-slate-500 mb-4 -mt-3">
                Пакет повернеться на вітрину <span className="font-semibold">{new Date(date).toLocaleDateString("uk-UA")}</span>
              </p>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => { setShowModal(false); setDate(""); }}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors"
              >
                Скасувати
              </button>
              <button
                onClick={handleSuspend}
                disabled={loading}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-amber-500 rounded-xl hover:bg-amber-600 transition-colors disabled:opacity-50"
              >
                {loading ? "..." : "Призупинити"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
