"use client";

import { useEffect, useState, useRef } from "react";
import { FaArrowLeft, FaPaperPlane } from "react-icons/fa";
import Link from "next/link";

interface User {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
}

interface Message {
  id: string;
  text: string;
  senderId: string;
  receiverId: string;
  createdAt: string;
  read: boolean;
}

export default function StudentMessages() {
  const [teachers, setTeachers] = useState<User[]>([]);
  const [selectedTeacher, setSelectedTeacher] = useState<User | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [myId, setMyId] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchTeachers();
    fetchMe();
  }, []);

  useEffect(() => {
    if (selectedTeacher) {
      fetchMessages(selectedTeacher.id);
      const interval = setInterval(() => fetchMessages(selectedTeacher.id), 5000);
      return () => clearInterval(interval);
    }
  }, [selectedTeacher]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const fetchMe = async () => {
    const res = await fetch("/api/user/me");
    const data = await res.json();
    setMyId(data.id);
  };

  const fetchTeachers = async () => {
    const res = await fetch("/api/student/teachers");
    const data = await res.json();
    setTeachers(data);
  };

  const fetchMessages = async (teacherId: string) => {
    const res = await fetch(`/api/messages?withUserId=${teacherId}`);
    const data = await res.json();
    setMessages(data);
  };

  const sendMessage = async () => {
    if (!text.trim() || !selectedTeacher) return;
    setLoading(true);
    await fetch("/api/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ receiverId: selectedTeacher.id, text }),
    });
    setText("");
    fetchMessages(selectedTeacher.id);
    setLoading(false);
  };

  return (
    <div className="max-w-5xl mx-auto">
      <Link
        href="/dashboard/student"
        className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-[#1C3A2E] mb-4 transition-colors"
      >
        <FaArrowLeft /> Назад до кабінету
      </Link>

      <h1 className="text-2xl font-bold text-[#1C3A2E] mb-6">Повідомлення</h1>

      <div className="flex gap-4 h-[600px]">
        {/* Список викладачів */}
        <div className="w-64 bg-white rounded-xl shadow-sm border border-gray-100 overflow-y-auto">
          <div className="p-4 border-b border-gray-100">
            <p className="text-sm font-semibold text-[#1C3A2E]">Мої викладачі</p>
          </div>
          {teachers.length === 0 ? (
            <p className="text-xs text-gray-400 p-4">
              Викладачів немає. Купіть курс щоб отримати доступ до викладача.
            </p>
          ) : (
            teachers.map((t) => (
              <button
                key={t.id}
                onClick={() => setSelectedTeacher(t)}
                className={`w-full text-left p-3 flex items-center gap-3 hover:bg-gray-50 transition-colors border-b border-gray-50 ${
                  selectedTeacher?.id === t.id ? "bg-[#E8F5E0]" : ""
                }`}
              >
                <div className="w-8 h-8 bg-[#1C3A2E]/10 rounded-full flex items-center justify-center text-[#1C3A2E] font-bold text-sm flex-shrink-0">
                  {(t.name || t.email)[0].toUpperCase()}
                </div>
                <div className="overflow-hidden">
                  <p className="text-sm font-medium text-gray-800 truncate">
                    {t.name || "Без імені"}
                  </p>
                  <p className="text-xs text-gray-400 truncate">{t.email}</p>
                </div>
              </button>
            ))
          )}
        </div>

        {/* Чат */}
        <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-100 flex flex-col">
          {!selectedTeacher ? (
            <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
              Оберіть викладача щоб почати діалог
            </div>
          ) : (
            <>
              {/* Хедер */}
              <div className="p-4 border-b border-gray-100 flex items-center gap-3">
                <div className="w-8 h-8 bg-[#1C3A2E]/10 rounded-full flex items-center justify-center text-[#1C3A2E] font-bold text-sm">
                  {(selectedTeacher.name || selectedTeacher.email)[0].toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-semibold text-[#1C3A2E]">
                    {selectedTeacher.name || "Без імені"}
                  </p>
                  <p className="text-xs text-gray-400">{selectedTeacher.email}</p>
                </div>
              </div>

              {/* Повідомлення */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.length === 0 ? (
                  <p className="text-center text-gray-400 text-sm mt-8">
                    Повідомлень ще немає. Напишіть першим!
                  </p>
                ) : (
                  messages.map((msg) => {
                    const isMine = msg.senderId === myId;
                    return (
                      <div
                        key={msg.id}
                        className={`flex ${isMine ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`max-w-xs px-4 py-2 rounded-2xl text-sm ${
                            isMine
                              ? "bg-[#1C3A2E] text-white rounded-br-none"
                              : "bg-gray-100 text-gray-800 rounded-bl-none"
                          }`}
                        >
                          <p>{msg.text}</p>
                          <p className={`text-xs mt-1 ${isMine ? "text-white/60" : "text-gray-400"}`}>
                            {new Date(msg.createdAt).toLocaleTimeString("uk-UA", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={bottomRef} />
              </div>

              {/* Поле вводу */}
              <div className="p-4 border-t border-gray-100 flex gap-2">
                <input
                  type="text"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                  placeholder="Напишіть повідомлення..."
                  className="flex-1 border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1C3A2E]/20"
                />
                <button
                  onClick={sendMessage}
                  disabled={!text.trim() || loading}
                  className="p-2 bg-[#1C3A2E] text-white rounded-xl hover:bg-[#1C3A2E]/80 transition-colors disabled:opacity-50"
                >
                  <FaPaperPlane />
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}