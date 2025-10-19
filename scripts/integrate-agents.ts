#!/usr/bin/env node
/**
 * Script to integrate CloudFlair with the Agent Template Package
 * This creates agent clients that can interact with CloudFlair's API
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, resolve } from 'path';
import { createHmac } from 'crypto';
import * as yaml from 'js-yaml';

const AGENT_TEMPLATE_PATH = 'C:\\Users\\Mrdru\\OneDrive\\Documents\\Projects\\AI_Projects\\AGENT_TEMPLATE_PACKAGE';
const CLOUDFLAIR_PATH = process.cwd();

interface AgentConfig {
  name: string;
  display_name: string;
  role: string;
  description: string;
  api_key_secret: string;
  rbac: {
    allowed_routes: string[];
    risk_level: string;
    require_human_approval_for: string[];
  };
  defaults: Record<string, any>;
}

interface AgentTemplate {
  metadata: {
    name: string;
    version: string;
    description: string;
  };
  capabilities: string[];
  tools: string[];
  playbooks: string[];
}

class AgentIntegrator {
  private cloudflairConfig: any;
  private agentTemplates: Map<string, AgentTemplate> = new Map();
  
  constructor() {
    this.loadCloudflairConfig();
    this.loadAgentTemplates();
  }
  
  private loadCloudflairConfig() {
    const configPath = join(CLOUDFLAIR_PATH, 'agents.config.yaml');
    const configContent = readFileSync(configPath, 'utf-8');
    this.cloudflairConfig = yaml.load(configContent) as any;
    console.log('✓ Loaded CloudFlair agent configuration');
  }
  
  private loadAgentTemplates() {
    const agentsDir = join(AGENT_TEMPLATE_PATH, 'agents');
    const files = ['content.agent.yaml', 'ops.agent.yaml', 'security.agent.yaml', 'sales.agent.yaml', 'marketing.agent.yaml'];
    
    for (const file of files) {
      const filePath = join(agentsDir, file);
      if (existsSync(filePath)) {
        const content = readFileSync(filePath, 'utf-8');
        const template = yaml.load(content) as AgentTemplate;
        const name = file.replace('.agent.yaml', '');
        this.agentTemplates.set(name, template);
        console.log(`✓ Loaded template: ${name}`);
      }
    }
  }
  
  generatePythonClient() {
    const clientPath = join(CLOUDFLAIR_PATH, 'agents', 'python');
    if (!existsSync(clientPath)) {
      mkdirSync(clientPath, { recursive: true });
    }
    
    const pythonClient = `#!/usr/bin/env python3
"""
CloudFlair Agent Client
Auto-generated from agent templates
"""

import os
import json
import time
import hmac
import hashlib
import requests
from typing import Dict, Any, Optional, List
from dataclasses import dataclass
from enum import Enum

class AgentType(Enum):
    CONTENT = "ContentAgent"
    SEO = "SEOAgent"
    OPS = "OpsAgent"
    COMMERCE = "CommerceAgent"
    COMMUNITY = "CommunityAgent"

@dataclass
class AgentResponse:
    id: str
    status: str
    message: str
    data: Optional[Dict[str, Any]] = None

class CloudFlairAgent:
    """Base class for CloudFlair agents"""
    
    def __init__(self, agent_type: AgentType, api_key: str, base_url: str = "https://api.cloudflair.com"):
        self.agent_id = agent_type.value
        self.api_key = api_key
        self.base_url = base_url
    
    def _sign_request(self, body: str, timestamp: str) -> str:
        """Generate HMAC signature for request"""
        message = f"{self.agent_id}:{timestamp}:{body}"
        signature = hmac.new(
            self.api_key.encode(),
            message.encode(),
            hashlib.sha256
        ).hexdigest()
        return signature
    
    def _make_request(self, endpoint: str, data: Dict[str, Any]) -> AgentResponse:
        """Make authenticated request to CloudFlair API"""
        url = f"{self.base_url}/agent{endpoint}"
        body = json.dumps(data)
        timestamp = str(int(time.time()))
        signature = self._sign_request(body, timestamp)
        
        headers = {
            "Content-Type": "application/json",
            "X-Agent-Id": self.agent_id,
            "X-Timestamp": timestamp,
            "X-Signature": signature
        }
        
        try:
            response = requests.post(url, data=body, headers=headers)
            response.raise_for_status()
            result = response.json()
            return AgentResponse(
                id=result.get("id", ""),
                status=result.get("status", ""),
                message=result.get("message", ""),
                data=result
            )
        except requests.exceptions.RequestException as e:
            return AgentResponse(
                id="",
                status="error",
                message=str(e)
            )

class ContentAgent(CloudFlairAgent):
    """Agent for content management"""
    
    def __init__(self, api_key: str, **kwargs):
        super().__init__(AgentType.CONTENT, api_key, **kwargs)
    
    def propose_content(self, path: str, markdown: str, reason: str, 
                       metadata: Optional[Dict[str, Any]] = None) -> AgentResponse:
        """Propose new content or updates"""
        return self._make_request("/proposals/content", {
            "path": path,
            "markdown": markdown,
            "reason": reason,
            "metadata": metadata or {}
        })
    
    def update_flag(self, flag_key: str, value: Any, reason: str, ttl: Optional[int] = None) -> AgentResponse:
        """Update feature flag"""
        data = {
            "flagKey": flag_key,
            "value": value,
            "reason": reason
        }
        if ttl:
            data["ttl"] = ttl
        return self._make_request("/flags", data)

class SEOAgent(CloudFlairAgent):
    """Agent for SEO optimization"""
    
    def __init__(self, api_key: str, **kwargs):
        super().__init__(AgentType.SEO, api_key, **kwargs)
    
    def run_audit(self, urls: Optional[List[str]] = None) -> AgentResponse:
        """Run SEO audit on specified URLs or entire site"""
        return self._make_request("/seo/audit", {
            "urls": urls or [],
            "fullSite": urls is None
        })
    
    def get_metrics(self) -> AgentResponse:
        """Get current SEO metrics snapshot"""
        # This would be a GET request
        return self._make_request("/metrics/snapshot", {})

class OpsAgent(CloudFlairAgent):
    """Agent for operations and monitoring"""
    
    def __init__(self, api_key: str, **kwargs):
        super().__init__(AgentType.OPS, api_key, **kwargs)
    
    def queue_task(self, task_type: str, payload: Dict[str, Any], 
                  priority: int = 5, scheduled_for: Optional[str] = None) -> AgentResponse:
        """Queue a background task"""
        data = {
            "type": task_type,
            "payload": payload,
            "priority": priority
        }
        if scheduled_for:
            data["scheduledFor"] = scheduled_for
        return self._make_request("/tasks", data)
    
    def snapshot_metrics(self) -> AgentResponse:
        """Take a metrics snapshot"""
        return self._make_request("/metrics/snapshot", {})

# Integration with Agent Template Package
def integrate_with_template(template_path: str = "${AGENT_TEMPLATE_PATH}"):
    """Load and integrate agent templates"""
    import sys
    sys.path.insert(0, template_path)
    
    try:
        from service.agent_runtime import AgentRuntime
        from service.playbook_engine import PlaybookEngine
        
        # Create hybrid agent that uses both CloudFlair API and local playbooks
        class HybridAgent:
            def __init__(self, cloudflair_agent: CloudFlairAgent, template_config: Dict[str, Any]):
                self.cf_agent = cloudflair_agent
                self.runtime = AgentRuntime(template_config)
                self.playbook_engine = PlaybookEngine()
            
            def execute_playbook(self, playbook_name: str, context: Dict[str, Any]) -> Dict[str, Any]:
                """Execute a local playbook and sync results with CloudFlair"""
                # Execute locally
                result = self.playbook_engine.execute(playbook_name, context)
                
                # Sync with CloudFlair
                self.cf_agent.queue_task("playbook_execution", {
                    "playbook": playbook_name,
                    "result": result,
                    "timestamp": time.time()
                })
                
                return result
        
        return HybridAgent
    except ImportError as e:
        print(f"Warning: Could not import agent templates: {e}")
        return None

# Example usage
if __name__ == "__main__":
    # Load API keys from environment
    content_key = os.getenv("CONTENTAGENT_API_KEY", "")
    seo_key = os.getenv("SEOAGENT_API_KEY", "")
    ops_key = os.getenv("OPSAGENT_API_KEY", "")
    
    # Create agents
    content = ContentAgent(content_key)
    seo = SEOAgent(seo_key)
    ops = OpsAgent(ops_key)
    
    # Example: Content proposal
    response = content.propose_content(
        path="blog/hello-world.mdx",
        markdown="# Hello World\\n\\nThis is a test post.",
        reason="Initial blog post",
        metadata={"tags": ["announcement"], "author": "ContentAgent"}
    )
    print(f"Content proposal: {response.status} - {response.message}")
    
    # Example: SEO audit
    response = seo.run_audit(urls=["https://cloudflair.com"])
    print(f"SEO audit: {response.status} - {response.message}")
    
    # Example: Queue task
    response = ops.queue_task(
        task_type="analytics_snapshot",
        payload={"metrics": ["traffic", "conversions"]},
        priority=8
    )
    print(f"Task queued: {response.status} - {response.message}")
`;
    
    writeFileSync(join(clientPath, 'cloudflair_agent.py'), pythonClient);
    console.log('✓ Generated Python client');
    
    // Generate requirements.txt
    const requirements = `requests>=2.31.0
pyyaml>=6.0
python-dotenv>=1.0.0
`;
    writeFileSync(join(clientPath, 'requirements.txt'), requirements);
  }
  
  generateNodeClient() {
    const clientPath = join(CLOUDFLAIR_PATH, 'agents', 'node');
    if (!existsSync(clientPath)) {
      mkdirSync(clientPath, { recursive: true });
    }
    
    const nodeClient = `/**
 * CloudFlair Agent Client for Node.js
 * Auto-generated from agent templates
 */

import { createHmac } from 'crypto';
import fetch from 'node-fetch';

export enum AgentType {
  Content = 'ContentAgent',
  SEO = 'SEOAgent',
  Ops = 'OpsAgent',
  Commerce = 'CommerceAgent',
  Community = 'CommunityAgent',
}

export interface AgentResponse {
  id: string;
  status: string;
  message: string;
  data?: any;
}

export class CloudFlairAgent {
  protected agentId: string;
  protected apiKey: string;
  protected baseUrl: string;
  
  constructor(agentType: AgentType, apiKey: string, baseUrl = 'https://api.cloudflair.com') {
    this.agentId = agentType;
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
  }
  
  protected signRequest(body: string, timestamp: string): string {
    const message = \`\${this.agentId}:\${timestamp}:\${body}\`;
    return createHmac('sha256', this.apiKey).update(message).digest('hex');
  }
  
  protected async makeRequest(endpoint: string, data: any): Promise<AgentResponse> {
    const url = \`\${this.baseUrl}/agent\${endpoint}\`;
    const body = JSON.stringify(data);
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = this.signRequest(body, timestamp);
    
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Agent-Id': this.agentId,
          'X-Timestamp': timestamp,
          'X-Signature': signature,
        },
        body,
      });
      
      const result = await response.json();
      return {
        id: result.id || '',
        status: result.status || 'error',
        message: result.message || '',
        data: result,
      };
    } catch (error) {
      return {
        id: '',
        status: 'error',
        message: error.message,
      };
    }
  }
}

export class ContentAgent extends CloudFlairAgent {
  constructor(apiKey: string, baseUrl?: string) {
    super(AgentType.Content, apiKey, baseUrl);
  }
  
  async proposeContent(path: string, markdown: string, reason: string, metadata?: any): Promise<AgentResponse> {
    return this.makeRequest('/proposals/content', {
      path,
      markdown,
      reason,
      metadata: metadata || {},
    });
  }
}

export class SEOAgent extends CloudFlairAgent {
  constructor(apiKey: string, baseUrl?: string) {
    super(AgentType.SEO, apiKey, baseUrl);
  }
  
  async runAudit(urls?: string[]): Promise<AgentResponse> {
    return this.makeRequest('/seo/audit', {
      urls: urls || [],
      fullSite: !urls,
    });
  }
}

export class OpsAgent extends CloudFlairAgent {
  constructor(apiKey: string, baseUrl?: string) {
    super(AgentType.Ops, apiKey, baseUrl);
  }
  
  async queueTask(type: string, payload: any, priority = 5): Promise<AgentResponse> {
    return this.makeRequest('/tasks', {
      type,
      payload,
      priority,
    });
  }
}
`;
    
    writeFileSync(join(clientPath, 'index.ts'), nodeClient);
    console.log('✓ Generated Node.js client');
    
    // Generate package.json
    const packageJson = {
      name: '@cloudflair/agent-client',
      version: '1.0.0',
      type: 'module',
      main: 'index.js',
      types: 'index.d.ts',
      scripts: {
        build: 'tsc',
      },
      dependencies: {
        'node-fetch': '^3.3.2',
      },
      devDependencies: {
        '@types/node': '^20.11.17',
        'typescript': '^5.3.3',
      },
    };
    
    writeFileSync(join(clientPath, 'package.json'), JSON.stringify(packageJson, null, 2));
  }
  
  run() {
    console.log('🚀 Integrating CloudFlair with Agent Template Package');
    console.log(`Template path: ${AGENT_TEMPLATE_PATH}`);
    console.log(`CloudFlair path: ${CLOUDFLAIR_PATH}`);
    
    this.generatePythonClient();
    this.generateNodeClient();
    
    console.log('\\n✅ Integration complete!');
    console.log('\\nNext steps:');
    console.log('1. Install Python client: cd agents/python && pip install -r requirements.txt');
    console.log('2. Install Node client: cd agents/node && npm install');
    console.log('3. Set environment variables for agent API keys');
    console.log('4. Run example agents to test integration');
  }
}

// Run integration
const integrator = new AgentIntegrator();
integrator.run();
