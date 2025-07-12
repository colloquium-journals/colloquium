#!/usr/bin/env node

// Quick script to update database file paths for the test manuscript
// This migrates from UUID filenames to folder structure with original names

const { PrismaClient } = require('@prisma/client');
const path = require('path');

const prisma = new PrismaClient();

async function updateFilePaths() {
  const manuscriptId = '907d4818-2d40-49a2-9013-6bd90be027ea';
  
  console.log('Updating file paths for manuscript:', manuscriptId);
  
  // Update manuscript.md
  await prisma.manuscript_files.updateMany({
    where: {
      manuscriptId: manuscriptId,
      originalName: 'manuscript.md'
    },
    data: {
      filename: 'manuscript.md',
      path: path.join(process.cwd(), 'uploads', 'manuscripts', manuscriptId, 'manuscript.md')
    }
  });
  
  // Update references.bib
  await prisma.manuscript_files.updateMany({
    where: {
      manuscriptId: manuscriptId,
      originalName: 'references.bib'
    },
    data: {
      filename: 'references.bib', 
      path: path.join(process.cwd(), 'uploads', 'manuscripts', manuscriptId, 'references.bib')
    }
  });
  
  // Update results-comparison.png
  await prisma.manuscript_files.updateMany({
    where: {
      manuscriptId: manuscriptId,
      filename: { contains: '103059538' } // The UUID part we found
    },
    data: {
      filename: 'results-comparison.png',
      originalName: 'results-comparison.png',
      path: path.join(process.cwd(), 'uploads', 'manuscripts', manuscriptId, 'results-comparison.png')
    }
  });
  
  // Update feature-importance.png  
  await prisma.manuscript_files.updateMany({
    where: {
      manuscriptId: manuscriptId,
      filename: { contains: '724022172' } // The UUID part we found
    },
    data: {
      filename: 'feature-importance.png',
      originalName: 'feature-importance.png', 
      path: path.join(process.cwd(), 'uploads', 'manuscripts', manuscriptId, 'feature-importance.png')
    }
  });
  
  console.log('Database updated! File paths now point to the new folder structure.');
  
  // Verify the changes
  const files = await prisma.manuscript_files.findMany({
    where: { manuscriptId },
    select: { originalName: true, filename: true, path: true }
  });
  
  console.log('Updated files:');
  files.forEach(file => {
    console.log(`- ${file.originalName} -> ${file.filename} at ${file.path}`);
  });
}

updateFilePaths()
  .catch(console.error)
  .finally(() => prisma.$disconnect());