import React, { useState, useEffect, useRef } from 'react';
import { MessageCircle, X, Send, Minimize2, Maximize2, Loader2, Sparkles, ChevronDown } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { sendMessage, getWelcomeMessage } from '../../services/chatService';

// --- STYLING ---
const widgetStyles = {
    position: 'fixed',
    bottom: '24px',
    right: '24px',
    zIndex: 9999,
    fontFamily: '"Plus Jakarta Sans", "Inter", system-ui, sans-serif',
};

const ChatWidget = ({ title = "CobraTutor AI", defaultWelcome = "Hi! I'm here to help you learn. Ask me anything!" }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
    const [isExpanded, setIsExpanded] = useState(false);
    const messagesEndRef = useRef(null);
    const [recommendations, setRecommendations] = useState([]);

    // Load Welcome Message on Mount
    useEffect(() => {
        const initChat = async () => {
            setLoading(true);
            const welcomeData = await getWelcomeMessage();

            let initialText = defaultWelcome;
            if (welcomeData) {
                initialText = welcomeData.message || defaultWelcome;
                if (welcomeData.recommendations) {
                    setRecommendations(welcomeData.recommendations);
                }
            }

            setMessages([{ sender: 'bot', text: initialText }]);
            setLoading(false);
        };
        // Only fetch if not already loaded (simple check)
        if (messages.length === 0) initChat();
    }, []);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isOpen]);

    const handleSend = async () => {
        if (!input.trim()) return;
        const userText = input.trim();
        setMessages(prev => [...prev, { sender: 'user', text: userText }]);
        setInput("");
        setLoading(true);

        try {
            const data = await sendMessage(userText);
            setMessages(prev => [...prev, { sender: 'bot', text: data.reply }]);
        } catch (err) {
            setMessages(prev => [...prev, { sender: 'bot', text: "Sorry, I encountered an error. Please try again." }]);
        } finally {
            setLoading(false);
        }
    };

    const handleAutoSend = async (topic) => {
        const text = `Teach me about ${topic}`;
        setMessages(prev => [...prev, { sender: 'user', text: text }]);
        setLoading(true);
        try {
            const data = await sendMessage(text);
            setMessages(prev => [...prev, { sender: 'bot', text: data.reply }]);
        } catch (err) {
            setMessages(prev => [...prev, { sender: 'bot', text: "Error fetching topic." }]);
        } finally {
            setLoading(false);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    // --- RENDER ---
    if (!isOpen) {
        return (
            <button
                onClick={() => setIsOpen(true)}
                style={widgetStyles}
                className="group flex items-center gap-3 p-4 bg-gradient-to-br from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white rounded-full shadow-2xl shadow-indigo-500/30 transition-all duration-300 hover:scale-105 active:scale-95"
            >
                <div className="relative">
                    <MessageCircle size={26} className="text-white" />
                    <span className="absolute -top-1 -right-1 flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                    </span>
                </div>
                <span className="max-w-0 overflow-hidden group-hover:max-w-xs transition-all duration-500 whitespace-nowrap font-semibold tracking-wide">
                    Chat with Tutor
                </span>
            </button>
        );
    }

    return (
        <div
            style={{
                ...widgetStyles,
                // Adjusted dimensions for a more compact "popup" feel
                width: isExpanded ? '450px' : '360px',
                height: isExpanded ? '650px' : '550px',
                maxHeight: '85vh',
                display: 'flex',
                flexDirection: 'column',
            }}
            className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl shadow-slate-900/20 border border-slate-200 dark:border-slate-800 overflow-hidden animate-in slide-in-from-bottom-5 duration-300"
        >
            {/* Header with Gradient */}
            <div className="flex items-center justify-between px-5 py-4 bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-600 text-white shadow-md z-10">
                <div className="flex items-center gap-3">
                    <div className="p-1.5 bg-white/20 backdrop-blur-sm rounded-lg">
                        <Sparkles size={18} className="text-yellow-300" />
                    </div>
                    <div>
                        <h3 className="font-bold text-sm leading-tight tracking-wide">{title}</h3>
                        <p className="text-[10px] text-indigo-100 font-medium opacity-90">Always here to help</p>
                    </div>
                </div>
                <div className="flex items-center gap-1">
                    <button
                        onClick={() => setIsExpanded(!isExpanded)}
                        className="p-1.5 hover:bg-white/10 rounded-full transition-colors text-indigo-100 hover:text-white"
                        title={isExpanded ? "Collapse" : "Expand"}
                    >
                        {isExpanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                    </button>
                    <button
                        onClick={() => setIsOpen(false)}
                        className="p-1.5 hover:bg-white/10 rounded-full transition-colors text-indigo-100 hover:text-white"
                        title="Close"
                    >
                        <ChevronDown size={18} />
                    </button>
                </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5 bg-slate-50 dark:bg-slate-950/50 scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-700">
                {messages.map((msg, i) => (
                    <div key={i} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'} group animate-in slide-in-from-bottom-2 fade-in duration-300`}>
                        {msg.sender === 'bot' && (
                            <div className="w-8 h-8 mr-2 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white shrink-0 shadow-sm text-xs font-bold">
                                AI
                            </div>
                        )}
                        <div
                            className={`max-w-[85%] p-3.5 rounded-2xl text-[13px] leading-relaxed shadow-sm ${msg.sender === 'user'
                                    ? 'bg-indigo-600 text-white rounded-br-none shadow-indigo-500/10'
                                    : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-tl-none border border-slate-100 dark:border-slate-800'
                                }`}
                        >
                            <ReactMarkdown
                                remarkPlugins={[remarkGfm]}
                                components={{
                                    code: ({ node, inline, className, children, ...props }) => {
                                        return inline ?
                                            <code className="bg-black/10 dark:bg-white/10 px-1 py-0.5 rounded font-mono text-[11px]" {...props}>{children}</code> :
                                            <div className="block bg-slate-900 text-slate-50 p-3 rounded-lg font-mono text-xs overflow-x-auto my-2 border border-slate-700/50">{children}</div>
                                    },
                                    p: ({ node, ...props }) => <p className="mb-0 last:mb-0" {...props} />
                                }}
                            >
                                {msg.text}
                            </ReactMarkdown>
                        </div>
                    </div>
                ))}

                {/* Recommendations Chips */}
                {messages.length === 1 && recommendations.length > 0 && (
                    <div className="flex flex-col gap-2 ml-10 animate-in fade-in duration-500 delay-100">
                        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider ml-1">Suggested Topics</p>
                        <div className="flex flex-wrap gap-2">
                            {recommendations.map((topic, idx) => (
                                <button
                                    key={idx}
                                    onClick={() => handleAutoSend(topic)}
                                    className="text-xs bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 px-3 py-1.5 rounded-xl border border-indigo-100 dark:border-indigo-900/50 hover:border-indigo-300 dark:hover:border-indigo-700 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
                                >
                                    {topic}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {loading && (
                    <div className="flex justify-start ml-10">
                        <div className="bg-white dark:bg-slate-800 px-3 py-2 rounded-2xl rounded-tl-none border border-slate-100 dark:border-slate-800 shadow-sm flex gap-1.5 items-center">
                            <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce"></span>
                            <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce delay-100"></span>
                            <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce delay-200"></span>
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-4 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800">
                <div className="relative flex items-center bg-slate-50 dark:bg-slate-950/50 rounded-2xl px-4 py-2.5 border border-slate-200 dark:border-slate-800 focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/10 transition-all duration-300">
                    <input
                        type="text"
                        className="flex-1 bg-transparent border-none focus:outline-none text-[13px] text-slate-800 dark:text-slate-100 placeholder:text-slate-400 font-medium"
                        placeholder="Type your question..."
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                    />
                    <button
                        onClick={handleSend}
                        disabled={!input.trim() || loading}
                        className="ml-2 p-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-40 disabled:hover:bg-indigo-600 disabled:cursor-not-allowed transition-all shadow-md shadow-indigo-500/20 active:scale-95"
                    >
                        <Send size={15} />
                    </button>
                </div>
                <div className="flex justify-center mt-2">
                    <span className="text-[10px] text-slate-400 font-medium flex items-center gap-1">
                        <Sparkles size={10} className="text-indigo-400" /> Powered by CobraTutor Agent
                    </span>
                </div>
            </div>
        </div>
    );
};

export default ChatWidget;
