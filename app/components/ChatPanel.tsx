"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import ColorPalettePicker from "./ColorPalettePicker";
import type { Palette } from "@/app/lib/types";

interface Message {
  role: "user" | "system";
  text: string;
}

interface UploadedImage {
  file: File;
  base64: string;
  previewUrl: string;
}

export interface ClarifyQuestion {
  question: string;
  suggestions: string[];
}

interface ChatPanelProps {
  onGenerate: (prompt: string, images: { url: string; base64: string }[]) => void;
  onClarify: (prompt: string) => Promise<ClarifyQuestion[]>;
  loading: boolean;
  error: string | null;
  palette: Palette;
  onPaletteChange: (p: Palette) => void;
}

const MAX_IMAGES = 5;
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

export default function ChatPanel({
  onGenerate,
  onClarify,
  loading,
  error,
  palette,
  onPaletteChange,
}: ChatPanelProps) {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [phase, setPhase] = useState<"input" | "clarifying" | "generating">("input");
  const [clarifyQuestions, setClarifyQuestions] = useState<ClarifyQuestion[]>([]);
  const [clarifyAnswers, setClarifyAnswers] = useState<Record<number, string>>({});
  const [pendingPrompt, setPendingPrompt] = useState("");
  const [clarifyLoading, setClarifyLoading] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-resize textarea
  const adjustTextareaHeight = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    const minH = 72; // ~3 rows
    const maxH = 144; // ~6 rows
    el.style.height = `${Math.min(Math.max(el.scrollHeight, minH), maxH)}px`;
  }, []);

  useEffect(() => {
    adjustTextareaHeight();
  }, [input, adjustTextareaHeight]);

  // Scroll messages to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, clarifyQuestions, phase]);

  // --- Image handling ---
  function processFiles(files: FileList | File[]) {
    const fileArray = Array.from(files);
    const remaining = MAX_IMAGES - images.length;
    const toAdd = fileArray.slice(0, remaining);

    toAdd.forEach((file) => {
      if (!file.type.startsWith("image/")) return;
      if (file.size > MAX_FILE_SIZE) return;

      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result as string;
        const previewUrl = URL.createObjectURL(file);
        setImages((prev) => {
          if (prev.length >= MAX_IMAGES) return prev;
          return [...prev, { file, base64, previewUrl }];
        });
      };
      reader.readAsDataURL(file);
    });
  }

  function removeImage(index: number) {
    setImages((prev) => {
      URL.revokeObjectURL(prev[index].previewUrl);
      return prev.filter((_, i) => i !== index);
    });
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files);
    }
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
  }

  // --- Submit handling ---
  async function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault();
    const prompt = input.trim();
    if (!prompt || loading || clarifyLoading) return;

    setMessages((prev) => [...prev, { role: "user", text: prompt }]);
    setPendingPrompt(prompt);
    setInput("");

    // Try clarification first
    setClarifyLoading(true);
    try {
      const questions = await onClarify(prompt);
      if (questions.length > 0) {
        setClarifyQuestions(questions);
        setClarifyAnswers({});
        setPhase("clarifying");
        // Show questions as system messages
        questions.forEach((q) => {
          setMessages((prev) => [...prev, { role: "system", text: q.question }]);
        });
      } else {
        // No questions — go straight to generation
        triggerGenerate(prompt);
      }
    } catch {
      // If clarification fails, just generate directly
      triggerGenerate(prompt);
    } finally {
      setClarifyLoading(false);
    }
  }

  function triggerGenerate(prompt: string) {
    setPhase("generating");
    const imageData = images.map((img) => ({
      url: img.file.name,
      base64: img.base64,
    }));
    onGenerate(prompt, imageData);
    // Reset after triggering
    setImages([]);
    setPhase("input");
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }

  // --- Clarification handling ---
  function handleAnswerSelect(questionIndex: number, answer: string) {
    setClarifyAnswers((prev) => ({ ...prev, [questionIndex]: answer }));
    setMessages((prev) => [
      ...prev,
      { role: "user", text: answer },
    ]);
  }

  function buildEnrichedPrompt(): string {
    const answered = Object.entries(clarifyAnswers);
    if (answered.length === 0) return pendingPrompt;

    const qaLines = answered
      .map(([idx, answer]) => {
        const q = clarifyQuestions[Number(idx)];
        return `- Q: ${q.question} A: ${answer}`;
      })
      .join("\n");

    return `${pendingPrompt}\n\nAdditional context:\n${qaLines}`;
  }

  function handleFinishClarify() {
    const enriched = buildEnrichedPrompt();
    triggerGenerate(enriched);
    setClarifyQuestions([]);
    setClarifyAnswers({});
  }

  const allAnswered =
    clarifyQuestions.length > 0 &&
    clarifyQuestions.every((_, i) => clarifyAnswers[i] !== undefined);

  // Auto-proceed when all questions are answered
  useEffect(() => {
    if (phase === "clarifying" && allAnswered) {
      // Small delay so user sees their last selection
      const timer = setTimeout(handleFinishClarify, 600);
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allAnswered, phase]);

  const unansweredIndex = clarifyQuestions.findIndex(
    (_, i) => clarifyAnswers[i] === undefined
  );

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

        {/* Clarifying question chips */}
        {phase === "clarifying" && unansweredIndex >= 0 && (
          <div className="space-y-2 mt-2">
            <div className="flex flex-wrap gap-1.5">
              {clarifyQuestions[unansweredIndex].suggestions.map((s, si) => (
                <button
                  key={si}
                  onClick={() => handleAnswerSelect(unansweredIndex, s)}
                  className="text-xs px-2.5 py-1 rounded-full bg-blue-800/40 text-blue-200 border border-blue-700/50 hover:bg-blue-700/50 transition-colors cursor-pointer"
                >
                  {s}
                </button>
              ))}
            </div>
            <input
              type="text"
              placeholder="Or type a custom answer..."
              className="w-full bg-zinc-800 text-white text-xs px-2.5 py-1.5 rounded border border-zinc-600 placeholder-zinc-500"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  const val = e.currentTarget.value.trim();
                  if (val) {
                    handleAnswerSelect(unansweredIndex, val);
                    e.currentTarget.value = "";
                  }
                }
              }}
            />
            <button
              onClick={handleFinishClarify}
              className="text-xs text-zinc-400 hover:text-zinc-200 underline cursor-pointer"
            >
              Skip &amp; Generate
            </button>
          </div>
        )}

        {(loading || clarifyLoading) && (
          <div className="text-xs text-zinc-500 animate-pulse">
            {clarifyLoading ? "Thinking..." : "Generating layout..."}
          </div>
        )}
        {error && (
          <div className="text-xs text-red-400 bg-red-900/20 px-2 py-1.5 rounded">
            {error}
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Color Palette */}
      <div className="px-3 py-2 border-t border-zinc-700">
        <ColorPalettePicker palette={palette} onChange={onPaletteChange} />
      </div>

      {/* Image Upload Drop Zone */}
      <div className="px-3 pt-2">
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onClick={() => fileInputRef.current?.click()}
          className="border border-dashed border-zinc-600 rounded p-2 text-center cursor-pointer hover:border-zinc-400 transition-colors"
        >
          <p className="text-xs text-zinc-500">
            {images.length >= MAX_IMAGES
              ? "Max 5 images"
              : "Drop images or click to upload"}
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files) processFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </div>

        {/* Image Thumbnails */}
        {images.length > 0 && (
          <div className="flex gap-1.5 mt-2 flex-wrap">
            {images.map((img, i) => (
              <div key={i} className="relative group">
                <img
                  src={img.previewUrl}
                  alt={img.file.name}
                  className="w-12 h-12 object-cover rounded border border-zinc-600"
                />
                <button
                  onClick={() => removeImage(i)}
                  className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-600 text-white text-[10px] rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                >
                  x
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Textarea + Submit */}
      <form onSubmit={handleSubmit} className="p-3 border-t border-zinc-700 space-y-2">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Describe a design..."
          disabled={loading || clarifyLoading || phase === "clarifying"}
          rows={3}
          className="w-full bg-zinc-800 text-white text-sm px-3 py-2 rounded border border-zinc-600 placeholder-zinc-500 disabled:opacity-50 resize-none overflow-y-auto"
          style={{ minHeight: 72, maxHeight: 144 }}
        />
        <button
          type="submit"
          disabled={loading || clarifyLoading || !input.trim() || phase === "clarifying"}
          className="w-full px-3 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? "Generating..." : clarifyLoading ? "Thinking..." : "Go"}
        </button>
      </form>
    </div>
  );
}
