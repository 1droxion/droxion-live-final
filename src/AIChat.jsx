import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import { FaMicrophone, FaUpload, FaCamera, FaDesktop } from "react-icons/fa";

function AIChat() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const chatRef = useRef(null);

  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim()) return;
    const userMessage = { role: "user", content: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    try {
      const res = await axios.post("https://droxion-backend.onrender.com/chat", {
        message: input,
      });
      setMessages((prev) => [...prev, { role: "assistant", content: res.data.response }]);
    } catch (err) {
      setMessages((prev) => [...prev, { role: "assistant", content: "⚠️ Error!" }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const parseContent = (text) => {
    if (text.includes("youtube.com") || text.includes("youtu.be")) {
      const url = text.match(/(https?:\/\/[^\s]+)/g)?.[0];
      const videoId = url?.split("v=")[1] || url?.split("/").pop();
      return (
        <iframe
          width="100%"
          height="200"
          src={`https://www.youtube.com/embed/${videoId}`}
          frameBorder="0"
          allow="autoplay; encrypted-media"
          allowFullScreen
        ></iframe>
      );
    } else if (text.match(/\.(jpeg|jpg|png|gif)/)) {
      const imgUrl = text.match(/(https?:\/\/[^\s]+)/g)?.[0];
      return <img src={imgUrl} alt="preview" className="rounded-xl max-w-full" />;
    } else {
      return (
        <ReactMarkdown rehypePlugins={[rehypeRaw]} className="whitespace-pre-wrap">
          {text}
        </ReactMarkdown>
      );
    }
  };

  return (
    <div className="bg-black text-white min-h-screen flex flex-col overflow-hidden">
      <div className="text-center text-gray-300 text-2xl mt-4 mb-2 font-semibold">Droxion</div>

      {/* Chat area */}
      <div
        ref={chatRef}
        className="flex-1 overflow-y-auto px-4 py-2 space-y-4 custom-scrollbar"
        style={{ scrollBehavior: "smooth" }}
      >
        {messages.length === 0 ? (
          <div className="flex justify-center items-center h-[60vh]">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder="Ask anything..."
              className="bg-[#111] text-white px-6 py-3 rounded-full outline-none text-center w-[80%]"
            />
          </div>
        ) : (
          <>
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`max-w-[80%] px-4 py-2 rounded-2xl text-sm whitespace-pre-wrap break-words ${
                  msg.role === "user"
                    ? "bg-blue-600 text-white self-end ml-auto"
                    : "bg-[#1f1f1f] text-gray-100 self-start"
                }`}
              >
                {parseContent(msg.content)}
              </div>
            ))}

            {loading && (
              <div className="text-left text-gray-400 animate-pulse px-4">Thinking...</div>
            )}
          </>
        )}
      </div>

      {/* Bottom tools + input */}
      <div className="bg-black px-2 pt-2 pb-4 sticky bottom-0 flex flex-col items-center space-y-2">
        {messages.length > 0 && (
          <>
            <div className="flex flex-wrap justify-center gap-2">
              {[
                "DeepSearch",
                "Think",
                "Create Images",
                "Research",
                "Edit Image",
                "Latest News",
                "Personas",
              ].map((btn, idx) => (
                <button
                  key={idx}
                  className="border border-white text-white text-sm rounded-full px-3 py-1"
                  onClick={() => setInput(btn)}
                >
                  {btn}
                </button>
              ))}
            </div>
            <div className="flex w-full items-center mt-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyPress}
                placeholder="Ask anything..."
                className="flex-1 bg-[#111] text-white px-4 py-2 rounded-full outline-none"
              />
              <button onClick={sendMessage} className="ml-2 bg-white text-black rounded-full p-2">
                ▶
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default AIChat;
