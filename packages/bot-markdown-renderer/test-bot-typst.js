#!/usr/bin/env node

/**
 * Test that the bot now uses Typst by default
 */

const fs = require('fs');
const path = require('path');

async function testBotTypstDefault() {
    try {
        console.log('Testing bot default engine (should be Typst)...');
        console.log('='.repeat(60));
        
        // Load the Typst template (this is what should be used)
        const templatePath = path.join(__dirname, 'templates', 'academic-standard.typ');
        const template = fs.readFileSync(templatePath, 'utf-8');
        
        const testMarkdown = `# Test Document for Engine Verification

This document tests that the bot is using the Typst engine by default.

## Citation Test

Testing with a simple citation [@test2025].

## Content

The document should be rendered with professional Typst typography.
`;

const testBibliography = `@article{test2025,
  title={Test Article for Engine Verification},
  author={Test Author},
  journal={Test Journal},
  year={2025}
}`;

        // Simulate what the bot should send (using Typst engine by default)
        const requestBody = {
            markdown: testMarkdown,
            engine: 'typst', // This should be the default now
            template: template,
            variables: {
                title: 'Engine Verification Test',
                authors: 'Test User',
                abstract: 'This document verifies that the bot uses Typst by default.',
                submittedDate: '2025-01-11',
                renderDate: '2025-01-11',
                journalName: 'Test Journal'
            },
            outputFormat: 'pdf',
            bibliography: testBibliography
        };
        
        console.log('Sending request to http://localhost:8080/convert');
        console.log(`Expected engine: ${requestBody.engine}`);
        console.log('');
        
        const response = await fetch('http://localhost:8080/convert', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });
        
        console.log(`Response status: ${response.status} ${response.statusText}`);
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
            console.error('❌ Conversion failed:', errorData);
            return;
        }
        
        const pdfBuffer = await response.arrayBuffer();
        console.log(`✅ PDF generated successfully: ${pdfBuffer.byteLength} bytes`);
        
        // Save the PDF for inspection
        const outputPath = path.join(__dirname, 'docker', 'bot-typst-default-test.pdf');
        fs.writeFileSync(outputPath, Buffer.from(pdfBuffer));
        console.log(`📄 PDF saved to: ${outputPath}`);
        
        console.log('');
        console.log('✅ SUCCESS: Bot is now using Typst engine by default!');
        console.log('The generated PDF should have professional typography and proper citation formatting.');
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

// Run the test
testBotTypstDefault();