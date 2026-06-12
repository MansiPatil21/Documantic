import React, { useState } from "react";

interface Example {
  title: string;
  language: string;
  description: string;
  readme: string;
  apiDocs: string;
  qualityScore: number;
}

const EXAMPLES: Example[] = [
  {
    title: "Flask REST API",
    language: "Python",
    description: "A task management REST API built with Flask and SQLAlchemy.",
    readme: `# Task Manager API

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

## Endpoints
| Method | Path            | Description         |
|--------|----------------|---------------------|
| GET    | /tasks         | List all tasks      |
| POST   | /tasks         | Create a task       |
| PUT    | /tasks/:id     | Update a task       |
| DELETE | /tasks/:id     | Delete a task       |`,
    apiDocs: `# API Documentation

## \`create_task(title, description, priority)\`
Creates a new task in the database.
- **Parameters:**
  - \`title\` (str): Task title, required
  - \`description\` (str): Task details, optional
  - \`priority\` (int): 1-5, default 3
- **Returns:** Task object with generated ID
- **Raises:** ValueError if title is empty

## \`get_tasks(status, page, limit)\`
Retrieves tasks with optional filtering.
- **Parameters:**
  - \`status\` (str): Filter by "pending", "done", or "all"
  - \`page\` (int): Page number, default 1
  - \`limit\` (int): Items per page, default 20
- **Returns:** Paginated list of Task objects`,
    qualityScore: 78,
  },
  {
    title: "React E-Commerce UI",
    language: "TypeScript",
    description:
      "A React-based shopping cart frontend with state management.",
    readme: `# ShopFront

## Overview
A modern e-commerce frontend built with React and TypeScript.

## Technologies
- React 18, TypeScript, Zustand
- Tailwind CSS, React Router
- Axios for API calls

## Setup
\`\`\`bash
npm install
npm run dev
\`\`\`

## Features
- Product catalog with search and filters
- Shopping cart with quantity management
- Responsive design for mobile and desktop`,
    apiDocs: `# Component API

## \`<ProductCard product={product} onAddToCart={fn} />\`
Renders a single product card.
- **Props:**
  - \`product\` (Product): Product data object
  - \`onAddToCart\` (fn): Callback when "Add to Cart" is clicked

## \`useCart()\`
Custom hook for cart state management.
- **Returns:**
  - \`items\` (CartItem[]): Current cart items
  - \`addItem(product, qty)\`: Add item to cart
  - \`removeItem(id)\`: Remove item by ID
  - \`total\` (number): Cart total price`,
    qualityScore: 85,
  },
  {
    title: "Node.js CLI Tool",
    language: "JavaScript",
    description: "A command-line tool for bulk image resizing and optimization.",
    readme: `# ImgShrink

## Overview
A fast CLI tool for batch image resizing and optimization.

## Installation
\`\`\`bash
npm install -g imgshrink
\`\`\`

## Usage
\`\`\`bash
imgshrink ./photos --width 800 --quality 80 --format webp
imgshrink ./input -o ./output --recursive
\`\`\`

## Options
| Flag        | Description              | Default |
|-------------|--------------------------|---------|
| --width     | Max width in pixels      | 1920    |
| --quality   | JPEG/WebP quality 1-100  | 85      |
| --format    | Output format            | same    |
| --recursive | Process subdirectories   | false   |`,
    apiDocs: `# Module API

## \`resizeImage(inputPath, options)\`
Resizes a single image file.
- **Parameters:**
  - \`inputPath\` (string): Path to source image
  - \`options.width\` (number): Target max width
  - \`options.quality\` (number): Output quality 1-100
  - \`options.format\` (string): "jpeg", "png", "webp"
- **Returns:** Promise<Buffer> — processed image data

## \`processDirectory(dirPath, options)\`
Batch processes all images in a directory.
- **Parameters:**
  - \`dirPath\` (string): Directory to scan
  - \`options.recursive\` (boolean): Include subdirs
- **Returns:** Promise<ProcessResult[]>`,
    qualityScore: 72,
  },
];

const Examples: React.FC = () => {
  const [selected, setSelected] = useState(0);
  const [tab, setTab] = useState<"readme" | "api" | "quality">("readme");
  const example = EXAMPLES[selected];

  return (
    <div className="examples-page">
      <h1>Example Outputs</h1>
      <p className="examples-desc">
        See what Documantic generates for real projects. These are pre-generated
        examples so you can evaluate the output quality before uploading your
        own code.
      </p>

      <div className="example-selector">
        {EXAMPLES.map((ex, i) => (
          <button
            key={i}
            className={`example-btn ${selected === i ? "active" : ""}`}
            onClick={() => {
              setSelected(i);
              setTab("readme");
            }}
          >
            <span className="lang-badge">{ex.language}</span>
            <span>{ex.title}</span>
          </button>
        ))}
      </div>

      <div className="example-detail">
        <h2>{example.title}</h2>
        <p>{example.description}</p>

        <div className="tab-bar">
          <button
            className={`tab ${tab === "readme" ? "active" : ""}`}
            onClick={() => setTab("readme")}
          >
            README.md
          </button>
          <button
            className={`tab ${tab === "api" ? "active" : ""}`}
            onClick={() => setTab("api")}
          >
            API_DOCS.md
          </button>
          <button
            className={`tab ${tab === "quality" ? "active" : ""}`}
            onClick={() => setTab("quality")}
          >
            Quality Score
          </button>
        </div>

        <div className="example-output">
          {tab === "readme" && <pre>{example.readme}</pre>}
          {tab === "api" && <pre>{example.apiDocs}</pre>}
          {tab === "quality" && (
            <div className="quality-display">
              <div className="score-circle">
                <span className="score-number">{example.qualityScore}</span>
                <span className="score-label">/100</span>
              </div>
              <p className="score-grade">
                Grade:{" "}
                {example.qualityScore >= 80
                  ? "A — Excellent"
                  : example.qualityScore >= 60
                  ? "B — Good"
                  : "C — Needs Work"}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Examples;
