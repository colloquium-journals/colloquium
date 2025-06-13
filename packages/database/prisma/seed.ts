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
      config: {
        databases: ['crossref', 'pubmed', 'arxiv'],
        threshold: 0.15,
        excludeReferences: true
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
      config: {
        checkMethods: ['anova', 'regression', 'ttest'],
        requireEffectSizes: true,
        requireConfidenceIntervals: true
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