import React, { useState } from "react";

const ContextPanel = () => {
  const [notes, setNotes] = useState("");
  const currentTopic = "Arrays";
  const concepts = ["Definition", "Indexing", "Iteration", "Sorting"];
  const quizzes = [{ topic: "Array Basics" }, { topic: "Sorting Techniques" }];

  const startQuiz = (topic) => {
    alert(`Starting quiz on ${topic}`);
  };

  return (
    <div className="w-full h-full bg-gray-100 dark:bg-gray-950 border-l dark:border-gray-800 p-4 flex flex-col">
      <h2 className="text-lg font-semibold mb-3 text-gray-800 dark:text-gray-200">Context Panel</h2>

      <div className="mb-4">
        <h3 className="font-medium text-gray-700 dark:text-gray-300">Current Topic</h3>
        <p className="text-sm text-gray-600 dark:text-gray-400">{currentTopic}</p>
      </div>

      <div className="mb-4">
        <h3 className="font-medium text-gray-700 dark:text-gray-300">Key Concepts</h3>
        <ul className="list-disc list-inside text-sm text-gray-600 dark:text-gray-400">
          {concepts.map((c, i) => (
            <li key={i}>{c}</li>
          ))}
        </ul>
      </div>

      <div className="mb-4">
        <h3 className="font-medium text-gray-700 dark:text-gray-300">Quiz Recommendations</h3>
        {quizzes.map((q, i) => (
          <button
            key={i}
            onClick={() => startQuiz(q.topic)}
            className="mt-2 w-full text-left bg-blue-100 dark:bg-blue-900 hover:bg-blue-200 dark:hover:bg-blue-800 text-blue-800 dark:text-blue-300 px-3 py-2 rounded-md"
          >
            {q.topic}
          </button>
        ))}
      </div>

      <div className="mt-auto">
        <h3 className="font-medium text-gray-700 dark:text-gray-300 mb-2">Mini Notebook</h3>
        <textarea
          className="w-full h-32 p-2 rounded-lg bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 border dark:border-gray-700 resize-none"
          placeholder="Write your notes here..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>
    </div>
  );
};

export default ContextPanel;
