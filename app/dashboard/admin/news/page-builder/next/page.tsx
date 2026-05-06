"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { NewsMeta } from "../../_components/editor/types";

// Білдер "Наступної сторінки" /news. Працює з staged-копією (next* поля
// NewsPage). При відкритті — якщо staged ще нема, /api/admin/news/page-content/next
// віддає live як стартовий стан, щоб менеджер міг внести точкові правки замість
// верстати з нуля. При збереженні зберігається у staged + `nextPublishAt` —
// далі cron `/api/cron/news-page-publish` (раз на годину) копіює staged → live
// коли настає час публікації.

const NewsEditor = dynamic(() => import("../../_components/editor/NewsEditor"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-[#D4A843] border-t-transparent rounded-full animate-spin" />
    </div>
  ),
});

const ff = "-apple-system, BlinkMacSystemFont, sans-serif";

// Перетворює ISO у формат datetime-local (YYYY-MM-DDTHH:mm) — input того
// типу не приймає TZ. Працюємо в локальній зоні менеджера, БД зберігає UTC.
function isoToLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function localInputToIso(s: string): string | null {
  if (!s) return null;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

export default function NewsPageBuilderNext() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [initialMeta, setInitialMeta] = useState<Partial<NewsMeta>>({});
  const [initialContent, setInitialContent] = useState("");
  const [hasStaged, setHasStaged] = useState(false);
  const [publishAtLocal, setPublishAtLocal] = useState("");
  const [actionPending, setActionPending] = useState<null | "publishNow" | "discard">(null);
  const [toast, setToast] = useState<{ message: string; type: "error" | "success" } | null>(null);

  useEffect(() => {
    fetch("/api/admin/news/page-content/next")
      .then(r => { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
      .then(d => {
        if (d) {
          setHasStaged(!!d.hasStaged);
          setInitialMeta({
            title: "", slug: "", excerpt: "", category: "NEWS", imageUrl: "",
            pageBgColor: d.pageBgColor || "",
            published: true,
          });
          // Очистка legacy newsList.
          let cleaned = d.content || "";
          try {
            const parsed = JSON.parse(d.content || "[]");
            if (Array.isArray(parsed)) {
              const filtered = parsed.filter((b: { type?: string }) => b?.type !== "newsList");
              cleaned = JSON.stringify(filtered);
            }
          } catch {/* not JSON */}
          setInitialContent(cleaned);
          setPublishAtLocal(isoToLocalInput(d.publishAt));
        } else {
          setInitialMeta({ title: "", slug: "", excerpt: "", category: "NEWS", imageUrl: "", pageBgColor: "", published: true });
          setInitialContent("");
        }
        setLoading(false);
      })
      .catch(e => { setError("Помилка завантаження: " + e.message); setLoading(false); });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  const handleSave = async (meta: NewsMeta, content: string) => {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/news/page-content/next", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content,
          pageBgColor: meta.pageBgColor || null,
          publishAt: localInputToIso(publishAtLocal),
        }),
      });
      if (res.ok) {
        router.push("/dashboard/admin/news");
        return;
      }
      const body = await res.json().catch(() => ({}));
      throw new Error(body?.error || `Помилка збереження (HTTP ${res.status})`);
    } finally {
      setSaving(false);
    }
  };

  const publishNow = async () => {
    if (!confirm("Опублікувати наступну сторінку зараз? Поточна live-версія буде замінена.")) return;
    setActionPending("publishNow");
    try {
      const res = await fetch("/api/admin/news/page-content/next", { method: "POST" });
      if (res.ok) {
        setToast({ message: "Опубліковано — наступна сторінка стала live", type: "success" });
        setTimeout(() => router.push("/dashboard/admin/news"), 800);
      } else {
        const body = await res.json().catch(() => ({}));
        setToast({ message: body?.error || "Не вдалось опублікувати", type: "error" });
      }
    } catch {
      setToast({ message: "Помилка мережі", type: "error" });
    } finally {
      setActionPending(null);
    }
  };

  const discardStaged = async () => {
    if (!confirm("Видалити чернетку наступної сторінки? Усі несейвлені зміни буде втрачено.")) return;
    setActionPending("discard");
    try {
      const res = await fetch("/api/admin/news/page-content/next", { method: "DELETE" });
      if (res.ok) {
        setToast({ message: "Чернетку видалено", type: "success" });
        setTimeout(() => router.push("/dashboard/admin/news"), 800);
      } else {
        setToast({ message: "Не вдалось видалити", type: "error" });
      }
    } catch {
      setToast({ message: "Помилка мережі", type: "error" });
    } finally {
      setActionPending(null);
    }
  };

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "256px" }}>
      <div style={{ width: "32px", height: "32px", borderWidth: "4px", borderStyle: "solid", borderColor: "#1C3A2E", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
    </div>
  );

  if (error) return (
    <div style={{ padding: "24px" }}>
      <div style={{ background: "#FEF2F2", borderWidth: "1px", borderStyle: "solid", borderColor: "#FECACA", borderRadius: "12px", padding: "24px", color: "#DC2626" }}>{error}</div>
    </div>
  );

  return (
    <>
      {/* Sticky banner з контролем nextPublishAt + швидкими діями. Завжди над
          NewsEditor — щоб менеджер бачив контекст: це staged, є таймер. */}
      <div style={{
        position: "sticky", top: 0, zIndex: 30,
        padding: "10px 18px",
        background: "linear-gradient(90deg, #FAF6F0 0%, #FCF5E2 100%)",
        borderBottom: "1px solid #E8D5B7",
        boxShadow: "0 2px 8px rgba(28,58,46,0.04)",
        fontFamily: ff,
        display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            width: "26px", height: "26px", borderRadius: "8px",
            background: "#D4A843", color: "#1C3A2E", fontSize: "13px", fontWeight: 800,
          }}>🕒</span>
          <div>
            <div style={{ fontSize: "12px", fontWeight: 700, color: "#1C3A2E", lineHeight: 1.1 }}>
              Наступна сторінка /news
            </div>
            <div style={{ fontSize: "10px", color: "#9B7C45", marginTop: "2px" }}>
              {hasStaged ? "Чернетка вже існує — редагуєш існуючу версію" : "Стартує з копії live; зберегти створить чернетку"}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginLeft: "auto", flexWrap: "wrap" }}>
          <label style={{ fontSize: "11px", fontWeight: 600, color: "#1C3A2E" }}>
            Опублікувати:
          </label>
          <input
            type="datetime-local"
            value={publishAtLocal}
            onChange={(e) => setPublishAtLocal(e.target.value)}
            style={{
              padding: "6px 10px", borderRadius: "8px",
              border: "1.5px solid #E8D5B7", background: "#FFFFFF",
              fontSize: "12px", color: "#1C3A2E", fontFamily: ff,
              outline: "none",
            }}
          />
          {publishAtLocal && (
            <button
              type="button"
              onClick={() => setPublishAtLocal("")}
              title="Прибрати таймер — чернетка не публікуватиметься автоматично"
              style={{
                width: "28px", height: "28px", borderRadius: "6px",
                border: "1px solid #E8D5B7", background: "#FFFFFF",
                color: "#9B7C45", cursor: "pointer", fontSize: "12px",
              }}
            >✕</button>
          )}
          <span style={{ width: "1px", height: "22px", background: "#E8D5B7", margin: "0 4px" }} />
          {hasStaged && (
            <>
              <button
                type="button"
                onClick={publishNow}
                disabled={actionPending !== null}
                style={{
                  padding: "7px 14px", borderRadius: "8px",
                  border: "none", background: "#1C3A2E", color: "#D4A843",
                  fontSize: "12px", fontWeight: 700, cursor: "pointer", fontFamily: ff,
                  opacity: actionPending ? 0.6 : 1,
                }}
              >{actionPending === "publishNow" ? "..." : "Опублікувати зараз"}</button>
              <button
                type="button"
                onClick={discardStaged}
                disabled={actionPending !== null}
                style={{
                  padding: "7px 12px", borderRadius: "8px",
                  border: "1px solid #FECACA", background: "#FFFFFF", color: "#B91C1C",
                  fontSize: "12px", fontWeight: 600, cursor: "pointer", fontFamily: ff,
                  opacity: actionPending ? 0.6 : 1,
                }}
              >{actionPending === "discard" ? "..." : "Скасувати чернетку"}</button>
            </>
          )}
        </div>
      </div>

      {toast && (
        <div style={{
          position: "fixed", top: "76px", right: "24px", zIndex: 50,
          padding: "10px 16px", borderRadius: "12px",
          background: toast.type === "success" ? "rgba(16,185,129,0.12)" : "rgba(239,68,68,0.12)",
          border: `1px solid ${toast.type === "success" ? "rgba(16,185,129,0.35)" : "rgba(239,68,68,0.35)"}`,
          color: toast.type === "success" ? "#065F46" : "#991B1B",
          fontSize: "13px", fontWeight: 600, fontFamily: ff,
          boxShadow: "0 10px 30px rgba(0,0,0,0.12)",
        }}>{toast.message}</div>
      )}

      <NewsEditor
        pageTitle={"Білдер наступної сторінки /news"}
        initialMeta={initialMeta}
        initialContent={initialContent}
        newsId="__news_page_next__"
        mode="page"
        onSave={handleSave}
        onBack={() => router.push("/dashboard/admin/news")}
        saving={saving}
      />
    </>
  );
}
