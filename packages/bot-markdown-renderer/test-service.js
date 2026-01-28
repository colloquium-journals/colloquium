#!/usr/bin/env node

/**
 * Test script to verify the markdown-renderer-bot service integration
 * This simulates the HTTP service to test bot functionality
 */

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const port = 8080;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'test-pandoc-service',
    pandoc: 'Pandoc 2.19.2 (test)',
    timestamp: new Date().toISOString()
  });
});

// Mock PDF conversion endpoint
app.post('/convert', (req, res) => {
  console.log('Test conversion request received');
  
  const { markdown, engine, template, variables, outputFormat } = req.body;
  
  if (!markdown) {
    return res.status(400).json({
      error: 'Missing required field: markdown'
    });
  }
  
  console.log(`Mock conversion: ${markdown.length} chars, engine: ${engine}, format: ${outputFormat}`);
  
  // Create a simple mock PDF (just some bytes to simulate PDF content)
  const mockPdfContent = Buffer.from('%PDF-1.4\n1 0 obj\n<<\n/Type /Catalog\n/Pages 2 0 R\n>>\nendobj\n2 0 obj\n<<\n/Type /Pages\n/Kids [3 0 R]\n/Count 1\n>>\nendobj\n3 0 obj\n<<\n/Type /Page\n/Parent 2 0 R\n/MediaBox [0 0 612 792]\n/Contents 4 0 R\n>>\nendobj\n4 0 obj\n<<\n/Length 44\n>>\nstream\nBT\n/F1 12 Tf\n100 700 Td\n(Test PDF) Tj\nET\nendstream\nendobj\nxref\n0 5\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n0000000206 00000 n \ntrailer\n<<\n/Size 5\n/Root 1 0 R\n>>\nstartxref\n299\n%%EOF');
  
  // Set appropriate headers
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Length', mockPdfContent.length);
  res.setHeader('X-Conversion-Engine', engine);
  res.setHeader('X-Output-Format', outputFormat);
  
  console.log(`Mock PDF generated: ${mockPdfContent.length} bytes`);
  res.send(mockPdfContent);
});

// Get available engines
app.get('/engines', (req, res) => {
  res.json({
    engines: [
      {
        name: 'html',
        description: 'HTML to PDF via WeasyPrint (TEST)',
        pdfEngine: 'weasyprint',
        templateFormat: 'html'
      },
      {
        name: 'latex',
        description: 'LaTeX to PDF via pdflatex (TEST)',
        pdfEngine: 'pdflatex',
        templateFormat: 'tex'
      },
      {
        name: 'typst',
        description: 'Typst to PDF (TEST)',
        pdfEngine: 'typst',
        templateFormat: 'typ'
      }
    ]
  });
});

// Error handling
app.use((error, req, res, next) => {
  console.error('Test service error:', error);
  res.status(500).json({
    error: 'Internal server error',
    details: error.message
  });
});

app.use((req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    message: `${req.method} ${req.path} is not supported`
  });
});

app.listen(port, () => {
  console.log(`Test Pandoc service running on port ${port}`);
  console.log('Available endpoints:');
  console.log('  GET  /health - Health check');
  console.log('  POST /convert - Convert markdown to PDF (mock)');
  console.log('  GET  /engines - List available engines');
  console.log('');
  console.log('This is a test service that simulates the real Pandoc microservice');
});