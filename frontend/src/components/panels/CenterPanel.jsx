import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { getWelcomeMessage } from '../../services/chatService';
import './CenterPanel.css';

const DJANGO_BASE_URL = "http://127.0.0.1:8000/api";

const CenterPanel = () => {
    const [messages, setMessages] = useState([]);
    const [inputMessage, setInputMessage] = useState('');
    const [loading, setLoading] = useState(false);
    const messagesEndRef = useRef(null);
    const navigate = useNavigate();

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(scrollToBottom, [messages]);

    useEffect(() => {
        const initChat = async () => {
            const welcomeData = await getWelcomeMessage();
            if (welcomeData && welcomeData.message) {
                setMessages([{ sender: 'bot', text: welcomeData.message }]);
            } else {
                setMessages([{ sender: 'bot', text: 'Welcome to Cobra Tutor! What Python topic would you like to learn today?' }]);
            }
        };
        initChat();
    }, []);

    const callMainAgentApi = async (message) => {
        const tokenData = localStorage.getItem("user");
        const token = tokenData ? JSON.parse(tokenData).access : null;
        const headers = { "Content-Type": "application/json" };
        if (token) headers["Authorization"] = `Bearer ${token}`;

        try {
            const response = await axios.post(`${DJANGO_BASE_URL}/main-agent/chat/`, { message }, { headers });
            return response.data;
        } catch (error) {
            console.error("Agent API Error:", error);
            const errorMsg = error.response?.data?.error || "Failed to reach the agent.";
            return { reply: `Error: ${errorMsg}` };
        }
    };

    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!inputMessage.trim() || loading) return;

        const userText = inputMessage;
        setMessages(prev => [...prev, { sender: 'user', text: userText }]);
        setInputMessage('');
        setLoading(true);

        try {
            const data = await callMainAgentApi(userText);
            setMessages(prev => [...prev, { sender: 'bot', text: data.reply }]);

            // Handle Actions
            if (data.action) {
                if (data.action.type === 'SWITCH_TAB') {
                    setTimeout(() => {
                        if (data.action.view === 'code') navigate(`/agent-code?topic=${encodeURIComponent(data.action.data?.topic)}`);
                        if (data.action.view === 'debugger') navigate(`/agent-debugger?topic=${encodeURIComponent(data.action.data?.topic)}`);
                        if (data.action.view === 'quiz') navigate(`/agent-quiz?topic=${encodeURIComponent(data.action.data?.topic)}`);
                    }, 1500);
                }
            }
        } catch (err) {
            setMessages(prev => [...prev, { sender: 'bot', text: "Something went wrong." }]);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="center-panel">
            <div className="chat-window">
                {messages.map((msg, index) => (
                    <div key={index} className={`chat-message ${msg.sender}`}>
                        <div className="message-content">{msg.text}</div>
                    </div>
                ))}
                {loading && (
                    <div className="chat-message bot">
                        <div className="typing-indicator">
                            <span></span><span></span><span></span>
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>
            <form className="chat-input-form" onSubmit={handleSendMessage}>
                <input
                    type="text"
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    placeholder="Type a topic (e.g., 'Recursion')..."
                    disabled={loading}
                />
                <button type="submit" disabled={loading}>
                    {loading ? "..." : "Send"}
                </button>
            </form>
        </div>
    );
};
export default CenterPanel;