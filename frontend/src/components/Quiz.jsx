import React, { useState } from "react";
import axios from "axios";

const QuizPage = () => {
  const [topics, setTopics] = useState("");
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [attemptId, setAttemptId] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  // --- Generate Quiz ---
  const handleGenerateQuiz = async () => {
    if (!topics.trim()) {
      alert("Please enter at least one topic name.");
      return;
    }
    setLoading(true);

    try {
      const tokenData = localStorage.getItem("user");
      const token = tokenData ? JSON.parse(tokenData).access : null;

      const res = await axios.post(
        "http://localhost:8000/api/quizzes/generate/",
        { topic_names: topics.split(",").map((t) => t.trim()) },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      // ✅ The backend returns an array of questions
      setQuestions(res.data.questions);
      setAttemptId(res.data.attempt_id);
      setAnswers({});
      setResult(null);
    } catch (err) {
      console.error(err);
      alert("Failed to generate quiz.");
    }
    setLoading(false);
  };

  // --- Handle Answer Change ---
  const handleAnswerChange = (questionId, choiceText) => {
    setAnswers((prev) => ({ ...prev, [questionId]: choiceText }));
  };

  // --- Submit Quiz ---
  const handleSubmitQuiz = async () => {
    if (Object.keys(answers).length < questions.length) {
      alert("Please answer all questions before submitting!");
      return;
    }
    setLoading(true);

    try {
      const tokenData = localStorage.getItem("user");
      const token = tokenData ? JSON.parse(tokenData).access : null;

      const payload = {
        attempt_id: attemptId,
        answers: questions.map((q) => ({
          question_id: q.question_id,
          chosen_choice_text: answers[q.question_id],
        })),
      };

      const res = await axios.post(
        "http://localhost:8000/api/quizzes/submit/",
        payload,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setResult(res.data);
    } catch (err) {
      console.error(err);
      alert("Error submitting quiz.");
    }
    setLoading(false);
  };

  // --- Reset Quiz ---
  const handleReset = () => {
    setTopics("");
    setQuestions([]);
    setAnswers({});
    setResult(null);
    setAttemptId("");
  };

  return (
    <div className="h-screen w-screen flex items-center justify-center bg-gradient-to-br from-indigo-500 via-purple-500 to-blue-500 p-6">
      <div className="bg-white p-8 rounded-2xl shadow-2xl w-full max-w-5xl overflow-y-auto max-h-[90vh]">
        <h1 className="text-4xl font-bold text-center mb-8 text-indigo-600">
          🧠 AI-Powered Quiz
        </h1>

        {/* --- Topic Input --- */}
        {!questions.length && !result && (
          <div className="flex flex-col items-center">
            <input
              type="text"
              value={topics}
              onChange={(e) => setTopics(e.target.value)}
              placeholder="Enter topics (comma-separated)"
              className="border border-gray-300 rounded-lg p-3 w-full max-w-lg mb-6 focus:ring-2 focus:ring-indigo-500 focus:outline-none text-lg"
            />
            <button
              onClick={handleGenerateQuiz}
              disabled={loading}
              className={`w-full max-w-xs py-3 rounded-lg text-white text-lg font-medium transition-all ${
                loading
                  ? "bg-gray-400 cursor-not-allowed"
                  : "bg-indigo-600 hover:bg-indigo-700 focus:ring-2 focus:ring-indigo-400"
              }`}
            >
              {loading ? "Generating..." : "Generate Quiz"}
            </button>
          </div>
        )}

        {/* --- Quiz Questions --- */}
        {questions.length > 0 && !result && (
          <div className="space-y-8">
            {questions.map((q, idx) => (
              <div
                key={q.question_id}
                className="bg-gray-50 p-5 rounded-xl border border-gray-200 shadow-sm"
              >
                <h2 className="text-xl font-semibold mb-4 text-gray-800">
                  {idx + 1}. {q.question_text}
                </h2>
                <div className="space-y-3">
                  {q.options.map((opt, i) => (
                    <label
                      key={`${q.question_id}-${i}`}
                      className={`block p-3 rounded-lg border cursor-pointer transition-all ${
                        answers[q.question_id] === opt
                          ? "bg-indigo-100 border-indigo-500"
                          : "border-gray-300 hover:bg-gray-100"
                      }`}
                    >
                      <input
                        type="radio"
                        name={q.question_id}
                        value={opt}
                        onChange={() => handleAnswerChange(q.question_id, opt)}
                        className="mr-3"
                        checked={answers[q.question_id] === opt}
                      />
                      <span className="text-black">{opt}</span> {/* ✅ black option text */}
                    </label>
                  ))}
                </div>
              </div>
            ))}

            <div className="text-center">
              <button
                onClick={handleSubmitQuiz}
                disabled={loading}
                className={`w-full max-w-xs py-3 rounded-lg text-white text-lg font-medium transition-all ${
                  loading
                    ? "bg-gray-400 cursor-not-allowed"
                    : "bg-green-600 hover:bg-green-700 focus:ring-2 focus:ring-green-400"
                }`}
              >
                {loading ? "Submitting..." : "Submit Quiz"}
              </button>
            </div>
          </div>
        )}

        {/* --- Results Section --- */}
        {result && (
          <div className="text-center mt-8">
            <h2 className="text-3xl font-bold mb-5 text-indigo-700">
              🎯 Quiz Results
            </h2>

            <div className="bg-gray-50 p-6 rounded-xl border border-gray-200 shadow-md text-left space-y-4">
              <p>
                <strong>Topic:</strong> {result.topic}
              </p>
              <p>
                <strong>Score:</strong> {result.score}%
              </p>
              <p>
                <strong>Status:</strong>{" "}
                {result.passed ? (
                  <span className="text-green-600 font-semibold">Passed ✅</span>
                ) : (
                  <span className="text-red-600 font-semibold">Failed ❌</span>
                )}
              </p>
              <h3 className="text-lg font-semibold mt-4 mb-2">
                Feedback:
              </h3>
              <ul className="list-disc pl-6 text-gray-700">
                {Object.entries(result.feedback).map(([qid, info], idx) => (
                  <li key={qid}>
                    Q{idx + 1}:{" "}
                    {info.correct ? (
                      <span className="text-green-600">Correct</span>
                    ) : (
                      <span className="text-red-600">
                        Incorrect (Correct: {info.correct_answer})
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>

            <button
              onClick={handleReset}
              className="mt-8 bg-indigo-600 text-white text-lg px-8 py-3 rounded-xl hover:bg-indigo-700 transition-all"
            >
              Take Another Quiz
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default QuizPage;
