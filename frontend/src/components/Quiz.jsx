import React, { useState, useEffect } from "react";
import axios from "axios";
import { useLocation } from "react-router-dom";

const QuizPage = () => {
  const location = useLocation();

  // Start in 'initializing' if we have an auto-topic to prevent Input Form flash
  const [currentPhase, setCurrentPhase] = useState(() => {
    return location.state?.topic ? "initializing" : "input";
  });

  const [inputTopics, setInputTopics] = useState(location.state?.topic || "");
  const [attempts, setAttempts] = useState([]);
  const [answers, setAnswers] = useState({});
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState("");

  const getAuthHeader = () => {
    const tokenData = localStorage.getItem("user");
    const token = tokenData ? JSON.parse(tokenData).access : null;
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  // Check for auto-start from navigation
  useEffect(() => {
    if (location.state?.topic && currentPhase === 'initializing') {
      const autoTopic = location.state.topic;
      // Trigger generation immediately
      handleGenerateQuiz(autoTopic);
    }
  }, [location.state]);

  // Handlers
  const handleGenerateQuiz = async (topicOverride = null) => {
    // If called via event (onClick), topicOverride will be an object. Ignore it.
    const isStringTopic = typeof topicOverride === 'string';
    const topicToUse = isStringTopic ? topicOverride : inputTopics;

    if (!topicToUse) {
      alert("Please enter a topic");
      return;
    }

    setLoading(true);
    try {
      // Clean input: split by comma if multiple
      const topics = topicToUse.split(",").map(t => t.trim()).filter(t => t);

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
          session_id: res.data.session_id,
          all_failed_topics: []
        });
        setCurrentPhase("results");
      }
    } catch (err) {
      console.error(err);
      alert("Failed to generate quiz: " + (err.response?.data?.error || err.message));
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
    // Validate all answered
    for (const attempt of attempts) {
      const attemptAnswers = answers[attempt.attempt_id] || {};
      const allAnswered = attempt.questions.every(q => attemptAnswers[q.question_id] != null);
      if (!allAnswered) {
        alert(`Please answer all questions for topic: ${attempt.topic}`);
        return;
      }
    }

    setLoading(true);
    try {
      const submissions = attempts.map(attempt => {
        const attemptAnswers = answers[attempt.attempt_id] || {};
        return {
          attempt_id: attempt.attempt_id,
          answers: attempt.questions.map(q => ({
            question_id: q.question_id,
            chosen_choice_text: attemptAnswers[q.question_id]
          }))
        };
      });

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
      console.error(err);
      alert("Submission failed: " + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  };

  const handleNextRound = () => {
    if (!results?.next_quizzes) return;
    setAttempts(results.next_quizzes);
    setSessionId(results.session_id); // Keep same session? Or new? Standard flow keeps session but adds round.
    // Backend 'submit' response likely returns next_quizzes structure which matches 'attempts'.
    setAnswers({});
    setResults(null);
    setCurrentPhase("quiz");
  };

  const handleReset = () => {
    setCurrentPhase("input");
    setInputTopics("");
    setAttempts([]);
    setAnswers({});
    setResults(null);
  };

  // Render "Initializing" state
  if (currentPhase === "initializing") {
    return (
      <div className="h-screen w-screen bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center p-4">
        <div className="text-white text-xl font-semibold animate-pulse">
          🚀 Launching Concept Explorer for {location.state?.topic}...
        </div>
      </div>
    );
  }

  if (currentPhase === "input") {
    return (
      <div className="h-screen w-screen bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center p-4">
        <div className="w-full max-w-2xl bg-white rounded-2xl shadow-xl overflow-hidden">
          <div className="bg-indigo-600 p-6 text-center">
            <h1 className="text-3xl font-bold text-white">🧠 Prerequisite Diagnostic</h1>
            <p className="text-indigo-200 mt-2">Test your foundational knowledge before advancing</p>
          </div>
          <div className="p-6">
            <div className="mb-6">
              <label className="block text-gray-700 font-medium mb-2">
                Enter target topic(s)
              </label>
              <input
                type="text"
                value={inputTopics}
                onChange={(e) => setInputTopics(e.target.value)}
                placeholder="e.g., Stack, Queue, Recursion"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-lg"
              />
              <p className="text-gray-500 text-sm mt-2">
                We'll test only the prerequisites of these topics
              </p>
            </div>
            <button
              onClick={handleGenerateQuiz}
              disabled={loading}
              className={`w-full py-3 px-4 rounded-lg text-white font-semibold text-lg transition-all ${loading
                ? "bg-gray-400 cursor-not-allowed"
                : "bg-indigo-600 hover:bg-indigo-700 shadow-md hover:shadow-lg"
                }`}
            >
              {loading ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0-3.042 1.135-5.824 3-7.938l3 2.938z"></path>
                  </svg>
                  Analyzing prerequisites...
                </span>
              ) : (
                "Start Diagnostic Quiz"
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (currentPhase === "quiz") {
    return (
      <div className="h-screen w-screen bg-gray-50 p-4">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
            <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-6 text-white">
              <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold">Prerequisite Quiz</h1>
                <button
                  onClick={handleReset}
                  className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors"
                >
                  Cancel
                </button>
              </div>
              <p className="mt-2 opacity-90">
                Answer all questions to identify knowledge gaps
              </p>
            </div>

            <div className="p-6 space-y-8">
              {attempts.map(attempt => (
                <div key={attempt.attempt_id} className="border border-gray-200 rounded-xl overflow-hidden">
                  <div className="bg-indigo-50 px-5 py-3 border-b border-indigo-100">
                    <h2 className="text-xl font-semibold text-indigo-800 flex items-center">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                      </svg>
                      {attempt.topic}
                    </h2>
                  </div>
                  <div className="p-5">
                    {attempt.questions.map((q, idx) => (
                      <div key={q.question_id} className="mb-6 last:mb-0">
                        <div className="flex items-start">
                          <span className="flex-shrink-0 w-8 h-8 rounded-full bg-indigo-100 text-indigo-800 flex items-center justify-center font-bold mr-4 mt-1">
                            {idx + 1}
                          </span>
                          <div className="flex-1">
                            <h3 className="text-gray-800 font-medium mb-3">{q.question_text}</h3>
                            <div className="space-y-2">
                              {q.options.map((opt, i) => (
                                <label
                                  key={i}
                                  className={`flex items-center p-3 rounded-lg border cursor-pointer transition-all ${answers[attempt.attempt_id]?.[q.question_id] === opt
                                    ? "border-indigo-500 bg-indigo-50 ring-2 ring-indigo-200"
                                    : "border-gray-200 hover:bg-gray-50"
                                    }`}
                                >
                                  <input
                                    type="radio"
                                    name={`${attempt.attempt_id}-${q.question_id}`}
                                    checked={answers[attempt.attempt_id]?.[q.question_id] === opt}
                                    onChange={() => handleAnswerChange(attempt.attempt_id, q.question_id, opt)}
                                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500"
                                  />
                                  <span className="ml-3 text-gray-700">{opt}</span>
                                </label>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-gray-50 px-6 py-4 border-t border-gray-200">
              <button
                onClick={handleSubmitQuiz}
                disabled={loading}
                className={`w-full py-3 px-4 rounded-lg font-semibold text-lg transition-all ${loading
                  ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                  : "bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white shadow-md hover:shadow-lg"
                  }`}
              >
                {loading ? "Submitting..." : "Submit Answers & Analyze"}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (currentPhase === "results") {
    return (
      <div className="h-screen w-screen bg-gradient-to-br from-blue-50 to-indigo-50 p-4 flex items-center justify-center">
        <div className="w-full max-w-3xl bg-white rounded-2xl shadow-xl overflow-hidden">
          <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-6 text-white text-center">
            <h1 className="text-3xl font-bold">📊 Diagnostic Results</h1>
            <p className="opacity-90 mt-1">Your prerequisite knowledge assessment</p>
          </div>

          <div className="p-6 space-y-6">
            {/* Topic Scores */}
            <div>
              <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-blue-600" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Topic Performance
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Object.entries(results.topic_scores || {}).map(([topic, score]) => (
                  <div key={topic} className="border border-gray-200 rounded-xl p-4">
                    <div className="flex justify-between items-start mb-2">
                      <span className="font-medium text-gray-800">{topic}</span>
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${score >= 50 ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                        }`}>
                        {score}%
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${score >= 50 ? "bg-green-500" : "bg-red-500"}`}
                        style={{ width: `${score}%` }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Lagging Topics This Round */}
            {results.lagging_topics && results.lagging_topics.length > 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
                <h3 className="font-semibold text-yellow-800 flex items-center mb-2">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  Needs Review (This Round)
                </h3>
                <p className="text-yellow-700">
                  {results.lagging_topics.join(", ")}
                </p>
              </div>
            )}

            {/* Final Failed Topics Report */}
            {results.all_failed_topics && results.all_failed_topics.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                <h3 className="font-semibold text-red-800 flex items-center mb-2">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                  All Failed Topics (Session Summary)
                </h3>
                <p className="text-red-700">
                  {results.all_failed_topics.join(", ")}
                </p>
                <p className="text-red-600 text-sm mt-2">
                  Focus on these areas before attempting the target topics
                </p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="pt-4">
              {results.next_quizzes && results.next_quizzes.length > 0 ? (
                <div className="text-center">
                  <p className="text-gray-700 mb-4">
                    🔄 We've identified prerequisite gaps. Continue to strengthen your foundation.
                  </p>
                  <button
                    onClick={handleNextRound}
                    className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg font-semibold hover:from-indigo-700 hover:to-purple-700 shadow-md transition-all"
                  >
                    Continue to Next Prerequisites
                  </button>
                </div>
              ) : (
                <div className="text-center">
                  <div className="inline-flex items-center px-4 py-2 bg-green-100 text-green-800 rounded-full mb-4">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    Diagnostic Complete
                  </div>
                  <p className="text-gray-700 mb-6">
                    {results.message || "You're ready to learn the target topics!"}
                  </p>

                  {/* Auto-Reporting Success Block */}
                  {(!results.all_failed_topics || results.all_failed_topics.length === 0) && (
                    <div className="mb-4 p-3 bg-indigo-50 border border-indigo-200 rounded-lg animate-pulse">
                      <p className="text-indigo-800 font-medium">🤖 Reporting success to Agent... Stand by.</p>
                    </div>
                  )}

                  <button
                    onClick={handleReset}
                    className="px-6 py-3 bg-gray-800 text-white rounded-lg font-semibold hover:bg-gray-900 transition-colors"
                  >
                    Start New Diagnostic
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Effect to report success to Agent
  useEffect(() => {
    const reportToAgent = async () => {
      if (currentPhase === 'results' && results && (!results.next_quizzes || results.next_quizzes.length === 0)) {
        // If no failures, report success
        if (!results.all_failed_topics || results.all_failed_topics.length === 0) {
          try {
            const res = await axios.post(
              "http://localhost:8000/api/main-agent/report_success/",
              {},
              { headers: getAuthHeader() }
            );
            if (res.data.action) {
              // Navigate
              setTimeout(() => {
                if (res.data.action.view === 'code') window.location.href = '/coding';
                if (res.data.action.view === 'debugger') window.location.href = '/debugger';
                if (res.data.action.view === 'tutor') window.location.href = '/tutor';
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

  return null;
};

export default QuizPage;