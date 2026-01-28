#!/usr/bin/env node

/**
 * Test Typst PDF generation with citations
 */

const fs = require('fs');
const path = require('path');

async function testTypstPDF() {
    try {
        console.log('Testing Typst PDF generation with citations...');
        console.log('='.repeat(60));
        
        // Load the Typst template
        const templatePath = path.join(__dirname, 'templates', 'academic-standard.typ');
        const template = fs.readFileSync(templatePath, 'utf-8');
        
        const testMarkdown = `# Advanced Citation Processing in Academic Publishing

This manuscript demonstrates the superior capabilities of Typst for academic document generation with proper citation handling.

## Introduction

Recent developments in document processing have shown significant improvements [@smith2020]. Multiple research groups have confirmed these findings [@jones2021; @brown2019].

## Methodology

The approach follows established protocols as outlined in @wilson2022. Key advantages include:

- Professional typography
- Superior citation formatting  
- Mathematical notation support
- Cross-references and indexing

## Results

Typst provides excellent output quality compared to HTML-based solutions. The rendering engine handles complex layouts effectively [@smith2020, p. 145].

## Discussion

As noted by @jones2021, modern typesetting systems offer significant advantages over traditional approaches. This is particularly evident in scientific publishing [@brown2019; @wilson2022].

## Conclusion

Typst represents a significant advancement in academic document preparation technology.

## References

Bibliography should be automatically inserted below.
`;

const testBibliography = `@article{smith2020,
  title={Advanced Document Processing: Modern Approaches to Academic Publishing},
  author={Smith, John A. and Davis, Sarah M.},
  journal={Journal of Document Science},
  volume={25},
  number={3},
  pages={134--156},
  year={2020},
  publisher={Academic Press},
  doi={10.1000/182}
}

@article{jones2021,
  title={Typesetting in the Digital Age: Challenges and Opportunities},
  author={Jones, Michael P. and Wilson, Emily R. and Brown, David L.},
  journal={Digital Publishing Review},
  volume={18},
  number={2},
  pages={78--95},
  year={2021},
  publisher={Tech Publications},
  doi={10.1000/183}
}

@article{brown2019,
  title={Citation Management Systems: A Comparative Analysis},
  author={Brown, Lisa K.},
  journal={Academic Technology Quarterly},
  volume={12},
  number={4},
  pages={200--218},
  year={2019},
  publisher={EdTech Publishing},
  doi={10.1000/184}
}

@book{wilson2022,
  title={Modern Academic Writing: Tools and Techniques},
  author={Wilson, Robert J.},
  publisher={University Press},
  year={2022},
  pages={342},
  isbn={978-0-123456-78-9}
}`;

        const requestBody = {
            markdown: testMarkdown,
            engine: 'typst',
            template: template,
            variables: {
                title: 'Advanced Citation Processing in Academic Publishing',
                authors: 'Dr. Jane Smith, Prof. John Doe, Dr. Alice Johnson',
                abstract: 'This paper demonstrates the advanced citation processing capabilities of Typst for academic publishing workflows, showcasing superior typography and document quality compared to HTML-based solutions.',
                submittedDate: '2025-01-11',
                renderDate: '2025-01-11',
                journalName: 'Colloquium Test Journal'
            },
            outputFormat: 'pdf',
            bibliography: testBibliography
        };
        
        console.log('Sending request to http://localhost:8080/convert');
        console.log('Request details:');
        console.log(`- Engine: ${requestBody.engine}`);
        console.log(`- Markdown: ${testMarkdown.length} characters`);
        console.log(`- Bibliography: ${testBibliography.length} characters`);
        console.log(`- Citations in markdown: ${(testMarkdown.match(/\[@[^\]]+\]/g) || []).length}`);
        console.log(`- Author citations: ${(testMarkdown.match(/@\w+/g) || []).length}`);
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
        
        const pdfBuffer = await response.arrayBuffer();
        console.log(`PDF generated successfully: ${pdfBuffer.byteLength} bytes`);
        
        // Save the PDF for inspection
        const outputPath = path.join(__dirname, 'docker', 'typst-citation-test.pdf');
        fs.writeFileSync(outputPath, Buffer.from(pdfBuffer));
        console.log(`PDF saved to: ${outputPath}`);
        
        console.log('✅ SUCCESS: Typst PDF generation with citations completed!');
        console.log('');
        console.log('Expected improvements over HTML/WeasyPrint:');
        console.log('- Professional typography with Times New Roman');
        console.log('- Better citation formatting');
        console.log('- Superior layout and spacing');
        console.log('- Academic-quality output');
        
    } catch (error) {
        console.error('Test failed:', error.message);
    }
}

// Run the test
testTypstPDF();