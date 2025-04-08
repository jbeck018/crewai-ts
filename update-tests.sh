#!/bin/bash

# Optimization script to update test imports from bun:test to our compatibility layer

# Find all test files with bun:test imports
FILES=$(grep -l "bun:test" --include="*.ts" -r /Users/jacob/projects/crewai-ts/tests)

# Process each file
for file in $FILES; do
  echo "Updating $file"
  # Replace bun:test imports with our test-utils
  sed -i '' "s/from 'bun:test'/from '\..\/test-utils'/g" "$file"
  # Handle relative paths for deeper directories
  sed -i '' "s/from '\.\.\/test-utils'/from '\.\.\/\.\.\/test-utils'/g" "$file" 
  sed -i '' "s/from '\.\.\/\.\.\/\.\.\/test-utils'/from '\.\.\/\.\.\/\.\.\/test-utils'/g" "$file"
  # Fix relative paths based on directory depth
  depth=$(echo "$file" | awk -F"/" '{print NF-1}')
  # Calculate correct relative path
  if [[ "$file" == *"/tests/agent/"* || "$file" == *"/tests/crew/"* || "$file" == *"/tests/task/"* || "$file" == *"/tests/tools/"* || "$file" == *"/tests/knowledge/"* || "$file" == *"/tests/memory/"* || "$file" == *"/tests/utils/"* ]]; then
    sed -i '' "s/from '\.\.\/\.\.\/test-utils'/from '\.\.\/test-utils'/g" "$file"
  fi
  if [[ "$file" == *"/tests/knowledge/storage/"* || "$file" == *"/tests/flow/memory/"* || "$file" == *"/tests/flow/orchestration/"* || "$file" == *"/tests/tools/cache/"* || "$file" == *"/tests/cli/commands/"* ]]; then
    sed -i '' "s/from '\.\.\/\.\.\/test-utils'/from '\.\.\/\.\.\/\.\.\/test-utils'/g" "$file"
  fi
done

echo "Completed updating test imports"
