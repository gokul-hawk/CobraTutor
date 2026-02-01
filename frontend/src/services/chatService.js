import axios from "axios";

const DJANGO_BASE_URL = "http://127.0.0.1:8000/api";

const getHeaders = () => {
    const tokenData = localStorage.getItem("user");
    const token = tokenData ? JSON.parse(tokenData).access : null;
    const headers = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    return headers;
};

// Send a message to the bot
export const sendMessage = async (message) => {
    // Use Persistent Tutor Agent for dedicated teaching flow
    const url = `${DJANGO_BASE_URL}/chat/`;
    try {
        const response = await axios.post(url, { message }, { headers: getHeaders() });
        return response.data;
    } catch (error) {
        if (error.response) {
            throw new Error(error.response.data.error || error.response.statusText);
        } else {
            throw new Error("Failed to connect to tutor backend.");
        }
    }
};

// Generate a summary of the conversation
export const generateSummary = async (messages) => {
    const url = `${DJANGO_BASE_URL}/chat/summarize/`;
    try {
        const response = await axios.post(url, { messages }, { headers: getHeaders() });
        return response.data.summary;
    } catch (error) {
        throw new Error(error.response?.data?.error || "Summary generation failed.");
    }
};

// Get Main Agent Welcome Message
export const getWelcomeMessage = async () => {
    const url = `${DJANGO_BASE_URL}/main-agent/welcome/`;
    try {
        const response = await axios.get(url, { headers: getHeaders() });
        return response.data;
    } catch (error) {
        console.error("Welcome message fetch failed", error);
        return { message: "Welcome to CobraTutor! (Offline Mode)" };
    }
};

// Get Tutor Agent Welcome Message
export const getTutorWelcome = async () => {
    const url = `${DJANGO_BASE_URL}/chat/welcome/`;
    try {
        const response = await axios.get(url, { headers: getHeaders() });
        return response.data;
    } catch (error) {
        console.error("Tutor welcome fetch failed", error);
        return { message: "Ready to teach! What topic?" };
    }
};
