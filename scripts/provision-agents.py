#!/usr/bin/env python3
"""
CloudFlair Agent Provisioning Script
Integrates agents from the Agent Template Package
"""

import os
import sys
import yaml
import json
import shutil
from pathlib import Path
from typing import Dict, List, Any

# Paths
CLOUDFLAIR_ROOT = Path(__file__).parent.parent
AGENT_TEMPLATE_PATH = Path(r"C:\Users\Mrdru\OneDrive\Documents\Projects\AI_Projects\AGENT_TEMPLATE_PACKAGE")
AGENTS_CONFIG = CLOUDFLAIR_ROOT / "agents.config.yaml"

class AgentProvisioner:
    def __init__(self):
        self.cloudflair_config = self.load_cloudflair_config()
        self.template_agents = self.discover_template_agents()
        
    def load_cloudflair_config(self) -> Dict[str, Any]:
        """Load CloudFlair agent configuration"""
        with open(AGENTS_CONFIG, 'r') as f:
            return yaml.safe_load(f)
    
    def discover_template_agents(self) -> List[Dict[str, Any]]:
        """Discover available agents from template package"""
        agents = []
        agents_dir = AGENT_TEMPLATE_PATH / "agents"
        
        if not agents_dir.exists():
            print(f"❌ Agent Template Package not found at {AGENT_TEMPLATE_PATH}")
            sys.exit(1)
        
        # Map template agents to CloudFlair agents
        agent_mapping = {
            "content.agent.yaml": "ContentAgent",
            "security.agent.yaml": "SecurityAgent",
            "ops.agent.yaml": "OpsAgent",
            "finance.agent.yaml": "FinanceAgent",
            "marketing.agent.yaml": "MarketingAgent",
            "sales.agent.yaml": "SalesAgent",
            "cs.agent.yaml": "CommunityAgent",
        }
        
        for template_file, cloudflair_name in agent_mapping.items():
            agent_path = agents_dir / template_file
            if agent_path.exists():
                with open(agent_path, 'r') as f:
                    agent_config = yaml.safe_load(f)
                    agents.append({
                        "template_name": template_file.replace(".agent.yaml", ""),
                        "cloudflair_name": cloudflair_name,
                        "config": agent_config,
                        "path": agent_path,
                    })
                    print(f"✓ Found template agent: {template_file}")
        
        return agents
    
    def generate_playbook_adapters(self):
        """Generate adapters to use template playbooks in CloudFlair"""
        adapters_dir = CLOUDFLAIR_ROOT / "agents" / "playbook-adapters"
        adapters_dir.mkdir(parents=True, exist_ok=True)
        
        print("\n📚 Generating playbook adapters...")
        
        # Map playbook directories
        playbooks_dir = AGENT_TEMPLATE_PATH / "playbooks" / "individual"
        
        for agent in self.template_agents:
            agent_playbooks_dir = playbooks_dir / agent["template_name"]
            if not agent_playbooks_dir.exists():
                continue
            
            # Count available playbooks
            playbook_files = list(agent_playbooks_dir.glob("*.yaml"))
            print(f"  {agent['cloudflair_name']}: {len(playbook_files)} playbooks available")
            
            # Generate adapter
            adapter_content = self.generate_adapter_code(agent, playbook_files)
            adapter_path = adapters_dir / f"{agent['cloudflair_name'].lower()}_adapter.py"
            
            with open(adapter_path, 'w') as f:
                f.write(adapter_content)
    
    def generate_adapter_code(self, agent: Dict, playbooks: List[Path]) -> str:
        """Generate Python adapter code for an agent"""
        return f'''"""
Playbook Adapter for {agent['cloudflair_name']}
Auto-generated from Agent Template Package
"""

import os
import sys
import yaml
from pathlib import Path
from typing import Dict, Any, Optional

# Add template package to path
sys.path.insert(0, r"{AGENT_TEMPLATE_PATH}")

from service.playbook_engine import PlaybookEngine
from service.agent_runtime import AgentRuntime

class {agent['cloudflair_name']}Adapter:
    """Adapter to execute {agent['template_name']} playbooks via CloudFlair"""
    
    def __init__(self, api_key: str):
        self.api_key = api_key
        self.agent_name = "{agent['cloudflair_name']}"
        self.template_path = Path(r"{agent['path'].parent}")
        self.playbook_engine = PlaybookEngine()
        
        # Load agent configuration
        with open(r"{agent['path']}", 'r') as f:
            self.agent_config = yaml.safe_load(f)
        
        # Initialize runtime
        self.runtime = AgentRuntime(self.agent_config)
    
    def list_playbooks(self) -> list:
        """List available playbooks for this agent"""
        playbooks = []
        playbook_dir = self.template_path / "playbooks" / "individual" / "{agent['template_name']}"
        
        if playbook_dir.exists():
            for pb_file in playbook_dir.glob("*.yaml"):
                with open(pb_file, 'r') as f:
                    pb_data = yaml.safe_load(f)
                    playbooks.append({{
                        "id": pb_data.get("id"),
                        "name": pb_data.get("name"),
                        "description": pb_data.get("description"),
                        "file": pb_file.name,
                    }})
        
        return playbooks
    
    def execute_playbook(self, playbook_id: str, context: Dict[str, Any]) -> Dict[str, Any]:
        """Execute a specific playbook"""
        # Find playbook file
        playbook_dir = self.template_path / "playbooks" / "individual" / "{agent['template_name']}"
        
        for pb_file in playbook_dir.glob("*.yaml"):
            with open(pb_file, 'r') as f:
                pb_data = yaml.safe_load(f)
                if pb_data.get("id") == playbook_id:
                    # Execute via engine
                    result = self.playbook_engine.execute(pb_data, context)
                    
                    # Send result to CloudFlair
                    self._sync_to_cloudflair(playbook_id, result)
                    
                    return result
        
        raise ValueError(f"Playbook {{playbook_id}} not found")
    
    def _sync_to_cloudflair(self, playbook_id: str, result: Dict[str, Any]):
        """Sync playbook execution results to CloudFlair API"""
        import requests
        import time
        import hmac
        import hashlib
        import json
        
        # Prepare request
        url = "https://api.cloudflair.com/agent/tasks"
        body = json.dumps({{
            "type": "playbook_execution",
            "payload": {{
                "playbook_id": playbook_id,
                "result": result,
                "agent": self.agent_name,
            }}
        }})
        
        timestamp = str(int(time.time()))
        message = f"{{self.agent_name}}:{{timestamp}}:{{body}}"
        signature = hmac.new(
            self.api_key.encode(),
            message.encode(),
            hashlib.sha256
        ).hexdigest()
        
        headers = {{
            "Content-Type": "application/json",
            "X-Agent-Id": self.agent_name,
            "X-Timestamp": timestamp,
            "X-Signature": signature,
        }}
        
        try:
            response = requests.post(url, data=body, headers=headers)
            response.raise_for_status()
            print(f"✓ Synced to CloudFlair: {{response.json()}}")
        except Exception as e:
            print(f"⚠️ Failed to sync to CloudFlair: {{e}}")

# Available playbooks for this agent
AVAILABLE_PLAYBOOKS = {len(playbooks)}
'''
    
    def generate_integration_docs(self):
        """Generate documentation for the integration"""
        docs_content = f"""# CloudFlair - Agent Template Integration

## Overview
This document describes the integration between CloudFlair and the Agent Template Package.

## Integrated Agents
Total agents integrated: {len(self.template_agents)}

### Agent Mapping
| Template Agent | CloudFlair Agent | Capabilities | Playbooks |
|---------------|------------------|--------------|-----------|
"""
        
        playbooks_dir = AGENT_TEMPLATE_PATH / "playbooks" / "individual"
        
        for agent in self.template_agents:
            agent_playbooks_dir = playbooks_dir / agent["template_name"]
            playbook_count = len(list(agent_playbooks_dir.glob("*.yaml"))) if agent_playbooks_dir.exists() else 0
            
            capabilities = agent["config"].get("capabilities", {})
            cap_count = sum(len(v) for v in capabilities.values() if isinstance(v, list))
            
            docs_content += f"| {agent['template_name']} | {agent['cloudflair_name']} | {cap_count} | {playbook_count} |\n"
        
        docs_content += f"""

## Agent Template Package Location
```
{AGENT_TEMPLATE_PATH}
```

## Using Playbooks

### Python Example
```python
from agents.playbook_adapters.content_adapter import ContentAgentAdapter

# Initialize adapter
adapter = ContentAgentAdapter(api_key="your-key")

# List available playbooks
playbooks = adapter.list_playbooks()
print(f"Available playbooks: {{len(playbooks)}}")

# Execute a playbook
result = adapter.execute_playbook(
    playbook_id="content_blog_post",
    context={{"topic": "AI Agents", "tone": "professional"}}
)
```

### Direct API Call
```python
import requests
import hmac
import hashlib
import time
import json

def execute_playbook_via_api(agent_id, api_key, playbook_id, context):
    url = "https://api.cloudflair.com/agent/tasks"
    body = json.dumps({{
        "type": "playbook_execution",
        "payload": {{
            "playbook_id": playbook_id,
            "context": context
        }}
    }})
    
    timestamp = str(int(time.time()))
    message = f"{{agent_id}}:{{timestamp}}:{{body}}"
    signature = hmac.new(api_key.encode(), message.encode(), hashlib.sha256).hexdigest()
    
    response = requests.post(
        url,
        data=body,
        headers={{
            "Content-Type": "application/json",
            "X-Agent-Id": agent_id,
            "X-Timestamp": timestamp,
            "X-Signature": signature
        }}
    )
    
    return response.json()
```

## Available Capabilities

### ContentAgent
- Content generation with multi-LLM support
- Quality scoring and refinement
- SEO optimization
- Brand compliance checking

### SEOAgent  
- Technical SEO audits
- Lighthouse performance testing
- Schema markup validation
- Link analysis

### OpsAgent
- System monitoring
- Alert triage
- Performance optimization
- Report generation

### CommerceAgent
- Payment processing
- Subscription management
- Revenue analytics
- Failed payment recovery

### CommunityAgent
- Newsletter management
- Event coordination
- Community engagement
- Feedback collection

## Security

All agent communications use HMAC-SHA256 authentication:
1. Each agent has a unique API key
2. Requests are signed with timestamp
3. Risk-based approval for sensitive operations
4. Full audit trail in D1 database

## Monitoring

Agent activity is tracked via:
- `/metrics` endpoint for Prometheus
- Daily executive reports
- Real-time dashboard at `/admin`
- Audit logs in `agent_changes` table

## Troubleshooting

### Common Issues

1. **Playbook not found**: Ensure the Agent Template Package is at the correct path
2. **Authentication failures**: Verify API keys match between CloudFlair and agents
3. **Missing dependencies**: Run `pip install -r requirements.txt` in template package
4. **Permission errors**: Ensure read access to template package directory

### Debug Mode

Enable debug logging:
```python
import logging
logging.basicConfig(level=logging.DEBUG)
```

## Next Steps

1. Review generated playbook adapters in `agents/playbook-adapters/`
2. Test agent integrations with example playbooks
3. Configure agent-specific settings in `agents.config.yaml`
4. Deploy agents to production
"""
        
        docs_path = CLOUDFLAIR_ROOT / "docs" / "agent-integration.md"
        docs_path.parent.mkdir(exist_ok=True)
        
        with open(docs_path, 'w') as f:
            f.write(docs_content)
        
        print(f"\n📝 Documentation generated: {docs_path}")
    
    def run(self):
        """Run the provisioning process"""
        print("=" * 60)
        print("CloudFlair Agent Provisioning")
        print("=" * 60)
        
        print(f"\n📁 CloudFlair root: {CLOUDFLAIR_ROOT}")
        print(f"📦 Template package: {AGENT_TEMPLATE_PATH}")
        
        if not AGENT_TEMPLATE_PATH.exists():
            print(f"\n❌ Agent Template Package not found at:")
            print(f"   {AGENT_TEMPLATE_PATH}")
            print("\n💡 Please ensure the package is at the correct location")
            sys.exit(1)
        
        print(f"\n✅ Found {len(self.template_agents)} compatible agents")
        
        # Generate playbook adapters
        self.generate_playbook_adapters()
        
        # Generate integration documentation
        self.generate_integration_docs()
        
        print("\n" + "=" * 60)
        print("✅ Agent provisioning complete!")
        print("\nNext steps:")
        print("1. Review generated adapters in agents/playbook-adapters/")
        print("2. Read integration guide at docs/agent-integration.md")
        print("3. Test agents with: python agents/python/test_agents.py")
        print("4. Configure production API keys in Wrangler")

if __name__ == "__main__":
    provisioner = AgentProvisioner()
    provisioner.run()
