"use client";

import { useState, useRef, useEffect } from "react";
import { sendChatMessage } from "@/lib/api";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface SocraticChatProps {
  auditId: string;
  initialContext?: string;
}

const INITIAL_PROMPT =
  "My model was flagged for bias. Can you help me understand what went wrong?";

function normalizeAssistantMarkdown(content: string): string {
  const normalized = content
    .replace(/\r\n/g, "\n")
    // Convert unicode bullets to markdown bullets.
    .replace(/(^|\n)\s*•\s*/g, "$1- ");

  const lines = normalized.split("\n");
  const output: string[] = [];
  let inTable = false;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const trimmed = line.trim();
    const isTableLine = trimmed.startsWith("|") && trimmed.endsWith("|");

    if (isTableLine) {
      output.push(trimmed);
      inTable = true;
      continue;
    }

    if (inTable && trimmed === "") {
      let nextIndex = i + 1;
      while (nextIndex < lines.length && lines[nextIndex].trim() === "") {
        nextIndex += 1;
      }
      const nextLine = lines[nextIndex]?.trim();
      const nextIsTableLine =
        !!nextLine && nextLine.startsWith("|") && nextLine.endsWith("|");
      if (nextIsTableLine) {
        continue;
      }
    }

    if (inTable && !isTableLine) {
      inTable = false;
    }

    output.push(line);
  }

  return output.join("\n").replace(/\n{3,}/g, "\n\n");
}

function renderAssistantMessage(content: string) {
  return (
    <div className="prose prose-invert max-w-none prose-p:my-1 prose-headings:my-2 prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5 prose-hr:my-3 prose-table:my-2 prose-th:border prose-th:border-[var(--color-border)] prose-th:px-2 prose-th:py-1 prose-td:border prose-td:border-[var(--color-border)] prose-td:px-2 prose-td:py-1 prose-blockquote:my-2 prose-blockquote:border-l-2 prose-blockquote:border-[var(--color-border)] prose-blockquote:pl-3 prose-blockquote:text-[var(--color-text-muted)]">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code({ children, className, ...props }) {
            const raw = String(children ?? "");
            const isBlock = raw.includes("\n");
            if (!isBlock) {
              return (
                <code
                  className="rounded bg-[var(--color-border)] px-1.5 py-0.5 font-mono text-xs"
                  {...props}
                >
                  {children}
                </code>
              );
            }
            return (
              <code
                className="block overflow-x-auto rounded bg-[var(--color-border)] p-3 font-mono text-xs"
                data-language={className}
                {...props}
              >
                {children}
              </code>
            );
          },
        }}
      >
        {normalizeAssistantMarkdown(content)}
      </ReactMarkdown>
    </div>
  );
}

export default function SocraticChat({ auditId, initialContext }: SocraticChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const streamingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const key = `guardian-chat-init:${auditId}`;
    const hasSentInitialMessage = typeof window !== "undefined" && sessionStorage.getItem(key);
    if (initialContext && messages.length === 0 && !hasSentInitialMessage) {
      sessionStorage.setItem(key, "1");
      handleSend(INITIAL_PROMPT);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auditId, initialContext, messages.length]);

  useEffect(() => {
    return () => {
      if (streamingTimerRef.current) {
        clearInterval(streamingTimerRef.current);
      }
    };
  }, []);

  function streamAssistantMessage(fullText: string) {
    const words = fullText.split(/(\s+)/).filter(Boolean);
    const messageIndex = messages.length + 1;

    setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

    let cursor = 0;
    streamingTimerRef.current = setInterval(() => {
      cursor += 2;
      const chunk = words.slice(0, cursor).join("");
      setMessages((prev) =>
        prev.map((msg, idx) =>
          idx === messageIndex ? { ...msg, content: chunk } : msg
        )
      );

      if (cursor >= words.length && streamingTimerRef.current) {
        clearInterval(streamingTimerRef.current);
        streamingTimerRef.current = null;
        setLoading(false);
      }
    }, 22);
  }

  async function handleSend(text?: string) {
    const msg = text ?? input.trim();
    if (!msg || loading) return;

    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: msg }]);
    setLoading(true);

    try {
      const res = await sendChatMessage(auditId, msg);
      streamAssistantMessage(res.response);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "I encountered an error connecting to the ethics tutor. Please try again.",
        },
      ]);
      setLoading(false);
    }
  }

  return (
    <div className="flex h-[500px] flex-col rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]">
      {/* Header */}
      <div className="border-b border-[var(--color-border)] px-4 py-3">
        <h3 className="text-sm font-semibold">Fairness Trade-off Workshop</h3>
        <p className="text-xs text-[var(--color-text-muted)]">
          Socratic guided exploration of bias in your data
        </p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {messages.length === 0 && !loading && (
          <p className="text-center text-sm text-[var(--color-text-muted)]">
            The ethics tutor will guide you through understanding the bias
            findings in your data. Ask a question to begin.
          </p>
        )}

        <div className="space-y-4">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                  msg.role === "user"
                    ? "bg-[var(--color-accent)] text-white"
                    : "bg-[var(--color-bg)] text-[var(--color-text)]"
                }`}
              >
                {msg.role === "assistant"
                  ? renderAssistantMessage(msg.content)
                  : msg.content}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="rounded-2xl bg-[var(--color-bg)] px-4 py-3">
                <div className="flex gap-1">
                  <span className="h-2 w-2 animate-bounce rounded-full bg-[var(--color-text-muted)]" />
                  <span className="h-2 w-2 animate-bounce rounded-full bg-[var(--color-text-muted)] [animation-delay:0.15s]" />
                  <span className="h-2 w-2 animate-bounce rounded-full bg-[var(--color-text-muted)] [animation-delay:0.3s]" />
                </div>
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </div>

      {/* Input */}
      <div className="border-t border-[var(--color-border)] px-4 py-3">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex gap-2"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about the bias findings..."
            disabled={loading}
            className="flex-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)] outline-none placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-accent)] disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white transition hover:bg-[var(--color-accent-hover)] disabled:opacity-50"
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
}
