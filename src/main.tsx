import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import CodeSharkApp from "./codeshark/components/CodeSharkApp";
import { CodeSharkErrorBoundary } from "./codeshark/components/CodeSharkErrorBoundary";
import "./index.css";

const urlParams = new URLSearchParams(window.location.search);
const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
const isCodeShark =
  urlParams.get("app") === "codeshark" ||
  hashParams.get("app") === "codeshark" ||
  window.location.href.includes("app=codeshark");

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    {isCodeShark ? (
      <CodeSharkErrorBoundary>
        <CodeSharkApp />
      </CodeSharkErrorBoundary>
    ) : (
      <App />
    )}
  </React.StrictMode>
);
