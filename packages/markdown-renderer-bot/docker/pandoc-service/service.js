const express = require('express');
const { exec } = require('child_process');
const fs = require('fs-extra');
const path = require('path');
const tmp = require('tmp');
const cors = require('cors');
const multer = require('multer');

const app = express();
const port = process.env.PORT || 8080;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Configure multer for file uploads
const upload = multer({
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB
    fieldSize: 10 * 1024 * 1024  // 10MB for text fields
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  exec('pandoc --version', (error, stdout) => {
    if (error) {
      res.status(500).json({
        status: 'unhealthy',
        error: 'Pandoc not available',
        details: error.message
      });
    } else {
      const version = stdout.split('\n')[0];
      res.json({
        status: 'healthy',
        service: 'pandoc-service',
        pandoc: version,
        timestamp: new Date().toISOString()
      });
    }
  });
});

// Main PDF conversion endpoint
app.post('/convert', upload.none(), async (req, res) => {
  let tempDir = null;
  
  try {
    console.log('=== CITATION DEBUG START ===');
    
    // Parse request body
    const {
      markdown,
      engine = 'html',
      template,
      variables = {},
      outputFormat = 'pdf',
      bibliography = '',
      assets = []
    } = req.body;
    
    // Check for citations in markdown
    const citationMatches = markdown.match(/\[@[^\]]+\]/g);
    console.log('CITATION DEBUG: Citations found in markdown:', citationMatches ? citationMatches.length : 0);
    if (citationMatches) {
      console.log('CITATION DEBUG: Citation keys:', citationMatches);
    } else {
      console.log('CITATION DEBUG: No citations detected in markdown');
    }
    
    if (!markdown) {
      return res.status(400).json({
        error: 'Missing required field: markdown'
      });
    }
    
    // Create temporary directory
    tempDir = tmp.dirSync({ prefix: 'pandoc-', unsafeCleanup: true });
    const inputFile = path.join(tempDir.name, 'input.md');
    const outputFile = path.join(tempDir.name, `output.${outputFormat}`);
    
    console.log(`Working directory: ${tempDir.name}`);
    console.log(`Engine: ${engine}, Format: ${outputFormat}`);
    
    // Write markdown to input file
    await fs.writeFile(inputFile, markdown, 'utf8');
    
    // Write bibliography file if provided
    let bibliographyFile = null;
    if (bibliography && bibliography.trim()) {
      bibliographyFile = path.join(tempDir.name, 'references.bib');
      await fs.writeFile(bibliographyFile, bibliography, 'utf8');
      const bibEntries = (bibliography.match(/@\w+\{/g) || []).length;
      console.log('CITATION DEBUG: Bibliography file written - entries found:', bibEntries);
    } else {
      console.log('ERROR: No bibliography provided!');
    }
    
    // Write asset files if provided
    if (assets && assets.length > 0) {
      console.log(`DEBUG: Processing ${assets.length} asset files`);
      for (const asset of assets) {
        try {
          const assetPath = path.join(tempDir.name, asset.filename);
          
          // Create directory if needed (for nested assets)
          const assetDir = path.dirname(assetPath);
          if (assetDir !== tempDir.name) {
            await fs.ensureDir(assetDir);
          }
          
          // Write asset file from base64 content
          if (asset.encoding === 'base64') {
            const buffer = Buffer.from(asset.content, 'base64');
            await fs.writeFile(assetPath, buffer);
            console.log(`DEBUG: Asset written: ${asset.filename} (${buffer.length} bytes)`);
          } else {
            await fs.writeFile(assetPath, asset.content, 'utf8');
            console.log(`DEBUG: Asset written: ${asset.filename} (text)`);
          }
        } catch (assetError) {
          console.warn(`Warning: Failed to write asset ${asset.filename}:`, assetError);
        }
      }
    } else {
      console.log('DEBUG: No asset files provided');
    }
    
    // Build Pandoc command
    const args = [
      `"${inputFile}"`,
      '-o', `"${outputFile}"`
    ];
    
    // Add engine-specific options
    if (outputFormat === 'pdf') {
      // PDF-specific engines
      switch (engine) {
        case 'latex':
          args.push('--pdf-engine=pdflatex');
          break;
        case 'typst':
          args.push('--pdf-engine=typst');
          break;
        case 'html':
        default:
          args.push('--pdf-engine=weasyprint');
          break;
      }
    } else if (outputFormat === 'html') {
      // HTML-specific options
      args.push('--standalone'); // Generate complete HTML document
      args.push('--self-contained'); // Include images and CSS inline
    }
    
    // Add template if provided
    if (template) {
      let templateExt;
      if (outputFormat === 'pdf') {
        templateExt = engine === 'latex' ? 'tex' : engine === 'typst' ? 'typ' : 'html';
      } else {
        templateExt = 'html';
      }
      const templateFile = path.join(tempDir.name, `template.${templateExt}`);
      await fs.writeFile(templateFile, template, 'utf8');
      args.push('--template', `"${templateFile}"`);
    }
    
    // Add variables
    Object.entries(variables).forEach(([key, value]) => {
      if (typeof value === 'string' && value.trim() !== '') {
        args.push('--variable', `${key}:"${value.replace(/"/g, '\\"')}"`);
      }
    });
    
    // Add bibliography if provided
    if (bibliographyFile) {
      args.push('--bibliography', `"${bibliographyFile}"`);
      args.push('--citeproc'); // Enable citation processing
    }
    
    // Add format-specific settings
    if (outputFormat === 'pdf') {
      // PDF-specific settings
      args.push('--variable', 'geometry:margin=1in');
      args.push('--variable', 'fontsize:12pt');
      args.push('--variable', 'documentclass:article');
    } else if (outputFormat === 'html') {
      // HTML-specific settings
      args.push('--variable', 'lang:en');
      args.push('--variable', 'viewport:width=device-width,initial-scale=1');
    }
    
    const command = `pandoc ${args.join(' ')}`;
    console.log('CITATION DEBUG: Pandoc command includes --citeproc and --bibliography flags');
    console.log(`CITATION DEBUG: Executing: ${command}`);
    console.log('CITATION DEBUG: Input markdown first 200 chars:', markdown.substring(0, 200));
    console.log('=== CITATION DEBUG END ===');
    
    // Also write markdown to temp file for debugging
    const debugMarkdownFile = path.join(tempDir.name, 'debug_input.md');
    await fs.writeFile(debugMarkdownFile, markdown, 'utf8');
    
    // Execute Pandoc
    exec(command, { cwd: tempDir.name }, async (error, stdout, stderr) => {
      try {
        if (error) {
          console.error('Pandoc error:', error);
          console.error('Stderr:', stderr);
          return res.status(500).json({
            error: 'Pandoc conversion failed',
            details: stderr || error.message,
            command: command
          });
        }
        
        // Check if output file was created
        if (!await fs.pathExists(outputFile)) {
          return res.status(500).json({
            error: 'Output file not generated',
            details: 'Pandoc completed but no output file found'
          });
        }
        
        // Read output file and send response
        const outputBuffer = await fs.readFile(outputFile);
        const stats = await fs.stat(outputFile);
        
        console.log(`Conversion successful. Output size: ${stats.size} bytes`);
        
        // Set appropriate headers
        res.setHeader('Content-Type', outputFormat === 'pdf' ? 'application/pdf' : 'application/octet-stream');
        res.setHeader('Content-Length', stats.size);
        res.setHeader('X-Conversion-Engine', engine);
        res.setHeader('X-Output-Format', outputFormat);
        
        res.send(outputBuffer);
        
      } catch (readError) {
        console.error('Error reading output file:', readError);
        res.status(500).json({
          error: 'Failed to read output file',
          details: readError.message
        });
      } finally {
        // Cleanup is handled by tmp.dirSync with unsafeCleanup: true
      }
    });
    
  } catch (error) {
    console.error('Service error:', error);
    res.status(500).json({
      error: 'Internal service error',
      details: error.message
    });
  }
});

// Get available engines
app.get('/engines', (req, res) => {
  res.json({
    engines: [
      {
        name: 'html',
        description: 'HTML to PDF via WeasyPrint',
        pdfEngine: 'weasyprint',
        templateFormat: 'html'
      },
      {
        name: 'latex',
        description: 'LaTeX to PDF via pdflatex',
        pdfEngine: 'pdflatex', 
        templateFormat: 'tex'
      },
      {
        name: 'typst',
        description: 'Typst to PDF',
        pdfEngine: 'typst',
        templateFormat: 'typ'
      }
    ]
  });
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  res.status(500).json({
    error: 'Internal server error',
    details: error.message
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    message: `${req.method} ${req.path} is not supported`
  });
});

app.listen(port, '0.0.0.0', () => {
  console.log(`Pandoc service listening on port ${port}`);
  console.log('Available endpoints:');
  console.log('  GET  /health - Health check');
  console.log('  POST /convert - Convert markdown to PDF');
  console.log('  GET  /engines - List available engines');
});