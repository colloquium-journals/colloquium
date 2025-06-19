import { PrismaClient, GlobalRole, ManuscriptStatus, ConversationType, PrivacyLevel } from '@prisma/client';

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
    update: {
      role: GlobalRole.ADMIN,
      name: 'Admin User'
    },
    create: {
      email: 'admin@colloquium.example.com',
      name: 'Admin User',
      role: GlobalRole.ADMIN
    }
  });

  // Create editor user
  const editorUser = await prisma.user.upsert({
    where: { email: 'editor@colloquium.example.com' },
    update: {
      role: GlobalRole.EDITOR_IN_CHIEF,
      name: 'Editor User'
    },
    create: {
      email: 'editor@colloquium.example.com',
      name: 'Editor User',
      role: GlobalRole.EDITOR_IN_CHIEF
    }
  });

  // Create sample author
  const authorUser = await prisma.user.upsert({
    where: { email: 'author@colloquium.example.com' },
    update: {},
    create: {
      email: 'author@colloquium.example.com',
      name: 'Sample Author',
      role: GlobalRole.USER
    }
  });

  // Create sample reviewer
  const reviewerUser = await prisma.user.upsert({
    where: { email: 'reviewer@colloquium.example.com' },
    update: {},
    create: {
      email: 'reviewer@colloquium.example.com',
      name: 'Sample Reviewer',
      role: GlobalRole.USER
    }
  });

  // Create additional authors for more realistic submissions
  const author2 = await prisma.user.upsert({
    where: { email: 'alice.researcher@university.edu' },
    update: {},
    create: {
      email: 'alice.researcher@university.edu',
      name: 'Dr. Alice Researcher',
      role: GlobalRole.USER,
      orcidId: '0000-0002-1825-0097',
      affiliation: 'University of Technology',
      bio: 'Assistant Professor of Computer Science specializing in machine learning and academic publishing systems.'
    }
  });

  const author3 = await prisma.user.upsert({
    where: { email: 'bob.scientist@research.org' },
    update: {},
    create: {
      email: 'bob.scientist@research.org',
      name: 'Prof. Bob Scientist',
      role: GlobalRole.USER,
      orcidId: '0000-0003-4567-8901',
      affiliation: 'Research Institute of Advanced Studies',
      bio: 'Senior Research Scientist with expertise in digital publishing platforms and peer review systems.'
    }
  });

  const author4 = await prisma.user.upsert({
    where: { email: 'charlie.academic@college.edu' },
    update: {},
    create: {
      email: 'charlie.academic@college.edu',
      name: 'Dr. Charlie Academic',
      role: GlobalRole.USER,
      affiliation: 'Liberal Arts College',
      bio: 'Professor of Information Science studying scholarly communication and open access publishing.'
    }
  });

  console.log('✅ Sample users created');

  // Create sample manuscripts with different statuses
  const manuscripts = [
    {
      title: 'A Novel Approach to Academic Publishing: The Colloquium Platform',
      abstract: 'This paper introduces Colloquium, an open-source platform that democratizes scientific journal publishing through conversational review processes and an extensible bot ecosystem. We demonstrate how this approach can reduce barriers to academic publishing while maintaining rigorous peer review standards.',
      status: ManuscriptStatus.UNDER_REVIEW,
      authors: [authorUser.id],
      keywords: ['academic publishing', 'peer review', 'open source', 'conversational review']
    },
    {
      title: 'Machine Learning Applications in Automated Peer Review Systems',
      abstract: 'This study explores the integration of machine learning algorithms into peer review workflows, examining their effectiveness in identifying plagiarism, statistical errors, and methodological issues while maintaining reviewer anonymity and reducing bias.',
      status: ManuscriptStatus.SUBMITTED,
      authors: [author2.id, author3.id],
      keywords: ['machine learning', 'peer review', 'automation', 'bias reduction', 'plagiarism detection']
    },
    {
      title: 'Blockchain Technology for Transparent Academic Publishing',
      abstract: 'We present a blockchain-based system for ensuring transparency and immutability in academic publishing, addressing concerns about research integrity and enabling verifiable peer review processes.',
      status: ManuscriptStatus.REVISION_REQUESTED,
      authors: [author3.id],
      keywords: ['blockchain', 'transparency', 'research integrity', 'immutable records']
    },
    {
      title: 'Open Science Platforms: Impact on Research Collaboration',
      abstract: 'A comprehensive analysis of modern open science platforms and their effect on research collaboration patterns, knowledge dissemination, and citation networks in academic communities.',
      status: ManuscriptStatus.ACCEPTED,
      authors: [author4.id, author2.id],
      keywords: ['open science', 'collaboration', 'knowledge dissemination', 'citation networks']
    },
    {
      title: 'Digital Transformation in Academic Libraries: A Case Study',
      abstract: 'This paper examines how academic libraries are adapting to digital transformation, focusing on new services, changing user needs, and the role of technology in modern scholarly communication.',
      status: ManuscriptStatus.PUBLISHED,
      authors: [author4.id],
      keywords: ['digital transformation', 'academic libraries', 'scholarly communication', 'technology adoption'],
      publishedAt: new Date('2024-01-15')
    }
  ];

  const createdManuscripts = [];
  
  for (const manuscriptData of manuscripts) {
    const existingManuscript = await prisma.manuscript.findFirst({
      where: { title: manuscriptData.title }
    });

    if (!existingManuscript) {
      const manuscript = await prisma.manuscript.create({
        data: {
          title: manuscriptData.title,
          abstract: manuscriptData.abstract,
          authors: manuscriptData.authors.map(authorId => {
            const author = [authorUser, author2, author3, author4].find(u => u.id === authorId);
            return author ? author.name : 'Unknown Author';
          }),
          content: `# ${manuscriptData.title}

## Abstract

${manuscriptData.abstract}

## 1. Introduction

This section introduces the research topic and provides comprehensive background context. The motivation for this work stems from the evolving landscape of academic publishing and the need for more efficient, transparent, and accessible peer review processes.

Recent developments in technology have opened new possibilities for reimagining how academic research is shared, reviewed, and published. Traditional publishing models face challenges including lengthy review times, lack of transparency, and barriers to access that limit the impact of scientific research.

## 2. Related Work

Previous work in this area has explored various aspects of academic publishing reform. Notable contributions include studies on open access publishing models, automated review systems, and blockchain applications in scholarly communication.

## 3. Methodology

This section describes our research approach and methodology. We employed a mixed-methods approach combining quantitative analysis of publishing metrics with qualitative interviews of stakeholders in the academic publishing ecosystem.

### 3.1 Data Collection

We collected data from multiple sources including publisher databases, survey responses from researchers, and case studies from institutions implementing new publishing workflows.

### 3.2 Analysis Framework

Our analysis framework incorporates both technical performance metrics and user experience measures to provide a comprehensive evaluation of the proposed systems.

## 4. Results

This section presents our key findings and analysis. The results demonstrate significant improvements in review efficiency and user satisfaction when implementing conversational review processes.

### 4.1 Performance Metrics

Our evaluation shows measurable improvements across multiple dimensions:
- Average review time reduced by 40%
- Reviewer satisfaction increased by 65%
- Author feedback quality improved by 55%

### 4.2 User Feedback

Qualitative feedback from users indicates strong support for the new review processes, with particular appreciation for the increased transparency and interactive nature of conversations.

## 5. Discussion

The implications of these findings extend beyond immediate technical improvements. The conversational approach to peer review represents a fundamental shift toward more collaborative and constructive scholarly communication.

### 5.1 Benefits

Key benefits identified include improved reviewer engagement, higher quality feedback, and reduced time to publication. The bot ecosystem provides additional automation capabilities that reduce administrative overhead.

### 5.2 Limitations

While promising, the approach faces challenges including the need for user training, potential for increased review complexity, and questions about scalability to larger publishing volumes.

## 6. Conclusion

This work demonstrates the potential for innovative approaches to academic publishing that maintain scientific rigor while improving efficiency and accessibility. Future work will focus on expanding the bot ecosystem and developing additional automation capabilities.

## References

1. Smith, J., et al. (2023). "Modern Approaches to Peer Review." *Journal of Academic Publishing*, 15(3), 123-145.
2. Johnson, A., & Brown, K. (2023). "Automation in Scholarly Communication." *Digital Publishing Quarterly*, 8(2), 67-89.
3. Chen, L., et al. (2022). "Blockchain Applications in Academic Publishing." *Technology Review*, 45(7), 234-250.
4. Davis, M. (2023). "Open Science Platforms: Current State and Future Directions." *Science Communication*, 12(4), 456-478.
5. Wilson, R., & Taylor, S. (2022). "User Experience in Academic Publishing Systems." *HCI Research*, 29(8), 112-134.`,
          status: manuscriptData.status,
          keywords: manuscriptData.keywords,
          publishedAt: manuscriptData.publishedAt || null,
          authorRelations: {
            create: manuscriptData.authors.map((authorId, index) => ({
              userId: authorId,
              order: index,
              isCorresponding: index === 0
            }))
          }
        }
      });
      createdManuscripts.push(manuscript);
    } else {
      createdManuscripts.push(existingManuscript);
    }
  }

  console.log('✅ Sample manuscripts created');

  // Create sample conversations for the manuscripts
  const conversations = [
    {
      manuscriptIndex: 0, // Colloquium Platform paper
      title: 'Editorial Review Discussion',
      type: ConversationType.EDITORIAL,
      messages: [
        {
          content: 'This manuscript looks promising. The approach to conversational review is novel and could have significant impact on academic publishing. I recommend sending it out for peer review.',
          authorId: editorUser.id
        },
        {
          content: 'I agree. The technical implementation seems sound and the use case is compelling. Let\'s assign reviewers from our network.',
          authorId: adminUser.id
        },
        {
          content: '@editorial-bot status UNDER_REVIEW reason="Initial editorial review complete, proceeding to peer review"',
          authorId: editorUser.id
        }
      ]
    },
    {
      manuscriptIndex: 1, // ML in Peer Review paper  
      title: 'Submission Review',
      type: ConversationType.REVIEW,
      messages: [
        {
          content: 'Thank you for your submission. We will begin the initial editorial review process.',
          authorId: editorUser.id
        },
        {
          content: '@plagiarism-bot check threshold=0.15 databases=crossref,pubmed,arxiv',
          authorId: editorUser.id
        }
      ]
    },
    {
      manuscriptIndex: 2, // Blockchain paper
      title: 'Revision Requested',
      type: ConversationType.SEMI_PUBLIC,
      messages: [
        {
          content: 'Based on reviewer feedback, we are requesting revisions to address the following concerns: 1) Scalability analysis needs more detail, 2) Comparison with existing systems should be expanded, 3) Implementation costs should be discussed.',
          authorId: editorUser.id
        },
        {
          content: 'Thank you for the feedback. I will address these points in my revision. Could you clarify what specific aspects of scalability analysis you\'d like me to focus on?',
          authorId: author3.id
        }
      ]
    }
  ];

  for (const convData of conversations) {
    const manuscript = createdManuscripts[convData.manuscriptIndex];
    if (!manuscript) continue;

    const existingConversation = await prisma.conversation.findFirst({
      where: { 
        manuscriptId: manuscript.id,
        title: convData.title
      }
    });

    if (!existingConversation) {
      await prisma.conversation.create({
        data: {
          title: convData.title,
          type: convData.type,
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
              },
              {
                userId: reviewerUser.id,
                role: 'PARTICIPANT'
              }
            ]
          },
          messages: {
            create: convData.messages
          }
        }
      });
    }
  }

  console.log('✅ Sample conversations created');

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