import React, { useEffect, useRef, useState } from "react";

const SandboxRenderer = ({ code, isLoading }) => {
  const iframeRef = useRef(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    if (!code || isLoading) {
      iframe.srcdoc =
        '<div style="padding:20px;font-family:sans-serif;">Loading preview...</div>';
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
              overflow-x: hidden;
            }
            * { box-sizing: border-box; }
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

  // Close fullscreen on ESC key
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === "Escape") setIsFullscreen(false);
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  const openFullPreview = () => {
    const newWindow = window.open("", "_blank", "width=1200,height=800");
    if (newWindow) {
      newWindow.document.write(`
        <!DOCTYPE html>
        <html lang="en">
          <head>
            <meta charset="UTF-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1.0" />
            <title>Full Visualization Preview</title>
            <script src="https://cdn.tailwindcss.com"></script>
            <style>
              body { margin: 0; padding: 16px; background: #f9fafb; font-family: system-ui, sans-serif; }
              * { box-sizing: border-box; }
            </style>
          </head>
          <body>${code}</body>
        </html>
      `);
      newWindow.document.close();
    }
  };

  return (
    <div
      className={`transition-all duration-300 ${
        isFullscreen
          ? "fixed inset-0 z-50 bg-white p-6 overflow-auto"
          : "mt-8 p-6 bg-white border border-indigo-200 rounded-xl shadow-2xl"
      }`}
    >
      {/* Header */}
      <div className="flex justify-between items-center mb-4 border-b pb-2">
        <h3 className="text-2xl font-semibold text-indigo-700">
          Visualization Preview
        </h3>

        <div className="flex space-x-2">
          {isFullscreen ? (
            <button
              onClick={() => setIsFullscreen(false)}
              className="px-3 py-1.5 text-sm font-medium bg-indigo-100 text-indigo-600 rounded-lg hover:bg-indigo-200 transition"
            >
              Exit Fullscreen
            </button>
          ) : (
            <>
              <button
                onClick={openFullPreview}
                className="px-3 py-1.5 text-sm font-medium bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition"
              >
                Open in New Tab
              </button>
              <button
                onClick={() => setIsFullscreen(true)}
                className="px-3 py-1.5 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
              >
                Fullscreen
              </button>
            </>
          )}
        </div>
      </div>

      {/* Iframe */}
      {isLoading ? (
        <div className="p-8 text-center text-xl text-indigo-500">
          Generating visualization...
        </div>
      ) : (
        <iframe
          ref={iframeRef}
          className={`w-full ${
            isFullscreen ? "h-[85vh]" : "h-[500px]"
          } border border-gray-300 rounded-lg bg-white`}
          title="HTML Tailwind Visualization"
          sandbox="allow-scripts allow-same-origin allow-popups"
        />
      )}
    </div>
  );
};

export default SandboxRenderer;
