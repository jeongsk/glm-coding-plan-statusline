---
description: Configure GLM Coding Plan status line
allowed-tools: Read, Write, Bash
---

# GLM Coding Plan Statusline Setup

Configure the GLM Coding Plan status line for Z.ai or Zhipu AI platforms.

## Prerequisites

```bash
export ANTHROPIC_AUTH_TOKEN="your-token"
export ANTHROPIC_BASE_URL="https://api.z.ai/api/anthropic"
# or
export ANTHROPIC_BASE_URL="https://open.bigmodel.cn/api/anthropic"
```

## Installation

Add to `~/.claude/settings.json`:

```json
{
  "statusLine": {
    "type": "command",
    "command": "node ~/.claude/plugins/marketplaces/glm-coding-plan-statusline/dist/index.js"
  }
}
```
