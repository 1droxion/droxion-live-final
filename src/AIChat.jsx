import React, { useState, useRef, useEffect } from "react";
import axios from "axios";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";

function AIChat() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);
  const chatContainerRef = useRef(null);

  // Fix mobile viewport height on keyboard open
  useEffect(() => {
    const fixHeight = () => {
      if (chatContainerRef.current) {
        chatContainerRef.current.style.height = window.innerHeight + "px";
      }
    };
    window.addEventListener("resize", fixHeight);
    fixHeight();
    return () => window.removeEventListener("resize", fixHeight);
  }, []);

  const sendMessage = async (customInput) => {
    const prompt = customInput || input;
    if (!prompt.trim()) return;

    const userMsg = { role: "user", content: prompt };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      if (prompt.toLowerCase().includes("image")) {
        const imgRes = await axios.post("https://droxion-backend.onrender.com/generate-image", { prompt });
        const imgUrl = imgRes.data.image_url;
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: `<div style="margin-top:10px;"><img src="${imgUrl}" alt="Generated Image" style="width:100%; border-radius:12px;" /></div>`,
          },
        ]);
      } else if (prompt.toLowerCase().includes("youtube") || prompt.toLowerCase().includes("video")) {
        const ytRes = await axios.post("https://droxion-backend.onrender.com/search-youtube", { prompt });
        const ytUrl = ytRes.data.url;
        const title = ytRes.data.title;
        let videoId = "";
        try {
          const ytURL = new URL(ytUrl);
          videoId = ytURL.searchParams.get("v") || ytURL.pathname.split("/").pop();
        } catch (e) {}
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: `<b>📺 ${title}</b><br/><iframe width="100%" height="315" src="https://www.youtube.com/embed/${videoId}" frameborder="0" allowfullscreen></iframe>`,
          },
        ]);
      } else {
        const res = await axios.post("https://droxion-backend.onrender.com/chat", { prompt });
        let reply = res.data.reply;
        reply = reply.replace(/(https?:\/\/[^\s]+)/g, (url) => `[🔗 ${url}](${url})`);
        setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
      }
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: "⚠️ Error from AI. Try again." }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const ToolButton = ({ title }) => (
    <button
      onClick={() => sendMessage(title)}
      className="border border-gray-700 bg-black text-white px-3 py-1 rounded-full text-xs hover:bg-white hover:text-black transition whitespace-nowrap"
    >
      {title}
    </button>
  );

  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, loading]);

  return (
    <div
      className="bg-black text-white flex flex-col w-full"
      ref={chatContainerRef}
      style={{ height: "100dvh", maxHeight: "100dvh", overflow: "hidden" }}
    >
      {/* Logo Header */}
      <div className="text-center pt-4 pb-2">
        <h1 className="text-2xl font-bold text-gray-400 tracking-widest">Droxion</h1>
      </div>

      {/* Chat messages */}
      <div className="flex-1 overflow-y-auto px-3 max-w-3xl mx-auto w-full pb-32">
        {messages.length === 0 ? (
          <div className="flex flex-col justify-center items-center h-full">
            <div className="bg-[#111] border border-gray-700 rounded-2xl p-5 w-full shadow-xl max-w-md text-center">
              <p className="text-sm text-gray-300 mb-4">What do you want to know?</p>
              <input
                type="text"
                placeholder="Ask anything..."
                className="w-full bg-transparent text-white text-sm outline-none border border-gray-700 rounded-full px-4 py-2 mb-4"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
              />
              <div className="flex flex-wrap justify-center gap-2 mb-4">
                {["DeepSearch", "Think", "Create Images", "Research", "Edit Image", "Latest News", "Personas"].map((title) => (
                  <ToolButton key={title} title={title} />
                ))}
              </div>
              <button
                onClick={() => input.trim() && sendMessage()}
                disabled={loading || !input.trim()}
                className="bg-white text-black text-sm px-4 py-2 rounded-full hover:bg-gray-200 transition"
              >
                ➤
              </button>
            </div>
          </div>
        ) : (
          <>
            {messages.map((msg, i) => (
              <div key={i} className={`my-3 text-sm ${msg.role === "user" ? "text-right" : "text-left"}`}>
                <div
                  className={`inline-block p-3 rounded-xl max-w-full break-words ${
                    msg.role === "user" ? "bg-blue-700" : "bg-[#1a1a1a]"
                  }`}
                >
                  <ReactMarkdown className="prose prose-invert text-sm" rehypePlugins={[rehypeRaw]}>
                    {msg.content}
                  </ReactMarkdown>
                </div>
              </div>
            ))}
            {loading && (
              <div className="my-3 text-left text-sm text-gray-400 px-2">
                <div className="flex gap-1 animate-pulse text-2xl">
                  <span className="animate-bounce">.</span>
                  <span className="animate-bounce delay-100">.</span>
                  <span className="animate-bounce delay-200">.</span>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </>
        )}
      </div>

      {/* Bottom Input */}
      {messages.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-black border-t border-gray-800 px-2 py-4 z-50">
          <div className="flex justify-start overflow-x-auto no-scrollbar gap-2 max-w-full px-2 pb-2">
            {["DeepSearch", "Think", "Create Images", "Research", "Edit Image", "Latest News", "Personas"].map((title) => (
              <ToolButton key={title} title={title} />
            ))}
          </div>
          <div className="flex max-w-2xl mx-auto bg-[#111] rounded-full px-4 py-2 items-center mt-2">
            <input
              type="text"
              placeholder="Ask anything..."
              className="flex-1 bg-transparent text-white text-sm outline-none"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
            />
            <button
              onClick={() => sendMessage()}
              disabled={loading}
              className="ml-3 px-3 py-1 rounded-full bg-white text-black text-sm hover:bg-gray-300 transition"
            >
              ➤
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default AIChat;
