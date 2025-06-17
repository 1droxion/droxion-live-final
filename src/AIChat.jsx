import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import {
  FaTrash, FaDownload, FaClock, FaPlus, FaVolumeUp,
  FaVolumeMute, FaVideo, FaMicrophone, FaBookmark, FaPlay
} from "react-icons/fa";

function AIChat() {
  const [sessions, setSessions] = useState(() => {
    const saved = localStorage.getItem("droxion_sessions");
    return saved ? JSON.parse(saved) : { default: [] };
  });
  const [currentSession, setCurrentSession] = useState("default");
  const [messages, setMessages] = useState(sessions["default"]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [voiceMode, setVoiceMode] = useState(false);
  const [videoMode, setVideoMode] = useState(false);
  const [typingDots, setTypingDots] = useState(".");
  const [bookmarks, setBookmarks] = useState([]);
  const [voices, setVoices] = useState([]);
  const [selectedVoice, setSelectedVoice] = useState(null);
  const chatRef = useRef(null);
  const synth = window.speechSynthesis;

  useEffect(() => {
    if (typing) {
      const interval = setInterval(() => {
        setTypingDots((dots) => (dots.length === 3 ? "." : dots + "."));
      }, 400);
      return () => clearInterval(interval);
    }
  }, [typing]);

  useEffect(() => {
    chatRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const v = synth.getVoices();
    setVoices(v);
    setSelectedVoice(v.find((voice) => voice.name.includes("Female")) || v[0]);
  }, []);

  const speak = (text) => {
    if (!voiceMode || !text || !selectedVoice) return;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.voice = selectedVoice;
    utterance.lang = selectedVoice.lang;
    synth.cancel();
    synth.speak(utterance);
  };

  const updateSessionMessages = (msgs) => {
    const updated = { ...sessions, [currentSession]: msgs };
    setSessions(updated);
    localStorage.setItem("droxion_sessions", JSON.stringify(updated));
  };

  const handleSend = async () => {
    if (!input.trim()) return;
    const userMsg = { role: "user", content: input };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    updateSessionMessages(newMessages);
    setInput("");
    setTyping(true);

    try {
      const context = messages[0]?.content || input;
      const res = await axios.post("https://droxion-backend.onrender.com/chat", {
        prompt: input,
        context,
        voiceMode,
        videoMode,
      });
      const reply = res.data.reply;
      const botMsg = { role: "assistant", content: reply };
      const updatedMessages = [...newMessages, botMsg];
      setMessages(updatedMessages);
      updateSessionMessages(updatedMessages);
    } catch {
      const err = { role: "assistant", content: "❌ Error: Something went wrong." };
      const updatedMessages = [...messages, err];
      setMessages(updatedMessages);
      updateSessionMessages(updatedMessages);
    } finally {
      setTyping(false);
    }
  };

  const handleMic = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return alert("Mic not supported");
    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.start();
    recognition.onresult = (e) => setInput(e.results[0][0].transcript);
  };

  const handleKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const createSession = () => {
    const name = prompt("Session name?");
    if (!name || sessions[name]) return;
    const updated = { ...sessions, [name]: [] };
    setSessions(updated);
    setCurrentSession(name);
    setMessages([]);
    localStorage.setItem("droxion_sessions", JSON.stringify(updated));
  };

  const renameSession = () => {
    const newName = prompt("New name?");
    if (!newName || sessions[newName]) return;
    const updated = {};
    Object.keys(sessions).forEach((key) => {
      updated[key === currentSession ? newName : key] = sessions[key];
    });
    setSessions(updated);
    setCurrentSession(newName);
    localStorage.setItem("droxion_sessions", JSON.stringify(updated));
  };

  const deleteSession = () => {
    if (!window.confirm("Delete this chat?")) return;
    const updated = { ...sessions };
    delete updated[currentSession];
    const next = Object.keys(updated)[0] || "default";
    if (!updated[next]) updated[next] = [];
    setSessions(updated);
    setCurrentSession(next);
    setMessages(updated[next]);
    localStorage.setItem("droxion_sessions", JSON.stringify(updated));
  };

  return (
    <div className="bg-black text-white min-h-screen flex flex-col">
      <div className="flex items-center justify-between p-3 border-b border-gray-700">
        <div className="text-lg font-bold">
          💬 <span className="text-white">AI Chat (Droxion)</span>
        </div>
        <div className="flex space-x-2 items-center">
          <select
            onChange={(e) => setSelectedVoice(voices.find(v => v.name === e.target.value))}
            className="text-black text-xs px-2 py-1 rounded"
          >
            {voices.map((v, i) => (
              <option key={i} value={v.name}>{v.name}</option>
            ))}
          </select>
          <FaClock title="History" onClick={renameSession} className="cursor-pointer" />
          <FaPlus title="New Chat" onClick={createSession} className="cursor-pointer" />
          <FaTrash title="Delete Chat" onClick={deleteSession} className="cursor-pointer" />
          <FaDownload title="Download" className="cursor-pointer" onClick={() => {
            const text = messages.map((m) => `${m.role === "user" ? "You" : "AI"}: ${m.content}`).join("\n\n");
            const blob = new Blob([text], { type: "text/plain" });
            const link = document.createElement("a");
            link.href = URL.createObjectURL(blob);
            link.download = `${currentSession}.txt`;
            link.click();
          }} />
          <FaMicrophone title="Mic" onClick={handleMic} className="cursor-pointer" />
          {voiceMode ? (
            <FaVolumeUp onClick={() => setVoiceMode(false)} title="Speaker On" className="cursor-pointer" />
          ) : (
            <FaVolumeMute onClick={() => setVoiceMode(true)} title="Speaker Off" className="cursor-pointer" />
          )}
          <FaVideo onClick={() => setVideoMode(!videoMode)} title="Video Mode" className={`cursor-pointer ${videoMode ? 'text-green-500' : ''}`} />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((msg, i) => (
          <div key={i} className={`px-3 whitespace-pre-wrap text-sm max-w-xl ${msg.role === "user" ? "text-right self-end" : "text-left self-start"}`}>
            <ReactMarkdown rehypePlugins={[rehypeRaw]} components={{
              img: ({ node, ...props }) => (
                <img {...props} alt="Generated" className="rounded-lg my-2 max-w-xs" />
              ),
              iframe: ({ node, ...props }) => (
                <div className="my-2">
                  <iframe {...props} className="w-full h-48 rounded-lg" />
                </div>
              )
            }}>{msg.content}</ReactMarkdown>
            {msg.role === "assistant" && (
              <div className="flex space-x-2 mt-1">
                <FaPlay onClick={() => speak(msg.content)} className="text-green-400 cursor-pointer" title="Tap to Speak" />
                <FaBookmark onClick={() => setBookmarks([...bookmarks, msg])} className="text-yellow-300 cursor-pointer" title="Bookmark" />
              </div>
            )}
          </div>
        ))}
        {typing && <div className="text-gray-500">Typing{typingDots}</div>}
        <div ref={chatRef} />
      </div>

      <div className="p-3 border-t border-gray-700">
        <div className="flex items-center space-x-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKey}
            className="flex-1 p-2 rounded bg-gray-900 text-white border border-gray-600 focus:outline-none"
            placeholder="Type or say anything..."
          />
          <button
            onClick={handleSend}
            className="bg-white hover:bg-gray-300 text-black font-bold py-2 px-4 rounded"
          >
            ➤
          </button>
        </div>
      </div>
    </div>
  );
}

export default AIChat;
