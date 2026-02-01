import React, { useState, useRef, useEffect } from "react";
import CodeEditor from "./CodeEditor";
import { loadPyodide } from "pyodide";
import axios from "axios";
import { useSearchParams, useLocation, useNavigate } from "react-router-dom";
import PlanSidebar from "./Code/PlanSidebar";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import rehypeRaw from "rehype-raw";
import "highlight.js/styles/github-dark.css";
import VisualizerRenderer from "./VisualizerRenderer";

export default function CodingPage() {
  const [searchParams] = useSearchParams();


  // ... (existing render)


  const location = useLocation();
  const topic = searchParams.get("topic") || location.state?.topic;

  const [code, setCode] = useState(`# Write your solution here\nprint("Hello, World!")`);
  const [consoleOutput, setConsoleOutput] = useState("");
  const [assistantMessages, setAssistantMessages] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [model] = useState("AI-1.5-flash");
  const [pyodide, setPyodide] = useState(null);
  const [testCases, setTestCases] = useState([]);
  const [planDescription, setPlanDescription] = useState("");
  const [isTopicModalOpen, setIsTopicModalOpen] = useState(!topic);
  const [userQuery, setUserQuery] = useState("");
  const [responseMode, setResponseMode] = useState(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const assistantEndRef = useRef(null);

  // NEW: Function to load/resume a plan
  const handleLoadPlan = async (planId) => {
    setLoading(true);
    try {
      const userData = JSON.parse(localStorage.getItem("user"));
      const token = userData?.access;

      // 1. Fetch NEXT step for this plan
      const res = await axios.post(
        "http://localhost:8000/api/code/next-step/",
        { plan_id: planId },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (res.data.completed && !res.data.questions && !res.data.question) {
        setPlanDescription("🎉 This plan is fully completed! Reviewing history not yet implemented.");
        setQuestions([]);
        setResponseMode(null);
      } else {
        const newQuestions = res.data.questions || [res.data.question];
        const validQuestions = newQuestions.filter(q => q); // Filter nulls

        if (validQuestions.length > 0) {
          setQuestions(validQuestions);
          setTestCases(validQuestions[0].testcases || []);
          setPlanDescription(`🎯 Resumed: ${validQuestions[0].title}`);
          setResponseMode("plan");
          setCode(`# Phase ${res.data.index}: ${validQuestions[0].title}\n\ndef solution():\n    pass`);
        }
      }

      setIsTopicModalOpen(false); // Close modal if open
    } catch (err) {
      console.error("Error loading plan:", err);
      setPlanDescription("⚠️ Failed to load plan.");
    } finally {
      setLoading(false);
    }
  };

  // AUTO-START for Standard Coding Page
  useEffect(() => {
    if (topic) {
      fetchQuestions(topic);
    }
  }, [topic]);

  useEffect(() => {
    async function initPyodide() {
      try {
        const py = await loadPyodide({
          indexURL: "https://cdn.jsdelivr.net/pyodide/v0.28.3/full/",
        });
        setPyodide(py);
        setConsoleOutput("✅ Pyodide ready for code execution.");
      } catch (err) {
        console.error("Pyodide load error:", err);
        setConsoleOutput("❌ Failed to load Pyodide.");
      }
    }
    initPyodide();
  }, []);

  const fetchQuestions = async (userInput) => {
    if (!userInput.trim()) return;
    setLoading(true);
    try {
      const userData = JSON.parse(localStorage.getItem("user"));
      const token = userData?.access;
      if (!token) throw new Error("User not authenticated");

      const res = await axios.post(
        "http://localhost:8000/api/code/",
        { query: userInput, user_id: userData?.id },
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = res.data;

      if (data.type === "single") {
        const question = data.question;
        setQuestions([question]);
        setTestCases(question.testcases || []);
        setPlanDescription(`🎯 ${question.title}`);
        setResponseMode("single");
      } else if (data.type === "plan") {
        const validQuestions = (data.questions || []).filter(
          (q) => q.title || (q.description && q.description.trim())
        );
        setQuestions(validQuestions);
        setTestCases(validQuestions.length > 0 ? validQuestions[0].testcases || [] : []);
        setPlanDescription(`📋 Plan Created: ${data.total_phases} Phases. Starting Phase 0.`);
        setResponseMode("plan");
      } else {
        throw new Error("Unknown response type");
      }

      setCurrentIndex(0);
      setIsTopicModalOpen(false);
    } catch (err) {
      console.error("Error fetching questions:", err.response?.data || err.message);
      setPlanDescription("⚠️ Failed to load question. Please try again.");
      setQuestions([]);
      setTestCases([]);
      setResponseMode(null);
    } finally {
      setLoading(false);
    }
  };

  const onRun = async () => {
    if (!pyodide) {
      return setConsoleOutput("⏳ Pyodide is still loading...");
    }
    setConsoleOutput("▶ Running your code...\n");

    try {
      // 1. If NO test cases, run normally (interactive / single run)
      if (!testCases || testCases.length === 0) {
        pyodide.runPython(`
          import sys
          from io import StringIO
          sys.stdout = mystdout = StringIO()
        `);
        await pyodide.runPythonAsync(code);
        const output = pyodide.runPython("mystdout.getvalue()");
        setConsoleOutput(output || "(No output)");
        return;
      }

      // 2. If WE HAVE test cases, run them in a loop inside Python
      // We pass the code and testCases to Python
      const testCasesJson = JSON.stringify(testCases);

      const pythonRunnerScript = `
import sys
import json
from io import StringIO

def run_tests(user_code, test_cases_json):
    cases = json.loads(test_cases_json)
    results = []
    
    for i, case in enumerate(cases):
        inp = case.get("input_data", "")
        exp = case.get("expected_output", "").strip()
        
        # PID: Prepare IO
        sys.stdin = StringIO(inp)
        sys.stdout = capture = StringIO()
        
        try:
            # Create a fresh local scope for each run to avoid variable bleeding
            local_scope = {}
            exec(user_code, local_scope)
            
            # Capture output
            actual = capture.getvalue().strip()
            params = {
                "id": i + 1,
                "input": inp,
                "expected": exp,
                "actual": actual,
                "passed": actual == exp,
                "error": None
            }
        except Exception as e:
            params = {
                "id": i + 1,
                "input": inp,
                "expected": exp,
                "actual": "",
                "passed": False,
                "error": str(e)
            }
            
        results.append(params)
    
    return json.dumps(results)

# Execute
results_json = run_tests(code_to_run, test_cases_json)
results_json
`;

      pyodide.globals.set("code_to_run", code);
      pyodide.globals.set("test_cases_json", testCasesJson);

      const rawResults = await pyodide.runPythonAsync(pythonRunnerScript);
      const results = JSON.parse(rawResults);

      let outputString = "";
      let passCount = 0;

      results.forEach((r) => {
        if (r.error) {
          outputString += `❌ Test ${r.id} Error:\n${r.error}\n\n`;
        } else if (r.passed) {
          passCount++;
          outputString += `✅ Test ${r.id} Passed\nInput: ${r.input}\nExpected: ${r.expected}\nActual: ${r.actual}\n\n`;
        } else {
          outputString += `❌ Test ${r.id} Failed\nInput: ${r.input}\nExpected: ${r.expected}\nActual: ${r.actual}\n\n`;
        }
      });

      outputString = `📊 Result: ${passCount}/${results.length} Passed\n\n` + outputString;

      if (results.length > 0 && passCount === results.length) {
        outputString += "\n🎉 ALL TESTS PASSED! REPORTING SUCCESS TO TUTOR...\n";
        setConsoleOutput(outputString);

        try {
          const userData = JSON.parse(localStorage.getItem("user"));
          const token = userData?.access;

          const successRes = await axios.post(
            "http://127.0.0.1:8000/api/main-agent/report_success/",
            { source: "code" },
            { headers: { Authorization: `Bearer ${token}` } }
          );

          outputString += "\n🤖 TUTOR SAYS:\n" + successRes.data.reply + "\n";

          if (successRes.data.action) {
            const action = successRes.data.action;
            outputString += `\n🚀 Auto-navigating to ${action.view}...`;
            setTimeout(() => {
              if (action.view === 'code') window.location.href = '/coding';
              if (action.view === 'debugger') window.location.href = '/debugger';
              if (action.view === 'quiz') window.location.href = '/quiz';
            }, 3000);
          }
        } catch (apiErr) {
          console.error(apiErr);
          outputString += "\n⚠️ Failed to report success to Tutor.";
        }
      }

      setConsoleOutput(outputString);

    } catch (err) {
      setConsoleOutput("❌ Runtime Error:\n" + (err.message || err));
    }
  };

  const sendToAssistant = async (userPrompt) => {
    const message = { role: "user", text: userPrompt, ts: Date.now() };
    setAssistantMessages((prev) => [...prev, message]);
    setLoading(true);
    const userData = JSON.parse(localStorage.getItem("user"));
    const token = userData?.access;

    // Prepare history
    const history = assistantMessages.map(msg => ({
      role: msg.role,
      content: msg.text
    }));

    try {
      const resp = await fetch("http://localhost:8000/api/code/ai-assist/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ prompt: userPrompt, code, model, history }),
      });
      const data = await resp.json();
      const botMsg = {
        role: "assistant",
        text: data.reply || "No reply from AI.",
        ts: Date.now(),
      };
      setAssistantMessages((prev) => [...prev, botMsg]);
    } catch (e) {
      setAssistantMessages((prev) => [
        ...prev,
        { role: "assistant", text: `⚠️ Error: ${e.message} `, ts: Date.now() },
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

  useEffect(() => {
    assistantEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [assistantMessages]);

  useEffect(() => {
    if (questions.length > 0) {
      const q = questions[currentIndex];
      setTestCases(q.testcases || []);
    }
  }, [currentIndex, questions]);

  const currentQuestion = questions[currentIndex] || {};

  // VISUALIZATION STATE
  const [isVisModalOpen, setIsVisModalOpen] = useState(false);
  const [visualizationHtml, setVisualizationHtml] = useState(null);
  const [visLoading, setVisLoading] = useState(false);

  const fetchVisualization = async () => {
    if (!currentQuestion.title && !code) return;
    setVisLoading(true);
    setIsVisModalOpen(true);
    try {
      const userData = JSON.parse(localStorage.getItem("user"));
      const token = userData?.access;
      // Construct a prompt based on current context
      const prompt = `Visualize this problem: ${currentQuestion.title || "User Code"}. 
        Description: ${currentQuestion.description || "N/A"}. 
        Current Code: ${code}`;

      const res = await axios.post(
        "http://localhost:8000/api/code/vis/",
        { prompt },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setVisualizationHtml(res.data.visualization);
    } catch (err) {
      console.error(err);
      setVisualizationHtml("<p class='text-red-500'>Failed to load visualization.</p>");
    } finally {
      setVisLoading(false);
    }
  };

  // =============== MODAL ===============
  const renderTopicModal = () => {
    if (!isTopicModalOpen) return null;
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-black/60 z-30 p-4">
        <div className="bg-gray-900 text-white p-6 rounded-xl w-full max-w-md shadow-xl border border-indigo-600 relative">
          <button
            onClick={() => setIsTopicModalOpen(false)}
            className="absolute top-2 right-2 text-gray-500 hover:text-white"
          >
            ✕
          </button>

          <h2 className="text-xl font-bold mb-2 text-center text-indigo-300">🎯 What would you like to learn?</h2>
          <p className="text-sm text-gray-400 mb-4 text-center">
            e.g., “Recursive power function” or “5 DP problems”
          </p>
          <textarea
            className="w-full h-24 bg-gray-800 rounded-lg p-3 text-sm border border-gray-700 focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
            placeholder="Describe your coding goal..."
            value={userQuery}
            onChange={(e) => setUserQuery(e.target.value)}
          />
          <div className="mt-4">
            <button
              onClick={() => fetchQuestions(userQuery)}
              disabled={!userQuery.trim() || loading}
              className="w-full bg-indigo-600 hover:bg-indigo-700 py-2.5 rounded-lg font-medium disabled:opacity-60 transition"
            >
              {loading ? "Generating..." : "Generate Plan"}
            </button>
          </div>
        </div>
      </div>
    );
  };

  // =============== RESIZING STATE & LOGIC ===============
  const [leftWidth, setLeftWidth] = useState(28);    // Problem
  const [centerWidth, setCenterWidth] = useState(44); // Code + Console
  const [rightWidth, setRightWidth] = useState(28);  // Assistant + Tests
  const minPanelWidth = 15;

  const [consoleHeight, setConsoleHeight] = useState(30); // % of center panel
  const minConsoleHeight = 15;
  const maxConsoleHeight = 70;

  const [assistantHeight, setAssistantHeight] = useState(70); // % of right panel
  const minAssistantHeight = 30;
  const maxAssistantHeight = 85;

  const startHorizontalResize = (panel, e) => {
    e.preventDefault();
    const startX = e.clientX;
    const startLeft = leftWidth;
    const startCenter = centerWidth;
    const startRight = rightWidth;

    const doResize = (moveEvent) => {
      const container = document.querySelector('.main-layout');
      const containerWidth = container?.offsetWidth || window.innerWidth;
      const dxPercent = ((moveEvent.clientX - startX) / containerWidth) * 100;

      if (panel === 'left') {
        let newLeft = Math.min(100 - minPanelWidth * 2, Math.max(minPanelWidth, startLeft + dxPercent));
        let remaining = 100 - newLeft;
        let newRight = Math.min(remaining - minPanelWidth, startRight);
        let newCenter = remaining - newRight;
        setLeftWidth(newLeft);
        setCenterWidth(newCenter);
        setRightWidth(newRight);
      } else if (panel === 'right') {
        let newRight = Math.min(100 - minPanelWidth * 2, Math.max(minPanelWidth, startRight + dxPercent));
        let remaining = 100 - newRight;
        let newLeft = Math.min(remaining - minPanelWidth, startLeft);
        let newCenter = remaining - newLeft;
        setRightWidth(newRight);
        setLeftWidth(newLeft);
        setCenterWidth(newCenter);
      }
    };

    const stopResize = () => {
      window.removeEventListener('mousemove', doResize);
      window.removeEventListener('mouseup', stopResize);
    };

    window.addEventListener('mousemove', doResize);
    window.addEventListener('mouseup', stopResize);
  };

  const startConsoleResize = (e) => {
    e.preventDefault();
    const startY = e.clientY;
    const startHeight = consoleHeight;

    const doResize = (moveEvent) => {
      const container = document.querySelector('.center-panel');
      const containerHeight = container?.offsetHeight || window.innerHeight;
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

  const startAssistantResize = (e) => {
    e.preventDefault();
    const startY = e.clientY;
    const startHeight = assistantHeight;

    const doResize = (moveEvent) => {
      const container = document.querySelector('.right-panel');
      const containerHeight = container?.offsetHeight || window.innerHeight;
      const dyPercent = ((startY - moveEvent.clientY) / containerHeight) * 100;
      const newHeight = Math.min(maxAssistantHeight, Math.max(minAssistantHeight, startHeight + dyPercent));
      setAssistantHeight(newHeight);
    };

    const stopResize = () => {
      window.removeEventListener('mousemove', doResize);
      window.removeEventListener('mouseup', stopResize);
    };

    window.addEventListener('mousemove', doResize);
    window.addEventListener('mouseup', stopResize);
  };

  // =============== MAIN UI — FULL WIDTH + RESIZABLE ===============
  return (
    <div className="w-screen h-screen flex flex-col bg-gray-950 text-gray-200 overflow-hidden">

      {/* SIDEBAR COMPONENT */}
      <PlanSidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        onSelectPlan={handleLoadPlan}
      />

      {renderTopicModal()}

      {/* Header */}
      <header className="p-4 bg-gray-900 border-b border-gray-800 flex justify-between items-center">
        <div className="flex items-center gap-4">
          {/* Sidebar Toggle */}
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="text-gray-400 hover:text-white p-1 rounded hover:bg-gray-800"
            title="Saved Plans"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
            </svg>
          </button>
          <h1 className="text-2xl font-bold text-white">💡 AI Coding Mentor</h1>
        </div>

        {planDescription && (
          <p className="text-indigo-400 text-sm md:text-base hidden md:block">
            {planDescription}
          </p>
        )}

        {/* NEW BUTTON TO OPEN NEW PLAN MODAL */}
        {!isTopicModalOpen && (
          <button
            onClick={() => setIsTopicModalOpen(true)}
            className="text-sm bg-indigo-900 hover:bg-indigo-800 text-indigo-200 px-3 py-1 rounded border border-indigo-700"
          >
            + New Topic
          </button>
        )}
      </header>

      {/* Question Navigation */}
      {responseMode === "plan" && questions.length > 1 && (
        <div className="flex flex-wrap justify-center gap-2 p-3 bg-gray-900 border-b border-gray-800">
          {questions.map((q, i) => (
            <button
              key={i}
              onClick={() => setCurrentIndex(i)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${i === currentIndex
                ? "bg-indigo-600 text-white"
                : "bg-gray-800 text-gray-300 hover:bg-gray-700"
                } `}
            >
              {q.title || `Q${i + 1} `}
            </button>
          ))}
        </div>
      )}

      {/* Main Layout — Full Width & Resizable */}
      <div className="main-layout flex flex-row flex-1 overflow-hidden p-3 gap-2">
        {/* LEFT: Problem */}
        <div
          className="flex flex-col bg-gray-900 rounded-xl border border-gray-800 overflow-hidden"
          style={{ width: `${leftWidth}% ` }}
        >
          <div className="p-4 bg-gradient-to-r from-indigo-800/30 to-purple-800/30 border-b border-gray-800">
            <h2 className="text-lg font-bold text-indigo-400">📜 Problem</h2>
          </div>
          <div className="flex-1 p-4 overflow-auto">
            {questions.length === 0 ? (
              <p className="text-gray-500 italic">Generate a question to begin.</p>
            ) : (
              <>
                <h3 className="text-xl font-semibold text-white mb-3">{currentQuestion.title}</h3>
                <div className="text-gray-300 text-sm leading-relaxed markdown-body">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    rehypePlugins={[rehypeHighlight, rehypeRaw]}
                  >
                    {currentQuestion.description ? currentQuestion.description.replace(/\\n/g, '\n').replace(/\n/g, '  \n') : "*No description provided.*"}
                  </ReactMarkdown>
                </div>
                <div className="mt-4 pt-3 border-t border-gray-800">
                  <span className="inline-block px-3 py-1 bg-gray-800 rounded-full text-xs text-gray-400">
                    {currentQuestion.difficulty || "N/A"} Difficulty
                  </span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* LEFT RESIZE HANDLE */}
        <div
          onMouseDown={(e) => startHorizontalResize('left', e)}
          className="w-1.5 cursor-col-resize bg-indigo-900/30 hover:bg-indigo-600 self-stretch flex items-center justify-center"
          title="Drag to resize"
        >
          <div className="w-0.5 h-6 bg-indigo-400 rounded-full opacity-70"></div>
        </div>

        {/* CENTER: Code + Console */}
        <div
          className="center-panel flex flex-col bg-gray-900 rounded-xl border border-gray-800 overflow-hidden"
          style={{ width: `${centerWidth}% ` }}
        >
          <div
            className="flex-1 flex flex-col overflow-hidden"
            style={{ height: `${100 - consoleHeight}% ` }}
          >
            <div className="flex justify-between items-center p-3 bg-gray-850 border-b border-gray-800">
              <h3 className="font-medium text-indigo-300">🐍 Python Editor</h3>
              <div className="flex gap-2">
                <button
                  onClick={fetchVisualization}
                  className="bg-purple-600 hover:bg-purple-700 px-3 py-1.5 rounded-lg text-sm font-medium text-white transition-colors flex items-center gap-1"
                >
                  🎨 Visualize
                </button>
                <button
                  onClick={onRun}
                  className="bg-green-600 hover:bg-green-700 px-4 py-1.5 rounded-lg text-sm font-medium"
                >
                  ▶ Run
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-hidden">
              <CodeEditor code={code} setCode={setCode} />
            </div>
          </div>

          {/* Console Resize Handle */}
          <div
            onMouseDown={startConsoleResize}
            className="h-1.5 cursor-row-resize bg-indigo-900/30 hover:bg-indigo-600 flex items-center justify-center"
            title="Drag to resize console"
          >
            <div className="h-0.5 w-6 bg-indigo-400 rounded-full opacity-70"></div>
          </div>

          <div
            className="h-full bg-gray-900"
            style={{ height: `${consoleHeight}% ` }}
          >
            <div className="flex justify-between items-center p-3 bg-gray-850 border-b border-gray-800">
              <h3 className="font-medium text-amber-400">🧾 Console</h3>
              <button
                onClick={() => setConsoleOutput("")}
                className="text-xs text-gray-500 hover:text-red-400"
              >
                Clear
              </button>
            </div>
            <pre className="p-3 text-xs font-mono text-gray-300 bg-black/20 overflow-auto h-full">
              {consoleOutput}
            </pre>
          </div>
        </div>

        {/* RIGHT RESIZE HANDLE */}
        <div
          onMouseDown={(e) => startHorizontalResize('right', e)}
          className="w-1.5 cursor-col-resize bg-indigo-900/30 hover:bg-indigo-600 self-stretch flex items-center justify-center"
          title="Drag to resize"
        >
          <div className="w-0.5 h-6 bg-indigo-400 rounded-full opacity-70"></div>
        </div>

        {/* RIGHT: Assistant + Tests */}
        <div
          className="right-panel flex flex-col bg-gray-900 rounded-xl border border-gray-800 overflow-hidden"
          style={{ width: `${rightWidth}% ` }}
        >
          {/* Assistant */}
          <div
            className="flex flex-col overflow-hidden"
            style={{ height: `${assistantHeight}% ` }}
          >
            <div className="p-3 bg-teal-800 text-white font-medium">🤖AI Assistant</div>
            <div className="flex-1 overflow-auto p-3 space-y-3">
              {assistantMessages.length === 0 ? (
                <p className="text-gray-500 text-sm italic">Ask for help with your code!</p>
              ) : (
                assistantMessages.map((msg, i) => (
                  <div
                    key={i}
                    className={`p-3 rounded-lg max-w-[90%] ${msg.role === "user"
                      ? "bg-indigo-900/50 ml-auto border border-indigo-700"
                      : "bg-teal-900/20 mr-auto border border-teal-800"
                      } `}
                  >
                    <div className="text-xs text-gray-400 mb-1">
                      {msg.role === "user" ? "You" : "AI"}
                    </div>
                    <div className="text-sm text-gray-200 whitespace-pre-wrap">{msg.text}</div>
                  </div>
                ))
              )}
              <div ref={assistantEndRef} className="h-0" />
            </div>
            <div className="p-3 border-t border-gray-800">
              <textarea
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Ask AI for hints or debugging help..."
                className="w-full p-2.5 bg-gray-850 border border-gray-700 rounded text-sm resize-none text-white"
                rows="2"
              />
              <button
                onClick={onSend}
                disabled={!query.trim() || loading}
                className="mt-2 w-full bg-teal-600 hover:bg-teal-700 py-2 rounded text-white text-sm font-medium disabled:opacity-60"
              >
                {loading ? "Thinking..." : "Send"}
              </button>
            </div>
          </div>

          {/* Assistant Resize Handle */}
          <div
            onMouseDown={startAssistantResize}
            className="h-1.5 cursor-row-resize bg-indigo-900/30 hover:bg-indigo-600 flex items-center justify-center"
            title="Drag to resize panels"
          >
            <div className="h-0.5 w-6 bg-indigo-400 rounded-full opacity-70"></div>
          </div>

          {/* Test Cases */}
          <div className="bg-gray-900 max-h-full overflow-hidden">
            <div className="p-3 bg-amber-900/20 border-b border-amber-800/30">
              <h3 className="font-medium text-amber-400">🧪 Test Cases</h3>
            </div>
            <div className="p-3 overflow-auto max-h-36">
              {testCases.length === 0 ? (
                <p className="text-gray-500 text-sm italic">No test cases available.</p>
              ) : (
                <div className="space-y-3">
                  {testCases.map((tc, i) => (
                    <div key={i} className="text-xs bg-black/20 p-2 rounded border border-gray-800 font-mono">
                      <div className="text-amber-400 font-medium whitespace-pre-wrap">Input: {tc.input_data}</div>
                      <div className="text-green-400 mt-1 whitespace-pre-wrap">Expected: {tc.expected_output}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      {/* VISUALIZATION MODAL */}
      {isVisModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="bg-gray-900 w-full max-w-5xl h-[85vh] rounded-2xl border border-purple-500/50 shadow-2xl flex flex-col overflow-hidden relative">
            <div className="p-4 bg-gray-800 border-b border-gray-700 flex justify-between items-center">
              <h3 className="text-xl font-bold text-purple-400">🎨 Algorithm Visualization</h3>
              <button
                onClick={() => setIsVisModalOpen(false)}
                className="text-gray-400 hover:text-white"
              >
                ✕
              </button>
            </div>
            <div className="flex-1 bg-white relative">
              {visLoading ? (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
                  <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500"></div>
                </div>
              ) : (
                <VisualizerRenderer htmlContent={visualizationHtml} />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}