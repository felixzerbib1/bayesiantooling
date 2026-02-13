#!/bin/bash
# deploy.sh — Push, deploy to Vercel, and notify Slack
#
# Usage: ./deploy.sh
#        npm run deploy

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

# Load Slack webhook from .env.deploy (if exists)
if [ -f .env.deploy ]; then
  export $(grep -v '^#' .env.deploy | xargs)
fi

echo "📦 Pushing to GitHub..."
git push origin main
git push org main 2>/dev/null || true

echo ""
echo "🚀 Deploying to Vercel..."
npx vercel --prod

echo ""
echo "📋 Sending Slack notification..."
if [ -n "$SLACK_WEBHOOK_URL" ]; then
  node changelog.js HEAD~1 HEAD
else
  echo "⚠  No SLACK_WEBHOOK_URL set. Skipping Slack notification."
  echo "   Add it to .env.deploy to enable."
fi

echo ""
echo "✅ Done! Live at https://feature-flag-app-pied.vercel.app/"
