import os
import re
import uuid
import time
import shutil
import tempfile
import zipfile
import logging

from fastapi import FastAPI, File, UploadFile, Form, HTTPException, Depends, Header
from fastapi.responses import Response
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import boto3
import git
import bcrypt
import jwt

load_dotenv()

# ── Config ────────────────────────────────────────────────────────────────────
STORAGE_BUCKET = os.getenv("STORAGE_BUCKET_NAME")
DYNAMODB_TABLE = os.getenv("DYNAMODB_TABLE_NAME")
USERS_TABLE = os.getenv("USERS_TABLE_NAME")
JWT_SECRET = os.getenv("JWT_SECRET", "documantic-default-secret")
REGION = os.getenv("AWS_DEFAULT_REGION", "us-east-1")

s3 = boto3.client("s3", region_name=REGION)
dynamodb = boto3.resource("dynamodb", region_name=REGION)
table = dynamodb.Table(DYNAMODB_TABLE)
users_table = dynamodb.Table(USERS_TABLE)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("codedoc")

ALLOWED_EXTENSIONS = {
    ".py", ".js", ".ts", ".tsx", ".jsx", ".java", ".go", ".rb", ".rs",
    ".c", ".cpp", ".h", ".cs", ".php", ".swift", ".kt", ".scala",
    ".sql", ".sh", ".bash", ".yml", ".yaml", ".json", ".xml", ".html",
    ".css", ".md", ".txt", ".toml", ".cfg", ".ini", ".env.example",
    ".dockerfile", ".tf", ".hcl",
}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB

EXPIRY_HOURS = 48

app = FastAPI(title="Documantic API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Helpers ───────────────────────────────────────────────────────────────────

def _create_job(job_id: str, email: str | None, output_format: str) -> dict:
    """Create a DynamoDB job record and return it."""
    now = int(time.time())
    item = {
        "jobId": job_id,
        "status": "uploading",
        "createdAt": now,
        "expiry": now + EXPIRY_HOURS * 3600,
        "inputKey": f"uploads/{job_id}/input.zip",
        "outputKey": f"outputs/{job_id}/output.zip",
        "outputFormat": output_format,
    }
    if email:
        item["email"] = email
    table.put_item(Item=item)
    return item


def _upload_to_s3(local_path: str, s3_key: str) -> None:
    """Upload a local file to the storage bucket."""
    s3.upload_file(local_path, STORAGE_BUCKET, s3_key)
    logger.info("Uploaded %s → s3://%s/%s", local_path, STORAGE_BUCKET, s3_key)


def _update_job_status(job_id: str, status: str) -> None:
    """Update job status in DynamoDB."""
    table.update_item(
        Key={"jobId": job_id},
        UpdateExpression="SET #s = :s",
        ExpressionAttributeNames={"#s": "status"},
        ExpressionAttributeValues={":s": status},
    )


def _is_valid_file(filename: str) -> bool:
    """Check if a file extension is in the allowed list."""
    _, ext = os.path.splitext(filename.lower())
    return ext in ALLOWED_EXTENSIONS or filename.lower() in {
        "dockerfile", "makefile", "rakefile", "gemfile", "procfile",
    }


def _zip_directory(source_dir: str, output_path: str) -> None:
    """Zip a directory, including only code files."""
    with zipfile.ZipFile(output_path, "w", zipfile.ZIP_DEFLATED) as zf:
        for root, _, files in os.walk(source_dir):
            for f in files:
                full = os.path.join(root, f)
                arcname = os.path.relpath(full, source_dir)
                if _is_valid_file(f):
                    zf.write(full, arcname)


# ── Auth Helpers ──────────────────────────────────────────────────────────────

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode(), hashed.encode())


def create_token(email: str, name: str) -> str:
    return jwt.encode(
        {"email": email, "name": name, "exp": int(time.time()) + 86400},
        JWT_SECRET,
        algorithm="HS256",
    )


def get_current_user(authorization: str | None = Header(None)) -> dict | None:
    """Extract user from JWT token. Returns None if no valid token."""
    if not authorization or not authorization.startswith("Bearer "):
        return None
    token = authorization.split(" ")[1]
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
        return {"email": payload["email"], "name": payload["name"]}
    except (jwt.ExpiredSignatureError, jwt.InvalidTokenError):
        return None


def require_auth(authorization: str | None = Header(None)) -> dict:
    """Require a valid JWT token. Raises 401 if missing/invalid."""
    user = get_current_user(authorization)
    if not user:
        raise HTTPException(401, "Not authenticated")
    return user


# ── Routes ────────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {"status": "ok", "service": "documantic-backend"}


@app.post("/auth/signup")
def signup(
    email: str = Form(...),
    password: str = Form(...),
    name: str = Form(...),
):
    """Create a new user account."""
    if len(password) < 6:
        raise HTTPException(400, "Password must be at least 6 characters")

    # Check if user exists
    existing = users_table.get_item(Key={"email": email}).get("Item")
    if existing:
        raise HTTPException(409, "Email already registered")

    users_table.put_item(Item={
        "email": email,
        "name": name,
        "password": hash_password(password),
        "createdAt": int(time.time()),
    })

    token = create_token(email, name)
    return {"token": token, "user": {"email": email, "name": name}}


@app.post("/auth/login")
def login(
    email: str = Form(...),
    password: str = Form(...),
):
    """Login with email and password."""
    item = users_table.get_item(Key={"email": email}).get("Item")
    if not item or not verify_password(password, item["password"]):
        raise HTTPException(401, "Invalid email or password")

    token = create_token(email, item["name"])
    return {"token": token, "user": {"email": email, "name": item["name"]}}


@app.get("/auth/me")
def get_me(user: dict = Depends(require_auth)):
    """Get current user info."""
    return {"user": user}


@app.get("/dashboard/jobs")
def get_user_jobs(user: dict = Depends(require_auth)):
    """Get all jobs for the authenticated user."""
    # Scan for jobs belonging to this user
    response = table.scan(
        FilterExpression="userEmail = :email",
        ExpressionAttributeValues={":email": user["email"]},
    )
    jobs = sorted(response.get("Items", []), key=lambda x: x.get("createdAt", 0), reverse=True)
    return {"jobs": [
        {
            "jobId": j["jobId"],
            "status": j.get("status", "unknown"),
            "createdAt": int(j.get("createdAt", 0)),
            "languagesDetected": j.get("languagesDetected", []),
            "filesProcessed": int(j.get("filesProcessed", 0)),
        }
        for j in jobs[:20]
    ]}


@app.post("/upload")
async def upload_zip(
    file: UploadFile = File(...),
    email: str | None = Form(None),
    output_format: str = Form("markdown"),
    authorization: str | None = Header(None),
):
    """Accept a zip file upload, store in S3, create a job."""
    if not file.filename.endswith(".zip"):
        raise HTTPException(400, "Only .zip files are accepted")

    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(400, f"File too large. Max {MAX_FILE_SIZE // (1024*1024)} MB")

    job_id = str(uuid.uuid4())
    s3_key = f"uploads/{job_id}/input.zip"

    try:
        # Write to temp file, then upload to S3
        with tempfile.NamedTemporaryFile(suffix=".zip", delete=False) as tmp:
            tmp.write(content)
            tmp_path = tmp.name

        _create_job(job_id, email, output_format)
        # Tag job with user email if authenticated
        user = get_current_user(authorization)
        if user:
            table.update_item(
                Key={"jobId": job_id},
                UpdateExpression="SET userEmail = :e",
                ExpressionAttributeValues={":e": user["email"]},
            )
        _upload_to_s3(tmp_path, s3_key)
        _update_job_status(job_id, "processing")

        return {"jobId": job_id, "status": "processing"}

    except Exception as e:
        logger.error("Upload failed: %s", e)
        raise HTTPException(500, "Upload failed") from e
    finally:
        if os.path.exists(tmp_path):
            os.unlink(tmp_path)


@app.post("/github")
async def clone_github(
    url: str = Form(...),
    email: str | None = Form(None),
    output_format: str = Form("markdown"),
    authorization: str | None = Header(None),
):
    """Clone a GitHub repo, zip it, store in S3, create a job."""
    if not url.startswith("https://github.com/"):
        raise HTTPException(400, "Only public GitHub HTTPS URLs are supported")

    job_id = str(uuid.uuid4())
    tmp_dir = tempfile.mkdtemp()
    clone_dir = os.path.join(tmp_dir, "repo")
    zip_path = os.path.join(tmp_dir, "input.zip")

    try:
        # Clone the repo
        logger.info("Cloning %s", url)
        git.Repo.clone_from(url, clone_dir, depth=1)

        # Remove .git directory to save space
        git_dir = os.path.join(clone_dir, ".git")
        if os.path.exists(git_dir):
            shutil.rmtree(git_dir)

        # Zip only code files
        _zip_directory(clone_dir, zip_path)

        zip_size = os.path.getsize(zip_path)
        if zip_size > MAX_FILE_SIZE:
            raise HTTPException(400, f"Repo too large after zipping ({zip_size // (1024*1024)} MB). Max {MAX_FILE_SIZE // (1024*1024)} MB")

        s3_key = f"uploads/{job_id}/input.zip"
        _create_job(job_id, email, output_format)
        # Tag job with user email if authenticated
        user = get_current_user(authorization)
        if user:
            table.update_item(
                Key={"jobId": job_id},
                UpdateExpression="SET userEmail = :e",
                ExpressionAttributeValues={":e": user["email"]},
            )
        _upload_to_s3(zip_path, s3_key)
        _update_job_status(job_id, "processing")

        return {"jobId": job_id, "status": "processing"}

    except git.exc.GitCommandError as e:
        logger.error("Git clone failed: %s", e)
        raise HTTPException(400, "Failed to clone repository. Is it public?") from e
    except HTTPException:
        raise
    except Exception as e:
        logger.error("GitHub processing failed: %s", e)
        raise HTTPException(500, "Processing failed") from e
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)


@app.get("/jobs/{job_id}")
def get_job_status(job_id: str):
    """Get job status from DynamoDB."""
    resp = table.get_item(Key={"jobId": job_id})
    item = resp.get("Item")
    if not item:
        raise HTTPException(404, "Job not found")
    return {
        "jobId": item["jobId"],
        "status": item["status"],
        "createdAt": int(item.get("createdAt", 0)),
        "outputFormat": item.get("outputFormat", "markdown"),
    }


@app.get("/jobs/{job_id}/download")
def get_download_url(job_id: str):
    """Generate a presigned S3 download URL for the output zip."""
    resp = table.get_item(Key={"jobId": job_id})
    item = resp.get("Item")
    if not item:
        raise HTTPException(404, "Job not found")
    if item["status"] != "complete":
        raise HTTPException(400, f"Job is not complete yet. Current status: {item['status']}")

    url = s3.generate_presigned_url(
        "get_object",
        Params={"Bucket": STORAGE_BUCKET, "Key": item["outputKey"]},
        ExpiresIn=3600,
    )
    return {"jobId": job_id, "downloadUrl": url}


def _parse_quality_score(quality_content: str) -> tuple[int, str]:
    """Extract score and grade from AI-generated quality report text."""
    score = 0
    grade = "?"

    # Try patterns like "85/100", "Score: 85", "Overall Score: 85/100"
    score_match = re.search(r'(\d{1,3})\s*/\s*100', quality_content)
    if score_match:
        score = min(int(score_match.group(1)), 100)

    # Try patterns like "Grade: A", "Letter Grade: B+", "A+"
    grade_match = re.search(r'(?:grade|letter)[:\s]*([A-F][+-]?)', quality_content, re.IGNORECASE)
    if grade_match:
        grade = grade_match.group(1).upper()
    elif score > 0:
        # Derive grade from score if not found
        if score >= 90: grade = "A"
        elif score >= 80: grade = "B"
        elif score >= 70: grade = "C"
        elif score >= 60: grade = "D"
        else: grade = "F"

    return score, grade


def _generate_badge_svg(score: int, grade: str, status: str) -> str:
    """Generate a shields.io-style SVG badge."""
    if status != "complete":
        color = "#6b7280"
        right_text = "pending"
        right_width = 62
    else:
        # Color based on grade
        grade_colors = {
            "A+": "#16a34a", "A": "#22c55e", "A-": "#4ade80",
            "B+": "#2563eb", "B": "#3b82f6", "B-": "#60a5fa",
            "C+": "#d97706", "C": "#f59e0b", "C-": "#fbbf24",
            "D+": "#dc2626", "D": "#ef4444", "D-": "#f87171",
            "F": "#991b1b",
        }
        color = grade_colors.get(grade, "#6b7280")
        right_text = f"{grade} · {score}/100"
        right_width = 82

    left_text = "CodeDoc"
    left_width = 62
    total_width = left_width + right_width

    return f"""<svg xmlns="http://www.w3.org/2000/svg" width="{total_width}" height="20" role="img" aria-label="CodeDoc: {right_text}">
  <title>CodeDoc: {right_text}</title>
  <linearGradient id="s" x2="0" y2="100%">
    <stop offset="0" stop-color="#bbb" stop-opacity=".1"/>
    <stop offset="1" stop-opacity=".1"/>
  </linearGradient>
  <clipPath id="r"><rect width="{total_width}" height="20" rx="3" fill="#fff"/></clipPath>
  <g clip-path="url(#r)">
    <rect width="{left_width}" height="20" fill="#555"/>
    <rect x="{left_width}" width="{right_width}" height="20" fill="{color}"/>
    <rect width="{total_width}" height="20" fill="url(#s)"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" text-rendering="geometricPrecision" font-size="11">
    <text aria-hidden="true" x="{left_width / 2}" y="15" fill="#010101" fill-opacity=".3">{left_text}</text>
    <text x="{left_width / 2}" y="14">{left_text}</text>
    <text aria-hidden="true" x="{left_width + right_width / 2}" y="15" fill="#010101" fill-opacity=".3">{right_text}</text>
    <text x="{left_width + right_width / 2}" y="14">{right_text}</text>
  </g>
</svg>"""


@app.get("/badge/{job_id}")
def get_badge(job_id: str):
    """Generate a shields.io-style SVG badge showing code quality score."""
    resp = table.get_item(Key={"jobId": job_id})
    item = resp.get("Item")
    if not item:
        svg = _generate_badge_svg(0, "?", "not_found")
        return Response(content=svg, media_type="image/svg+xml")

    status = item.get("status", "unknown")
    score, grade = 0, "?"

    if status == "complete" and item.get("qualityContent"):
        score, grade = _parse_quality_score(item["qualityContent"])

    svg = _generate_badge_svg(score, grade, status)
    return Response(
        content=svg,
        media_type="image/svg+xml",
        headers={"Cache-Control": "no-cache, max-age=300"},
    )


@app.get("/metrics")
def get_metrics():
    """
    Retrieve platform metrics. 
    (In a normal AWS environment, this would use CloudWatch get_metric_data. 
    Due to AWS Academy IAM LabRole restrictions blocking cloudwatch:GetMetricData, 
    we aggregate these metrics directly from the DynamoDB jobs table).
    """
    try:
        # Scan the table (acceptable for demo/lab scales under 1000 items)
        response = table.scan(
            ProjectionExpression="#s, createdAt, completedAt",
            ExpressionAttributeNames={"#s": "status"}
        )
        items = response.get("Item", response.get("Items", []))
        
        # Handle pagination if table gets slightly larger
        while 'LastEvaluatedKey' in response:
            response = table.scan(
                ProjectionExpression="#s, createdAt, completedAt",
                ExpressionAttributeNames={"#s": "status"},
                ExclusiveStartKey=response['LastEvaluatedKey']
            )
            items.extend(response.get("Items", []))

        total_invocations = len(items)
        errors = sum(1 for item in items if item.get("status") == "failed")
        
        # Calculate dynamic success rate
        success_rate = 100.0
        if total_invocations > 0:
            success_rate = ((total_invocations - errors) / total_invocations) * 100.0

        # Calculate average duration for completed jobs
        durations = []
        for item in items:
            if item.get("status") == "complete":
                created = item.get("createdAt")
                completed = item.get("completedAt")
                if created and completed and completed > created:
                    durations.append(float(completed) - float(created))
        
        avg_duration = 0.0
        if durations:
            avg_duration = sum(durations) / len(durations)
        # If no completions yet, fall back to a reasonable estimate or 0
        elif total_invocations > 0:
            avg_duration = 85.0

        return {
            "totalProcessed": total_invocations,
            "successRate": round(success_rate, 1),
            "avgDurationSeconds": round(avg_duration, 1),
        }
    except Exception as e:
        logger.error(f"Failed to aggregate stats from DynamoDB: {e}")
        return {
            "totalProcessed": 0,
            "successRate": 100.0,
            "avgDurationSeconds": 0.0,
            "error": "Failed to aggregate metrics natively."
        }
