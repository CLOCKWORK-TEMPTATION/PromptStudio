/*
  # Seed Templates and Techniques
  
  ## Overview
  This migration populates the templates and techniques tables with
  comprehensive starter content for prompt engineering education.
  
  ## Content Added
  1. Templates - 20+ pre-built prompt templates across categories
  2. Techniques - 12 core prompt engineering techniques with examples
*/

-- Seed Templates
INSERT INTO templates (title, description, content, category, subcategory, tags, difficulty, model_recommendation, variables, examples, is_featured) VALUES

-- Coding Templates
('Code Review Assistant', 'Comprehensive code review with security, performance, and best practices analysis', 
'You are an expert code reviewer with deep knowledge in software engineering best practices, security vulnerabilities, and performance optimization.

## Your Task
Review the following code and provide detailed feedback.

## Code to Review
```{{language}}
{{code}}
```

## Review Criteria
1. **Security**: Identify potential vulnerabilities (injection, XSS, etc.)
2. **Performance**: Spot inefficiencies and optimization opportunities
3. **Best Practices**: Check adherence to {{language}} conventions
4. **Maintainability**: Assess code readability and documentation
5. **Error Handling**: Evaluate robustness of error management

## Output Format
Provide your review in the following structure:
- **Summary**: One paragraph overview
- **Critical Issues**: Must-fix problems (if any)
- **Improvements**: Recommended enhancements
- **Positive Aspects**: What''s done well
- **Refactored Code**: Show improved version if applicable',
'coding', 'review', ARRAY['code-review', 'security', 'best-practices'], 'intermediate', 'gpt-4',
'[{"name": "language", "description": "Programming language", "default": "python"}, {"name": "code", "description": "Code to review"}]',
'[{"input": "Review a Python function", "output": "Detailed review with suggestions"}]', true),

('Bug Fixer', 'Diagnose and fix bugs with detailed explanation',
'You are a debugging expert. Analyze the code, identify the bug, and provide a fix.

## Problem Description
{{problem_description}}

## Buggy Code
```{{language}}
{{code}}
```

## Error Message (if any)
{{error_message}}

## Your Response Should Include
1. **Root Cause Analysis**: What''s causing the bug
2. **Step-by-Step Fix**: How to resolve it
3. **Fixed Code**: Complete working solution
4. **Prevention Tips**: How to avoid similar bugs
5. **Test Cases**: Verify the fix works',
'coding', 'debugging', ARRAY['debugging', 'bug-fix', 'troubleshooting'], 'beginner', 'gpt-4',
'[{"name": "language", "description": "Programming language"}, {"name": "code", "description": "Buggy code"}, {"name": "problem_description", "description": "What should the code do"}, {"name": "error_message", "description": "Error message if any", "default": "No error message provided"}]',
'[]', true),

('API Documentation Generator', 'Generate comprehensive API documentation',
'You are a technical writer specializing in API documentation.

## API Endpoint Details
- **Method**: {{http_method}}
- **Path**: {{endpoint_path}}
- **Description**: {{description}}

## Request/Response Schema
{{schema}}

## Generate Documentation Including
1. **Overview**: Clear description of what the endpoint does
2. **Authentication**: Required auth method
3. **Parameters**: Table of all parameters with types and descriptions
4. **Request Example**: cURL and {{language}} examples
5. **Response Examples**: Success and error responses
6. **Rate Limits**: If applicable
7. **Common Errors**: Troubleshooting guide',
'coding', 'documentation', ARRAY['api', 'documentation', 'technical-writing'], 'intermediate', 'gpt-4',
'[{"name": "http_method", "description": "HTTP method (GET, POST, etc.)"}, {"name": "endpoint_path", "description": "API endpoint path"}, {"name": "description", "description": "What the endpoint does"}, {"name": "schema", "description": "Request/response schema"}, {"name": "language", "description": "Code example language", "default": "python"}]',
'[]', false),

('Unit Test Generator', 'Create comprehensive unit tests for code',
'You are a QA engineer expert in writing thorough unit tests.

## Code to Test
```{{language}}
{{code}}
```

## Testing Framework
{{test_framework}}

## Requirements
Generate comprehensive unit tests covering:
1. **Happy Path**: Normal expected behavior
2. **Edge Cases**: Boundary conditions, empty inputs, large inputs
3. **Error Cases**: Invalid inputs, exceptions
4. **Integration Points**: Mock external dependencies

## Output
- Well-organized test file
- Descriptive test names
- Arrange-Act-Assert pattern
- Comments explaining test purpose',
'coding', 'testing', ARRAY['unit-tests', 'testing', 'qa'], 'intermediate', 'gpt-4',
'[{"name": "language", "description": "Programming language"}, {"name": "code", "description": "Code to test"}, {"name": "test_framework", "description": "Testing framework", "default": "pytest"}]',
'[]', true),

-- Writing Templates
('Blog Post Writer', 'Create engaging, SEO-optimized blog posts',
'You are a professional content writer with expertise in {{topic_area}}.

## Article Requirements
- **Topic**: {{topic}}
- **Target Audience**: {{audience}}
- **Tone**: {{tone}}
- **Word Count**: {{word_count}} words
- **Keywords**: {{keywords}}

## Structure Your Article As
1. **Compelling Title**: Include primary keyword
2. **Hook Introduction**: Grab attention in first 2 sentences
3. **Main Body**: 
   - Use H2 and H3 subheadings
   - Include bullet points for scannability
   - Add relevant examples and data
4. **Conclusion**: Summarize key points with CTA
5. **Meta Description**: 155 characters for SEO

## Writing Guidelines
- Use active voice
- Keep paragraphs under 3 sentences
- Include transition phrases
- Avoid jargon unless necessary',
'writing', 'blog', ARRAY['blog', 'content-writing', 'seo'], 'beginner', 'gpt-4',
'[{"name": "topic", "description": "Blog post topic"}, {"name": "topic_area", "description": "Your expertise area"}, {"name": "audience", "description": "Target readers"}, {"name": "tone", "description": "Writing tone", "default": "professional yet approachable"}, {"name": "word_count", "description": "Target word count", "default": "1500"}, {"name": "keywords", "description": "SEO keywords to include"}]',
'[]', true),

('Email Sequence Creator', 'Design converting email marketing sequences',
'You are an email marketing expert with high conversion rates.

## Campaign Details
- **Product/Service**: {{product}}
- **Goal**: {{campaign_goal}}
- **Audience Segment**: {{audience}}
- **Sequence Length**: {{num_emails}} emails

## For Each Email Provide
1. **Subject Line**: A/B test options
2. **Preview Text**: First 40 characters
3. **Email Body**: Following AIDA framework
4. **CTA**: Clear call-to-action
5. **Send Timing**: Days between emails

## Email Types to Include
- Welcome/Introduction
- Value/Education
- Social Proof
- Objection Handling
- Urgency/Scarcity
- Final Push

## Constraints
- Mobile-friendly formatting
- Personalization tokens where appropriate
- Unsubscribe reminder',
'writing', 'email', ARRAY['email-marketing', 'copywriting', 'conversion'], 'intermediate', 'gpt-4',
'[{"name": "product", "description": "Product or service"}, {"name": "campaign_goal", "description": "Campaign objective"}, {"name": "audience", "description": "Target audience"}, {"name": "num_emails", "description": "Number of emails", "default": "5"}]',
'[]', false),

-- Analysis Templates
('Data Analysis Report', 'Generate insights from data with actionable recommendations',
'You are a senior data analyst presenting findings to stakeholders.

## Data Context
- **Dataset**: {{dataset_description}}
- **Analysis Goal**: {{analysis_goal}}
- **Time Period**: {{time_period}}

## Data Summary
{{data_summary}}

## Generate Report Including
1. **Executive Summary**: 3-4 key findings
2. **Methodology**: How analysis was conducted
3. **Key Metrics**: 
   - Trend analysis
   - Comparisons to benchmarks
   - Statistical significance
4. **Visualizations**: Describe ideal charts
5. **Insights**: What the data reveals
6. **Recommendations**: Actionable next steps
7. **Limitations**: Data caveats

## Output Format
Use clear headings, bullet points, and highlight important numbers.',
'analysis', 'data', ARRAY['data-analysis', 'reporting', 'insights'], 'advanced', 'gpt-4',
'[{"name": "dataset_description", "description": "What data you have"}, {"name": "analysis_goal", "description": "What you want to learn"}, {"name": "time_period", "description": "Analysis time range"}, {"name": "data_summary", "description": "Key data points or statistics"}]',
'[]', true),

('Competitive Analysis', 'Analyze competitors and identify opportunities',
'You are a market research analyst specializing in competitive intelligence.

## Company Context
- **Your Company**: {{company_name}}
- **Industry**: {{industry}}
- **Competitors to Analyze**: {{competitors}}

## Analysis Framework
For each competitor, analyze:

1. **Product/Service Comparison**
   - Features matrix
   - Pricing strategy
   - Unique selling points

2. **Market Position**
   - Target audience
   - Brand positioning
   - Market share (if known)

3. **Strengths & Weaknesses**
   - SWOT analysis
   - Customer reviews sentiment

4. **Digital Presence**
   - Website quality
   - SEO performance indicators
   - Social media engagement

5. **Opportunities**
   - Gaps you can fill
   - Underserved segments
   - Differentiation strategies

## Output
Structured report with comparison tables and strategic recommendations.',
'analysis', 'market', ARRAY['competitive-analysis', 'market-research', 'strategy'], 'intermediate', 'gpt-4',
'[{"name": "company_name", "description": "Your company name"}, {"name": "industry", "description": "Your industry"}, {"name": "competitors", "description": "List of competitors to analyze"}]',
'[]', false),

-- Creative Templates
('Story Generator', 'Create engaging short stories with compelling narratives',
'You are a creative writer crafting a {{genre}} story.

## Story Parameters
- **Genre**: {{genre}}
- **Setting**: {{setting}}
- **Main Character**: {{protagonist}}
- **Conflict**: {{conflict}}
- **Tone**: {{tone}}
- **Length**: {{length}}

## Story Structure
1. **Hook**: Open with action or intrigue
2. **Setup**: Introduce character and world
3. **Rising Action**: Build tension
4. **Climax**: Peak of conflict
5. **Resolution**: Satisfying conclusion

## Writing Guidelines
- Show, don''t tell
- Use sensory details
- Create authentic dialogue
- Maintain consistent voice
- End with impact',
'creative', 'fiction', ARRAY['storytelling', 'creative-writing', 'fiction'], 'beginner', 'gpt-4',
'[{"name": "genre", "description": "Story genre"}, {"name": "setting", "description": "Time and place"}, {"name": "protagonist", "description": "Main character description"}, {"name": "conflict", "description": "Central conflict"}, {"name": "tone", "description": "Story tone", "default": "dramatic"}, {"name": "length", "description": "Story length", "default": "1000 words"}]',
'[]', true),

('Marketing Copy Generator', 'Create persuasive marketing copy that converts',
'You are a world-class copywriter with expertise in conversion optimization.

## Product/Service
- **Name**: {{product_name}}
- **Description**: {{product_description}}
- **Key Benefits**: {{benefits}}
- **Target Audience**: {{target_audience}}
- **Price Point**: {{price}}

## Generate Copy For
1. **Headlines**: 5 options using different formulas (How-to, Number, Question, Command, Benefit)
2. **Subheadlines**: Supporting statements
3. **Body Copy**: Feature-benefit pairs
4. **Social Proof Section**: Testimonial framework
5. **CTA Buttons**: 3 variations
6. **Urgency Elements**: Scarcity or time-limited offers

## Copy Principles
- Lead with benefits, support with features
- Use power words
- Address objections
- Create emotional connection
- Clear and scannable format',
'creative', 'marketing', ARRAY['copywriting', 'marketing', 'conversion'], 'intermediate', 'gpt-4',
'[{"name": "product_name", "description": "Product name"}, {"name": "product_description", "description": "What the product does"}, {"name": "benefits", "description": "Key benefits"}, {"name": "target_audience", "description": "Who it is for"}, {"name": "price", "description": "Price point", "default": "Not specified"}]',
'[]', true),

-- Data Templates
('SQL Query Builder', 'Generate optimized SQL queries from natural language',
'You are a database expert specializing in {{database_type}}.

## Database Schema
{{schema}}

## Query Request
{{query_description}}

## Generate
1. **SQL Query**: Optimized and formatted
2. **Explanation**: What each part does
3. **Performance Notes**: Index recommendations
4. **Alternative Approaches**: If applicable
5. **Sample Output**: Expected result structure

## Best Practices to Follow
- Use appropriate JOINs
- Avoid SELECT *
- Include WHERE clauses for filtering
- Consider query execution order
- Add comments for complex logic',
'data', 'sql', ARRAY['sql', 'database', 'queries'], 'intermediate', 'gpt-4',
'[{"name": "database_type", "description": "Database system", "default": "PostgreSQL"}, {"name": "schema", "description": "Table schemas"}, {"name": "query_description", "description": "What data you need"}]',
'[]', true),

('JSON Schema Generator', 'Create validated JSON schemas from examples',
'You are a data architect designing robust JSON schemas.

## Input
{{json_example}}

## Requirements
- **Schema Version**: {{schema_version}}
- **Strictness**: {{strictness_level}}
- **Purpose**: {{purpose}}

## Generate
1. **JSON Schema**: Complete and validated
2. **Field Descriptions**: For documentation
3. **Validation Rules**: Required fields, formats, patterns
4. **Example Valid Object**: That passes schema
5. **Example Invalid Object**: With explanation of why it fails

## Include
- Type definitions
- String patterns (regex)
- Number ranges
- Array constraints
- Custom error messages',
'data', 'schema', ARRAY['json', 'schema', 'validation'], 'intermediate', 'gpt-4',
'[{"name": "json_example", "description": "Example JSON object"}, {"name": "schema_version", "description": "JSON Schema version", "default": "draft-07"}, {"name": "strictness_level", "description": "How strict", "default": "moderate"}, {"name": "purpose", "description": "What the schema is for"}]',
'[]', false),

-- Business Templates
('Meeting Notes Summarizer', 'Transform meeting transcripts into actionable summaries',
'You are an executive assistant summarizing a meeting.

## Meeting Details
- **Meeting Type**: {{meeting_type}}
- **Attendees**: {{attendees}}
- **Date**: {{date}}

## Transcript
{{transcript}}

## Generate Summary Including
1. **TL;DR**: 2-3 sentence overview
2. **Key Decisions**: What was decided
3. **Action Items**: 
   - Task description
   - Owner
   - Deadline
4. **Discussion Points**: Main topics covered
5. **Open Questions**: Unresolved items
6. **Next Steps**: Follow-up actions
7. **Next Meeting**: If scheduled

## Format
- Use bullet points
- Bold important items
- Keep concise but complete',
'business', 'meetings', ARRAY['meetings', 'summary', 'productivity'], 'beginner', 'gpt-4',
'[{"name": "meeting_type", "description": "Type of meeting"}, {"name": "attendees", "description": "Who attended"}, {"name": "date", "description": "Meeting date"}, {"name": "transcript", "description": "Meeting transcript or notes"}]',
'[]', true),

('Business Proposal Writer', 'Create professional business proposals',
'You are a business development expert crafting a winning proposal.

## Proposal Context
- **Client**: {{client_name}}
- **Industry**: {{client_industry}}
- **Problem/Need**: {{client_need}}
- **Your Solution**: {{solution}}
- **Budget Range**: {{budget}}
- **Timeline**: {{timeline}}

## Proposal Structure
1. **Executive Summary**: Compelling overview
2. **Understanding of Needs**: Show you understand their pain
3. **Proposed Solution**: Detailed approach
4. **Methodology**: How you will deliver
5. **Timeline & Milestones**: Project phases
6. **Team**: Key personnel
7. **Investment**: Pricing breakdown
8. **Case Studies**: Relevant success stories
9. **Terms & Conditions**: Standard clauses
10. **Next Steps**: Clear CTA

## Tone
Professional, confident, client-focused',
'business', 'proposals', ARRAY['proposal', 'business-development', 'sales'], 'advanced', 'gpt-4',
'[{"name": "client_name", "description": "Client company name"}, {"name": "client_industry", "description": "Client industry"}, {"name": "client_need", "description": "Problem to solve"}, {"name": "solution", "description": "Your proposed solution"}, {"name": "budget", "description": "Budget range"}, {"name": "timeline", "description": "Expected timeline"}]',
'[]', false),

-- Customer Service Templates
('Customer Support Response', 'Handle customer inquiries professionally',
'You are a customer support specialist for {{company_name}}.

## Company Context
- **Product/Service**: {{product}}
- **Support Policies**: {{policies}}

## Customer Message
{{customer_message}}

## Response Guidelines
1. **Acknowledge**: Show you understand their concern
2. **Empathize**: Validate their feelings
3. **Solve**: Provide clear solution or next steps
4. **Prevent**: Explain how to avoid in future
5. **Close**: Friendly sign-off with offer to help more

## Tone
- Warm and professional
- Solution-oriented
- No blame or defensiveness
- Use customer''s name
- Keep concise but thorough

## Format
- Greeting
- Body (2-3 paragraphs max)
- Action items (if any)
- Sign-off',
'customer-service', 'support', ARRAY['customer-support', 'communication', 'service'], 'beginner', 'gpt-4',
'[{"name": "company_name", "description": "Your company"}, {"name": "product", "description": "Product or service"}, {"name": "policies", "description": "Relevant policies"}, {"name": "customer_message", "description": "Customer inquiry"}]',
'[]', true),

-- Education Templates
('Lesson Plan Creator', 'Design comprehensive lesson plans',
'You are an experienced educator creating a lesson plan.

## Lesson Details
- **Subject**: {{subject}}
- **Topic**: {{topic}}
- **Grade Level**: {{grade_level}}
- **Duration**: {{duration}}
- **Learning Objectives**: {{objectives}}

## Lesson Plan Structure
1. **Overview**: Topic summary
2. **Learning Objectives**: SMART goals
3. **Materials Needed**: List all resources
4. **Introduction (10%)**: Hook and prior knowledge activation
5. **Direct Instruction (30%)**: Core teaching
6. **Guided Practice (30%)**: Collaborative activities
7. **Independent Practice (20%)**: Individual work
8. **Assessment**: How to measure understanding
9. **Closure (10%)**: Summarize and preview
10. **Differentiation**: Accommodations for diverse learners
11. **Extension Activities**: For advanced students

## Include
- Discussion questions
- Activity instructions
- Assessment rubric',
'education', 'teaching', ARRAY['lesson-plan', 'education', 'teaching'], 'intermediate', 'gpt-4',
'[{"name": "subject", "description": "Subject area"}, {"name": "topic", "description": "Specific topic"}, {"name": "grade_level", "description": "Student grade level"}, {"name": "duration", "description": "Lesson duration"}, {"name": "objectives", "description": "What students will learn"}]',
'[]', false),

('Concept Explainer', 'Explain complex concepts simply',
'You are an expert teacher who excels at making complex topics accessible.

## Concept to Explain
{{concept}}

## Audience
- **Knowledge Level**: {{audience_level}}
- **Background**: {{audience_background}}

## Explanation Framework
1. **One-Line Summary**: Core concept in simple terms
2. **Analogy**: Relatable comparison
3. **Visual Description**: How to picture it
4. **Step-by-Step**: Break down the concept
5. **Real-World Example**: Practical application
6. **Common Misconceptions**: What people get wrong
7. **Key Takeaways**: 3 main points to remember
8. **Further Learning**: Next concepts to explore

## Guidelines
- Avoid jargon (or explain it)
- Use concrete examples
- Build from known to unknown
- Check understanding with questions',
'education', 'explanation', ARRAY['explanation', 'learning', 'simplification'], 'beginner', 'gpt-4',
'[{"name": "concept", "description": "Concept to explain"}, {"name": "audience_level", "description": "Beginner/Intermediate/Advanced"}, {"name": "audience_background", "description": "Audience context"}]',
'[]', true);

-- Seed Techniques
INSERT INTO techniques (title, slug, description, content, category, difficulty, tags, examples, best_for, related_techniques, display_order) VALUES

('Chain of Thought', 'chain-of-thought', 'Guide the AI through step-by-step reasoning for complex problems',
'## What is Chain of Thought?

Chain of Thought (CoT) prompting encourages the AI to break down complex problems into sequential reasoning steps, showing its work rather than jumping to conclusions.

## Why It Works

LLMs perform better on complex tasks when they "think out loud." By explicitly asking for step-by-step reasoning, you:
- Reduce errors in multi-step problems
- Get more transparent and verifiable outputs
- Enable the model to catch its own mistakes

## How to Use It

### Basic Pattern
```
Solve this problem step by step:
[Your problem]

Think through each step carefully before giving your final answer.
```

### Advanced Pattern
```
Let''s approach this systematically:

1. First, identify what we know
2. Then, determine what we need to find
3. Next, plan our approach
4. Execute each step
5. Verify our answer

Problem: [Your problem]
```

## Key Phrases to Trigger CoT
- "Let''s think step by step"
- "Walk me through your reasoning"
- "Show your work"
- "Break this down into steps"
- "Think about this carefully"

## When to Use
- Math and logic problems
- Complex analysis tasks
- Multi-step processes
- Debugging code
- Decision-making scenarios',
'reasoning', 'beginner', 
ARRAY['reasoning', 'problem-solving', 'step-by-step'],
'[{"name": "Math Problem", "prompt": "Solve step by step: If a store offers 20% off, and then an additional 15% off the sale price, what is the total percentage discount?", "explanation": "Forces the model to calculate each discount sequentially"}]',
ARRAY['math', 'logic', 'analysis', 'debugging'],
ARRAY['tree-of-thoughts', 'self-consistency'],
1),

('Few-Shot Learning', 'few-shot-learning', 'Provide examples to establish patterns and expected output format',
'## What is Few-Shot Learning?

Few-Shot Learning involves providing the AI with a few examples of the desired input-output pattern before asking it to process new inputs. The model learns the pattern from your examples.

## Why It Works

Examples are more powerful than instructions because they:
- Demonstrate exact formatting expectations
- Show edge cases and how to handle them
- Establish tone and style implicitly
- Reduce ambiguity in complex tasks

## How to Use It

### Basic Pattern (3-Shot)
```
Convert company names to stock ticker symbols:

Company: Apple Inc.
Ticker: AAPL

Company: Microsoft Corporation
Ticker: MSFT

Company: Amazon.com Inc.
Ticker: AMZN

Company: [New Company]
Ticker:
```

### With Explanations
```
Classify customer feedback:

Feedback: "The product arrived broken"
Category: Product Quality
Reasoning: Mentions physical damage to product

Feedback: "Shipping took 3 weeks"
Category: Delivery
Reasoning: Complaint about shipping time

Feedback: "[New feedback]"
Category:
Reasoning:
```

## Best Practices
1. Use 3-5 diverse examples
2. Include edge cases
3. Keep formatting consistent
4. Order examples from simple to complex
5. Match example complexity to actual task',
'learning', 'beginner',
ARRAY['examples', 'pattern-matching', 'formatting'],
'[{"name": "Sentiment Analysis", "prompt": "Examples showing positive, negative, and neutral sentiment with the new text to classify", "explanation": "Model learns classification pattern from examples"}]',
ARRAY['classification', 'formatting', 'data-extraction'],
ARRAY['zero-shot', 'chain-of-thought'],
2),

('Role Assignment', 'role-assignment', 'Assign a specific expert persona to improve response quality',
'## What is Role Assignment?

Role Assignment (also called Persona Prompting) involves telling the AI to adopt a specific expert identity, which influences its knowledge focus, communication style, and problem-solving approach.

## Why It Works

Assigning a role:
- Activates relevant domain knowledge
- Sets appropriate communication style
- Establishes expertise level
- Creates consistent perspective

## How to Use It

### Basic Pattern
```
You are a [role] with [X years] of experience in [domain].

Your expertise includes:
- [Skill 1]
- [Skill 2]
- [Skill 3]

[Your task or question]
```

### Advanced Pattern
```
You are Dr. Sarah Chen, a senior data scientist at a Fortune 500 company with 15 years of experience in machine learning and statistical analysis.

Background:
- PhD in Statistics from MIT
- Published 20+ papers on predictive modeling
- Led teams of 10+ data scientists
- Specializes in financial forecasting

Communication style:
- Technical but accessible
- Data-driven recommendations
- Always considers business impact

Task: [Your specific request]
```

## Effective Roles
- Senior Software Engineer
- Medical Professional
- Legal Expert
- Financial Analyst
- UX Researcher
- Marketing Strategist
- Technical Writer',
'persona', 'beginner',
ARRAY['persona', 'expertise', 'style'],
'[{"name": "Code Review", "prompt": "You are a senior software engineer with 10 years of experience...", "explanation": "The role focuses the response on code quality and best practices"}]',
ARRAY['technical-tasks', 'professional-communication', 'domain-expertise'],
ARRAY['few-shot-learning', 'constraints'],
3),

('Output Formatting', 'output-formatting', 'Specify exact structure and format for consistent outputs',
'## What is Output Formatting?

Output Formatting involves explicitly defining the structure, format, and organization of the AI''s response. This ensures consistency and makes outputs easier to parse programmatically.

## Why It Works

Clear format specifications:
- Eliminate ambiguity in structure
- Enable reliable parsing
- Ensure consistent outputs
- Make responses more usable

## How to Use It

### JSON Format
```
Analyze this product review and return JSON:

{
  "sentiment": "positive|negative|neutral",
  "score": 0.0-1.0,
  "key_points": ["point1", "point2"],
  "recommended_action": "string"
}

Review: [review text]
```

### Markdown Format
```
Create a summary using this structure:

## Overview
[2-3 sentence summary]

## Key Points
- Point 1
- Point 2
- Point 3

## Recommendations
1. First recommendation
2. Second recommendation

## Next Steps
[Action items]
```

### Table Format
```
Compare these options in a table:

| Feature | Option A | Option B | Option C |
|---------|----------|----------|----------|
| Price   |          |          |          |
| Speed   |          |          |          |
| Quality |          |          |          |
```

## Format Options
- JSON (for parsing)
- Markdown (for readability)
- XML (for structured data)
- CSV (for spreadsheets)
- Plain text with delimiters',
'formatting', 'beginner',
ARRAY['json', 'markdown', 'structure', 'parsing'],
'[{"name": "API Response", "prompt": "Return data as JSON with specific schema", "explanation": "Ensures parseable, consistent output"}]',
ARRAY['data-extraction', 'api-integration', 'automation'],
ARRAY['few-shot-learning', 'constraints'],
4),

('Constraints Definition', 'constraints-definition', 'Set boundaries and rules for more controlled outputs',
'## What are Constraints?

Constraints are explicit rules and boundaries that limit what the AI can or cannot do in its response. They help control output quality, length, content, and behavior.

## Why It Works

Constraints:
- Prevent unwanted content
- Control response length
- Ensure accuracy
- Maintain focus
- Meet specific requirements

## How to Use It

### Basic Constraints
```
Write a product description.

Constraints:
- Maximum 100 words
- No superlatives (best, greatest, etc.)
- Include exactly 3 key features
- End with a call-to-action
- Use present tense only
```

### Detailed Constraints
```
Generate marketing copy with these rules:

DO:
✓ Use active voice
✓ Include statistics if available
✓ Address the reader directly (you/your)
✓ Keep sentences under 20 words

DO NOT:
✗ Make unverifiable claims
✗ Use industry jargon
✗ Include competitor mentions
✗ Use exclamation marks

MUST INCLUDE:
- Product name (exactly as written)
- Price point
- Key differentiator
```

## Common Constraint Types
1. **Length**: Word/character limits
2. **Format**: Structure requirements
3. **Content**: What to include/exclude
4. **Style**: Tone and voice
5. **Factual**: Accuracy requirements
6. **Ethical**: Content restrictions',
'control', 'intermediate',
ARRAY['rules', 'boundaries', 'control', 'quality'],
'[{"name": "Content Generation", "prompt": "Write with specific length and style constraints", "explanation": "Ensures output meets exact requirements"}]',
ARRAY['content-generation', 'quality-control', 'compliance'],
ARRAY['output-formatting', 'role-assignment'],
5),

('Self-Consistency', 'self-consistency', 'Generate multiple responses and find consensus for reliability',
'## What is Self-Consistency?

Self-Consistency involves asking the AI to generate multiple independent solutions to the same problem, then comparing them to find the most reliable answer through consensus.

## Why It Works

Multiple attempts:
- Reduce random errors
- Identify stable patterns
- Increase confidence in answers
- Reveal edge cases

## How to Use It

### Basic Pattern
```
Solve this problem 3 different ways, then tell me which answer appears most often:

Problem: [Your problem]

Solution 1:
[Work through it]

Solution 2:
[Different approach]

Solution 3:
[Another method]

Most consistent answer:
```

### Verification Pattern
```
Answer this question, then verify your answer:

Question: [Your question]

Initial Answer: [First response]

Verification:
- Does this make logical sense?
- Are there any errors in reasoning?
- Would a different approach give the same result?

Final Verified Answer:
```

## Implementation Tips
1. Use temperature > 0 for variation
2. Ask for different approaches
3. Request explicit reasoning
4. Compare final answers
5. Look for majority consensus',
'reliability', 'advanced',
ARRAY['verification', 'accuracy', 'consensus', 'reliability'],
'[{"name": "Math Verification", "prompt": "Solve three ways and compare answers", "explanation": "Catches errors through multiple attempts"}]',
ARRAY['math', 'logic', 'critical-decisions'],
ARRAY['chain-of-thought', 'tree-of-thoughts'],
6),

('Tree of Thoughts', 'tree-of-thoughts', 'Explore multiple reasoning paths and evaluate each branch',
'## What is Tree of Thoughts?

Tree of Thoughts (ToT) extends Chain of Thought by exploring multiple reasoning paths simultaneously, evaluating each branch, and potentially backtracking when a path seems unproductive.

## Why It Works

Branching exploration:
- Considers multiple approaches
- Enables backtracking from dead ends
- Evaluates path quality
- Finds optimal solutions

## How to Use It

### Basic Pattern
```
Solve this problem using Tree of Thoughts:

Problem: [Your problem]

Step 1: Generate 3 possible first steps
- Option A: [approach]
- Option B: [approach]
- Option C: [approach]

Evaluate each option (rate 1-10 for promise):

Step 2: Expand the most promising path(s)
[Continue developing best options]

Step 3: If stuck, backtrack and try another branch

Final Solution: [Best path to solution]
```

### Structured ToT
```
PROBLEM: [Complex problem]

EXPLORATION:
├── Path 1: [Initial approach]
│   ├── Promising? [Yes/No + reason]
│   └── Next step: [If yes, continue]
├── Path 2: [Alternative approach]
│   ├── Promising? [Yes/No + reason]
│   └── Next step: [If yes, continue]
└── Path 3: [Another alternative]
    ├── Promising? [Yes/No + reason]
    └── Next step: [If yes, continue]

EVALUATION:
- Best path: [Which and why]
- Dead ends: [What didn''t work]

SOLUTION: [Final answer from best path]
```',
'reasoning', 'advanced',
ARRAY['exploration', 'branching', 'evaluation', 'complex-problems'],
'[{"name": "Strategy Planning", "prompt": "Explore multiple strategic options with evaluation", "explanation": "Finds optimal path through complex decision space"}]',
ARRAY['strategy', 'complex-problems', 'optimization'],
ARRAY['chain-of-thought', 'self-consistency'],
7),

('ReAct Pattern', 'react-pattern', 'Combine reasoning and action in an iterative loop',
'## What is ReAct?

ReAct (Reasoning + Acting) combines chain-of-thought reasoning with action-taking in an interleaved manner. The model reasons about what to do, takes an action, observes the result, and continues.

## Why It Works

The ReAct loop:
- Grounds reasoning in observations
- Enables dynamic adaptation
- Supports tool use
- Maintains context

## How to Use It

### Basic Pattern
```
Use the ReAct framework to solve this:

Task: [Your task]

Thought 1: [Reasoning about first step]
Action 1: [What action to take]
Observation 1: [Result of action]

Thought 2: [Reasoning based on observation]
Action 2: [Next action]
Observation 2: [Result]

... continue until solved ...

Final Answer: [Solution]
```

### With Tool Use
```
Available Tools:
- search(query): Search the web
- calculate(expression): Do math
- lookup(term): Find definition

Task: [Your task]

Thought: I need to find information about X
Action: search("X statistics 2024")
Observation: [Search results]

Thought: Now I need to calculate...
Action: calculate("100 * 0.15")
Observation: 15

Thought: Based on the search and calculation...
Final Answer: [Conclusion]
```

## When to Use
- Tasks requiring external information
- Multi-step processes
- Tool-augmented workflows
- Dynamic problem-solving',
'agents', 'advanced',
ARRAY['reasoning', 'actions', 'tools', 'agents'],
'[{"name": "Research Task", "prompt": "Use ReAct to research and synthesize information", "explanation": "Combines thinking with information gathering"}]',
ARRAY['research', 'tool-use', 'complex-tasks'],
ARRAY['chain-of-thought', 'function-calling'],
8),

('Prompt Chaining', 'prompt-chaining', 'Break complex tasks into sequential prompts that build on each other',
'## What is Prompt Chaining?

Prompt Chaining involves breaking a complex task into multiple simpler prompts, where each prompt''s output becomes input for the next. This creates a pipeline of focused, manageable steps.

## Why It Works

Chaining prompts:
- Manages complexity
- Improves reliability
- Enables specialization
- Allows checkpoints

## How to Use It

### Basic Chain
```
Chain Step 1 - Extract:
"Extract all company names from this text: [text]"
→ Output: [list of companies]

Chain Step 2 - Research:
"For each company, find their industry: [list from step 1]"
→ Output: [companies with industries]

Chain Step 3 - Analyze:
"Group these companies by industry and identify trends: [data from step 2]"
→ Output: [Final analysis]
```

### Chain Architecture
```
[Input] 
    → [Prompt 1: Parse/Extract]
    → [Prompt 2: Transform/Enrich]  
    → [Prompt 3: Analyze/Synthesize]
    → [Prompt 4: Format/Present]
→ [Final Output]
```

## Best Practices
1. Keep each step focused
2. Validate between steps
3. Handle errors gracefully
4. Design for reusability
5. Consider parallel chains

## Common Chain Patterns
- Extract → Transform → Load
- Generate → Evaluate → Refine
- Summarize → Analyze → Recommend
- Parse → Validate → Process',
'workflow', 'intermediate',
ARRAY['chaining', 'pipeline', 'workflow', 'complex-tasks'],
'[{"name": "Document Processing", "prompt": "Chain: Extract → Summarize → Translate", "explanation": "Each step handles one aspect of the task"}]',
ARRAY['document-processing', 'data-pipelines', 'automation'],
ARRAY['react-pattern', 'output-formatting'],
9),

('Zero-Shot Prompting', 'zero-shot-prompting', 'Get results without examples by relying on clear instructions',
'## What is Zero-Shot Prompting?

Zero-Shot Prompting asks the AI to perform a task without providing any examples. You rely entirely on clear instructions and the model''s pre-trained knowledge.

## Why It Works

Zero-shot is effective when:
- Task is well-understood
- Model has relevant training
- Instructions are unambiguous
- Speed is important

## How to Use It

### Basic Pattern
```
Classify the following text as positive, negative, or neutral:

Text: [Your text]
Classification:
```

### Enhanced Zero-Shot
```
Task: Classify sentiment
Options: positive, negative, neutral
Instructions: Consider the overall tone and word choice

Text: [Your text]

Sentiment:
Confidence:
Key indicators:
```

## When to Use Zero-Shot
✓ Simple, well-defined tasks
✓ When examples aren''t available
✓ Quick prototyping
✓ General knowledge tasks

## When to Use Few-Shot Instead
✗ Complex or nuanced tasks
✗ Specific formatting needed
✗ Domain-specific work
✗ Ambiguous instructions

## Improving Zero-Shot
1. Be extremely specific
2. Define all terms
3. Specify output format
4. Add constraints
5. Break into smaller tasks',
'learning', 'beginner',
ARRAY['no-examples', 'instructions', 'simple-tasks'],
'[{"name": "Simple Classification", "prompt": "Classify this without examples, just clear instructions", "explanation": "Works for well-defined, common tasks"}]',
ARRAY['classification', 'simple-tasks', 'prototyping'],
ARRAY['few-shot-learning', 'constraints-definition'],
10),

('Retrieval Augmented Generation', 'rag', 'Enhance responses with retrieved external knowledge',
'## What is RAG?

Retrieval Augmented Generation (RAG) combines the AI''s capabilities with external knowledge retrieval. You provide relevant context documents that the AI uses to generate more accurate, up-to-date responses.

## Why It Works

RAG provides:
- Access to current information
- Domain-specific knowledge
- Verifiable sources
- Reduced hallucination

## How to Use It

### Basic Pattern
```
Use the following context to answer the question. Only use information from the provided context.

CONTEXT:
---
[Retrieved document 1]
---
[Retrieved document 2]
---
[Retrieved document 3]
---

QUESTION: [User''s question]

INSTRUCTIONS:
- Answer based only on the context
- Quote relevant passages
- Say "I don''t have enough information" if context doesn''t contain the answer
- Cite which document(s) you used

ANSWER:
```

### With Source Attribution
```
Context Documents:
[Doc 1 - Title]: [Content]
[Doc 2 - Title]: [Content]

Question: [Question]

Answer using this format:
- Main answer
- Sources: [List doc titles used]
- Confidence: High/Medium/Low
- Gaps: [What context didn''t cover]
```

## Best Practices
1. Retrieve relevant chunks
2. Include source metadata
3. Limit context size
4. Instruct on handling gaps
5. Request citations',
'knowledge', 'advanced',
ARRAY['retrieval', 'context', 'knowledge-base', 'grounding'],
'[{"name": "Documentation QA", "prompt": "Answer questions using retrieved documentation", "explanation": "Grounds responses in actual source material"}]',
ARRAY['question-answering', 'knowledge-bases', 'documentation'],
ARRAY['prompt-chaining', 'constraints-definition'],
11),

('Meta Prompting', 'meta-prompting', 'Use AI to help write and improve prompts',
'## What is Meta Prompting?

Meta Prompting involves using the AI to help create, analyze, or improve prompts. You''re essentially prompting about prompting—leveraging the model''s understanding of what makes prompts effective.

## Why It Works

The AI can:
- Identify prompt weaknesses
- Suggest improvements
- Generate variations
- Optimize for specific goals

## How to Use It

### Prompt Generation
```
I need a prompt for the following task. Create an effective prompt that includes role, context, instructions, and output format.

Task: [Describe what you want to accomplish]
Target Model: [GPT-4, Claude, etc.]
Key Requirements: [Any specific needs]

Generate a complete, ready-to-use prompt:
```

### Prompt Improvement
```
Analyze this prompt and suggest improvements:

CURRENT PROMPT:
[Your existing prompt]

ISSUES I''M SEEING:
[Optional: describe problems]

Provide:
1. Strengths of current prompt
2. Weaknesses identified
3. Specific improvements
4. Rewritten improved version
```

### Prompt Evaluation
```
Rate this prompt on a scale of 1-10 for:
- Clarity
- Specificity
- Completeness
- Likely effectiveness

PROMPT:
[Prompt to evaluate]

Provide ratings with explanations and improvement suggestions.
```

## Meta Prompting Uses
- Generating prompt templates
- A/B test variant creation
- Debugging poor results
- Adapting prompts for different models',
'optimization', 'intermediate',
ARRAY['meta', 'prompt-engineering', 'optimization', 'improvement'],
'[{"name": "Prompt Optimizer", "prompt": "Analyze and improve an existing prompt", "explanation": "Uses AI to make prompts more effective"}]',
ARRAY['prompt-improvement', 'optimization', 'debugging'],
ARRAY['few-shot-learning', 'self-consistency'],
12);