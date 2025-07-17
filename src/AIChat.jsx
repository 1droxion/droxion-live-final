import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";

function AIChat() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const chatRef = useRef(null);

  const sendMessage = async (text) => {
    if (!text.trim()) return;
    const newMessages = [...messages, { role: "user", content: text }];
    setMessages(newMessages);
    setInput("");
    setTyping(true);

    try {
      const res = await axios.post("https://droxion-backend.onrender.com/chat", {
        message: text,
      });

      setMessages((prev) => [...prev, { role: "assistant", content: res.data.reply }]);
    } catch (err) {
      setMessages((prev) => [...prev, { role: "assistant", content: "Error. Try again." }]);
    }
    setTyping(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  useEffect(() => {
    chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, typing]);

  const renderMessage = (msg, idx) => {
    const isUser = msg.role === "user";
    return (
      <div
        key={idx}
        className={`w-full flex ${isUser ? "justify-end" : "justify-start"}`}
      >
        <div
          className={`max-w-[75%] my-1 px-4 py-2 rounded-xl text-white text-sm whitespace-pre-wrap bg-${
            isUser ? "blue-600" : "neutral-800"
          }`}
        >
          <ReactMarkdown rehypePlugins={[rehypeRaw]}>{msg.content}</ReactMarkdown>
        </div>
      </div>
    );
  };

  const ButtonBar = () => (
    <div className="flex flex-wrap justify-center gap-2 px-2 py-2">
      {["DeepSearch", "Think", "Create Images", "Research", "Edit Image", "Latest News", "Personas"].map(
        (label) => (
          <button
            key={label}
            onClick={() => sendMessage(label)}
            className="px-4 py-1 rounded-full border border-white text-white text-sm hover:bg-white hover:text-black transition"
          >
            {label}
          </button>
        )
      )}
    </div>
  );

  return (
    <div className="flex flex-col h-screen w-full bg-black text-white overflow-hidden">
      <div className="text-center text-2xl mt-4 font-semibold text-gray-300">Droxion</div>

      <div
        ref={chatRef}
        className="flex-1 overflow-y-auto px-4 pb-24 mt-4"
      >
        {messages.length === 0 && !typing ? (
          <div className="flex flex-col items-center justify-center h-full">
            <div className="text-xl text-white mb-4">What do you want to know?</div>
            <ButtonBar />
          </div>
        ) : (
          <>
            {messages.map((msg, idx) => renderMessage(msg, idx))}
            {typing && (
              <div className="flex justify-start px-4">
                <div className="bg-neutral-800 text-white text-sm px-4 py-2 rounded-xl">Thinking...</div>
              </div>
            )}
          </>
        )}
      </div>

      <div className="fixed bottom-0 w-full bg-black border-t border-neutral-800 py-2 px-4">
        <ButtonBar />
        <div className="flex items-center gap-2 mt-2">
          <input
            className="flex-1 bg-neutral-900 text-white text-sm px-4 py-2 rounded-full outline-none"
            placeholder="Ask anything..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <button
            onClick={() => sendMessage(input)}
            className="bg-white text-black rounded-full p-2"
          >
            ▶
          </button>
        </div>
      </div>
    </div>
  );
}

export default AIChat;
