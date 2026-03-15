"use client";

import { useEffect, useState, useRef } from "react";
import { useSearchParams } from "next/navigation";
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

export default function TeacherMessages() {
  const searchParams = useSearchParams();
  const initialStudentId = searchParams.get("studentId");

  const [students, setStudents] = useState<User[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<User | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [myId, setMyId] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchStudents();
    fetchMe();
  }, []);

  useEffect(() => {
    if (selectedStudent) {
      fetchMessages(selectedStudent.id);
      const interval = setInterval(() => fetchMessages(selectedStudent.id), 5000);
      return () => clearInterval(interval);
    }
  }, [selectedStudent]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (initialStudentId && students.length > 0) {
      const found = students.find((s) => s.id === initialStudentId);
      if (found) setSelectedStudent(found);
    }
  }, [initialStudentId, students]);

  const fetchMe = async () => {
    const res = await fetch("/api/user/me");
    const data = await res.json();
    setMyId(data.id);
  };

  const fetchStudents = async () => {
    const res = await fetch("/api/teacher/students");
    const data = await res.json();
    setStudents(data);
  };

  const fetchMessages = async (studentId: string) => {
    const res = await fetch(`/api/messages?withUserId=${studentId}`);
    const data = await res.json();
    setMessages(data);
  };

  const sendMessage = async () => {
    if (!text.trim() || !selectedStudent) return;
    setLoading(true);
    await fetch("/api/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ receiverId: selectedStudent.id, text }),
    });
    setText("");
    fetchMessages(selectedStudent.id);
    setLoading(false);
  };

  return (
    <div className="max-w-5xl mx-auto">
      <Link
        href="/dashboard/teacher"
        className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-[#1C3A2E] mb-4 transition-colors"
      >
        <FaArrowLeft /> Назад до кабінету
      </Link>

      <h1 className="text-2xl font-bold text-[#1C3A2E] mb-6">Повідомлення</h1>

      <div className="flex gap-4 h-[600px]">
        <div className="w-64 bg-white rounded-xl shadow-sm border border-gray-100 overflow-y-auto">
          <div className="p-4 border-b border-gray-100">
            <p className="text-sm font-semibold text-[#1C3A2E]">Мої студенти</p>
          </div>
          {students.length === 0 ? (
            <p className="text-xs text-gray-400 p-4">Студентів немає</p>
          ) : (
            students.map((s) => (
              <button
                key={s.id}
                onClick={() => setSelectedStudent(s)}
                className={`w-full text-left p-3 flex items-center gap-3 hover:bg-gray-50 transition-colors border-b border-gray-50 ${
                  selectedStudent?.id === s.id ? "bg-[#E8F5E0]" : ""
                }`}
              >
                <div className="w-8 h-8 bg-[#1C3A2E]/10 rounded-full flex items-center justify-center text-[#1C3A2E] font-bold text-sm flex-shrink-0">
                  {(s.name || s.email)[0].toUpperCase()}
                </div>
                <div className="overflow-hidden">
                  <p className="text-sm font-medium text-gray-800 truncate">
                    {s.name || "Без імені"}
                  </p>
                  <p className="text-xs text-gray-400 truncate">{s.email}</p>
                </div>
              </button>
            ))
          )}
        </div>

        <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-100 flex flex-col">
          {!selectedStudent ? (
            <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
              Оберіть студента щоб почати діалог
            </div>
          ) : (
            <>
              <div className="p-4 border-b border-gray-100 flex items-center gap-3">
                <div className="w-8 h-8 bg-[#1C3A2E]/10 rounded-full flex items-center justify-center text-[#1C3A2E] font-bold text-sm">
                  {(selectedStudent.name || selectedStudent.email)[0].toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-semibold text-[#1C3A2E]">
                    {selectedStudent.name || "Без імені"}
                  </p>
                  <p className="text-xs text-gray-400">{selectedStudent.email}</p>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.length === 0 ? (
                  <p className="text-center text-gray-400 text-sm mt-8">
                    Повідомлень ще немає
                  </p>
                ) : (
                  messages.map((msg) => {
                    const isMine = msg.senderId === myId;
                    return (
                      <div key={msg.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                        <div className={`max-w-xs px-4 py-2 rounded-2xl text-sm ${
                          isMine ? "bg-[#1C3A2E] text-white rounded-br-none" : "bg-gray-100 text-gray-800 rounded-bl-none"
                        }`}>
                          <p>{msg.text}</p>
                          <p className={`text-xs mt-1 ${isMine ? "text-white/60" : "text-gray-400"}`}>
                            {new Date(msg.createdAt).toLocaleTimeString("uk-UA", { hour: "2-digit", minute: "2-digit" })}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={bottomRef} />
              </div>

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