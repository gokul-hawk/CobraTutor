import React, { useEffect, useRef } from 'react';

const SandboxRenderer = ({ code, isLoading }) => {
  const iframeRef = useRef(null);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    if (!code || isLoading) {
      iframe.srcdoc = '<div style="padding:20px;font-family:sans-serif;">Loading preview...</div>';
      return;
    }

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>AI Visualization Preview</title>
          <script src="https://cdn.tailwindcss.com"></script>
          <style>
            body {
              margin: 0;
              padding: 16px;
              background-color: #f9fafb;
              font-family: system-ui, sans-serif;
            }
            button { cursor: pointer; }
          </style>
        </head>
        <body>
          ${code}
        </body>
      </html>
    `;

    iframe.srcdoc = htmlContent;
  }, [code, isLoading]);

  return (
    <div className="mt-8 p-6 bg-white border border-indigo-200 rounded-xl shadow-2xl">
      <h3 className="text-2xl font-semibold text-indigo-700 mb-4 border-b pb-2">
        Visualization Preview
      </h3>
      {isLoading ? (
        <div className="p-8 text-center text-xl text-indigo-500">Generating visualization...</div>
      ) : (
        <iframe
          ref={iframeRef}
          className="w-full h-[500px] border border-gray-300 rounded-lg bg-white"
          title="HTML Tailwind Visualization"
          sandbox="allow-scripts allow-same-origin allow-popups"
        />
      )}
    </div>
  );
};

export default SandboxRenderer;
