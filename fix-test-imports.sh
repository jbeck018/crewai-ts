#!/bin/bash

# Performance-optimized script to fix test imports across the codebase
# This script updates all test files to use our vitest-utils.js compatibility layer

echo "Starting test import fixes with optimized search patterns..."

# 1. Find all test files using fast pattern matching
TEST_FILES=$(find ./tests -name "*.test.ts" -type f)

# 2. Batch process files for better performance
for file in $TEST_FILES; do
  # Skip already fixed files for performance
  if grep -q "vitest-utils.js" "$file"; then
    echo "Skipping already fixed file: $file"
    continue
  fi
  
  echo "Fixing imports in $file"
  
  # 3. Use efficient sed replacements with optimized patterns
  # Replace imports from test-utils
  sed -i '' "s/from '\.\.\/\.\.\/test-utils'/from '\.\.\/\.\.\/tests\/vitest-utils.js'/g" "$file"
  sed -i '' "s/from '\.\.\/test-utils'/from '\.\.\/vitest-utils.js'/g" "$file"
  sed -i '' "s/from '\.\.\/\.\.\/\.\.\/test-utils'/from '\.\.\/\.\.\/\.\.\/tests\/vitest-utils.js'/g" "$file"
  
  # Replace jest references with vi from vitest
  sed -i '' "s/jest\.fn/vi.fn/g" "$file"
  sed -i '' "s/jest\.spyOn/vi.spyOn/g" "$file"
  sed -i '' "s/jest\.clearAllMocks/vi.clearAllMocks/g" "$file"
  sed -i '' "s/jest\.resetAllMocks/vi.resetAllMocks/g" "$file"
  
  # Add vitest import if needed
  if ! grep -q "import.*from ['\"]vitest['\"]" "$file"; then
    sed -i '' "1s/^/import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';\n/" "$file"
  fi
  
  # Ensure vi import exists within any existing vitest import
  if grep -q "import.*from ['\"]vitest['\"]" "$file" && ! grep -q "import.*vi.*from ['\"]vitest['\"]" "$file"; then
    sed -i '' "s/import {\(.*\)} from 'vitest';/import {\1, vi} from 'vitest';/g" "$file"
  fi
done

echo "Import fixes completed with optimized performance."
