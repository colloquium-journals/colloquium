#!/usr/bin/env node

/**
 * Custom Next.js dev server wrapper that handles graceful shutdown
 */

const { spawn } = require('child_process');

let nextProcess = null;

// Start Next.js dev server
function startNextDev() {
  console.log('🚀 Starting Next.js development server...');
  
  nextProcess = spawn('npx', ['next', 'dev'], {
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
    } else {
      console.log('✅ Next.js dev server closed cleanly');
    }
    process.exit(0);
  });
}

// Graceful shutdown
function gracefulShutdown(signal) {
  console.log(`\n${signal} received. Shutting down Next.js dev server...`);
  
  if (nextProcess) {
    nextProcess.kill('SIGTERM');
    
    // Force kill after timeout
    setTimeout(() => {
      if (nextProcess && !nextProcess.killed) {
        console.log('Force killing Next.js process...');
        nextProcess.kill('SIGKILL');
      }
      process.exit(0);
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