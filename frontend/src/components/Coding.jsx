import React, { useState, useRef, useEffect } from "react";
import CodeEditor from "./CodeEditor";
import { loadPyodide } from "pyodide";
import axios from "axios";

export default function CodingPage() {
  const [code, setCode] = useState(`# your code here`);
  const [consoleOutput, setConsoleOutput] = useState("");
  const [assistantMessages, setAssistantMessages] = useState([]);
  const [question, setQuestion] = useState("");
  const [topic, setTopic] = useState("arrays");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [model, setModel] = useState("gemini-1.5-flash");
  const assistantEndRef = useRef(null);
  const [pyodide, setPyodide] = useState(null);

  // --- Load Pyodide ---
  useEffect(() => {
    async function initPyodide() {
      try {
        const py = await loadPyodide({
          indexURL: "https://cdn.jsdelivr.net/pyodide/v0.28.3/full/",
        });
        setPyodide(py);
        setConsoleOutput("✅ Pyodide loaded. You can run Python code now.");
      } catch (err) {
        console.error("Pyodide failed to load:", err);
        setConsoleOutput("❌ Failed to load Pyodide.");
      }
    }
    initPyodide();
  }, []);

  // --- Fetch Coding Question ---
  useEffect(() => {
    const fetchQuestion = async () => {
      try {
        const userData = JSON.parse(localStorage.getItem("user"));
        const token = userData?.access;

        const res = await axios.post(
          "http://localhost:8000/api/code/generate-question/",
          { topic, user_id: userData?.id },
          {
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
          }
        );

        setQuestion(res.data.question_text || "No question found.");
        console.log("Fetched question:", res.data);
      } catch (err) {
        console.error("Error fetching question:", err.response?.data || err);
        setQuestion("⚠️ Failed to load question.");
      }
    };

    fetchQuestion();
  }, [topic]);

  // --- Run Python Code ---
  const onRun = async () => {
    if (!pyodide) {
      setConsoleOutput("⏳ Pyodide is still loading...");
      return;
    }

    setConsoleOutput("▶ Running your code...");

    try {
      const printOutput = [];
      const originalPrint = pyodide.globals.get("print");
      pyodide.globals.set("print", (msg) => printOutput.push(msg));

      await pyodide.runPythonAsync(code);
      pyodide.globals.set("print", originalPrint);

      setConsoleOutput(printOutput.join("\n"));
    } catch (err) {
      setConsoleOutput("❌ Error: " + err.message);
    }
  };

  // --- Gemini Assistant ---
  const sendToAssistant = async (userPrompt) => {
    if (!userPrompt) return;
    const message = { role: "user", text: userPrompt, ts: Date.now() };
    setAssistantMessages((m) => [...m, message]);
    setLoading(true);
    try {
      const resp = await fetch("/api/gemini", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: userPrompt, code, model }),
      });
      const data = await resp.json();
      const botMsg = {
        role: "assistant",
        text: data.reply || data.text || "No reply from Gemini.",
        ts: Date.now(),
      };
      setAssistantMessages((m) => [...m, botMsg]);
    } catch (e) {
      setAssistantMessages((m) => [
        ...m,
        { role: "assistant", text: `⚠️ Error: ${e.message}`, ts: Date.now() },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const onSend = () => {
    const trimmed = query.trim();
    if (!trimmed) return;
    sendToAssistant(trimmed);
    setQuery("");
  };

  // --- Scroll Assistant ---
  useEffect(() => {
    assistantEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [assistantMessages]);

  return (
    <div className="min-h-screen w-screen flex items-center justify-center bg-gradient-to-br from-indigo-500 via-purple-500 to-blue-500 p-6">
      <div className="bg-white p-8 rounded-2xl shadow-2xl w-full max-w-7xl overflow-y-auto max-h-[90vh]">
        <h1 className="text-4xl font-bold text-center mb-8 text-indigo-600">
          💻 Competitive Coding Practice
        </h1>

        {/* --- Layout Grid --- */}
        <div className="grid grid-cols-10 gap-6">
          {/* --- Left: Question --- */}
          <section className="col-span-3 bg-gray-50 p-5 rounded-xl border border-gray-200 shadow-sm">
            <h2 className="text-xl font-semibold mb-3 text-indigo-700">
              📜 Question
            </h2>
            <textarea
              className="w-full h-[65vh] border rounded-lg p-3 font-mono text-sm bg-gray-100 text-blue-700 resize-none focus:ring-2 focus:ring-indigo-400 focus:outline-none"
              value={question}
              readOnly
            />
          </section>

          {/* --- Middle: Code + Console --- */}
          <section className="col-span-4 flex flex-col">
            {/* Code Editor */}
            <div className="flex-[7] border rounded-xl overflow-hidden shadow-sm mb-4">
              <CodeEditor code={code} setCode={setCode} />
            </div>

            {/* Console */}
            <div className="flex-[3] bg-gray-50 rounded-xl border border-gray-200 shadow-sm p-3 flex flex-col">
              <div className="flex items-center justify-between mb-2">
                <strong className="text-gray-700">🧾 Console Output</strong>
                <button
                  onClick={() => setConsoleOutput("")}
                  className="text-sm text-slate-500 hover:text-red-500 transition"
                >
                  Clear
                </button>
              </div>
              <pre className="flex-1 overflow-auto bg-slate-900 text-slate-50 p-3 rounded-lg text-sm">
                {consoleOutput}
              </pre>
            </div>
          </section>

          {/* --- Right: Assistant --- */}
          <section className="col-span-3 flex flex-col">
            <button
              onClick={onRun}
              className="mb-4 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-semibold transition"
            >
              ▶ Run Code
            </button>

            <div className="bg-gray-50 rounded-xl border border-gray-200 shadow-sm p-4 flex flex-col flex-1">
              <div className="flex items-center justify-between mb-3">
                <strong className="text-indigo-700">🤖 Gemini Assistant</strong>
                <button
                  onClick={() => setAssistantMessages([])}
                  className="text-sm text-slate-500 hover:text-red-500 transition"
                >
                  Clear
                </button>
              </div>

              <div className="flex-1 overflow-auto space-y-3 mb-3">
                {assistantMessages.length === 0 && (
                  <div className="text-sm text-slate-400 italic">
                    Ask for hints, debugging help, or code review. Your current
                    code is shared as context.
                  </div>
                )}
                {assistantMessages.map((m, idx) => (
                  <div
                    key={idx}
                    className={`p-2 rounded-lg ${
                      m.role === "user"
                        ? "bg-indigo-100 self-end"
                        : "bg-green-100 self-start"
                    }`}
                  >
                    <div className="text-xs text-slate-500 mb-1">
                      {m.role === "user" ? "You" : "Gemini"}
                    </div>
                    <div className="whitespace-pre-wrap text-sm font-sans text-gray-800">
                      {m.text}
                    </div>
                  </div>
                ))}
                <div ref={assistantEndRef} />
              </div>

              <textarea
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Ask Gemini something..."
                className="w-full border rounded-lg p-2 text-sm h-20 resize-none focus:ring-2 focus:ring-indigo-400 focus:outline-none"
              />
              <div className="flex gap-2 mt-3">
                <button
                  onClick={onSend}
                  disabled={loading}
                  className={`flex-1 bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-2 rounded-lg transition ${
                    loading && "opacity-60 cursor-not-allowed"
                  }`}
                >
                  {loading ? "Thinking..." : "Ask Gemini"}
                </button>
                <button
                  onClick={() =>
                    sendToAssistant("Review my code and suggest improvements.")
                  }
                  className="px-3 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg transition"
                >
                  Review
                </button>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
