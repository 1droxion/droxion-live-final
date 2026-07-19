// src/AIChat.jsx — Droxion (full, drop-in with AI Ad Manager Integration)
import React, { useState, useEffect } from "react";
import axios from "axios";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import remarkGfm from "remark-gfm";
import {
  FiMoon,
  FiSun,
  FiCpu,
  FiAperture,
  FiArrowRight,
  FiCopy,
  FiCheck,
  FiRefreshCw,
} from "react-icons/fi";
import { Megaphone } from "lucide-react";
import { Analytics } from "@vercel/analytics/react";
import "./AIChat.css";

const API_BASE = "https://onrender.com";

function getUserId() {
  try {
    let id = localStorage.getItem("droxion_user_id");
    if (!id) {
      id = `u_${Math.random().toString(36).slice(2, 10)}`;
      localStorage.setItem("droxion_user_id", id);
    }
    return id;
  } catch {
    return "anon";
  }
}

const USER_ID = getUserId();

async function saveHistory(apiBase, userId, messages) {
  try {
    await axios.post(`${apiBase}/history/save`, {
      user_id: userId,
      messages: messages.map((message) => ({
        role: message.role,
        text:
          typeof message.content === "string"
            ? message.content
            : message.content?.toString?.() || "",
      })),
    });
  } catch (error) {
    console.error("Failed to save chat history:", error);
  }
}

async function loadHistory(apiBase, userId) {
  try {
    const response = await axios.get(`${apiBase}/history`, {
      params: { user_id: userId },
    });
    const history = response?.data?.history || [];
    return history.map((item) => ({
      role: item.role,
      content: item.text,
      time: item.time,
    }));
  } catch (error) {
    console.error("Failed to load chat history:", error);
    return [];
  }
}

export default function AIChat() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [darkMode, setDarkMode] = useState(true);
  const [loading, setLoading] = useState(false);
  const [currentView, setCurrentView] = useState("chat");
  const [shopifyAds, setShopifyAds] = useState([]);
  const [loadingAds, setLoadingAds] = useState(false);
  const [copiedId, setCopiedId] = useState(null);

  useEffect(() => {
    async function init() {
      const history = await loadHistory(API_BASE, USER_ID);
      if (history.length > 0) {
        setMessages(history);
      } else {
        setMessages([
          {
            role: "assistant",
            content:
              "Hello! Welcome to Droxion. How can I help boost your e-commerce operations today?",
          },
        ]);
      }
    }

    init();
  }, []);

  const fetchShopifyAds = async () => {
    setLoadingAds(true);

    try {
      await axios.get(`${API_BASE}/logs`);
      setShopifyAds([
        {
          id: "ad_1",
          product_title: "Droxion Performance Running Shoes",
          captions: [
            "👟 Crush your fitness goals with the ultimate structural support. Lightweight, durable, and engineered for maximum speed. Get yours today with 20% off!",
            "🔥 The future of footwear has officially arrived. Experience elite energy return with every single stride. Click to shop our limited collection.",
            "Tired of running shoes that wear out fast? Droxion shoes are built with high-tensile mesh engineered to last hundreds of miles. Free shipping inside USA.",
          ],
        },
      ]);
    } catch (error) {
      console.error("Failed to read transaction records:", error);
      setShopifyAds([]);
    } finally {
      setLoadingAds(false);
    }
  };

  const handleCopyText = async (text, uniqueId) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(uniqueId);
      window.setTimeout(() => setCopiedId(null), 2000);
    } catch (error) {
      console.error("Failed to copy caption:", error);
    }
  };

  const handleSendMessage = async (event) => {
    event.preventDefault();

    const trimmedInput = input.trim();
    if (!trimmedInput || loading) return;

    const userMessage = {
      role: "user",
      content: trimmedInput,
      time: Date.now(),
    };
    const updatedMessages = [...messages, userMessage];

    setMessages(updatedMessages);
    setInput("");
    setLoading(true);

    try {
      const response = await axios.post(`${API_BASE}/chat`, {
        user_id: USER_ID,
        message: trimmedInput,
      });

      const assistantMessage = {
        role: "assistant",
        content:
          response.data?.reply ||
          "I am currently processing your tracking payload.",
        time: Date.now(),
      };

      const finalMessages = [...updatedMessages, assistantMessage];
      setMessages(finalMessages);
      await saveHistory(API_BASE, USER_ID, finalMessages);
    } catch (error) {
      console.error("Chat request failed:", error);
      setMessages([
        ...updatedMessages,
        {
          role: "assistant",
          content:
            "Connection timeout exception. Please check your Render configuration variables.",
          time: Date.now(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className={`aichat-container ${
        darkMode ? "dark-theme" : "light-theme"
      } flex h-screen w-screen bg-slate-950 text-white font-sans overflow-hidden`}
    >
      <Analytics />

      <aside className="sidebar w-64 bg-slate-900 border-r border-slate-800 flex flex-col justify-between p-4 z-10 shrink-0">
        <div className="flex flex-col space-y-6">
          <div className="flex items-center space-x-2 px-2">
            <FiAperture className="h-6 w-6 text-indigo-500" />
            <span className="text-xl font-bold tracking-wider text-white">
              DROXION
            </span>
          </div>

          <button
            type="button"
            onClick={() => setCurrentView("chat")}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition text-sm font-medium ${
              currentView === "chat"
                ? "bg-indigo-600 text-white shadow-lg"
                : "text-slate-400 hover:bg-slate-800 hover:text-white"
            }`}
          >
            <FiCpu className="h-5 w-5" />
            <span>AI Copilot Chat</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setCurrentView("ads");
              fetchShopifyAds();
            }}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition text-sm font-medium ${
              currentView === "ads"
                ? "bg-indigo-600 text-white shadow-lg"
                : "text-slate-400 hover:bg-slate-800 hover:text-white"
            }`}
          >
            <Megaphone className="h-5 w-5" />
            <span>AI Ad Manager</span>
          </button>
        </div>

        <div className="flex flex-col space-y-4 border-t border-slate-800 pt-4">
          <div className="flex items-center justify-between px-2 text-xs text-slate-500">
            <span>User Hash: {USER_ID}</span>
          </div>

          <button
            type="button"
            onClick={() => setDarkMode((current) => !current)}
            className="w-full flex items-center space-x-3 px-4 py-2.5 rounded-xl text-sm font-medium text-slate-400 hover:bg-slate-800 hover:text-white transition"
          >
            {darkMode ? (
              <FiSun className="h-5 w-5 text-amber-400" />
            ) : (
              <FiMoon className="h-5 w-5 text-indigo-400" />
            )}
            <span>{darkMode ? "Light Interface" : "Dark Interface"}</span>
          </button>
        </div>
      </aside>

      <main className="main-stage flex-1 flex flex-col relative bg-slate-950 overflow-hidden">
        {currentView === "chat" && (
          <>
            <div className="chat-history-frame flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin">
              {messages.map((message, index) => (
                <div
                  key={`${message.role}-${message.time || index}`}
                  className={`flex ${
                    message.role === "user" ? "justify-end" : "justify-start"
                  } animate-fade-in`}
                >
                  <div
                    className={`max-w-2xl rounded-2xl px-5 py-4 shadow-xl border ${
                      message.role === "user"
                        ? "bg-indigo-600 border-indigo-500 text-white rounded-tr-none"
                        : "bg-slate-900 border-slate-800 text-slate-100 rounded-tl-none"
                    }`}
                  >
                    <div className="prose prose-invert max-w-none text-sm leading-relaxed">
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        rehypePlugins={[rehypeRaw]}
                      >
                        {typeof message.content === "string"
                          ? message.content
                          : "Processing payload data..."}
                      </ReactMarkdown>
                    </div>
                  </div>
                </div>
              ))}

              {loading && (
                <div className="flex justify-start">
                  <div className="bg-slate-900 border border-slate-800 rounded-2xl rounded-tl-none px-5 py-4 text-slate-400 text-sm flex items-center space-x-2">
                    <FiRefreshCw className="h-4 w-4 animate-spin text-indigo-500" />
                    <span>Droxion is orchestrating data points...</span>
                  </div>
                </div>
              )}
            </div>

            <footer className="footer-input-tray p-4 bg-slate-900/40 border-t border-slate-900 backdrop-blur-md">
              <form
                onSubmit={handleSendMessage}
                className="max-w-3xl mx-auto flex items-center space-x-3 bg-slate-900 border border-slate-800 rounded-2xl p-2.5 shadow-2xl focus-within:border-indigo-500 transition"
              >
                <input
                  type="text"
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  placeholder="Ask anything or optimize your active e-commerce variables..."
                  className="flex-1 bg-transparent text-sm text-white placeholder-slate-500 outline-none px-3"
                />
                <button
                  type="submit"
                  disabled={loading || !input.trim()}
                  className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 disabled:cursor-not-allowed text-white p-2.5 rounded-xl shadow-lg transition"
                  aria-label="Send message"
                >
                  <FiArrowRight className="h-4 w-4" />
                </button>
              </form>
            </footer>
          </>
        )}

        {currentView === "ads" && (
          <div className="ad-manager-frame flex-1 overflow-y-auto p-8 space-y-6 scrollbar-thin">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-white flex items-center space-x-2">
                  <Megaphone className="h-6 w-6 text-indigo-500" />
                  <span>AI Ad Manager</span>
                </h1>
                <p className="mt-2 text-sm text-slate-400">
                  Review Facebook ad captions generated from Shopify product
                  events.
                </p>
              </div>

              <button
                type="button"
                onClick={fetchShopifyAds}
                disabled={loadingAds}
                className="inline-flex items-center space-x-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:bg-slate-700"
              >
                <FiRefreshCw
                  className={`h-4 w-4 ${loadingAds ? "animate-spin" : ""}`}
                />
                <span>{loadingAds ? "Loading Ads..." : "Refresh Ads"}</span>
              </button>
            </div>

            {loadingAds ? (
              <div className="flex min-h-64 items-center justify-center rounded-2xl border border-slate-800 bg-slate-900/60">
                <div className="flex items-center space-x-3 text-sm text-slate-400">
                  <FiRefreshCw className="h-5 w-5 animate-spin text-indigo-500" />
                  <span>Loading generated Shopify ads...</span>
                </div>
              </div>
            ) : shopifyAds.length === 0 ? (
              <div className="flex min-h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-700 bg-slate-900/40 px-6 text-center">
                <Megaphone className="mb-4 h-10 w-10 text-slate-600" />
                <h2 className="text-lg font-semibold text-white">
                  No generated ads found
                </h2>
                <p className="mt-2 max-w-md text-sm text-slate-400">
                  Install the Shopify app and create a product to generate your
                  first set of Facebook captions.
                </p>
              </div>
            ) : (
              <div className="grid gap-6">
                {shopifyAds.map((ad) => (
                  <section
                    key={ad.id}
                    className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6 shadow-xl"
                  >
                    <div className="mb-5 flex items-start justify-between gap-4">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-widest text-indigo-400">
                          Shopify Product
                        </p>
                        <h2 className="mt-1 text-xl font-semibold text-white">
                          {ad.product_title}
                        </h2>
                      </div>
                      <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-300">
                        3 captions ready
                      </span>
                    </div>

                    <div className="grid gap-4 lg:grid-cols-3">
                      {ad.captions.map((caption, captionIndex) => {
                        const copyId = `${ad.id}-${captionIndex}`;
                        const isCopied = copiedId === copyId;

                        return (
                          <article
                            key={copyId}
                            className="flex min-h-56 flex-col justify-between rounded-2xl border border-slate-800 bg-slate-950/80 p-5"
                          >
                            <div>
                              <div className="mb-3 flex items-center justify-between">
                                <span className="text-xs font-semibold uppercase tracking-widest text-slate-500">
                                  Variation {captionIndex + 1}
                                </span>
                              </div>
                              <p className="whitespace-pre-wrap text-sm leading-6 text-slate-200">
                                {caption}
                              </p>
                            </div>

                            <button
                              type="button"
                              onClick={() => handleCopyText(caption, copyId)}
                              className="mt-5 inline-flex items-center justify-center space-x-2 rounded-xl border border-slate-700 px-4 py-2.5 text-sm font-medium text-slate-300 transition hover:border-indigo-500 hover:bg-indigo-500/10 hover:text-white"
                            >
                              {isCopied ? (
                                <FiCheck className="h-4 w-4 text-emerald-400" />
                              ) : (
                                <FiCopy className="h-4 w-4" />
                              )}
                              <span>{isCopied ? "Copied" : "Copy Caption"}</span>
                            </button>
                          </article>
                        );
                      })}
                    </div>
                  </section>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
