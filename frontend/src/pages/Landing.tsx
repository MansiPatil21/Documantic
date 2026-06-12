import React from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const Landing: React.FC = () => {
  const { isAuthenticated } = useAuth();

  return (
    <div className="landing">
      <section className="hero">
        <div className="hero-badge">AI-Powered Documentation</div>
        <h1>
          Stop Writing Docs.<br />
          <span className="hero-gradient">Let AI Do It.</span>
        </h1>
        <p className="hero-subtitle">
          Upload your code or paste a GitHub URL — get complete README, API docs,
          inline comments, and a quality scorecard in under 2 minutes.
        </p>
        <div className="hero-buttons">
          {isAuthenticated ? (
            <Link to="/dashboard" className="btn btn-primary btn-large">
              Go to Dashboard
            </Link>
          ) : (
            <>
              <Link to="/signup" className="btn btn-primary btn-large">
                Get Started Free
              </Link>
              <Link to="/login" className="btn btn-secondary btn-large">
                Sign In
              </Link>
            </>
          )}
        </div>
        <p className="hero-note">No credit card required. No subscription.</p>
      </section>

      <section className="stats-banner">
        <div className="stat-item">
          <span className="stat-big">15+</span>
          <span className="stat-text">Languages Supported</span>
        </div>
        <div className="stat-item">
          <span className="stat-big">4</span>
          <span className="stat-text">Output Files Generated</span>
        </div>
        <div className="stat-item">
          <span className="stat-big">&lt;2min</span>
          <span className="stat-text">Average Processing</span>
        </div>
        <div className="stat-item">
          <span className="stat-big">Free</span>
          <span className="stat-text">No Limits</span>
        </div>
      </section>

      <section className="how-it-works">
        <h2>How It Works</h2>
        <p className="section-subtitle">Three steps. That's it.</p>
        <div className="steps">
          <div className="step">
            <div className="step-number">1</div>
            <h3>Upload</h3>
            <p>Drag & drop a .zip file or paste any public GitHub repository URL.</p>
          </div>
          <div className="step">
            <div className="step-icon">&#9889;</div>
            <div className="step-number">2</div>
            <h3>AI Analyzes</h3>
            <p>
              LLaMA-3 reads every file, understands your architecture, and generates
              comprehensive documentation.
            </p>
          </div>
          <div className="step">
            <div className="step-number">3</div>
            <h3>Download</h3>
            <p>
              Get a zip with README, API docs, commented source files, and a quality
              report. Or get it via email.
            </p>
          </div>
        </div>
      </section>

      <section className="features">
        <h2>What You Get</h2>
        <p className="section-subtitle">A complete documentation package, instantly.</p>
        <div className="feature-grid">
          <div className="feature-card">
            <div className="feature-icon">&#128196;</div>
            <h3>README.md</h3>
            <p>Project overview, tech stack, setup instructions, usage examples — ready to commit.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">&#128218;</div>
            <h3>API_DOCS.md</h3>
            <p>Every function documented with parameters, return types, and descriptions.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">&#128172;</div>
            <h3>Inline Comments</h3>
            <p>Your original code files returned with helpful comments explaining the WHY, not the WHAT.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">&#128200;</div>
            <h3>Quality Scorecard</h3>
            <p>Complexity score, issues found, quick wins, and security concerns — with a letter grade.</p>
          </div>
        </div>
      </section>

      <section className="sample-output">
        <h2>Sample Output</h2>
        <p className="section-subtitle">Here's what Documantic generates for a Flask API project.</p>
        <div className="sample-box">
          <pre>{`# Task Manager API

## Overview
A RESTful API for managing tasks and projects, built with Flask.

## Technologies
- Python 3.12, Flask, SQLAlchemy
- SQLite (dev), PostgreSQL (prod)

## Setup
\`\`\`bash
pip install -r requirements.txt
flask run
\`\`\`

## API Endpoints
| Method | Path           | Description        |
|--------|----------------|--------------------|
| GET    | /tasks         | List all tasks     |
| POST   | /tasks         | Create a task      |
| PUT    | /tasks/:id     | Update a task      |
| DELETE | /tasks/:id     | Delete a task      |

## Quality Score: 78/100 (B — Good)
- Low complexity across most modules
- Missing input validation on POST /tasks
- No rate limiting on public endpoints`}</pre>
        </div>
        <Link to="/examples" className="btn btn-secondary">
          See More Examples
        </Link>
      </section>

      <section className="cta-section">
        <h2>Ready to generate docs?</h2>
        <p>Upload your code and get documentation in under 2 minutes.</p>
        {isAuthenticated ? (
          <Link to="/tool" className="btn btn-primary btn-large">
            Generate Now
          </Link>
        ) : (
          <Link to="/signup" className="btn btn-primary btn-large">
            Create Free Account
          </Link>
        )}
      </section>
    </div>
  );
};

export default Landing;
