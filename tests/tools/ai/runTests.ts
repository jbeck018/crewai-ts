/**
 * Test Runner for AI Tool and Extension Tests
 * Optimized for memory efficiency and performance
 */

import { spawnSync } from 'child_process';
import path from 'path';
import fs from 'fs';

// Configuration for test runs
const config = {
  testDirs: ['ai', 'extension'],
  concurrency: 2, // Number of test files to run in parallel
  memoryLimit: '512M', // Memory limit for Node process
  reportDir: './test-results',
  coverage: true
};

// Ensure report directory exists
if (!fs.existsSync(config.reportDir)) {
  fs.mkdirSync(config.reportDir, { recursive: true });
}

// Find all test files in the specified directories
function findTestFiles(): string[] {
  const testFiles: string[] = [];
  
  for (const dir of config.testDirs) {
    const dirPath = path.join(__dirname, '..', dir);
    if (!fs.existsSync(dirPath)) continue;
    
    const files = fs.readdirSync(dirPath);
    for (const file of files) {
      if (file.endsWith('.test.ts')) {
        testFiles.push(path.join(dirPath, file));
      }
    }
  }
  
  return testFiles;
}

// Run tests with optimized settings
async function runTests() {
  const testFiles = findTestFiles();
  console.log(`Found ${testFiles.length} test files to run`);
  
  // Group test files for parallel execution
  const chunks = [];
  for (let i = 0; i < testFiles.length; i += config.concurrency) {
    chunks.push(testFiles.slice(i, i + config.concurrency));
  }
  
  // Process each chunk sequentially
  let allPassed = true;
  let totalTests = 0;
  let passedTests = 0;
  
  console.time('Total test execution time');
  
  for (const [index, chunk] of chunks.entries()) {
    console.log(`Running test chunk ${index + 1}/${chunks.length}...`);
    
    // Run tests in this chunk in parallel
    const results = await Promise.all(chunk.map(async (file) => {
      const relativeFile = path.relative(process.cwd(), file);
      const outFile = path.join(config.reportDir, `${path.basename(file, '.test.ts')}.json`);
      
      console.log(`Running tests for ${relativeFile}...`);
      
      // Build vitest command with optimized flags
      const args = [
        'npx',
        'vitest',
        'run',
        relativeFile,
        '--reporter=json',
        `--outputFile=${outFile}`,
        '--no-color',
        ...(config.coverage ? ['--coverage'] : [])
      ];
      
      // Run test with memory limits
      const startTime = Date.now();
      const result = spawnSync('node', ['--max-old-space-size=512', ...args], {
        encoding: 'utf8',
        stdio: 'pipe'
      });
      const duration = Date.now() - startTime;
      
      // Process and display results
      const success = result.status === 0;
      const output = result.stdout || '';
      
      // Extract test counts if possible
      let fileTests = 0;
      let filePassed = 0;
      
      try {
        if (fs.existsSync(outFile)) {
          const data = JSON.parse(fs.readFileSync(outFile, 'utf8'));
          fileTests = data.numTotalTests || 0;
          filePassed = data.numPassedTests || 0;
          
          totalTests += fileTests;
          passedTests += filePassed;
        }
      } catch (error) {
        console.error(`Error parsing test results for ${relativeFile}:`, error);
      }
      
      console.log(`✅ ${relativeFile}: ${filePassed}/${fileTests} tests passed (${duration}ms)`);
      
      if (!success) {
        console.error(`❌ Tests for ${relativeFile} failed`);
        console.error(output);
        allPassed = false;
      }
      
      return { file: relativeFile, success, duration };
    }));
    
    // Log chunk results
    const failedTests = results.filter(r => !r.success);
    if (failedTests.length > 0) {
      console.error(`${failedTests.length} tests failed in chunk ${index + 1}`);
    } else {
      console.log(`All tests in chunk ${index + 1} passed successfully`);
    }
  }
  
  console.timeEnd('Total test execution time');
  
  // Final summary
  console.log('\n==== Test Summary ====');
  console.log(`Total tests: ${totalTests}`);
  console.log(`Passed: ${passedTests}`);
  console.log(`Failed: ${totalTests - passedTests}`);
  console.log(`Success rate: ${((passedTests / totalTests) * 100).toFixed(2)}%`);
  
  return allPassed;
}

// Run tests and exit with appropriate code
runTests().then(success => {
  process.exit(success ? 0 : 1);
}).catch(error => {
  console.error('Error running tests:', error);
  process.exit(1);
});
