import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient();

async function seedFormats() {
  console.log('🌱 Seeding supported formats...');

  const formats = [
    {
      name: 'markdown',
      displayName: 'Markdown',
      fileExtensions: ['.md', '.markdown'],
      mimeTypes: ['text/markdown', 'text/x-markdown', 'text/plain'],
      description: 'Markdown text format for easy writing and formatting'
    },
    {
      name: 'latex',
      displayName: 'LaTeX',
      fileExtensions: ['.tex', '.latex'],
      mimeTypes: ['application/x-latex', 'text/x-tex', 'text/plain'],
      description: 'LaTeX document format for scientific and academic writing'
    },
    {
      name: 'pdf',
      displayName: 'PDF',
      fileExtensions: ['.pdf'],
      mimeTypes: ['application/pdf'],
      description: 'Portable Document Format for finalized documents'
    },
    {
      name: 'docx',
      displayName: 'Microsoft Word',
      fileExtensions: ['.docx', '.doc'],
      mimeTypes: [
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/msword'
      ],
      description: 'Microsoft Word document format'
    },
    {
      name: 'quarto',
      displayName: 'Quarto',
      fileExtensions: ['.qmd'],
      mimeTypes: ['text/markdown', 'text/x-markdown', 'text/plain'],
      description: 'Quarto document format for reproducible research'
    },
    {
      name: 'rmarkdown',
      displayName: 'R Markdown',
      fileExtensions: ['.rmd', '.Rmd'],
      mimeTypes: ['text/markdown', 'text/x-markdown', 'text/plain'],
      description: 'R Markdown format for data analysis and reporting'
    },
    {
      name: 'jupyter',
      displayName: 'Jupyter Notebook',
      fileExtensions: ['.ipynb'],
      mimeTypes: ['application/json', 'text/plain'],
      description: 'Jupyter Notebook format for interactive computing'
    },
    {
      name: 'html',
      displayName: 'HTML',
      fileExtensions: ['.html', '.htm'],
      mimeTypes: ['text/html'],
      description: 'HTML format for web-based documents'
    }
  ];

  for (const formatData of formats) {
    const existingFormat = await prisma.supported_formats.findUnique({
      where: { name: formatData.name }
    });

    if (!existingFormat) {
      await prisma.supported_formats.create({
        data: {
          id: randomUUID(),
          name: formatData.name,
          displayName: formatData.displayName,
          fileExtensions: formatData.fileExtensions,
          mimeTypes: formatData.mimeTypes,
          description: formatData.description,
          isActive: true,
          updatedAt: new Date()
        }
      });
      console.log(`✅ Created format: ${formatData.displayName}`);
    } else {
      console.log(`⏭️  Format already exists: ${formatData.displayName}`);
    }
  }

  console.log('✅ Format seeding complete!');
}

seedFormats()
  .catch((e) => {
    console.error('❌ Error seeding formats:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });