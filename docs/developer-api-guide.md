# DirectGTD MCP Server - Developer API Guide

**Version:** 2.7.0
**Protocol:** Model Context Protocol (MCP)
**Transport:** stdio

## Overview

The DirectGTD MCP Server provides programmatic access to DirectGTD task management data through the Model Context Protocol. This guide is for developers integrating DirectGTD data into their applications via MCP-compatible clients.

## Philosophy: Flexible Item Types

DirectGTD embraces a **flexible type system** where items can freely transform between different types. This philosophy recognizes that information evolves:

- **Tasks** can become **reference items** once completed
- **Notes** can transform into **Tasks** when action is required
- **Templates** are simply items of any type that you copy from
- **Projects** can become **Folders** for organization
- Any item can become any type, instantly

This fluidity mirrors how we actually work - a meeting note might contain action items, a task might become a reference document, and a project might archive into a folder. DirectGTD doesn't force rigid categories; it adapts to your workflow.

**Key principle:** The type is just metadata. Change it freely to match how you're using the item right now.

## Table of Contents

- [Quick Start](#quick-start)
- [Available Tools](#available-tools)
- [Authentication](#authentication)
- [Tool Reference](#tool-reference)
- [Response Formats](#response-formats)
- [Error Handling](#error-handling)
- [Code Examples](#code-examples)
- [Rate Limits](#rate-limits)
- [Best Practices](#best-practices)

## Quick Start

### 1. Installation

```bash
# Install dependencies
npm install

# Build the server
npm run build
```

### 2. Configuration

Add to your MCP client configuration:

```json
{
  "mcpServers": {
    "directgtd": {
      "type": "stdio",
      "command": "node",
      "args": ["/absolute/path/to/directmcp/dist/index.js"],
      "env": {}
    }
  }
}
```

### 3. Basic Usage

```typescript
// Using an MCP client
const result = await client.callTool("directgtd_get_root_items", {
  response_format: "json"
});
```

## Available Tools

The server provides **29 tools** for working with DirectGTD:

### Core Item Management
| Tool Name | Purpose | Access | Added |
|-----------|---------|--------|-------|
| `directgtd_get_root_items` | Get top-level folders and projects | Read | v1.0.0 |
| `directgtd_get_children` | Get items inside a specific folder/project | Read | v1.1.0 |
| `directgtd_get_item` | Get a single item by ID | Read | v1.5.0 |
| `directgtd_add_to_inbox` | Add new items to Inbox (quick capture) | Write | v1.2.0 |
| `directgtd_create_item` | Create item in any folder/project | Write | v1.5.0 |

### Item Modification
| Tool Name | Purpose | Access | Added |
|-----------|---------|--------|-------|
| `directgtd_update_title` | Change an item's title | Write | v1.6.0 |
| `directgtd_update_due_date` | Set or clear due date | Write | v1.7.0 |
| `directgtd_update_earliest_start_time` | Set or clear start time (defer) | Write | v1.7.0 |
| `directgtd_update_notes` | Set or clear notes (Markdown supported) | Write | v2.5.0 |
| `directgtd_complete_task` | Mark tasks as completed/uncompleted | Write | v1.3.0 |
| `directgtd_change_item_type` | Change any item's type to any other type | Write | v1.4.0 |

### Organization
| Tool Name | Purpose | Access | Added |
|-----------|---------|--------|-------|
| `directgtd_move_item` | Move item to different parent | Write | v1.6.0 |
| `directgtd_delete_item` | Permanently delete an item | Write | v1.5.0 |

### Tag Management
| Tool Name | Purpose | Access | Added |
|-----------|---------|--------|-------|
| `directgtd_get_all_tags` | List all available tags | Read | v1.8.0 |
| `directgtd_add_tag_to_item` | Apply a tag to an item | Write | v1.9.0 |
| `directgtd_remove_tag_from_item` | Remove a tag from an item | Write | v1.9.0 |
| `directgtd_get_item_tags` | Get tags for an item | Read | v1.9.0 |

### Due Date Queries
| Tool Name | Purpose | Access | Added |
|-----------|---------|--------|-------|
| `directgtd_get_overdue_items` | Get items past their due date | Read | v2.0.0 |
| `directgtd_get_due_today` | Get items due today | Read | v2.0.0 |
| `directgtd_get_due_tomorrow` | Get items due tomorrow | Read | v2.0.0 |
| `directgtd_get_due_this_week` | Get items due this week | Read | v2.0.0 |

### Item Reordering
| Tool Name | Purpose | Access | Added |
|-----------|---------|--------|-------|
| `directgtd_swap_items` | Swap sort order of two sibling items | Write | v2.1.0 |
| `directgtd_move_to_position` | Move item to specific position among siblings | Write | v2.1.0 |
| `directgtd_reorder_children` | Reorder all children with ID array | Write | v2.1.0 |

### Task Queries
| Tool Name | Purpose | Access | Added |
|-----------|---------|--------|-------|
| `directgtd_get_available_tasks` | Get actionable tasks (GTD "Next Actions") | Read | v2.2.0 |
| `directgtd_get_deferred_tasks` | Get deferred tasks (GTD "Tickler") | Read | v2.6.0 |
| `directgtd_get_completed_tasks` | Get completed tasks with optional date filter | Read | v2.4.0 |

### Search
| Tool Name | Purpose | Access | Added |
|-----------|---------|--------|-------|
| `directgtd_search_items` | Search items by title (returns ID and title only) | Read | v2.3.0 |

### Bulk Operations
| Tool Name | Purpose | Access | Added |
|-----------|---------|--------|-------|
| `directgtd_complete_multiple_tasks` | Complete/uncomplete multiple tasks at once | Write | v2.7.0 |

## Authentication

**No authentication required.** The server operates on the local DirectGTD database with read-write access.

**Security Notes:**
- Read-write access to local database (can modify data)
- Local database only (no network access)
- Runs with user's filesystem permissions
- Changes are immediate and permanent

## Tool Reference

### 1. directgtd_get_root_items

Retrieves all top-level items (folders and projects with no parent).

#### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `response_format` | enum | No | `"markdown"` | Output format: `"markdown"` or `"json"` |

#### Request Example

```json
{
  "name": "directgtd_get_root_items",
  "arguments": {
    "response_format": "json"
  }
}
```

#### Response Schema (JSON)

```typescript
{
  total: number;              // Total number of root items
  items: Array<{
    id: string;               // Unique identifier (UUID)
    title: string;            // Item name
    parentId: null;           // Always null for root items
    sortOrder: number;        // Display order (0-indexed)
    createdAt: string;        // ISO 8601 timestamp
    modifiedAt: string;       // ISO 8601 timestamp
    completedAt: string | null;  // ISO 8601 or null
    dueDate: string | null;      // ISO 8601 or null
    earliestStartTime: string | null;  // ISO 8601 or null
  }>;
}
```

#### Response Example (JSON)

```json
{
  "total": 7,
  "items": [
    {
      "id": "028154E7-D141-4431-AA61-31DA489F629E",
      "title": "Inbox",
      "parentId": null,
      "sortOrder": 0,
      "createdAt": "1970-01-21T09:51:00.000Z",
      "modifiedAt": "1970-01-21T09:51:00.000Z",
      "completedAt": null,
      "dueDate": null,
      "earliestStartTime": null
    },
    {
      "id": "2EADCE4C-538A-444F-BE61-B4AF0047B2EC",
      "title": "Home",
      "parentId": null,
      "sortOrder": 8,
      "createdAt": "1970-01-21T09:51:00.000Z",
      "modifiedAt": "1970-01-21T09:51:00.000Z",
      "completedAt": null,
      "dueDate": null,
      "earliestStartTime": null
    }
  ]
}
```

#### Response Example (Markdown)

```markdown
# DirectGTD Root Items

Found 7 root-level items

## Inbox
- **ID**: 028154E7-D141-4431-AA61-31DA489F629E
- **Sort Order**: 0
- **Created**: Jan 21, 1970, 04:51 AM EST
- **Modified**: Jan 21, 1970, 04:51 AM EST

## Home
- **ID**: 2EADCE4C-538A-444F-BE61-B4AF0047B2EC
- **Sort Order**: 8
- **Created**: Jan 21, 1970, 04:51 AM EST
- **Modified**: Jan 21, 1970, 04:51 AM EST
```

---

### 2. directgtd_get_children

Retrieves all items within a specific parent folder or project.

#### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `parent_id` | string | **Yes** | - | UUID of the parent item |
| `response_format` | enum | No | `"markdown"` | Output format: `"markdown"` or `"json"` |

#### Request Example

```json
{
  "name": "directgtd_get_children",
  "arguments": {
    "parent_id": "028154E7-D141-4431-AA61-31DA489F629E",
    "response_format": "json"
  }
}
```

#### Response Schema (JSON)

```typescript
{
  parentId: string;           // The parent item ID
  total: number;              // Total number of child items
  items: Array<{
    id: string;               // Unique identifier (UUID)
    title: string;            // Item name
    parentId: string;         // Parent's UUID (matches input parent_id)
    sortOrder: number;        // Display order within parent
    createdAt: string;        // ISO 8601 timestamp
    modifiedAt: string;       // ISO 8601 timestamp
    completedAt: string | null;  // ISO 8601 or null
    dueDate: string | null;      // ISO 8601 or null
    earliestStartTime: string | null;  // ISO 8601 or null
  }>;
}
```

#### Response Example (JSON)

```json
{
  "parentId": "028154E7-D141-4431-AA61-31DA489F629E",
  "total": 5,
  "items": [
    {
      "id": "AC795810-3C2D-40FB-94F7-8D76A92D2501",
      "title": "jish",
      "parentId": "028154E7-D141-4431-AA61-31DA489F629E",
      "sortOrder": 2,
      "createdAt": "1970-01-21T09:51:00.000Z",
      "modifiedAt": "1970-01-21T09:52:00.000Z",
      "completedAt": "1970-01-21T09:52:00.000Z",
      "dueDate": null,
      "earliestStartTime": null
    },
    {
      "id": "39CCCEEB-169D-4132-85BA-55A0296A3972",
      "title": "brush teeth",
      "parentId": "028154E7-D141-4431-AA61-31DA489F629E",
      "sortOrder": 3,
      "createdAt": "1970-01-21T09:51:00.000Z",
      "modifiedAt": "1970-01-21T09:52:00.000Z",
      "completedAt": "1970-01-21T09:52:00.000Z",
      "dueDate": null,
      "earliestStartTime": null
    }
  ]
}
```

#### Response Example (Markdown)

```markdown
# DirectGTD Child Items

Parent ID: 028154E7-D141-4431-AA61-31DA489F629E
Found 5 child items

## jish
- **ID**: AC795810-3C2D-40FB-94F7-8D76A92D2501
- **Sort Order**: 2
- **Created**: Jan 21, 1970, 04:51 AM EST
- **Modified**: Jan 21, 1970, 04:52 AM EST
- **Completed**: Jan 21, 1970, 04:52 AM EST

## brush teeth
- **ID**: 39CCCEEB-169D-4132-85BA-55A0296A3972
- **Sort Order**: 3
- **Created**: Jan 21, 1970, 04:51 AM EST
- **Modified**: Jan 21, 1970, 04:52 AM EST
- **Completed**: Jan 21, 1970, 04:52 AM EST
```

### 3. directgtd_add_to_inbox

Add a new item to the DirectGTD Inbox for quick capture.

#### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `title` | string | Yes | - | Item title/name |
| `item_type` | string | No | `"Task"` | Type: Task, Note, Project, etc. |
| `due_date` | string | No | - | Due date in ISO 8601 format |

#### Request Example

```json
{
  "name": "directgtd_add_to_inbox",
  "arguments": {
    "title": "buy milk",
    "item_type": "Task",
    "due_date": "2024-11-20T17:00:00Z"
  }
}
```

#### Response Example

```markdown
# Item Added to Inbox

**buy milk**

- **ID**: 3F8A9B2C-1D4E-5F6A-7B8C-9D0E1F2A3B4C
- **Type**: Task
- **Sort Order**: 15
- **Created**: Nov 21, 2025, 10:30 AM EST
- **Due Date**: Nov 20, 2024, 12:00 PM EST

Item successfully added to Inbox.
```

### 4. directgtd_complete_task

Mark a task as completed or uncompleted. Only works with Tasks - other item types cannot be completed.

#### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `task_id` | string | Yes | - | The task ID to complete/uncomplete |
| `completed` | boolean | No | `true` | true = complete, false = uncomplete |

#### Request Example

```json
{
  "name": "directgtd_complete_task",
  "arguments": {
    "task_id": "3F8A9B2C-1D4E-5F6A-7B8C-9D0E1F2A3B4C",
    "completed": true
  }
}
```

#### Response Example

```markdown
# Task Completed

**buy milk**

- **ID**: 3F8A9B2C-1D4E-5F6A-7B8C-9D0E1F2A3B4C
- **Type**: Task
- **Status**: ✓ Completed
- **Modified**: Nov 21, 2025, 10:35 AM EST
- **Completed At**: Nov 21, 2025, 10:35 AM EST

Task successfully marked as completed.
```

#### Error: Non-Task Item

```markdown
Error: Cannot complete item of type 'Note'. Only Tasks can be marked as completed. This item is a Note.
```

### 5. directgtd_change_item_type

Change any item's type to any other type. Embodies DirectGTD's philosophy of flexible types.

#### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `item_id` | string | Yes | - | The item ID to change |
| `new_type` | string | Yes | - | New type: Task, Note, Project, Folder, etc. |

#### Request Example

```json
{
  "name": "directgtd_change_item_type",
  "arguments": {
    "item_id": "3F8A9B2C-1D4E-5F6A-7B8C-9D0E1F2A3B4C",
    "new_type": "Note"
  }
}
```

#### Response Example

```markdown
# Item Type Changed

**buy milk**

- **ID**: 3F8A9B2C-1D4E-5F6A-7B8C-9D0E1F2A3B4C
- **Old Type**: Task
- **New Type**: Note
- **Modified**: Nov 21, 2025, 10:40 AM EST
- **Note**: Completion status cleared (only Tasks can be completed)

Item type successfully changed from Task to Note.
```

#### Use Cases

**Task → Reference**: Completed tasks become reference material
```typescript
// Convert completed task to a note for reference
await client.callTool("directgtd_change_item_type", {
  item_id: "ABC123",
  new_type: "Note"
});
```

**Note → Task**: Meeting notes reveal action items
```typescript
// Convert note to task when action is needed
await client.callTool("directgtd_change_item_type", {
  item_id: "DEF456",
  new_type: "Task"
});
```

**Any Item → Template**: Just change the type to "Template"
```typescript
// Mark any item as a template
await client.callTool("directgtd_change_item_type", {
  item_id: "GHI789",
  new_type: "Template"
});
```

## Response Formats

### JSON Format

**Best for:** Programmatic processing, data integration, APIs

**Characteristics:**
- Machine-readable
- Consistent structure
- ISO 8601 timestamps
- Null values preserved
- Compact representation

**Use when:**
- Building applications
- Data analysis
- Storing results
- API integration

### Markdown Format

**Best for:** Human readability, AI assistants, documentation

**Characteristics:**
- Human-readable
- Formatted dates (localized)
- Optional fields hidden when null
- Rich text formatting
- Verbose but clear

**Use when:**
- Displaying to users
- AI agent responses
- Reports and summaries
- Debugging

## Error Handling

### Error Response Format

All errors return:

```json
{
  "content": [{
    "type": "text",
    "text": "Error: [description]"
  }],
  "isError": true
}
```

### Common Errors

#### Database Not Found

```json
{
  "error": "Error: Database not found at [path]. Please ensure DirectGTD is installed and has created its database."
}
```

**Cause:** DirectGTD database doesn't exist
**Solution:** Install DirectGTD and create at least one task

#### Cannot Open Database

```json
{
  "error": "Error: Cannot open database at [path]. Please check file permissions."
}
```

**Cause:** Permission denied
**Solution:** Check file permissions: `chmod 644 [db-path]`

#### No Items Found

```json
{
  "total": 0,
  "items": []
}
```

**Note:** This is NOT an error - just an empty result

#### Parent Not Found

When calling `get_children` with invalid parent_id:

```json
{
  "parentId": "invalid-id",
  "total": 0,
  "items": []
}
```

**Note:** Returns empty array, not an error

### Error Handling Best Practices

```typescript
try {
  const result = await client.callTool("directgtd_get_root_items", {
    response_format: "json"
  });

  const data = JSON.parse(result.content[0].text);

  if (data.total === 0) {
    console.log("No items found");
  } else {
    processItems(data.items);
  }

} catch (error) {
  if (error.message.includes("Database not found")) {
    // Handle missing database
  } else if (error.message.includes("Cannot open")) {
    // Handle permission error
  } else {
    // Handle other errors
  }
}
```

## Code Examples

### TypeScript/Node.js

```typescript
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

// Initialize client
const transport = new StdioClientTransport({
  command: "node",
  args: ["/path/to/directmcp/dist/index.js"]
});

const client = new Client({
  name: "my-app",
  version: "1.0.0"
}, {
  capabilities: {}
});

await client.connect(transport);

// Get root items
const rootResult = await client.callTool({
  name: "directgtd_get_root_items",
  arguments: {
    response_format: "json"
  }
});

const rootData = JSON.parse(rootResult.content[0].text);
console.log(`Found ${rootData.total} root items`);

// Get children of first item
if (rootData.items.length > 0) {
  const firstItem = rootData.items[0];

  const childrenResult = await client.callTool({
    name: "directgtd_get_children",
    arguments: {
      parent_id: firstItem.id,
      response_format: "json"
    }
  });

  const childrenData = JSON.parse(childrenResult.content[0].text);
  console.log(`Item "${firstItem.title}" has ${childrenData.total} children`);
}
```

### Python

```python
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client
import json

# Initialize client
server_params = StdioServerParameters(
    command="node",
    args=["/path/to/directmcp/dist/index.js"]
)

async with stdio_client(server_params) as (read, write):
    async with ClientSession(read, write) as session:
        await session.initialize()

        # Get root items
        root_result = await session.call_tool(
            "directgtd_get_root_items",
            arguments={"response_format": "json"}
        )

        root_data = json.loads(root_result.content[0].text)
        print(f"Found {root_data['total']} root items")

        # Get children of first item
        if root_data['items']:
            first_item = root_data['items'][0]

            children_result = await session.call_tool(
                "directgtd_get_children",
                arguments={
                    "parent_id": first_item['id'],
                    "response_format": "json"
                }
            )

            children_data = json.loads(children_result.content[0].text)
            print(f"Item '{first_item['title']}' has {children_data['total']} children")
```

### Navigating the Full Hierarchy

```typescript
async function navigateDirectGTD(client: Client) {
  // Get all root items
  const rootResult = await client.callTool({
    name: "directgtd_get_root_items",
    arguments: { response_format: "json" }
  });

  const rootData = JSON.parse(rootResult.content[0].text);

  // Recursively explore each root item
  for (const item of rootData.items) {
    await exploreItem(client, item, 0);
  }
}

async function exploreItem(client: Client, item: any, depth: number) {
  const indent = "  ".repeat(depth);
  console.log(`${indent}${item.title} (${item.id})`);

  // Get children
  const childrenResult = await client.callTool({
    name: "directgtd_get_children",
    arguments: {
      parent_id: item.id,
      response_format: "json"
    }
  });

  const childrenData = JSON.parse(childrenResult.content[0].text);

  // Recursively explore children
  for (const child of childrenData.items) {
    await exploreItem(client, child, depth + 1);
  }
}
```

### Finding Specific Items

```typescript
async function findItemByTitle(
  client: Client,
  searchTitle: string
): Promise<any | null> {
  // Search root items
  const rootResult = await client.callTool({
    name: "directgtd_get_root_items",
    arguments: { response_format: "json" }
  });

  const rootData = JSON.parse(rootResult.content[0].text);

  for (const item of rootData.items) {
    if (item.title === searchTitle) {
      return item;
    }

    // Search children recursively
    const found = await searchInChildren(client, item.id, searchTitle);
    if (found) return found;
  }

  return null;
}

async function searchInChildren(
  client: Client,
  parentId: string,
  searchTitle: string
): Promise<any | null> {
  const childrenResult = await client.callTool({
    name: "directgtd_get_children",
    arguments: {
      parent_id: parentId,
      response_format: "json"
    }
  });

  const childrenData = JSON.parse(childrenResult.content[0].text);

  for (const child of childrenData.items) {
    if (child.title === searchTitle) {
      return child;
    }

    const found = await searchInChildren(client, child.id, searchTitle);
    if (found) return found;
  }

  return null;
}
```

### Filtering Completed Tasks

```typescript
async function getCompletedTasks(client: Client): Promise<any[]> {
  const completed: any[] = [];

  const rootResult = await client.callTool({
    name: "directgtd_get_root_items",
    arguments: { response_format: "json" }
  });

  const rootData = JSON.parse(rootResult.content[0].text);

  for (const item of rootData.items) {
    await collectCompleted(client, item, completed);
  }

  return completed;
}

async function collectCompleted(
  client: Client,
  item: any,
  completed: any[]
) {
  if (item.completedAt !== null) {
    completed.push(item);
  }

  const childrenResult = await client.callTool({
    name: "directgtd_get_children",
    arguments: {
      parent_id: item.id,
      response_format: "json"
    }
  });

  const childrenData = JSON.parse(childrenResult.content[0].text);

  for (const child of childrenData.items) {
    await collectCompleted(client, child, completed);
  }
}
```

### Workflow: Quick Capture and Process

Demonstrates adding items to inbox, completing them, and archiving as reference:

```typescript
async function quickCaptureWorkflow(client: Client) {
  // 1. Quick capture to inbox
  const addResult = await client.callTool({
    name: "directgtd_add_to_inbox",
    arguments: {
      title: "Research MCP protocol",
      item_type: "Task",
      due_date: "2025-11-25T17:00:00Z"
    }
  });

  const taskId = extractIdFromResponse(addResult);

  // 2. Do the work... then mark complete
  await client.callTool({
    name: "directgtd_complete_task",
    arguments: {
      task_id: taskId,
      completed: true
    }
  });

  // 3. Convert to reference note for future use
  await client.callTool({
    name: "directgtd_change_item_type",
    arguments: {
      item_id: taskId,
      new_type: "Reference"
    }
  });

  console.log("Task completed and archived as reference");
}
```

### Workflow: Meeting Notes to Action Items

Transform meeting notes into actionable tasks:

```typescript
async function meetingNotesToTasks(client: Client, noteId: string) {
  // Get the meeting note
  const note = await findItemById(client, noteId);

  if (note.item_type === "Note") {
    // Convert to task when action is required
    await client.callTool({
      name: "directgtd_change_item_type",
      arguments: {
        item_id: noteId,
        new_type: "Task"
      }
    });

    console.log(`Note "${note.title}" converted to task`);
  }
}
```

### Workflow: Template Management

Any item can become a template just by changing its type:

```typescript
async function createTemplateFromTask(client: Client, taskId: string) {
  // Mark completed task as a template for future use
  await client.callTool({
    name: "directgtd_change_item_type",
    arguments: {
      item_id: taskId,
      new_type: "Template"
    }
  });

  console.log("Task converted to reusable template");
}

async function useTemplate(client: Client, templateId: string) {
  // Get template
  const template = await findItemById(client, templateId);

  // Create new task from template (copy manually, then change type)
  await client.callTool({
    name: "directgtd_add_to_inbox",
    arguments: {
      title: template.title,
      item_type: "Task"
    }
  });
}
```

### Workflow: Flexible Type Evolution

Demonstrates how items naturally evolve through different types:

```typescript
async function itemLifecycle(client: Client) {
  // Start as a quick note
  const result = await client.callTool({
    name: "directgtd_add_to_inbox",
    arguments: {
      title: "Ideas for new feature",
      item_type: "Note"
    }
  });

  const itemId = extractIdFromResponse(result);

  // Becomes a task when ready to act
  await client.callTool({
    name: "directgtd_change_item_type",
    arguments: { item_id: itemId, new_type: "Task" }
  });

  // Complete the work
  await client.callTool({
    name: "directgtd_complete_task",
    arguments: { task_id: itemId, completed: true }
  });

  // Archive as reference material
  await client.callTool({
    name: "directgtd_change_item_type",
    arguments: { item_id: itemId, new_type: "Reference" }
  });

  console.log("Item evolved: Note → Task → Complete → Reference");
}
```

## Rate Limits

**No rate limits.** The server operates on a local database with no network calls.

**Performance Notes:**
- Each tool call opens/closes a database connection
- Average response time: < 100ms
- Character limit: 25,000 chars (responses auto-truncate)
- Deep hierarchies require multiple calls (no batching)

## Best Practices

### 1. Always Use JSON for Programmatic Access

```typescript
// Good
const result = await client.callTool("directgtd_get_root_items", {
  response_format: "json"
});

// Avoid for programmatic use
const result = await client.callTool("directgtd_get_root_items", {
  response_format: "markdown"
});
```

### 2. Cache Results When Appropriate

```typescript
// Cache root items to avoid repeated calls
let rootItemsCache: any = null;
let cacheTime: number = 0;

async function getRootItems(client: Client, maxAge: number = 60000) {
  const now = Date.now();

  if (!rootItemsCache || (now - cacheTime) > maxAge) {
    const result = await client.callTool({
      name: "directgtd_get_root_items",
      arguments: { response_format: "json" }
    });

    rootItemsCache = JSON.parse(result.content[0].text);
    cacheTime = now;
  }

  return rootItemsCache;
}
```

### 3. Handle Empty Results Gracefully

```typescript
const childrenResult = await client.callTool({
  name: "directgtd_get_children",
  arguments: {
    parent_id: itemId,
    response_format: "json"
  }
});

const data = JSON.parse(childrenResult.content[0].text);

if (data.total === 0) {
  console.log("No children found - this is a leaf node");
} else {
  processChildren(data.items);
}
```

### 4. Use Recursive Functions for Deep Traversal

See examples above for navigating full hierarchies.

### 5. Validate Parent IDs Before Calling get_children

```typescript
// Validate UUID format
function isValidUUID(id: string): boolean {
  const uuidRegex = /^[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}$/i;
  return uuidRegex.test(id);
}

if (isValidUUID(parentId)) {
  const result = await client.callTool({
    name: "directgtd_get_children",
    arguments: { parent_id: parentId }
  });
}
```

### 6. Handle Character Limit Truncation

```typescript
const result = await client.callTool({
  name: "directgtd_get_root_items",
  arguments: { response_format: "json" }
});

const data = JSON.parse(result.content[0].text);

if (data.truncated) {
  console.warn(`Response truncated: ${data.count}/${data.total} items returned`);
  console.log(`Message: ${data.truncation_message}`);
}
```

## Data Model

### Item Object

All items (root or children) share the same structure:

```typescript
interface DirectGTDItem {
  id: string;                    // UUID v4 format
  title: string;                 // Display name
  parentId: string | null;       // null for root items
  sortOrder: number;             // 0-indexed position
  createdAt: string;             // ISO 8601
  modifiedAt: string;            // ISO 8601
  completedAt: string | null;    // ISO 8601 or null
  dueDate: string | null;        // ISO 8601 or null
  earliestStartTime: string | null;  // ISO 8601 or null
}
```

### Timestamps

All timestamps use **ISO 8601 format**:

```
YYYY-MM-DDTHH:mm:ss.sssZ
```

Example: `"1970-01-21T09:51:00.000Z"`

## Troubleshooting

### Issue: "Database not found"

**Check database location:**
```bash
ls -l ~/Library/Containers/com.zendegi.DirectGTD/Data/Library/Application\ Support/DirectGTD/directgtd.sqlite
```

**Solution:** Ensure DirectGTD is installed and has created at least one task.

### Issue: Tools not available

**Verify server is registered:**
- For Claude Code: `claude mcp list`
- Check server logs for startup message

**Solution:** Restart MCP client after configuration changes.

### Issue: Empty results

**Not an error** - the folder/database is simply empty.

**Verify:**
- Open DirectGTD app
- Check if items exist in the UI
- Ensure you're querying the correct parent_id

## Version History

### v1.1.0 (Current)
- ✅ Added `directgtd_get_children` tool
- ✅ Fixed database path for sandboxed DirectGTD

### v1.0.0
- ✅ Initial release
- ✅ `directgtd_get_root_items` tool
- ✅ JSON and Markdown response formats

## Support

For issues or questions:
- **Documentation**: See `/docs` folder
- **Server Issues**: Check troubleshooting guide
- **DirectGTD Issues**: Contact DirectGTD support

## License

MIT
