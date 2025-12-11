# Usage Guide

This guide shows you how to use DirectGTD MCP Server effectively to query and interact with your task management data.

## Basic Usage

Once installed and configured, you can interact with your DirectGTD database using natural language through your AI assistant (Claude Code or Claude Desktop).

### Simple Queries

The most straightforward way to use the server:

```
Show me all my root tasks in DirectGTD
```

```
What are my top-level projects?
```

```
List all root items from DirectGTD
```

The AI will use the `directgtd_get_root_items` tool to fetch your data and present it in a readable format.

## Understanding Output Formats

DirectGTD MCP Server supports two output formats: **Markdown** (human-readable) and **JSON** (machine-readable).

### Markdown Format (Default)

Best for: Reading, reviewing, and understanding your tasks

**Example request:**
```
Show me my DirectGTD tasks
```

**Example output:**
```markdown
# DirectGTD Root Items

Found 3 root-level items

## Write Documentation
- **ID**: item-abc123
- **Sort Order**: 0
- **Created**: Jan 15, 2024, 10:30 AM PST
- **Modified**: Jan 15, 2024, 02:45 PM PST
- **Due Date**: Jan 20, 2024, 05:00 PM PST

## Review Code
- **ID**: item-def456
- **Sort Order**: 1
- **Created**: Jan 14, 2024, 09:15 AM PST
- **Modified**: Jan 16, 2024, 11:20 AM PST
- **Completed**: Jan 16, 2024, 03:30 PM PST

## Plan Sprint
- **ID**: item-ghi789
- **Sort Order**: 2
- **Created**: Jan 13, 2024, 02:00 PM PST
- **Modified**: Jan 13, 2024, 02:00 PM PST
```

### JSON Format

Best for: Programmatic access, data analysis, integration with other tools

**Example request:**
```
Show me my DirectGTD tasks in JSON format
```

**Example output:**
```json
{
  "total": 3,
  "items": [
    {
      "id": "item-abc123",
      "title": "Write Documentation",
      "parentId": null,
      "sortOrder": 0,
      "createdAt": "2024-01-15T10:30:00Z",
      "modifiedAt": "2024-01-15T14:45:00Z",
      "completedAt": null,
      "dueDate": "2024-01-20T17:00:00Z",
      "earliestStartTime": null
    },
    {
      "id": "item-def456",
      "title": "Review Code",
      "parentId": null,
      "sortOrder": 1,
      "createdAt": "2024-01-14T09:15:00Z",
      "modifiedAt": "2024-01-16T11:20:00Z",
      "completedAt": "2024-01-16T15:30:00Z",
      "dueDate": null,
      "earliestStartTime": null
    },
    {
      "id": "item-ghi789",
      "title": "Plan Sprint",
      "parentId": null,
      "sortOrder": 2,
      "createdAt": "2024-01-13T14:00:00Z",
      "modifiedAt": "2024-01-13T14:00:00Z",
      "completedAt": null,
      "dueDate": null,
      "earliestStartTime": null
    }
  ]
}
```

## Common Use Cases

### 1. Daily Task Review

**Query:**
```
Show me my root tasks. Which ones are due soon?
```

The AI will retrieve your tasks and analyze which ones have upcoming due dates.

### 2. Project Overview

**Query:**
```
What are my current top-level projects in DirectGTD?
```

Get a high-level view of your organizational structure.

### 3. Completed Tasks

**Query:**
```
Show me my root tasks. Which ones are completed?
```

Review what you've accomplished.

### 4. Task Priority Planning

**Query:**
```
List my DirectGTD root items sorted by due date. Help me prioritize.
```

The AI will fetch your tasks and help you organize them by urgency.

### 5. Task Count and Statistics

**Query:**
```
How many root-level tasks do I have in DirectGTD? How many are completed?
```

Get quick statistics about your task management.

### 6. Integration with Other Workflows

**Query:**
```
Get my DirectGTD tasks in JSON format and create a summary report
```

Use JSON output for further processing or integration.

## Understanding the Data

### Item Fields Explained

Each root item includes the following information:

| Field | Description | Example | Can be null? |
|-------|-------------|---------|--------------|
| `id` | Unique identifier for the item | `"item-abc123"` | No |
| `title` | The task or project name | `"Write Documentation"` | No |
| `parentId` | Parent item ID (always null for root items) | `null` | Yes (always null) |
| `sortOrder` | Position in the list (0-based) | `0` | No |
| `createdAt` | When the item was created | `"2024-01-15T10:30:00Z"` | No |
| `modifiedAt` | Last modification time | `"2024-01-15T14:45:00Z"` | No |
| `completedAt` | When the item was completed | `"2024-01-16T15:30:00Z"` | Yes |
| `dueDate` | When the item is due | `"2024-01-20T17:00:00Z"` | Yes |
| `earliestStartTime` | Earliest time to start the item | `"2024-01-18T09:00:00Z"` | Yes |

### Date Formats

**In JSON output**: ISO 8601 format
```
"2024-01-15T10:30:00Z"
```

**In Markdown output**: Localized, human-readable format
```
Jan 15, 2024, 10:30 AM PST
```

### Null vs Missing Values

- `completedAt`: `null` means the task is not yet completed
- `dueDate`: `null` means no due date is set
- `earliestStartTime`: `null` means no start time constraint
- `parentId`: Always `null` for root items (by definition)

## Best Practices

### 1. Use Natural Language

Don't worry about exact syntax. The AI understands various phrasings:

✅ Good:
- "Show me my tasks"
- "What's in my DirectGTD?"
- "List my projects"
- "Get my to-do items"

### 2. Specify Output Format When Needed

If you need JSON for further processing:

```
Get my DirectGTD tasks in JSON format
```

Otherwise, Markdown (default) is more readable.

### 3. Combine with AI Analysis

Let the AI help you make sense of your tasks:

```
Show me my DirectGTD tasks and help me identify which ones I should focus on today
```

```
Get my tasks and create a weekly plan based on due dates
```

### 4. Check for Empty Results

If you see "No root items found", it means:
- Your DirectGTD database has no root-level items, OR
- All your items are nested under parent items

Create a root-level task in DirectGTD to see results.

### 5. Understand Character Limits

The server has a 25,000 character limit. If you have many tasks, the response will be truncated:

**Markdown truncation:**
```markdown
**Note**: Response truncated from 50 to 25 items due to size limits.
```

**JSON truncation:**
```json
{
  "total": 50,
  "count": 25,
  "items": [...],
  "truncated": true,
  "truncation_message": "Response truncated from 50 to 25 items..."
}
```

## Advanced Usage

### Filtering and Analysis

While the server only retrieves root items, you can ask the AI to filter or analyze the results:

**Filter by status:**
```
Show me my DirectGTD root tasks. Only show the incomplete ones.
```

**Filter by date:**
```
Get my DirectGTD tasks. Which ones are due this week?
```

**Sort differently:**
```
Show my DirectGTD tasks sorted by creation date instead of sort order.
```

The AI will fetch all root items and then apply your filters.

### Data Export

**Export to different formats:**
```
Get my DirectGTD tasks and format them as a CSV
```

```
Show my tasks as a simple checklist
```

```
Create a table of my tasks with just title and due date
```

### Integration Examples

**Create a report:**
```
Get my DirectGTD root items and create a weekly status report
```

**Cross-reference with other data:**
```
Show my DirectGTD tasks and compare them to my calendar for conflicts
```

**Generate summaries:**
```
Summarize my DirectGTD projects and suggest next actions
```

## What You Cannot Do (Current Limitations)

The current version (1.0.0) has the following limitations:

### No Write Operations
- Cannot create new tasks
- Cannot modify existing tasks
- Cannot delete tasks
- Cannot mark tasks as complete

**Why**: Read-only access ensures data safety

### No Child Items
- Cannot retrieve sub-tasks or nested items
- Only root-level items are accessible

**Workaround**: Use DirectGTD app directly for hierarchical views

### No Search or Filtering at Server Level
- The server returns ALL root items
- Filtering must be done by the AI after retrieval

**Why**: Keeps the server simple and focused

### No Custom Queries
- Cannot specify custom SQL queries
- Cannot access other database tables

**Why**: Security and simplicity

## Handling Errors

### "Database not found"

**What it means**: DirectGTD database doesn't exist at the expected location

**What to do**:
1. Launch DirectGTD application
2. Create at least one task
3. Try your query again

### "Cannot open database"

**What it means**: File permission issue

**What to do**:
```bash
chmod 644 ~/Library/Application\ Support/DirectGTD/directgtd.sqlite
```

### "No root items found"

**What it means**: Your database has no root-level items

**What to do**:
1. Open DirectGTD
2. Create a task at the root level (not nested under another item)
3. Try your query again

### Response Truncated

**What it means**: You have too many root items to display at once

**What to do**:
- This is normal for large task lists
- The most important items (by sort order) are shown first
- Use the JSON format to see truncation details
- Consider organizing tasks into hierarchies in DirectGTD

## Tips for Better Results

### Be Specific About What You Want

❌ Vague: "Show me tasks"
✅ Specific: "Show me my DirectGTD root tasks that are due this week"

### Use Follow-Up Questions

```
User: Show me my DirectGTD tasks
AI: [Shows task list]
User: Which of these should I prioritize?
AI: [Analyzes and suggests priorities]
```

### Request Explanations

```
Show me my tasks and explain what each field means
```

### Combine Multiple Requests

```
Get my DirectGTD tasks, identify overdue items, and suggest a recovery plan
```

## Next Steps

- **[API Reference](./api-reference.md)**: Technical details about the `directgtd_get_root_items` tool
- **[Troubleshooting](./troubleshooting.md)**: Solutions to common problems
- **[Development Guide](./development.md)**: Learn how to modify or extend the server
