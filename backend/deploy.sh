#!/bin/bash
# Deploy backend code to EC2 instance
# Usage: ./deploy.sh <EC2_PUBLIC_IP> <PATH_TO_PEM_KEY>

set -e

EC2_IP="${1:?Usage: ./deploy.sh <EC2_IP> <PEM_KEY_PATH>}"
PEM_KEY="${2:?Usage: ./deploy.sh <EC2_IP> <PEM_KEY_PATH>}"
REMOTE_DIR="/opt/codedoc"
SSH_OPTS="-o StrictHostKeyChecking=no -i $PEM_KEY"

echo "==> Uploading backend code to $EC2_IP..."
scp $SSH_OPTS main.py requirements.txt ubuntu@${EC2_IP}:/tmp/

echo "==> Installing on EC2..."
ssh $SSH_OPTS ubuntu@${EC2_IP} << 'REMOTE'
sudo cp /tmp/main.py /opt/codedoc/main.py
sudo cp /tmp/requirements.txt /opt/codedoc/requirements.txt
sudo chown ubuntu:ubuntu /opt/codedoc/main.py /opt/codedoc/requirements.txt
/opt/codedoc/venv/bin/pip install -r /opt/codedoc/requirements.txt
sudo systemctl restart codedoc
echo "==> Backend deployed and restarted!"
REMOTE

echo "==> Verifying health..."
sleep 3
curl -s http://${EC2_IP}:8000/health
echo ""
echo "==> Done!"
