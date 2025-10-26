// CodeEditor.jsx
import Editor from "@monaco-editor/react";

export default function CodeEditor({ code, setCode }) {
  return (
    <Editor
      height="100%"
      defaultLanguage="python"
      value={code}
      onChange={(value) => setCode(value)}
      theme="vs-dark"
      options={{
        minimap: { enabled: false },
        fontSize: 16,
        wordWrap: "on",
      }}
    />
  );
}
