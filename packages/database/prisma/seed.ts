import { PrismaClient, UserRole, ManuscriptStatus, ConversationType, PrivacyLevel } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...');

  // Create journal settings
  const journalSettings = await prisma.journalSettings.upsert({
    where: { id: 'singleton' },
    update: {},
    create: {
      id: 'singleton',
      name: 'Colloquium Journal',
      description: 'An academic journal powered by the Colloquium platform - democratizing scientific publishing through conversational review.',
      settings: {
        allowPublicSubmissions: true,
        requireOrcid: false,
        enableBots: true,
        reviewDeadlineDays: 30,
        revisionDeadlineDays: 60
      }
    }
  });

  console.log('✅ Journal settings created');

  // Create admin user
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@colloquium.example.com' },
    update: {},
    create: {
      email: 'admin@colloquium.example.com',
      name: 'Admin User',
      role: UserRole.ADMIN
    }
  });

  // Create editor user
  const editorUser = await prisma.user.upsert({
    where: { email: 'editor@colloquium.example.com' },
    update: {},
    create: {
      email: 'editor@colloquium.example.com',
      name: 'Editor User',
      role: UserRole.EDITOR
    }
  });

  // Create sample author
  const authorUser = await prisma.user.upsert({
    where: { email: 'author@colloquium.example.com' },
    update: {},
    create: {
      email: 'author@colloquium.example.com',
      name: 'Sample Author',
      role: UserRole.AUTHOR
    }
  });

  // Create sample reviewer
  const reviewerUser = await prisma.user.upsert({
    where: { email: 'reviewer@colloquium.example.com' },
    update: {},
    create: {
      email: 'reviewer@colloquium.example.com',
      name: 'Sample Reviewer',
      role: UserRole.REVIEWER
    }
  });

  console.log('✅ Sample users created');

  // Create sample manuscript (only if it doesn't exist)
  const existingManuscript = await prisma.manuscript.findFirst({
    where: { title: 'A Novel Approach to Academic Publishing: The Colloquium Platform' }
  });

  const manuscript = existingManuscript || await prisma.manuscript.create({
    data: {
      title: 'A Novel Approach to Academic Publishing: The Colloquium Platform',
      abstract: 'This paper introduces Colloquium, an open-source platform that democratizes scientific journal publishing through conversational review processes and an extensible bot ecosystem. We demonstrate how this approach can reduce barriers to academic publishing while maintaining rigorous peer review standards.',
      content: `# A Novel Approach to Academic Publishing: The Colloquium Platform

## Abstract

This paper introduces Colloquium, an open-source platform that democratizes scientific journal publishing through conversational review processes and an extensible bot ecosystem.

## Introduction

Traditional academic publishing has created significant barriers for researchers, particularly those from smaller institutions or developing countries. The Colloquium platform addresses these challenges by providing...

## Methodology

We developed a web-based platform using modern technologies including Next.js, Express.js, and PostgreSQL. The system implements...

## Results

Initial testing shows that the conversational review process leads to more constructive feedback and faster review cycles...

## Conclusion

The Colloquium platform represents a significant step forward in democratizing academic publishing...`,
      status: ManuscriptStatus.UNDER_REVIEW,
      authors: {
        create: [
          {
            userId: authorUser.id,
            order: 0,
            isCorresponding: true
          }
        ]
      }
    }
  });

  console.log(existingManuscript ? '✅ Sample manuscript already exists' : '✅ Sample manuscript created');

  // Create sample conversation (only if it doesn't exist)
  const existingConversation = await prisma.conversation.findFirst({
    where: { 
      manuscriptId: manuscript.id,
      title: 'Editorial Review Discussion'
    }
  });

  const conversation = existingConversation || await prisma.conversation.create({
    data: {
      title: 'Editorial Review Discussion',
      type: ConversationType.EDITORIAL,
      privacy: PrivacyLevel.PRIVATE,
      manuscriptId: manuscript.id,
      participants: {
        create: [
          {
            userId: editorUser.id,
            role: 'MODERATOR'
          },
          {
            userId: adminUser.id,
            role: 'PARTICIPANT'
          }
        ]
      },
      messages: {
        create: [
          {
            content: 'This manuscript looks promising. The approach to conversational review is novel and could have significant impact on academic publishing. I recommend sending it out for peer review.',
            authorId: editorUser.id
          },
          {
            content: 'I agree. The technical implementation seems sound and the use case is compelling. Let\'s assign reviewers from our network.',
            authorId: adminUser.id
          }
        ]
      }
    }
  });

  console.log(existingConversation ? '✅ Sample conversation already exists' : '✅ Sample conversation created');

  // Create core bot definitions
  const plagiarismBot = await prisma.botDefinition.upsert({
    where: { id: 'plagiarism-checker' },
    update: {},
    create: {
      id: 'plagiarism-checker',
      name: 'Plagiarism Checker',
      description: 'Checks manuscripts for potential plagiarism using multiple databases and algorithms',
      version: '1.0.0',
      author: 'Colloquium Team',
      isPublic: true,
      configSchema: {
        type: 'object',
        properties: {
          databases: {
            type: 'array',
            items: { type: 'string' },
            default: ['crossref', 'pubmed', 'arxiv']
          },
          threshold: {
            type: 'number',
            minimum: 0,
            maximum: 1,
            default: 0.15
          },
          excludeReferences: {
            type: 'boolean',
            default: true
          }
        }
      }
    }
  });

  const statsBot = await prisma.botDefinition.upsert({
    where: { id: 'statistics-reviewer' },
    update: {},
    create: {
      id: 'statistics-reviewer',
      name: 'Statistics Reviewer',
      description: 'Reviews statistical methods and analyses in manuscripts',
      version: '1.0.0',
      author: 'Colloquium Team',
      isPublic: true,
      configSchema: {
        type: 'object',
        properties: {
          checkMethods: {
            type: 'array',
            items: { type: 'string' },
            default: ['anova', 'regression', 'ttest']
          },
          requireEffectSizes: {
            type: 'boolean',
            default: true
          },
          requireConfidenceIntervals: {
            type: 'boolean',
            default: true
          }
        }
      }
    }
  });

  // Install bots (use upsert to handle existing installations)
  await prisma.botInstall.upsert({
    where: { botId: plagiarismBot.id },
    update: {
      config: {
        autoTrigger: true,
        triggerOnSubmission: true
      }
    },
    create: {
      botId: plagiarismBot.id,
      config: {
        autoTrigger: true,
        triggerOnSubmission: true
      }
    }
  });

  await prisma.botInstall.upsert({
    where: { botId: statsBot.id },
    update: {
      config: {
        autoTrigger: false,
        requireExplicitMention: true
      }
    },
    create: {
      botId: statsBot.id,
      config: {
        autoTrigger: false,
        requireExplicitMention: true
      }
    }
  });

  console.log('✅ Sample bots created and installed');

  // Create additional published manuscripts for the feed
  const publishedManuscripts = [
    {
      title: 'Machine Learning Applications in Peer Review Automation',
      abstract: 'This study explores the use of machine learning algorithms to assist in the peer review process, examining effectiveness and bias reduction in academic publishing.',
      authors: ['Dr. Sarah Johnson', 'Prof. Michael Chen'],
      keywords: ['machine learning', 'peer review', 'automation', 'bias reduction'],
      publishedAt: new Date('2024-01-15')
    },
    {
      title: 'Blockchain Technology for Transparent Academic Publishing',
      abstract: 'We present a blockchain-based system for ensuring transparency and immutability in academic publishing, addressing concerns about research integrity.',
      authors: ['Prof. Elena Rodriguez', 'Dr. James Kim', 'Dr. Maria Santos'],
      keywords: ['blockchain', 'transparency', 'publishing', 'research integrity'],
      publishedAt: new Date('2024-01-10')
    },
    {
      title: 'Open Science Platforms: A Comparative Analysis',
      abstract: 'A comprehensive comparison of modern open science platforms, evaluating their impact on research collaboration and knowledge dissemination.',
      authors: ['Dr. Robert Wilson'],
      keywords: ['open science', 'collaboration', 'platforms', 'knowledge dissemination'],
      publishedAt: new Date('2024-01-05')
    },
    {
      title: 'Digital Transformation in Academic Libraries',
      abstract: 'This paper examines how academic libraries are adapting to digital transformation, focusing on new services and changing user needs.',
      authors: ['Dr. Lisa Anderson', 'Prof. David Lee'],
      keywords: ['digital transformation', 'academic libraries', 'services', 'user needs'],
      publishedAt: new Date('2023-12-28')
    },
    {
      title: 'Collaborative Research Networks in the Digital Age',
      abstract: 'An analysis of how digital tools are reshaping collaborative research networks and enabling new forms of scientific cooperation.',
      authors: ['Prof. Anna Thompson', 'Dr. Carlos Mendez', 'Dr. Jennifer Wu'],
      keywords: ['collaboration', 'research networks', 'digital tools', 'cooperation'],
      publishedAt: new Date('2023-12-20')
    }
  ];

  for (const manuscriptData of publishedManuscripts) {
    const existingPub = await prisma.manuscript.findFirst({
      where: { title: manuscriptData.title }
    });

    if (!existingPub) {
      await prisma.manuscript.create({
        data: {
          title: manuscriptData.title,
          abstract: manuscriptData.abstract,
          content: `# ${manuscriptData.title}

## Abstract

${manuscriptData.abstract}

## Introduction

This section introduces the research topic and provides background context...

## Methodology

This section describes the research methods and approaches used...

## Results

This section presents the findings and analysis...

## Discussion

This section discusses the implications and significance of the results...

## Conclusion

This section summarizes the key findings and future directions...

## References

1. Reference 1...
2. Reference 2...
3. Reference 3...`,
          status: ManuscriptStatus.PUBLISHED,
          authors: manuscriptData.authors,
          keywords: manuscriptData.keywords,
          publishedAt: manuscriptData.publishedAt,
          fileUrl: `/manuscripts/${manuscriptData.title.toLowerCase().replace(/[^a-z0-9]/g, '-')}.pdf`
        }
      });
    }
  }

  console.log('✅ Published manuscripts created');

  console.log('🎉 Database seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });