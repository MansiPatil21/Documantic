"""
Processor Lambda — Triggered by S3 ObjectCreated event on uploads/*.zip
Pipeline: unzip → read files → Groq AI (LLaMA-3) → generate docs → save output zip → update DynamoDB
"""
import json
import os
import io
import zipfile
import time
import logging
import urllib.request
import urllib.error

import boto3

logger = logging.getLogger()
logger.setLevel(logging.INFO)

# ── Config ────────────────────────────────────────────────────────────────────
STORAGE_BUCKET = os.environ["STORAGE_BUCKET"]
DYNAMODB_TABLE = os.environ["DYNAMODB_TABLE"]
REGION = os.environ.get("AWS_REGION_NAME", "us-east-1")
SECRET_NAME = os.environ.get("GROQ_SECRET_NAME", "")
SNS_TOPIC_ARN = os.environ.get("SNS_TOPIC_ARN", "")

s3 = boto3.client("s3", region_name=REGION)
dynamodb = boto3.resource("dynamodb", region_name=REGION)
sns = boto3.client("sns", region_name=REGION)
table = dynamodb.Table(DYNAMODB_TABLE)

# Fetch Groq API key from Secrets Manager (cached for Lambda warm starts)
_groq_api_key_cache = None

def get_groq_api_key():
    global _groq_api_key_cache
    if _groq_api_key_cache:
        return _groq_api_key_cache
    if SECRET_NAME:
        secrets = boto3.client("secretsmanager", region_name=REGION)
        resp = secrets.get_secret_value(SecretId=SECRET_NAME)
        _groq_api_key_cache = resp["SecretString"]
        logger.info("Loaded Groq API key from Secrets Manager")
    else:
        _groq_api_key_cache = os.environ.get("GROQ_API_KEY", "")
        logger.info("Using Groq API key from environment variable (fallback)")
    return _groq_api_key_cache

GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"
MODEL = "llama-3.3-70b-versatile"  # 12K TPM on free tier

CODE_EXTENSIONS = {
    ".py", ".js", ".ts", ".tsx", ".jsx", ".java", ".go", ".rb", ".rs",
    ".c", ".cpp", ".h", ".cs", ".php", ".swift", ".kt", ".scala",
    ".sql", ".sh", ".bash", ".yml", ".yaml", ".json", ".xml", ".html",
    ".css", ".md", ".txt", ".toml", ".cfg", ".ini", ".tf", ".hcl",
}

MAX_FILE_SIZE = 5000  # chars per file
MAX_TOTAL_CHARS = 15000  # total chars sent to AI (~3750 tokens, fits Groq 12K TPM limit)


# ── Helpers ───────────────────────────────────────────────────────────────────

def update_job_status(job_id, status, stage=None):
    expr = "SET #s = :s"
    names = {"#s": "status"}
    values = {":s": status}
    if stage:
        expr += ", progressStage = :stage"
        values[":stage"] = stage
    table.update_item(
        Key={"jobId": job_id},
        UpdateExpression=expr,
        ExpressionAttributeNames=names,
        ExpressionAttributeValues=values,
    )


def is_code_file(filename):
    name = filename.lower()
    _, ext = os.path.splitext(name)
    return ext in CODE_EXTENSIONS or name in {
        "dockerfile", "makefile", "rakefile", "gemfile", "procfile",
    }


def extract_code_files(zip_bytes):
    """Extract code files from a zip archive. Returns dict of {path: content}."""
    files = {}
    total_chars = 0
    with zipfile.ZipFile(io.BytesIO(zip_bytes)) as zf:
        for info in zf.infolist():
            if info.is_dir():
                continue
            if not is_code_file(info.filename):
                continue
            if info.file_size > MAX_FILE_SIZE * 2:
                continue
            try:
                content = zf.read(info.filename).decode("utf-8", errors="replace")
                if len(content) > MAX_FILE_SIZE:
                    content = content[:MAX_FILE_SIZE] + "\n... (truncated)"
                total_chars += len(content)
                if total_chars > MAX_TOTAL_CHARS:
                    break
                files[info.filename] = content
            except Exception as e:
                logger.warning("Skipping %s: %s", info.filename, e)
    return files


def detect_languages(files):
    """Detect programming languages from file extensions."""
    ext_to_lang = {
        ".py": "Python", ".js": "JavaScript", ".ts": "TypeScript",
        ".tsx": "TypeScript", ".jsx": "JavaScript", ".java": "Java",
        ".go": "Go", ".rb": "Ruby", ".rs": "Rust", ".c": "C",
        ".cpp": "C++", ".cs": "C#", ".php": "PHP", ".swift": "Swift",
        ".kt": "Kotlin", ".scala": "Scala", ".sql": "SQL",
        ".sh": "Shell", ".bash": "Shell", ".html": "HTML", ".css": "CSS",
        ".tf": "Terraform", ".hcl": "HCL",
    }
    langs = set()
    for path in files:
        _, ext = os.path.splitext(path.lower())
        if ext in ext_to_lang:
            langs.add(ext_to_lang[ext])
    return sorted(langs)


def call_groq(prompt, max_tokens=4096):
    """Call Groq API using urllib (no external deps needed in Lambda)."""
    payload = json.dumps({
        "model": MODEL,
        "messages": [{"role": "user", "content": prompt}],
        "max_tokens": max_tokens,
        "temperature": 0.3,
    }).encode("utf-8")

    req = urllib.request.Request(
        GROQ_API_URL,
        data=payload,
        headers={
            "Authorization": f"Bearer {get_groq_api_key()}",
            "Content-Type": "application/json",
            "User-Agent": "Documantic/1.0",
            "Accept": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            return data["choices"][0]["message"]["content"]
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")
        logger.error("Groq API error %s: %s", e.code, body)
        raise


def markdown_to_html(md_content, title="Documantic"):
    """Convert markdown text to a styled HTML page (no external deps)."""
    # Simple markdown-to-HTML conversion using basic regex
    import re
    html = md_content
    # Escape HTML entities first
    html = html.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    # Code blocks
    html = re.sub(r'```(\w*)\n(.*?)```', r'<pre><code>\2</code></pre>', html, flags=re.DOTALL)
    # Inline code
    html = re.sub(r'`([^`]+)`', r'<code>\1</code>', html)
    # Headers
    html = re.sub(r'^#### (.+)$', r'<h4>\1</h4>', html, flags=re.MULTILINE)
    html = re.sub(r'^### (.+)$', r'<h3>\1</h3>', html, flags=re.MULTILINE)
    html = re.sub(r'^## (.+)$', r'<h2>\1</h2>', html, flags=re.MULTILINE)
    html = re.sub(r'^# (.+)$', r'<h1>\1</h1>', html, flags=re.MULTILINE)
    # Bold and italic
    html = re.sub(r'\*\*(.+?)\*\*', r'<strong>\1</strong>', html)
    html = re.sub(r'\*(.+?)\*', r'<em>\1</em>', html)
    # List items
    html = re.sub(r'^- (.+)$', r'<li>\1</li>', html, flags=re.MULTILINE)
    # Line breaks for remaining lines
    html = re.sub(r'\n\n', '</p><p>', html)

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{title} — Documantic</title>
<style>
body {{ font-family: -apple-system, sans-serif; max-width: 800px; margin: 2rem auto; padding: 0 1rem; background: #0f172a; color: #e2e8f0; line-height: 1.7; }}
h1, h2, h3, h4 {{ color: #38bdf8; margin-top: 1.5rem; }}
pre {{ background: #1e293b; padding: 1rem; border-radius: 8px; overflow-x: auto; }}
code {{ background: #1e293b; padding: 0.2rem 0.4rem; border-radius: 4px; font-size: 0.9rem; }}
pre code {{ background: none; padding: 0; }}
li {{ margin: 0.3rem 0; }}
strong {{ color: #f1f5f9; }}
table {{ border-collapse: collapse; width: 100%; margin: 1rem 0; }}
th, td {{ border: 1px solid #334155; padding: 0.5rem; text-align: left; }}
th {{ background: #1e293b; }}
</style>
</head>
<body><p>{html}</p>
<footer style="margin-top:3rem;color:#64748b;font-size:0.85rem;">Generated by Documantic</footer>
</body></html>"""


def build_file_listing(files):
    """Build a formatted string of all code files for the AI prompt."""
    parts = []
    for path, content in files.items():
        parts.append(f"### File: {path}\n```\n{content}\n```\n")
    return "\n".join(parts)


# ── AI Generation Functions ───────────────────────────────────────────────────

def generate_readme(files, languages):
    file_listing = build_file_listing(files)
    lang_str = ", ".join(languages)
    prompt = f"""You are a senior developer writing documentation. Analyze the following codebase and generate a comprehensive README.md file.

Languages detected: {lang_str}

The README must include:
1. Project title and description (infer from the code)
2. Technologies used
3. Project structure overview
4. Setup and installation instructions
5. Usage examples
6. API endpoints (if any web framework is detected)
7. Configuration details (if any config files exist)

Source code:
{file_listing}

Output ONLY the README.md content in markdown format. No explanations before or after."""

    return call_groq(prompt, max_tokens=2048)


def generate_api_docs(files, languages):
    file_listing = build_file_listing(files)
    prompt = f"""You are a technical writer. Analyze the following source code and generate API documentation (API_DOCS.md).

For each function/method/class found, document:
- Name and signature
- Description of what it does
- Parameters with types and descriptions
- Return value

Group by file. Use markdown format with clear headers.

Source code:
{file_listing}

Output ONLY the API_DOCS.md content in markdown format. No explanations before or after."""

    return call_groq(prompt, max_tokens=2048)


def generate_quality_scorecard(files, languages):
    file_listing = build_file_listing(files)
    lang_str = ", ".join(languages)
    prompt = f"""You are a code quality analyst. Analyze the following codebase and produce a code quality scorecard (QUALITY_REPORT.md).

Languages: {lang_str}

Include these sections:
1. **Overall Score**: X/100 with letter grade
2. **Code Complexity**: Low/Medium/High with explanation
3. **Issues Found**: List specific issues
4. **Quick Wins**: Simple improvements
5. **Security Concerns**: Any potential security issues

Be specific — reference actual file names from the code.

Source code:
{file_listing}

Output ONLY the QUALITY_REPORT.md content in markdown format. No explanations before or after."""

    return call_groq(prompt, max_tokens=2048)


def generate_inline_comments(filepath, content):
    prompt = f"""Add helpful inline comments to this code file. Explain WHY not WHAT. Add docstrings to functions lacking them. Keep original code as-is.

File: {filepath}
```
{content}
```

Output ONLY the commented code. No markdown fences, no explanations."""

    return call_groq(prompt, max_tokens=2048)


# ── Main Handler ──────────────────────────────────────────────────────────────

def lambda_handler(event, context):
    logger.info("Processor Lambda invoked")
    logger.info(json.dumps(event))

    # Parse S3 event
    record = event["Records"][0]
    bucket = record["s3"]["bucket"]["name"]
    key = record["s3"]["object"]["key"]  # uploads/<jobId>/input.zip

    # Extract job ID from key
    parts = key.split("/")
    if len(parts) < 3:
        logger.error("Unexpected S3 key format: %s", key)
        return {"statusCode": 400, "body": "Invalid key format"}

    job_id = parts[1]
    logger.info("Processing job %s from s3://%s/%s", job_id, bucket, key)

    try:
        update_job_status(job_id, "processing", "extracting")

        # Download zip from S3
        response = s3.get_object(Bucket=bucket, Key=key)
        zip_bytes = response["Body"].read()

        # Extract code files
        files = extract_code_files(zip_bytes)
        if not files:
            update_job_status(job_id, "failed")
            logger.error("No code files found in zip")
            return {"statusCode": 400, "body": "No code files found"}

        languages = detect_languages(files)
        logger.info("Found %d files, languages: %s", len(files), languages)

        # Generate documentation using Groq AI (with delays for rate limiting)
        update_job_status(job_id, "processing", "generating_readme")
        logger.info("Generating README...")
        readme = generate_readme(files, languages)

        time.sleep(15)  # Rate limit: wait between calls
        update_job_status(job_id, "processing", "generating_api_docs")
        logger.info("Generating API docs...")
        api_docs = generate_api_docs(files, languages)

        time.sleep(15)
        update_job_status(job_id, "processing", "generating_quality")
        logger.info("Generating quality scorecard...")
        scorecard = generate_quality_scorecard(files, languages)

        # Generate inline comments for up to 3 key files
        commented_files = {}
        code_files = [(p, c) for p, c in files.items()
                      if os.path.splitext(p)[1] in {".py", ".js", ".ts", ".java", ".go", ".rb", ".rs"}]
        for filepath, content in code_files[:3]:
            time.sleep(15)
            update_job_status(job_id, "processing", "adding_comments")
            logger.info("Adding inline comments to %s", filepath)
            try:
                commented = generate_inline_comments(filepath, content)
                commented_files[filepath] = commented
            except Exception as e:
                logger.warning("Failed to comment %s: %s", filepath, e)
                commented_files[filepath] = content  # use original

        update_job_status(job_id, "processing", "packaging")

        # Get output format from DynamoDB
        job_record = table.get_item(Key={"jobId": job_id}).get("Item", {})
        output_format = job_record.get("outputFormat", "markdown")

        # Build output zip
        output_buffer = io.BytesIO()
        with zipfile.ZipFile(output_buffer, "w", zipfile.ZIP_DEFLATED) as zf:
            if output_format == "html":
                zf.writestr("README.html", markdown_to_html(readme, "README"))
                zf.writestr("API_DOCS.html", markdown_to_html(api_docs, "API Documentation"))
                zf.writestr("QUALITY_REPORT.html", markdown_to_html(scorecard, "Quality Report"))
            else:
                zf.writestr("README.md", readme)
                zf.writestr("API_DOCS.md", api_docs)
                zf.writestr("QUALITY_REPORT.md", scorecard)

            # Add commented source files
            for filepath, content in commented_files.items():
                zf.writestr(f"commented/{filepath}", content)

            # Add metadata
            metadata = {
                "jobId": job_id,
                "languages": languages,
                "filesProcessed": len(files),
                "generatedAt": int(time.time()),
                "outputFormat": output_format,
            }
            zf.writestr("metadata.json", json.dumps(metadata, indent=2))

        # Upload output zip to S3
        output_key = f"outputs/{job_id}/output.zip"
        output_buffer.seek(0)
        s3.put_object(
            Bucket=STORAGE_BUCKET,
            Key=output_key,
            Body=output_buffer.getvalue(),
            ContentType="application/zip",
        )
        logger.info("Output saved to s3://%s/%s", STORAGE_BUCKET, output_key)

        # Truncate docs for DynamoDB preview (max 400KB per item)
        def truncate(text, max_len=20000):
            return text[:max_len] if len(text) > max_len else text

        # Update job status to complete with doc previews
        table.update_item(
            Key={"jobId": job_id},
            UpdateExpression="SET #s = :s, languagesDetected = :l, filesProcessed = :f, completedAt = :c, progressStage = :ps, readmeContent = :rc, apiDocsContent = :ac, qualityContent = :qc",
            ExpressionAttributeNames={"#s": "status"},
            ExpressionAttributeValues={
                ":s": "complete",
                ":l": languages,
                ":f": len(files),
                ":c": int(time.time()),
                ":ps": "complete",
                ":rc": truncate(readme),
                ":ac": truncate(api_docs),
                ":qc": truncate(scorecard),
            },
        )

        logger.info("Job %s complete!", job_id)

        # Publish completion notification to SNS
        if SNS_TOPIC_ARN:
            try:
                job_record = table.get_item(Key={"jobId": job_id}).get("Item", {})
                user_email = job_record.get("userEmail", job_record.get("email", ""))
                sns.publish(
                    TopicArn=SNS_TOPIC_ARN,
                    Subject=f"Documantic: Documentation Ready - {job_id[:8]}",
                    Message=json.dumps({
                        "jobId": job_id,
                        "status": "complete",
                        "languages": languages,
                        "filesProcessed": len(files),
                        "userEmail": user_email,
                    }),
                )
                logger.info("SNS notification published for job %s", job_id)
            except Exception as sns_err:
                logger.warning("SNS publish failed (non-critical): %s", sns_err)

        return {"statusCode": 200, "body": f"Job {job_id} complete"}

    except Exception as e:
        logger.error("Job %s failed: %s", job_id, e)
        update_job_status(job_id, "failed")
        raise
