"use client";

import { useState } from "react";
import ColorPalettePicker from "./ColorPalettePicker";
import type { Palette } from "@/app/lib/types";

interface Message {
  role: "user" | "system";
  text: string;
}

interface ChatPanelProps {
  onGenerate: (prompt: string) => void;
  loading: boolean;
  error: string | null;
  palette: Palette;
  onPaletteChange: (p: Palette) => void;
}

export default function ChatPanel({
  onGenerate,
  loading,
  error,
  palette,
  onPaletteChange,
}: ChatPanelProps) {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const prompt = input.trim();
    if (!prompt || loading) return;

    setMessages((prev) => [...prev, { role: "user", text: prompt }]);
    setInput("");
    onGenerate(prompt);
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2 border-b border-zinc-700">
        <p className="font-medium text-zinc-300 text-sm">Chat</p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {messages.length === 0 && (
          <p className="text-xs text-zinc-500">
            Describe a UI design to generate it on the canvas.
          </p>
        )}
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`text-xs px-2 py-1.5 rounded ${
              msg.role === "user"
                ? "bg-blue-900/40 text-blue-200 ml-4"
                : "bg-zinc-800 text-zinc-300 mr-4"
            }`}
          >
            {msg.text}
          </div>
        ))}
        {loading && (
          <div className="text-xs text-zinc-500 animate-pulse">
            Generating layout...
          </div>
        )}
        {error && (
          <div className="text-xs text-red-400 bg-red-900/20 px-2 py-1.5 rounded">
            {error}
          </div>
        )}
      </div>

      {/* Color Palette */}
      <div className="px-3 py-2 border-t border-zinc-700">
        <ColorPalettePicker palette={palette} onChange={onPaletteChange} />
      </div>

      {/* Input */}
      <form
        onSubmit={handleSubmit}
        className="flex gap-2 p-3 border-t border-zinc-700"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Describe a design..."
          disabled={loading}
          className="flex-1 bg-zinc-800 text-white text-sm px-3 py-2 rounded border border-zinc-600 placeholder-zinc-500 disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="px-3 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? "..." : "Go"}
        </button>
      </form>
    </div>
  );
}
