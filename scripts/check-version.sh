#!/bin/bash

# Check if the root package.json is staged (not docs/package.json or other package.json files)
if git diff --cached --name-only | grep -q "^package.json$"; then
  # Get all staged files
  STAGED_FILES=$(git diff --cached --name-only)
  
  # Check if only docs/, examples/, .github/, or .md files (and package.json) are staged
  # These match the paths-ignore in the GitHub Actions workflow
  NON_IGNORED_FILES=$(echo "$STAGED_FILES" | grep -v '^docs/' | grep -v '^examples/' | grep -v '^\.github/' | grep -v '\.md$' | grep -v '^package.json$')
  
  if [ -z "$NON_IGNORED_FILES" ]; then
    echo "✅ Only docs/examples/workflow changes detected - version check skipped"
    exit 0
  fi
  
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

