#!/usr/bin/env bash
set -e

echo "🔍 Finding Stripe top-level initializations..."

FILES=$(grep -R "new Stripe(process.env.STRIPE_SECRET_KEY" -l app/api)

if [ -z "$FILES" ]; then
  echo "✅ No files to patch."
  exit 0
fi

echo "🧩 Files to patch:"
echo "$FILES"
echo ""

for f in $FILES; do
  echo "✏️  Patching $f"
  cp "$f" "$f.bak"
  sed -i '' \
    's/^const stripe = new Stripe(process.env.STRIPE_SECRET_KEY/\/\/ DISABLED TOP-LEVEL STRIPE INIT\n\/\/ const stripe = new Stripe(process.env.STRIPE_SECRET_KEY/' \
    "$f"
done

echo ""
echo "✅ Done."
echo "📦 Backups created as *.bak"
