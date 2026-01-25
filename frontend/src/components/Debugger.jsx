import React, { useState, useEffect } from 'react';
import CodeEditor from './CodeEditor'; // Reuse existing component
import axios from 'axios';
import { useLocation, useNavigate } from 'react-router-dom';
import TopicModal from './common/TopicModal';

const Debugger = () => {
    const navigate = useNavigate();


    // Batch/Queue State
    const [challengeQueue, setChallengeQueue] = useState([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [topic, setTopic] = useState("");
    const [showModal, setShowModal] = useState(true);

    const [challenge, setChallenge] = useState(null); // Current active challenge
    const [loading, setLoading] = useState(false);
    const [userExplanation, setUserExplanation] = useState("");
    const [verifying, setVerifying] = useState(false);
    const [feedback, setFeedback] = useState(null);
    const [error, setError] = useState(null);

    // Pyodide and Editor State
    const [editorCode, setEditorCode] = useState("");
    const [pyodide, setPyodide] = useState(null);
    const [isRunning, setIsRunning] = useState(false);
    const [runOutput, setRunOutput] = useState(null);

    // Load from LocalStorage on Mount
    useEffect(() => {
        const savedQueue = localStorage.getItem('debuggerQueue');
        const savedIndex = localStorage.getItem('debuggerIndex');
        const savedTopic = localStorage.getItem('debuggerTopic');

        if (savedQueue && savedQueue !== "undefined") {
            try {
                const parsedQueue = JSON.parse(savedQueue);
                if (parsedQueue.length > 0) {
                    setChallengeQueue(parsedQueue);
                    setCurrentIndex(Number(savedIndex) || 0);
                    setTopic(savedTopic || "General");
                    setChallenge(parsedQueue[Number(savedIndex) || 0]);
                    setShowModal(false);
                }
            } catch (e) {
                console.error("Failed to load saved session", e);
                localStorage.removeItem('debuggerQueue');
            }
        }
    }, []);

    // Update Current Challenge when Index Changes
    useEffect(() => {
        if (challengeQueue.length > 0 && challengeQueue[currentIndex]) {
            setChallenge(challengeQueue[currentIndex]);
            setFeedback(null);
            setUserExplanation("");
            setRunOutput(null);
            // Save progress
            localStorage.setItem('debuggerIndex', currentIndex);
        }
    }, [currentIndex, challengeQueue]);


    const handleTopicSubmit = async (selectedTopic) => {
        setTopic(selectedTopic);
        setLoading(true);
        try {
            const userData = JSON.parse(localStorage.getItem("user"));
            const token = userData?.access;
            const config = token ? { headers: { Authorization: `Bearer ${token}` } } : {};

            // Request batch of 5
            const response = await axios.get(`http://localhost:8000/api/debugger/get-challenge/?topic=${selectedTopic}&count=5`, config);

            const newQueue = Array.isArray(response.data) ? response.data : [response.data];

            setChallengeQueue(newQueue);
            setCurrentIndex(0);
            setChallenge(newQueue[0]);

            // Persist
            localStorage.setItem('debuggerQueue', JSON.stringify(newQueue));
            localStorage.setItem('debuggerIndex', 0);
            localStorage.setItem('debuggerTopic', selectedTopic);

            setShowModal(false);
        } catch (err) {
            console.error("Error fetching challenges", err);
            setError("Failed to load challenges. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    const handleNext = () => {
        if (currentIndex < challengeQueue.length - 1) {
            setCurrentIndex(prev => prev + 1);
        } else {
            // Finished
            if (window.confirm("You've completed the batch! Start a new topic?")) {
                clearSession();
            }
        }
    };

    const clearSession = () => {
        localStorage.removeItem('debuggerQueue');
        localStorage.removeItem('debuggerIndex');
        localStorage.removeItem('debuggerTopic');
        setChallengeQueue([]);
        setChallenge(null);
        setShowModal(true);
    };

    // Auto-Start from Navigation
    const location = useLocation();
    useEffect(() => {
        if (location.state?.topic) {
            const autoTopic = location.state.topic;
            setTopic(autoTopic);
            handleTopicSubmit(autoTopic);
        }
    }, [location.state]);

    // Initialize Pyodide
    useEffect(() => {
        const initPyodide = async () => {
            try {
                if (window.loadPyodide && !pyodide) {
                    const pyodideInstance = await window.loadPyodide({
                        indexURL: "https://cdn.jsdelivr.net/pyodide/v0.25.0/full/"
                    });
                    setPyodide(pyodideInstance);
                }
            } catch (err) {
                console.error("Failed to load Pyodide:", err);
            }
        };
        initPyodide();
    }, []);

    // Set editor code when challenge loads
    useEffect(() => {
        if (challenge?.buggy_code) {
            setEditorCode(challenge.buggy_code);
        }
    }, [challenge]);

    const handleRunCode = async () => {
        if (!pyodide) return;
        setIsRunning(true);
        setRunOutput(null);
        try {
            // Redirect stdout to capture output
            await pyodide.runPythonAsync(`
                import sys
                import io
                sys.stdout = io.StringIO()
            `);

            await pyodide.runPythonAsync(editorCode);

            const stdout = pyodide.runPython("sys.stdout.getvalue()");
            setRunOutput(stdout);
        } catch (err) {
            setRunOutput(String(err)); // Show error in output
        } finally {
            setIsRunning(false);
        }
    };


    const handleSubmit = async () => {
        if (!challenge || !userExplanation.trim()) return;

        setVerifying(true);
        try {
            const userData = JSON.parse(localStorage.getItem("user"));
            const token = userData?.access;
            const config = token ? { headers: { Authorization: `Bearer ${token}` } } : {};

            const response = await axios.post(`http://localhost:8000/api/debugger/verify/`, {
                challenge_id: challenge.id,
                user_explanation: userExplanation
            }, config);

            setFeedback(response.data);

            // AGENT LOOP: Report Success
            if (response.data.is_correct) {
                try {
                    const reportRes = await axios.post(
                        "http://localhost:8000/api/main-agent/report_success/",
                        {},
                        config
                    );

                    if (reportRes.data.action) {
                        // Allow user to see the success message briefly before moving
                        setTimeout(() => {
                            if (reportRes.data.action.view === 'code') navigate('/coding');
                            if (reportRes.data.action.view === 'tutor') navigate('/tutor');
                            if (reportRes.data.action.view === 'quiz') navigate('/quiz', { state: { topic: reportRes.data.action.data?.topic } });
                        }, 3000);
                    }
                } catch (reportErr) {
                    console.error("Failed to report success to agent", reportErr);
                }
            }

        } catch (err) {
            console.error("Verification failed", err);
            setError("Verification failed. Please try again.");
        } finally {
            setVerifying(false);
        }
    };

    if (loading) return <div className="flex items-center justify-center h-screen bg-gray-50 dark:bg-gray-900 text-gray-500">Loading Challenge...</div>;

    return (
        <div className="h-screen w-screen bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-100 p-4 lg:p-8 font-sans">
            <div className="max-w-6xl mx-auto space-y-6">

                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h1 className="text-3xl font-bold bg-gradient-to-r from-red-500 to-orange-500 bg-clip-text text-transparent">
                            De-Bugger Mode
                        </h1>
                        <p className="text-gray-600 dark:text-gray-400 mt-1">
                            Find the bug, explain the logic.
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className="px-3 py-1 bg-gray-200 dark:bg-gray-800 rounded-full text-sm font-medium">
                            {topic || "General"}
                        </span>
                        <span className="px-3 py-1 bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 rounded-full text-sm font-medium">
                            {currentIndex + 1} / {challengeQueue.length || 1}
                        </span>
                        <button
                            onClick={handleNext}
                            className="ml-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-sm transition-colors text-sm font-medium"
                        >
                            Next Challenge
                        </button>
                        <button
                            onClick={clearSession}
                            className="ml-2 px-3 py-2 bg-red-100 text-red-600 hover:bg-red-200 rounded-lg text-sm"
                            title="Restart"
                        >
                            ↻
                        </button>
                    </div>
                </div>

                {showModal && <TopicModal onSubmit={handleTopicSubmit} isLoading={loading} />}
            </div>

            {error && (
                <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg border border-red-200 dark:border-red-800">
                    {error}
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[600px]">

                {/* Left Column: Code & Error */}
                <div className="flex flex-col gap-4 h-full">
                    {/* Code Editor */}
                    <div className="flex-1 min-h-0 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden flex flex-col">
                        <div className="flex items-center justify-between px-4 py-2 bg-gray-100 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
                            <span className="text-xs font-mono text-gray-500">buggy_code.py</span>
                            <div className="flex items-center gap-2">
                                {!pyodide && <span className="text-xs text-orange-500 animate-pulse">Loading Python...</span>}
                                <button
                                    onClick={handleRunCode}
                                    disabled={!pyodide || isRunning}
                                    className={`text-xs px-3 py-1 rounded font-medium text-white transition-colors ${!pyodide || isRunning ? 'bg-gray-400 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700'}`}
                                >
                                    {isRunning ? 'Running...' : '▶ Run Code'}
                                </button>
                            </div>
                        </div>
                        <div className="flex-1 relative">
                            <CodeEditor
                                code={editorCode}
                                readOnly={false}
                                setCode={setEditorCode}
                                className="h-full border-none rounded-none"
                            />
                        </div>
                    </div>

                    {/* Terminal Output */}
                    <div className={`h-1/3 bg-gray-900 font-mono text-sm p-4 rounded-xl shadow-inner overflow-auto border-l-4 ${runOutput ? 'border-blue-500 text-gray-200' : 'border-red-500 text-red-400'}`}>
                        <div className="flex items-center justify-between gap-2 mb-2 border-b border-gray-800 pb-1">
                            <span className="flex items-center gap-2 text-gray-500">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
                                {runOutput ? "Run Output" : "Original Compiler Error"}
                            </span>
                            {runOutput && (
                                <button onClick={() => setRunOutput(null)} className="text-xs text-gray-500 hover:text-white">
                                    Reset to Error
                                </button>
                            )}
                        </div>
                        <pre className="whitespace-pre-wrap">
                            {runOutput !== null ? runOutput : (challenge?.error_output || "No error output provided.")}
                        </pre>
                    </div>
                </div>

                {/* Right Column: Interaction */}
                <div className="flex flex-col gap-4 h-full">

                    {/* Description */}
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
                        <h3 className="text-lg font-semibold mb-2">The Mission</h3>
                        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
                            {challenge?.description || "Identify the error in the code."}
                        </p>
                    </div>

                    {/* User Input */}
                    <div className="flex-1 bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 flex flex-col">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Explain the Logic Error
                        </label>
                        <textarea
                            value={userExplanation}
                            onChange={(e) => setUserExplanation(e.target.value)}
                            placeholder="E.g. The error occurs on line 5 because the variable is undefined..."
                            className="flex-1 w-full p-4 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none transition-all"
                        />
                        <div className="mt-4 flex justify-end">
                            <button
                                onClick={handleSubmit}
                                disabled={verifying || !userExplanation.trim()}
                                className={`px-6 py-2.5 rounded-lg font-medium text-white shadow-lg transition-all transform hover:-translate-y-0.5 ${verifying ? 'bg-gray-400 cursor-not-allowed' : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700'
                                    }`}
                            >
                                {verifying ? 'Verifying with AI...' : 'Submit Diagnosis'}
                            </button>
                        </div>
                    </div>

                    {/* Feedback Area */}
                    {feedback && (
                        <div className={`p-6 rounded-xl border animate-fade-in ${feedback.is_correct ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800' : 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800'
                            }`}>
                            <div className="flex items-center gap-3 mb-3">
                                <div className={`p-2 rounded-full ${feedback.is_correct ? 'bg-green-100 text-green-600' : 'bg-orange-100 text-orange-600'}`}>
                                    {feedback.is_correct ? (
                                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                                    ) : (
                                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
                                    )}
                                </div>
                                <h3 className={`text-lg font-bold ${feedback.is_correct ? 'text-green-800 dark:text-green-200' : 'text-orange-800 dark:text-orange-200'}`}>
                                    {feedback.is_correct ? "Correct Diagnosis!" : "Keep Debugging"}
                                </h3>
                            </div>

                            <p className="text-gray-700 dark:text-gray-300 mb-4">{feedback.feedback}</p>

                            <div className="grid grid-cols-3 gap-2 text-sm">
                                {['Line Number', 'Reason', 'Fix'].map((item, idx) => {
                                    const key = item === 'Line Number' ? 'line_correct' : item === 'Reason' ? 'reason_correct' : 'fix_correct';
                                    // Assuming backend sends detailed_feedback with these keys
                                    // If backend didn't send them (older prompt), handle gracefully
                                    const status = feedback[key] || feedback.detailed_feedback?.[key];

                                    return (
                                        <div key={idx} className={`p-2 rounded border flex items-center justify-center gap-2 ${status ? 'bg-white dark:bg-gray-800 border-green-200 text-green-700' : 'bg-white dark:bg-gray-800 border-gray-200 text-gray-400'
                                            }`}>
                                            {status ? '✅' : '⚪'} {item}
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    )}

                </div>
            </div>
        </div>

    );
};

export default Debugger;
