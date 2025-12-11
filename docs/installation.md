# Installation Guide

This guide walks you through installing and configuring DirectGTD MCP Server for use with Claude Code or Claude Desktop.

## System Requirements

### Operating System
- **macOS**: Tested and supported (DirectGTD database location is macOS-specific)
- **Linux**: May work with path adjustments
- **Windows**: Not currently supported (database path is hardcoded for macOS)

### Software Requirements

| Software | Minimum Version | Check Command | Download |
|----------|----------------|---------------|----------|
| Node.js  | 18.0.0 or higher | `node --version` | [nodejs.org](https://nodejs.org/) |
| npm      | Comes with Node.js | `npm --version` | Included with Node.js |
| DirectGTD | Any version | Check Applications folder | From DirectGTD vendor |

### DirectGTD Database

The server requires a valid DirectGTD database at:
```
~/Library/Application Support/DirectGTD/directgtd.sqlite
```

**To verify your database exists:**
```bash
ls -l ~/Library/Application\ Support/DirectGTD/directgtd.sqlite
```

If the file doesn't exist, launch DirectGTD and create at least one task to initialize the database.

## Installation Steps

### 1. Download the Project

If you have the project already, skip to step 2. Otherwise:

```bash
# Navigate to your preferred directory
cd ~/dev

# If cloning from a repository:
git clone <repository-url> directmcp
cd directmcp
```

### 2. Install Dependencies

```bash
# Install all required npm packages
npm install
```

This installs:
- `@modelcontextprotocol/sdk` - MCP protocol implementation
- `better-sqlite3` - SQLite database driver
- `zod` - Input validation library
- TypeScript and related development tools

### 3. Build the Server

```bash
# Compile TypeScript to JavaScript
npm run build
```

This creates the compiled server in the `dist/` directory.

**Verify the build:**
```bash
# Check that the compiled file exists
ls -l dist/index.js
```

### 4. Test the Installation

```bash
# Run the test suite
npm test
```

Expected output:
```
✅ DirectGTD database exists
✅ get_root_items returns items when database has root items
✅ get_root_items returns empty array when no root items exist
✅ get_root_items returns items sorted by sort_order
✅ get_root_items ensures parentId is null for all returned items
✅ database schema has expected columns
```

If all tests pass, your installation is successful!

## Configuration

Now that the server is installed, you need to configure your AI assistant to use it.

### Option 1: Claude Code (Recommended for Developers)

#### Add the MCP Server

```bash
claude mcp add --transport stdio directgtd -- node /Users/behroozkarjoo/dev/directmcp/dist/index.js
```

**Important**: Replace `/Users/behroozkarjoo/dev/directmcp` with your actual installation path.

#### Verify Configuration

```bash
# List configured MCP servers
claude mcp list
```

You should see `directgtd` in the list.

#### Test in Claude Code

Open Claude Code and try:
```
Show me all my root tasks in DirectGTD
```

### Option 2: Claude Desktop (Recommended for General Users)

#### Locate Configuration File

The Claude Desktop configuration file is located at:
```
~/Library/Application Support/Claude/claude_desktop_config.json
```

#### Edit Configuration

Open the file in your text editor:
```bash
# Using nano
nano ~/Library/Application\ Support/Claude/claude_desktop_config.json

# Using VS Code
code ~/Library/Application\ Support/Claude/claude_desktop_config.json

# Using any text editor
open -a TextEdit ~/Library/Application\ Support/Claude/claude_desktop_config.json
```

#### Add Server Configuration

Add or modify the `mcpServers` section:

```json
{
  "mcpServers": {
    "directgtd": {
      "type": "stdio",
      "command": "node",
      "args": ["/Users/behroozkarjoo/dev/directmcp/dist/index.js"],
      "env": {}
    }
  }
}
```

**Important**: Replace `/Users/behroozkarjoo/dev/directmcp` with your actual installation path.

**If you have existing MCP servers**, your configuration might look like:
```json
{
  "mcpServers": {
    "existing-server": {
      "type": "stdio",
      "command": "node",
      "args": ["/path/to/other/server.js"]
    },
    "directgtd": {
      "type": "stdio",
      "command": "node",
      "args": ["/Users/behroozkarjoo/dev/directmcp/dist/index.js"],
      "env": {}
    }
  }
}
```

#### Restart Claude Desktop

Close and reopen Claude Desktop for the configuration to take effect.

#### Test in Claude Desktop

Open Claude Desktop and try:
```
Show me all my root tasks in DirectGTD
```

## Verifying Installation

### 1. Check Server Logs

When running via stdio (standard mode), the server logs to stderr:
```
DirectGTD MCP server running via stdio
```

### 2. Test Database Access

Try asking Claude:
```
List my DirectGTD root items
```

Expected behavior:
- If you have tasks: Returns a list of your root-level items
- If you have no tasks: Returns "No root items found in DirectGTD database."
- If database doesn't exist: Returns error message with path

### 3. Verify Response Format

Test both output formats:

**Markdown format (default):**
```
Show me my DirectGTD tasks
```

**JSON format:**
```
Show me my DirectGTD tasks in JSON format
```

## Troubleshooting Installation

### "Database not found" Error

**Problem**: The server can't find your DirectGTD database.

**Solution**:
```bash
# Check if database exists
ls -l ~/Library/Application\ Support/DirectGTD/directgtd.sqlite

# If it doesn't exist:
# 1. Launch DirectGTD application
# 2. Create at least one task
# 3. Try again
```

### "Cannot open database" Error

**Problem**: File permissions prevent reading the database.

**Solution**:
```bash
# Check file permissions
ls -l ~/Library/Application\ Support/DirectGTD/directgtd.sqlite

# Fix permissions if needed
chmod 644 ~/Library/Application\ Support/DirectGTD/directgtd.sqlite
```

### Build Errors

**Problem**: `npm run build` fails.

**Solution**:
```bash
# Clean and rebuild
npm run clean
npm install
npm run build
```

### Node Version Issues

**Problem**: "Node version not supported" error.

**Solution**:
```bash
# Check your Node version
node --version

# If less than v18, update Node.js:
# Visit https://nodejs.org/ and install the latest LTS version
```

### MCP Server Not Appearing in Claude

**Problem**: Claude doesn't recognize the server.

**Solution**:

For Claude Code:
```bash
# Remove and re-add the server
claude mcp remove directgtd
claude mcp add --transport stdio directgtd -- node /path/to/dist/index.js
```

For Claude Desktop:
1. Double-check the JSON syntax in `claude_desktop_config.json`
2. Ensure the path to `dist/index.js` is absolute and correct
3. Restart Claude Desktop completely (quit and reopen)

## Updating the Server

When a new version is released:

```bash
# Navigate to the project directory
cd /path/to/directmcp

# Pull latest changes (if from git)
git pull

# Reinstall dependencies
npm install

# Rebuild
npm run build

# Run tests
npm test
```

No configuration changes are needed unless specified in the release notes.

## Uninstallation

### Remove from Claude Code

```bash
claude mcp remove directgtd
```

### Remove from Claude Desktop

Edit `~/Library/Application Support/Claude/claude_desktop_config.json` and remove the `directgtd` entry from `mcpServers`.

### Delete the Server

```bash
# Navigate to the project directory and delete it
cd ~/dev
rm -rf directmcp
```

## Next Steps

- **[Usage Guide](./usage.md)**: Learn how to use the server effectively
- **[API Reference](./api-reference.md)**: Detailed tool documentation
- **[Troubleshooting](./troubleshooting.md)**: Solutions to common problems
