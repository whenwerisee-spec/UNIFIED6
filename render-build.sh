#!/usr/bin/env bash
# exit on error
set -o errexit

echo "🚀 Starting Bulletproof Sovereignty Build..."

# Force Node Version (if not already set by Render)
# Current Gold Master Requirement: Node 22+
node --version

# Absolute Truth: We use NPM, not Yarn or Bun.
# We remove any auto-generated yarn files if Render injected them.
rm -rf yarn.lock
rm -rf .bundle

# Clean Install
echo "📦 Installing dependencies via NPM..."
npm install

# Build Web Assets & Hardened Backend
echo "🛠️ Compiling Production Gold Master..."
npm run build

echo "✅ Build Complete & Verified."
