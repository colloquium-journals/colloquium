import { PrismaClient, GlobalRole, ManuscriptStatus, ConversationType, PrivacyLevel, MessagePrivacy } from '@prisma/client';

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
      name: 'Alice Researcher',
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
      name: 'Bob Scientist',
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
      name: 'Charlie Academic',
      role: GlobalRole.USER,
      affiliation: 'Liberal Arts College',
      bio: 'Professor of Information Science studying scholarly communication and open access publishing.'
    }
  });

  // Create additional authors for testing multi-author manuscripts
  const author5 = await prisma.user.upsert({
    where: { email: 'diana.researcher@institute.org' },
    update: {},
    create: {
      email: 'diana.researcher@institute.org',
      name: 'Diana Researcher',
      role: GlobalRole.USER,
      orcidId: '0000-0004-5678-9012',
      affiliation: 'International Research Institute',
      bio: 'Senior Scientist specializing in computational biology and bioinformatics.'
    }
  });

  const author6 = await prisma.user.upsert({
    where: { email: 'edward.professor@university.ac.uk' },
    update: {},
    create: {
      email: 'edward.professor@university.ac.uk',
      name: 'Edward Mitchell',
      role: GlobalRole.USER,
      orcidId: '0000-0005-6789-0123',
      affiliation: 'Cambridge University',
      bio: 'Professor of Theoretical Physics and Mathematics.'
    }
  });

  const author7 = await prisma.user.upsert({
    where: { email: 'fiona.scientist@research.gov' },
    update: {},
    create: {
      email: 'fiona.scientist@research.gov',
      name: 'Fiona Chen',
      role: GlobalRole.USER,
      affiliation: 'National Science Foundation',
      bio: 'Research Scientist in materials science and nanotechnology.'
    }
  });

  const author8 = await prisma.user.upsert({
    where: { email: 'george.analyst@tech.com' },
    update: {},
    create: {
      email: 'george.analyst@tech.com',
      name: 'George Williams',
      role: GlobalRole.USER,
      affiliation: 'TechCorp Research Division',
      bio: 'Data Scientist and Machine Learning Engineer.'
    }
  });

  const author9 = await prisma.user.upsert({
    where: { email: 'helena.postdoc@university.de' },
    update: {},
    create: {
      email: 'helena.postdoc@university.de',
      name: 'Helena Schmidt',
      role: GlobalRole.USER,
      orcidId: '0000-0006-7890-1234',
      affiliation: 'Max Planck Institute',
      bio: 'Postdoctoral Researcher in quantum computing and cryptography.'
    }
  });

  const author10 = await prisma.user.upsert({
    where: { email: 'ivan.graduate@student.edu' },
    update: {},
    create: {
      email: 'ivan.graduate@student.edu',
      name: 'Ivan Rodriguez',
      role: GlobalRole.USER,
      affiliation: 'Stanford University',
      bio: 'PhD Candidate in Artificial Intelligence and Machine Learning.'
    }
  });

  console.log('✅ Sample users created');

  // Create sample manuscripts with different statuses and varying author counts
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
      publishedAt: new Date('2024-01-15'),
      doi: '10.1000/182'
    },
    // New manuscripts with varying author counts for UI testing
    {
      title: 'Large-Scale Collaborative Research in Computational Biology: A Multi-Institutional Study',
      abstract: 'This comprehensive study presents findings from a large-scale collaborative effort involving multiple research institutions worldwide. We analyzed genomic data from over 100,000 samples to identify novel patterns in gene expression and regulatory networks, demonstrating the power of international scientific cooperation.',
      status: ManuscriptStatus.PUBLISHED,
      authors: [author2.id, author5.id, author6.id, author7.id, author8.id, author9.id, author10.id, authorUser.id],
      keywords: ['computational biology', 'genomics', 'collaboration', 'big data', 'international cooperation', 'gene expression', 'regulatory networks'],
      publishedAt: new Date('2024-02-20'),
      doi: '10.1038/s41467-024-45892-3'
    },
    {
      title: 'Quantum Computing Applications in Cryptographic Security: A Comprehensive Review',
      abstract: 'An extensive review of quantum computing applications in modern cryptographic systems, examining both opportunities and threats posed by quantum algorithms to current security protocols.',
      status: ManuscriptStatus.UNDER_REVIEW,
      authors: [author9.id, author6.id, author7.id, author3.id],
      keywords: ['quantum computing', 'cryptography', 'security', 'algorithms', 'quantum cryptography']
    },
    {
      title: 'Interdisciplinary Approaches to Climate Change Modeling',
      abstract: 'This paper presents novel interdisciplinary methodologies combining atmospheric science, computer modeling, and statistical analysis to improve accuracy in climate change predictions.',
      status: ManuscriptStatus.PUBLISHED,
      authors: [author8.id, author5.id, author10.id],
      keywords: ['climate change', 'modeling', 'interdisciplinary research', 'atmospheric science', 'statistical analysis'],
      publishedAt: new Date('2024-03-10'),
      doi: '10.1007/s10584-024-03456-7'
    },
    {
      title: 'Artificial Intelligence Ethics in Academic Research: Guidelines and Best Practices',
      abstract: 'A comprehensive framework for ethical AI implementation in academic research, developed through extensive consultation with ethicists, computer scientists, and social scientists.',
      status: ManuscriptStatus.ACCEPTED,
      authors: [author2.id, author4.id, author8.id, author10.id, author6.id],
      keywords: ['artificial intelligence', 'ethics', 'research guidelines', 'best practices', 'responsible AI', 'academic research']
    },
    {
      title: 'Nanotechnology Applications in Medical Device Manufacturing',
      abstract: 'This study explores cutting-edge applications of nanotechnology in medical device manufacturing, focusing on biocompatibility, precision engineering, and therapeutic applications.',
      status: ManuscriptStatus.SUBMITTED,
      authors: [author7.id, author5.id],
      keywords: ['nanotechnology', 'medical devices', 'biocompatibility', 'manufacturing', 'therapeutics']
    },
    {
      title: 'The Future of Open Access Publishing: Technological and Social Perspectives',
      abstract: 'An analysis of emerging trends in open access publishing, examining both technological innovations and social factors that influence the adoption of open science practices.',
      status: ManuscriptStatus.PUBLISHED,
      authors: [author4.id, author2.id, author3.id, authorUser.id, author8.id, author10.id],
      keywords: ['open access', 'publishing', 'open science', 'technology trends', 'social factors', 'scientific communication'],
      publishedAt: new Date('2024-01-25'),
      doi: '10.1371/journal.pone.0298765'
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
            const author = [authorUser, author2, author3, author4, author5, author6, author7, author8, author9, author10].find(u => u.id === authorId);
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
          doi: manuscriptData.doi || null,
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
      manuscriptIndex: 0, // Colloquium Platform paper (UNDER_REVIEW)
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
      manuscriptIndex: 1, // ML in Peer Review paper (SUBMITTED)
      title: 'Submission Review',
      type: ConversationType.REVIEW,
      messages: [
        {
          content: 'Thank you for your submission. We will begin the initial editorial review process.',
          authorId: editorUser.id
        },
      ]
    },
    {
      manuscriptIndex: 2, // Blockchain paper (REVISION_REQUESTED)
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
        },
        {
          content: '@editorial-bot decision minor_revision reason="Needs additional technical details and comparisons"',
          authorId: editorUser.id
        }
      ]
    },
    {
      manuscriptIndex: 3, // Open Science Platforms (ACCEPTED)
      title: 'Editorial Decision Process',
      type: ConversationType.SEMI_PUBLIC,
      messages: [
        {
          content: 'The reviews have been completed for this manuscript. Both reviewers provided positive feedback with minor suggestions that have been addressed by the authors.',
          authorId: editorUser.id
        },
        {
          content: 'Reviewer 1 praised the comprehensive analysis and clear writing. Reviewer 2 noted the innovative approach to measuring collaboration patterns.',
          authorId: adminUser.id
        },
        {
          content: 'Thank you for the thorough review process. We\'ve addressed all reviewer comments and are grateful for the constructive feedback.',
          authorId: author4.id
        },
        {
          content: '@editorial-bot decision accept reason="Strong reviews, innovative methodology, and comprehensive analysis of open science platforms"',
          authorId: editorUser.id
        }
      ]
    },
    {
      manuscriptIndex: 4, // Digital Transformation (PUBLISHED)
      title: 'Complete Editorial Workflow',
      type: ConversationType.SEMI_PUBLIC,
      messages: [
        {
          content: 'Initial submission received. This case study on digital transformation in academic libraries presents valuable insights for the field.',
          authorId: editorUser.id
        },
        {
          content: '@editorial-bot assign reviewer1@library.edu,reviewer2@university.org deadline="2024-01-10" message="Please review this case study on library digital transformation"',
          authorId: editorUser.id
        },
        {
          content: 'Reviews are now complete. Both reviewers commend the thorough analysis and practical implications. The case study methodology is sound and the findings are significant.',
          authorId: editorUser.id
        },
        {
          content: 'Reviewer feedback summary:\n- Excellent documentation of transformation process\n- Clear methodology and analysis\n- Valuable insights for library professionals\n- Minor suggestions for clarity have been addressed',
          authorId: adminUser.id
        },
        {
          content: 'Thank you for the constructive review process. The suggested revisions have improved the manuscript significantly.',
          authorId: author4.id
        },
        {
          content: '@editorial-bot decision accept reason="Excellent case study with valuable insights for academic library professionals"',
          authorId: editorUser.id
        },
        {
          content: 'The manuscript has been accepted. Proceeding with final publication preparation.',
          authorId: editorUser.id
        },
        {
          content: '@editorial-bot status PUBLISHED reason="Final review complete, ready for publication"',
          authorId: editorUser.id
        }
      ]
    },
    {
      manuscriptIndex: 5, // Large-Scale Collaborative Research (PUBLISHED)
      title: 'Multi-Institutional Review Process',
      type: ConversationType.SEMI_PUBLIC,
      messages: [
        {
          content: 'This large-scale collaborative study represents a significant contribution to computational biology. The multi-institutional approach is commendable.',
          authorId: editorUser.id
        },
        {
          content: '@editorial-bot assign expert1@genomics.org,expert2@biocomputing.edu,expert3@institute.gov deadline="2024-02-15" message="Please review this major collaborative study in computational biology"',
          authorId: editorUser.id
        },
        {
          content: 'All three expert reviews are complete. The consensus is overwhelmingly positive:\n\n- Innovative methodology for large-scale genomic analysis\n- Excellent international collaboration model\n- Significant findings with broad implications\n- High-quality data analysis and visualization',
          authorId: adminUser.id
        },
        {
          content: 'The scale of this collaboration is impressive. The 100,000+ sample analysis provides unprecedented insights into gene expression patterns.',
          authorId: editorUser.id
        },
        {
          content: 'We appreciate the rigorous review process. This project represents 3 years of coordinated international effort.',
          authorId: author2.id
        },
        {
          content: '@editorial-bot decision accept reason="Outstanding collaborative research with significant scientific impact and innovative methodology"',
          authorId: editorUser.id
        },
        {
          content: 'Congratulations to all authors on this exceptional contribution to computational biology.',
          authorId: editorUser.id
        },
        {
          content: '@editorial-bot status PUBLISHED reason="Major contribution ready for publication with DOI assignment"',
          authorId: editorUser.id
        }
      ]
    },
    {
      manuscriptIndex: 7, // Interdisciplinary Climate Change (PUBLISHED)
      title: 'Interdisciplinary Review Workflow',
      type: ConversationType.SEMI_PUBLIC,
      messages: [
        {
          content: 'This interdisciplinary approach to climate modeling is exactly the kind of innovative research we need. Assigning reviewers from different fields.',
          authorId: editorUser.id
        },
        {
          content: '@editorial-bot assign climate1@atmospheric.edu,stats1@math.university.edu,comp1@modeling.org deadline="2024-03-05" message="Please review this interdisciplinary climate modeling study"',
          authorId: editorUser.id
        },
        {
          content: 'Reviews complete. Each reviewer from different disciplines (atmospheric science, statistics, computer modeling) praised the interdisciplinary integration.',
          authorId: adminUser.id
        },
        {
          content: 'The combination of methodologies is particularly strong. The statistical validation of the atmospheric models adds significant credibility.',
          authorId: editorUser.id
        },
        {
          content: 'Thank you for assembling such a diverse review panel. Their feedback improved our cross-disciplinary explanations.',
          authorId: author8.id
        },
        {
          content: '@editorial-bot decision accept reason="Excellent interdisciplinary methodology with strong validation across multiple fields"',
          authorId: editorUser.id
        },
        {
          content: '@editorial-bot status PUBLISHED reason="Interdisciplinary climate research approved for publication"',
          authorId: editorUser.id
        }
      ]
    },
    {
      manuscriptIndex: 10, // Future of Open Access Publishing (PUBLISHED)
      title: 'Comprehensive Editorial Process',
      type: ConversationType.SEMI_PUBLIC,
      messages: [
        {
          content: 'This comprehensive analysis of open access publishing trends addresses critical issues in scholarly communication.',
          authorId: editorUser.id
        },
        {
          content: '@editorial-bot assign publisher1@society.org,economist1@research.edu,tech1@innovation.com deadline="2024-01-20" message="Please review this analysis of open access publishing trends"',
          authorId: editorUser.id
        },
        {
          content: 'Excellent reviews from three different perspectives:\n- Publishing industry expert: "Thorough analysis of current trends"\n- Research economist: "Sound economic analysis of OA models"\n- Technology specialist: "Good coverage of technical innovations"',
          authorId: adminUser.id
        },
        {
          content: 'The multi-author collaboration brings together diverse expertise in publishing, technology, and social factors.',
          authorId: editorUser.id
        },
        {
          content: 'Minor revisions were suggested to strengthen the conclusions section, which have been completed.',
          authorId: author4.id
        },
        {
          content: 'The revised manuscript addresses all reviewer comments effectively.',
          authorId: editorUser.id
        },
        {
          content: '@editorial-bot decision accept reason="Comprehensive analysis with strong multi-disciplinary perspective on open access publishing"',
          authorId: editorUser.id
        },
        {
          content: '@editorial-bot status PUBLISHED reason="Excellent contribution to scholarly communication literature"',
          authorId: editorUser.id
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
      // Get the manuscript authors to add as participants
      const manuscriptAuthors = await prisma.manuscriptAuthor.findMany({
        where: { manuscriptId: manuscript.id }
      });

      // Create participant list
      const participants = [
        {
          userId: editorUser.id,
          role: 'MODERATOR'
        },
        {
          userId: adminUser.id,
          role: 'PARTICIPANT'
        }
      ];

      // Add manuscript authors as participants
      for (const authorRel of manuscriptAuthors) {
        if (authorRel.userId !== editorUser.id && authorRel.userId !== adminUser.id) {
          participants.push({
            userId: authorRel.userId,
            role: 'PARTICIPANT'
          });
        }
      }

      // Add reviewer if not already included
      if (!participants.some(p => p.userId === reviewerUser.id)) {
        participants.push({
          userId: reviewerUser.id,
          role: 'PARTICIPANT'
        });
      }

      // Create conversation with messages
      const conversation = await prisma.conversation.create({
        data: {
          title: convData.title,
          type: convData.type,
          privacy: convData.type === ConversationType.EDITORIAL ? PrivacyLevel.PRIVATE : PrivacyLevel.SEMI_PUBLIC,
          manuscriptId: manuscript.id,
          participants: {
            create: participants
          }
        }
      });

      // Create messages with proper timestamps to show progression
      for (let i = 0; i < convData.messages.length; i++) {
        const message = convData.messages[i];
        const baseDate = new Date('2024-01-01');
        const messageDate = new Date(baseDate.getTime() + (i * 2 * 24 * 60 * 60 * 1000)); // 2 days apart

        await prisma.message.create({
          data: {
            content: message.content,
            authorId: message.authorId,
            conversationId: conversation.id,
            isBot: message.content.includes('@editorial-bot'),
            privacy: convData.type === ConversationType.EDITORIAL ? MessagePrivacy.EDITOR_ONLY : MessagePrivacy.AUTHOR_VISIBLE,
            createdAt: messageDate,
            updatedAt: messageDate
          }
        });
      }
    }
  }

  console.log('✅ Sample conversations created');

  console.log('✅ Sample bots ready');

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