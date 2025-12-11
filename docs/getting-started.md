# Getting Started with DirectGTD MCP Server

## What is DirectGTD MCP Server?

DirectGTD MCP Server is a specialized integration that allows AI assistants like Claude to access your DirectGTD task management database. It provides read-only access to your tasks, projects, and to-do items, enabling you to query and interact with your task data using natural language.

### Key Features

- **Read-Only Access**: Your data is safe - the server never modifies your DirectGTD database
- **Natural Language Queries**: Ask about your tasks in plain English
- **Flexible Output**: Get responses in human-readable Markdown or machine-readable JSON
- **Root Items Focus**: Retrieve top-level tasks and projects (items with no parent)
- **Error Handling**: Clear, actionable error messages when something goes wrong
- **Character Limits**: Automatic truncation prevents overwhelming responses

## What is MCP (Model Context Protocol)?

MCP (Model Context Protocol) is a standardized protocol that allows AI assistants to interact with external data sources and tools. Think of it as a bridge between your AI assistant and your applications.

**How it works:**
1. You install an MCP server (like DirectGTD MCP Server)
2. You configure your AI assistant (like Claude Code or Claude Desktop) to use the server
3. The AI can now query your data and use tools provided by the server
4. You interact with your data using natural language

## Prerequisites

Before installing DirectGTD MCP Server, ensure you have:

### Required

1. **DirectGTD Application**: You must have DirectGTD installed and have created at least one task
   - The DirectGTD database should exist at: `~/Library/Application Support/DirectGTD/directgtd.sqlite`

2. **Node.js**: Version 18 or higher
   - Check your version: `node --version`
   - Download from: [nodejs.org](https://nodejs.org/)

3. **An MCP-Compatible AI Assistant**: Either:
   - Claude Code (recommended for developers)
   - Claude Desktop (recommended for general users)

### Optional

- **npm**: Comes with Node.js, used for installing dependencies
- **Git**: For cloning the repository (if installing from source)
- **TypeScript knowledge**: Only needed if you plan to modify or contribute to the server

## Quick Start Guide

Follow these steps to get up and running quickly:

### Step 1: Install the Server

```bash
# Navigate to the project directory
cd /path/to/directmcp

# Install dependencies
npm install

# Build the server
npm run build
```

### Step 2: Configure Your AI Assistant

**For Claude Code:**
```bash
claude mcp add --transport stdio directgtd -- node /path/to/directmcp/dist/index.js
```

**For Claude Desktop:**
Add to your `claude_desktop_config.json`:
```json
{
  "mcpServers": {
    "directgtd": {
      "type": "stdio",
      "command": "node",
      "args": ["/path/to/directmcp/dist/index.js"],
      "env": {}
    }
  }
}
```

### Step 3: Try It Out

Open your AI assistant and try:

```
Show me all my root tasks in DirectGTD
```

or

```
What are my top-level projects?
```

## What's Next?

- **[Installation Guide](./installation.md)**: Detailed installation instructions for different setups
- **[Usage Guide](./usage.md)**: Learn how to make the most of DirectGTD MCP Server
- **[API Reference](./api-reference.md)**: Understand the available tools and their parameters
- **[Troubleshooting](./troubleshooting.md)**: Solutions to common problems

## Understanding Root Items

**What are root items?**

In DirectGTD, a "root item" is any task or project that has no parent. These are your top-level organizational units:

- **Projects**: Large goals or areas of focus
- **Standalone Tasks**: Individual to-do items not nested under a project
- **Categories**: Top-level organizational containers

**Why only root items?**

Version 1.0.0 of DirectGTD MCP Server focuses on root items to:
- Provide a simple, focused starting point
- Avoid overwhelming responses with entire task hierarchies
- Maintain performance and responsiveness
- Allow you to see your high-level organization at a glance

Future versions may add support for retrieving child items and full hierarchies.

## Safety and Privacy

### Read-Only Access

DirectGTD MCP Server opens your database in **read-only mode**. This means:

- The server cannot modify, delete, or create tasks
- Your data is protected from accidental changes
- You can use the server with confidence

### Local Access Only

- All data stays on your machine
- No data is sent to external servers
- The MCP server runs locally on your computer
- Communication happens via standard input/output (stdio)

### Database Location

The server accesses your DirectGTD database at:
```
~/Library/Application Support/DirectGTD/directgtd.sqlite
```

Make sure this file exists and is readable by your user account.

## Next Steps

Now that you understand the basics, proceed to the [Installation Guide](./installation.md) for detailed setup instructions.
