# DirectGTD MCP Server

An MCP (Model Context Protocol) server that enables LLMs to interact with DirectGTD, a GTD (Getting Things Done) task management system for macOS.

## Overview

This server provides 40+ tools for managing tasks, projects, tags, time tracking, and more through the MCP protocol. It integrates with DirectGTD and supports CloudKit sync compliance.

## Important: Do Not Modify SQLite Directly

**Never directly read from or write to the DirectGTD SQLite database.** All interactions must go through the API layer provided by this MCP server.

Direct database access bypasses critical sync logic and can cause:
- CloudKit sync failures
- Data corruption
- Lost changes on other devices

## Requirements

- **macOS** (DirectGTD is a macOS/iOS app)
- **Node.js** 18+
- **DirectGTD app** installed with an existing database

## Installation

### 1. Clone the repository

```bash
git clone https://github.com/bkarjoo/dmcp.git
cd dmcp
```

### 2. Install dependencies

```bash
npm install
```

### 3. Build the server

```bash
npm run build
```

## Configuration

### For Claude Code

Add the server using the CLI:

```bash
claude mcp add --transport stdio directgtd -- node /path/to/dmcp/dist/index.js
```

Or add to your `~/.claude.json` manually:

```json
{
  "mcpServers": {
    "directgtd": {
      "type": "stdio",
      "command": "node",
      "args": ["/path/to/dmcp/dist/index.js"]
    }
  }
}
```

### For Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "directgtd": {
      "type": "stdio",
      "command": "node",
      "args": ["/path/to/dmcp/dist/index.js"]
    }
  }
}
```

### Project-Level Configuration

Create `.mcp.json` in your project root:

```json
{
  "mcpServers": {
    "directgtd": {
      "type": "stdio",
      "command": "node",
      "args": ["${HOME}/dev/dmcp/dist/index.js"]
    }
  }
}
```

## Available Tools

### Dashboard & Views

| Tool | Description |
|------|-------------|
| `directgtd_get_dashboard` | Get actionable items: Next actions, urgent, and overdue |
| `directgtd_get_available_tasks` | Get tasks ready to work on (GTD "Next Actions") |
| `directgtd_get_stuck_projects` | Find projects without defined next actions |

### Item Management

| Tool | Description |
|------|-------------|
| `directgtd_add_to_inbox` | Quick capture to inbox |
| `directgtd_create_item` | Create item in specific folder/project |
| `directgtd_create_root_item` | Create root-level folder/project |
| `directgtd_get_item` | Get item details by ID |
| `directgtd_get_children` | Get children of a folder/project |
| `directgtd_get_root_items` | Get all root-level items |
| `directgtd_search_items` | Search items by title |
| `directgtd_update_title` | Update item title |
| `directgtd_update_notes` | Update item notes (Markdown supported) |
| `directgtd_change_item_type` | Change item type (Task, Note, Project, Folder) |
| `directgtd_move_item` | Move item to different parent |
| `directgtd_archive_item` | Move item to archive |
| `directgtd_delete_item` | Move item to trash |
| `directgtd_complete_task` | Mark task as completed |
| `directgtd_complete_multiple_tasks` | Bulk complete tasks |

### Due Dates & Scheduling

| Tool | Description |
|------|-------------|
| `directgtd_update_due_date` | Set or clear due date |
| `directgtd_update_earliest_start_time` | Defer task to future date |
| `directgtd_get_due_today` | Get items due today |
| `directgtd_get_due_tomorrow` | Get items due tomorrow |
| `directgtd_get_due_this_week` | Get items due this week |
| `directgtd_get_overdue_items` | Get overdue items |
| `directgtd_get_deferred_tasks` | Get deferred/tickler items |
| `directgtd_get_completed_tasks` | Get completed tasks |
| `directgtd_get_oldest_tasks` | Find neglected tasks |

### Tags

| Tool | Description |
|------|-------------|
| `directgtd_get_all_tags` | List all available tags |
| `directgtd_create_tag` | Create a new tag |
| `directgtd_rename_tag` | Rename a tag |
| `directgtd_delete_tag` | Delete a tag |
| `directgtd_add_tag_to_item` | Apply tag to item |
| `directgtd_remove_tag_from_item` | Remove tag from item |
| `directgtd_get_item_tags` | Get tags on an item |
| `directgtd_get_items_by_tag_names` | Find items with specific tags |
| `directgtd_get_items_by_tag_ids` | Find items by tag IDs |

### Ordering & Organization

| Tool | Description |
|------|-------------|
| `directgtd_swap_items` | Swap position of two items |
| `directgtd_move_to_position` | Move item to specific position |
| `directgtd_reorder_children` | Reorder all children of a parent |
| `directgtd_get_node_tree` | Get hierarchical tree structure |

### Time Tracking

| Tool | Description |
|------|-------------|
| `directgtd_start_timer` | Start timing a task |
| `directgtd_stop_timer` | Stop active timer |
| `directgtd_get_active_timers` | Get currently running timers |
| `directgtd_get_time_entries` | Get time log for an item |
| `directgtd_get_total_time` | Get total time spent on item |
| `directgtd_update_start_time` | Adjust timer start time |
| `directgtd_update_end_time` | Adjust timer end time |

### Templates

| Tool | Description |
|------|-------------|
| `directgtd_instantiate_template` | Create instance from template |

### Maintenance

| Tool | Description |
|------|-------------|
| `directgtd_empty_trash` | Permanently delete trashed items |

## Response Formats

Most tools support two response formats via the `response_format` parameter:

- **`markdown`** (default): Human-readable formatted text
- **`json`**: Machine-readable structured data

## CloudKit Sync

This server follows DirectGTD's data policy for CloudKit sync:

- All write operations set `needs_push = 1` for sync
- Soft deletes use `deleted_at` timestamp
- Timestamps (`created_at`, `modified_at`) are properly maintained

Changes made via MCP will sync to other devices through CloudKit.

## Database Location

The server reads from:
```
~/Library/Application Support/DirectGTD/directgtd.sqlite
```

## Examples

### Get your dashboard
```
"What should I work on today?"
→ Uses directgtd_get_dashboard
```

### Quick capture
```
"Add 'Buy groceries' to inbox"
→ Uses directgtd_add_to_inbox
```

### Find by context
```
"What @home tasks do I have?"
→ Uses directgtd_get_items_by_tag_names with ["@home"]
```

### Complete a task
```
"Mark 'Buy groceries' as done"
→ Uses directgtd_search_items then directgtd_complete_task
```

## Development

### Build
```bash
npm run build
```

### Watch mode
```bash
npm run dev
```

## License

MIT

## Related

- [DirectGTD](https://directgtd.com) - The GTD app this server integrates with
- [Model Context Protocol](https://modelcontextprotocol.io) - The protocol specification
