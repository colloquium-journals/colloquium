#!/usr/bin/env node

/**
 * Test script for reviewer invitation email functionality
 * 
 * This script demonstrates how to test the new email-based invitation system:
 * 1. Sends a reviewer invitation via the editorial bot
 * 2. Shows how reviewers can respond via email links
 * 3. Verifies the response updates the database
 * 
 * Prerequisites:
 * - Development environment running (npm run dev)
 * - MailHog running (included in docker-compose)
 * - Database seeded with sample data
 */

const axios = require('axios');

const API_BASE = 'http://localhost:4000';
const MAILHOG_BASE = 'http://localhost:8025';

console.log('🧪 Testing Reviewer Invitation Email System\n');

async function testEmailInvitations() {
  try {
    console.log('1. 📧 Testing email invitation system...');
    console.log('   This demonstrates the complete workflow:\n');
    
    console.log('   📬 Step 1: Editor sends invitation using bot command');
    console.log('   📝 Step 2: System sends email with accept/decline links');
    console.log('   🌐 Step 3: Reviewer clicks link in email (simulated)');
    console.log('   ✅ Step 4: System updates invitation status\n');
    
    // Show how to test the API endpoints directly
    console.log('2. 🔧 API Endpoints for testing:\n');
    
    console.log('   GET /api/reviewers/invitations/{id}/public');
    console.log('   - Public endpoint to view invitation details');
    console.log('   - No authentication required\n');
    
    console.log('   GET /api/reviewers/invitations/{id}/public?action=accept');
    console.log('   - Accept invitation via email link');
    console.log('   - Updates status to ACCEPTED\n');
    
    console.log('   GET /api/reviewers/invitations/{id}/public?action=decline');
    console.log('   - Decline invitation via email link');
    console.log('   - Updates status to DECLINED\n');
    
    console.log('   POST /api/reviewers/invitations/{id}/respond-public');
    console.log('   - Form-based response with optional message');
    console.log('   - Body: { "action": "accept|decline", "message": "optional" }\n');
    
    console.log('3. 📨 Testing with MailHog:');
    console.log(`   - MailHog Web UI: ${MAILHOG_BASE}`);
    console.log('   - All emails sent during development appear here');
    console.log('   - Click email links directly from MailHog interface\n');
    
    console.log('4. 🔄 Complete test workflow:\n');
    console.log('   a) Start development environment:');
    console.log('      npm run dev\n');
    
    console.log('   b) Open MailHog web interface:');
    console.log(`      ${MAILHOG_BASE}\n`);
    
    console.log('   c) Use editorial bot to send invitation:');
    console.log('      @editorial-bot invite-reviewer reviewer@test.com\n');
    
    console.log('   d) Check MailHog for invitation email');
    console.log('   e) Click "Accept Review" or "Decline Review" button');
    console.log('   f) Verify status update in database/frontend\n');
    
    // Test if MailHog is running
    try {
      await axios.get(`${MAILHOG_BASE}/api/v1/messages`);
      console.log('✅ MailHog is running and accessible');
    } catch (error) {
      console.log('❌ MailHog not accessible - make sure docker-compose is running');
      console.log('   Run: cd docker && docker-compose up -d');
    }
    
    // Test if API is running
    try {
      await axios.get(`${API_BASE}/health`);
      console.log('✅ API is running and accessible');
    } catch (error) {
      console.log('❌ API not accessible - make sure the development server is running');
      console.log('   Run: npm run dev');
    }
    
    console.log('\n5. 📋 Example test sequence:');
    console.log(`
    // 1. Get latest emails from MailHog
    curl ${MAILHOG_BASE}/api/v1/messages
    
    // 2. Extract invitation ID from email (example: abc-123-def)
    // 3. Test invitation details endpoint
    curl ${API_BASE}/api/reviewers/invitations/abc-123-def/public
    
    // 4. Test accept invitation
    curl "${API_BASE}/api/reviewers/invitations/abc-123-def/public?action=accept"
    
    // 5. Verify in database (using Prisma Studio)
    npm run db:studio
    `);
    
    console.log('\n🎉 Email invitation system is ready for testing!');
    console.log('\n💡 Pro tips:');
    console.log('   - Use @editorial-bot summary to see invitation statuses');
    console.log('   - Check conversation threads for automatic notifications');
    console.log('   - Test both accept and decline workflows');
    console.log('   - Verify SSE updates work in real-time');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Helper function to create a sample invitation for testing
async function createSampleInvitation() {
  console.log('\n🔧 Creating sample invitation for testing...');
  
  // This would typically be done through the bot system
  // but we can demonstrate the direct API call for testing
  
  const sampleData = {
    manuscriptId: 'sample-manuscript-id',
    reviewerEmails: ['test-reviewer@example.com'],
    message: 'This is a test invitation from the email testing script'
  };
  
  console.log('Sample invitation data:', JSON.stringify(sampleData, null, 2));
  console.log('\nTo create actual invitations, use the editorial bot in the web interface:');
  console.log('@editorial-bot invite-reviewer test-reviewer@example.com message="Please review this manuscript"');
}

if (require.main === module) {
  testEmailInvitations();
}

module.exports = { testEmailInvitations, createSampleInvitation };