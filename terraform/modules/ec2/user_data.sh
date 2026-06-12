#!/bin/bash
set -e

# ── System setup ──────────────────────────────────────────────────────────────
apt-get update -y
apt-get install -y python3 python3-pip python3-venv git unzip curl

# ── App directory ─────────────────────────────────────────────────────────────
mkdir -p /opt/codedoc
cd /opt/codedoc

# ── Environment file (values injected by Terraform templatefile) ──────────────
cat > /opt/codedoc/.env << EOF
STORAGE_BUCKET_NAME=${storage_bucket_name}
DYNAMODB_TABLE_NAME=${dynamodb_table_name}
USERS_TABLE_NAME=${users_table_name}
API_GATEWAY_URL=${api_gateway_url}
AWS_DEFAULT_REGION=us-east-1
JWT_SECRET=codedoc-secret-$(date +%s)
EOF

# ── Python virtual environment ────────────────────────────────────────────────
python3 -m venv /opt/codedoc/venv
/opt/codedoc/venv/bin/pip install --upgrade pip
/opt/codedoc/venv/bin/pip install \
  fastapi \
  "uvicorn[standard]" \
  boto3 \
  python-multipart \
  requests \
  gitpython \
  python-dotenv \
  aiofiles \
  pyjwt \
  bcrypt

# ── Placeholder FastAPI app (replaced when backend code is deployed) ──────────
cat > /opt/codedoc/main.py << 'PYEOF'
from fastapi import FastAPI

app = FastAPI(title="Documantic API", version="1.0.0")

@app.get("/health")
def health():
    return {"status": "ok", "service": "documantic-backend"}
PYEOF

# ── Systemd service ───────────────────────────────────────────────────────────
cat > /etc/systemd/system/codedoc.service << 'SVCEOF'
[Unit]
Description=Documantic FastAPI Backend
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/opt/codedoc
EnvironmentFile=/opt/codedoc/.env
ExecStart=/opt/codedoc/venv/bin/uvicorn main:app --host 0.0.0.0 --port 8000
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
SVCEOF

# ── Fix ownership and start service ──────────────────────────────────────────
chown -R ubuntu:ubuntu /opt/codedoc
systemctl daemon-reload
systemctl enable codedoc
systemctl start codedoc
