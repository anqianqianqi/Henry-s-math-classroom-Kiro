#!/bin/bash
# Downloads the default treasure-map book cover into public/
# Run once: bash scripts/download-book-cover.sh

set -e
DEST="public/book-cover-default.jpg"

if [ -f "$DEST" ]; then
  echo "✅ $DEST already exists, skipping."
  exit 0
fi

echo "📥 Downloading treasure map cover..."

# Try curl first, then wget
if command -v curl &> /dev/null; then
  curl -fsSL \
    "https://upload.wikimedia.org/wikipedia/commons/thumb/1/10/Piratmap.jpg/800px-Piratmap.jpg" \
    -o "$DEST"
elif command -v wget &> /dev/null; then
  wget -q \
    "https://upload.wikimedia.org/wikipedia/commons/thumb/1/10/Piratmap.jpg/800px-Piratmap.jpg" \
    -O "$DEST"
else
  echo "❌ Neither curl nor wget found. Please manually save your image to: $DEST"
  exit 1
fi

echo "✅ Saved to $DEST"
echo ""
echo "Now run:"
echo "  git add public/book-cover-default.jpg"
echo "  git commit -m 'assets: add default treasure map book cover'"
echo "  git push"
