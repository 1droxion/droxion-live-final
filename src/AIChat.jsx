import React, { useState, useRef, useEffect } from "react";
import axios from "axios";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";

function AIChat() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const chatRef = useRef(null);

  const sendMessage = async () => {
    if (!input.trim()) return;
    const prompt = input.trim();
    setMessages([...messages, { type: "user", text: prompt }]);
    setInput("");
    setTyping(true);

    try {
      // IMAGE
      if (prompt.toLowerCase().includes("image")) {
        const res = await axios.post("https://droxion-backend.onrender.com/generate-image", { prompt });
        const imgUrl = res.data.image_url || "";
        setMessages((prev) => [...prev, { type: "ai", text: `<img src="${imgUrl}" alt="Generated Image" style="max-width:100%; border-radius:10px;" onerror="this.style.display='none';" />` }]);
      }

      // YOUTUBE
      else if (prompt.toLowerCase().includes("youtube") || prompt.toLowerCase().includes("video")) {
        const yt = await axios.post("https://droxion-backend.onrender.com/search-youtube", { prompt });
        const url = yt.data.url || "";
        const title = yt.data.title || "YouTube Video";
        setMessages((prev) => [...prev, {
          type: "ai",
          text: `<div style="border-radius:10px; overflow:hidden;">
                   <iframe width="100%" height="200" src="https://www.youtube.com/embed/${url.split("v=")[1]}" frameborder="0" allowfullscreen></iframe>
                   <div style="font-size:14px; margin-top:5px;"><b>${title}</b></div>
                 </div>`
        }]);
      }

      // NORMAL AI
      else {
        const res = await axios.post("https://droxion-backend.onrender.com/chat", { prompt });
        const reply = res.data.reply || "No response.";
        setMessages((prev) => [...prev, { type: "ai", text: reply }]);
      }

    } catch (err) {
      setMessages((prev) => [...prev, { type: "ai", text: "⚠️ Error getting reply." }]);
    }

    setTyping(false);
  };

  useEffect(() => {
    chatRef.current?.scrollTo(0, chatRef.current.scrollHeight);
  }, [messages, typing]);

  return (
    <div className="flex flex-col h-screen bg-black text-white font-sans">
      {/* Header */}
      <div className="text-center text-2xl font-bold py-4 text-gray-300">Droxion</div>

      {/* Chat */}
      <div ref={chatRef} className="flex-1 overflow-y-auto px-4 pb-20">
        {messages.map((msg, idx) => (
          <div key={idx} className={`my-3 flex ${msg.type === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`rounded-xl px-4 py-2 max-w-[75%] text-sm leading-relaxed 
              ${msg.type === "user" ? "bg-blue-600 text-white" : "bg-neutral-900 text-white"}`}>
              <ReactMarkdown rehypePlugins={[rehypeRaw]} children={msg.text} />
            </div>
          </div>
        ))}

        {typing && (
          <div className="flex justify-start my-2">
            <div className="bg-neutral-900 px-4 py-2 rounded-xl text-sm flex space-x-1">
              <span className="animate-bounce">●</span>
              <span className="animate-bounce delay-100">●</span>
              <span className="animate-bounce delay-200">●</span>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-black border-t border-neutral-800 p-3">
        <div className="flex justify-center flex-wrap gap-2 mb-3">
          {["DeepSearch", "Think", "Create Images", "Research", "Edit Image", "Latest News", "Personas"].map((btn, i) => (
            <button key={i} onClick={() => setInput(btn)} className="border px-3 py-1 rounded-full text-sm hover:bg-white hover:text-black transition">
              {btn}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <input
            className="flex-1 bg-neutral-900 text-white px-4 py-2 rounded-full outline-none"
            placeholder="Ask anything..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendMessage()}
          />
          <button onClick={sendMessage} className="bg-white text-black rounded-full p-2">
            ▶
          </button>
        </div>
      </div>
    </div>
  );
}

export default AIChat;
