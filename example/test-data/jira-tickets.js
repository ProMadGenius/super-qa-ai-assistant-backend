/**
 * Realistic Jira ticket test data for end-to-end testing
 */

// Feature ticket with detailed acceptance criteria
const featureTicket = {
  issueKey: 'FEAT-123',
  summary: 'Implement user profile management',
  description: `
    As a user, I want to be able to manage my profile information so that I can keep my account details up to date.
    
    Background:
    - Users currently cannot update their profile information after registration
    - Profile information includes: name, email, profile picture, notification preferences
    - Email changes require verification
  `,
  status: 'In Progress',
  priority: 'Priority: Medium',
  issueType: 'Feature',
  assignee: 'Jane Developer',
  reporter: 'Product Manager',
  comments: [
    {
      id: 'comment-1',
      author: 'UX Designer',
      body: 'I\'ve attached the design mockups for the profile page. Please follow these designs for implementation.',
      created: '2025-06-10T10:00:00Z',
      updated: '2025-06-10T10:00:00Z'
    },
    {
      id: 'comment-2',
      author: 'Security Team',
      body: 'Please ensure that email changes require verification via a confirmation link sent to the new email address.',
      created: '2025-06-11T14:30:00Z',
      updated: '2025-06-11T14:30:00Z'
    }
  ],
  attachments: [
    {
      id: 'attach-1',
      filename: 'profile-mockups.png',
      mimeType: 'image/png',
      size: 1024000,
      content: 'base64-encoded-content',
      created: '2025-06-10T10:00:00Z',
      author: 'UX Designer'
    }
  ],
  components: ['Frontend', 'User Management', 'API'],
  customFields: {
    acceptanceCriteria: `
      1. Users can view their current profile information
      2. Users can update their name and profile picture
      3. Users can change their email address with verification
      4. Users can update notification preferences
      5. Changes are saved immediately and reflected across the application
      6. Form validation prevents invalid inputs
      7. Users receive confirmation messages after successful updates
    `,
    storyPoints: '8',
    epicLink: 'USER-MANAGEMENT-EPIC'
  },
  scrapedAt: new Date().toISOString()
};

// Bug ticket with detailed reproduction steps
const bugTicket = {
  issueKey: 'BUG-456',
  summary: 'Password reset emails not being delivered',
  description: `
    Users are reporting that they are not receiving password reset emails when using the "Forgot Password" feature.
    
    Steps to reproduce:
    1. Navigate to login page
    2. Click "Forgot Password" link
    3. Enter registered email address
    4. Submit form
    5. Check email inbox (including spam folder)
    
    Expected: User receives password reset email with reset link
    Actual: No email is received
    
    Environment:
    - Production environment
    - Affects all users
    - Started occurring after the latest deployment on 2025-07-10
  `,
  status: 'Open',
  priority: 'Priority: High',
  issueType: 'Bug',
  assignee: 'John Developer',
  reporter: 'Customer Support',
  comments: [
    {
      id: 'comment-1',
      author: 'DevOps Engineer',
      body: 'I checked the email service logs and found that emails are being rejected by the mail server. There might be an issue with our email sender configuration.',
      created: '2025-07-12T09:15:00Z',
      updated: '2025-07-12T09:15:00Z'
    },
    {
      id: 'comment-2',
      author: 'QA Tester',
      body: 'I can confirm this issue in the staging environment as well. No emails are being delivered for any email-related functionality.',
      created: '2025-07-12T10:30:00Z',
      updated: '2025-07-12T10:30:00Z'
    }
  ],
  attachments: [
    {
      id: 'attach-1',
      filename: 'email-service-logs.txt',
      mimeType: 'text/plain',
      size: 15240,
      content: 'base64-encoded-content',
      created: '2025-07-12T09:20:00Z',
      author: 'DevOps Engineer'
    }
  ],
  components: ['Email Service', 'User Authentication'],
  customFields: {
    severity: 'Critical',
    affectedUsers: 'All users',
    impact: 'Users cannot reset passwords, blocking account access for those who forgot their passwords'
  },
  scrapedAt: new Date().toISOString()
};

// API enhancement ticket
const apiEnhancementTicket = {
  issueKey: 'API-789',
  summary: 'Add pagination to products API endpoint',
  description: `
    The products API endpoint currently returns all products in a single response, which is causing performance issues as the product catalog grows.
    
    We need to implement pagination for this endpoint to improve performance and reduce load times for clients.
    
    Current endpoint: GET /api/v1/products
    Proposed changes:
    - Add query parameters: page, pageSize
    - Return metadata with total count and pagination links
    - Default page size should be 20 items
    - Maximum page size should be 100 items
  `,
  status: 'To Do',
  priority: 'Priority: Medium',
  issueType: 'Enhancement',
  assignee: 'API Team',
  reporter: 'Performance Engineer',
  comments: [
    {
      id: 'comment-1',
      author: 'Frontend Developer',
      body: 'Please ensure the response includes total count so we can implement the pagination UI correctly.',
      created: '2025-07-05T11:20:00Z',
      updated: '2025-07-05T11:20:00Z'
    },
    {
      id: 'comment-2',
      author: 'API Team Lead',
      body: 'We should follow the same pagination pattern as our other endpoints. I\'ve attached the API design document for reference.',
      created: '2025-07-06T09:45:00Z',
      updated: '2025-07-06T09:45:00Z'
    }
  ],
  attachments: [
    {
      id: 'attach-1',
      filename: 'api-pagination-design.pdf',
      mimeType: 'application/pdf',
      size: 256000,
      content: 'base64-encoded-content',
      created: '2025-07-06T09:45:00Z',
      author: 'API Team Lead'
    }
  ],
  components: ['API', 'Backend', 'Products Service'],
  customFields: {
    acceptanceCriteria: `
      1. API endpoint accepts 'page' and 'pageSize' query parameters
      2. Default values are applied when parameters are not provided
      3. Response includes metadata with total count and pagination links
      4. Response time remains under 200ms for typical requests
      5. API documentation is updated to reflect the changes
      6. Backward compatibility is maintained for existing clients
    `,
    storyPoints: '5',
    technicalDebt: 'Low'
  },
  scrapedAt: new Date().toISOString()
};

// Security vulnerability ticket
const securityTicket = {
  issueKey: 'SEC-101',
  summary: 'Cross-Site Scripting (XSS) vulnerability in comment system',
  description: `
    A security audit has identified a Cross-Site Scripting (XSS) vulnerability in our comment system.
    
    Vulnerability details:
    - User-submitted comments are not properly sanitized before rendering
    - Malicious JavaScript can be injected via comments
    - This could allow attackers to steal session cookies or perform actions on behalf of other users
    
    Reproduction:
    1. Create a comment containing HTML and JavaScript, e.g., <script>alert('XSS')</script>
    2. Submit the comment
    3. When viewing the comment, the JavaScript executes in the browser
    
    Severity: High
    CVSS Score: 7.5
  `,
  status: 'Open',
  priority: 'Priority: Critical',
  issueType: 'Security',
  assignee: 'Security Team',
  reporter: 'Security Auditor',
  comments: [
    {
      id: 'comment-1',
      author: 'Security Engineer',
      body: 'I recommend implementing a content security policy (CSP) and using a library like DOMPurify to sanitize user input.',
      created: '2025-07-15T14:00:00Z',
      updated: '2025-07-15T14:00:00Z'
    },
    {
      id: 'comment-2',
      author: 'Frontend Lead',
      body: 'We\'ll implement input sanitization on both client and server sides to ensure proper protection.',
      created: '2025-07-15T15:30:00Z',
      updated: '2025-07-15T15:30:00Z'
    }
  ],
  attachments: [],
  components: ['Frontend', 'Security', 'Comment System'],
  customFields: {
    securitySeverity: 'High',
    cve: 'N/A',
    remediationDeadline: '2025-07-22',
    dataExposureRisk: 'User session data could be compromised'
  },
  scrapedAt: new Date().toISOString()
};

// Performance improvement ticket
const performanceTicket = {
  issueKey: 'PERF-234',
  summary: 'Optimize database queries for dashboard loading',
  description: `
    The main dashboard is loading slowly due to inefficient database queries. Users are experiencing load times of 5+ seconds, which is above our target of 2 seconds maximum.
    
    Performance analysis:
    - Dashboard makes 12 separate database queries
    - Some queries are retrieving unnecessary data
    - Missing indexes on frequently queried columns
    - N+1 query problem in the activity feed component
    
    We need to optimize these queries to improve dashboard loading performance.
  `,
  status: 'In Progress',
  priority: 'Priority: High',
  issueType: 'Improvement',
  assignee: 'Database Team',
  reporter: 'Performance Engineer',
  comments: [
    {
      id: 'comment-1',
      author: 'Database Administrator',
      body: 'I\'ve attached the query execution plans. The main bottleneck appears to be in the activity feed queries.',
      created: '2025-07-08T13:10:00Z',
      updated: '2025-07-08T13:10:00Z'
    },
    {
      id: 'comment-2',
      author: 'Backend Developer',
      body: 'We should consider implementing query batching and adding a caching layer for frequently accessed data.',
      created: '2025-07-08T14:25:00Z',
      updated: '2025-07-08T14:25:00Z'
    }
  ],
  attachments: [
    {
      id: 'attach-1',
      filename: 'query-execution-plans.json',
      mimeType: 'application/json',
      size: 45600,
      content: 'base64-encoded-content',
      created: '2025-07-08T13:10:00Z',
      author: 'Database Administrator'
    },
    {
      id: 'attach-2',
      filename: 'performance-metrics.pdf',
      mimeType: 'application/pdf',
      size: 128000,
      content: 'base64-encoded-content',
      created: '2025-07-08T13:15:00Z',
      author: 'Performance Engineer'
    }
  ],
  components: ['Database', 'Backend', 'Dashboard'],
  customFields: {
    acceptanceCriteria: `
      1. Dashboard loading time is reduced to under 2 seconds for 95th percentile
      2. CPU and memory usage are reduced by at least 30%
      3. Database query count is reduced by at least 50%
      4. No regression in dashboard functionality
      5. Performance improvements are verified in staging environment before deployment
    `,
    storyPoints: '8',
    performanceMetrics: 'Loading time, CPU usage, memory usage, query count, query execution time'
  },
  scrapedAt: new Date().toISOString()
};

// Export all test tickets
module.exports = {
  featureTicket,
  bugTicket,
  apiEnhancementTicket,
  securityTicket,
  performanceTicket
};