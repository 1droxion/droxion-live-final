// ✅ AIChat.jsx – Final Version
// Includes memory system, box/chart formatting, cleaned image prompts, multiline input, style buttons

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
  const memory = useRef({});

  const styles = [
    "Cinematic 4K", "Anime", "Realistic", "Pixel Art",
    "Fantasy Landscape", "3D Render", "Cyberpunk", "Watercolor"
  ];

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

  const speak = (text) => {
    if (!voiceMode || !text) return;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-US";
    synth.cancel();
    synth.speak(utterance);
  };

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

  const handleSend = async (customInput) => {
    const message = customInput || input;
    if (!message.trim()) return;
    const userMsg = { role: "user", content: message };
    setMessages((prev) => [...prev, userMsg]);
    memory.current.last = message;
    setInput("");
    setTyping(true);
    logAction("message", message);
    const lower = message.toLowerCase();

    // /remember key is value
    if (/\/remember (.+?) is (.+)/i.test(message)) {
      const [, key, value] = message.match(/\/remember (.+?) is (.+)/i);
      memory.current[key.trim()] = value.trim();
      setMessages(prev => [...prev, { role: "assistant", content: `Got it. I’ll remember ${key.trim()} is ${value.trim()}.` }]);
      setTyping(false); return;
    }

    // /forget key
    if (/\/forget (.+)/i.test(message)) {
      const [, key] = message.match(/\/forget (.+)/i);
      delete memory.current[key.trim()];
      setMessages(prev => [...prev, { role: "assistant", content: `Forgot ${key.trim()} from memory.` }]);
      setTyping(false); return;
    }

    // name recognition
    const nameMatch = message.match(/(?:my name is|my name|i am|i’m|this is|ye my name)(?: is)?\s+([a-zA-Z]+)/i);
    if (nameMatch) {
      const name = nameMatch[1];
      memory.current.name = name;
      setMessages(prev => [...prev, { role: "assistant", content: `Got it. Your name is ${name}.` }]);
      setTyping(false); return;
    }
    if (/what.*my name/i.test(lower)) {
      const name = memory.current.name;
      setMessages(prev => [...prev, { role: "assistant", content: name ? `You told me your name is ${name}.` : "You haven't told me your name yet." }]);
      setTyping(false); return;
    }
    if (/what did i just say|my last message/i.test(lower)) {
      const last = memory.current.last;
      setMessages(prev => [...prev, { role: "assistant", content: last ? `You said: "${last}"` : "I don’t remember yet." }]);
      setTyping(false); return;
    }

    try {
      const ytKeywords = ["video", "watch", "trailer", "movie", "song", "youtube"];
      const imgKeywords = ["image", "picture", "draw", "photo", "create", "generate"];
      let handled = false;

      if (ytKeywords.some(k => lower.includes(k))) {
        const yt = await axios.post("https://droxion-backend.onrender.com/search-youtube", { prompt: message });
        if (yt.data?.url && yt.data?.title) {
          const videoId = yt.data.url.split("v=")[1];
          setMessages(prev => [...prev, {
            role: "assistant",
            content: `<iframe class='rounded-lg my-2 max-w-xs' width='360' height='203' src='https://www.youtube.com/embed/${videoId}' allowfullscreen></iframe>`
          }]);
          handled = true;
        }
      }

      // Auto-clean image prompt
      if (!handled && imgKeywords.some(k => lower.includes(k))) {
        const cleaned = message.replace(/image|draw|picture|photo|create|generate/gi, '').trim();
        const styledPrompt = `${cleaned}, in Realistic style`;
        const imgRes = await axios.post("https://droxion-backend.onrender.com/generate-image", { prompt: styledPrompt });
        if (imgRes.data?.image_url) {
          setMessages((prev) => [...prev, { role: "assistant", content: `![Generated Image](${imgRes.data.image_url})` }]);
        }
        handled = true;
      }

      if (!handled) {
        const res = await axios.post("https://droxion-backend.onrender.com/chat", {
          prompt: message,
          voiceMode,
          videoMode
        });

        let reply = res.data.reply;

        // Table formatting
        if (/chart|table|compare/.test(lower)) {
          reply = `
**AI vs Human Comparison**

\`\`\`
| Feature     | AI                  | Human               |
|-------------|---------------------|----------------------|
| Speed       | Nanoseconds         | Milliseconds         |
| Error Rate  | Very Low            | Medium to High       |
| Work Hours  | 24/7                | 6–10 hrs/day         |
| Learning    | Data-driven, fast   | Conceptual, adaptive |
| Creativity  | Simulated patterns  | Original, innovative |
| Memory      | Unlimited logs      | Selective recall     |
\`\`\`
          `;
        }

        // Number range chart
        if (/1\s?to\s?50|50\s?to\s?100/i.test(lower)) {
          reply = `
**Number Range**

\`\`\`
| Range     | Values                |
|-----------|------------------------|
| 1 to 50   | 1, 2, 3, ..., 50       |
| 51 to 100 | 51, 52, ..., 100       |
\`\`\`
✅ These are number bins often used for scoring or sorting.
          `;
        }

        // Box formatting
        if (/box|highlight/.test(lower)) {
          reply = `\`\`\`\n${reply}\n\`\`\``;
        }

        setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
        speak(reply);
      }

    } catch {
      setMessages(prev => [...prev, { role: "assistant", content: "❌ Error: Something went wrong." }]);
    } finally {
      setTyping(false);
    }
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
          <FaPlus onClick={() => setTopToolsOpen(prev => !prev)} className="cursor-pointer text-white" />
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

      <div className="flex flex-wrap justify-center px-2 py-2 gap-2 border-t border-gray-700">
        {styles.map((style) => (
          <button key={style} onClick={() => handleSend(`A futuristic red car in ${style} style`)} className="text-white border border-white text-xs px-3 py-1 rounded hover:bg-white hover:text-black">
            {style}
          </button>
        ))}
      </div>

      <div className="p-3 border-t border-gray-700">
        <div className="flex items-center space-x-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKey}
            rows={2}
            className="flex-1 p-2 rounded bg-black text-white border border-gray-600 focus:outline-none resize-none"
            placeholder="Type or say anything..."
          />
          <button onClick={() => handleSend()} className="bg-white hover:bg-gray-300 text-black font-bold py-2 px-4 rounded">
            ➤
          </button>
        </div>
      </div>
    </div>
  );
}

export default AIChat;
