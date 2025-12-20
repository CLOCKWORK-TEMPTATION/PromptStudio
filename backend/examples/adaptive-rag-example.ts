/**
 * Adaptive RAG System - Usage Example
 * مثال توضيحي لاستخدام نظام RAG التكيفي
 */

import { adaptiveRAGService } from '../src/services/AdaptiveRAGService';
import { RAGService } from '../src/services/RAGService';

/**
 * Example 1: Complete Adaptive RAG Workflow
 * مثال 1: سير عمل كامل للـ RAG التكيفي
 */
async function completeAdaptiveRAGWorkflow() {
  console.log('=== Complete Adaptive RAG Workflow ===\n');

  // Step 1: Create a knowledge base
  console.log('Step 1: Creating knowledge base...');
  const knowledgeBase = await RAGService.createKnowledgeBase({
    name: 'AI Research Papers',
    description: 'Collection of AI and ML research papers',
    domain: 'artificial-intelligence',
    embeddingModel: 'text-embedding-3-small',
    chunkSize: 1000,
    chunkOverlap: 200,
  });
  console.log(`✓ Knowledge base created: ${knowledgeBase.id}\n`);

  // Step 2: Register trusted sources
  console.log('Step 2: Registering trusted sources...');
  await adaptiveRAGService.registerTrustedSource({
    name: 'ArXiv Papers',
    domain: 'arxiv.org',
    url: 'https://arxiv.org',
    sourceType: 'repository',
    baseTrustScore: 0.95,
    autoVerify: true,
  });

  await adaptiveRAGService.registerTrustedSource({
    name: 'Research Gate',
    domain: 'researchgate.net',
    baseTrustScore: 0.85,
    autoVerify: false,
  });
  console.log('✓ Trusted sources registered\n');

  // Step 3: Add documents to knowledge base
  console.log('Step 3: Adding documents...');
  const documents = [
    {
      title: 'Introduction to Neural Networks',
      content: `Neural networks are computing systems inspired by biological neural networks.
        They consist of interconnected nodes (neurons) organized in layers.
        The input layer receives data, hidden layers process it, and the output layer produces results.
        Training involves adjusting weights through backpropagation to minimize error.
        Common applications include image recognition, natural language processing, and prediction tasks.`,
      source: 'arxiv.org/nn-intro-2024',
      trustScore: 0.95,
      metadata: {
        author: 'Dr. Jane Smith',
        year: 2024,
        citations: 150,
        url: 'https://arxiv.org/abs/2024.12345',
      },
    },
    {
      title: 'Deep Learning Fundamentals',
      content: `Deep learning is a subset of machine learning using multi-layered neural networks.
        Key architectures include CNNs for images, RNNs for sequences, and Transformers for language.
        Deep learning excels at learning hierarchical representations from raw data.
        Requires large datasets and computational resources for training.
        Has revolutionized AI applications in recent years.`,
      source: 'arxiv.org/dl-fundamentals',
      trustScore: 0.92,
      metadata: {
        author: 'Prof. John Doe',
        year: 2024,
        citations: 320,
      },
    },
    {
      title: 'Machine Learning Basics',
      content: `Machine learning enables computers to learn from data without explicit programming.
        Three main types: supervised, unsupervised, and reinforcement learning.
        Supervised learning uses labeled data to train models.
        Unsupervised learning finds patterns in unlabeled data.
        Reinforcement learning learns through trial and error with rewards.`,
      source: 'researchgate.net/ml-basics',
      trustScore: 0.80,
      metadata: {
        author: 'Alice Johnson',
        year: 2023,
      },
    },
  ];

  await RAGService.addToKnowledgeBase(knowledgeBase.id, documents);
  console.log(`✓ ${documents.length} documents added\n`);

  // Step 4: Build context mask
  console.log('Step 4: Building context mask...');
  const contextMask = await adaptiveRAGService.buildContextMask(
    knowledgeBase.id,
    {
      trustThreshold: 0.7,
      verifiedOnly: false,
      allowedDomains: ['arxiv.org', 'researchgate.net'],
      blockedDomains: [],
    }
  );
  console.log('✓ Context mask built:');
  console.log(`  - Allowed sources: ${contextMask.allowedSources.join(', ')}`);
  console.log(`  - Trust threshold: ${contextMask.trustThreshold}\n`);

  // Step 5: Retrieve adaptive context
  console.log('Step 5: Retrieving adaptive context...');
  const query = 'Explain how neural networks work and their applications';

  const result = await adaptiveRAGService.retrieveAdaptiveContext(
    knowledgeBase.id,
    query,
    {
      maxChunks: 3,
      minRelevance: 0.6,
      minTrust: 0.7,
      enableSummarization: true,
      maxContextLength: 4000,
      includeSourceTrace: true,
    }
  );

  console.log('✓ Adaptive context retrieved:');
  console.log(`  - Session ID: ${result.sessionId}`);
  console.log(`  - Query: ${result.query}`);
  console.log(`  - Total chunks: ${result.contextStats.totalChunks}`);
  console.log(`  - Avg relevance: ${(result.contextStats.avgRelevance * 100).toFixed(1)}%`);
  console.log(`  - Avg trust: ${(result.contextStats.avgTrust * 100).toFixed(1)}%`);
  console.log(`  - Avg confidence: ${(result.contextStats.avgConfidence * 100).toFixed(1)}%`);
  console.log(`  - Total tokens: ${result.contextStats.totalTokens}\n`);

  // Step 6: Display enriched chunks
  console.log('Step 6: Enriched chunks with summaries:');
  result.enrichedChunks.forEach((chunk, index) => {
    console.log(`\n  Chunk ${index + 1}:`);
    console.log(`    - Source: ${chunk.sourceTitle}`);
    console.log(`    - Relevance: ${(chunk.relevanceScore * 100).toFixed(1)}%`);
    console.log(`    - Trust: ${(chunk.trustScore * 100).toFixed(1)}%`);
    console.log(`    - Confidence: ${(chunk.confidenceScore * 100).toFixed(1)}%`);
    console.log(`    - Verified: ${chunk.isVerified ? '✓' : '✗'}`);
    if (chunk.summary) {
      console.log(`    - Summary: ${chunk.summary.slice(0, 100)}...`);
    }
  });

  // Step 7: Display source traces
  console.log('\n\nStep 7: Source traces:');
  result.sourceTraces.forEach((trace, index) => {
    console.log(`\n  Trace ${index + 1}:`);
    console.log(`    - Position: ${trace.position}`);
    console.log(`    - Source: ${trace.sourceTitle}`);
    console.log(`    - Document: ${trace.sourceDocument}`);
    console.log(`    - Attribution: ${trace.attribution}`);
  });

  // Step 8: Display final prompt
  console.log('\n\nStep 8: Final RAG-enhanced prompt:');
  console.log('─'.repeat(80));
  console.log(result.finalPrompt.slice(0, 500) + '...');
  console.log('─'.repeat(80));

  return result;
}

/**
 * Example 2: Summarization Only
 * مثال 2: التلخيص فقط
 */
async function summarizationExample() {
  console.log('\n\n=== Summarization Example ===\n');

  const chunks = [
    {
      id: 'chunk-1',
      content: `Artificial Intelligence (AI) is transforming various industries including healthcare,
        finance, transportation, and entertainment. In healthcare, AI helps diagnose diseases,
        predict patient outcomes, and personalize treatment plans. Financial institutions use
        AI for fraud detection, risk assessment, and algorithmic trading. Self-driving cars
        rely on AI for navigation and decision-making. Entertainment platforms use AI for
        content recommendation and personalization.`,
      source: 'ai-applications.pdf',
      title: 'AI Applications Across Industries',
      relevanceScore: 0.92,
      trustScore: 0.88,
      isVerified: true,
      metadata: { year: 2024 },
    },
    {
      id: 'chunk-2',
      content: `Machine learning algorithms can be categorized into supervised, unsupervised, and
        reinforcement learning. Supervised learning uses labeled training data to learn mappings
        from inputs to outputs. Unsupervised learning discovers patterns in unlabeled data through
        clustering and dimensionality reduction. Reinforcement learning agents learn optimal
        behaviors through trial and error, receiving rewards for good actions.`,
      source: 'ml-algorithms.pdf',
      title: 'Machine Learning Algorithm Types',
      relevanceScore: 0.85,
      trustScore: 0.90,
      isVerified: true,
      metadata: { year: 2024 },
    },
  ];

  const query = 'What are the types of machine learning?';

  console.log(`Query: ${query}\n`);
  console.log('Summarizing chunks...\n');

  const enrichedChunks = await adaptiveRAGService.summarizeChunks(chunks, query);

  enrichedChunks.forEach((chunk, index) => {
    console.log(`Chunk ${index + 1}:`);
    console.log(`  Title: ${chunk.sourceTitle}`);
    console.log(`  Original length: ${chunk.content.length} chars`);
    console.log(`  Summary length: ${chunk.summary?.length || 0} chars`);
    console.log(`  Confidence: ${(chunk.confidenceScore * 100).toFixed(1)}%`);
    console.log(`  Summary: ${chunk.summary}\n`);
  });
}

/**
 * Example 3: Context Mask and Filtering
 * مثال 3: ماسك السياق والفلترة
 */
async function contextMaskExample() {
  console.log('\n\n=== Context Mask Example ===\n');

  // This would require a knowledge base ID
  const knowledgeBaseId = 'example-kb-id';

  // Example 1: Only high-trust sources
  console.log('Scenario 1: Only high-trust sources (>= 0.8)');
  const highTrustMask = await adaptiveRAGService.buildContextMask(
    knowledgeBaseId,
    {
      trustThreshold: 0.8,
      verifiedOnly: false,
    }
  );
  console.log(`  Allowed sources: ${highTrustMask.allowedSources.length}`);
  console.log(`  Trust threshold: ${highTrustMask.trustThreshold}\n`);

  // Example 2: Only verified sources
  console.log('Scenario 2: Only verified sources');
  const verifiedOnlyMask = await adaptiveRAGService.buildContextMask(
    knowledgeBaseId,
    {
      verifiedOnly: true,
    }
  );
  console.log(`  Verified only: ${verifiedOnlyMask.verifiedOnly}\n`);

  // Example 3: Specific domains only
  console.log('Scenario 3: Only academic sources');
  const academicMask = await adaptiveRAGService.buildContextMask(
    knowledgeBaseId,
    {
      allowedDomains: ['arxiv.org', 'ieee.org', 'acm.org'],
      blockedDomains: ['wikipedia.org'],
    }
  );
  console.log(`  Allowed domains: ${academicMask.allowedSources.join(', ')}`);
  console.log(`  Blocked domains: ${academicMask.blockedSources.join(', ')}\n`);
}

/**
 * Example 4: Session History
 * مثال 4: سجل الجلسات
 */
async function sessionHistoryExample(sessionId: string) {
  console.log('\n\n=== Session History Example ===\n');

  const session = await adaptiveRAGService.getSessionHistory(sessionId);

  if (!session) {
    console.log('Session not found');
    return;
  }

  console.log(`Session ID: ${session.id}`);
  console.log(`Query: ${session.query}`);
  console.log(`Created: ${session.createdAt}`);
  console.log(`Total chunks: ${session.totalChunks}`);
  console.log(`Avg relevance: ${((session.avgRelevance || 0) * 100).toFixed(1)}%`);
  console.log(`Avg trust: ${((session.avgTrust || 0) * 100).toFixed(1)}%\n`);

  console.log('Summaries:');
  session.summaries?.forEach((summary, index) => {
    console.log(`\n  ${index + 1}. ${summary.document.title}`);
    console.log(`     Position: ${summary.position}`);
    console.log(`     Relevance: ${(summary.relevanceScore * 100).toFixed(1)}%`);
    console.log(`     Trust: ${(summary.trustScore * 100).toFixed(1)}%`);
    console.log(`     Confidence: ${(summary.confidenceScore * 100).toFixed(1)}%`);
    console.log(`     Compression: ${summary.compressionRatio.toFixed(2)}x`);
  });

  console.log('\n\nSource Traces:');
  session.traces?.forEach((trace, index) => {
    console.log(`\n  ${index + 1}. ${trace.sourceTitle}`);
    console.log(`     Injected at: ${trace.injectedAt}`);
    console.log(`     Chunk size: ${trace.chunkSize} chars`);
    console.log(`     Citation: ${trace.citationFormat}`);
  });
}

/**
 * Main execution
 */
async function main() {
  try {
    // Run complete workflow
    const result = await completeAdaptiveRAGWorkflow();

    // Run summarization example
    await summarizationExample();

    // Run context mask example (would need real knowledge base)
    // await contextMaskExample();

    // View session history
    await sessionHistoryExample(result.sessionId);

    console.log('\n\n✓ All examples completed successfully!');
  } catch (error) {
    console.error('Error running examples:', error);
  }
}

// Uncomment to run:
// main();

export {
  completeAdaptiveRAGWorkflow,
  summarizationExample,
  contextMaskExample,
  sessionHistoryExample,
};
