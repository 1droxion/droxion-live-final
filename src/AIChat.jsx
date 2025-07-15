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
      const ytKW = ["video","watch","trailer","movie","song","youtube"];
      const imgKW = ["image","picture","draw","photo","create","generate"];
      let handled = false;

      // YouTube
      if (ytKW.some(k => lower.includes(k))) {
        const yt = await axios.post("https://droxion-backend.onrender.com/search-youtube", { prompt: textToSend });
        if (yt.data?.url) {
          const vid = yt.data.url.split("v=")[1];
          setMessages(prev => [...prev, {
            role: "assistant",
            content: `<iframe class='rounded-lg my-2 max-w-xs' width='360' height='203' src='https://www.youtube.com/embed/${vid}' allowFullScreen></iframe>`
          }]);
          handled = true;
        }
      }

      // Image
      if (!handled && imgKW.some(k => lower.includes(k))) {
        const im = await axios.post("https://droxion-backend.onrender.com/generate-image", { prompt: textToSend });
        if (im.data?.image_url) {
          setMessages(prev => [...prev, {
            role: "assistant",
            content: `![Generated Image](${im.data.image_url})`
          }]);
          handled = true;
        }
      }

      // Real-time Weather
      if (!handled && lower.startsWith("weather in ")) {
        try {
          const city = textToSend.slice(11).trim();
          const w = await axios.post("https://droxion-backend.onrender.com/realtime/weather", { city });
          setMessages(prev => [...prev, {
            role: "assistant",
            content: `**🌦️ Weather in ${w.data.city}:**\n${w.data.temp}, ${w.data.condition}`
          }]);
        } catch {
          setMessages(prev => [...prev, { role:"assistant", content:`❌ Could not fetch weather.` }]);
        }
        handled = true;
      }

      // Real-time News
      if (!handled && lower.startsWith("news about ")) {
        try {
          const topic = textToSend.slice(11).trim();
          const n = await axios.post("https://droxion-backend.onrender.com/realtime/news", { topic });
          const hl = Array.isArray(n.data.headlines) ? n.data.headlines : [];
          setMessages(prev => [...prev, {
            role:"assistant",
            content: `**📰 Top News on ${topic}:**\n` + hl.map(h=>`• ${h}`).join("\n")
          }]);
        } catch {
          setMessages(prev => [...prev, { role:"assistant", content:`❌ Could not fetch news.` }]);
        }
        handled = true;
      }

      // Real-time Stock
      if (!handled && lower.startsWith("stock price of ")) {
        try {
          const ticker = textToSend.slice(15).trim().toUpperCase();
          const s = await axios.post("https://droxion-backend.onrender.com/realtime/stock", { ticker });
          setMessages(prev => [...prev, {
            role:"assistant",
            content: `**📈 ${s.data.ticker}:** ${s.data.price} (${s.data.change})`
          }]);
        } catch {
          setMessages(prev => [...prev, { role:"assistant", content:`❌ Could not fetch stock.` }]);
        }
        handled = true;
      }

      // Real-time Time
      if (!handled && lower.includes("time in ")) {
        try {
          const city = textToSend.split("time in ")[1].trim();
          const t = await axios.post("https://droxion-backend.onrender.com/realtime/time", { city });
          setMessages(prev => [...prev, {
            role:"assistant",
            content: `**⏰ Current Time in ${t.data.city}:** ${t.data.time}`
          }]);
        } catch {
          setMessages(prev => [...prev, { role:"assistant", content:`❌ Could not fetch time.` }]);
        }
        handled = true;
      }

      // Fallback to AI Chat
      if (!handled) {
        const res = await axios.post("https://droxion-backend.onrender.com/chat", {
          prompt: textToSend, voiceMode
        });
        let reply = res.data.reply;
        if (/who.*(made|created)/i.test(textToSend)) {
          reply = "I was created and managed by **Dhruv Patel**, powered by OpenAI.";
        }
        setMessages(prev => [...prev, { role:"assistant", content: reply }]);
        speak(reply);
      }
    } catch {
      setMessages(prev => [...prev, { role:"assistant", content:"❌ Error: Something went wrong." }]);
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
              <FaTrash className="cursor-pointer" onClick={()=>{setMessages([]);setTopToolsOpen(false)}} title="Clear" />
              <FaDownload className="cursor-pointer" onClick={()=>{
                const txt = messages.map(m=>`${m.role==="user"?"You":"AI"}: ${m.content}`).join("\n\n");
                const blob = new Blob([txt], {type:"text/plain"});
                const link = document.createElement("a");
                link.href = URL.createObjectURL(blob);
                link.download = "chat.txt";
                link.click();
                setTopToolsOpen(false);
              }} title="Download" />
              <FaClock className="cursor-pointer" onClick={()=>setTopToolsOpen(false)} title="History" />
              <FaMicrophone className="cursor-pointer" onClick={()=>{handleMic();setTopToolsOpen(false)}} title="Mic" />
              {voiceMode
                ? <FaVolumeUp className="cursor-pointer" onClick={()=>{setVoiceMode(false);setTopToolsOpen(false)}} title="Speaker On" />
                : <FaVolumeMute className="cursor-pointer" onClick={()=>{setVoiceMode(true);setTopToolsOpen(false)}} title="Speaker Off" />}
              <FaUpload className="cursor-pointer" onClick={()=>{document.getElementById('fileUpload').click();setTopToolsOpen(false)}} title="Upload" />
              <FaCamera className="cursor-pointer" onClick={()=>{alert("Take Photo");setTopToolsOpen(false)}} title="Take Photo" />
              <FaDesktop className="cursor-pointer" onClick={()=>{alert("Screenshot");setTopToolsOpen(false)}} title="Screenshot" />
              <input type="file" id="fileUpload" hidden accept="image/*" />
            </div>
          )}
          <FaPlus className="cursor-pointer ml-2" onClick={()=>setTopToolsOpen(o=>!o)} title="Tools" />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((msg,i) => (
          <div key={i}
            className={`px-3 whitespace-pre-wrap text-sm max-w-xl ${msg.role==="user"?"self-end text-right":"self-start text-left"}`}>
            <ReactMarkdown rehypePlugins={[rehypeRaw]} components={{
              img: ({...p})=><img {...p} className="rounded-lg my-2 max-w-xs"/>,
              iframe: ({...p})=><iframe {...p} className="rounded-lg my-2 max-w-xs" allowFullScreen/>
            }}>{msg.content}</ReactMarkdown>
          </div>
        ))}
        {typing && <div className="text-left ml-4"><span className="inline-block w-2 h-2 bg-white rounded-full animate-ping"/></div>}
        <div ref={chatRef}/>
      </div>

      <div className="px-3 pb-1">
        <div className="flex gap-2 flex-wrap">
          {["Cinematic","Anime","Futuristic","Fantasy","Realistic"].map(s=>(
            <button key={s} onClick={()=>handlePromptClick(s)}
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
            onChange={e=>setInput(e.target.value)}
            onKeyDown={handleKey}
            className="flex-1 p-2 rounded bg-black text-white border border-gray-600 focus:outline-none"
            placeholder="Type or say anything..."
          />
          <button onClick={()=>handleSend(input)}
            className="bg-white hover:bg-gray-300 text-black font-bold py-2 px-4 rounded">
            ➤
          </button>
        </div>
      </div>
    </div>
  );
}

export default AIChat;