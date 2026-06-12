#!/bin/bash
# One-command deploy for Documantic
# Usage: ./deploy_all.sh

set -e

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
PEM_KEY=~/Downloads/labsuser.pem

echo "========================================="
echo "  Documantic — Full Deploy"
echo "========================================="

# ── Pre-check: AWS credentials ──────────────
echo ""
echo "==> [0/5] Checking AWS credentials..."
if ! aws sts get-caller-identity &>/dev/null; then
    echo "ERROR: AWS credentials are invalid or expired."
    echo "Run: nano ~/.aws/credentials"
    echo "Paste 3 lines from AWS Academy → AWS Details → AWS CLI: Show"
    exit 1
fi
echo "    Credentials OK"

# ── Pre-check: PEM key ──────────────────────
if [ ! -f "$PEM_KEY" ]; then
    echo "ERROR: PEM key not found at $PEM_KEY"
    echo "Download from AWS Academy → AWS Details → Download PEM"
    exit 1
fi
chmod 400 "$PEM_KEY"

# ── Step 1: Terraform ─────────────────────────
echo ""
echo "==> [1/5] Running Terraform..."
cd "$PROJECT_DIR/terraform"
terraform init -input=false > /dev/null 2>&1
terraform apply -auto-approve

# Extract outputs
EC2_IP=$(terraform output -raw ec2_public_ip)
FRONTEND_BUCKET=$(terraform output -raw frontend_bucket_name)
FRONTEND_URL=$(terraform output -raw frontend_url)
API_GW_URL=$(terraform output -raw api_gateway_url)

echo "    EC2 IP: $EC2_IP"
echo "    Frontend Bucket: $FRONTEND_BUCKET"

# ── Step 2: Wait for EC2 to be ready ─────────
echo ""
echo "==> [2/5] Waiting for EC2 to accept SSH..."
MAX_RETRIES=20
for i in $(seq 1 $MAX_RETRIES); do
    if ssh -o StrictHostKeyChecking=no -o ConnectTimeout=5 -i "$PEM_KEY" ubuntu@"$EC2_IP" "echo ok" > /dev/null 2>&1; then
        echo "    EC2 is ready!"
        break
    fi
    if [ "$i" -eq "$MAX_RETRIES" ]; then
        echo "    ERROR: EC2 not reachable after $MAX_RETRIES attempts"
        exit 1
    fi
    echo "    Retry $i/$MAX_RETRIES..."
    sleep 10
done

# ── Step 3: Deploy backend ───────────────────
echo ""
echo "==> [3/5] Deploying backend to EC2..."
cd "$PROJECT_DIR/backend"
SSH_OPTS="-o StrictHostKeyChecking=no -i $PEM_KEY"

scp $SSH_OPTS main.py requirements.txt ubuntu@"${EC2_IP}":/tmp/

ssh $SSH_OPTS ubuntu@"${EC2_IP}" << REMOTE
sudo cp /tmp/main.py /opt/codedoc/main.py
sudo cp /tmp/requirements.txt /opt/codedoc/requirements.txt
sudo chown ubuntu:ubuntu /opt/codedoc/main.py /opt/codedoc/requirements.txt
/opt/codedoc/venv/bin/pip install -q -r /opt/codedoc/requirements.txt
# Ensure .env has all required variables
grep -q "USERS_TABLE_NAME" /opt/codedoc/.env || echo "USERS_TABLE_NAME=codedoc-9849928f-users" >> /opt/codedoc/.env
grep -q "JWT_SECRET" /opt/codedoc/.env || echo "JWT_SECRET=codedoc-secret-2026" >> /opt/codedoc/.env
sudo systemctl restart codedoc
REMOTE

# Verify backend health
sleep 3
if curl -sf "http://${EC2_IP}:8000/health" > /dev/null; then
    echo "    Backend is healthy!"
else
    echo "    WARNING: Backend health check failed (may need a moment)"
fi

# ── Step 4: Build frontend with correct EC2 IP ─
echo ""
echo "==> [4/5] Building frontend..."
cd "$PROJECT_DIR/frontend"

# Update hardcoded EC2 IP in source files
sed -i '' "s|http://[0-9.]*:8000|http://${EC2_IP}:8000|g" src/services/api.ts src/services/auth.ts

REACT_APP_EC2_URL="http://${EC2_IP}:8000" \
REACT_APP_API_GW_URL="$API_GW_URL" \
npm run build 2>&1 | tail -1

# ── Step 5: Deploy frontend to S3 ───────────
echo ""
echo "==> [5/5] Deploying frontend to S3..."
aws s3 sync build/ "s3://${FRONTEND_BUCKET}" --delete --quiet
echo "    Frontend deployed"

echo ""
echo "========================================="
echo "  Deployment Complete!"
echo "========================================="
echo ""
echo "  Frontend:  $FRONTEND_URL"
echo "  Backend:   http://${EC2_IP}:8000"
echo "  API GW:    $API_GW_URL"
echo ""
echo "========================================="
