import { PromptConfig, DeploymentConfig } from '@/types';
import { DeploymentFiles } from './index';

function escapeString(str: string): string {
  return str.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$/g, '\\$');
}

function generateRateLimitMiddleware(config: DeploymentConfig): string {
  if (!config.rateLimit?.enabled) return '';

  return `
// Rate limiting using in-memory store (for production, use Vercel KV or Redis)
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(clientId: string): { allowed: boolean; retryAfter?: number } {
  const now = Date.now();
  const windowMs = 60000; // 1 minute
  const maxRequests = ${config.rateLimit.requestsPerMinute};

  const record = rateLimitStore.get(clientId);

  if (!record || now > record.resetAt) {
    rateLimitStore.set(clientId, { count: 1, resetAt: now + windowMs });
    return { allowed: true };
  }

  if (record.count >= maxRequests) {
    return { allowed: false, retryAfter: Math.ceil((record.resetAt - now) / 1000) };
  }

  record.count++;
  return { allowed: true };
}
`;
}

function generateWebhookCode(config: DeploymentConfig): string {
  if (!config.webhook?.enabled) return '';

  return `
async function sendWebhook(event: string, data: Record<string, unknown>): Promise<void> {
  const webhookUrl = process.env.WEBHOOK_URL || '${config.webhook.url}';
  const webhookSecret = process.env.WEBHOOK_SECRET || '';

  if (!webhookUrl) return;

  try {
    const payload = JSON.stringify({
      event,
      timestamp: new Date().toISOString(),
      data,
    });

    const signature = await crypto.subtle.sign(
      'HMAC',
      await crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(webhookSecret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      ),
      new TextEncoder().encode(payload)
    );

    await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Signature': btoa(String.fromCharCode(...new Uint8Array(signature))),
      },
      body: payload,
    });
  } catch (error) {
    console.error('Webhook error:', error);
  }
}
`;
}

export function generateVercelDeployment(
  promptConfig: PromptConfig,
  deploymentConfig: DeploymentConfig
): DeploymentFiles {
  const promptTemplate = escapeString(promptConfig.prompt);

  const handlerCode = `import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';
export const preferredRegion = '${deploymentConfig.region}';

${generateRateLimitMiddleware(deploymentConfig)}
${generateWebhookCode(deploymentConfig)}

// Prompt configuration
const PROMPT_TEMPLATE = \`${promptTemplate}\`;
const DEFAULT_MODEL = '${promptConfig.model}';
const DEFAULT_CONFIG = {
  temperature: ${promptConfig.temperature},
  max_tokens: ${promptConfig.maxTokens},
  top_p: ${promptConfig.topP},
  frequency_penalty: ${promptConfig.frequencyPenalty},
  presence_penalty: ${promptConfig.presencePenalty},
};

function buildPrompt(variables: Record<string, unknown>): string {
  let prompt = PROMPT_TEMPLATE;
  for (const [key, value] of Object.entries(variables)) {
    prompt = prompt.replace(new RegExp(\`{{\\\\s*\${key}\\\\s*}}\`, 'g'), String(value));
  }
  return prompt;
}

${deploymentConfig.apiKey?.enabled ? `
function validateApiKey(request: NextRequest): boolean {
  const apiKey = request.headers.get('x-api-key') || request.headers.get('authorization')?.replace('Bearer ', '');
  const validKeys = (process.env.API_KEYS || '').split(',').filter(Boolean);
  return validKeys.length === 0 || validKeys.includes(apiKey || '');
}
` : ''}

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    ${deploymentConfig.apiKey?.enabled ? `
    // Validate API key
    if (!validateApiKey(request)) {
      return NextResponse.json(
        { error: 'Invalid or missing API key' },
        { status: 401 }
      );
    }
    ` : ''}

    ${deploymentConfig.rateLimit?.enabled ? `
    // Check rate limit
    const clientId = request.headers.get('x-forwarded-for') ||
                     request.headers.get('x-real-ip') ||
                     'anonymous';
    const { allowed, retryAfter } = checkRateLimit(clientId);

    if (!allowed) {
      ${deploymentConfig.webhook?.enabled ? `await sendWebhook('rate_limit.exceeded', { clientId });` : ''}
      return NextResponse.json(
        { error: 'Rate limit exceeded' },
        {
          status: 429,
          headers: { 'Retry-After': String(retryAfter) }
        }
      );
    }
    ` : ''}

    const body = await request.json();
    const { variables = {}, options = {} } = body;

    ${deploymentConfig.webhook?.enabled ? `await sendWebhook('request.started', { variables });` : ''}

    const prompt = buildPrompt(variables);

    const payload = {
      model: options.model || DEFAULT_MODEL,
      messages: [{ role: 'user', content: prompt }],
      ...DEFAULT_CONFIG,
      ...options,
    };

    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': \`Bearer \${process.env.OPENAI_API_KEY}\`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!openaiResponse.ok) {
      const error = await openaiResponse.json();
      ${deploymentConfig.webhook?.enabled ? `await sendWebhook('request.failed', { error });` : ''}
      return NextResponse.json(
        { error: error.error?.message || 'OpenAI API error' },
        { status: openaiResponse.status }
      );
    }

    const data = await openaiResponse.json();
    const latencyMs = Date.now() - startTime;

    const response = {
      content: data.choices?.[0]?.message?.content || '',
      model: data.model,
      usage: {
        promptTokens: data.usage?.prompt_tokens || 0,
        completionTokens: data.usage?.completion_tokens || 0,
        totalTokens: data.usage?.total_tokens || 0,
      },
      finishReason: data.choices?.[0]?.finish_reason || '',
      latencyMs,
    };

    ${deploymentConfig.webhook?.enabled ? `await sendWebhook('request.completed', { latencyMs, usage: response.usage });` : ''}

    return NextResponse.json(response);
  } catch (error) {
    ${deploymentConfig.webhook?.enabled ? `await sendWebhook('error.occurred', { error: String(error) });` : ''}
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    name: '${promptConfig.name}',
    description: '${promptConfig.description || ''}',
    model: DEFAULT_MODEL,
    variables: ${JSON.stringify(promptConfig.variables.map(v => ({ name: v.name, type: v.type, required: v.required, description: v.description })), null, 2)},
  });
}
`;

  const vercelConfig = `{
  "version": 2,
  "name": "${deploymentConfig.name}",
  "regions": ["${deploymentConfig.region}"],
  "env": {
    "OPENAI_API_KEY": "@openai_api_key"
    ${deploymentConfig.webhook?.enabled ? `,"WEBHOOK_URL": "@webhook_url"` : ''}
    ${deploymentConfig.webhook?.enabled ? `,"WEBHOOK_SECRET": "@webhook_secret"` : ''}
    ${deploymentConfig.apiKey?.enabled ? `,"API_KEYS": "@api_keys"` : ''}
  },
  "headers": [
    {
      "source": "/api/(.*)",
      "headers": [
        { "key": "Access-Control-Allow-Origin", "value": "*" },
        { "key": "Access-Control-Allow-Methods", "value": "GET, POST, OPTIONS" },
        { "key": "Access-Control-Allow-Headers", "value": "Content-Type, Authorization, X-API-Key" }
      ]
    }
  ]
}`;

  const packageJson = `{
  "name": "${deploymentConfig.name}",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start"
  },
  "dependencies": {
    "next": "^14.0.0"
  }
}`;

  const readme = `# ${promptConfig.name} - Vercel Edge Function

This API endpoint is deployed on Vercel's Edge Network for ultra-low latency responses.

## Deployment

1. Install Vercel CLI:
   \`\`\`bash
   npm i -g vercel
   \`\`\`

2. Set up environment variables:
   \`\`\`bash
   vercel secrets add openai_api_key "your-openai-api-key"
   ${deploymentConfig.webhook?.enabled ? 'vercel secrets add webhook_url "your-webhook-url"\nvercel secrets add webhook_secret "your-webhook-secret"' : ''}
   ${deploymentConfig.apiKey?.enabled ? 'vercel secrets add api_keys "key1,key2,key3"' : ''}
   \`\`\`

3. Deploy:
   \`\`\`bash
   vercel --prod
   \`\`\`

## Usage

### Execute Prompt

\`\`\`bash
curl -X POST https://your-deployment.vercel.app/api/prompt \\
  -H "Content-Type: application/json" \\
  ${deploymentConfig.apiKey?.enabled ? '-H "X-API-Key: your-api-key" \\' : ''}
  -d '{
    "variables": {
${promptConfig.variables.map(v => `      "${v.name}": "value"`).join(',\n')}
    }
  }'
\`\`\`

### Get Prompt Info

\`\`\`bash
curl https://your-deployment.vercel.app/api/prompt
\`\`\`

## Features

- ✅ Edge Runtime for low latency
- ✅ Automatic HTTPS
${deploymentConfig.rateLimit?.enabled ? '- ✅ Rate limiting' : ''}
${deploymentConfig.webhook?.enabled ? '- ✅ Webhook notifications' : ''}
${deploymentConfig.apiKey?.enabled ? '- ✅ API key authentication' : ''}
`;

  return {
    files: {
      'app/api/prompt/route.ts': handlerCode,
      'vercel.json': vercelConfig,
      'package.json': packageJson,
    },
    readme,
    deployCommand: 'vercel --prod',
  };
}
