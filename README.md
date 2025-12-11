# DirectGTD MCP Server

MCP (Model Context Protocol) server for DirectGTD task management integration. This server provides read-only access to the DirectGTD SQLite database, allowing LLMs to query and retrieve task information.

## Features

- **Read-only access** to DirectGTD database
- **Two tools** for navigating your task hierarchy:
  - `directgtd_get_root_items` - retrieves all top-level folders/projects
  - `directgtd_get_children` - retrieves items within a specific folder/project
- **Dual response formats**: JSON (machine-readable) and Markdown (human-readable)
- **Proper error handling** for database issues
- **Character limits** to prevent overwhelming responses

## Installation

```bash
npm install
npm run build
```

## Usage

### With Claude Code

Add the server to Claude Code:

```bash
claude mcp add --transport stdio directgtd -- node /Users/behroozkarjoo/dev/directmcp/dist/index.js
```

Then use it in Claude Code:

```
Show me all my root tasks in DirectGTD
```

### With Claude Desktop

Add to your `claude_desktop_config.json`:

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

## Available Tools

### `directgtd_get_root_items`

Retrieves all root-level items from the DirectGTD database (items with no parent).

**Parameters:**
- `response_format` (optional): `"markdown"` or `"json"` (default: `"markdown"`)

**Example:**
```
Show me all my root tasks in DirectGTD
```

### `directgtd_get_children`

Retrieves all child items of a specific parent folder or project.

**Parameters:**
- `parent_id` (required): UUID of the parent item
- `response_format` (optional): `"markdown"` or `"json"` (default: `"markdown"`)

**Example:**
```
Show me what's inside my Home folder
```

**Response Format (JSON):**
```json
{
  "total": 5,
  "items": [
    {
      "id": "item-123",
      "title": "My Project",
      "parentId": null,
      "sortOrder": 0,
      "createdAt": "2024-01-15T10:30:00Z",
      "modifiedAt": "2024-01-15T10:30:00Z",
      "completedAt": null,
      "dueDate": null,
      "earliestStartTime": null
    }
  ]
}
```

For Markdown format: Human-readable formatted text with item details.

## Documentation

**📚 [Complete Documentation](./docs/README.md)**

For developers integrating this server:
- **[Developer API Guide](./docs/developer-api-guide.md)** - Complete API reference with code examples

## Database

The server connects to the DirectGTD SQLite database at:
```
~/Library/Containers/com.zendegi.DirectGTD/Data/Library/Application Support/DirectGTD/directgtd.sqlite
```

**Note:** DirectGTD uses macOS sandbox containers.

**Important**: The database is accessed in read-only mode. The server never modifies the database.

## Development

### Build

```bash
npm run build
```

### Development Mode

```bash
npm run dev
```

### Run Tests

```bash
npm run build
npm test
```

### Clean

```bash
npm run clean
```

## Testing Requirements

The test suite verifies:
- ✅ Database connection and existence
- ✅ Returns items when database has root items
- ✅ Returns empty array when no root items exist
- ✅ Items are sorted by sort_order
- ✅ All returned items have null parentId
- ✅ Database schema has expected columns

## Architecture

- **TypeScript** with strict type checking
- **MCP SDK** for protocol compliance
- **better-sqlite3** for database access
- **Zod** for runtime input validation
- **Proper error handling** with user-friendly messages
- **Character limits** (25,000 chars) with graceful truncation

## Error Handling

The server provides clear, actionable error messages:

- `Error: Database not found` - DirectGTD database doesn't exist
- `Error: Cannot open database` - File permissions issue
- `Error: Database file is corrupted` - Database integrity issue
- `No root items found` - Database has no root-level items

## License

MIT

## Note

This server is under active development. The DirectGTD database schema may change, and this server will be updated accordingly.
