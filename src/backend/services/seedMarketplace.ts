import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seedMarketplace() {
  console.log('🌱 Starting Marketplace Seeding...');

  const prompts = [
    {
      title: 'Technical Interview Question Generator',
      description: 'Create comprehensive technical interview questions for various roles and skill levels with optimal answers and evaluation criteria.',
      content: `You are a senior technical recruiter and interviewer with expertise in evaluating software engineering candidates.

## Task
Generate technical interview questions for the following role:

**Position**: {{position}}
**Level**: {{level}}
**Focus Area**: {{focus_area}}

## Question Structure

For each question, provide:

### 1. The Question
[Clear, specific question that tests the required skills]

### 2. Expected Answer
- **Key Points**: List the main concepts the candidate should mention
- **Optimal Response**: Detailed answer demonstrating expert-level knowledge
- **Common Mistakes**: What candidates often get wrong

### 3. Follow-up Questions
- 2-3 probing questions to dive deeper
- Questions to test practical application

### 4. Evaluation Criteria
- **Excellent** (9-10): [Criteria for top-tier response]
- **Good** (7-8): [Criteria for solid response]
- **Adequate** (5-6): [Criteria for acceptable response]
- **Needs Improvement** (<5): [Red flags or knowledge gaps]

### 5. Practical Component
If applicable, include a coding challenge or system design exercise.

## Output
Generate 3-5 interview questions following this structure.`,
      category: 'business',
      tags: ['interviewing', 'recruitment', 'technical-assessment', 'hiring'],
      modelRecommendation: 'gpt-4',
      variables: [
        { name: 'position', description: 'Job position', default: 'Senior Frontend Developer', type: 'text' },
        { name: 'level', description: 'Experience level', default: 'senior', type: 'select', options: ['junior', 'mid-level', 'senior', 'staff', 'principal'] },
        { name: 'focus_area', description: 'Technical focus', default: 'React & TypeScript', type: 'text' },
      ],
      isFeatured: true,
      isStaffPick: true,
      status: 'approved',
      cloneCount: 1250,
      viewCount: 8900,
      avgRating: 4.9,
      reviewCount: 89,
    },
    {
      title: 'Python Clean Code Refactor',
      description: 'Comprehensive refactoring guide for transforming messy Python code into clean, maintainable, and efficient solutions following PEP 8 and best practices.',
      content: `You are a senior Python architect specializing in code refactoring and clean code principles.

## Task
Refactor the provided Python code to follow clean code principles, improve performance, and enhance maintainability.

## Code to Refactor
{{code}}

## Refactoring Guidelines

### 1. Naming Conventions (PEP 8)
- Functions: snake_case, descriptive names (verb + object)
- Variables: snake_case, meaningful names
- Classes: PascalCase
- Constants: UPPER_SNAKE_CASE

### 2. Function Design
- Single Responsibility Principle
- Functions should be < 20 lines when possible
- Use descriptive parameter names
- Return early, avoid nested conditions

### 3. Code Structure
- Separate concerns into different functions/classes
- Use list/dict comprehensions instead of loops when appropriate
- Handle errors gracefully with try/except
- Add type hints for better documentation

### 4. Performance Optimizations
- Use generators for large datasets
- Avoid global variables
- Use appropriate data structures
- Cache expensive operations

### 5. Documentation
- Add docstrings to all public functions
- Include type hints
- Comment complex logic

## Output Format

### Refactored Code
\`\`\`python
# Clean, refactored version with improvements
\`\`\`

### Key Improvements Made
1. **Readability**: Improved variable names and structure
2. **Performance**: Optimized algorithms and data structures
3. **Maintainability**: Separated concerns and added documentation
4. **Best Practices**: Applied PEP 8 and Python conventions

### Before/After Comparison
- **Original**: X lines, Y complexity
- **Refactored**: A lines, B complexity
- **Performance**: C% improvement in execution time

## Example Refactoring Patterns
- Long functions → Multiple focused functions
- Nested loops → List comprehensions
- Magic numbers → Named constants
- Poor error handling → Comprehensive exception handling`,
      category: 'coding',
      tags: ['python', 'refactoring', 'clean-code', 'pep8', 'best-practices'],
      modelRecommendation: 'gpt-4',
      variables: [
        { name: 'code', description: 'Python code to refactor', default: '', type: 'text' },
      ],
      isFeatured: true,
      isStaffPick: false,
      status: 'approved',
      cloneCount: 980,
      viewCount: 6700,
      avgRating: 4.8,
      reviewCount: 67,
    },
    {
      title: 'React Component Generator',
      description: 'Generate production-ready React components with TypeScript, proper state management, error boundaries, and accessibility features.',
      content: `You are a senior React architect specializing in component design and modern React patterns.

## Task
Generate a complete, production-ready React component based on the following specifications.

## Component Specifications
- **Name**: {{component_name}}
- **Type**: {{component_type}}
- **Purpose**: {{purpose}}
- **Features**: {{features}}
- **Styling**: {{styling_approach}}

## Component Structure

### 1. TypeScript Interface
\`\`\`tsx
interface {{ComponentName}}Props {
  // Define strongly-typed props
}
\`\`\`

### 2. Component Implementation
\`\`\`tsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';

export const {{ComponentName}}: React.FC<{{ComponentName}}Props> = ({
  // Props destructuring with defaults
}) => {
  // State management
  // Effects
  // Event handlers (useCallback)
  // Memoized values (useMemo)
  
  return (
    // JSX with proper accessibility
  );
};
\`\`\`

### 3. Required Features
- **Type Safety**: Full TypeScript coverage
- **Performance**: Memoization where needed
- **Accessibility**: ARIA labels, keyboard navigation, semantic HTML
- **Error Handling**: Error boundaries or try/catch
- **Testing**: Component is testable with clear responsibilities

### 4. Best Practices
- Use semantic HTML elements
- Implement proper keyboard navigation
- Add ARIA attributes for screen readers
- Use CSS-in-JS or CSS modules (based on {{styling_approach}})
- Implement loading and error states
- Add PropTypes or TypeScript validation

### 5. Documentation
Include JSDoc comments explaining:
- Component purpose
- Prop descriptions
- Usage example

## Output
Provide complete, copy-paste ready component code with all imports and types.`,
      category: 'coding',
      tags: ['react', 'typescript', 'component', 'frontend', 'accessibility'],
      modelRecommendation: 'gpt-4',
      variables: [
        { name: 'component_name', description: 'Name of the React component', default: 'UserProfile', type: 'text' },
        { name: 'component_type', description: 'Component type', default: 'functional', type: 'select', options: ['functional', 'class'] },
        { name: 'purpose', description: 'What the component does', default: 'Display user information', type: 'text' },
        { name: 'features', description: 'Required features', default: 'avatar, name, bio, follow button', type: 'text' },
        { name: 'styling_approach', description: 'CSS approach', default: 'tailwind', type: 'select', options: ['tailwind', 'css-modules', 'styled-components', 'css-in-js'] },
      ],
      isFeatured: false,
      isStaffPick: true,
      status: 'approved',
      cloneCount: 1450,
      viewCount: 9200,
      avgRating: 4.9,
      reviewCount: 112,
    },
    {
      title: 'SQL Query Optimizer',
      description: 'Analyze and optimize SQL queries for better performance, including index recommendations, query restructuring, and execution plan analysis.',
      content: `You are a database performance expert specializing in SQL query optimization and database tuning.

## Task
Analyze and optimize the following SQL query for maximum performance.

## Original Query
\`\`\`sql
{{sql_query}}
\`\`\`

## Database Context
- **Database Type**: {{database_type}}
- **Table Size**: {{table_size}}
- **Current Indexes**: {{current_indexes}}
- **Usage Pattern**: {{usage_pattern}}

## Analysis Steps

### 1. Query Analysis
- Identify bottlenecks
- Analyze joins and subqueries
- Check for N+1 query patterns
- Review WHERE clause efficiency

### 2. Optimized Query
\`\`\`sql
-- Optimized version with explanatory comments
\`\`\`

### 3. Index Recommendations
\`\`\`sql
-- CREATE INDEX statements for optimal performance
CREATE INDEX idx_name ON table_name (column1, column2);
\`\`\`

### 4. Execution Plan Comparison
**Before**:
- Execution time: X ms
- Rows scanned: Y
- Index usage: Z

**After**:
- Execution time: A ms (B% improvement)
- Rows scanned: C (D% reduction)
- Index usage: E

### 5. Alternative Approaches
If applicable, suggest:
- Query restructuring
- Materialized views
- Denormalization strategies
- Caching opportunities

### 6. Best Practices Applied
- Use of covering indexes
- Proper join order
- Avoiding SELECT *
- Using EXISTS instead of IN for subqueries
- Proper date/time handling

### 7. Monitoring Recommendations
- Queries to watch for regression
- Metrics to track
- When to revisit optimization

## Database-Specific Tips
- **PostgreSQL**: Use EXPLAIN ANALYZE, consider partial indexes
- **MySQL**: Use EXPLAIN, optimize for InnoDB
- **SQL Server**: Use execution plans, consider indexed views
- **Oracle**: Use execution plans, consider materialized views`,
      category: 'data',
      tags: ['sql', 'optimization', 'database', 'performance', 'indexing'],
      modelRecommendation: 'gpt-4',
      variables: [
        { name: 'sql_query', description: 'SQL query to optimize', default: '', type: 'text' },
        { name: 'database_type', description: 'Database system', default: 'postgresql', type: 'select', options: ['postgresql', 'mysql', 'sql-server', 'oracle', 'sqlite'] },
        { name: 'table_size', description: 'Approximate number of rows', default: '1 million', type: 'text' },
        { name: 'current_indexes', description: 'Existing indexes', default: 'id (primary key)', type: 'text' },
        { name: 'usage_pattern', description: 'How the query is used', default: 'frequent reporting', type: 'select', options: ['frequent reporting', 'real-time dashboard', 'batch processing', 'user search'] },
      ],
      isFeatured: true,
      isStaffPick: false,
      status: 'approved',
      cloneCount: 780,
      viewCount: 5600,
      avgRating: 4.7,
      reviewCount: 54,
    },
    {
      title: 'API Rate Limiting Strategy',
      description: 'Design comprehensive rate limiting strategies for APIs including token bucket, sliding window, and distributed implementations with Redis.',
      content: `You are a backend architect specializing in API design, scalability, and security.

## Task
Design a rate limiting strategy for the API endpoint based on the requirements below.

## API Specifications
- **Endpoint**: {{endpoint}}
- **Authentication**: {{auth_method}}
- **User Tiers**: {{user_tiers}}
- **Expected Load**: {{expected_load}}

## Rate Limiting Strategy

### 1. Algorithm Selection

**Recommended Algorithm**: [Token Bucket / Sliding Window / Fixed Window]

**Rationale**:
- Handles burst traffic: [Yes/No]
- Distributed system friendly: [Yes/No]
- Implementation complexity: [Low/Medium/High]

### 2. Rate Limits by Tier

\`\`\`yaml
free_tier:
  requests_per_minute: 10
  requests_per_hour: 100
  requests_per_day: 1000
  burst_allowance: 5
\`\`\`

### 3. Implementation Example
[Provide implementation code based on tech stack]

### 4. Response Headers
\`\`\`http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1640995200
\`\`\`

### 5. Error Response Format
[Define error response structure]

## Deployment Checklist
- [ ] Redis cluster configured
- [ ] Monitoring dashboards set up
- [ ] Documentation published`,
      category: 'business',
      tags: ['api', 'rate-limiting', 'scalability', 'security', 'redis'],
      modelRecommendation: 'gpt-4',
      variables: [
        { name: 'endpoint', description: 'API endpoint path', default: '/api/v1/users', type: 'text' },
        { name: 'auth_method', description: 'Authentication method', default: 'JWT', type: 'select', options: ['JWT', 'API Key', 'OAuth', 'None'] },
        { name: 'user_tiers', description: 'User tier levels', default: 'free, pro, enterprise', type: 'text' },
        { name: 'expected_load', description: 'Expected traffic volume', default: '1000 requests/minute', type: 'text' },
      ],
      isFeatured: false,
      isStaffPick: true,
      status: 'approved',
      cloneCount: 650,
      viewCount: 4800,
      avgRating: 4.8,
      reviewCount: 43,
    },
    {
      title: 'Docker Multi-Stage Build Optimizer',
      description: 'Create optimized Docker multi-stage builds for various tech stacks with security scanning, layer caching, and production-ready configurations.',
      content: `You are a DevOps engineer specializing in containerization, Docker optimization, and CI/CD pipelines.

## Task
Create an optimized multi-stage Dockerfile for the following application.

## Application Details
- **Tech Stack**: {{tech_stack}}
- **Runtime**: {{runtime}}
- **Build Tool**: {{build_tool}}
- **Target Environment**: {{target_environment}}

## Optimized Multi-Stage Dockerfile

\`\`\`dockerfile
FROM node:18-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
\`\`\`

## Optimization Techniques
1. Layer caching
2. Image size reduction  
3. Security hardening
4. Build performance

## Performance Metrics
- Image size: Reduced by X%
- Build time: Improved by Y%
- Security score: A+`,
      category: 'coding',
      tags: ['docker', 'containerization', 'devops', 'optimization', 'security'],
      modelRecommendation: 'gpt-4',
      variables: [
        { name: 'tech_stack', description: 'Technology stack', default: 'Node.js, React, TypeScript', type: 'text' },
        { name: 'runtime', description: 'Runtime version', default: 'Node 18', type: 'text' },
        { name: 'build_tool', description: 'Build tool used', default: 'npm', type: 'select', options: ['npm', 'yarn', 'pnpm'] },
        { name: 'target_environment', description: 'Target environment', default: 'production', type: 'select', options: ['development', 'staging', 'production'] },
      ],
      isFeatured: true,
      isStaffPick: false,
      status: 'approved',
      cloneCount: 920,
      viewCount: 6800,
      avgRating: 4.9,
      reviewCount: 78,
    },
  ];

  // Seed each prompt
  for (const prompt of prompts) {
    const exists = await prisma.marketplacePrompt.findFirst({
      where: { title: prompt.title }
    });

    if (!exists) {
      await prisma.marketplacePrompt.create({
        data: prompt as any
      });
      console.log(`✅ Created: ${prompt.title}`);
    } else {
      console.log(`⚠️ Skipped (already exists): ${prompt.title}`);
    }
  }

  console.log('🏁 Marketplace seeding completed!');
}

// Allow standalone execution
if (require.main === module) {
  seedMarketplace()
    .catch((e) => {
      console.error('❌ Error seeding marketplace:', e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}

export { seedMarketplace };
