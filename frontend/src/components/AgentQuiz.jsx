import React, { useState, useEffect } from "react";
import axios from "axios";
import { useLocation, useSearchParams, useNavigate } from "react-router-dom";

const AgentQuiz = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const topicParam = searchParams.get("topic");
    const location = useLocation();

    // Support both URL param and state (fallback to param)
    const topic = topicParam || location.state?.topic;

    const [attempts, setAttempts] = useState([]);
    const [answers, setAnswers] = useState({});
    const [results, setResults] = useState(null);
    const [loading, setLoading] = useState(true); // Start loading immediately
    const [currentPhase, setCurrentPhase] = useState("initializing");
    const [sessionId, setSessionId] = useState("");
    const [error, setError] = useState(null);

    const getAuthHeader = () => {
        const tokenData = localStorage.getItem("user");
        const token = tokenData ? JSON.parse(tokenData).access : null;
        return token ? { Authorization: `Bearer ${token}` } : {};
    };

    // Auto-Start on Mount
    useEffect(() => {
        if (topic) {
            handleGenerateQuiz(topic);
        } else {
            setLoading(false);
            setError("No topic provided by Agent. Please return to the Tutor.");
        }
    }, [topic]);

    const handleGenerateQuiz = async (targetTopic) => {
        setLoading(true);
        setError(null);
        try {
            // Ensure inputs are array
            const topics = targetTopic.split(",").map(t => t.trim()).filter(t => t);

            const res = await axios.post(
                "http://localhost:8000/api/quizzes/generate/",
                { topic_names: topics },
                { headers: getAuthHeader() }
            );

            setSessionId(res.data.session_id);
            if (res.data.attempts && res.data.attempts.length > 0) {
                setAttempts(res.data.attempts);
                setAnswers({});
                setResults(null);
                setCurrentPhase("quiz");
            } else {
                // No prerequisites needed? Direct success.
                setResults({
                    topic_scores: res.data.topic_scores || {},
                    message: res.data.message || "All prerequisites mastered!",
                    session_id: res.data.session_id
                });
                setCurrentPhase("results");
            }
        } catch (err) {
            console.error(err);
            setError("Failed to generate quiz: " + (err.response?.data?.error || err.message));
        } finally {
            setLoading(false);
        }
    };

    const handleAnswerChange = (attemptId, questionId, choice) => {
        setAnswers(prev => ({
            ...prev,
            [attemptId]: {
                ...prev[attemptId],
                [questionId]: choice
            }
        }));
    };

    const handleSubmitQuiz = async () => {
        const submissions = attempts.map(attempt => {
            const attemptAnswers = answers[attempt.attempt_id] || {};
            // Verify all answered
            const allAnswered = attempt.questions.every(q => attemptAnswers[q.question_id] != null);
            if (!allAnswered) {
                alert(`Please answer all questions for topic: ${attempt.topic}`);
                throw new Error("incomplete");
            }
            return {
                attempt_id: attempt.attempt_id,
                answers: attempt.questions.map(q => ({
                    question_id: q.question_id,
                    chosen_choice_text: attemptAnswers[q.question_id]
                }))
            };
        });

        setLoading(true);
        try {
            const res = await axios.post(
                "http://localhost:8000/api/quizzes/submit/",
                {
                    session_id: sessionId,
                    submissions
                },
                { headers: getAuthHeader() }
            );

            setResults(res.data);
            setCurrentPhase("results");
        } catch (err) {
            if (err.message !== "incomplete") {
                console.error(err);
                alert("Submission failed: " + (err.response?.data?.error || err.message));
            }
        }
        setLoading(false);
    };

    // Auto-Report Success
    useEffect(() => {
        const reportToAgent = async () => {
            if (currentPhase === 'results' && results) {
                // Check success conditions
                const isSuccess = !results.all_failed_topics || results.all_failed_topics.length === 0;
                const hasNext = results.next_quizzes && results.next_quizzes.length > 0;

                if (isSuccess && !hasNext) {
                    try {
                        const res = await axios.post(
                            "http://localhost:8000/api/main-agent/report_success/",
                            { failed_topics: results.all_failed_topics || [] },
                            { headers: getAuthHeader() }
                        );
                        if (res.data.action) {
                            setTimeout(() => {
                                if (res.data.action.view === 'code') navigate(`/agent-code?topic=${encodeURIComponent(res.data.action.data.topic)}`);
                                if (res.data.action.view === 'debugger') navigate(`/agent-debugger?topic=${encodeURIComponent(res.data.action.data.topic)}`);
                                if (res.data.action.view === 'tutor') navigate('/agent-tutor', { state: { initialMessage: res.data.reply } }); // Pass reply
                                if (res.data.action.view === 'quiz') navigate(`/agent-quiz?topic=${encodeURIComponent(res.data.action.data.topic)}`);
                            }, 2000);
                        } else {
                            // No explicit action (e.g., Teaching Phase), go to Tutor to read the reply
                            setTimeout(() => {
                                navigate('/agent-tutor', { state: { initialMessage: res.data.reply } });
                            }, 2000);
                        }
                    } catch (e) {
                        console.error("Failed to report success", e);
                    }
                }
            }
        };
        reportToAgent();
    }, [currentPhase, results]);

    const handleNextRound = () => {
        if (!results?.next_quizzes) return;
        setAttempts(results.next_quizzes);
        setSessionId(results.session_id);
        setAnswers({});
        setResults(null);
        setCurrentPhase("quiz");
    };


    // === RENDER ===

    if (loading || currentPhase === "initializing") {
        return (
            <div className="h-screen w-screen bg-gradient-to-br from-indigo-900 to-purple-900 flex flex-col items-center justify-center p-4 text-white">
                <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-white mb-4"></div>
                <h2 className="text-2xl font-bold animate-pulse">Initializing Agent Quiz...</h2>
                <p className="opacity-75 mt-2">Topic: {topic || "Loading..."}</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="h-screen w-screen bg-gray-900 flex items-center justify-center p-4">
                <div className="bg-white p-8 rounded-xl shadow-2xl max-w-md w-full text-center">
                    <div className="text-red-500 text-5xl mb-4">⚠️</div>
                    <h2 className="text-2xl font-bold text-gray-800 mb-2">Agent Error</h2>
                    <p className="text-gray-600 mb-6">{error}</p>
                    <button onClick={() => window.location.href = '/tutor'} className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
                        Return to Tutor
                    </button>
                </div>
            </div>
        );
    }

    if (currentPhase === "quiz") {
        return (
            <div className="h-screen w-screen bg-gray-100 p-4 lg:p-10 font-sans overflow-auto">
                <div className="max-w-4xl mx-auto space-y-8">
                    <div className="flex justify-between items-center">
                        <h1 className="text-3xl font-bold text-indigo-900">Agent Diagnostic: {topic}</h1>
                        <div className="px-4 py-1 bg-indigo-100 text-indigo-700 rounded-full text-sm font-semibold">Autonomous Mode</div>
                    </div>

                    {attempts.map((attempt) => (
                        <div key={attempt.attempt_id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                            <div className="bg-gray-50 border-b border-gray-100 px-6 py-4">
                                <h3 className="font-semibold text-gray-700">{attempt.topic} Prerequisites</h3>
                            </div>
                            <div className="p-6 space-y-8">
                                {attempt.questions.map((q, idx) => (
                                    <div key={q.question_id}>
                                        <p className="text-lg text-gray-800 font-medium mb-4">{idx + 1}. {q.question_text}</p>
                                        <div className="space-y-3 pl-4 border-l-2 border-indigo-100">
                                            {q.options.map((opt, i) => (
                                                <label key={i} className={`flex items-center p-3 rounded-lg border cursor-pointer transition-all ${answers[attempt.attempt_id]?.[q.question_id] === opt
                                                    ? "bg-indigo-50 border-indigo-500 ring-1 ring-indigo-500"
                                                    : "border-gray-200 hover:bg-gray-50"
                                                    }`}>
                                                    <input
                                                        type="radio"
                                                        name={`${attempt.attempt_id}-${q.question_id}`}
                                                        className="text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                                                        checked={answers[attempt.attempt_id]?.[q.question_id] === opt}
                                                        onChange={() => handleAnswerChange(attempt.attempt_id, q.question_id, opt)}
                                                    />
                                                    <span className="ml-3 text-gray-700">{opt}</span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}

                    <div className="flex justify-end pt-4">
                        <button
                            onClick={handleSubmitQuiz}
                            className="px-8 py-4 bg-indigo-600 hover:bg-indigo-700 text-white text-lg font-bold rounded-xl shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-1"
                        >
                            Submit Answers
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // Results Phase
    return (
        <div className="h-screen w-screen bg-gray-50 flex items-center justify-center p-4">
            <div className="max-w-2xl w-full bg-white rounded-2xl shadow-xl overflow-hidden p-8 text-center">
                <h2 className="text-3xl font-bold text-gray-900 mb-6">Diagnostic Complete</h2>

                {(!results.all_failed_topics || results.all_failed_topics.length === 0) && (!results.next_quizzes || results.next_quizzes.length === 0) ? (
                    <div className="animate-fade-in-up">
                        <div className="mx-auto w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mb-6">
                            <svg className="w-12 h-12 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                        </div>
                        <h3 className="text-2xl font-semibold text-green-800 mb-2">Excellent!</h3>
                        <p className="text-gray-600 mb-8">{results.message || "You are ready to proceed."}</p>

                        <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-xl animate-pulse">
                            <p className="text-indigo-800 font-medium flex items-center justify-center gap-2">
                                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                Reporting Success to Agent...
                            </p>
                        </div>
                    </div>
                ) : (
                    <div>
                        <div className="mx-auto w-20 h-20 bg-yellow-100 rounded-full flex items-center justify-center mb-6">
                            <span className="text-3xl">📝</span>
                        </div>
                        <h3 className="text-xl font-bold text-gray-800 mb-4">Review Needed</h3>
                        <p className="text-gray-600 mb-6">We found some gaps in prerequisites. Let's strengthen them.</p>

                        <button
                            onClick={handleNextRound}
                            className="px-6 py-3 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700"
                        >
                            Continue Learning
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AgentQuiz;
