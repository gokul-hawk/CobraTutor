import React, { useState } from "react";
import { motion } from "framer-motion";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";

const ChatArea = () => {
  const [messages, setMessages] = useState([
    { sender: "ai", content: "Hello 👋! I’m your tutor. What topic would you like to learn today?" },
  ]);
  const [input, setInput] = useState("");

  const sendMessage = () => {
    if (!input.trim()) return;
    const userMessage = { sender: "user", content: input };
    const tutorReply = {
      sender: "ai",
      content: `That's great! Let's start with **${input}**. Here's a short explanation.`,
    };

    setMessages([...messages, userMessage, tutorReply]);
    setInput("");
  };

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-900 p-4">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-4">
        {messages.map((msg, idx) => (
          <motion.div
            key={idx}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className={`flex ${msg.sender === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[75%] p-3 rounded-2xl shadow-md ${
                msg.sender === "user"
                  ? "bg-blue-500 text-white"
                  : "bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100"
              }`}
            >
              {msg.content.includes("```") ? (
                <SyntaxHighlighter language="javascript" style={oneDark}>
                  {msg.content}
                </SyntaxHighlighter>
              ) : (
                <p>{msg.content}</p>
              )}
            </div>
          </motion.div>
        ))}
      </div>

      {/* Input */}
      <div className="flex items-center mt-4 border-t border-gray-300 dark:border-gray-700 pt-3">
        <input
          type="text"
          placeholder="Ask your tutor anything..."
          className="flex-1 p-3 rounded-lg border dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && sendMessage()}
        />
        <button
          onClick={sendMessage}
          className="ml-3 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl"
        >
          Send
        </button>
      </div>
    </div>
  );
};

export default ChatArea;
