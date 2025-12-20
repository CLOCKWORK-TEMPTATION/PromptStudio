import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';

interface HealthStatus {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: string;
  version: string;
  uptime: number;
  services: {
    database: ServiceHealth;
    redis: ServiceHealth;
    openai: ServiceHealth;
    websocket: ServiceHealth;
  };
  metrics: {
    memory: MemoryMetrics;
    cpu: number;
    activeConnections: number;
    totalRequests: number;
    errorRate: number;
  };
}

interface ServiceHealth {
  status: 'healthy' | 'unhealthy' | 'degraded';
  responseTime: number;
  lastCheck: string;
  error?: string;
}

interface MemoryMetrics {
  used: number;
  total: number;
  percentage: number;
}

class HealthCheckService {
  private prisma: PrismaClient;
  private redis: Redis;
  private startTime: number;
  private requestCount: number = 0;
  private errorCount: number = 0;
  private activeConnections: number = 0;

  constructor() {
    this.prisma = new PrismaClient();
    this.redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
    this.startTime = Date.now();
  }

  // Increment request counter
  incrementRequests() {
    this.requestCount++;
  }

  // Increment error counter
  incrementErrors() {
    this.errorCount++;
  }

  // Set active connections
  setActiveConnections(count: number) {
    this.activeConnections = count;
  }

  // Check database health
  private async checkDatabase(): Promise<ServiceHealth> {
    const startTime = Date.now();
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return {
        status: 'healthy',
        responseTime: Date.now() - startTime,
        lastCheck: new Date().toISOString(),
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        lastCheck: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown database error',
      };
    }
  }

  // Check Redis health
  private async checkRedis(): Promise<ServiceHealth> {
    const startTime = Date.now();
    try {
      await this.redis.ping();
      return {
        status: 'healthy',
        responseTime: Date.now() - startTime,
        lastCheck: new Date().toISOString(),
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        lastCheck: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown Redis error',
      };
    }
  }

  // Check OpenAI API health
  private async checkOpenAI(): Promise<ServiceHealth> {
    const startTime = Date.now();
    try {
      // Simple check - just verify we can make a request
      const response = await fetch('https://api.openai.com/v1/models', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        return {
          status: 'healthy',
          responseTime: Date.now() - startTime,
          lastCheck: new Date().toISOString(),
        };
      } else {
        return {
          status: 'degraded',
          responseTime: Date.now() - startTime,
          lastCheck: new Date().toISOString(),
          error: `HTTP ${response.status}: ${response.statusText}`,
        };
      }
    } catch (error) {
      return {
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        lastCheck: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown OpenAI API error',
      };
    }
  }

  // Check WebSocket health
  private async checkWebSocket(): Promise<ServiceHealth> {
    const startTime = Date.now();
    try {
      // For now, just return healthy if the service is running
      // In a real implementation, you might check active connections
      return {
        status: 'healthy',
        responseTime: Date.now() - startTime,
        lastCheck: new Date().toISOString(),
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        lastCheck: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown WebSocket error',
      };
    }
  }

  // Get memory metrics
  private getMemoryMetrics(): MemoryMetrics {
    const memUsage = process.memoryUsage();
    const totalMemory = memUsage.heapTotal;
    const usedMemory = memUsage.heapUsed;
    
    return {
      used: Math.round(usedMemory / 1024 / 1024), // MB
      total: Math.round(totalMemory / 1024 / 1024), // MB
      percentage: Math.round((usedMemory / totalMemory) * 100),
    };
  }

  // Get CPU usage (simplified)
  private getCPUUsage(): number {
    const cpuUsage = process.cpuUsage();
    return Math.round((cpuUsage.user + cpuUsage.system) / 1000000); // Convert to seconds
  }

  // Calculate error rate
  private getErrorRate(): number {
    if (this.requestCount === 0) return 0;
    return Math.round((this.errorCount / this.requestCount) * 100 * 100) / 100; // 2 decimal places
  }

  // Perform comprehensive health check
  async performHealthCheck(): Promise<HealthStatus> {
    const [database, redis, openai, websocket] = await Promise.all([
      this.checkDatabase(),
      this.checkRedis(),
      this.checkOpenAI(),
      this.checkWebSocket(),
    ]);

    const services = { database, redis, openai, websocket };
    
    // Determine overall status
    const hasUnhealthy = Object.values(services).some(service => service.status === 'unhealthy');
    const hasDegraded = Object.values(services).some(service => service.status === 'degraded');
    
    let overallStatus: 'healthy' | 'unhealthy' | 'degraded';
    if (hasUnhealthy) {
      overallStatus = 'unhealthy';
    } else if (hasDegraded) {
      overallStatus = 'degraded';
    } else {
      overallStatus = 'healthy';
    }

    return {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
      uptime: Math.round((Date.now() - this.startTime) / 1000), // seconds
      services,
      metrics: {
        memory: this.getMemoryMetrics(),
        cpu: this.getCPUUsage(),
        activeConnections: this.activeConnections,
        totalRequests: this.requestCount,
        errorRate: this.getErrorRate(),
      },
    };
  }

  // Express route handler
  async healthCheckHandler(req: Request, res: Response) {
    try {
      const healthStatus = await this.performHealthCheck();
      
      // Set appropriate HTTP status code
      let statusCode = 200;
      if (healthStatus.status === 'degraded') {
        statusCode = 200; // Still OK, but with warnings
      } else if (healthStatus.status === 'unhealthy') {
        statusCode = 503; // Service Unavailable
      }

      res.status(statusCode).json(healthStatus);
    } catch (error) {
      res.status(500).json({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Health check failed',
      });
    }
  }

  // Cleanup resources
  async cleanup() {
    await this.prisma.$disconnect();
    this.redis.disconnect();
  }
}

// Export singleton instance
export const healthCheckService = new HealthCheckService();

// Express middleware to track requests
export const requestTrackingMiddleware = (req: Request, res: Response, next: Function) => {
  healthCheckService.incrementRequests();
  
  // Track errors
  const originalSend = res.send;
  res.send = function(data) {
    if (res.statusCode >= 400) {
      healthCheckService.incrementErrors();
    }
    return originalSend.call(this, data);
  };
  
  next();
};

export default HealthCheckService;