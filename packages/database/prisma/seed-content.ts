/**
 * Realistic seed content for Colloquium
 * Generates academic-style papers with proper markdown structure and chart images
 */

import * as fs from 'fs';
import * as path from 'path';
import * as zlib from 'zlib';

// ============================================================================
// PNG Generation Utilities
// ============================================================================

function crc32(data: Buffer): number {
  let crc = 0xFFFFFFFF;
  const table = getCRC32Table();
  for (let i = 0; i < data.length; i++) {
    crc = (crc >>> 8) ^ table[(crc ^ data[i]) & 0xFF];
  }
  return crc ^ 0xFFFFFFFF;
}

let crc32Table: number[] | null = null;
function getCRC32Table(): number[] {
  if (crc32Table) return crc32Table;
  crc32Table = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    crc32Table[n] = c;
  }
  return crc32Table;
}

function createPNGChunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const typeBuffer = Buffer.from(type, 'ascii');
  const crcData = Buffer.concat([typeBuffer, data]);
  const crc = crc32(crcData);
  const crcBuffer = Buffer.alloc(4);
  crcBuffer.writeUInt32BE(crc >>> 0);
  return Buffer.concat([length, typeBuffer, data, crcBuffer]);
}

interface RGB { r: number; g: number; b: number; }

function createPNG(width: number, height: number, pixels: RGB[][]): Buffer {
  const signature = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);

  // IHDR chunk
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData.writeUInt8(8, 8);   // bit depth
  ihdrData.writeUInt8(2, 9);   // color type (RGB)
  ihdrData.writeUInt8(0, 10);  // compression
  ihdrData.writeUInt8(0, 11);  // filter
  ihdrData.writeUInt8(0, 12);  // interlace
  const ihdrChunk = createPNGChunk('IHDR', ihdrData);

  // Raw image data with filter bytes
  const rawData: number[] = [];
  for (let y = 0; y < height; y++) {
    rawData.push(0); // filter type: none
    for (let x = 0; x < width; x++) {
      const pixel = pixels[y][x];
      rawData.push(pixel.r, pixel.g, pixel.b);
    }
  }

  // Compress with zlib
  const compressed = zlib.deflateSync(Buffer.from(rawData), { level: 9 });
  const idatChunk = createPNGChunk('IDAT', compressed);

  // IEND chunk
  const iendChunk = createPNGChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

// ============================================================================
// Chart Image Generators
// ============================================================================

const COLORS = {
  background: { r: 255, g: 255, b: 255 },
  axis: { r: 60, g: 60, b: 60 },
  gridLine: { r: 230, g: 230, b: 230 },
  bar1: { r: 66, g: 133, b: 244 },   // Google Blue
  bar2: { r: 52, g: 168, b: 83 },    // Google Green
  bar3: { r: 251, g: 188, b: 5 },    // Google Yellow
  bar4: { r: 234, g: 67, b: 53 },    // Google Red
  line1: { r: 66, g: 133, b: 244 },
  line2: { r: 234, g: 67, b: 53 },
  text: { r: 80, g: 80, b: 80 },
};

function createBarChart(width: number, height: number, values: number[], title?: string): Buffer {
  const pixels: RGB[][] = Array(height).fill(null).map(() =>
    Array(width).fill(null).map(() => ({ ...COLORS.background }))
  );

  const margin = { top: 40, right: 30, bottom: 40, left: 50 };
  const chartWidth = width - margin.left - margin.right;
  const chartHeight = height - margin.top - margin.bottom;

  const maxValue = Math.max(...values) * 1.1;
  const barWidth = Math.floor(chartWidth / values.length) - 10;
  const barColors = [COLORS.bar1, COLORS.bar2, COLORS.bar3, COLORS.bar4];

  // Draw grid lines
  for (let i = 0; i <= 5; i++) {
    const y = margin.top + Math.floor(chartHeight * (1 - i / 5));
    for (let x = margin.left; x < width - margin.right; x++) {
      if (y >= 0 && y < height) pixels[y][x] = { ...COLORS.gridLine };
    }
  }

  // Draw bars
  values.forEach((value, i) => {
    const barHeight = Math.floor((value / maxValue) * chartHeight);
    const barX = margin.left + i * Math.floor(chartWidth / values.length) + 5;
    const barY = margin.top + chartHeight - barHeight;
    const color = barColors[i % barColors.length];

    for (let y = barY; y < margin.top + chartHeight; y++) {
      for (let x = barX; x < barX + barWidth && x < width - margin.right; x++) {
        if (y >= 0 && y < height && x >= 0 && x < width) {
          pixels[y][x] = { ...color };
        }
      }
    }
  });

  // Draw axes
  for (let y = margin.top; y <= margin.top + chartHeight; y++) {
    if (y >= 0 && y < height) pixels[y][margin.left] = { ...COLORS.axis };
  }
  for (let x = margin.left; x <= width - margin.right; x++) {
    const y = margin.top + chartHeight;
    if (y >= 0 && y < height && x >= 0 && x < width) pixels[y][x] = { ...COLORS.axis };
  }

  return createPNG(width, height, pixels);
}

function createLineChart(width: number, height: number, datasets: number[][]): Buffer {
  const pixels: RGB[][] = Array(height).fill(null).map(() =>
    Array(width).fill(null).map(() => ({ ...COLORS.background }))
  );

  const margin = { top: 30, right: 30, bottom: 40, left: 50 };
  const chartWidth = width - margin.left - margin.right;
  const chartHeight = height - margin.top - margin.bottom;

  const allValues = datasets.flat();
  const maxValue = Math.max(...allValues) * 1.1;
  const minValue = Math.min(0, Math.min(...allValues));
  const lineColors = [COLORS.line1, COLORS.line2, COLORS.bar3, COLORS.bar2];

  // Draw grid lines
  for (let i = 0; i <= 5; i++) {
    const y = margin.top + Math.floor(chartHeight * (1 - i / 5));
    for (let x = margin.left; x < width - margin.right; x++) {
      if (y >= 0 && y < height) pixels[y][x] = { ...COLORS.gridLine };
    }
  }

  // Draw lines
  datasets.forEach((data, datasetIndex) => {
    const color = lineColors[datasetIndex % lineColors.length];
    const points = data.map((value, i) => ({
      x: margin.left + Math.floor((i / (data.length - 1)) * chartWidth),
      y: margin.top + Math.floor(chartHeight * (1 - (value - minValue) / (maxValue - minValue)))
    }));

    // Draw line segments
    for (let i = 0; i < points.length - 1; i++) {
      const p1 = points[i];
      const p2 = points[i + 1];

      // Bresenham's line algorithm
      let x0 = p1.x, y0 = p1.y, x1 = p2.x, y1 = p2.y;
      const dx = Math.abs(x1 - x0);
      const dy = Math.abs(y1 - y0);
      const sx = x0 < x1 ? 1 : -1;
      const sy = y0 < y1 ? 1 : -1;
      let err = dx - dy;

      while (true) {
        // Draw thick line (3 pixels)
        for (let ty = -1; ty <= 1; ty++) {
          for (let tx = -1; tx <= 1; tx++) {
            const px = x0 + tx;
            const py = y0 + ty;
            if (py >= 0 && py < height && px >= 0 && px < width) {
              pixels[py][px] = { ...color };
            }
          }
        }
        if (x0 === x1 && y0 === y1) break;
        const e2 = 2 * err;
        if (e2 > -dy) { err -= dy; x0 += sx; }
        if (e2 < dx) { err += dx; y0 += sy; }
      }
    }

    // Draw data points
    points.forEach(p => {
      for (let dy = -3; dy <= 3; dy++) {
        for (let dx = -3; dx <= 3; dx++) {
          if (dx * dx + dy * dy <= 9) {
            const px = p.x + dx;
            const py = p.y + dy;
            if (py >= 0 && py < height && px >= 0 && px < width) {
              pixels[py][px] = { ...color };
            }
          }
        }
      }
    });
  });

  // Draw axes
  for (let y = margin.top; y <= margin.top + chartHeight; y++) {
    if (y >= 0 && y < height) pixels[y][margin.left] = { ...COLORS.axis };
  }
  for (let x = margin.left; x <= width - margin.right; x++) {
    const y = margin.top + chartHeight;
    if (y >= 0 && y < height && x >= 0 && x < width) pixels[y][x] = { ...COLORS.axis };
  }

  return createPNG(width, height, pixels);
}

function createScatterPlot(width: number, height: number, points: {x: number, y: number}[]): Buffer {
  const pixels: RGB[][] = Array(height).fill(null).map(() =>
    Array(width).fill(null).map(() => ({ ...COLORS.background }))
  );

  const margin = { top: 30, right: 30, bottom: 40, left: 50 };
  const chartWidth = width - margin.left - margin.right;
  const chartHeight = height - margin.top - margin.bottom;

  const maxX = Math.max(...points.map(p => p.x)) * 1.1;
  const maxY = Math.max(...points.map(p => p.y)) * 1.1;

  // Draw grid
  for (let i = 0; i <= 5; i++) {
    const y = margin.top + Math.floor(chartHeight * (1 - i / 5));
    const x = margin.left + Math.floor(chartWidth * i / 5);
    for (let gx = margin.left; gx < width - margin.right; gx++) {
      if (y >= 0 && y < height) pixels[y][gx] = { ...COLORS.gridLine };
    }
    for (let gy = margin.top; gy < margin.top + chartHeight; gy++) {
      if (x >= 0 && x < width) pixels[gy][x] = { ...COLORS.gridLine };
    }
  }

  // Draw points
  points.forEach(point => {
    const px = margin.left + Math.floor((point.x / maxX) * chartWidth);
    const py = margin.top + Math.floor(chartHeight * (1 - point.y / maxY));

    for (let dy = -4; dy <= 4; dy++) {
      for (let dx = -4; dx <= 4; dx++) {
        if (dx * dx + dy * dy <= 16) {
          const x = px + dx;
          const y = py + dy;
          if (y >= 0 && y < height && x >= 0 && x < width) {
            pixels[y][x] = { ...COLORS.bar1 };
          }
        }
      }
    }
  });

  // Draw axes
  for (let y = margin.top; y <= margin.top + chartHeight; y++) {
    pixels[y][margin.left] = { ...COLORS.axis };
  }
  for (let x = margin.left; x <= width - margin.right; x++) {
    pixels[margin.top + chartHeight][x] = { ...COLORS.axis };
  }

  return createPNG(width, height, pixels);
}

// ============================================================================
// Academic Paper Content
// ============================================================================

export const papers = {
  mlPeerReview: {
    title: "Machine Learning Applications in Automated Peer Review Systems",
    abstract: `This study explores the integration of machine learning algorithms into peer review workflows, examining their effectiveness in identifying methodological issues, statistical errors, and potential bias while maintaining reviewer anonymity. We evaluated five different ML approaches on a corpus of 15,000 peer-reviewed manuscripts across multiple disciplines, achieving an accuracy of 87.3% in predicting editorial decisions. Our findings suggest that hybrid human-AI review systems can reduce review times by 40% while maintaining quality standards comparable to traditional peer review.`,
    content: `# Machine Learning Applications in Automated Peer Review Systems

## Abstract

This study explores the integration of machine learning algorithms into peer review workflows, examining their effectiveness in identifying methodological issues, statistical errors, and potential bias while maintaining reviewer anonymity. We evaluated five different ML approaches on a corpus of 15,000 peer-reviewed manuscripts across multiple disciplines, achieving an accuracy of 87.3% in predicting editorial decisions. Our findings suggest that hybrid human-AI review systems can reduce review times by 40% while maintaining quality standards comparable to traditional peer review.

**Keywords:** machine learning, peer review, natural language processing, scholarly communication, automation

## 1. Introduction

The exponential growth of scientific literature has placed unprecedented demands on the peer review system [@smith2023growth; @jones2024peer]. With over 3 million articles published annually across scientific journals, the traditional model of peer review faces significant challenges including reviewer fatigue, delays in publication, and inconsistent quality standards [@brown2023review].

Recent advances in natural language processing (NLP) and machine learning have opened new possibilities for augmenting human peer review with automated assistance [@garcia2024automation]. These systems can potentially identify common issues such as statistical errors, methodological concerns, and plagiarism more efficiently than manual review alone.

This paper presents a comprehensive evaluation of machine learning approaches to automated peer review, with the following contributions:

1. A systematic comparison of five ML architectures for manuscript quality assessment
2. A novel dataset of 15,000 annotated peer reviews across 12 disciplines
3. Empirical evidence for the effectiveness of hybrid human-AI review systems
4. Recommendations for implementing AI-assisted peer review in editorial workflows

## 2. Related Work

### 2.1 Traditional Peer Review Challenges

The peer review process, while essential for maintaining scientific quality, faces several well-documented challenges [@wilson2022traditional]:

- **Reviewer availability**: Finding qualified reviewers willing to volunteer their time has become increasingly difficult
- **Review quality variability**: Studies show significant disagreement between reviewers on the same manuscript
- **Time delays**: Average review times have increased from 80 days in 2010 to 120 days in 2023
- **Bias concerns**: Evidence of bias based on author demographics, institutional affiliation, and geographic location

### 2.2 AI in Scientific Publishing

Previous attempts to apply AI in publishing have focused on narrow tasks:

| Application | Accuracy | Reference |
|------------|----------|-----------|
| Plagiarism detection | 94.2% | Chen et al., 2022 |
| Statistical error flagging | 78.5% | Williams & Park, 2023 |
| Reviewer matching | 82.1% | Kumar et al., 2023 |
| Citation verification | 91.3% | Anderson, 2024 |

Our work extends these efforts by developing an integrated system that addresses multiple aspects of peer review simultaneously.

## 3. Methods

### 3.1 Dataset Construction

We compiled a dataset of 15,000 manuscripts from participating publishers, including:

- 4,500 manuscripts from biomedical journals
- 3,800 manuscripts from physics and engineering
- 3,200 manuscripts from social sciences
- 2,100 manuscripts from computer science
- 1,400 manuscripts from humanities

Each manuscript was paired with its complete peer review history, including reviewer comments, editorial decisions, and revision tracking.

### 3.2 Model Architectures

We evaluated five distinct approaches:

1. **BERT-based classifier**: Fine-tuned SciBERT model for document classification
2. **Hierarchical attention network**: Custom architecture for long document processing
3. **Graph neural network**: Modeling citation relationships and structural features
4. **Ensemble method**: Combining multiple weak learners
5. **Large language model**: GPT-4 with domain-specific prompting

\`\`\`python
# Example: SciBERT fine-tuning configuration
from transformers import AutoModelForSequenceClassification

model = AutoModelForSequenceClassification.from_pretrained(
    'allenai/scibert_scivocab_uncased',
    num_labels=4,  # accept, minor revision, major revision, reject
    problem_type="single_label_classification"
)

training_args = TrainingArguments(
    output_dir='./results',
    learning_rate=2e-5,
    per_device_train_batch_size=8,
    num_train_epochs=5,
    weight_decay=0.01,
)
\`\`\`

### 3.3 Evaluation Metrics

We assessed model performance using:

- **Accuracy**: Overall prediction correctness
- **Cohen's Kappa**: Agreement with human reviewers accounting for chance
- **F1 Score**: Balanced measure of precision and recall
- **Review time reduction**: Efficiency gains compared to manual review

## 4. Results

### 4.1 Prediction Performance

Our evaluation revealed significant differences between approaches:

![Performance comparison across ML models](performance-results.png)

The ensemble method achieved the highest overall accuracy (87.3%), followed by the fine-tuned SciBERT model (84.1%). The large language model showed strong performance on nuanced assessments but lower consistency across disciplines.

### 4.2 Efficiency Gains

Implementation of the AI-assisted system in a pilot study with three journals demonstrated:

- 40% reduction in average review time (from 95 to 57 days)
- 23% decrease in desk rejection rate due to early issue identification
- 15% improvement in reviewer-editor agreement on decisions

### 4.3 Error Analysis

Common failure modes included:

1. **Interdisciplinary manuscripts**: Models trained on discipline-specific data struggled with cross-domain work
2. **Novel methodologies**: Innovative approaches were sometimes flagged as errors
3. **Writing style variations**: Non-native English writing patterns affected predictions

## 5. Discussion

### 5.1 Implications for Editorial Practice

Our results suggest that AI-assisted peer review can meaningfully improve editorial workflows when implemented as a complement to, rather than replacement for, human judgment. Key recommendations include:

1. **Triage applications**: Using ML for initial manuscript screening to identify obvious issues
2. **Reviewer support**: Providing AI-generated summaries and potential concerns to aid human reviewers
3. **Quality assurance**: Automated checking for statistical and methodological standards

### 5.2 Ethical Considerations

The deployment of AI in peer review raises important concerns [@lee2023computational]:

- **Transparency**: Authors should be informed when AI tools are used in their review
- **Accountability**: Clear lines of responsibility for decisions must be maintained
- **Bias mitigation**: Regular auditing for algorithmic bias is essential
- **Privacy**: Handling of unpublished manuscripts requires strict data protection

### 5.3 Limitations

This study has several limitations:

- Dataset drawn primarily from English-language journals
- Retrospective analysis may not fully capture prospective performance
- Participating publishers may not be representative of all journals

## 6. Conclusion

Machine learning offers substantial potential for improving peer review efficiency and consistency. Our evaluation of five approaches demonstrates that ensemble methods combining multiple AI techniques with human oversight achieve the best balance of accuracy and reliability. As scientific publishing continues to grow, such hybrid systems will become increasingly valuable for maintaining quality standards while reducing the burden on human reviewers.

Future work should focus on developing more interpretable models that can explain their assessments, creating discipline-specific adaptations, and conducting prospective trials of AI-assisted review systems.

## Acknowledgments

We thank the participating publishers and the thousands of reviewers whose work made this research possible. This research was supported by the National Science Foundation grant #2024-12345.

## References

Anderson, K. (2024). Automated citation verification in scholarly manuscripts. *Journal of Information Science*, 50(2), 234-251.

Brown, M. et al. (2023). The state of peer review: A comprehensive survey. *Nature Human Behaviour*, 7, 1123-1135.

Chen, L., Wang, H., & Zhang, Y. (2022). Deep learning approaches to plagiarism detection. *IEEE Transactions on Learning Technologies*, 15(4), 456-470.

Garcia, R. & Martinez, S. (2024). Automation in academic publishing: Opportunities and challenges. *Learned Publishing*, 37(1), 45-58.

Jones, A. (2024). Peer review in the age of information overload. *Science*, 383(6680), 234-236.

Kumar, P., Singh, R., & Patel, N. (2023). Intelligent reviewer matching using semantic similarity. *Expert Systems with Applications*, 215, 119-134.

Lee, J. (2023). Computational approaches to research integrity. *Research Ethics*, 19(3), 301-320.

Smith, T. (2023). The growth of scientific literature: Trends and implications. *Scientometrics*, 128, 2341-2360.

Taylor, E. & Roberts, D. (2024). Limitations of automated peer review systems. *Journal of Scholarly Publishing*, 55(2), 112-128.

Williams, S. & Park, J. (2023). Statistical error detection in published research. *PLOS ONE*, 18(5), e0285432.

Wilson, R. (2022). Traditional peer review: Strengths and weaknesses. *European Science Editing*, 48, e85632.
`,
    images: [
      {
        filename: 'performance-results.png',
        generator: () => createBarChart(800, 500, [87.3, 84.1, 79.5, 82.7, 81.2])
      }
    ],
    bibliography: {
      filename: 'references.bib',
      content: `@article{smith2023growth,
  author = {Smith, Thomas},
  title = {The growth of scientific literature: Trends and implications},
  journal = {Scientometrics},
  year = {2023},
  volume = {128},
  pages = {2341--2360},
  doi = {10.1007/s11192-023-04567-8}
}

@article{jones2024peer,
  author = {Jones, Amanda},
  title = {Peer review in the age of information overload},
  journal = {Science},
  year = {2024},
  volume = {383},
  number = {6680},
  pages = {234--236},
  doi = {10.1126/science.adf1234}
}

@article{brown2023review,
  author = {Brown, Michael and Davis, Sarah and Wilson, Robert},
  title = {The state of peer review: A comprehensive survey},
  journal = {Nature Human Behaviour},
  year = {2023},
  volume = {7},
  pages = {1123--1135},
  doi = {10.1038/s41562-023-01567-9}
}

@article{garcia2024automation,
  author = {Garcia, Ricardo and Martinez, Sofia},
  title = {Automation in academic publishing: Opportunities and challenges},
  journal = {Learned Publishing},
  year = {2024},
  volume = {37},
  number = {1},
  pages = {45--58},
  doi = {10.1002/leap.1567}
}

@article{wilson2022traditional,
  author = {Wilson, Robert},
  title = {Traditional peer review: Strengths and weaknesses},
  journal = {European Science Editing},
  year = {2022},
  volume = {48},
  pages = {e85632},
  doi = {10.3897/ese.2022.e85632}
}

@article{lee2023computational,
  author = {Lee, Jennifer},
  title = {Computational approaches to research integrity},
  journal = {Research Ethics},
  year = {2023},
  volume = {19},
  number = {3},
  pages = {301--320},
  doi = {10.1177/17470161231156789}
}

@article{taylor2024limitations,
  author = {Taylor, Elizabeth and Roberts, David},
  title = {Limitations of automated peer review systems},
  journal = {Journal of Scholarly Publishing},
  year = {2024},
  volume = {55},
  number = {2},
  pages = {112--128},
  doi = {10.3138/jsp-2023-0045}
}

@article{chen2022plagiarism,
  author = {Chen, Li and Wang, Hui and Zhang, Yi},
  title = {Deep learning approaches to plagiarism detection},
  journal = {IEEE Transactions on Learning Technologies},
  year = {2022},
  volume = {15},
  number = {4},
  pages = {456--470},
  doi = {10.1109/TLT.2022.3145678}
}

@article{williams2023statistical,
  author = {Williams, Sarah and Park, James},
  title = {Statistical error detection in published research},
  journal = {PLOS ONE},
  year = {2023},
  volume = {18},
  number = {5},
  pages = {e0285432},
  doi = {10.1371/journal.pone.0285432}
}

@article{kumar2023reviewer,
  author = {Kumar, Priya and Singh, Raj and Patel, Neha},
  title = {Intelligent reviewer matching using semantic similarity},
  journal = {Expert Systems with Applications},
  year = {2023},
  volume = {215},
  pages = {119--134},
  doi = {10.1016/j.eswa.2022.119456}
}

@article{anderson2024citation,
  author = {Anderson, Kevin},
  title = {Automated citation verification in scholarly manuscripts},
  journal = {Journal of Information Science},
  year = {2024},
  volume = {50},
  number = {2},
  pages = {234--251},
  doi = {10.1177/01655515231234567}
}
`
    }
  },

  colloquiumPlatform: {
    title: "A Novel Approach to Academic Publishing: The Colloquium Platform",
    abstract: `We present Colloquium, an open-source platform for academic publishing that reimagines the peer review process through conversational interfaces and transparent workflows. The platform integrates modern web technologies with established scholarly communication practices, enabling real-time collaboration between authors, reviewers, and editors. Early adoption studies with three pilot journals demonstrate a 35% improvement in author satisfaction and 28% reduction in time-to-decision compared to traditional submission systems.`,
    content: `# A Novel Approach to Academic Publishing: The Colloquium Platform

## Abstract

We present Colloquium, an open-source platform for academic publishing that reimagines the peer review process through conversational interfaces and transparent workflows. The platform integrates modern web technologies with established scholarly communication practices, enabling real-time collaboration between authors, reviewers, and editors. Early adoption studies with three pilot journals demonstrate a 35% improvement in author satisfaction and 28% reduction in time-to-decision compared to traditional submission systems.

**Keywords:** scholarly publishing, open source, peer review, conversational interfaces, academic journals

## 1. Introduction

Academic publishing infrastructure has remained largely unchanged for decades, despite revolutionary advances in web technology and communication tools [@johnson2023future]. Traditional manuscript submission systems often create friction between stakeholders, leading to delays, miscommunication, and frustration for authors and reviewers alike.

The Colloquium platform addresses these challenges by fundamentally rethinking how participants in the peer review process interact. Rather than treating peer review as a sequence of discrete document exchanges, Colloquium models it as an ongoing conversation with clear protocols and transparent progress tracking.

### 1.1 Design Principles

The platform was developed according to five core principles:

1. **Transparency**: All participants can see the status of reviews and editorial decisions in real-time
2. **Collaboration**: Authors and reviewers can engage in structured dialogue to clarify concerns
3. **Efficiency**: Automated workflows reduce administrative overhead for editors
4. **Openness**: The entire platform is open-source, allowing community contribution and customization
5. **Accessibility**: Modern, responsive interfaces that work across devices and assistive technologies

## 2. System Architecture

### 2.1 Technical Stack

Colloquium is built using a modern, scalable architecture:

![System architecture diagram](system-architecture.png)

\`\`\`
┌─────────────────────────────────────────────────────────┐
│                    Frontend (Next.js)                    │
├─────────────────────────────────────────────────────────┤
│  React Components │ Mantine UI │ Real-time Updates (SSE) │
└─────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────┐
│                   Backend (Express.js)                   │
├─────────────────────────────────────────────────────────┤
│  REST API │ Authentication │ Bot Framework │ Job Queue  │
└─────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────┐
│                      Data Layer                          │
├─────────────────────────────────────────────────────────┤
│     PostgreSQL      │      Redis      │   File Storage  │
└─────────────────────────────────────────────────────────┘
\`\`\`

### 2.2 Conversational Model

The core innovation of Colloquium is its conversational model for peer review. Each manuscript is associated with multiple conversation threads:

| Thread Type | Participants | Purpose |
|-------------|--------------|---------|
| Author Discussion | Authors, Editors | General inquiries, submission clarification |
| Editorial | Editors only | Internal decision-making |
| Review | Reviewers, Editors | Review coordination |
| Public | All authenticated users | Post-publication discussion |

### 2.3 Bot Ecosystem

Colloquium includes an extensible bot framework that automates common tasks:

\`\`\`typescript
// Example bot definition
const EditorialBot: BotDefinition = {
  id: 'editorial-bot',
  name: 'Editorial Bot',
  description: 'Assists with manuscript workflows',
  commands: [
    {
      name: 'assign',
      description: 'Assign reviewers to a manuscript',
      execute: async (context, args) => {
        const reviewers = parseReviewerList(args);
        await assignReviewers(context.manuscriptId, reviewers);
        return {
          message: \`Assigned \${reviewers.length} reviewers\`
        };
      }
    },
    // ... additional commands
  ]
};
\`\`\`

## 3. Evaluation

### 3.1 Pilot Study Design

We conducted a 12-month pilot study with three academic journals:

- **Journal A**: Humanities quarterly (250 submissions/year)
- **Journal B**: STEM monthly (1,200 submissions/year)
- **Journal C**: Interdisciplinary open access (800 submissions/year)

### 3.2 Results

Key findings from the pilot study:

**Time-to-Decision Improvements:**
- Initial screening: 5 days → 2 days (60% reduction)
- Review completion: 45 days → 32 days (29% reduction)
- Editorial decision: 7 days → 5 days (29% reduction)
- Overall: 57 days → 41 days (28% reduction)

**Satisfaction Metrics (1-5 scale):**

| Stakeholder | Traditional System | Colloquium | Change |
|-------------|-------------------|------------|--------|
| Authors | 3.2 | 4.3 | +34% |
| Reviewers | 3.0 | 3.9 | +30% |
| Editors | 2.8 | 4.1 | +46% |

### 3.3 Qualitative Feedback

Participants highlighted several advantages:

> "The ability to ask clarifying questions directly to authors saved me significant time and led to more constructive reviews." — Reviewer, Journal B

> "Real-time status updates eliminated the need for constant email inquiries about manuscript progress." — Author

> "The bot automation for routine tasks freed up substantial time for substantive editorial work." — Editor-in-Chief, Journal A

## 4. Discussion

### 4.1 Adoption Considerations

Organizations considering Colloquium should evaluate:

1. **Technical resources**: Self-hosting requires DevOps expertise
2. **Change management**: Staff training and workflow adaptation
3. **Integration needs**: Compatibility with existing systems (ORCID, DOI, etc.)
4. **Community support**: Active development and bug fixes

### 4.2 Limitations

Current limitations include:

- Limited support for complex submission types (datasets, code repositories)
- No built-in typesetting or production workflow
- Requires modern browsers for full functionality

### 4.3 Future Development

Planned enhancements for upcoming releases:

- Integration with preprint servers
- Enhanced analytics dashboard for editors
- Multi-journal federation support
- Improved accessibility compliance (WCAG 2.1 AA)

## 5. Conclusion

The Colloquium platform demonstrates that modernizing scholarly communication infrastructure can yield significant improvements in efficiency and satisfaction without sacrificing the rigor of peer review. By treating peer review as a conversation rather than a transaction, we create opportunities for more constructive and efficient evaluation of scholarly work.

The platform is available as open-source software at https://github.com/colloquium/colloquium under the MIT license. We welcome contributions from the scholarly communication community.

## References

Johnson, R. (2023). The future of scholarly publishing infrastructure. *Journal of Electronic Publishing*, 26(1).

Martinez, L. & Chen, W. (2024). User experience in academic submission systems. *Learned Publishing*, 37(2), 89-104.

Thompson, A. et al. (2023). Open source solutions for academic publishing. *Code4Lib Journal*, 54.
`,
    images: [
      {
        filename: 'system-architecture.png',
        generator: () => createBarChart(700, 400, [95, 87, 92, 78, 85, 91])
      }
    ],
    bibliography: {
      filename: 'references.bib',
      content: `@article{johnson2023future,
  author = {Johnson, Rebecca},
  title = {The future of scholarly publishing infrastructure},
  journal = {Journal of Electronic Publishing},
  year = {2023},
  volume = {26},
  number = {1},
  doi = {10.3998/jep.2023.26.1.001}
}

@article{martinez2024user,
  author = {Martinez, Luis and Chen, Wei},
  title = {User experience in academic submission systems},
  journal = {Learned Publishing},
  year = {2024},
  volume = {37},
  number = {2},
  pages = {89--104},
  doi = {10.1002/leap.1589}
}

@article{thompson2023opensource,
  author = {Thompson, Andrew and Kim, Susan and Patel, Raj},
  title = {Open source solutions for academic publishing},
  journal = {Code4Lib Journal},
  year = {2023},
  volume = {54},
  url = {https://journal.code4lib.org/articles/17234}
}
`
    }
  },

  climateModeling: {
    title: "Interdisciplinary Approaches to Climate Change Modeling: Integrating Physical and Social Systems",
    abstract: `Climate change modeling has traditionally focused on physical Earth systems, with human dimensions often treated as external forcing factors. This paper presents an integrated modeling framework that couples physical climate models with agent-based social simulation, enabling more realistic projections of climate-society feedbacks. We demonstrate the framework using three case studies examining agricultural adaptation, urban heat island dynamics, and coastal migration patterns. Results indicate that models incorporating social dynamics produce significantly different projections than purely physical models, with implications for policy planning.`,
    content: `# Interdisciplinary Approaches to Climate Change Modeling: Integrating Physical and Social Systems

## Abstract

Climate change modeling has traditionally focused on physical Earth systems, with human dimensions often treated as external forcing factors. This paper presents an integrated modeling framework that couples physical climate models with agent-based social simulation, enabling more realistic projections of climate-society feedbacks. We demonstrate the framework using three case studies examining agricultural adaptation, urban heat island dynamics, and coastal migration patterns. Results indicate that models incorporating social dynamics produce significantly different projections than purely physical models, with implications for policy planning.

**Keywords:** climate modeling, agent-based modeling, coupled systems, social-ecological systems, integrated assessment

## 1. Introduction

The challenge of projecting future climate change and its impacts requires understanding not only physical Earth systems but also how human societies respond to and influence environmental change [@ipcc2023]. Traditional climate models treat human activities as prescribed scenarios, missing crucial feedback mechanisms between climate and society.

Recent advances in computational social science and increased computing power have made it feasible to couple detailed social simulations with physical climate models [@smith2024coupling]. This paper presents a framework for such integration and demonstrates its application through three empirical case studies.

## 2. Theoretical Framework

### 2.1 Coupled Human-Natural Systems

Our framework conceptualizes climate-society interactions as a coupled dynamical system:

\`\`\`
dC/dt = f(C, H, E)    # Climate state evolution
dH/dt = g(C, H, P)    # Human behavior adaptation
dE/dt = h(C, H, E)    # Ecosystem dynamics
\`\`\`

Where:
- C: Climate state vector (temperature, precipitation, extremes)
- H: Human activity vector (emissions, land use, migration)
- E: Ecosystem state vector (vegetation, carbon stocks)
- P: Policy interventions

### 2.2 Agent-Based Social Component

The social simulation component models individual and institutional actors:

| Agent Type | Decision Rules | Spatial Scale |
|------------|---------------|---------------|
| Households | Utility maximization with bounded rationality | Parcel/building |
| Farmers | Crop choice, irrigation, land conversion | Farm plot |
| Firms | Production, location, technology adoption | Facility |
| Governments | Policy implementation, infrastructure | Jurisdiction |

## 3. Methods

### 3.1 Model Coupling Architecture

We developed a modular coupling framework allowing different models to exchange information at specified intervals:

![Model coupling architecture](coupling-diagram.png)

The coupling process involves:

1. **Downscaling**: Translating coarse climate model output to agent-relevant scales
2. **Impact assessment**: Computing climate effects on agent utilities and constraints
3. **Behavioral simulation**: Running agent decisions for the coupling interval
4. **Upscaling**: Aggregating agent behaviors to climate-relevant variables
5. **Feedback**: Passing updated human activities to the climate model

### 3.2 Case Study Regions

We applied the framework to three regions representing different climate-society interactions:

**Case Study A: Midwest US Agricultural Region**
- 500 km × 500 km domain
- 12,000 simulated farm agents
- Focus: Crop switching, irrigation adoption, land abandonment

**Case Study B: Phoenix Metropolitan Area**
- 100 km × 100 km domain
- 250,000 household agents
- Focus: Urban heat adaptation, residential mobility

**Case Study C: Bangladesh Coastal Zone**
- 200 km × 150 km domain
- 50,000 household agents
- Focus: Sea level rise response, migration

## 4. Results

### 4.1 Agricultural Adaptation (Case Study A)

The coupled model revealed significant differences from uncoupled projections:

**Crop Distribution Changes by 2050:**

| Crop | Uncoupled Model | Coupled Model | Difference |
|------|-----------------|---------------|------------|
| Corn | -15% | -8% | +7% |
| Soybeans | +12% | +22% | +10% |
| Wheat | +3% | -5% | -8% |

The coupled model showed farmers adapting more rapidly to changing conditions through:
- Earlier adoption of drought-tolerant varieties
- Expansion of irrigation infrastructure
- Diversification into new crops

### 4.2 Urban Heat Dynamics (Case Study B)

Phoenix simulations demonstrated strong human-climate feedbacks:

![Urban heat feedback results](heat-feedback.png)

Key findings:
- Household AC adoption amplifies urban heat island by 1.2°C
- High-income migration to cooler areas increases segregation
- Green infrastructure investments show 15-year payback through reduced cooling demand

### 4.3 Coastal Migration (Case Study C)

Bangladesh projections showed non-linear migration responses:

- Below 30 cm sea level rise: Adaptation dominates (barriers, elevation)
- 30-50 cm: Mixed response with gradual inland migration
- Above 50 cm: Threshold crossing triggers rapid displacement

The uncoupled model significantly underestimated near-term migration while overestimating long-term displacement.

## 5. Discussion

### 5.1 Implications for Climate Projections

Our results demonstrate that human behavioral responses can substantially modify climate trajectories. Models ignoring these feedbacks may:

1. **Underestimate adaptation**: Missing autonomous responses that reduce damages
2. **Overestimate mitigation needs**: Ignoring behavioral emissions reductions
3. **Mischaracterize uncertainty**: Treating social factors as noise rather than dynamics

### 5.2 Policy Applications

The framework enables evaluation of policy interventions within a dynamic social context:

> "Traditional cost-benefit analysis assumes static populations and behaviors. Our approach shows how policies interact with adaptive responses, often producing counterintuitive outcomes."

### 5.3 Limitations and Future Work

Current limitations include:

- Computational cost restricts ensemble sizes
- Agent decision rules require empirical calibration
- Model coupling introduces numerical artifacts

Ongoing development focuses on:
- GPU-accelerated agent simulation
- Machine learning surrogate models
- Improved uncertainty quantification

## 6. Conclusion

Integrating social dynamics into climate modeling reveals important feedbacks that purely physical models cannot capture. As computing capabilities continue to advance, such coupled approaches should become standard practice for climate impact assessment and policy analysis.

## References

IPCC (2023). Climate Change 2023: Synthesis Report. Cambridge University Press.

Smith, J. & Wong, L. (2024). Coupling agent-based and Earth system models. *Nature Climate Change*, 14, 234-242.

Additional references available in supplementary materials.
`,
    images: [
      {
        filename: 'coupling-diagram.png',
        generator: () => createLineChart(800, 500, [
          [20, 35, 45, 52, 58, 65, 72, 78, 85, 92],
          [20, 28, 38, 55, 70, 82, 88, 91, 93, 95]
        ])
      },
      {
        filename: 'heat-feedback.png',
        generator: () => createScatterPlot(700, 450, [
          {x: 10, y: 22}, {x: 15, y: 28}, {x: 20, y: 35}, {x: 25, y: 38},
          {x: 30, y: 45}, {x: 35, y: 52}, {x: 40, y: 58}, {x: 45, y: 62},
          {x: 50, y: 70}, {x: 55, y: 75}, {x: 60, y: 82}, {x: 65, y: 85},
          {x: 70, y: 88}, {x: 75, y: 90}, {x: 80, y: 92}, {x: 85, y: 94}
        ])
      }
    ],
    bibliography: {
      filename: 'references.bib',
      content: `@report{ipcc2023,
  author = {{IPCC}},
  title = {Climate Change 2023: Synthesis Report},
  institution = {Intergovernmental Panel on Climate Change},
  year = {2023},
  publisher = {Cambridge University Press},
  address = {Cambridge, UK},
  doi = {10.1017/9781009157940}
}

@article{smith2024coupling,
  author = {Smith, Jennifer and Wong, Lisa},
  title = {Coupling agent-based and Earth system models},
  journal = {Nature Climate Change},
  year = {2024},
  volume = {14},
  pages = {234--242},
  doi = {10.1038/s41558-024-01923-5}
}

@article{johnson2023abm,
  author = {Johnson, Mark and Garcia, Elena and Thompson, David},
  title = {Agent-based modeling of climate adaptation decisions},
  journal = {Environmental Modelling \\& Software},
  year = {2023},
  volume = {162},
  pages = {105642},
  doi = {10.1016/j.envsoft.2023.105642}
}

@article{chen2024urban,
  author = {Chen, Wei and Park, Soo-Jin and Williams, Amy},
  title = {Urban heat island dynamics under climate change scenarios},
  journal = {Urban Climate},
  year = {2024},
  volume = {53},
  pages = {101789},
  doi = {10.1016/j.uclim.2024.101789}
}

@article{kumar2023migration,
  author = {Kumar, Anil and Rahman, Faisal and Hossain, Mohammad},
  title = {Climate-induced migration in coastal Bangladesh: A longitudinal study},
  journal = {Global Environmental Change},
  year = {2023},
  volume = {83},
  pages = {102756},
  doi = {10.1016/j.gloenvcha.2023.102756}
}

@article{wilson2024integrated,
  author = {Wilson, Sarah and Brown, Michael and Davis, Robert},
  title = {Integrated assessment modeling with social dynamics},
  journal = {Earth's Future},
  year = {2024},
  volume = {12},
  number = {3},
  pages = {e2023EF004123},
  doi = {10.1029/2023EF004123}
}
`
    }
  }
};

// ============================================================================
// File Creation Utilities
// ============================================================================

export function createSeedFiles(uploadsDir: string): Map<string, { path: string; size: number }> {
  const createdFiles = new Map<string, { path: string; size: number }>();

  // Ensure directory exists
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  // Create markdown files, images, and bibliographies for each paper
  Object.entries(papers).forEach(([key, paper]) => {
    // Create markdown file
    const mdFilename = `${key}.md`;
    const mdPath = path.join(uploadsDir, mdFilename);
    const mdContent = paper.content;
    fs.writeFileSync(mdPath, mdContent, 'utf-8');
    createdFiles.set(mdFilename, { path: `/uploads/manuscripts/${mdFilename}`, size: Buffer.byteLength(mdContent) });
    console.log(`  📄 Created ${mdFilename} (${Buffer.byteLength(mdContent)} bytes)`);

    // Create image files
    paper.images.forEach(img => {
      const imgPath = path.join(uploadsDir, img.filename);
      const imgBuffer = img.generator();
      fs.writeFileSync(imgPath, imgBuffer);
      createdFiles.set(img.filename, { path: `/uploads/manuscripts/${img.filename}`, size: imgBuffer.length });
      console.log(`  📷 Created ${img.filename} (${imgBuffer.length} bytes)`);
    });

    // Create bibliography file if present
    if (paper.bibliography) {
      const bibFilename = `${key}-${paper.bibliography.filename}`;
      const bibPath = path.join(uploadsDir, bibFilename);
      const bibContent = paper.bibliography.content;
      fs.writeFileSync(bibPath, bibContent, 'utf-8');
      createdFiles.set(bibFilename, { path: `/uploads/manuscripts/${bibFilename}`, size: Buffer.byteLength(bibContent) });
      console.log(`  📚 Created ${bibFilename} (${Buffer.byteLength(bibContent)} bytes)`);
    }
  });

  return createdFiles;
}
