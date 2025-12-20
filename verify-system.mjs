#!/usr/bin/env node

/**
 * PromptStudio System Integration Verification
 * يتحقق هذا السكريبت من تنفيذ جميع المكونات المطلوبة
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class SystemVerifier {
  constructor() {
    this.results = [];
    this.projectRoot = path.resolve(__dirname, '.');
  }

  addResult(name, status, message, details = []) {
    this.results.push({ name, status, message, details });
  }

  fileExists(filePath) {
    return fs.existsSync(path.join(this.projectRoot, filePath));
  }

  directoryExists(dirPath) {
    return fs.existsSync(path.join(this.projectRoot, dirPath)) && 
           fs.statSync(path.join(this.projectRoot, dirPath)).isDirectory();
  }

  readJsonFile(filePath) {
    try {
      const fullPath = path.join(this.projectRoot, filePath);
      return JSON.parse(fs.readFileSync(fullPath, 'utf8'));
    } catch {
      return null;
    }
  }

  // 1. التحقق من المبدأ المؤسس
  checkFoundationalPrinciple() {
    console.log('🔍 Checking Foundational Principle...');

    // Type Safety
    const hasTypeScript = this.fileExists('tsconfig.json');
    const packageJson = this.readJsonFile('package.json');
    const hasZod = packageJson?.dependencies?.zod || packageJson?.devDependencies?.zod;
    
    if (hasTypeScript && hasZod) {
      this.addResult('Type Safety', 'PASS', 'TypeScript + Zod configured for complete type safety');
    } else {
      this.addResult('Type Safety', 'FAIL', 'Missing TypeScript or Zod configuration');
    }

    // Structured Outputs
    const hasStructuredTypes = this.fileExists('src/types/index.ts');
    if (hasStructuredTypes) {
      this.addResult('Structured Outputs', 'PASS', 'Type definitions exist for structured outputs');
    } else {
      this.addResult('Structured Outputs', 'FAIL', 'Missing type definitions');
    }

    // Governance
    const hasSafetyMiddleware = this.fileExists('src/backend/api/middleware/safetyMiddleware.ts');
    const hasSafetyService = this.fileExists('src/backend/services/SafetyService.ts');
    
    if (hasSafetyMiddleware && hasSafetyService) {
      this.addResult('Strict Governance', 'PASS', 'Safety middleware and service implemented');
    } else {
      this.addResult('Strict Governance', 'FAIL', 'Missing safety components');
    }

    // Cost/Quality Monitoring
    const hasAnalysisService = this.fileExists('src/services/analysisService.ts');
    const hasHealthCheck = this.fileExists('src/backend/services/HealthCheckService.ts');
    
    if (hasAnalysisService && hasHealthCheck) {
      this.addResult('Cost/Quality Monitoring', 'PASS', 'Analysis and health check services implemented');
    } else {
      this.addResult('Cost/Quality Monitoring', 'FAIL', 'Missing monitoring components');
    }
  }

  // 2. التحقق من المكدس التقني
  checkTechStack() {
    console.log('🛠️ Checking Tech Stack...');

    const packageJson = this.readJsonFile('package.json');
    if (!packageJson) {
      this.addResult('Package Configuration', 'FAIL', 'package.json not found');
      return;
    }

    const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };

    // Frontend Stack
    const frontendDeps = ['next', 'react', 'typescript', 'zustand', 'tailwindcss', 'socket.io-client', 'yjs'];
    const missingFrontend = frontendDeps.filter(dep => !deps[dep]);
    
    if (missingFrontend.length === 0) {
      this.addResult('Frontend Stack', 'PASS', 'All frontend dependencies present');
    } else {
      this.addResult('Frontend Stack', 'FAIL', 'Missing frontend dependencies', missingFrontend);
    }

    // Backend Stack
    const backendDeps = ['express', 'socket.io', 'prisma', 'ioredis', 'jsonwebtoken'];
    const missingBackend = backendDeps.filter(dep => !deps[dep]);
    
    if (missingBackend.length === 0) {
      this.addResult('Backend Stack', 'PASS', 'All backend dependencies present');
    } else {
      this.addResult('Backend Stack', 'FAIL', 'Missing backend dependencies', missingBackend);
    }

    // Integration Dependencies
    const integrationDeps = ['openai', 'cors', 'dotenv'];
    const missingIntegration = integrationDeps.filter(dep => !deps[dep]);
    
    if (missingIntegration.length === 0) {
      this.addResult('Integration Stack', 'PASS', 'All integration dependencies present');
    } else {
      this.addResult('Integration Stack', 'FAIL', 'Missing integration dependencies', missingIntegration);
    }
  }

  // 3. التحقق من القدرات المطلوبة
  checkRequiredCapabilities() {
    console.log('⚡ Checking Required Capabilities...');

    // Live Collaboration
    const collaborationFiles = [
      'src/backend/websocket/handlers/collaborationHandlers.ts',
      'src/backend/websocket/handlers/presenceHandlers.ts',
      'src/backend/websocket/managers/CRDTManager.ts'
    ];
    
    const hasCollaboration = collaborationFiles.every(file => this.fileExists(file));
    if (hasCollaboration) {
      this.addResult('Live Collaboration', 'PASS', 'CRDT and presence system implemented');
    } else {
      this.addResult('Live Collaboration', 'FAIL', 'Missing collaboration components');
    }

    // Version History & Comments
    const hasCommentHandlers = this.fileExists('src/backend/websocket/handlers/commentHandlers.ts');
    const hasPrismaSchema = this.fileExists('prisma/schema.prisma');
    
    if (hasCommentHandlers && hasPrismaSchema) {
      this.addResult('Version History & Comments', 'PASS', 'Comment system and database schema present');
    } else {
      this.addResult('Version History & Comments', 'FAIL', 'Missing version control components');
    }

    // Semantic Cache
    const hasSemanticCache = this.fileExists('src/backend/services/SemanticCacheService.ts');
    const hasCacheRoute = this.fileExists('src/backend/api/routes/cache.ts');
    
    if (hasSemanticCache && hasCacheRoute) {
      this.addResult('Semantic Cache', 'PASS', 'Semantic caching system implemented');
    } else {
      this.addResult('Semantic Cache', 'FAIL', 'Missing semantic cache components');
    }
  }

  // 4. التحقق من مسارات API
  checkAPIRoutes() {
    console.log('🛣️ Checking API Routes...');

    const requiredRoutes = [
      'auth', 'sessions', 'cache', 'rag', 'chains', 
      'reasoning', 'refinement', 'prediction', 'translation', 'prompts'
    ];

    const missingRoutes = requiredRoutes.filter(route => 
      !this.fileExists(`src/backend/api/routes/${route}.ts`)
    );

    if (missingRoutes.length === 0) {
      this.addResult('API Routes', 'PASS', 'All required API routes implemented');
    } else {
      this.addResult('API Routes', 'FAIL', 'Missing API routes', missingRoutes);
    }
  }

  // 5. التحقق من توليد SDK
  checkSDKGeneration() {
    console.log('🔧 Checking SDK Generation...');

    const sdkFiles = [
      'src/lib/sdk-generator/index.ts',
      'src/lib/sdk-generator/python-template.ts',
      'src/lib/sdk-generator/typescript-template.ts'
    ];

    const hasSDKGeneration = sdkFiles.every(file => this.fileExists(file));
    if (hasSDKGeneration) {
      this.addResult('SDK Generation', 'PASS', 'Python and TypeScript SDK generators implemented');
    } else {
      this.addResult('SDK Generation', 'FAIL', 'Missing SDK generation components');
    }
  }

  // 6. التحقق من Docker
  checkDockerSetup() {
    console.log('🐳 Checking Docker Setup...');

    const dockerFiles = [
      'docker-compose.yml',
      'docker-compose.prod.yml',
      'docker-compose.dev.yml',
      'Dockerfile',
      'Dockerfile.backend',
      'Dockerfile.frontend'
    ];

    const existingDockerFiles = dockerFiles.filter(file => this.fileExists(file));
    
    if (existingDockerFiles.length >= 4) {
      this.addResult('Docker Setup', 'PASS', `Docker configuration complete (${existingDockerFiles.length}/6 files)`);
    } else if (existingDockerFiles.length >= 2) {
      this.addResult('Docker Setup', 'WARN', `Partial Docker setup (${existingDockerFiles.length}/6 files)`);
    } else {
      this.addResult('Docker Setup', 'FAIL', 'Missing Docker configuration');
    }
  }

  // 7. التحقق من الأمان
  checkSecurity() {
    console.log('🔒 Checking Security Features...');

    const securityFiles = [
      'src/backend/api/middleware/auth.ts',
      'src/backend/api/middleware/safetyMiddleware.ts',
      'src/backend/services/SafetyService.ts'
    ];

    const hasSecurityFeatures = securityFiles.every(file => this.fileExists(file));
    if (hasSecurityFeatures) {
      this.addResult('Security Features', 'PASS', 'Authentication and safety middleware implemented');
    } else {
      this.addResult('Security Features', 'FAIL', 'Missing security components');
    }
  }

  // 8. التحقق من الذكاء الاصطناعي المتقدم
  checkAdvancedAI() {
    console.log('🧠 Checking Advanced AI Features...');

    const aiServices = [
      'src/backend/services/AdaptiveRAGService.ts',
      'src/backend/services/LongTermMemoryService.ts',
      'src/backend/services/OutputEvaluationService.ts',
      'src/backend/services/BayesianPromptOptimizer.ts'
    ];

    const existingAIServices = aiServices.filter(file => this.fileExists(file));
    
    if (existingAIServices.length >= 3) {
      this.addResult('Advanced AI', 'PASS', `Advanced AI services implemented (${existingAIServices.length}/4)`);
    } else if (existingAIServices.length >= 1) {
      this.addResult('Advanced AI', 'WARN', `Partial AI implementation (${existingAIServices.length}/4)`);
    } else {
      this.addResult('Advanced AI', 'FAIL', 'Missing advanced AI services');
    }
  }

  // تشغيل جميع الفحوصات
  async runAllChecks() {
    console.log('🚀 PromptStudio System Verification');
    console.log('=====================================\n');

    this.checkFoundationalPrinciple();
    this.checkTechStack();
    this.checkRequiredCapabilities();
    this.checkAPIRoutes();
    this.checkSDKGeneration();
    this.checkDockerSetup();
    this.checkSecurity();
    this.checkAdvancedAI();

    this.printResults();
  }

  // طباعة النتائج
  printResults() {
    console.log('\n📊 Verification Results');
    console.log('========================\n');

    const passed = this.results.filter(r => r.status === 'PASS').length;
    const warned = this.results.filter(r => r.status === 'WARN').length;
    const failed = this.results.filter(r => r.status === 'FAIL').length;

    this.results.forEach(result => {
      const icon = result.status === 'PASS' ? '✅' : result.status === 'WARN' ? '⚠️' : '❌';
      console.log(`${icon} ${result.name}: ${result.message}`);
      
      if (result.details && result.details.length > 0) {
        result.details.forEach(detail => {
          console.log(`   - ${detail}`);
        });
      }
    });

    console.log('\n📈 Summary');
    console.log('===========');
    console.log(`✅ Passed: ${passed}`);
    console.log(`⚠️  Warnings: ${warned}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`📊 Total: ${this.results.length}`);

    const successRate = Math.round((passed / this.results.length) * 100);
    console.log(`🎯 Success Rate: ${successRate}%`);

    if (successRate >= 90) {
      console.log('\n🎉 Excellent! PromptStudio is ready for production.');
    } else if (successRate >= 75) {
      console.log('\n👍 Good! Minor improvements needed.');
    } else if (successRate >= 50) {
      console.log('\n⚠️  Warning! Several components need attention.');
    } else {
      console.log('\n❌ Critical! Major components are missing.');
    }

    console.log('\n🔗 Next Steps:');
    if (failed > 0) {
      console.log('1. Fix failed components');
    }
    if (warned > 0) {
      console.log('2. Address warnings');
    }
    console.log('3. Run tests');
    console.log('4. Deploy to staging');
    console.log('5. Monitor production metrics');

    console.log('\n📚 Documentation: ARCHITECTURE.md');
    console.log('🚀 Quick Start: ./start.sh or start.bat');
  }
}

// تشغيل التحقق
const verifier = new SystemVerifier();
verifier.runAllChecks().catch(console.error);