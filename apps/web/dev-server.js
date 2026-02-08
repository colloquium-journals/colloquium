#!/usr/bin/env node

/**
 * Custom Next.js dev server wrapper that handles graceful shutdown and port cleanup
 */

const { spawn, exec } = require('child_process');

let nextProcess = null;

// Clean up port 3000 before starting
function cleanupPort() {
  return new Promise((resolve) => {
    exec('lsof -ti:3000 | xargs kill -9 2>/dev/null', (error) => {
      // Ignore errors - port might already be free
      resolve();
    });
  });
}

// Start Next.js dev server
async function startNextDev() {
  console.log('🧹 Cleaning up port 3000...');
  await cleanupPort();
  
  console.log('🚀 Starting Next.js development server...');
  
  nextProcess = spawn('npx', ['next', 'dev', '--webpack'], {
    stdio: 'inherit',
    shell: true
  });

  nextProcess.on('error', (error) => {
    console.error('❌ Next.js dev server error:', error);
    process.exit(1);
  });

  nextProcess.on('close', (code) => {
    if (code !== null && code !== 0) {
      console.log(`⚠️  Next.js dev server exited with code ${code}`);
      process.exit(code);
    } else {
      console.log('✅ Next.js dev server closed cleanly');
      process.exit(0);
    }
  });
}

let isShuttingDown = false;

// Graceful shutdown
function gracefulShutdown(signal) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  
  console.log(`\n${signal} received. Shutting down Next.js dev server...`);
  
  if (nextProcess) {
    nextProcess.kill('SIGTERM');
    
    // Force kill after timeout
    setTimeout(() => {
      if (nextProcess && !nextProcess.killed) {
        console.log('Force killing Next.js process...');
        nextProcess.kill('SIGKILL');
      }
      process.exit(1);
    }, 3000);
  } else {
    process.exit(0);
  }
}

// Handle signals
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// Start the server
startNextDev();