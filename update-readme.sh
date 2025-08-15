#!/bin/bash

# ✅ Build the Hugo site
echo "🚀 Building the Hugo site..."
hugo --minify || { echo "❌ Hugo build failed"; exit 1; }

# ✅ List generated files for verification
echo "📂 Listing Generated Files:"
ls -R public/

# ✅ Check if RSS file exists
RSS_FILE="public/index.xml"
if [ -f "$RSS_FILE" ]; then
  echo "✅ RSS file found."
  DYNAMIC_CONTENT=$(cat "$RSS_FILE")
else
  echo "❌ RSS file not found!"
  exit 1
fi

# ✅ Fallback if dynamic content is empty
if [ -z "$DYNAMIC_CONTENT" ]; then
  echo "⚠️ Dynamic content is empty. Adding placeholder."
  DYNAMIC_CONTENT="No recent posts available."
fi

# ✅ Explicit path to the root README.md
ROOT_README="./README.md"

# ✅ Ensure README.md has dynamic content markers
if ! grep -q "<!-- START_DYNAMIC_CONTENT -->" "$ROOT_README"; then
  echo "❌ START_DYNAMIC_CONTENT marker not found in README.md!"
  exit 1
fi

if ! grep -q "<!-- END_DYNAMIC_CONTENT -->" "$ROOT_README"; then
  echo "❌ END_DYNAMIC_CONTENT marker not found in README.md!"
  exit 1
fi

# ✅ Replace content between markers using safer approach
echo "📝 Updating README.md..."

# Escape double quotes in dynamic content to avoid syntax issues
ESCAPED_CONTENT=$(echo "$DYNAMIC_CONTENT" | sed 's/"/\\"/g')

awk -v new_content="$ESCAPED_CONTENT" '
  /<!-- START_DYNAMIC_CONTENT -->/ {print; print new_content; skip=1; next}
  /<!-- END_DYNAMIC_CONTENT -->/ {skip=0}
  skip==0
' "$ROOT_README" > temp_readme.md && mv temp_readme.md "$ROOT_README"

# ✅ Clean up backup files
rm -f README.md.bak

# ✅ Configure Git for GitHub Actions
echo "⚙️ Configuring Git..."
git config --global user.email "41898282+github-actions[bot]@users.noreply.github.com"
git config --global user.name "github-actions[bot]"

# ✅ Stage changes
git add "$ROOT_README"

# ✅ Force commit regardless of changes
echo "📦 Forcing commit..."
git commit --allow-empty -m "Force update README with latest posts"

# ✅ Push changes to GitHub
echo "🚀 Pushing changes to GitHub..."
git push origin main || echo "⚠️ No changes to push."
