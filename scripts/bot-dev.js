#!/usr/bin/env node

/**
 * Bot Development Watch Mode
 *
 * Watches a bot package for changes and recompiles automatically.
 *
 * Usage:
 *   npm run bot:dev -- --bot packages/bot-reference-check
 *   npm run bot:dev -- --bot packages/bot-editorial
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

function parseArgs() {
  const args = process.argv.slice(2);
  let botPath = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--bot' && args[i + 1]) {
      botPath = args[i + 1];
      i++;
    }
  }

  return { botPath };
}

function main() {
  const { botPath } = parseArgs();

  if (!botPath) {
    console.error('\nUsage: npm run bot:dev -- --bot <path-to-bot-package>\n');
    console.error('Examples:');
    console.error('  npm run bot:dev -- --bot packages/bot-reference-check');
    console.error('  npm run bot:dev -- --bot packages/bot-editorial');
    console.error('  npm run bot:dev -- --bot packages/bot-markdown-renderer');
    console.error('  npm run bot:dev -- --bot packages/bot-reviewer-checklist\n');
    process.exit(1);
  }

  const absolutePath = path.resolve(process.cwd(), botPath);

  if (!fs.existsSync(absolutePath)) {
    console.error(`\nError: Bot package not found at ${absolutePath}\n`);
    process.exit(1);
  }

  const pkgJsonPath = path.join(absolutePath, 'package.json');
  if (!fs.existsSync(pkgJsonPath)) {
    console.error(`\nError: No package.json found at ${absolutePath}\n`);
    process.exit(1);
  }

  const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
  const botName = pkg.name || path.basename(absolutePath);

  console.log(`\n  Bot Dev Mode: ${botName}`);
  console.log(`  Path: ${absolutePath}`);
  console.log(`  Watching for changes...\n`);
  console.log('  Make sure the API dev server is running separately:');
  console.log('    npm run dev\n');
  console.log('  ─────────────────────────────────────────\n');

  const child = spawn('npx', ['tsc', '--watch', '--preserveWatchOutput'], {
    cwd: absolutePath,
    stdio: 'inherit',
    shell: true,
  });

  child.on('error', (err) => {
    console.error(`\nFailed to start TypeScript compiler: ${err.message}\n`);
    process.exit(1);
  });

  child.on('exit', (code) => {
    process.exit(code || 0);
  });

  // Forward signals
  process.on('SIGINT', () => child.kill('SIGINT'));
  process.on('SIGTERM', () => child.kill('SIGTERM'));
}

main();
