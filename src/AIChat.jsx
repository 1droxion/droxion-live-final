import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import {
  FaTrash, FaDownload, FaClock, FaPlus,
  FaVolumeUp, FaVolumeMute, FaMicrophone,
  FaUpload, FaCamera, FaDesktop
} from "react-icons/fa";

function AIChat() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [voiceMode, setVoiceMode] = useState(false);
  const [topToolsOpen, setTopToolsOpen] = useState(false);
  const chatRef = useRef(null);
  const synth = window.speechSynthesis;
  const userId = useRef("");

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

  // 📱 Mobile Fix: Prevent zoom on iOS
  useEffect(() => {
    const style = document.createElement("style");
    style.innerHTML = `
      textarea, input {
        font-size: 16px !important;
      }
      img, iframe {
        max-width: 100% !important;
        height: auto !important;
      }
    `;
    document.head.appendChild(style);
    return () => {
      document.head.removeChild(style);
    };
  }, []);

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
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "en-US";
    synth.cancel();
    synth.speak(u);
  };

  const handleSend = async (textToSend = input) => {
    if (!textToSend.trim()) return;
    const userMsg = { role: "user", content: textToSend };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setTyping(true);
    logAction("message", textToSend);

    try {
      const lower = textToSend.toLowerCase();
      const ytKW = ["youtube", "video", "watch", "trailer", "music"];
      const imgKW = ["image", "photo", "draw", "picture", "generate"];
      let handled = false;

      // 🎥 YouTube
      if (ytKW.some(k => lower.includes(k))) {
        const res = await axios.post("https://droxion-backend.onrender.com/search-youtube", { prompt: textToSend });
        if (res.data?.url) {
          const videoId = res.data.url.split("v=")[1];
          const iframe = `<iframe width="360" height="203" class="rounded-lg my-2 max-w-xs" src="https://www.youtube.com/embed/${videoId}" allowfullscreen></iframe>`;
          setMessages(prev => [...prev, { role: "assistant", content: iframe }]);
          handled = true;
        }
      }

      // 🖼️ Image
      if (!handled && imgKW.some(k => lower.includes(k))) {
        const im = await axios.post("https://droxion-backend.onrender.com/generate-image", { prompt: textToSend });
        if (im.data?.image_url) {
          setMessages(prev => [...prev, {
            role: "assistant",
            content: `![AI Image](${im.data.image_url})`,
          }]);
          handled = true;
        }
      }

      // 📈 Stock
      if (!handled && lower.startsWith("stock:")) {
        const stock = lower.replace("stock:", "").trim().toUpperCase();
        const iframe = `<iframe src="https://www.google.com/finance/quote/${stock}:NASDAQ" width="100%" height="200" frameborder="0"></iframe>`;
        setMessages(prev => [...prev, {
          role: "assistant",
          content: `<b>📈 ${stock} Live Stock:</b><br>${iframe}`,
        }]);
        handled = true;
      }

      // ☁️ Weather
      if (!handled && lower.startsWith("weather in ")) {
        const city = textToSend.slice(11).trim();
        const w = await axios.post("https://droxion-backend.onrender.com/realtime/weather", { city });
        setMessages(prev => [...prev, {
          role: "assistant",
          content: `🌤️ Weather in ${w.data.city}:\n**${w.data.temp}, ${w.data.condition}**`,
        }]);
        handled = true;
      }

      // 📰 News
      if (!handled && lower.includes("news")) {
        const n = await axios.post("https://droxion-backend.onrender.com/realtime/news", {});
        const headlines = n.data.headlines.map(h => `• ${h}`).join("\n");
        setMessages(prev => [...prev, {
          role: "assistant",
          content: `📰 **Headlines:**\n${headlines}`,
        }]);
        handled = true;
      }

      // 🕒 Time
      if (!handled && lower.includes("time in ")) {
        const city = lower.split("time in ")[1];
        const t = await axios.post("https://droxion-backend.onrender.com/realtime/time", { city });
        setMessages(prev => [...prev, {
          role: "assistant",
          content: `⏰ **Time in ${t.data.city}:** ${t.data.time}`,
        }]);
        handled = true;
      }

      // 💬 Default Chat
      if (!handled) {
        const res = await axios.post("https://droxion-backend.onrender.com/chat", {
          prompt: textToSend,
          voiceMode,
        });
        let reply = res.data.reply;
        if (/who.*(made|created)/i.test(textToSend)) {
          reply = "I was created and managed by **Dhruv Patel**, powered by OpenAI.";
        }
        setMessages(prev => [...prev, { role: "assistant", content: reply }]);
        speak(reply);
      }
    } catch {
      setMessages(prev => [...prev, {
        role: "assistant",
        content: "⚠️ Error or connection failed.",
      }]);
    } finally {
      setTyping(false);
    }
  };

  const handlePromptClick = (style) => {
    handleSend(`Generate an image in ${style} style.`);
  };

  const handleMic = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return alert("Mic not supported");
    const recog = new SR();
    recog.lang = "en-US";
    recog.start();
    recog.onresult = e => setInput(e.results[0][0].transcript);
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
        <div className="relative">
          {topToolsOpen && (
            <div className="flex gap-4 bg-black border border-gray-700 px-2 py-1 rounded z-20 text-sm">
              <FaTrash onClick={() => setMessages([])} className="cursor-pointer" title="Clear" />
              <FaDownload className="cursor-pointer" title="Download" />
              <FaClock className="cursor-pointer" title="History" />
              <FaMicrophone className="cursor-pointer" onClick={handleMic} />
              {voiceMode
                ? <FaVolumeUp onClick={() => setVoiceMode(false)} />
                : <FaVolumeMute onClick={() => setVoiceMode(true)} />}
              <FaUpload onClick={() => document.getElementById("fileUpload").click()} />
              <FaCamera />
              <FaDesktop />
              <input type="file" id="fileUpload" hidden accept="image/*" />
            </div>
          )}
          <FaPlus onClick={() => setTopToolsOpen(!topToolsOpen)} />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((msg, i) => (
          <div key={i}
            className={`px-3 whitespace-pre-wrap text-sm max-w-xl ${msg.role === "user" ? "self-end text-right" : "self-start text-left"}`}>
            <ReactMarkdown rehypePlugins={[rehypeRaw]} components={{
              img: ({ ...props }) => <img {...props} className="rounded-lg my-2 max-w-xs" />,
              iframe: ({ ...props }) => <iframe {...props} className="rounded-lg my-2 max-w-xs" allowFullScreen />
            }}>{msg.content}</ReactMarkdown>
          </div>
        ))}
        {typing && <div className="ml-4 text-left">💬 Thinking...</div>}
        <div ref={chatRef} />
      </div>

      <div className="px-3 pb-1">
        <div className="flex gap-2 flex-wrap">
          {["Cinematic", "Anime", "Futuristic", "Fantasy", "Realistic"].map(s => (
            <button key={s} onClick={() => handlePromptClick(s)}
              className="px-3 py-1 border border-white rounded-full text-sm hover:bg-white hover:text-black">
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="p-3 border-t border-gray-700">
        <div className="flex items-center space-x-2">
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKey}
            className="flex-1 p-2 rounded bg-black text-white border border-gray-600 focus:outline-none"
            placeholder="Type your message..."
          />
          <button onClick={() => handleSend(input)}
            className="bg-white hover:bg-gray-300 text-black font-bold py-2 px-4 rounded">
            ➤
          </button>
        </div>
      </div>
    </div>
  );
}

export default AIChat;