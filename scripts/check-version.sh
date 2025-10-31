#!/bin/bash

# Check if package.json is staged
if git diff --cached --name-only | grep -q "package.json"; then
  # Get current version from staged file
  STAGED_VERSION=$(git show :package.json | grep '"version"' | head -1 | sed 's/.*"version": "\(.*\)".*/\1/')
  
  # Get previous version from HEAD
  PREVIOUS_VERSION=$(git show HEAD:package.json 2>/dev/null | grep '"version"' | head -1 | sed 's/.*"version": "\(.*\)".*/\1/')
  
  # If this is the first commit (no HEAD), allow it
  if [ -z "$PREVIOUS_VERSION" ]; then
    echo "✅ First commit - version check skipped"
    exit 0
  fi
  
  # Check if version changed
  if [ "$STAGED_VERSION" = "$PREVIOUS_VERSION" ]; then
    echo ""
    echo "❌ ERROR: package.json version has not been bumped!"
    echo ""
    echo "   Current version: $PREVIOUS_VERSION"
    echo "   Please update the version in package.json before committing."
    echo ""
    echo "   To skip this check (not recommended):"
    echo "   git commit --no-verify"
    echo ""
    exit 1
  else
    echo "✅ Version bumped: $PREVIOUS_VERSION → $STAGED_VERSION"
  fi
fi

exit 0

