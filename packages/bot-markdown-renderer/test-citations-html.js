#!/usr/bin/env node

/**
 * Test citation processing with HTML output for easier inspection
 */

const testMarkdown = `# Test Document with Citations

This is a test document to verify citation processing. Here are some test citations:

- Citation 1: This is supported by research [@smith2020].
- Citation 2: Multiple studies show this [@jones2021; @brown2019].
- Citation 3: As demonstrated by [@wilson2022], this approach is effective.

## References

The bibliography should appear below this section.
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

const testTemplate = `<!DOCTYPE html>
<html>
<head>
    <title>Citation Test</title>
    <style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
        .references { margin-top: 30px; border-top: 2px solid #ccc; padding-top: 20px; }
        .citation { color: blue; }
        #refs { background: #f9f9f9; padding: 15px; }
    </style>
</head>
<body>
    <h1>Citation Processing Test</h1>
    <div class="content">
$body$
    </div>
    <!-- Bibliography will be inserted here by Pandoc -->
    <div id="refs" class="references">
        <h2>References</h2>
    </div>
</body>
</html>`;

async function testCitationProcessing() {
    try {
        console.log('Testing citation processing with HTML output...');
        console.log('='.repeat(60));
        
        const requestBody = {
            markdown: testMarkdown,
            engine: 'html',
            template: testTemplate,
            variables: {},
            outputFormat: 'html',
            bibliography: testBibliography
        };
        
        console.log('Sending request to http://localhost:8080/convert');
        console.log('Request includes:');
        console.log(`- Markdown: ${testMarkdown.length} characters`);
        console.log(`- Bibliography: ${testBibliography.length} characters`);
        console.log(`- Citations in markdown: ${(testMarkdown.match(/\[@[^\]]+\]/g) || []).length}`);
        console.log(`- Bibliography entries: ${(testBibliography.match(/@\w+\{/g) || []).length}`);
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
        
        const htmlContent = await response.text();
        console.log(`HTML generated successfully: ${htmlContent.length} characters`);
        
        // Save the HTML for inspection
        const fs = require('fs');
        const path = require('path');
        const outputPath = path.join(__dirname, 'docker', 'citation-test.html');
        fs.writeFileSync(outputPath, htmlContent);
        console.log(`HTML saved to: ${outputPath}`);
        
        // Check for citation processing in the HTML
        console.log('\n=== CITATION ANALYSIS ===');
        const stillHasBracketCitations = (htmlContent.match(/\[@[^\]]+\]/g) || []).length;
        const hasProcessedCitations = htmlContent.includes('id="ref-') || htmlContent.includes('class="citation');
        const hasBibliography = htmlContent.includes('#refs') && htmlContent.includes('Smith, John');
        
        console.log(`Unprocessed bracket citations remaining: ${stillHasBracketCitations}`);
        console.log(`Has processed citation elements: ${hasProcessedCitations}`);
        console.log(`Has bibliography content: ${hasBibliography}`);
        
        if (stillHasBracketCitations > 0) {
            console.log('❌ PROBLEM: Citations were not processed by Pandoc!');
        } else if (hasProcessedCitations && hasBibliography) {
            console.log('✅ SUCCESS: Citations appear to be processed correctly!');
        } else {
            console.log('⚠️  UNCLEAR: Citations may be partially processed');
        }
        
        // Show a sample of the content
        console.log('\n=== HTML CONTENT SAMPLE ===');
        console.log(htmlContent.substring(0, 1000));
        
    } catch (error) {
        console.error('Test failed:', error.message);
    }
}

// Run the test
testCitationProcessing();