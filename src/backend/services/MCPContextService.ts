import crypto from 'crypto';
import prisma from '../lib/prisma.js';
import { EmbeddingUtil } from './embedding-util.js';

/**
 * Model Context Protocol (MCP) Service
 * خدمة بروتوكول سياق النموذج لتقليل تكلفة السياق في المحادثات المتشعبة
 */

/**
 * ملخص السياق
 */
export interface ContextSummary {
  id: string;
  originalLength: number;
  compressedLength: number;
  compressionRatio: number;
  content: string;
  keyPoints: string[];
  entities: string[];
  createdAt: Date;
}

/**
 * نافذة السياق
 */
export interface ContextWindow {
  id: string;
  sessionId: string;
  messages: ContextMessage[];
  totalTokens: number;
  maxTokens: number;
  compressionLevel: CompressionLevel;
  summaries: ContextSummary[];
}

/**
 * رسالة السياق
 */
export interface ContextMessage {
  id: string;
  role: 'system' | 'user' | 'assistant';
  content: string;
  tokenCount: number;
  importance: number;
  timestamp: Date;
  compressed: boolean;
  originalContent?: string;
}

/**
 * مستوى الضغط
 */
export enum CompressionLevel {
  NONE = 'none',
  LIGHT = 'light',
  MODERATE = 'moderate',
  AGGRESSIVE = 'aggressive',
}

/**
 * إستراتيجية التقليم
 */
export enum PruningStrategy {
  FIFO = 'fifo',                    // الأقدم أولاً
  LIFO = 'lifo',                    // الأحدث أولاً
  IMPORTANCE = 'importance',         // حسب الأهمية
  RELEVANCE = 'relevance',          // حسب الصلة بالسياق الحالي
  HYBRID = 'hybrid',                // مزيج من الاستراتيجيات
}

/**
 * إعدادات MCP
 */
export interface MCPConfig {
  maxTokens: number;
  compressionThreshold: number;
  compressionLevel: CompressionLevel;
  pruningStrategy: PruningStrategy;
  keepSystemMessages: boolean;
  summarizationEnabled: boolean;
  cacheEnabled: boolean;
}

/**
 * إحصائيات الضغط
 */
export interface CompressionStats {
  originalTokens: number;
  compressedTokens: number;
  tokensSaved: number;
  savingsPercentage: number;
  messagesCompressed: number;
  messagesPruned: number;
  summariesCreated: number;
}

/**
 * خدمة MCP
 */
export class MCPContextService {
  private contextWindows: Map<string, ContextWindow> = new Map();
  private summaryCache: Map<string, ContextSummary> = new Map();

  private defaultConfig: MCPConfig = {
    maxTokens: 4096,
    compressionThreshold: 0.8, // ابدأ الضغط عند 80% من الحد الأقصى
    compressionLevel: CompressionLevel.MODERATE,
    pruningStrategy: PruningStrategy.HYBRID,
    keepSystemMessages: true,
    summarizationEnabled: true,
    cacheEnabled: true,
  };

  /**
   * إنشاء نافذة سياق جديدة
   */
  async createContextWindow(
    sessionId: string,
    config: Partial<MCPConfig> = {}
  ): Promise<ContextWindow> {
    const finalConfig = { ...this.defaultConfig, ...config };

    const window: ContextWindow = {
      id: crypto.randomUUID(),
      sessionId,
      messages: [],
      totalTokens: 0,
      maxTokens: finalConfig.maxTokens,
      compressionLevel: finalConfig.compressionLevel,
      summaries: [],
    };

    this.contextWindows.set(sessionId, window);
    return window;
  }

  /**
   * إضافة رسالة للسياق
   */
  async addMessage(
    sessionId: string,
    message: {
      role: 'system' | 'user' | 'assistant';
      content: string;
      importance?: number;
    },
    config: Partial<MCPConfig> = {}
  ): Promise<{
    window: ContextWindow;
    compressionApplied: boolean;
    stats?: CompressionStats;
  }> {
    const finalConfig = { ...this.defaultConfig, ...config };
    let window = this.contextWindows.get(sessionId);

    if (!window) {
      window = await this.createContextWindow(sessionId, config);
    }

    // إنشاء الرسالة
    const tokenCount = EmbeddingUtil.estimateTokenCount(message.content);
    const newMessage: ContextMessage = {
      id: crypto.randomUUID(),
      role: message.role,
      content: message.content,
      tokenCount,
      importance: message.importance ?? this.calculateImportance(message),
      timestamp: new Date(),
      compressed: false,
    };

    // إضافة الرسالة
    window.messages.push(newMessage);
    window.totalTokens += tokenCount;

    // التحقق من الحاجة للضغط
    let compressionApplied = false;
    let stats: CompressionStats | undefined;

    if (window.totalTokens > window.maxTokens * finalConfig.compressionThreshold) {
      const result = await this.compressContext(sessionId, finalConfig);
      compressionApplied = true;
      stats = result.stats;
      window = result.window;
    }

    return { window, compressionApplied, stats };
  }

  /**
   * ضغط السياق
   */
  async compressContext(
    sessionId: string,
    config: Partial<MCPConfig> = {}
  ): Promise<{
    window: ContextWindow;
    stats: CompressionStats;
  }> {
    const finalConfig = { ...this.defaultConfig, ...config };
    const window = this.contextWindows.get(sessionId);

    if (!window) {
      throw new Error('Context window not found');
    }

    const originalTokens = window.totalTokens;
    let messagesCompressed = 0;
    let messagesPruned = 0;
    let summariesCreated = 0;

    // تحديد الرسائل للضغط/التقليم
    const messagesToProcess = this.selectMessagesForProcessing(
      window,
      finalConfig
    );

    // ضغط الرسائل حسب مستوى الضغط
    for (const msg of messagesToProcess.toCompress) {
      const compressed = await this.compressMessage(msg, finalConfig.compressionLevel);
      msg.originalContent = msg.content;
      msg.content = compressed;
      msg.tokenCount = EmbeddingUtil.estimateTokenCount(compressed);
      msg.compressed = true;
      messagesCompressed++;
    }

    // إنشاء ملخص للرسائل المقلمة
    if (messagesToProcess.toPrune.length > 0 && finalConfig.summarizationEnabled) {
      const summary = await this.summarizeMessages(messagesToProcess.toPrune);
      window.summaries.push(summary);
      summariesCreated++;

      // إضافة رسالة ملخص
      window.messages.unshift({
        id: crypto.randomUUID(),
        role: 'system',
        content: `[Previous conversation summary]: ${summary.content}`,
        tokenCount: EmbeddingUtil.estimateTokenCount(summary.content),
        importance: 0.9,
        timestamp: new Date(),
        compressed: false,
      });
    }

    // إزالة الرسائل المقلمة
    const prunedIds = new Set(messagesToProcess.toPrune.map(m => m.id));
    window.messages = window.messages.filter(m => !prunedIds.has(m.id));
    messagesPruned = messagesToProcess.toPrune.length;

    // إعادة حساب التوكنات
    window.totalTokens = window.messages.reduce((sum, m) => sum + m.tokenCount, 0);

    const stats: CompressionStats = {
      originalTokens,
      compressedTokens: window.totalTokens,
      tokensSaved: originalTokens - window.totalTokens,
      savingsPercentage: ((originalTokens - window.totalTokens) / originalTokens) * 100,
      messagesCompressed,
      messagesPruned,
      summariesCreated,
    };

    this.contextWindows.set(sessionId, window);
    return { window, stats };
  }

  /**
   * اختيار الرسائل للمعالجة
   */
  private selectMessagesForProcessing(
    window: ContextWindow,
    config: MCPConfig
  ): {
    toCompress: ContextMessage[];
    toPrune: ContextMessage[];
    toKeep: ContextMessage[];
  } {
    const toCompress: ContextMessage[] = [];
    const toPrune: ContextMessage[] = [];
    const toKeep: ContextMessage[] = [];

    // حساب التوكنات المطلوب إزالتها
    const tokensToRemove = window.totalTokens - (window.maxTokens * 0.7);

    let removedTokens = 0;

    // ترتيب الرسائل حسب الاستراتيجية
    const sortedMessages = this.sortMessagesByStrategy(
      window.messages,
      config.pruningStrategy
    );

    for (const msg of sortedMessages) {
      // الحفاظ على رسائل النظام إذا كان مطلوباً
      if (config.keepSystemMessages && msg.role === 'system' && !msg.compressed) {
        toKeep.push(msg);
        continue;
      }

      // الحفاظ على آخر رسالتين دائماً
      const lastTwo = window.messages.slice(-2);
      if (lastTwo.some(m => m.id === msg.id)) {
        toKeep.push(msg);
        continue;
      }

      if (removedTokens < tokensToRemove) {
        if (msg.importance < 0.5) {
          // تقليم الرسائل منخفضة الأهمية
          toPrune.push(msg);
          removedTokens += msg.tokenCount;
        } else if (!msg.compressed) {
          // ضغط الرسائل متوسطة الأهمية
          toCompress.push(msg);
          removedTokens += msg.tokenCount * 0.3; // تقدير توفير الضغط
        } else {
          toKeep.push(msg);
        }
      } else {
        toKeep.push(msg);
      }
    }

    return { toCompress, toPrune, toKeep };
  }

  /**
   * ترتيب الرسائل حسب الاستراتيجية
   */
  private sortMessagesByStrategy(
    messages: ContextMessage[],
    strategy: PruningStrategy
  ): ContextMessage[] {
    switch (strategy) {
      case PruningStrategy.FIFO:
        return [...messages].sort((a, b) =>
          a.timestamp.getTime() - b.timestamp.getTime()
        );

      case PruningStrategy.LIFO:
        return [...messages].sort((a, b) =>
          b.timestamp.getTime() - a.timestamp.getTime()
        );

      case PruningStrategy.IMPORTANCE:
        return [...messages].sort((a, b) => a.importance - b.importance);

      case PruningStrategy.HYBRID:
      default:
        // مزيج: الأقدم والأقل أهمية أولاً
        return [...messages].sort((a, b) => {
          const ageWeight = 0.4;
          const importanceWeight = 0.6;

          const aAge = Date.now() - a.timestamp.getTime();
          const bAge = Date.now() - b.timestamp.getTime();
          const maxAge = Math.max(aAge, bAge);

          const aScore = (1 - aAge / maxAge) * ageWeight + a.importance * importanceWeight;
          const bScore = (1 - bAge / maxAge) * ageWeight + b.importance * importanceWeight;

          return aScore - bScore;
        });
    }
  }

  /**
   * ضغط رسالة واحدة
   */
  private async compressMessage(
    message: ContextMessage,
    level: CompressionLevel
  ): Promise<string> {
    switch (level) {
      case CompressionLevel.NONE:
        return message.content;

      case CompressionLevel.LIGHT:
        // إزالة التكرارات والمسافات الزائدة فقط
        return this.lightCompression(message.content);

      case CompressionLevel.MODERATE:
        // تقصير الجمل مع الحفاظ على المعنى
        return this.moderateCompression(message.content);

      case CompressionLevel.AGGRESSIVE:
        // استخراج النقاط الأساسية فقط
        return this.aggressiveCompression(message.content);

      default:
        return message.content;
    }
  }

  /**
   * ضغط خفيف
   */
  private lightCompression(content: string): string {
    return content
      .replace(/\s+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/\.{2,}/g, '.')
      .trim();
  }

  /**
   * ضغط متوسط
   */
  private moderateCompression(content: string): string {
    // تقصير الجمل الطويلة
    const sentences = content.split(/(?<=[.!?؟])\s+/);
    const shortened = sentences.map(sentence => {
      if (sentence.length > 200) {
        // الحفاظ على أول 100 حرف وآخر 50
        return sentence.slice(0, 100) + '...' + sentence.slice(-50);
      }
      return sentence;
    });

    return shortened.join(' ').trim();
  }

  /**
   * ضغط قوي
   */
  private aggressiveCompression(content: string): string {
    // استخراج النقاط الرئيسية
    const sentences = content.split(/(?<=[.!?؟])\s+/);

    // الاحتفاظ بأهم الجمل (الأولى والأخيرة وأي جملة تحتوي كلمات مفتاحية)
    const keyWords = ['important', 'key', 'main', 'مهم', 'أساسي', 'رئيسي', 'must', 'should'];
    const important = sentences.filter((s, i) =>
      i === 0 ||
      i === sentences.length - 1 ||
      keyWords.some(kw => s.toLowerCase().includes(kw))
    );

    if (important.length > 5) {
      return important.slice(0, 5).join(' ').trim();
    }

    return important.join(' ').trim();
  }

  /**
   * تلخيص مجموعة رسائل
   */
  private async summarizeMessages(messages: ContextMessage[]): Promise<ContextSummary> {
    const combined = messages.map(m => `[${m.role}]: ${m.content}`).join('\n');
    const originalLength = combined.length;

    // استخراج النقاط الرئيسية
    const keyPoints = this.extractKeyPoints(messages);
    const entities = this.extractEntities(messages);

    // إنشاء ملخص مختصر
    const summaryContent = this.generateSummary(messages, keyPoints);
    const compressedLength = summaryContent.length;

    const summary: ContextSummary = {
      id: crypto.randomUUID(),
      originalLength,
      compressedLength,
      compressionRatio: compressedLength / originalLength,
      content: summaryContent,
      keyPoints,
      entities,
      createdAt: new Date(),
    };

    // تخزين في الكاش
    this.summaryCache.set(summary.id, summary);

    return summary;
  }

  /**
   * استخراج النقاط الرئيسية
   */
  private extractKeyPoints(messages: ContextMessage[]): string[] {
    const keyPoints: string[] = [];
    const keyPhrases = [
      'the main', 'key point', 'important', 'must', 'should', 'need to',
      'النقطة الرئيسية', 'مهم', 'يجب', 'ضروري', 'أساسي',
    ];

    for (const msg of messages) {
      const sentences = msg.content.split(/(?<=[.!?؟])\s+/);
      for (const sentence of sentences) {
        if (keyPhrases.some(phrase => sentence.toLowerCase().includes(phrase))) {
          keyPoints.push(sentence.trim());
        }
      }
    }

    return [...new Set(keyPoints)].slice(0, 5);
  }

  /**
   * استخراج الكيانات
   */
  private extractEntities(messages: ContextMessage[]): string[] {
    const entities: Set<string> = new Set();
    const combined = messages.map(m => m.content).join(' ');

    // استخراج الأسماء (كلمات تبدأ بحرف كبير)
    const properNouns = combined.match(/\b[A-Z][a-z]+(?:\s[A-Z][a-z]+)*/g) || [];
    properNouns.forEach(e => entities.add(e));

    // استخراج الأرقام المهمة
    const numbers = combined.match(/\d+(?:\.\d+)?%?/g) || [];
    numbers.forEach(n => entities.add(n));

    return [...entities].slice(0, 10);
  }

  /**
   * توليد ملخص
   */
  private generateSummary(messages: ContextMessage[], keyPoints: string[]): string {
    const userMessages = messages.filter(m => m.role === 'user');
    const assistantMessages = messages.filter(m => m.role === 'assistant');

    let summary = '';

    if (userMessages.length > 0) {
      summary += `User discussed: ${userMessages.map(m =>
        m.content.slice(0, 50)
      ).join('; ')}. `;
    }

    if (assistantMessages.length > 0) {
      summary += `Assistant covered: ${assistantMessages.map(m =>
        m.content.slice(0, 50)
      ).join('; ')}. `;
    }

    if (keyPoints.length > 0) {
      summary += `Key points: ${keyPoints.slice(0, 3).join('; ')}.`;
    }

    return summary;
  }

  /**
   * حساب أهمية الرسالة
   */
  private calculateImportance(message: {
    role: string;
    content: string;
  }): number {
    let importance = 0.5;

    // رسائل النظام أكثر أهمية
    if (message.role === 'system') {
      importance = 0.9;
    }

    // الرسائل القصيرة جداً أقل أهمية
    if (message.content.length < 50) {
      importance -= 0.1;
    }

    // الرسائل التي تحتوي أسئلة أكثر أهمية
    if (message.content.includes('?') || message.content.includes('؟')) {
      importance += 0.1;
    }

    // الرسائل التي تحتوي كلمات مفتاحية
    const importantKeywords = ['important', 'critical', 'must', 'مهم', 'ضروري', 'يجب'];
    if (importantKeywords.some(kw => message.content.toLowerCase().includes(kw))) {
      importance += 0.15;
    }

    return Math.max(0, Math.min(1, importance));
  }

  /**
   * الحصول على السياق للإرسال
   */
  getContextForAPI(
    sessionId: string,
    maxTokens?: number
  ): Array<{ role: string; content: string }> {
    const window = this.contextWindows.get(sessionId);
    if (!window) {
      return [];
    }

    let messages = window.messages;

    if (maxTokens) {
      let tokenCount = 0;
      messages = [];

      // إضافة الرسائل من الأحدث للأقدم حتى الحد
      for (let i = window.messages.length - 1; i >= 0; i--) {
        const msg = window.messages[i];
        if (tokenCount + msg.tokenCount > maxTokens) {
          break;
        }
        messages.unshift(msg);
        tokenCount += msg.tokenCount;
      }
    }

    return messages.map(m => ({
      role: m.role,
      content: m.content,
    }));
  }

  /**
   * الحصول على إحصائيات النافذة
   */
  getWindowStats(sessionId: string): {
    totalMessages: number;
    totalTokens: number;
    compressedMessages: number;
    summaryCount: number;
    utilizationPercentage: number;
  } | null {
    const window = this.contextWindows.get(sessionId);
    if (!window) {
      return null;
    }

    return {
      totalMessages: window.messages.length,
      totalTokens: window.totalTokens,
      compressedMessages: window.messages.filter(m => m.compressed).length,
      summaryCount: window.summaries.length,
      utilizationPercentage: (window.totalTokens / window.maxTokens) * 100,
    };
  }

  /**
   * تنظيف النوافذ غير النشطة
   */
  async cleanup(olderThanMinutes: number = 30): Promise<number> {
    const cutoff = Date.now() - olderThanMinutes * 60 * 1000;
    let cleaned = 0;

    for (const [sessionId, window] of this.contextWindows.entries()) {
      const lastMessage = window.messages[window.messages.length - 1];
      if (!lastMessage || lastMessage.timestamp.getTime() < cutoff) {
        this.contextWindows.delete(sessionId);
        cleaned++;
      }
    }

    return cleaned;
  }

  /**
   * حذف نافذة سياق
   */
  deleteContextWindow(sessionId: string): boolean {
    return this.contextWindows.delete(sessionId);
  }
}

export const mcpContextService = new MCPContextService();
export default mcpContextService;
