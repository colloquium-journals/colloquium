#!/usr/bin/env node

/**
 * Test the bot's citation processing with the corrected template and variables
 */

const fs = require('fs');
const path = require('path');

async function testBotCitationProcessing() {
    try {
        console.log('Testing bot citation processing...');
        console.log('='.repeat(60));
        
        // Load the actual bot template
        const templatePath = path.join(__dirname, 'templates', 'academic-standard.html');
        const template = fs.readFileSync(templatePath, 'utf-8');
        
        const testMarkdown = `# Machine Learning in Scientific Publishing

This document demonstrates citation processing in academic manuscripts.

## Introduction

Recent research has shown significant advances in automated manuscript processing [@smith2020]. Multiple studies have explored the integration of citation management systems [@jones2021; @brown2019].

## Methodology  

As demonstrated by Wilson [@wilson2022], effective template systems are crucial for academic publishing workflows.

## Conclusion

This approach shows promise for automated academic publishing systems.

## References

The bibliography should appear below.
`;

const testBibliography = `@article{smith2020,
  title={A Study of Citation Processing},
  author={Smith, John},
  journal={Journal of Academic Testing},
  volume={15},
  number={3},
  pages={123--145},
  year={2020},
  publisher={Academic Press}
}

@article{jones2021,
  title={Modern Citation Techniques},
  author={Jones, Sarah and Miller, David},
  journal={Citation Review},
  volume={8},
  number={2},
  pages={67--89},
  year={2021}
}

@article{brown2019,
  title={Bibliography Management Systems},
  author={Brown, Michael},
  journal={Tech Tools Quarterly},
  volume={12},
  number={4},
  pages={200--215},
  year={2019}
}

@article{wilson2022,
  title={Effective Academic Writing},
  author={Wilson, Emma},
  journal={Writing Studies},
  volume={25},
  number={1},
  pages={45--62},
  year={2022}
}`;

        const requestBody = {
            markdown: testMarkdown,
            engine: 'html',
            template: template,
            variables: {
                title: 'Machine Learning in Scientific Publishing',
                author: ['Dr. Jane Smith', 'Prof. John Doe'],
                abstract: 'This paper demonstrates the citation processing capabilities of the markdown-renderer-bot in academic publishing workflows.',
                date: '2025-01-11',
                journal: 'Colloquium Demo Journal',
                customcss: ''
            },
            outputFormat: 'pdf',
            bibliography: testBibliography
        };
        
        console.log('Sending request to http://localhost:8080/convert');
        console.log('Request includes:');
        console.log(`- Markdown: ${testMarkdown.length} characters`);
        console.log(`- Bibliography: ${testBibliography.length} characters`);
        console.log(`- Citations in markdown: ${(testMarkdown.match(/\[@[^\]]+\]/g) || []).length}`);
        console.log(`- Bibliography entries: ${(testBibliography.match(/@\w+\{/g) || []).length}`);
        console.log(`- Using template: academic-standard.html`);
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
            console.error('Conversion failed:', errorData);
            return;
        }
        
        const pdfBuffer = await response.arrayBuffer();
        console.log(`PDF generated successfully: ${pdfBuffer.byteLength} bytes`);
        
        // Save the PDF for inspection
        const outputPath = path.join(__dirname, 'docker', 'bot-citation-test.pdf');
        fs.writeFileSync(outputPath, Buffer.from(pdfBuffer));
        console.log(`PDF saved to: ${outputPath}`);
        
        console.log('✅ SUCCESS: Bot citation processing test completed!');
        
    } catch (error) {
        console.error('Test failed:', error.message);
    }
}

// Run the test
testBotCitationProcessing();