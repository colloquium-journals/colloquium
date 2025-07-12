#!/usr/bin/env node

// Fix the file paths to include the correct directory structure

const { PrismaClient } = require('@prisma/client');
const path = require('path');

const prisma = new PrismaClient();

async function fixFilePaths() {
  const manuscriptId = '907d4818-2d40-49a2-9013-6bd90be027ea';
  
  console.log('Fixing file paths for manuscript:', manuscriptId);
  
  const basePath = '/Users/jdeleeuw/Documents/GitHub/colloquium/apps/api/uploads/manuscripts';
  
  // Update all files for this manuscript
  await prisma.manuscript_files.updateMany({
    where: {
      manuscriptId: manuscriptId,
      originalName: 'manuscript.md'
    },
    data: {
      path: path.join(basePath, manuscriptId, 'manuscript.md')
    }
  });
  
  await prisma.manuscript_files.updateMany({
    where: {
      manuscriptId: manuscriptId,
      originalName: 'references.bib'
    },
    data: {
      path: path.join(basePath, manuscriptId, 'references.bib')
    }
  });
  
  await prisma.manuscript_files.updateMany({
    where: {
      manuscriptId: manuscriptId,
      originalName: 'results-comparison.png'
    },
    data: {
      path: path.join(basePath, manuscriptId, 'results-comparison.png')
    }
  });
  
  await prisma.manuscript_files.updateMany({
    where: {
      manuscriptId: manuscriptId,
      originalName: 'feature-importance.png'
    },
    data: {
      path: path.join(basePath, manuscriptId, 'feature-importance.png')
    }
  });
  
  console.log('File paths fixed!');
  
  // Verify the changes
  const files = await prisma.manuscript_files.findMany({
    where: { manuscriptId },
    select: { originalName: true, filename: true, path: true }
  });
  
  console.log('Updated files:');
  files.forEach(file => {
    console.log(`- ${file.originalName} -> ${file.path}`);
  });
}

fixFilePaths()
  .catch(console.error)
  .finally(() => prisma.$disconnect());