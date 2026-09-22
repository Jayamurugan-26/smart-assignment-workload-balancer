import React, { useState, useEffect, useRef } from "react";
import { 
  Send, 
  Bot, 
  User, 
  Sparkles, 
  Trash2, 
  RotateCcw, 
  AlertCircle, 
  Maximize2,
  Copy,
  Check
} from "lucide-react";
import { api } from "../services/api";

/**
 * Lightweight helper to format academic markdown (bold, lists, code, headers)
 */
function FormattedMessage({ text }) {
  if (!text) return null;

  // Split lines
  const lines = text.split("\n");

  return (
    <div className="space-y-1.5 text-sm leading-relaxed">
      {lines.map((line, i) => {
        const trimmed = line.trim();

        // Horizontal rule
        if (trimmed === "---" || trimmed === "***") {
          return <hr key={i} className="my-2 border-slate-200 dark:border-slate-700/60" />;
        }

        // Header 3 or 4
        if (trimmed.startsWith("### ")) {
          return (
            <h4 key={i} className="font-bold text-base mt-2.5 mb-1 text-slate-900 dark:text-white">
              {renderFormattedSpan(trimmed.replace(/^###\s*/, ""))}
            </h4>
          );
        }
        if (trimmed.startsWith("## ")) {
          return (
            <h3 key={i} className="font-bold text-lg mt-3 mb-1 text-slate-900 dark:text-white">
              {renderFormattedSpan(trimmed.replace(/^##\s*/, ""))}
            </h3>
          );
        }

        // Bullet point
        if (trimmed.startsWith("* ") || trimmed.startsWith("- ") || trimmed.startsWith("• ")) {
          const itemText = trimmed.replace(/^(\*|-|•)\s+/, "");
          return (
            <div key={i} className="flex items-start gap-2 ml-1">
              <span className="text-blue-500 font-bold shrink-0 mt-0.5">•</span>
              <span className="flex-1">{renderFormattedSpan(itemText)}</span>
            </div>
          );
        }

        // Numbered list
        const numMatch = trimmed.match(/^(\d+)\.\s+(.*)/);
        if (numMatch) {
          return (
            <div key={i} className="flex items-start gap-2 ml-1">
              <span className="text-blue-500 font-semibold shrink-0">{numMatch[1]}.</span>
              <span className="flex-1">{renderFormattedSpan(numMatch[2])}</span>
            </div>
          );
        }

        // Empty line
        if (!trimmed) {
          return <div key={i} className="h-1.5" />;
        }

        // Regular paragraph line
        return <p key={i}>{renderFormattedSpan(line)}</p>;
      })}
    </div>
  );
}

/**
 * Parses bold (**text**), italics (*text*), and inline code (`code`)
 */
function renderFormattedSpan(str) {
  const parts = [];
  // Regex splitting by bold **...** and inline code `...`
  const regex = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(str)) !== null) {
    if (match.index > lastIndex) {
      parts.push(str.substring(lastIndex, match.index));
    }
    const token = match[0];
    if (token.startsWith("**") && token.endsWith("**")) {
      parts.push(
        <strong key={match.index} className="font-semibold text-slate-900 dark:text-slate-100">
          {token.slice(2, -2)}
        </strong>
      );
    } else if (token.startsWith("`") && token.endsWith("`")) {
      parts.push(
        <code key={match.index} className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700/80 font-mono text-xs text-blue-600 dark:text-blue-300">
          {token.slice(1, -1)}
        </code>
      );
    } else if (token.startsWith("*") && token.endsWith("*")) {
      parts.push(
        <em key={match.index} className="italic">
          {token.slice(1, -1)}
        </em>
      );
    }
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < str.length) {
    parts.push(str.substring(lastIndex));
  }

  return parts.length > 0 ? parts : str;
}

export default function AiChatbox({ assignments = [], onNotify }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState("");
  const [previewImage, setPreviewImage] = useState(null);
  const [error, setError] = useState(null);
  const [copiedId, setCopiedId] = useState(null);
  const [aiHealth, setAiHealth] = useState(null);
  const messagesEndRef = useRef(null);

  // Quick suggestion chips
  const suggestions = [
    "Explain Dijkstra algorithm",
    "What assignments do I have?",
    "What should I complete first?",
    "Explain my DSA assignment",
    "Create a study plan for my urgent tasks",
    "Generate an image of the solar system",
  ];

  // Fetch chat history and AI multi-engine status
  useEffect(() => {
    fetchHistory();
    api.getAiHealth().then(setAiHealth).catch(() => {});
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const fetchHistory = async () => {
    setLoadingHistory(true);
    try {
      const res = await api.getChatHistory();
      if (res.messages && res.messages.length > 0) {
        setMessages(res.messages);
      } else {
        // Welcoming starter message
        setMessages([
          {
            id: "welcome",
            role: "assistant",
            content: "Hello! I am your **AI Academic Assistant** powered by **NEXYRA AI**.\n\nI have real-time access to your synced Google Classroom coursework, upcoming deadlines, and workload schedules. How can I assist you with your studies today?",
            modelUsed: "NEXYRA AI",
            createdAt: new Date().toISOString(),
          }
        ]);
      }
    } catch (err) {
      console.warn("Could not load chat history:", err.message);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleSend = async (textToSend = input) => {
    const text = textToSend.trim();
    if (!text || loading) return;

    setInput("");
    setError(null);

    // Optimistic user message
    const tempUserMsg = {
      id: "temp-" + Date.now(),
      role: "user",
      content: text,
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, tempUserMsg]);
    setLoading(true);

    try {
      const res = await api.sendChatMessage({
        message: text,
        assignmentId: selectedAssignmentId || undefined,
      });

      const assistantMsg = {
        id: res.messageId || "ai-" + Date.now(),
        role: "assistant",
        content: res.message || res.reply,
        imageUrl: res.imageUrl,
        modelUsed: res.model || res.modelUsed || "NEXYRA AI",
        createdAt: res.createdAt || new Date().toISOString(),
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      console.error("[AiChatbox Error]:", err);
      const errMsg = err.message?.includes("Failed to fetch") 
        ? "Cannot connect to server. Please check your backend URL and connection."
        : (err.message || "NEXYRA is temporarily unavailable. Please try again.");
      setError(errMsg);
      if (onNotify) onNotify("error", errMsg, "NEXYRA Error");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleClearHistory = async () => {
    if (!window.confirm("Are you sure you want to clear your AI Assistant chat history?")) return;
    try {
      await api.clearChatHistory();
      setMessages([
        {
          id: "cleared-welcome",
          role: "assistant",
          content: "Chat history cleared. How can I help you with your coursework today?",
          modelUsed: "NEXYRA AI",
          createdAt: new Date().toISOString(),
        }
      ]);
      if (onNotify) onNotify("info", "Chat history cleared.", "NEXYRA AI");
    } catch (err) {
      alert("Failed to clear history: " + err.message);
    }
  };

  const handleCopy = (id, content) => {
    navigator.clipboard.writeText(content);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-6rem)] max-w-5xl mx-auto rounded-2xl bg-white/95 dark:bg-slate-900/90 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 shadow-2xl overflow-hidden animate-in fade-in duration-300">
      
      {/* Top Header */}
      <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/60 backdrop-blur flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-600 flex items-center justify-center text-white shadow-md shadow-blue-500/25">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-slate-900 dark:text-white">NEXYRA AI Assistant</h2>
              <span 
                className="flex items-center gap-1.5 text-[10px] font-semibold px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 transition-all duration-300"
                title={aiHealth?.totalProvidersConfigured ? `NEXYRA Multi-Engine Active: ${aiHealth.totalProvidersConfigured} providers ready with automatic failover` : "NEXYRA AI Engine Online"}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                {aiHealth?.totalProvidersConfigured && aiHealth.totalProvidersConfigured > 1
                  ? `${aiHealth.totalProvidersConfigured} Engines Active`
                  : "NEXYRA Live"}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Grounded in your real Google Classroom assignments & deadlines • High Availability
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center space-x-2">
          {/* Assignment Context Selector */}
          {assignments.length > 0 && (
            <select
              value={selectedAssignmentId}
              onChange={(e) => setSelectedAssignmentId(e.target.value)}
              className="text-xs py-1.5 px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 hidden sm:block max-w-[200px] truncate"
              title="Select assignment for specific context"
            >
              <option value="">All Assignments Context</option>
              {assignments.map((a) => (
                <option key={a.id} value={a.id}>
                  Focus: {a.title}
                </option>
              ))}
            </select>
          )}

          {/* Clear Chat Button */}
          <button
            onClick={handleClearHistory}
            className="p-2 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            title="Clear conversation history"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 p-4 sm:p-6 overflow-y-auto space-y-4">
        {loadingHistory ? (
          <div className="flex flex-col items-center justify-center h-full space-y-3">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            <span className="text-xs text-slate-400">Loading conversation history...</span>
          </div>
        ) : (
          messages.map((msg, idx) => {
            const isUser = msg.role === "user";
            return (
              <div
                key={msg.id || idx}
                className={`flex items-start gap-3 ${isUser ? "flex-row-reverse" : "flex-row"}`}
              >
                {/* Avatar */}
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 shadow-sm ${
                    isUser
                      ? "bg-blue-600 text-white"
                      : "bg-gradient-to-tr from-indigo-600 to-purple-600 text-white"
                  }`}
                >
                  {isUser ? <User className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
                </div>

                {/* Message Bubble */}
                <div
                  className={`group relative max-w-[88%] sm:max-w-[78%] rounded-2xl p-4 text-sm leading-relaxed shadow-sm transition-all ${
                    isUser
                      ? "bg-blue-600 text-white rounded-tr-none"
                      : "bg-slate-50 dark:bg-slate-800/90 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700/60 rounded-tl-none"
                  }`}
                >
                  {/* Copy Action Button */}
                  {!isUser && (
                    <button
                      onClick={() => handleCopy(msg.id || idx, msg.content)}
                      className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition p-1.5 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                      title="Copy message"
                    >
                      {copiedId === (msg.id || idx) ? (
                        <Check className="w-3.5 h-3.5 text-emerald-500" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  )}

                  {/* Text Content */}
                  <div className="font-sans text-sm break-words pr-4">
                    {isUser ? (
                      <span className="whitespace-pre-wrap">{msg.content}</span>
                    ) : (
                      <FormattedMessage text={msg.content} />
                    )}
                  </div>

                  {/* Generated Image Rendering */}
                  {msg.imageUrl && (
                    <div className="mt-3 rounded-xl overflow-hidden border border-slate-300 dark:border-slate-700 bg-black/40 group/img relative">
                      <img
                        src={msg.imageUrl}
                        alt="AI Generated"
                        className="w-full max-h-80 object-cover cursor-pointer transition hover:scale-[1.01]"
                        onClick={() => setPreviewImage(msg.imageUrl)}
                      />
                      <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover/img:opacity-100 transition">
                        <button
                          onClick={() => setPreviewImage(msg.imageUrl)}
                          className="p-1.5 rounded-lg bg-black/70 text-white hover:bg-black text-xs flex items-center gap-1"
                        >
                          <Maximize2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Footer Attribution / Model Tag */}
                  <div className={`mt-2.5 flex items-center justify-between text-[10px] ${isUser ? "text-blue-200" : "text-slate-400"}`}>
                    <span>
                      {msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""}
                    </span>
                    {msg.modelUsed && (
                      <span className="font-mono opacity-80">
                        {msg.modelUsed}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}

        {/* Live Loading Indicator */}
        {loading && (
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-600 to-purple-600 text-white flex items-center justify-center shrink-0 animate-pulse">
              <Sparkles className="w-4 h-4 animate-spin" />
            </div>
            <div className="bg-slate-50 dark:bg-slate-800/90 rounded-2xl rounded-tl-none p-4 border border-slate-200 dark:border-slate-700/60 flex items-center space-x-2">
              <span className="w-2 h-2 rounded-full bg-blue-500 animate-bounce"></span>
              <span className="w-2 h-2 rounded-full bg-indigo-500 animate-bounce delay-150"></span>
              <span className="w-2 h-2 rounded-full bg-purple-500 animate-bounce delay-300"></span>
              <span className="text-xs text-slate-500 dark:text-slate-400 ml-2 font-medium">
                Reasoning with NEXYRA AI...
              </span>
            </div>
          </div>
        )}

        {/* Error Notification with Retry */}
        {error && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-between text-xs text-rose-600 dark:text-rose-400">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
            <button
              onClick={() => handleSend(messages[messages.length - 1]?.content || "")}
              className="px-2.5 py-1 rounded-md bg-rose-600 hover:bg-rose-500 text-white font-medium flex items-center gap-1 transition"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Retry</span>
            </button>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggestion Chips */}
      <div className="px-4 py-2 bg-slate-50 dark:bg-slate-950/40 border-t border-slate-200 dark:border-slate-800 overflow-x-auto flex items-center space-x-2 no-scrollbar">
        <span className="text-[11px] font-bold text-slate-400 shrink-0 uppercase tracking-wider">
          Suggested:
        </span>
        {suggestions.map((chip, idx) => (
          <button
            key={idx}
            onClick={() => handleSend(chip)}
            disabled={loading}
            className="text-xs px-3 py-1.5 rounded-full bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300/80 dark:border-slate-700/80 hover:border-blue-500 hover:text-blue-600 dark:hover:text-blue-400 shrink-0 transition shadow-sm disabled:opacity-50"
          >
            {chip}
          </button>
        ))}
      </div>

      {/* Input Box */}
      <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex items-center space-x-2"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask NEXYRA anything about your assignments, deadlines, or study schedule..."
            disabled={loading}
            className="flex-1 py-3 px-4 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm transition"
          />

          <button
            type="submit"
            disabled={!input.trim() || loading}
            className="p-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-40 shadow-md shadow-blue-500/25 transition active:scale-95 shrink-0"
            title="Send Message"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>

      {/* Image Zoom Modal */}
      {previewImage && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 cursor-pointer"
          onClick={() => setPreviewImage(null)}
        >
          <div className="relative max-w-3xl max-h-[90vh] bg-slate-900 rounded-2xl overflow-hidden border border-slate-700 p-2">
            <img src={previewImage} alt="AI Generated Zoom" className="w-full h-full object-contain rounded-xl" />
          </div>
        </div>
      )}

    </div>
  );
}
