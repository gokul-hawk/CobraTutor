import React, { useState, useEffect, useRef } from 'react';
import './CenterPanel.css';

const CenterPanel = () => {
    const [messages, setMessages] = useState([
        { sender: 'bot', text: 'Welcome to Cobra Tutor! What Python topic would you like to learn today?' }
    ]);
    const [inputMessage, setInputMessage] = useState('');
    const messagesEndRef = useRef(null); // To auto-scroll to the bottom

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(scrollToBottom, [messages]);

    const handleSendMessage = (e) => {
        e.preventDefault();
        if (!inputMessage.trim()) return;

        const newUserMessage = { sender: 'user', text: inputMessage };
        setMessages(prev => [...prev, newUserMessage]);
        setInputMessage('');

        // Simulate a bot response after a short delay
        setTimeout(() => {
            const botResponse = { sender: 'bot', text: `Great! Let's talk about "${inputMessage}". I am preparing some material for you...` };
            setMessages(prev => [...prev, botResponse]);
        }, 1000);
    };

    return (
        <div className="center-panel">
            <div className="chat-window">
                {messages.map((msg, index) => (
                    <div key={index} className={`chat-message ${msg.sender}`}>
                        <p>{msg.text}</p>
                    </div>
                ))}
                <div ref={messagesEndRef} />
            </div>
            <form className="chat-input-form" onSubmit={handleSendMessage}>
                <input
                    type="text"
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    placeholder="Type 'lists' or 'functions'..."
                />
                <button type="submit">Send</button>
            </form>
        </div>
    );
};
export default CenterPanel;