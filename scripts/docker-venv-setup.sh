#!/bin/sh
set -e

python3 -m venv /app/sovereigns-banking-hub/backend/venv
/app/sovereigns-banking-hub/backend/venv/bin/pip install --upgrade pip
/app/sovereigns-banking-hub/backend/venv/bin/pip install -r /app/sovereigns-banking-hub/backend/requirements.txt
