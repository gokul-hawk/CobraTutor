import React, { useState, useRef, useEffect } from "react";
import CodeEditor from "./CodeEditor";
import { loadPyodide } from "pyodide";
import axios from "axios";

export default function CodingPage() {
  const [code, setCode] = useState(`# Write your solution here\nprint("Hello, World!")`);
  const [consoleOutput, setConsoleOutput] = useState("");
  const [assistantMessages, setAssistantMessages] = useState([]);
  const [question, setQuestion] = useState("");
  const [topic, setTopic] = useState("arrays"); // placeholder
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [model, setModel] = useState("gemini-1.5-flash");
  const assistantEndRef = useRef(null);
  const [pyodide, setPyodide] = useState(null);
  const [testCases, setTestCases] = useState([
    { input: "Input: [1, 2, 3]", expected: "Output: 6", status: null },
    { input: "Input: []", expected: "Output: 0", status: null },
    { input: "Input: [-1, 1]", expected: "Output: 0", status: null },
  ]);

  // --- Modal State ---
  const [isTopicModalOpen, setIsTopicModalOpen] = useState(false);
  const [tempTopic, setTempTopic] = useState("");

  // --- Resizing States ---
  const [leftWidth, setLeftWidth] = useState(25);
  const [rightWidth, setRightWidth] = useState(25);
  const centerWidth = 100 - leftWidth - rightWidth;
  const minPanelWidth = 15;

  const [consoleHeight, setConsoleHeight] = useState(30);
  const minConsoleHeight = 15;
  const maxConsoleHeight = 70;

  // --- Load Pyodide ---
  useEffect(() => {
    async function initPyodide() {
      try {
        const py = await loadPyodide({
          indexURL: "https://cdn.jsdelivr.net/pyodide/v0.28.3/full/",
        });
        setPyodide(py);
        setConsoleOutput("✅ Pyodide loaded. Ready to run Python code.");
      } catch (err) {
        console.error("Pyodide failed to load:", err);
        setConsoleOutput("❌ Failed to load Pyodide.");
      }
    }
    initPyodide();
  }, []);

  // --- Fetch Question (only after valid topic) ---
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
      } catch (err) {
        console.error("Error fetching question:", err.response?.data || err);
        setQuestion("⚠️ Failed to load question.");
      }
    };

    if (topic && topic !== "arrays" && topic.trim() !== "") {
      fetchQuestion();
    } else {
      // Open modal to get topic
      setIsTopicModalOpen(true);
      setTempTopic("");
    }
  }, [topic]);

  // --- Handle Modal Submit ---
  const handleTopicSubmit = () => {
    if (tempTopic.trim() === "") return;
    setTopic(tempTopic.trim());
    setIsTopicModalOpen(false);
  };

  const handleTopicCancel = () => {
    // If no topic ever set, keep asking
    if (topic === "arrays") {
      alert("Please provide a coding topic to continue.");
      return;
    }
    setIsTopicModalOpen(false);
  };

  // --- Run Code ---
  const onRun = async () => {
    if (!pyodide) {
      setConsoleOutput("⏳ Pyodide is still loading...");
      return;
    }

    setConsoleOutput("▶ Running your code...\n");
    const results = [...testCases];

    try {
      pyodide.runPython(`
        import sys
        from io import StringIO
        old_stdout = sys.stdout
        sys.stdout = mystdout = StringIO()
      `);

      await pyodide.runPythonAsync(code);

      const capturedOutput = pyodide.runPython("mystdout.getvalue()");
      pyodide.runPython("sys.stdout = old_stdout");

      setConsoleOutput(capturedOutput || "(No output)");

      const updatedTests = results.map((tc) => ({ ...tc, status: "ran" }));
      setTestCases(updatedTests);
    } catch (err) {
      setConsoleOutput("❌ Runtime Error:\n" + err.message);
      const updatedTests = results.map((tc) => ({ ...tc, status: "error" }));
      setTestCases(updatedTests);
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

  // --- Auto-scroll Assistant ---
  useEffect(() => {
    if (assistantMessages.length === 0) return;
    const id = requestAnimationFrame(() =>
      assistantEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" })
    );
    return () => cancelAnimationFrame(id);
  }, [assistantMessages]);

  // --- Resizing Logic (unchanged) ---
  const startResize = (panel, e) => {
    e.preventDefault();
    const startX = e.clientX;
    const startLeft = leftWidth;
    const startRight = rightWidth;

    const doResize = (moveEvent) => {
      const container = moveEvent.target.closest('.resizable-container');
      const containerWidth = container?.offsetWidth || window.innerWidth - 64;
      const dxPercent = ((moveEvent.clientX - startX) / containerWidth) * 100;

      if (panel === 'left') {
        const newLeft = Math.min(100 - minPanelWidth * 2, Math.max(minPanelWidth, startLeft + dxPercent));
        const maxRight = 100 - newLeft - minPanelWidth;
        setRightWidth(prev => Math.min(prev, maxRight));
        setLeftWidth(newLeft);
      } else if (panel === 'right') {
        const newRight = Math.min(100 - minPanelWidth * 2, Math.max(minPanelWidth, startRight + dxPercent));
        const maxLeft = 100 - newRight - minPanelWidth;
        setLeftWidth(prev => Math.min(prev, maxLeft));
        setRightWidth(newRight);
      }
    };

    const stopResize = () => {
      window.removeEventListener('mousemove', doResize);
      window.removeEventListener('mouseup', stopResize);
    };

    window.addEventListener('mousemove', doResize);
    window.addEventListener('mouseup', stopResize);
  };

  const startVerticalResize = (e) => {
    e.preventDefault();
    const startY = e.clientY;
    const startHeight = consoleHeight;

    const doResize = (moveEvent) => {
      const container = moveEvent.target.closest('.center-panel');
      const containerHeight = container?.offsetHeight || window.innerHeight - 200;
      const dyPercent = ((startY - moveEvent.clientY) / containerHeight) * 100;
      const newHeight = Math.min(maxConsoleHeight, Math.max(minConsoleHeight, startHeight + dyPercent));
      setConsoleHeight(newHeight);
    };

    const stopResize = () => {
      window.removeEventListener('mousemove', doResize);
      window.removeEventListener('mouseup', stopResize);
    };

    window.addEventListener('mousemove', doResize);
    window.addEventListener('mouseup', stopResize);
  };

  // --- Render Topic Modal ---
  const renderTopicModal = () => {
    if (!isTopicModalOpen) return null;

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <div
          className="w-full max-w-md bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl shadow-2xl border border-indigo-800/40 overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="bg-gradient-to-r from-indigo-700 to-purple-700 p-5">
            <h2 className="text-xl font-bold text-white">Choose a Coding Topic</h2>
            <p className="text-indigo-200 text-sm mt-1">
              e.g., "linked lists", "binary search trees", "dynamic programming"
            </p>
          </div>
          <div className="p-5 space-y-4">
            <input
              type="text"
              value={tempTopic}
              onChange={(e) => setTempTopic(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleTopicSubmit()}
              placeholder="Enter topic (e.g., graphs, recursion...)"
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              autoFocus
            />
            <div className="flex gap-3 pt-2">
              <button
                onClick={handleTopicSubmit}
                disabled={!tempTopic.trim()}
                className={`flex-1 py-2.5 rounded-lg font-medium transition ${
                  tempTopic.trim()
                    ? 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white'
                    : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                }`}
              >
                Generate Question
              </button>
              <button
                onClick={handleTopicCancel}
                className="px-4 py-2.5 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen w-screen bg-gradient-to-br from-gray-900 via-indigo-900 to-purple-900 p-4 md:p-6 overflow-hidden">
      {/* Render Modal */}
      {renderTopicModal()}

      <div className="mx-auto w-full max-w-[1600px] h-full">
        <header className="text-center mb-4 md:mb-6">
          <h1 className="text-2xl md:text-4xl font-bold text-white drop-shadow-lg">
            💻 Competitive Coding Practice
          </h1>
          <p className="text-indigo-200 mt-1 md:mt-2">Solve. Run. Debug. Learn.</p>
        </header>

        <div className="resizable-container flex flex-row h-[calc(100vh-120px)] overflow-hidden rounded-2xl bg-black/20 p-1">
          {/* LEFT PANEL */}
          <section
            className="flex flex-col rounded-xl overflow-hidden shadow-lg border border-indigo-800/30"
            style={{ width: `${leftWidth}%` }}
          >
            <div className="bg-gradient-to-r from-indigo-700 to-purple-700 p-3 md:p-4">
              <h2 className="text-lg md:text-xl font-bold text-white flex items-center gap-2">
                <span>📜</span> Problem Statement
              </h2>
            </div>
            <div className="flex-1 bg-gray-800/50 backdrop-blur-sm p-3 md:p-4 overflow-auto">
              <div className="text-gray-200 whitespace-pre-wrap leading-relaxed text-sm md:text-base">
                {question || "Loading question..."}
              </div>
            </div>
          </section>

          {/* LEFT RESIZE HANDLE */}
          <div
            onMouseDown={(e) => startResize('left', e)}
            className="w-2 cursor-col-resize bg-indigo-900/30 hover:bg-indigo-600 transition hover:opacity-70 self-stretch flex items-center justify-center"
            title="Drag to resize left panel"
          >
            <div className="w-0.5 h-8 bg-indigo-400 rounded-full opacity-60"></div>
          </div>

          {/* CENTER PANEL */}
          <section
            className="center-panel flex flex-col overflow-hidden"
            style={{ width: `${centerWidth}%` }}
          >
            <div
              className="flex-1 rounded-xl overflow-hidden shadow-lg border border-indigo-800/30"
              style={{ height: `${100 - consoleHeight}%` }}
            >
              <div className="bg-gray-800/70 p-3 flex items-center justify-between border-b border-indigo-800/30">
                <span className="text-indigo-300 font-medium text-sm md:text-base">🐍 Python Editor</span>
                <button
                  onClick={onRun}
                  className="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white px-3 py-1.5 text-xs md:px-4 md:py-1.5 md:text-sm font-medium rounded-lg shadow-md hover:shadow-lg transition"
                >
                  ▶ Run Code
                </button>
              </div>
              <div className="h-full bg-gray-900">
                <CodeEditor code={code} setCode={setCode} />
              </div>
            </div>

            <div
              onMouseDown={startVerticalResize}
              className="h-2 cursor-row-resize bg-indigo-900/30 hover:bg-indigo-600 transition hover:opacity-70 flex items-center justify-center"
              title="Drag to resize console"
            >
              <div className="h-0.5 w-8 bg-indigo-400 rounded-full opacity-60"></div>
            </div>

            <div
              className="rounded-xl overflow-hidden shadow-lg border border-indigo-800/30"
              style={{ height: `${consoleHeight}%` }}
            >
              <div className="bg-gray-800/70 p-3 flex items-center justify-between border-b border-indigo-800/30">
                <span className="text-amber-300 font-medium text-sm md:text-base">🧾 Console Output</span>
                <button
                  onClick={() => setConsoleOutput("")}
                  className="text-xs text-gray-400 hover:text-red-400 transition"
                >
                  Clear
                </button>
              </div>
              <pre className="h-full p-3 bg-gray-900 text-gray-200 text-xs md:text-sm overflow-auto font-mono whitespace-pre">
                {consoleOutput || "(No output yet)"}
              </pre>
            </div>
          </section>

          {/* RIGHT RESIZE HANDLE */}
          <div
            onMouseDown={(e) => startResize('right', e)}
            className="w-2 cursor-col-resize bg-indigo-900/30 hover:bg-indigo-600 transition hover:opacity-70 self-stretch flex items-center justify-center"
            title="Drag to resize right panel"
          >
            <div className="w-0.5 h-8 bg-indigo-400 rounded-full opacity-60"></div>
          </div>

          {/* RIGHT PANEL */}
          <section
            className="flex flex-col rounded-xl overflow-hidden shadow-lg border border-indigo-800/30"
            style={{ width: `${rightWidth}%` }}
          >
            <div className="flex-1 flex flex-col gap-3 md:gap-4 overflow-auto">
              {/* AI Assistant */}
              <div className="flex-1 flex flex-col rounded-xl overflow-hidden border border-indigo-800/30">
                <div className="bg-gradient-to-r from-cyan-700 to-teal-700 p-3 md:p-4">
                  <h2 className="text-lg md:text-xl font-bold text-white flex items-center gap-2">
                    <span>🤖</span> AI Assistant
                  </h2>
                </div>
                <div className="flex-1 bg-gray-800/50 backdrop-blur-sm p-3 md:p-4 overflow-auto space-y-2 md:space-y-3">
                  {assistantMessages.length === 0 ? (
                    <div className="text-gray-400 text-xs md:text-sm italic">
                      Ask for hints, debugging help, or code review.
                    </div>
                  ) : (
                    assistantMessages.map((m, idx) => (
                      <div
                        key={idx}
                        className={`p-2.5 md:p-3 rounded-xl max-w-[85%] ${
                          m.role === "user"
                            ? "ml-auto bg-indigo-900/60 border border-indigo-700/50"
                            : "mr-auto bg-teal-900/40 border border-teal-700/50"
                        }`}
                      >
                        <div className="text-[10px] md:text-xs text-gray-400 mb-1">
                          {m.role === "user" ? "You" : "Gemini"}
                        </div>
                        <div className="text-gray-200 whitespace-pre-wrap text-xs md:text-sm">
                          {m.text}
                        </div>
                      </div>
                    ))
                  )}
                  <div ref={assistantEndRef} className="h-0" />
                </div>

                <div className="p-2 md:p-3 bg-gray-800/70 border-t border-indigo-800/30">
                  <textarea
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Ask Gemini for help..."
                    className="w-full bg-gray-900 border border-gray-700 rounded-lg p-2 text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 resize-none text-xs md:text-sm h-12 md:h-16"
                  />
                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={onSend}
                      disabled={loading}
                      className="flex-1 bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-700 hover:to-teal-700 text-white py-1 text-xs md:py-1.5 md:text-sm rounded-lg font-medium disabled:opacity-60"
                    >
                      {loading ? "Thinking..." : "Send"}
                    </button>
                    <button
                      onClick={() => sendToAssistant("Review my code and suggest improvements.")}
                      className="px-2 md:px-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-xs md:text-sm transition"
                    >
                      Review
                    </button>
                  </div>
                </div>
              </div>

              {/* Test Cases */}
              <div className="rounded-xl overflow-hidden shadow-lg border border-indigo-800/30">
                <div className="bg-gradient-to-r from-amber-700 to-orange-700 p-3 md:p-4">
                  <h3 className="text-base md:text-lg font-bold text-white flex items-center gap-2">
                    <span>🧪</span> Test Cases
                  </h3>
                </div>
                <div className="bg-gray-800/50 backdrop-blur-sm p-2 md:p-3 max-h-32 md:max-h-40 overflow-auto">
                  <div className="space-y-1.5">
                    {testCases.map((tc, i) => (
                      <div
                        key={i}
                        className="text-[10px] md:text-xs p-1.5 bg-gray-900/50 rounded border border-gray-700"
                      >
                        <div className="text-amber-300">{tc.input}</div>
                        <div className="text-green-300 mt-0.5">{tc.expected}</div>
                        {tc.status && (
                          <div className="mt-0.5 text-[10px] text-blue-400">
                            Status: <span className="font-medium">{tc.status}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}