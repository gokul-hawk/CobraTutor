import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import { BookOpen, BrainCircuit, FileText, Send, MonitorPlay, Moon, Sun, Copy, Check } from "lucide-react";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useNavigate, useLocation } from 'react-router-dom';

const DJANGO_BASE_URL = "http://127.0.0.1:8000/api";

// ─────────────── API FUNCTIONS (Agent Version) ───────────────
const callAgentApi = async (data) => {
    const tokenData = localStorage.getItem("user");
    const token = tokenData ? JSON.parse(tokenData).access : null;
    const headers = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;

    // POINT TO TUTOR AGENT
    const url = `${DJANGO_BASE_URL}/chat/`;

    try {
        const response = await axios.post(url, data, { headers });
        return response.data;
    } catch (error) {
        if (error.response) {
            throw new Error(error.response.data.error || error.response.statusText);
        } else {
            throw new Error("Failed to connect to agent backend.");
        }
    }
};

const callSummaryApi = async (messages) => {
    const tokenData = localStorage.getItem("user");
    const token = tokenData ? JSON.parse(tokenData).access : null;
    const headers = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    const url = `${DJANGO_BASE_URL}/chat/summarize/`;
    try {
        const response = await axios.post(url, { messages }, { headers });
        return response.data.summary;
    } catch (error) {
        if (error.response) {
            throw new Error(error.response.data.error || error.response.statusText);
        } else {
            throw new Error("Failed to connect to summary backend.");
        }
    }
};

const callReportSuccessApi = async (failedTopics = []) => {
    const tokenData = localStorage.getItem("user");
    const token = tokenData ? JSON.parse(tokenData).access : null;
    const headers = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const url = `${DJANGO_BASE_URL}/main-agent/report_success/`;
    try {
        const response = await axios.post(url, { failed_topics: failedTopics }, { headers });
        return response.data;
    } catch (error) {
        console.error("Report Success Error:", error);
        // Don't throw, just log. We don't want to break the UI flow.
    }
};

// ─────────────── MARKDOWN STYLING COMPONENTS (Unchanged) ───────────────
const MarkdownComponents = {
    h1: ({ node, ...props }) => <h1 className="text-2xl font-extrabold bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent mt-6 mb-4 pb-2 border-b border-indigo-100 dark:border-indigo-900/30" {...props} />,
    h2: ({ node, ...props }) => <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 mt-5 mb-3" {...props} />,
    h3: ({ node, ...props }) => <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-200 mt-4 mb-2" {...props} />,
    p: ({ node, ...props }) => <p className="text-slate-700 dark:text-slate-300 leading-7 mb-4 last:mb-0" {...props} />,
    strong: ({ node, ...props }) => <strong className="font-bold text-slate-900 dark:text-white" {...props} />,
    em: ({ node, ...props }) => <em className="italic text-slate-600 dark:text-slate-400" {...props} />,
    ul: ({ node, ...props }) => <ul className="list-disc pl-5 space-y-1 mb-4 text-slate-700 dark:text-slate-300 marker:text-indigo-500" {...props} />,
    ol: ({ node, ...props }) => <ol className="list-decimal pl-5 space-y-1 mb-4 text-slate-700 dark:text-slate-300 marker:text-indigo-500 font-medium" {...props} />,
    li: ({ node, ...props }) => <li className="pl-1" {...props} />,
    code: ({ node, inline, className, children, ...props }) => {
        const [copied, setCopied] = useState(false);
        const codeText = String(children).replace(/\n$/, '');
        const handleCopy = () => {
            navigator.clipboard.writeText(codeText);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        };
        if (inline) {
            return (
                <code className="bg-indigo-50 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 px-1.5 py-0.5 rounded text-[0.9em] font-mono border border-indigo-100 dark:border-indigo-800/50" {...props}>
                    {children}
                </code>
            );
        }
        return (
            <div className="relative my-5 group rounded-xl overflow-hidden shadow-lg border border-slate-700/50 bg-[#1e1e1e]">
                <div className="flex items-center justify-between px-4 py-2 bg-[#2d2d2d] border-b border-white/10">
                    <div className="flex gap-1.5">
                        <div className="w-3 h-3 rounded-full bg-[#ff5f56]" />
                        <div className="w-3 h-3 rounded-full bg-[#ffbd2e]" />
                        <div className="w-3 h-3 rounded-full bg-[#27c93f]" />
                    </div>
                    <button onClick={handleCopy} className="text-xs text-slate-400 hover:text-white transition-colors flex items-center gap-1">
                        {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
                        {copied ? "Copied!" : "Copy"}
                    </button>
                </div>
                <pre className="p-4 overflow-x-auto text-sm font-mono text-emerald-400 leading-relaxed scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                    <code className={className} {...props}>
                        {children}
                    </code>
                </pre>
            </div>
        );
    },
    blockquote: ({ node, ...props }) => (
        <div className="border-l-4 border-indigo-500 pl-4 py-2 my-4 bg-indigo-50 dark:bg-indigo-900/10 italic text-slate-700 dark:text-slate-300 rounded-r-lg">
            {props.children}
        </div>
    ),
    table: ({ node, ...props }) => (
        <div className="overflow-x-auto my-6 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm">
            <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700" {...props} />
        </div>
    ),
    thead: ({ node, ...props }) => <thead className="bg-slate-50 dark:bg-slate-800" {...props} />,
    th: ({ node, ...props }) => <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider" {...props} />,
    tbody: ({ node, ...props }) => <tbody className="bg-white dark:bg-slate-900/50 divide-y divide-slate-200 dark:divide-slate-700" {...props} />,
    tr: ({ node, ...props }) => <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors" {...props} />,
    td: ({ node, ...props }) => <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-300 whitespace-nowrap" {...props} />,
    a: ({ node, ...props }) => <a className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 underline underline-offset-2 decoration-indigo-300 dark:decoration-indigo-700 transition-colors" target="_blank" rel="noopener noreferrer" {...props} />,
    hr: ({ node, ...props }) => <hr className="my-8 border-slate-200 dark:border-slate-800" {...props} />
};

// ─────────────── PANELS (Unchanged) ───────────────
const KeyConceptsPanel = () => {
    const [concepts, setConcepts] = useState([]);
    const [loading, setLoading] = useState(true);
    useEffect(() => {
        axios.get(`${DJANGO_BASE_URL}/key_concepts/`).then((res) => { setConcepts(res.data); setLoading(false); }).catch(() => { setConcepts(["Error loading concepts."]); setLoading(false); });
    }, []);
    return (
        <div className="h-full flex flex-col p-6 animate-fade-in bg-white dark:bg-slate-900">
            <div className="flex items-center gap-3 mb-6">
                <div className="p-2.5 bg-indigo-100 dark:bg-indigo-500/10 rounded-xl text-indigo-600 dark:text-indigo-400 shadow-sm"><BookOpen className="w-5 h-5" /></div>
                <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100 tracking-tight">Key Concepts</h3>
            </div>
            {loading ? <div className="text-center">Loading...</div> : (
                <div className="flex-1 overflow-y-auto space-y-3">
                    {concepts.map((c, i) => <div key={i} className="p-4 bg-white dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-xl"><p className="text-sm dark:text-slate-300">{c}</p></div>)}
                </div>
            )}
        </div>
    );
};

const QuizPanel = ({ messages }) => {
    const [quiz, setQuiz] = useState([]);
    const [loading, setLoading] = useState(false);
    const [answers, setAnswers] = useState({});
    const [showResult, setShowResult] = useState(false);

    // Use Tutor Quiz Gen? Or Agent? 
    // Let's stick with standard Tutor Quiz Gen for sidebar tools as it uses chat context.
    const generateQuiz = async () => {
        setLoading(true); setShowResult(false); setAnswers({});
        const tokenData = localStorage.getItem("user");
        const token = tokenData ? JSON.parse(tokenData).access : null;
        const headers = token ? { "Authorization": `Bearer ${token}` } : {};
        try {
            const res = await axios.post(`${DJANGO_BASE_URL}/chat/generate_quiz/`, { messages }, { headers });
            setQuiz(res.data.quiz || []);
        } catch (err) { console.error(err); } finally { setLoading(false); }
    };
    return (
        <div className="h-full flex flex-col p-6 bg-white dark:bg-slate-900">
            <div className="flex items-center gap-3 mb-6">
                <div className="p-2.5 bg-amber-100 dark:bg-amber-500/10 rounded-xl text-amber-600 dark:text-amber-400"><BrainCircuit className="w-5 h-5" /></div>
                <h3 className="font-bold text-lg dark:text-slate-100">Knowledge Check</h3>
            </div>
            <button onClick={generateQuiz} disabled={loading} className="w-full mb-6 py-3 px-4 bg-amber-500 text-white rounded-xl font-bold">{loading ? "Generating..." : "Generate Quiz"}</button>
            <div className="flex-1 overflow-y-auto">
                {quiz.map((q, i) => (
                    <div key={i} className="mb-6 p-4 border rounded-xl dark:border-slate-800">
                        <p className="font-bold text-sm mb-2">{q.question}</p>
                        {q.options.map((opt, j) => (
                            <div key={j} className={`p-2 text-sm border rounded mt-1 cursor-pointer ${showResult && opt === (q.correct_answer ?? q.answer) ? 'bg-green-100 dark:bg-green-900' : ''}`} onClick={() => !showResult && setAnswers(p => ({ ...p, [i]: opt }))}>
                                {opt} {showResult && opt === (q.correct_answer ?? q.answer) && '✅'}
                            </div>
                        ))}
                    </div>
                ))}
                {quiz.length > 0 && !showResult && <button onClick={() => setShowResult(true)} className="w-full py-2 bg-green-600 text-white rounded-xl">Check Answers</button>}
            </div>
        </div>
    );
};

const NotesPanel = ({ messages }) => {
    const [summary, setSummary] = useState("");
    const [loading, setLoading] = useState(false);
    const handleGenerateSummary = async () => {
        setLoading(true);
        try {
            const botMessages = messages.filter((m) => m.sender === "bot").map(m => m.text);
            const data = await callSummaryApi(botMessages);
            setSummary(data || "No summary available.");
        } catch (err) { setSummary("Error: " + err.message); } finally { setLoading(false); }
    };
    return (
        <div className="h-full flex flex-col p-6 bg-white dark:bg-slate-900">
            <div className="flex items-center gap-3 mb-6">
                <div className="p-2.5 bg-emerald-100 dark:bg-emerald-500/10 rounded-xl text-emerald-600 dark:text-emerald-400"><FileText className="w-5 h-5" /></div>
                <h3 className="font-bold text-lg dark:text-slate-100">Smart Summary</h3>
            </div>
            <button onClick={handleGenerateSummary} disabled={loading} className="w-full mb-6 py-3 px-4 bg-slate-800 text-white rounded-xl font-bold">{loading ? "Summarizing..." : "Generate Summary"}</button>
            <div className="flex-1 overflow-y-auto prose dark:prose-invert text-sm">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{summary}</ReactMarkdown>
            </div>
        </div>
    );
};

// ─────────────── CHAT AREA ───────────────
const ChatArea = ({ messages, setMessages, setRedirecting }) => {
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
    const chatEndRef = useRef(null);
    const navigate = useNavigate();

    useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

    const handleSend = async () => {
        if (!input.trim()) return;
        const userMsg = input.trim();
        setMessages(prev => [...prev, { sender: "user", text: userMsg }]);
        setInput("");
        setLoading(true);

        try {
            // USES AGENT API
            const data = await callAgentApi({ message: userMsg });

            const isClarifying = false;
            setMessages(prev => [...prev, { sender: "bot", text: data.reply, meta: { clarifying: isClarifying } }]);

            // Process Action (Agent Style)
            if (data.action) {
                setRedirecting(data.action); // Trigger Overlay
                setTimeout(() => {
                    const action = data.action;
                    if (action.view === 'code') navigate(`/agent-code?topic=${encodeURIComponent(action.data?.topic)}`);
                    if (action.view === 'debugger') navigate(`/agent-debugger?topic=${encodeURIComponent(action.data?.topic)}`);
                    if (action.view === 'quiz') navigate(`/agent-quiz?topic=${encodeURIComponent(action.data?.topic)}`);
                }, 2000); // 2s delay for effect
            }

            // Check for Completion
            if (data.is_complete) {
                // Report Success to Main Agent
                console.log("Topic Completed! Reporting success...");
                await callReportSuccessApi([]); // Assume no failures for now
                setMessages(prev => [...prev, { sender: "bot", text: "✅ Progress saved to your Learning Plan." }]);
            }

        } catch (err) {
            setMessages(prev => [...prev, { sender: "bot", text: `Error: ${err.message}` }]);
        } finally {
            setLoading(false);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
    };

    return (
        <div className="h-full flex flex-col relative bg-slate-50/50 dark:bg-slate-950/50">
            <div className="flex-1 overflow-y-auto p-6 space-y-8 scrollbar-thin">
                {messages.map((msg, i) => (
                    <div key={i} className={`flex ${msg.sender === "user" ? "justify-end" : "justify-start"} animate-slide-up group`}>
                        <div className={`max-w-[85%] lg:max-w-[75%] rounded-2xl p-6 shadow-sm relative overflow-hidden ${msg.sender === "user"
                            ? "bg-gradient-to-br from-indigo-600 to-violet-600 text-white rounded-br-sm shadow-indigo-500/10"
                            : "bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 text-slate-800 dark:text-slate-200 rounded-tl-sm shadow-slate-200/50"
                            } ${msg.sender === "bot" && msg.meta?.clarifying ? "ring-2 ring-indigo-400/50 bg-indigo-50/50" : ""}`}>
                            <div className={`${msg.sender === "user" ? "text-white/90" : ""}`}>
                                <ReactMarkdown remarkPlugins={[remarkGfm]} components={msg.sender === "user" ? { p: ({ node, ...props }) => <p className="leading-relaxed whitespace-pre-wrap" {...props} />, code: ({ node, ...props }) => <code className="bg-white/20 px-1 py-0.5 rounded text-sm font-mono" {...props} /> } : MarkdownComponents}>
                                    {msg.text}
                                </ReactMarkdown>
                            </div>
                        </div>
                    </div>
                ))}
                {loading && <div className="p-4 text-sm text-gray-400 italic">Agent is thinking...</div>}
                <div ref={chatEndRef} />
            </div>

            <div className="p-6">
                <div className="relative flex items-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl transition-all duration-300">
                    <input type="text" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={handleKeyDown} placeholder="Discuss a topic..." className="flex-1 bg-transparent border-none focus:ring-0 px-6 py-4 text-slate-800 dark:text-slate-100 placeholder-slate-400 font-medium" />
                    <button onClick={handleSend} disabled={!input.trim() || loading} className="m-2 p-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition-all shadow-md"><Send className="w-5 h-5" /></button>
                </div>
            </div>
        </div>
    );
};

// ─────────────── SIDEBAR (Unchanged) ───────────────
const Sidebar = ({ activeTab, setActiveTab, darkMode, toggleTheme }) => {
    const tabs = [
        { id: "concepts", label: "Concepts", icon: BookOpen },
        { id: "quiz", label: "Quiz", icon: BrainCircuit },
        { id: "notes", label: "Notes", icon: FileText },
    ];
    return (
        <div className="w-20 bg-slate-900 border-r border-slate-800 flex flex-col items-center py-6 z-20 shadow-2xl">
            <div className="mb-8 p-3 bg-indigo-600 rounded-xl shadow-lg shadow-indigo-600/30"><MonitorPlay className="w-6 h-6 text-white" /></div>
            <div className="flex-1 flex flex-col gap-6 w-full px-2">
                {tabs.map((t) => (
                    <button key={t.id} onClick={() => setActiveTab(t.id)} className={`group relative w-full flex flex-col items-center justify-center gap-1 p-3 rounded-xl transition-all duration-300 ${activeTab === t.id ? "bg-white/10 text-white" : "text-slate-400 hover:text-white hover:bg-white/5"}`}>
                        <t.icon className={`w-6 h-6 transition-all ${activeTab === t.id ? "scale-110" : "group-hover:scale-110"}`} />
                        <span className="text-[10px] font-medium opacity-80">{t.label}</span>
                        {activeTab === t.id && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-indigo-500 rounded-r-full" />}
                    </button>
                ))}
            </div>
            <button onClick={toggleTheme} className="p-3 text-slate-400 hover:text-indigo-400 transition-colors">{darkMode ? <Sun className="w-6 h-6" /> : <Moon className="w-6 h-6" />}</button>
        </div>
    );
};

// ─────────────── MAIN LAYOUT ───────────────
export default function AgentTutor() {
    const [activeTab, setActiveTab] = useState("concepts");
    const [messages, setMessages] = useState([{ sender: "bot", text: "👋 Resuming your learning session..." }]);
    const [darkMode, setDarkMode] = useState(() => localStorage.getItem("theme") === "dark");
    const [redirecting, setRedirecting] = useState(null);
    const location = useLocation();

    useEffect(() => {
        if (darkMode) document.documentElement.classList.add("dark");
        else document.documentElement.classList.remove("dark");
        localStorage.setItem("theme", darkMode ? "dark" : "light");
    }, [darkMode]);

    // LOAD HISTORY & AUTO-RESUME
    // LOAD HISTORY & AUTO-RESUME
    const initialMessageProcessed = useRef(false);

    // AUTO-INIT FROM NAVIGATION
    useEffect(() => {
        if (initialMessageProcessed.current) return;

        const initSession = async () => {
            const { initialMessage, topic } = location.state || {};

            // 1. If there's an initial message (e.g. from Main Agent saying "Redirecting..."), show it.
            if (initialMessage) {
                setMessages(prev => [...prev, { sender: "bot", text: initialMessage }]);
            }

            // 2. If a TOPIC is passed, we must trigger the Tutor to start teaching it.
            // We do this by sending the topic name as a message to the backend.
            if (topic) {
                try {
                    // Show valid "Thinking..." state if needed, or just wait.
                    // Ideally we append a "User" message like "Let's learn Stack" to make it clear?
                    // User said: "topic should be given through the agent".
                    // Let's pretend the Main Agent "handed off" the context.

                    // We send the topic to the backend so it initializes the session
                    const data = await callAgentApi({ message: topic });

                    // Display the Tutor's response (The Lesson)
                    setMessages(prev => [...prev, { sender: "bot", text: data.reply }]);
                } catch (err) {
                    setMessages(prev => [...prev, { sender: "bot", text: `Error starting topic ${topic}: ${err.message}` }]);
                }
            }

            initialMessageProcessed.current = true;
        };

        initSession();
    }, [location.state]);

    return (
        <div className="flex w-screen h-screen bg-white dark:bg-slate-950 font-sans overflow-hidden relative">
            {redirecting && (
                <div className="absolute inset-0 z-50 bg-black/80 flex flex-col items-center justify-center text-white backdrop-blur-sm animate-fade-in">
                    <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-indigo-500 mb-6"></div>
                    <h2 className="text-3xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
                        🚀 Taking you to {redirecting.view === 'code' ? 'Code Editor' : redirecting.view === 'debugger' ? 'Debugger' : 'Quiz'}...
                    </h2>
                    <p className="mt-4 text-gray-400 font-mono">Topic: {redirecting.data?.topic}</p>
                </div>
            )}

            <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} darkMode={darkMode} toggleTheme={() => setDarkMode(!darkMode)} />
            <div className="flex-1 flex flex-col min-w-0">
                <header className="h-16 flex items-center px-6 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 backdrop-blur-sm z-10">
                    <h1 className="text-xl font-bold bg-gradient-to-r from-red-500 to-orange-500 bg-clip-text text-transparent">
                        Agent Tutor Mode
                    </h1>
                </header>
                <div className="flex-1 overflow-hidden relative">
                    <ChatArea messages={messages} setMessages={setMessages} setRedirecting={setRedirecting} />
                </div>
            </div>
            <div className="w-96 flex-shrink-0 border-l border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col relative shadow-xl z-20">
                <div className="flex-1 overflow-hidden">
                    {activeTab === "concepts" && <KeyConceptsPanel />}
                    {activeTab === "quiz" && <QuizPanel messages={messages} />}
                    {activeTab === "notes" && <NotesPanel messages={messages} />}
                </div>
            </div>
        </div>
    );
}
