import React, { useState } from 'react';
import SandboxRenderer from './SandboxRenderer'; // renders HTML in iframe
import CodeDisplay from './CodeDisplay'; // shows generated HTML code

const Playground = () => {
  const [prompt, setPrompt] = useState(
    'Generate an HTML + TailwindCSS visualization showing the Bubble Sort process on 5 bars with step-by-step transitions and Next/Reset buttons.'
  );
  const [visualizationCode, setVisualizationCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const problemExamples = [
    'Visualize the Bubble Sort process using colored bars.',
    'Show the Depth-First Search traversal on a tree in HTML + Tailwind.',
    'Create a Binary Search visualization with dynamic highlighting.',
    'Visualize a queue animation using boxes and enqueue/dequeue buttons.'
  ];

  const handleVisualize = async () => {
    if (!prompt) {
      setError('Please enter a problem description.');
      return;
    }

    setVisualizationCode('');
    setError('');
    setIsLoading(true);

    try {
      const res = await fetch('http://localhost:8000/api/code/vis/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt })
      });

      const data = await res.json();
      console.log('Response data:', data);
      if (res.ok && data.code) {
        setVisualizationCode(data.code);
      } else {
        setError(data.error || 'Failed to generate visualization.');
      }
    } catch (err) {
      setError(err.message || 'Network error.');
    }

    setIsLoading(false);
  };

  return (
    <div className="min-h-screen bg-gray-100 p-8 sm:p-12 font-sans">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <header className="text-center mb-10">
          <h1 className="text-5xl font-extrabold text-indigo-800 tracking-tight">
            AI Visualization Playground
          </h1>
          <p className="mt-3 text-lg text-gray-600">
            Generate interactive <span className="font-semibold text-indigo-600">HTML + TailwindCSS</span> visualizations for algorithms or logic flows.
          </p>
        </header>

        {/* Input Area */}
        <div className="bg-white p-6 rounded-2xl shadow-xl border border-indigo-100">
          <h2 className="text-2xl font-bold text-indigo-700 mb-4">Describe Your Visualization</h2>
          <textarea
            className="w-full p-4 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 text-gray-800 h-28 resize-none"
            placeholder="E.g., Show how bubble sort swaps adjacent elements with animations..."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            disabled={isLoading}
          />

          <div className="flex flex-col sm:flex-row justify-between items-center mt-4">
            <button
              onClick={handleVisualize}
              disabled={isLoading}
              className={`px-8 py-3 w-full sm:w-auto font-semibold text-white rounded-full shadow-lg transition duration-300 ${
                isLoading
                  ? 'bg-indigo-400 cursor-not-allowed'
                  : 'bg-indigo-600 hover:bg-indigo-700 hover:scale-[1.02] active:scale-[0.98]'
              }`}
            >
              {isLoading ? (
                <div className="flex items-center space-x-2">
                  <svg
                    className="animate-spin h-5 w-5 text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  <span>Generating...</span>
                </div>
              ) : (
                'Generate Visualization'
              )}
            </button>

            <div className="text-sm text-gray-500 mt-4 sm:mt-0 sm:ml-4">
              Try:
              {problemExamples.map((ex, index) => (
                <span
                  key={index}
                  onClick={() => setPrompt(ex)}
                  className="cursor-pointer underline text-indigo-500 hover:text-indigo-700 ml-2"
                >
                  {index + 1}
                </span>
              ))}
            </div>
          </div>

          {error && (
            <div className="mt-4 p-3 bg-red-100 text-red-700 border border-red-300 rounded-lg">
              {error}
            </div>
          )}
        </div>

        {/* Output */}
        <SandboxRenderer code={visualizationCode} isLoading={isLoading} />
        <CodeDisplay code={visualizationCode} />

        <footer className="mt-16 text-center text-sm text-gray-500 border-t pt-4">
          <p>Powered by AI-generated HTML + Tailwind visualizations.</p>
        </footer>
      </div>
    </div>
  );
};

export default Playground;
