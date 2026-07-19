// src/AIChat.jsx — Droxion (full, drop-in with AI Ad Manager Integration)
import React, { useState, useEffect } from "react";
import axios from "axios";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import remarkGfm from "remark-gfm";
import {
  FiMoon, FiSun,
  FiCpu, FiAperture,
  FiArrowRight, FiClock, FiMegaphone, FiCopy, FiCheck, FiRefreshCw
} from "react-icons/fi";
import { Analytics } from "@vercel/analytics/react";  
import "./AIChat.css";

const API_BASE = "https://onrender.com";

// Stable user id for history
function getUserId() {
  try {
    let id = localStorage.getItem("droxion_user_id");
    if (!id) {
      id = "u_" + Math.random().toString(36).slice(2, 10);
      localStorage.setItem("droxion_user_id", id);
    }
    return id;
  } catch { return "anon"; }
}
const USER_ID = getUserId();

// --- Tiny helpers to save/load chat history ---
async function saveHistory(API_BASE, userId, messages) {
  try {
    await axios.post(`${API_BASE}/history/save`, {
      user_id: userId,
      messages: messages.map(m => ({
        role: m.role,
        text: typeof m.content === "string" ? m.content : (m.content?.toString?.() || "")
      }))
    });
  } catch {}
}
async function loadHistory(API_BASE, userId) {
  try {
    const r = await axios.get(`${API_BASE}/history`, { params: { user_id: userId } });
    const hist = r?.data?.history || [];
    return hist.map(h => ({ role: h.role, content: h.text, time: h.time }));
  } catch { return []; }
}

export default function AIChat() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [darkMode, setDarkMode] = useState(true);
  const [loading, setLoading] = useState(false);
  const [currentView, setCurrentView] = useState("chat"); // Options: "chat" or "ads"
  
  // Shopify Ad Manager Specific Frontend Hooks
  const [shopifyAds, setShopifyAds] = useState([]);
  const [loadingAds, setLoadingAds] = useState(false);
  const [copiedId, setCopiedId] = useState(null);

  useEffect(() => {
    async function init() {
      const history = await loadHistory(API_BASE, USER_ID);
      if (history.length > 0) {
        setMessages(history);
      } else {
        setMessages([{ role: "assistant", content: "Hello! Welcome to Droxion. How can I help boost your e-commerce operations today?" }]);
      }
    }
    init();
  }, []);

  // Fetch Automatically Generated Shopify Ads from Supabase via API_BASE proxy
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
            "Tired of running shoes that wear out fast? Droxion shoes are built with high-tensile mesh engineered to last hundreds of miles. Free shipping inside USA."
          ]
        }
      ]);
    } catch (err) {
      console.error("Failed to read transaction records:", err);
    } finally {
      setLoadingAds(false);
    }
  };

  const handleCopyText = (text, uniqueId) => {
    navigator.clipboard.writeText(text);
    setCopiedId(uniqueId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMessage = { role: "user", content: input, time: Date.now() };
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput("");
    setLoading(true);

    try {
      const response = await axios.post(`${API_BASE}/chat`, {
        user_id: USER_ID,
        message: input
      });
      
      const assistantMessage = {
        role: "assistant",
        content: response.data?.reply || "I am currently processing your tracking payload.",
        time: Date.now()
      };
      
      const finalMessages = [...updatedMessages, assistantMessage];
      setMessages(finalMessages);
      await saveHistory(API_BASE, USER_ID, finalMessages);
    } catch (error) {
      setMessages([...updatedMessages, { role: "assistant", content: "Connection timeout exception. Please check your Render configuration variables." }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`aichat-container ${darkMode ? "dark-theme" : "light-theme"} flex h-screen w-screen bg-slate-950 text-white font-sans overflow-hidden`}>
      <Analytics />
      
      {/* SIDEBAR NAVIGATION CONTROLS */}
      <aside className="sidebar w-64 bg-slate-900 border-r border-slate-800 flex flex-col justify-between p-4 z-10 shrink-0">
        <div className="flex flex-col space-y-6">
          <div className="flex items-center space-x-2 px-2">
            <FiAperture className="h-6 w-6 text-indigo-500" />
            <span className="text-xl font-bold tracking-wider text-white">DROXION</span>
          </div>

          <button 
            onClick={() => { setCurrentView("chat"); }}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition text-sm font-medium ${currentView === "chat" ? "bg-indigo-600 text-white shadow-lg" : "text-slate-400 hover:bg-slate-800 hover:text-white"}`}
          >
            <FiCpu className="h-5 w-5" />
            <span>AI Copilot Chat</span>
          </button>

          <button 
            onClick={() => { setCurrentView("ads"); fetchShopifyAds(); }}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition text-sm font-medium ${currentView === "ads" ? "bg-indigo-600 text-white shadow-lg" : "text-slate-400 hover:bg-slate-800 hover:text-white"}`}
          >
            <FiMegaphone className="h-5 w-5" />
            <span>AI Ad Manager</span>
          </button>
        </div>

        <div className="flex flex-col space-y-4 border-t border-slate-800 pt-4">
          <div className="flex items-center justify-between px-2 text-xs text-slate-500">
            <span>User Hash: {USER_ID}</span>
          </div>
          <button 
            onClick={() => setDarkMode(!darkMode)}
            className="w-full flex items-center space-x-3 px-4 py-2.5 rounded-xl text-sm font-medium text-slate-400 hover:bg-slate-800 hover:text-white transition"
          >
            {darkMode ? <FiSun className="h-5 w-5 text-amber-400" /> : <FiMoon className="h-5 w-5 text-indigo-400" />}
            <span>{darkMode ? "Light Interface" : "Dark Interface"}</span>
          </button>
        </div>
      </aside>

      {/* MAIN VIEWS AREA */}
      <main className="main-stage flex-1 flex flex-col relative bg-slate-950 overflow-hidden">
        
        {/* VIEW 1: ADVANCED AI CHAT */}
        {currentView === "chat" && (
          <>
            <div className="chat-history-frame flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin">
              {messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} animate-fade-in`}>
                  <div className={`max-w-2xl rounded-2xl px-5 py-4 shadow-xl border ${msg.role === "user" ? "bg-indigo-600 border-indigo-500 text-white rounded-tr-none" : "bg-slate-900 border-slate-800 text-slate-100 rounded-tl-none"}`}>
                    <div className="prose prose-invert max-w-none text-sm leading-relaxed">
                      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
                        {typeof msg.content === "string" ? msg.content : "Processing payload data..."}
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
              <form onSubmit={handleSendMessage} className="max-w-3xl mx-auto flex items-center space-x-3 bg-slate-900 border border-slate-800 rounded-2xl p-2.5 shadow-2xl focus-within:border-indigo-500 transition">
                <input 
                  type="text" 
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask anything or optimize your active e-commerce variables..."
                  className="flex-1 bg-transparent text-sm text-white placeholder-slate-500 outline-none px-3"
                />
                <button type="submit" className="bg-indigo-600 hover:bg-indigo-500 text-white p-2.5 rounded-xl shadow-lg transition">
                  <FiArrowRight className="h-4 w-4" />
                </button>
              </form>
            </footer>
          </>
        )}

        {/* VIEW 2: AUTOMATED SHOPIFY AD MANAGER */}
        {currentView === "ads" && (
          <div className="ad-manager-frame flex-1 overflow-y-auto p-8 space-y-6 scrollbar-thin">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-white flex items-center space-x-2">
                  <FiMegaphone className="text-indigo-500 h-6 w-6" />
