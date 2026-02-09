import { prisma } from '@colloquium/database';
import { randomUUID } from 'crypto';
import { broadcastToConversation } from '../../routes/events';
import { transporter } from '../emailService';
import { ActionContext } from '../botActionProcessor';

export async function handleExecutePublicationWorkflow(data: any, context: ActionContext): Promise<void> {
  const { manuscriptId, acceptedDate, reason, triggeredBy } = data;
  const { userId, conversationId } = context;

  console.log(`Starting publication workflow for manuscript ${manuscriptId}`);

  // Get manuscript with current status
  const manuscript = await prisma.manuscripts.findUnique({
    where: { id: manuscriptId },
    include: {
      manuscript_authors: {
        include: { users: true }
      }
    }
  });

  if (!manuscript) {
    throw new Error(`Manuscript ${manuscriptId} not found`);
  }

  // Verify manuscript is in correct status for publication
  if (manuscript.status !== 'ACCEPTED') {
    throw new Error(`Cannot execute publication workflow. Manuscript status is ${manuscript.status}, expected ACCEPTED`);
  }

  // Step 1: Generate DOI if not already assigned
  let doi = manuscript.doi;
  if (!doi) {
    doi = await generateDOI(manuscriptId);
    console.log(`Generated DOI for manuscript ${manuscriptId}: ${doi}`);
  }

  // Step 2: Update manuscript to PUBLISHED status with publication metadata
  const publishedManuscript = await prisma.manuscripts.update({
    where: { id: manuscriptId },
    data: {
      status: 'PUBLISHED',
      publishedAt: new Date(),
      doi: doi,
      updatedAt: new Date()
    }
  });

  // Step 2.5: Publish assets to static hosting for better performance
  try {
    const { publishedAssetManager } = await import('../publishedAssetManager');
    await publishedAssetManager.publishManuscriptAssets(manuscriptId);
    console.log(`Assets published to static hosting for manuscript: ${manuscriptId}`);
  } catch (error) {
    console.error(`Failed to publish assets to static hosting for manuscript ${manuscriptId}:`, error);
    // Continue with publication - asset publishing failure shouldn't block publication
  }

  // Step 3: Create publication workflow completion message
  const publicationMessage = `🚀 **Publication Workflow Completed**\n\n` +
    `**Manuscript:** ${manuscript.title}\n` +
    `**DOI:** ${doi}\n` +
    `**Published:** ${new Date().toLocaleString()}\n` +
    `**Triggered by:** ${triggeredBy}\n` +
    `${reason ? `**Acceptance reason:** ${reason}\n` : ''}` +
    `\n✅ **Manuscript is now published and publicly available**\n` +
    `📊 **Publication metrics and indexing will be processed automatically**`;

  // Step 4: Add publication message to editorial conversation
  const editorialConversation = await prisma.conversations.findFirst({
    where: {
      manuscriptId,
      type: 'EDITORIAL'
    }
  });

  if (editorialConversation) {
    await prisma.messages.create({
      data: {
        id: randomUUID(),
        content: publicationMessage,
        conversationId: editorialConversation.id,
        authorId: userId,
        privacy: 'EDITOR_ONLY',
        isBot: true,
        updatedAt: new Date(),
        metadata: {
          type: 'publication_workflow_completed',
          doi,
          publishedAt: publishedManuscript.publishedAt?.toISOString(),
          triggeredBy,
          reason,
          via: 'bot'
        }
      }
    });
  }

  // Step 5: Send publication notification emails to authors
  const authorEmails = manuscript.manuscript_authors.map((ar: any) => ar.users.email);
  for (const email of authorEmails) {
    try {
      await sendPublicationEmail(email, publishedManuscript, doi, conversationId);
      console.log(`Publication notification sent to ${email}`);
    } catch (emailError) {
      console.error(`Failed to send publication email to ${email}:`, emailError);
    }
  }

  // Step 6: Broadcast publication event via SSE
  await broadcastToConversation(conversationId, {
    type: 'manuscript-published',
    manuscript: {
      id: manuscriptId,
      title: manuscript.title,
      doi,
      publishedAt: publishedManuscript.publishedAt?.toISOString(),
      status: 'PUBLISHED'
    }
  }, manuscriptId);

  console.log(`Publication workflow completed for manuscript ${manuscriptId}. DOI: ${doi}`);
}

async function generateDOI(manuscriptId: string): Promise<string> {
  const { crossrefService } = await import('../crossrefService');
  const { getJournalSettings } = await import('../../routes/settings');

  const settings = await getJournalSettings();

  // If Crossref is configured, register with Crossref
  if (settings.crossrefEnabled && settings.doiPrefix && settings.crossrefUsername) {
    const result = await crossrefService.registerManuscript(manuscriptId);

    if (result.success && result.doi) {
      return result.doi;
    }

    // Log error but continue - don't block publication
    console.error(`Crossref registration failed: ${result.error}`);
  }

  // Fallback: Generate local DOI (not registered)
  if (settings.doiPrefix) {
    return `${settings.doiPrefix}/${new Date().getFullYear()}.${manuscriptId.substring(0, 8)}`;
  }

  // No prefix configured - return placeholder
  return `10.1000/colloquium.${Date.now()}.${manuscriptId.substring(0, 8)}`;
}

async function sendPublicationEmail(email: string, manuscript: any, doi: string, conversationId: string): Promise<void> {
  const subject = `🎉 Published: ${manuscript.title}`;

  const htmlContent = `
    <div style="max-width: 600px; margin: 0 auto; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
      <h1 style="color: #16a34a; margin-bottom: 24px;">
        🎉 Your manuscript has been published!
      </h1>

      <div style="background-color: #f0f9ff; padding: 20px; margin: 24px 0; border-radius: 6px; border-left: 4px solid #0284c7;">
        <h2 style="margin-top: 0; color: #0c4a6e;">${manuscript.title}</h2>
        <p><strong>DOI:</strong> <a href="https://doi.org/${doi}" style="color: #0284c7;">${doi}</a></p>
        <p><strong>Published:</strong> ${manuscript.publishedAt ? new Date(manuscript.publishedAt).toLocaleDateString() : new Date().toLocaleDateString()}</p>
        <p><strong>Status:</strong> Published</p>
      </div>

      <div style="background-color: #d1fae5; padding: 16px; margin: 24px 0; border-radius: 6px; border-left: 4px solid #10b981;">
        <h3 style="margin-top: 0; color: #065f46;">🚀 What happens next?</h3>
        <ul style="margin-bottom: 0; color: #065f46;">
          <li>Your manuscript is now publicly available</li>
          <li>It will be indexed by search engines and academic databases</li>
          <li>Citation metrics will be tracked automatically</li>
          <li>The DOI link will resolve to your published work</li>
        </ul>
      </div>

      <div style="margin: 32px 0;">
        <a href="${process.env.FRONTEND_URL}/manuscripts/${manuscript.id}"
           style="display: inline-block; background-color: #16a34a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-right: 16px;">
          View Published Manuscript
        </a>
        <a href="${process.env.FRONTEND_URL}/conversations/${conversationId}"
           style="display: inline-block; background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">
          View Conversation
        </a>
      </div>

      <p style="color: #6b7280; font-size: 14px; margin-top: 32px;">
        This publication was processed via Editorial Bot automation.
      </p>
    </div>
  `;

  const textContent = `
🎉 Your manuscript has been published!

Title: ${manuscript.title}
DOI: ${doi}
Published: ${manuscript.publishedAt ? new Date(manuscript.publishedAt).toLocaleDateString() : new Date().toLocaleDateString()}

Your manuscript is now publicly available and will be indexed by search engines and academic databases.

View published manuscript: ${process.env.FRONTEND_URL}/manuscripts/${manuscript.id}
View conversation: ${process.env.FRONTEND_URL}/conversations/${conversationId}

This publication was processed via Editorial Bot automation.
  `;

  await transporter.sendMail({
    from: process.env.FROM_EMAIL || 'noreply@colloquium.example.com',
    to: email,
    subject,
    html: htmlContent,
    text: textContent
  });
}
