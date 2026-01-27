import { PrismaClient, GlobalRole, ManuscriptStatus, ConversationType, PrivacyLevel, MessagePrivacy, WorkflowPhase, ReviewStatus } from '@prisma/client';
import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { papers, createSeedFiles } from './seed-content';
import { renderMarkdown } from '@colloquium/markdown-renderer-bot';

// Traditional double-blind workflow config (defined inline to avoid import issues with tsx)
const traditionalBlindWorkflowConfig = {
  author: {
    seesReviews: 'on_release' as const,
    seesReviewerIdentity: 'never' as const,
    canParticipate: 'on_release' as const,
  },
  reviewers: {
    seeEachOther: 'never' as const,
    seeAuthorIdentity: 'never' as const,
    seeAuthorResponses: 'on_release' as const,
  },
  phases: {
    enabled: true,
    authorResponseStartsNewCycle: true,
    requireAllReviewsBeforeRelease: true,
  },
};

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...');

  // Create journal settings with workflow config (traditional double-blind)
  const workflowConfig = traditionalBlindWorkflowConfig;
  const journalSettings = await prisma.journal_settings.upsert({
    where: { id: 'singleton' },
    update: {
      settings: {
        allowPublicSubmissions: true,
        requireOrcid: false,
        enableBots: true,
        enableDarkMode: true,
        reviewDeadlineDays: 30,
        revisionDeadlineDays: 60,
        workflowTemplateId: 'traditional-blind',
        workflowConfig: workflowConfig
      }
    },
    create: {
      id: 'singleton',
      name: 'Colloquium Journal',
      description: 'An academic journal powered by the Colloquium platform - democratizing scientific publishing through conversational review.',
      settings: {
        allowPublicSubmissions: true,
        requireOrcid: false,
        enableBots: true,
        enableDarkMode: true,
        reviewDeadlineDays: 30,
        revisionDeadlineDays: 60,
        workflowTemplateId: 'traditional-blind',
        workflowConfig: workflowConfig
      },
      updatedAt: new Date()
    }
  });

  console.log('✅ Journal settings created (with traditional-blind workflow)');

  // Create admin user
  const adminUser = await prisma.users.upsert({
    where: { email: 'admin@colloquium.example.com' },
    update: {
      role: GlobalRole.ADMIN,
      name: 'Admin User',
      username: 'admin-user'
    },
    create: {
      id: randomUUID(),
      email: 'admin@colloquium.example.com',
      username: 'admin-user',
      name: 'Admin User',
      role: GlobalRole.ADMIN,
      updatedAt: new Date()
    }
  });

  // Create editor user
  const editorUser = await prisma.users.upsert({
    where: { email: 'editor@colloquium.example.com' },
    update: {
      role: GlobalRole.EDITOR_IN_CHIEF,
      name: 'Editor User',
      username: 'editor-user'
    },
    create: {
      id: randomUUID(),
      email: 'editor@colloquium.example.com',
      username: 'editor-user',
      name: 'Editor User',
      role: GlobalRole.EDITOR_IN_CHIEF,
      updatedAt: new Date()
    }
  });

  // Create sample author
  const authorUser = await prisma.users.upsert({
    where: { email: 'author@colloquium.example.com' },
    update: { username: 'sample-author' },
    create: {
      id: randomUUID(),
      email: 'author@colloquium.example.com',
      username: 'sample-author',
      name: 'Sample Author',
      role: GlobalRole.USER,
      updatedAt: new Date()
    }
  });

  // Create sample reviewers (multiple for workflow testing)
  const reviewerUser = await prisma.users.upsert({
    where: { email: 'reviewer@colloquium.example.com' },
    update: { username: 'sample-reviewer' },
    create: {
      id: randomUUID(),
      email: 'reviewer@colloquium.example.com',
      username: 'sample-reviewer',
      name: 'Sample Reviewer',
      role: GlobalRole.USER,
      affiliation: 'University of Review Sciences',
      bio: 'Expert reviewer with 10 years of experience in peer review.',
      updatedAt: new Date()
    }
  });

  const reviewerUser2 = await prisma.users.upsert({
    where: { email: 'reviewer2@colloquium.example.com' },
    update: { username: 'second-reviewer' },
    create: {
      id: randomUUID(),
      email: 'reviewer2@colloquium.example.com',
      username: 'second-reviewer',
      name: 'Second Reviewer',
      role: GlobalRole.USER,
      affiliation: 'Institute for Scholarly Assessment',
      bio: 'Specialist in methodology and research design evaluation.',
      updatedAt: new Date()
    }
  });

  const reviewerUser3 = await prisma.users.upsert({
    where: { email: 'reviewer3@colloquium.example.com' },
    update: { username: 'third-reviewer' },
    create: {
      id: randomUUID(),
      email: 'reviewer3@colloquium.example.com',
      username: 'third-reviewer',
      name: 'Third Reviewer',
      role: GlobalRole.USER,
      affiliation: 'Center for Academic Excellence',
      bio: 'Senior researcher with expertise in statistical analysis.',
      updatedAt: new Date()
    }
  });

  // Create additional authors for more realistic submissions
  const author2 = await prisma.users.upsert({
    where: { email: 'alice.researcher@university.edu' },
    update: { username: 'alice-researcher' },
    create: {
      id: randomUUID(),
      email: 'alice.researcher@university.edu',
      username: 'alice-researcher',
      name: 'Alice Researcher',
      role: GlobalRole.USER,
      orcidId: '0000-0002-1825-0097',
      orcidVerified: true,
      affiliation: 'University of Technology',
      bio: 'Assistant Professor of Computer Science specializing in machine learning and academic publishing systems.',
      updatedAt: new Date()
    }
  });

  const author3 = await prisma.users.upsert({
    where: { email: 'bob.scientist@research.org' },
    update: { username: 'bob-scientist' },
    create: {
      id: randomUUID(),
      email: 'bob.scientist@research.org',
      username: 'bob-scientist',
      name: 'Bob Scientist',
      role: GlobalRole.USER,
      orcidId: '0000-0003-4567-8901',
      orcidVerified: true,
      affiliation: 'Research Institute of Advanced Studies',
      bio: 'Senior Research Scientist with expertise in digital publishing platforms and peer review systems.',
      updatedAt: new Date()
    }
  });

  const author4 = await prisma.users.upsert({
    where: { email: 'charlie.academic@college.edu' },
    update: { username: 'charlie-academic' },
    create: {
      id: randomUUID(),
      email: 'charlie.academic@college.edu',
      username: 'charlie-academic',
      name: 'Charlie Academic',
      role: GlobalRole.USER,
      affiliation: 'Liberal Arts College',
      bio: 'Professor of Information Science studying scholarly communication and open access publishing.',
      updatedAt: new Date()
    }
  });

  // Create additional authors for testing multi-author manuscripts
  const author5 = await prisma.users.upsert({
    where: { email: 'diana.researcher@institute.org' },
    update: { username: 'diana-researcher' },
    create: {
      id: randomUUID(),
      email: 'diana.researcher@institute.org',
      username: 'diana-researcher',
      name: 'Diana Researcher',
      role: GlobalRole.USER,
      orcidId: '0000-0004-5678-9012',
      orcidVerified: true,
      affiliation: 'International Research Institute',
      bio: 'Senior Scientist specializing in computational biology and bioinformatics.',
      updatedAt: new Date()
    }
  });

  const author6 = await prisma.users.upsert({
    where: { email: 'edward.professor@university.ac.uk' },
    update: { username: 'edward-mitchell' },
    create: {
      id: randomUUID(),
      email: 'edward.professor@university.ac.uk',
      username: 'edward-mitchell',
      name: 'Edward Mitchell',
      role: GlobalRole.USER,
      orcidId: '0000-0005-6789-0123',
      orcidVerified: true,
      affiliation: 'Cambridge University',
      bio: 'Professor of Theoretical Physics and Mathematics.',
      updatedAt: new Date()
    }
  });

  const author7 = await prisma.users.upsert({
    where: { email: 'fiona.scientist@research.gov' },
    update: { username: 'fiona-chen' },
    create: {
      id: randomUUID(),
      email: 'fiona.scientist@research.gov',
      username: 'fiona-chen',
      name: 'Fiona Chen',
      role: GlobalRole.USER,
      affiliation: 'National Science Foundation',
      bio: 'Research Scientist in materials science and nanotechnology.',
      updatedAt: new Date()
    }
  });

  const author8 = await prisma.users.upsert({
    where: { email: 'george.analyst@tech.com' },
    update: { username: 'george-williams' },
    create: {
      id: randomUUID(),
      email: 'george.analyst@tech.com',
      username: 'george-williams',
      name: 'George Williams',
      role: GlobalRole.USER,
      affiliation: 'TechCorp Research Division',
      bio: 'Data Scientist and Machine Learning Engineer.',
      updatedAt: new Date()
    }
  });

  const author9 = await prisma.users.upsert({
    where: { email: 'helena.postdoc@university.de' },
    update: { username: 'helena-schmidt' },
    create: {
      id: randomUUID(),
      email: 'helena.postdoc@university.de',
      username: 'helena-schmidt',
      name: 'Helena Schmidt',
      role: GlobalRole.USER,
      orcidId: '0000-0006-7890-1234',
      orcidVerified: true,
      affiliation: 'Max Planck Institute',
      bio: 'Postdoctoral Researcher in quantum computing and cryptography.',
      updatedAt: new Date()
    }
  });

  const author10 = await prisma.users.upsert({
    where: { email: 'ivan.graduate@student.edu' },
    update: { username: 'ivan-rodriguez' },
    create: {
      id: randomUUID(),
      email: 'ivan.graduate@student.edu',
      username: 'ivan-rodriguez',
      name: 'Ivan Rodriguez',
      role: GlobalRole.USER,
      affiliation: 'Stanford University',
      bio: 'PhD Candidate in Artificial Intelligence and Machine Learning.',
      updatedAt: new Date()
    }
  });

  console.log('✅ Sample users created');

  // Create sample manuscripts with different statuses and varying author counts
  // Papers with rich content are defined in seed-content.ts
  const manuscripts = [
    {
      title: papers.colloquiumPlatform.title,
      abstract: papers.colloquiumPlatform.abstract,
      status: ManuscriptStatus.UNDER_REVIEW,
      authors: [authorUser.id],
      keywords: ['academic publishing', 'peer review', 'open source', 'conversational review'],
      contentKey: 'colloquiumPlatform'
    },
    {
      title: papers.mlPeerReview.title,
      abstract: papers.mlPeerReview.abstract,
      status: ManuscriptStatus.SUBMITTED,
      authors: [author2.id, author3.id],
      keywords: ['machine learning', 'peer review', 'automation', 'bias reduction', 'NLP'],
      contentKey: 'mlPeerReview'
    },
    {
      title: papers.blockchainCredentials.title,
      abstract: papers.blockchainCredentials.abstract,
      status: ManuscriptStatus.REVISION_REQUESTED,
      authors: [author3.id],
      keywords: ['blockchain', 'credentials', 'verification', 'decentralized', 'higher education'],
      contentKey: 'blockchainCredentials'
    },
    {
      title: papers.openSciencePlatforms.title,
      abstract: papers.openSciencePlatforms.abstract,
      status: ManuscriptStatus.ACCEPTED,
      authors: [author4.id, author2.id],
      keywords: ['open science', 'collaboration', 'knowledge dissemination', 'citation networks'],
      contentKey: 'openSciencePlatforms'
    },
    {
      title: papers.digitalLibraries.title,
      abstract: papers.digitalLibraries.abstract,
      status: ManuscriptStatus.PUBLISHED,
      authors: [author4.id],
      keywords: ['digital transformation', 'academic libraries', 'scholarly communication', 'research support'],
      publishedAt: new Date('2024-01-15'),
      doi: '10.1000/182',
      contentKey: 'digitalLibraries'
    },
    // New manuscripts with varying author counts for UI testing
    {
      title: papers.collaborativeResearch.title,
      abstract: papers.collaborativeResearch.abstract,
      status: ManuscriptStatus.PUBLISHED,
      authors: [author2.id, author5.id, author6.id, author7.id, author8.id, author9.id, author10.id, authorUser.id],
      keywords: ['computational biology', 'genomics', 'collaboration', 'big data', 'international cooperation'],
      publishedAt: new Date('2024-02-20'),
      doi: '10.1038/s41467-024-45892-3',
      contentKey: 'collaborativeResearch'
    },
    {
      title: papers.quantumCrypto.title,
      abstract: papers.quantumCrypto.abstract,
      status: ManuscriptStatus.UNDER_REVIEW,
      authors: [author9.id, author6.id, author7.id, author3.id],
      keywords: ['quantum computing', 'cryptography', 'post-quantum', 'security protocols'],
      contentKey: 'quantumCrypto'
    },
    {
      title: papers.climateModeling.title,
      abstract: papers.climateModeling.abstract,
      status: ManuscriptStatus.PUBLISHED,
      authors: [author8.id, author5.id, author10.id],
      keywords: ['climate change', 'modeling', 'interdisciplinary research', 'agent-based modeling'],
      publishedAt: new Date('2024-03-10'),
      doi: '10.1007/s10584-024-03456-7',
      contentKey: 'climateModeling'
    },
    {
      title: papers.aiEthics.title,
      abstract: papers.aiEthics.abstract,
      status: ManuscriptStatus.ACCEPTED,
      authors: [author2.id, author4.id, author8.id, author10.id, author6.id],
      keywords: ['artificial intelligence', 'ethics', 'research guidelines', 'best practices', 'responsible AI'],
      contentKey: 'aiEthics'
    },
    {
      title: papers.nanoMedical.title,
      abstract: papers.nanoMedical.abstract,
      status: ManuscriptStatus.SUBMITTED,
      authors: [author7.id, author5.id],
      keywords: ['nanotechnology', 'medical devices', 'biocompatibility', 'manufacturing', 'therapeutics'],
      contentKey: 'nanoMedical'
    },
    {
      title: papers.openAccessFuture.title,
      abstract: papers.openAccessFuture.abstract,
      status: ManuscriptStatus.PUBLISHED,
      authors: [author4.id, author2.id, author3.id, authorUser.id, author8.id, author10.id],
      keywords: ['open access', 'publishing', 'open science', 'technology trends', 'social factors'],
      publishedAt: new Date('2024-01-25'),
      doi: '10.1371/journal.pone.0298765',
      contentKey: 'openAccessFuture'
    },
    // Workflow testing manuscripts - different phases
    {
      title: 'Workflow Test: In Review Phase',
      abstract: 'This manuscript is in the REVIEW phase for testing workflow visibility. Reviewers are currently evaluating the submission independently.',
      status: ManuscriptStatus.UNDER_REVIEW,
      authors: [author5.id, author6.id],
      keywords: ['workflow', 'testing', 'review phase'],
      workflowPhase: 'REVIEW' as const,
      workflowRound: 1
    },
    {
      title: 'Workflow Test: Deliberation Phase',
      abstract: 'This manuscript is in the DELIBERATION phase for testing workflow visibility. Reviewers can now see each other\'s reviews and discuss.',
      status: ManuscriptStatus.UNDER_REVIEW,
      authors: [author7.id],
      keywords: ['workflow', 'testing', 'deliberation phase'],
      workflowPhase: 'DELIBERATION' as const,
      workflowRound: 1
    },
    {
      title: 'Workflow Test: Released to Author',
      abstract: 'This manuscript is in the RELEASED phase for testing workflow visibility. Reviews have been released to the author with a revision decision.',
      status: ManuscriptStatus.REVISION_REQUESTED,
      authors: [author8.id, author9.id],
      keywords: ['workflow', 'testing', 'released phase'],
      workflowPhase: 'RELEASED' as const,
      workflowRound: 1
    },
    {
      title: 'Workflow Test: Author Responding (Round 2)',
      abstract: 'This manuscript is in the AUTHOR_RESPONDING phase after revisions. This is round 2 of the review cycle.',
      status: ManuscriptStatus.UNDER_REVIEW,
      authors: [author10.id],
      keywords: ['workflow', 'testing', 'author responding', 'round 2'],
      workflowPhase: 'AUTHOR_RESPONDING' as const,
      workflowRound: 2
    }
  ];

  const createdManuscripts = [];
  
  for (const manuscriptData of manuscripts) {
    const existingManuscript = await prisma.manuscripts.findFirst({
      where: { title: manuscriptData.title }
    });

    if (!existingManuscript) {
      const manuscriptId = randomUUID();
      const manuscript = await prisma.manuscripts.create({
        data: {
          id: manuscriptId,
          title: manuscriptData.title,
          abstract: manuscriptData.abstract,
          authors: manuscriptData.authors.map(authorId => {
            const author = [authorUser, author2, author3, author4, author5, author6, author7, author8, author9, author10].find(u => u.id === authorId);
            return author ? author.name : 'Unknown Author';
          }),
          workflowPhase: (manuscriptData as any).workflowPhase ? WorkflowPhase[(manuscriptData as any).workflowPhase as keyof typeof WorkflowPhase] : WorkflowPhase.REVIEW,
          workflowRound: (manuscriptData as any).workflowRound || 1,
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
          updatedAt: new Date(),
          manuscript_authors: {
            create: manuscriptData.authors.map((authorId, index) => ({
              id: randomUUID(),
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

  // Create reviewer assignments for workflow test manuscripts
  const workflowTestManuscripts = createdManuscripts.filter(m =>
    m.title.startsWith('Workflow Test:')
  );

  for (const manuscript of workflowTestManuscripts) {
    // Assign reviewers to workflow test manuscripts
    const reviewers = [reviewerUser, reviewerUser2, reviewerUser3];

    for (let i = 0; i < reviewers.length; i++) {
      const reviewer = reviewers[i];
      const existingAssignment = await prisma.review_assignments.findFirst({
        where: { manuscriptId: manuscript.id, reviewerId: reviewer.id }
      });

      if (!existingAssignment) {
        // Determine status based on manuscript phase
        let status: ReviewStatus = ReviewStatus.IN_PROGRESS;
        if (manuscript.workflowPhase === WorkflowPhase.DELIBERATION ||
            manuscript.workflowPhase === WorkflowPhase.RELEASED ||
            manuscript.workflowPhase === WorkflowPhase.AUTHOR_RESPONDING) {
          status = ReviewStatus.COMPLETED;
        }

        await prisma.review_assignments.create({
          data: {
            id: randomUUID(),
            manuscriptId: manuscript.id,
            reviewerId: reviewer.id,
            status,
            assignedAt: new Date('2024-01-05'),
            dueDate: new Date('2024-02-05'),
            completedAt: status === ReviewStatus.COMPLETED ? new Date('2024-01-20') : null
          }
        });
      }
    }
  }

  console.log('✅ Reviewer assignments created for workflow test manuscripts');

  // Create workflow releases for released/author-responding manuscripts
  const releasedManuscripts = workflowTestManuscripts.filter(m =>
    m.workflowPhase === WorkflowPhase.RELEASED ||
    m.workflowPhase === WorkflowPhase.AUTHOR_RESPONDING
  );

  for (const manuscript of releasedManuscripts) {
    const existingRelease = await prisma.workflow_releases.findFirst({
      where: { manuscriptId: manuscript.id, round: 1 }
    });

    if (!existingRelease) {
      await prisma.workflow_releases.create({
        data: {
          id: randomUUID(),
          manuscriptId: manuscript.id,
          round: 1,
          releasedAt: new Date('2024-01-25'),
          releasedBy: editorUser.id,
          decisionType: 'revise',
          notes: 'Please address the reviewer concerns regarding methodology and expand the discussion section.'
        }
      });
    }
  }

  console.log('✅ Workflow releases created');

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
          content: '@bot-editorial status UNDER_REVIEW reason="Initial editorial review complete, proceeding to peer review"',
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
          content: '@bot-editorial decision minor_revision reason="Needs additional technical details and comparisons"',
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
          content: '@bot-editorial decision accept reason="Strong reviews, innovative methodology, and comprehensive analysis of open science platforms"',
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
          content: '@bot-editorial assign reviewer1@library.edu,reviewer2@university.org deadline="2024-01-10" message="Please review this case study on library digital transformation"',
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
          content: '@bot-editorial decision accept reason="Excellent case study with valuable insights for academic library professionals"',
          authorId: editorUser.id
        },
        {
          content: 'The manuscript has been accepted. Proceeding with final publication preparation.',
          authorId: editorUser.id
        },
        {
          content: '@bot-editorial status PUBLISHED reason="Final review complete, ready for publication"',
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
          content: '@bot-editorial assign expert1@genomics.org,expert2@biocomputing.edu,expert3@institute.gov deadline="2024-02-15" message="Please review this major collaborative study in computational biology"',
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
          content: '@bot-editorial decision accept reason="Outstanding collaborative research with significant scientific impact and innovative methodology"',
          authorId: editorUser.id
        },
        {
          content: 'Congratulations to all authors on this exceptional contribution to computational biology.',
          authorId: editorUser.id
        },
        {
          content: '@bot-editorial status PUBLISHED reason="Major contribution ready for publication with DOI assignment"',
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
          content: '@bot-editorial assign climate1@atmospheric.edu,stats1@math.university.edu,comp1@modeling.org deadline="2024-03-05" message="Please review this interdisciplinary climate modeling study"',
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
          content: '@bot-editorial decision accept reason="Excellent interdisciplinary methodology with strong validation across multiple fields"',
          authorId: editorUser.id
        },
        {
          content: '@bot-editorial status PUBLISHED reason="Interdisciplinary climate research approved for publication"',
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
          content: '@bot-editorial assign publisher1@society.org,economist1@research.edu,tech1@innovation.com deadline="2024-01-20" message="Please review this analysis of open access publishing trends"',
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
          content: '@bot-editorial decision accept reason="Comprehensive analysis with strong multi-disciplinary perspective on open access publishing"',
          authorId: editorUser.id
        },
        {
          content: '@bot-editorial status PUBLISHED reason="Excellent contribution to scholarly communication literature"',
          authorId: editorUser.id
        }
      ]
    },
    // Workflow test manuscript conversations
    {
      manuscriptIndex: 11, // Workflow Test: In Review Phase
      title: 'Peer Review Discussion',
      type: ConversationType.REVIEW,
      includeReviewers: true,
      messages: [
        {
          content: 'This manuscript has been assigned for peer review. Reviewers, please evaluate independently.',
          authorId: editorUser.id
        },
        {
          content: '## Reviewer Assessment\n\nThe methodology section presents a novel approach. However, I have concerns about the sample size used in the experiments. The statistical analysis would benefit from additional validation.\n\n**Recommendation:** Major revision',
          authorId: 'reviewer1', // Will be replaced with reviewerUser.id
          privacy: MessagePrivacy.REVIEWER_ONLY
        },
        {
          content: '## Review Summary\n\nThe paper addresses an important research gap. The literature review is comprehensive. I suggest expanding the discussion of limitations.\n\n**Recommendation:** Minor revision',
          authorId: 'reviewer2', // Will be replaced with reviewerUser2.id
          privacy: MessagePrivacy.REVIEWER_ONLY
        }
      ]
    },
    {
      manuscriptIndex: 12, // Workflow Test: Deliberation Phase
      title: 'Review Deliberation',
      type: ConversationType.REVIEW,
      includeReviewers: true,
      messages: [
        {
          content: 'Reviewers have submitted their assessments. Moving to deliberation phase where you can discuss your evaluations.',
          authorId: editorUser.id
        },
        {
          content: '## Initial Review\n\nStrong theoretical foundation but weak empirical validation. The claims made in Section 3 need stronger support.\n\n**Score:** 6/10',
          authorId: 'reviewer1',
          privacy: MessagePrivacy.REVIEWER_ONLY
        },
        {
          content: '## Review Comments\n\nI appreciate the innovative approach. The writing is clear and well-organized. My main concern is the generalizability of the findings.\n\n**Score:** 7/10',
          authorId: 'reviewer2',
          privacy: MessagePrivacy.REVIEWER_ONLY
        },
        {
          content: '## Additional Review\n\nThe methodology is sound but the sample selection criteria need clarification. I recommend the authors provide more detail on their recruitment process.\n\n**Score:** 7/10',
          authorId: 'reviewer3',
          privacy: MessagePrivacy.REVIEWER_ONLY
        },
        {
          content: '@reviewer1 I see your point about Section 3. Do you think supplementary analysis would address your concerns, or does the core argument need revision?',
          authorId: 'reviewer2',
          privacy: MessagePrivacy.REVIEWER_ONLY
        },
        {
          content: 'Supplementary analysis could help, but I think the authors need to be clearer about the scope of their claims. @reviewer3 what are your thoughts?',
          authorId: 'reviewer1',
          privacy: MessagePrivacy.REVIEWER_ONLY
        }
      ]
    },
    {
      manuscriptIndex: 13, // Workflow Test: Released to Author
      title: 'Review Released',
      type: ConversationType.REVIEW,
      includeReviewers: true,
      messages: [
        {
          content: 'The peer review is complete. Reviews will be released to the authors.',
          authorId: editorUser.id
        },
        {
          content: '## Reviewer A Assessment\n\nThis paper presents interesting findings on workflow management. The experimental design is appropriate for the research questions. However, several areas need improvement:\n\n1. The related work section should include recent publications from 2023\n2. Figure 3 is difficult to read - please improve resolution\n3. The discussion of threats to validity is insufficient\n\n**Recommendation:** Minor revision',
          authorId: 'reviewer1',
          privacy: MessagePrivacy.AUTHOR_VISIBLE
        },
        {
          content: '## Reviewer B Assessment\n\nThe contribution is meaningful and the results are convincing. I have the following suggestions:\n\n1. Add confidence intervals to Table 2\n2. Clarify the participant recruitment process\n3. Consider discussing implications for practitioners\n\n**Recommendation:** Minor revision',
          authorId: 'reviewer2',
          privacy: MessagePrivacy.AUTHOR_VISIBLE
        },
        {
          content: '## Reviewer C Assessment\n\nWell-written paper with clear structure. The methodology is rigorous. Minor issues:\n\n1. Typo on page 5, line 23\n2. Reference [15] appears incomplete\n3. The abstract could better highlight the main contributions\n\n**Recommendation:** Accept with minor changes',
          authorId: 'reviewer3',
          privacy: MessagePrivacy.AUTHOR_VISIBLE
        },
        {
          content: '@bot-editorial release decision="revise" notes="Please address the reviewer concerns regarding methodology and expand the discussion section."',
          authorId: editorUser.id
        },
        {
          content: 'Thank you for the thorough reviews. We will address all the points raised. Could we get clarification on Reviewer A\'s comment about Figure 3 - which specific aspect needs improvement?',
          authorId: author8.id
        }
      ]
    },
    {
      manuscriptIndex: 14, // Workflow Test: Author Responding (Round 2)
      title: 'Revision Review - Round 2',
      type: ConversationType.REVIEW,
      includeReviewers: true,
      messages: [
        {
          content: '## Round 1 Review\n\nThe initial submission had potential but needed significant improvements to the methodology section.\n\n**Recommendation:** Major revision',
          authorId: 'reviewer1',
          privacy: MessagePrivacy.AUTHOR_VISIBLE,
          round: 1
        },
        {
          content: '## Round 1 Review\n\nInteresting approach but the experimental validation was weak. The authors should conduct additional experiments.\n\n**Recommendation:** Major revision',
          authorId: 'reviewer2',
          privacy: MessagePrivacy.AUTHOR_VISIBLE,
          round: 1
        },
        {
          content: '@bot-editorial release decision="revise" notes="Major revisions required. Please strengthen the methodology and add additional experiments."',
          authorId: editorUser.id,
          round: 1
        },
        {
          content: 'We have substantially revised the manuscript based on reviewer feedback. Key changes:\n\n1. Completely rewritten methodology section with more detail\n2. Added two new experiments as suggested\n3. Expanded the discussion with practical implications\n4. Updated literature review with recent publications\n\nPlease see the detailed response document attached.',
          authorId: author10.id,
          round: 1
        },
        {
          content: 'Thank you for the revised submission. The manuscript has been sent back to reviewers for re-evaluation.',
          authorId: editorUser.id,
          round: 2
        },
        {
          content: '## Round 2 Review\n\nThe authors have addressed most of my concerns. The new methodology section is much clearer. The additional experiments strengthen the paper significantly.\n\n**Remaining minor issues:**\n- Please fix the formatting in Table 4\n- Consider adding a limitations paragraph\n\n**Recommendation:** Accept with minor revisions',
          authorId: 'reviewer1',
          privacy: MessagePrivacy.AUTHOR_VISIBLE,
          round: 2
        },
        {
          content: '## Round 2 Review\n\nExcellent revision. The authors have thoroughly addressed my concerns. The new experiments provide convincing evidence for the claims.\n\n**Recommendation:** Accept',
          authorId: 'reviewer2',
          privacy: MessagePrivacy.AUTHOR_VISIBLE,
          round: 2
        }
      ]
    }
  ];

  for (const convData of conversations) {
    const manuscript = createdManuscripts[convData.manuscriptIndex];
    if (!manuscript) continue;

    const existingConversation = await prisma.conversations.findFirst({
      where: { 
        manuscriptId: manuscript.id,
        title: convData.title
      }
    });

    if (!existingConversation) {
      // Get the manuscript authors to add as participants
      const manuscriptAuthors = await prisma.manuscript_authors.findMany({
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

      // Add reviewers based on conversation config
      const reviewerMapping: Record<string, string> = {
        'reviewer1': reviewerUser.id,
        'reviewer2': reviewerUser2.id,
        'reviewer3': reviewerUser3.id
      };

      if ((convData as any).includeReviewers) {
        // Add all three reviewers for workflow test conversations
        for (const reviewer of [reviewerUser, reviewerUser2, reviewerUser3]) {
          if (!participants.some(p => p.userId === reviewer.id)) {
            participants.push({
              userId: reviewer.id,
              role: 'PARTICIPANT'
            });
          }
        }
      } else {
        // Add single reviewer if not already included (for backward compatibility)
        if (!participants.some(p => p.userId === reviewerUser.id)) {
          participants.push({
            userId: reviewerUser.id,
            role: 'PARTICIPANT'
          });
        }
      }

      // Create conversation with messages
      const conversation = await prisma.conversations.create({
        data: {
          id: randomUUID(),
          title: convData.title,
          type: convData.type,
          privacy: convData.type === ConversationType.EDITORIAL ? PrivacyLevel.PRIVATE : PrivacyLevel.SEMI_PUBLIC,
          manuscriptId: manuscript.id,
          updatedAt: new Date(),
          conversation_participants: {
            create: participants.map(p => ({
              id: randomUUID(),
              userId: p.userId,
              role: p.role
            }))
          }
        }
      });

      // Create messages with proper timestamps to show progression
      for (let i = 0; i < convData.messages.length; i++) {
        const message = convData.messages[i] as any;
        const baseDate = new Date('2024-01-01');
        const messageDate = new Date(baseDate.getTime() + (i * 2 * 24 * 60 * 60 * 1000)); // 2 days apart

        // Resolve reviewer placeholders to actual user IDs
        let authorId = message.authorId;
        if (reviewerMapping[authorId]) {
          authorId = reviewerMapping[authorId];
        }

        // Use message-specific privacy if provided, otherwise default based on conversation type
        const messagePrivacy = message.privacy ||
          (convData.type === ConversationType.EDITORIAL ? MessagePrivacy.EDITOR_ONLY : MessagePrivacy.AUTHOR_VISIBLE);

        await prisma.messages.create({
          data: {
            id: randomUUID(),
            content: message.content,
            authorId: authorId,
            conversationId: conversation.id,
            isBot: message.content.includes('@bot-editorial'),
            privacy: messagePrivacy,
            createdAt: messageDate,
            updatedAt: messageDate
          }
        });
      }
    }
  }

  console.log('✅ Sample conversations created');

  // Create realistic content files (markdown and images) on disk
  console.log('📝 Creating realistic manuscript content files...');
  const uploadsDir = path.resolve(__dirname, '../../../apps/api/uploads/manuscripts');
  const createdFiles = createSeedFiles(uploadsDir);

  // Map contentKey to manuscript index for linking files
  const contentKeyToIndex: Record<string, number> = {
    'colloquiumPlatform': 0,
    'mlPeerReview': 1,
    'blockchainCredentials': 2,
    'openSciencePlatforms': 3,
    'digitalLibraries': 4,
    'collaborativeResearch': 5,
    'quantumCrypto': 6,
    'climateModeling': 7,
    'aiEthics': 8,
    'nanoMedical': 9,
    'openAccessFuture': 10
  };

  // Create ManuscriptFile records linking manuscripts to their files
  for (const [contentKey, manuscriptIndex] of Object.entries(contentKeyToIndex)) {
    const manuscript = createdManuscripts[manuscriptIndex];
    if (!manuscript) continue;

    const paper = papers[contentKey as keyof typeof papers];
    if (!paper) continue;

    // Create SOURCE file record for markdown
    const mdFilename = `${contentKey}.md`;
    const mdFileInfo = createdFiles.get(mdFilename);
    if (mdFileInfo) {
      const existingMd = await prisma.manuscript_files.findFirst({
        where: { manuscriptId: manuscript.id, filename: mdFilename }
      });
      if (!existingMd) {
        await prisma.manuscript_files.create({
          data: {
            id: randomUUID(),
            manuscriptId: manuscript.id,
            filename: mdFilename,
            originalName: mdFilename,
            mimetype: 'text/markdown',
            size: mdFileInfo.size,
            path: mdFileInfo.path,
            fileType: 'SOURCE',
            uploadedAt: new Date()
          }
        });
      }
    }

    // Create ASSET file records for images
    for (const img of paper.images) {
      const imgFileInfo = createdFiles.get(img.filename);
      if (imgFileInfo) {
        const existingImg = await prisma.manuscript_files.findFirst({
          where: { manuscriptId: manuscript.id, filename: img.filename }
        });
        if (!existingImg) {
          await prisma.manuscript_files.create({
            data: {
              id: randomUUID(),
              manuscriptId: manuscript.id,
              filename: img.filename,
              originalName: img.filename,
              mimetype: 'image/png',
              size: imgFileInfo.size,
              path: imgFileInfo.path,
              fileType: 'ASSET',
              uploadedAt: new Date()
            }
          });
        } else {
          // Update size if file already exists
          await prisma.manuscript_files.update({
            where: { id: existingImg.id },
            data: { size: imgFileInfo.size }
          });
        }
      }
    }

    // Create BIBLIOGRAPHY file record if paper has bibliography
    if (paper.bibliography) {
      const bibFilename = `${contentKey}-${paper.bibliography.filename}`;
      const bibFileInfo = createdFiles.get(bibFilename);
      if (bibFileInfo) {
        const existingBib = await prisma.manuscript_files.findFirst({
          where: { manuscriptId: manuscript.id, filename: bibFilename }
        });
        if (!existingBib) {
          await prisma.manuscript_files.create({
            data: {
              id: randomUUID(),
              manuscriptId: manuscript.id,
              filename: bibFilename,
              originalName: paper.bibliography.filename,
              mimetype: 'application/x-bibtex',
              size: bibFileInfo.size,
              path: bibFileInfo.path,
              fileType: 'BIBLIOGRAPHY',
              uploadedAt: new Date()
            }
          });
        } else {
          // Update size if file already exists
          await prisma.manuscript_files.update({
            where: { id: existingBib.id },
            data: { size: bibFileInfo.size }
          });
        }
      }
    }
  }

  console.log('✅ Manuscript files created');

  // Render HTML for ALL published manuscripts
  console.log('📄 Rendering HTML and PDF for published manuscripts...');

  for (let i = 0; i < createdManuscripts.length; i++) {
    const manuscript = createdManuscripts[i];
    if (!manuscript || manuscript.status !== ManuscriptStatus.PUBLISHED) continue;

    // Find contentKey if this manuscript has one
    const contentKey = Object.entries(contentKeyToIndex).find(([_, idx]) => idx === i)?.[0];
    const paper = contentKey ? papers[contentKey as keyof typeof papers] : null;

    // Generate a unique filename based on manuscript id
    const renderedFilename = `${manuscript.id}-rendered.html`;

    // Check if rendered file already exists
    const existingRendered = await prisma.manuscript_files.findFirst({
      where: { manuscriptId: manuscript.id, filename: renderedFilename }
    });

    if (existingRendered) {
      console.log(`  ⏭️ Skipping ${manuscript.title.substring(0, 40)}... - already rendered`);
      continue;
    }

    try {
      // Get author info from manuscript
      const manuscriptAuthors = await prisma.manuscript_authors.findMany({
        where: { manuscriptId: manuscript.id },
        include: { users: true },
        orderBy: { order: 'asc' }
      });

      const authorList = manuscriptAuthors.map(ma => ({
        name: ma.users?.name || 'Unknown',
        affiliation: ma.users?.affiliation || undefined,
        isCorresponding: ma.isCorresponding
      }));

      // Determine content and image map based on whether we have rich paper content
      let markdownContent: string;
      const imagePathMap: Record<string, string> = {};
      const imageSourcePaths: Record<string, string> = {};
      let bibliography: string | undefined;

      if (paper) {
        // Use rich paper content with images
        markdownContent = paper.content;
        for (const img of paper.images) {
          imagePathMap[img.filename] = `/static/published/${manuscript.id}/${img.filename}`;
          imageSourcePaths[img.filename] = path.join(uploadsDir, img.filename);
        }
        // Get bibliography content if available
        if (paper.bibliography) {
          bibliography = paper.bibliography.content;
        }
      } else {
        // Use the manuscript's inline content (stored in database)
        markdownContent = manuscript.content || `# ${manuscript.title}\n\n${manuscript.abstract}`;
      }

      // Render the markdown to HTML and PDF
      const renderResult = await renderMarkdown(markdownContent, {
        title: manuscript.title,
        abstract: manuscript.abstract || '',
        authorList,
        journalName: 'Colloquium Journal',
        imagePathMap,
        imageSourcePaths,
        bibliography,
        outputFormats: ['html', 'pdf']
      });

      // Write HTML file to disk
      const htmlPath = path.join(uploadsDir, renderedFilename);
      fs.writeFileSync(htmlPath, renderResult.html, 'utf-8');

      // Create RENDERED file record for HTML
      await prisma.manuscript_files.create({
        data: {
          id: randomUUID(),
          manuscriptId: manuscript.id,
          filename: renderedFilename,
          originalName: renderedFilename,
          mimetype: 'text/html',
          size: Buffer.byteLength(renderResult.html),
          path: `/uploads/manuscripts/${renderedFilename}`,
          fileType: 'RENDERED',
          uploadedAt: new Date()
        }
      });

      // Write PDF file to disk and create record
      if (renderResult.pdf) {
        const pdfFilename = renderedFilename.replace('.html', '.pdf');
        const pdfPath = path.join(uploadsDir, pdfFilename);
        fs.writeFileSync(pdfPath, renderResult.pdf);

        await prisma.manuscript_files.create({
          data: {
            id: randomUUID(),
            manuscriptId: manuscript.id,
            filename: pdfFilename,
            originalName: pdfFilename,
            mimetype: 'application/pdf',
            size: renderResult.pdf.length,
            path: `/uploads/manuscripts/${pdfFilename}`,
            fileType: 'RENDERED',
            uploadedAt: new Date()
          }
        });
      }

      // Copy ASSET files to static published directory if we have rich content
      if (paper && paper.images.length > 0) {
        const staticDir = path.resolve(__dirname, '../../../apps/api/static/published', manuscript.id);
        if (!fs.existsSync(staticDir)) {
          fs.mkdirSync(staticDir, { recursive: true });
        }

        for (const img of paper.images) {
          const srcPath = path.join(uploadsDir, img.filename);
          const destPath = path.join(staticDir, img.filename);
          if (fs.existsSync(srcPath)) {
            fs.copyFileSync(srcPath, destPath);
          }
        }
      }

      console.log(`  ✅ Rendered ${manuscript.title.substring(0, 50)}...`);
    } catch (error) {
      console.error(`  ❌ Failed to render ${manuscript.title}:`, error);
    }
  }

  console.log('✅ Published manuscripts rendered');

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