// ✅ AIChat.jsx – fixed missing plus icon and dropdown
// Built by Dhruv Patel | Droxion AI

import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import {
  FaTrash, FaDownload, FaClock, FaPlus,
  FaVolumeUp, FaVolumeMute, FaVideo, FaMicrophone,
  FaUpload, FaCamera, FaDesktop
} from "react-icons/fa";

function AIChat() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [voiceMode, setVoiceMode] = useState(false);
  const [videoMode, setVideoMode] = useState(false);
  const [topToolsOpen, setTopToolsOpen] = useState(false);
  const chatRef = useRef(null);
  const synth = window.speechSynthesis;
  const userId = useRef("");

  // ✅ Stripe Unlock Logic
  useEffect(() => {
    const url = window.location.href;
    const isFromStripe = url.includes("/chatboard");

    if (isFromStripe && localStorage.getItem("paid") !== "true") {
      localStorage.setItem("paid", "true");
    }

    if (localStorage.getItem("paid") !== "true") {
      alert("Please subscribe to unlock Droxion.");
      window.location.href = "/";
    }
  }, []);

  useEffect(() => {
    let id = localStorage.getItem("droxion_uid");
    if (!id) {
      id = "user-" + Math.random().toString(36).substring(2, 10);
      localStorage.setItem("droxion_uid", id);
    }
    userId.current = id;
  }, []);

  useEffect(() => {
    chatRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typing]);

  const logAction = async (action, inputText) => {
    try {
      await axios.post("https://droxion-backend.onrender.com/track", {
        user_id: userId.current,
        action,
        input: inputText,
        timestamp: new Date().toISOString()
      });
    } catch (e) {
      console.warn("Tracking failed", e);
    }
  };

  const speak = (text) => {
    if (!voiceMode || !text) return;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-US";
    synth.cancel();
    synth.speak(utterance);
  };

  const handleSend = async (textToSend = input) => {
    if (!textToSend.trim()) return;
    const userMsg = { role: "user", content: textToSend };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setTyping(true);
    logAction("message", textToSend);

    try {
      const lower = textToSend.toLowerCase();
      const ytKeywords = ["video", "watch", "trailer", "movie", "song", "youtube"];
      const imgKeywords = ["image", "picture", "draw", "photo", "create", "generate"];

      let handled = false;

      if (ytKeywords.some((k) => lower.includes(k))) {
        const yt = await axios.post("https://droxion-backend.onrender.com/search-youtube", { prompt: textToSend });
        if (yt.data?.url && yt.data?.title) {
          const videoId = yt.data.url.split("v=")[1];
          setMessages((prev) => [...prev, {
            role: "assistant",
            content: `<iframe class='rounded-lg my-2 max-w-xs' width='360' height='203' src='https://www.youtube.com/embed/${videoId}' allowfullscreen></iframe>`
          }]);
          handled = true;
        }
      }

      if (!handled && imgKeywords.some((k) => lower.includes(k))) {
        const imgRes = await axios.post("https://droxion-backend.onrender.com/generate-image", { prompt: textToSend });
        if (imgRes.data?.image_url) {
          setMessages((prev) => [...prev, {
            role: "assistant",
            content: `![Generated Image](${imgRes.data.image_url})`
          }]);
          handled = true;
        }
      }

      if (!handled) {
        const res = await axios.post("https://droxion-backend.onrender.com/chat", {
          prompt: textToSend,
          voiceMode,
          videoMode,
        });
        let reply = res.data.reply;
        if (/who.*(made|created|owner|built).*you/i.test(textToSend)) {
          reply = "I was created and managed by **Dhruv Patel**, powered by OpenAI.";
        }
        setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
        speak(reply);
      }
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: "❌ Error: Something went wrong." }]);
    } finally {
      setTyping(false);
    }
  };

  const handlePromptClick = (style) => {
    handleSend(`Generate an image in ${style} style.`);
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

  return (
    <div className="bg-black text-white min-h-screen flex flex-col">
      <div className="flex items-center justify-between p-3 border-b border-gray-700">
        <div className="text-lg font-bold">Droxion</div>
        <div className="relative flex items-center">
          {topToolsOpen && (
            <div className="flex gap-4 mr-2 bg-black border border-gray-700 px-2 py-1 rounded z-20 text-sm items-center">
              <FaTrash onClick={() => { setMessages([]); setTopToolsOpen(false); }} className="cursor-pointer" title="Clear" />
              <FaDownload onClick={() => {
                const text = messages.map((m) => `${m.role === "user" ? "You" : "AI"}: ${m.content}`).join("\n\n");
                const blob = new Blob([text], { type: "text/plain" });
                const link = document.createElement("a");
                link.href = URL.createObjectURL(blob);
                link.download = "chat.txt";
                link.click();
                setTopToolsOpen(false);
              }} className="cursor-pointer" title="Download" />
              <FaClock onClick={() => setTopToolsOpen(false)} className="cursor-pointer" title="History" />
              <FaMicrophone onClick={() => { handleMic(); setTopToolsOpen(false); }} className="cursor-pointer" title="Mic" />
              {voiceMode ? (
                <FaVolumeUp onClick={() => { setVoiceMode(false); setTopToolsOpen(false); }} className="cursor-pointer" title="Speaker On" />
              ) : (
                <FaVolumeMute onClick={() => { setVoiceMode(true); setTopToolsOpen(false); }} className="cursor-pointer" title="Speaker Off" />
              )}
              <FaUpload onClick={() => { document.getElementById('fileUpload').click(); setTopToolsOpen(false); }} className="cursor-pointer" title="Upload" />
              <FaCamera onClick={() => { alert("Take Photo"); setTopToolsOpen(false); }} className="cursor-pointer" title="Take Photo" />
              <FaDesktop onClick={() => { alert("Screenshot"); setTopToolsOpen(false); }} className="cursor-pointer" title="Screenshot" />
              <input type="file" id="fileUpload" hidden accept="image/*" onChange={(e) => handleImageUpload(e.target.files[0])} />
            </div>
          )}
          <FaPlus
            title="Tools"
            onClick={() => setTopToolsOpen((prev) => !prev)}
            className="cursor-pointer text-white ml-2"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((msg, i) => (
          <div key={i} className={`px-3 whitespace-pre-wrap text-sm max-w-xl ${msg.role === "user" ? "text-right self-end ml-auto" : "text-left self-start"}`}>
            <ReactMarkdown rehypePlugins={[rehypeRaw]} components={{
              img: ({ node, ...props }) => (<img {...props} alt="Generated" className="rounded-lg my-2 max-w-xs" />),
              iframe: ({ node, ...props }) => (<iframe {...props} className="rounded-lg my-2 max-w-xs" allowFullScreen />)
            }}>{msg.content}</ReactMarkdown>
          </div>
        ))}
        {typing && <div className="text-left ml-4"><span className="inline-block w-2 h-2 bg-white rounded-full animate-[ping_2s_ease-in-out_infinite]" /></div>}
        <div ref={chatRef} />
      </div>

      <div className="px-3 pb-1">
        <div className="flex gap-2 flex-wrap">
          {["Cinematic", "Anime", "Futuristic", "Fantasy", "Realistic"].map((style) => (
            <button
              key={style}
              onClick={() => handlePromptClick(style)}
              className="px-3 py-1 border border-white rounded-full text-sm hover:bg-white hover:text-black"
            >{style}</button>
          ))}
        </div>
      </div>

      <div className="p-3 border-t border-gray-700">
        <div className="flex items-center space-x-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKey}
            className="flex-1 p-2 rounded bg-black text-white border border-gray-600 focus:outline-none"
            placeholder="Type or say anything..."
          />
          <button
            onClick={() => handleSend(input)}
            className="bg-white hover:bg-gray-300 text-black font-bold py-2 px-4 rounded"
          >➤</button>
        </div>
      </div>
    </div>
  );
}

export default AIChat;
