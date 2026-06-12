import React, { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useDropzone } from "react-dropzone";
import { uploadZip, submitGithubUrl } from "../services/api";

type TabType = "upload" | "github";

const Tool: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabType>("upload");
  const [githubUrl, setGithubUrl] = useState("");
  const [email, setEmail] = useState("");
  const [outputFormat, setOutputFormat] = useState("markdown");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      const f = acceptedFiles[0];
      if (!f.name.endsWith(".zip")) {
        setError("Only .zip files are accepted");
        return;
      }
      if (f.size > 10 * 1024 * 1024) {
        setError("File too large. Maximum 10 MB.");
        return;
      }
      setFile(f);
      setError("");
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "application/zip": [".zip"] },
    maxFiles: 1,
  });

  const handleSubmit = async () => {
    setError("");
    setLoading(true);
    try {
      let result;
      if (activeTab === "upload") {
        if (!file) {
          setError("Please select a zip file");
          setLoading(false);
          return;
        }
        result = await uploadZip(file, email || undefined, outputFormat);
      } else {
        if (!githubUrl) {
          setError("Please enter a GitHub URL");
          setLoading(false);
          return;
        }
        result = await submitGithubUrl(
          githubUrl,
          email || undefined,
          outputFormat
        );
      }

      // Save to local history
      const history = JSON.parse(localStorage.getItem("documantic_history") || "[]");
      history.unshift({
        jobId: result.jobId,
        source: activeTab === "upload" ? file?.name : githubUrl,
        createdAt: Date.now(),
      });
      localStorage.setItem(
        "documantic_history",
        JSON.stringify(history.slice(0, 5))
      );

      navigate(`/result/${result.jobId}`);
    } catch (err: any) {
      setError(
        err.response?.data?.detail || err.message || "Something went wrong"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="tool-page">
      <h1>Generate Documentation</h1>
      <p className="tool-desc">
        Upload a zip of your source code or paste a public GitHub URL.
      </p>

      <div className="tab-bar">
        <button
          className={`tab ${activeTab === "upload" ? "active" : ""}`}
          onClick={() => setActiveTab("upload")}
        >
          Upload Zip
        </button>
        <button
          className={`tab ${activeTab === "github" ? "active" : ""}`}
          onClick={() => setActiveTab("github")}
        >
          GitHub URL
        </button>
      </div>

      <div className="tool-form">
        {activeTab === "upload" ? (
          <div
            {...getRootProps()}
            className={`dropzone ${isDragActive ? "drag-active" : ""} ${
              file ? "has-file" : ""
            }`}
          >
            <input {...getInputProps()} />
            {file ? (
              <div className="file-info">
                <p className="file-name">{file.name}</p>
                <p className="file-size">
                  {(file.size / 1024).toFixed(1)} KB
                </p>
                <button
                  className="btn btn-small"
                  onClick={(e) => {
                    e.stopPropagation();
                    setFile(null);
                  }}
                >
                  Remove
                </button>
              </div>
            ) : (
              <div>
                <p className="drop-text">
                  {isDragActive
                    ? "Drop the zip file here..."
                    : "Drag & drop a .zip file here, or click to select"}
                </p>
                <p className="drop-hint">Max 10 MB</p>
              </div>
            )}
          </div>
        ) : (
          <input
            type="text"
            className="github-input"
            placeholder="https://github.com/username/repo"
            value={githubUrl}
            onChange={(e) => setGithubUrl(e.target.value)}
          />
        )}

        <div className="options-row">
          <div className="option">
            <label>Email (optional)</label>
            <input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="option">
            <label>Output format</label>
            <select
              value={outputFormat}
              onChange={(e) => setOutputFormat(e.target.value)}
            >
              <option value="markdown">Markdown</option>
              <option value="html">HTML</option>
            </select>
          </div>
        </div>

        {error && <p className="error-msg">{error}</p>}

        <button
          className="btn btn-primary btn-large"
          onClick={handleSubmit}
          disabled={loading}
        >
          {loading ? "Processing..." : "Generate Documentation"}
        </button>
      </div>
    </div>
  );
};

export default Tool;
