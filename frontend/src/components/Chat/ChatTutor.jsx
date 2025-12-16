import React, { useState, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import "highlight.js/styles/github.css";
import "./ChatTutor.css";

const ChatTutor = () => {
  const [messages, setMessages] = useState([
    { sender: "bot", text: "👋 Hi! I'm your AI Tutor. What topic would you like to learn today?" },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [notes, setNotes] = useState([]);
  const [currentTopic, setCurrentTopic] = useState("Getting Started");
  const [keyConcepts, setKeyConcepts] = useState([]);
  const [quizRecommendations, setQuizRecommendations] = useState([]);
  const [lessonActive, setLessonActive] = useState(false);
  const [waitingForUnderstanding, setWaitingForUnderstanding] = useState(false);
  const chatEndRef = useRef(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const tokenData = localStorage.getItem("user");
  const token = tokenData ? JSON.parse(tokenData).access : null;

  const extractInfoFromText = (text) => {
    setNotes((prev) => [...prev.slice(-9), text]); // keep only last 10 notes

    const topicMatch = text.match(/topic[:\-]\s*(.*)/i);
    if (topicMatch) setCurrentTopic(topicMatch[1]);

    const conceptMatches = text.match(/(\d+\.|[-*])\s*([A-Za-z0-9 ]+)/g);
    if (conceptMatches) {
      const cleanConcepts = conceptMatches.map((c) => c.replace(/(\d+\.|[-*])/, "").trim());
      setKeyConcepts((prev) => Array.from(new Set([...prev, ...cleanConcepts])));
    }

    if (/quiz|test|practice/i.test(text)) {
      setQuizRecommendations((prev) => [
        ...new Set([...prev, "Take a quick quiz on this topic!"]),
      ]);
    }
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMsg = { sender: "user", text: input };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      let res;
      if (!lessonActive) {
        res = await fetch("http://localhost:8000/api/teach/start", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ topic: input }),
        });
      } else {
        res = await fetch("http://localhost:8000/api/teach/continue", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ understood: true }),
        });
      }

      const data = await res.json();
      if (data.error) throw new Error(data.error);

      if (data.current_subtopic) {
        setLessonActive(true);
        setMessages((prev) => [
          ...prev,
          { sender: "bot", text: data.message },
          { sender: "bot", text: data.content },
        ]);
        setWaitingForUnderstanding(true);
        extractInfoFromText(data.content);
      } else if (data.clarification) {
        setMessages((prev) => [...prev, { sender: "bot", text: data.clarification }]);
        setWaitingForUnderstanding(true);
      } else if (data.complete) {
        setLessonActive(false);
        setMessages((prev) => [...prev, { sender: "bot", text: data.message }]);
        setWaitingForUnderstanding(false);
      }
    } catch (err) {
      console.error(err);
      setMessages((prev) => [
        ...prev,
        { sender: "bot", text: "⚠️ Something went wrong. Please try again." },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleUnderstanding = async (understood, doubt = "") => {
    setWaitingForUnderstanding(false);
    setLoading(true);

    try {
      const res = await fetch("http://localhost:8000/api/teach/continue", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ understood, doubt }),
      });

      const dat= await res.json();
      const data=dat["response"];
      if (data.error) throw new Error(data.error);

      if (data.clarification) {
        setMessages((prev) => [...prev, { sender: "bot", text: data.clarification }]);
        extractInfoFromText(data.clarification);
        setWaitingForUnderstanding(true);
      } else if (data.content) {
        setMessages((prev) => [...prev, { sender: "bot", text: data.content }]);
        extractInfoFromText(data.content);
        setWaitingForUnderstanding(true);
      } else if (data.complete) {
        setMessages((prev) => [...prev, { sender: "bot", text: data.message }]);
        setLessonActive(false);
      }
    } catch (err) {
      console.error(err);
      setMessages((prev) => [
        ...prev,
        { sender: "bot", text: "⚠️ Error processing understanding response." },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="tutor-container">
      {/* LEFT SIDE - CHAT */}
      <div className="chat-section">
        <div className="center-panel">
          <div className="chat-window">
            {messages.map((msg, i) => (
              <div key={i} className={`chat-message ${msg.sender}`}>
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  rehypePlugins={[rehypeHighlight]}
                  className="markdown-content"
                >
                  {msg.text}
                </ReactMarkdown>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>

          {/* Understanding Buttons */}
          {waitingForUnderstanding && (
            <div className="understanding-options">
              <button onClick={() => handleUnderstanding(true)}>✅ I understood</button>
              <button
                onClick={() => {
                  const doubt = prompt("Enter your doubt:");
                  if (doubt) handleUnderstanding(false, doubt);
                }}
              >
                ❓ I have a doubt
              </button>
            </div>
          )}

          {/* Chat Input */}
          {!waitingForUnderstanding && (
            <form onSubmit={handleSend} className="chat-input-form">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={loading ? "Please wait..." : "Type your topic or message..."}
                disabled={loading}
              />
              <button type="submit" disabled={loading}>
                {loading ? "..." : "Send"}
              </button>
            </form>
          )}
        </div>
      </div>

      {/* RIGHT SIDE - CONTEXT PANEL */}
      <div className="context-panel">
        <h3>📘 Current Topic</h3>
        <p className="context-text">{currentTopic}</p>

        <h3>🧩 Key Concepts</h3>
        <ul>
          {keyConcepts.length ? (
            keyConcepts.map((c, i) => <li key={i}>{c}</li>)
          ) : (
            <li>No key concepts yet</li>
          )}
        </ul>

        <h3>🧠 Quiz Recommendations</h3>
        <ul>
          {quizRecommendations.length ? (
            quizRecommendations.map((q, i) => <li key={i}>{q}</li>)
          ) : (
            <li>No quiz suggestions yet</li>
          )}
        </ul>

        <h3>📝 Notes</h3>
        <div className="notes-box">
          {notes.length ? notes.map((n, i) => <p key={i}>• {n}</p>) : <p>No notes yet</p>}
        </div>
      </div>
    </div>
  );
};

export default ChatTutor;
