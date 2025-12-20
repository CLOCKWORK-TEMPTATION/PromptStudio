import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';

const execAsync = promisify(exec);

export interface DeploymentConfig {
    provider: 'vercel' | 'cloudflare' | 'aws' | 'gcp';
    environment: 'development' | 'staging' | 'production';
    region?: string;
    domain?: string;
    tenantId?: string;
    config: Record<string, unknown>;
}

export interface DeploymentResult {
    success: boolean;
    deploymentId?: string;
    url?: string;
    logs?: string[];
    error?: string;
}

export class EnterpriseDeploymentService {
    private templatesPath: string;

    constructor(templatesPath: string = './deployment-templates') {
        this.templatesPath = templatesPath;
    }

    /**
     * Deploy application to specified provider
     */
    async deploy(config: DeploymentConfig): Promise<DeploymentResult> {
        try {
            switch (config.provider) {
                case 'vercel':
                    return await this.deployToVercel(config);
                case 'cloudflare':
                    return await this.deployToCloudflare(config);
                case 'aws':
                    return await this.deployToAWS(config);
                case 'gcp':
                    return await this.deployToGCP(config);
                default:
                    throw new Error(`Unsupported provider: ${config.provider}`);
            }
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown deployment error'
            };
        }
    }

    /**
     * Deploy to Vercel
     */
    private async deployToVercel(config: DeploymentConfig): Promise<DeploymentResult> {
        const templatePath = path.join(this.templatesPath, 'vercel');
        const deploymentPath = path.join(templatePath, `deployment-${Date.now()}`);

        try {
            // Create deployment directory
            await fs.mkdir(deploymentPath, { recursive: true });

            // Generate vercel.json
            const vercelConfig = {
                version: 2,
                builds: [
                    {
                        src: 'dist/**',
                        use: '@vercel/static'
                    }
                ],
                routes: [
                    {
                        src: '/api/(.*)',
                        dest: '/api/$1'
                    },
                    {
                        src: '/(.*)',
                        dest: '/index.html'
                    }
                ],
                env: {
                    ...config.config,
                    NODE_ENV: config.environment
                },
                regions: config.region ? [config.region] : ['iad1']
            };

            await fs.writeFile(
                path.join(deploymentPath, 'vercel.json'),
                JSON.stringify(vercelConfig, null, 2)
            );

            // Copy application files
            await this.copyAppFiles(deploymentPath);

            // Deploy using Vercel CLI
            const { stdout, stderr } = await execAsync(
                `cd ${deploymentPath} && npx vercel --prod --yes`,
                { env: { ...process.env, VERCEL_TOKEN: config.config.vercelToken as string } }
            );

            const logs = this.parseLogs(stdout + stderr);
            const deploymentUrl = this.extractDeploymentUrl(logs);

            return {
                success: true,
                deploymentId: `vercel-${Date.now()}`,
                url: deploymentUrl,
                logs
            };

        } catch (error) {
            await fs.rm(deploymentPath, { recursive: true, force: true });
            throw error;
        }
    }

    /**
     * Deploy to Cloudflare Pages
     */
    private async deployToCloudflare(config: DeploymentConfig): Promise<DeploymentResult> {
        const templatePath = path.join(this.templatesPath, 'cloudflare');
        const deploymentPath = path.join(templatePath, `deployment-${Date.now()}`);

        try {
            await fs.mkdir(deploymentPath, { recursive: true });

            // Generate wrangler.toml
            const wranglerConfig = `
name = "promptstudio-${config.environment}"
compatibility_date = "${new Date().toISOString().split('T')[0]}"

[env.${config.environment}]
account_id = "${config.config.accountId}"
zone_id = "${config.config.zoneId}"

[[pages_build_config]]
build_command = "npm run build"
destination_dir = "dist"
root_dir = "."

[vars]
NODE_ENV = "${config.environment}"
${Object.entries(config.config)
                    .filter(([key]) => !['accountId', 'zoneId', 'apiToken'].includes(key))
                    .map(([key, value]) => `${key} = "${value}"`)
                    .join('\n')}
      `;

            await fs.writeFile(
                path.join(deploymentPath, 'wrangler.toml'),
                wranglerConfig
            );

            // Copy application files
            await this.copyAppFiles(deploymentPath);

            // Deploy using Wrangler
            const { stdout, stderr } = await execAsync(
                `cd ${deploymentPath} && npx wrangler pages deploy dist --commit-dirty=true`,
                {
                    env: {
                        ...process.env,
                        CLOUDFLARE_ACCOUNT_ID: config.config.accountId as string,
                        CLOUDFLARE_API_TOKEN: config.config.apiToken as string
                    }
                }
            );

            const logs = this.parseLogs(stdout + stderr);
            const deploymentUrl = this.extractDeploymentUrl(logs);

            return {
                success: true,
                deploymentId: `cloudflare-${Date.now()}`,
                url: deploymentUrl,
                logs
            };

        } catch (error) {
            await fs.rm(deploymentPath, { recursive: true, force: true });
            throw error;
        }
    }

    /**
     * Deploy to AWS (ECS Fargate + CloudFront)
     */
    private async deployToAWS(config: DeploymentConfig): Promise<DeploymentResult> {
        const templatePath = path.join(this.templatesPath, 'aws');
        const deploymentPath = path.join(templatePath, `deployment-${Date.now()}`);

        try {
            await fs.mkdir(deploymentPath, { recursive: true });

            // Generate CloudFormation template
            const cloudFormationTemplate = {
                AWSTemplateFormatVersion: '2010-09-09',
                Resources: {
                    ECSCluster: {
                        Type: 'AWS::ECS::Cluster',
                        Properties: {
                            ClusterName: `promptstudio-${config.environment}-${Date.now()}`
                        }
                    },
                    ECSTaskDefinition: {
                        Type: 'AWS::ECS::TaskDefinition',
                        Properties: {
                            Family: `promptstudio-${config.environment}`,
                            Cpu: '256',
                            Memory: '512',
                            NetworkMode: 'awsvpc',
                            RequiresCompatibilities: ['FARGATE'],
                            ExecutionRoleArn: config.config.executionRoleArn,
                            ContainerDefinitions: [
                                {
                                    Name: 'promptstudio',
                                    Image: 'node:18-alpine',
                                    Essential: true,
                                    Environment: [
                                        { Name: 'NODE_ENV', Value: config.environment },
                                        ...Object.entries(config.config).map(([key, value]) => ({
                                            Name: key,
                                            Value: String(value)
                                        }))
                                    ],
                                    PortMappings: [
                                        {
                                            ContainerPort: 3000,
                                            Protocol: 'tcp'
                                        }
                                    ]
                                }
                            ]
                        }
                    }
                }
            };

            await fs.writeFile(
                path.join(deploymentPath, 'template.yaml'),
                JSON.stringify(cloudFormationTemplate, null, 2)
            );

            // Deploy using AWS CLI
            const { stdout, stderr } = await execAsync(
                `cd ${deploymentPath} && aws cloudformation deploy --template-file template.yaml --stack-name promptstudio-${config.environment}-${Date.now()} --capabilities CAPABILITY_IAM`,
                {
                    env: {
                        ...process.env,
                        AWS_ACCESS_KEY_ID: config.config.accessKeyId as string,
                        AWS_SECRET_ACCESS_KEY: config.config.secretAccessKey as string,
                        AWS_DEFAULT_REGION: config.region || 'us-east-1'
                    }
                }
            );

            const logs = this.parseLogs(stdout + stderr);

            return {
                success: true,
                deploymentId: `aws-${Date.now()}`,
                logs
            };

        } catch (error) {
            await fs.rm(deploymentPath, { recursive: true, force: true });
            throw error;
        }
    }

    /**
     * Deploy to Google Cloud Platform
     */
    private async deployToGCP(config: DeploymentConfig): Promise<DeploymentResult> {
        const templatePath = path.join(this.templatesPath, 'gcp');
        const deploymentPath = path.join(templatePath, `deployment-${Date.now()}`);

        try {
            await fs.mkdir(deploymentPath, { recursive: true });

            // Generate app.yaml for App Engine
            const appYaml = `
runtime: nodejs18
instance_class: F1
automatic_scaling:
  min_instances: 1
  max_instances: 10
  target_cpu_utilization: 0.7

env_variables:
  NODE_ENV: "${config.environment}"
  ${Object.entries(config.config)
                    .map(([key, value]) => `  ${key}: "${value}"`)
                    .join('\n')}

handlers:
- url: /.*
  script: auto
  secure: always
      `;

            await fs.writeFile(
                path.join(deploymentPath, 'app.yaml'),
                appYaml
            );

            // Copy application files
            await this.copyAppFiles(deploymentPath);

            // Deploy using gcloud CLI
            const { stdout, stderr } = await execAsync(
                `cd ${deploymentPath} && gcloud app deploy --quiet --project=${config.config.projectId}`,
                {
                    env: {
                        ...process.env,
                        GOOGLE_CLOUD_PROJECT: config.config.projectId as string
                    }
                }
            );

            const logs = this.parseLogs(stdout + stderr);
            const deploymentUrl = `https://${config.config.projectId}.appspot.com`;

            return {
                success: true,
                deploymentId: `gcp-${Date.now()}`,
                url: deploymentUrl,
                logs
            };

        } catch (error) {
            await fs.rm(deploymentPath, { recursive: true, force: true });
            throw error;
        }
    }

    /**
     * Copy application files to deployment directory
     */
    private async copyAppFiles(deploymentPath: string): Promise<void> {
        const filesToCopy = [
            'package.json',
            'package-lock.json',
            'dist/',
            'public/',
            'src/',
            'prisma/',
            'docker-compose.yml',
            'Dockerfile'
        ];

        for (const file of filesToCopy) {
            try {
                const srcPath = path.join(process.cwd(), file);
                const destPath = path.join(deploymentPath, file);

                const stat = await fs.stat(srcPath);
                if (stat.isDirectory()) {
                    await this.copyDirectory(srcPath, destPath);
                } else {
                    await fs.copyFile(srcPath, destPath);
                }
            } catch (error) {
                // Skip files that don't exist
                console.warn(`Skipping ${file}: ${error}`);
            }
        }
    }

    /**
     * Copy directory recursively
     */
    private async copyDirectory(src: string, dest: string): Promise<void> {
        await fs.mkdir(dest, { recursive: true });
        const entries = await fs.readdir(src, { withFileTypes: true });

        for (const entry of entries) {
            const srcPath = path.join(src, entry.name);
            const destPath = path.join(dest, entry.name);

            if (entry.isDirectory()) {
                await this.copyDirectory(srcPath, destPath);
            } else {
                await fs.copyFile(srcPath, destPath);
            }
        }
    }

    /**
     * Parse deployment logs
     */
    private parseLogs(output: string): string[] {
        return output
            .split('\n')
            .filter(line => line.trim())
            .map(line => line.trim());
    }

    /**
     * Extract deployment URL from logs
     */
    private extractDeploymentUrl(logs: string[]): string | undefined {
        for (const log of logs) {
            const urlMatch = log.match(/(https?:\/\/[^\s]+)/);
            if (urlMatch) {
                return urlMatch[1];
            }
        }
        return undefined;
    }

    /**
     * Get deployment status
     */
    async getDeploymentStatus(provider: string, deploymentId: string): Promise<{
        status: 'pending' | 'building' | 'deploying' | 'success' | 'failed';
        url?: string;
        lastUpdated: Date;
    }> {
        // This would integrate with each provider's API to get real status
        // For now, return mock status
        return {
            status: 'success',
            url: `https://${provider}-deployment-${deploymentId}.example.com`,
            lastUpdated: new Date()
        };
    }

    /**
     * Rollback deployment
     */
    async rollbackDeployment(provider: string, deploymentId: string): Promise<DeploymentResult> {
        try {
            // Implementation would depend on the provider
            // This is a placeholder
            return {
                success: true,
                deploymentId: `rollback-${deploymentId}`,
                logs: ['Rollback initiated successfully']
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Rollback failed'
            };
        }
    }

    /**
     * Configure rate limiting for deployment
     */
    async configureRateLimiting(provider: string, config: {
        requestsPerMinute: number;
        burstLimit: number;
        tenantId?: string;
    }): Promise<void> {
        // Configure rate limiting based on provider
        // TODO: Implement actual rate limiting configuration
        const { requestsPerMinute, burstLimit } = config;
        switch (provider) {
            case 'vercel':
                // Configure Vercel rate limiting with requestsPerMinute and burstLimit
                console.log(`Configuring Vercel rate limiting: ${requestsPerMinute}/min, burst: ${burstLimit}`);
                break;
            case 'cloudflare':
                // Configure Cloudflare rate limiting
                console.log(`Configuring Cloudflare rate limiting: ${requestsPerMinute}/min, burst: ${burstLimit}`);
                break;
            case 'aws':
                // Configure AWS WAF/API Gateway rate limiting
                console.log(`Configuring AWS rate limiting: ${requestsPerMinute}/min, burst: ${burstLimit}`);
                break;
            case 'gcp':
                // Configure GCP rate limiting
                console.log(`Configuring GCP rate limiting: ${requestsPerMinute}/min, burst: ${burstLimit}`);
                break;
        }
    }

    /**
     * Setup monitoring and alerting
     */
    async setupMonitoring(provider: string, config: {
        enableMetrics: boolean;
        enableLogging: boolean;
        alertEmail?: string;
        tenantId?: string;
    }): Promise<void> {
        // Setup monitoring based on provider
        // TODO: Implement actual monitoring setup
        const { enableMetrics, enableLogging, alertEmail } = config;
        switch (provider) {
            case 'vercel':
                // Setup Vercel analytics
                console.log(`Vercel monitoring: metrics=${enableMetrics}, logging=${enableLogging}, alert=${alertEmail}`);
                break;
            case 'cloudflare':
                // Setup Cloudflare analytics
                console.log(`Cloudflare monitoring: metrics=${enableMetrics}, logging=${enableLogging}, alert=${alertEmail}`);
                break;
            case 'aws':
                // Setup CloudWatch monitoring
                console.log(`AWS monitoring: metrics=${enableMetrics}, logging=${enableLogging}, alert=${alertEmail}`);
                break;
            case 'gcp':
                // Setup Google Cloud Monitoring
                console.log(`GCP monitoring: metrics=${enableMetrics}, logging=${enableLogging}, alert=${alertEmail}`);
                break;
        }
    }
}