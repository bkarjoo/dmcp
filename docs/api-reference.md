# API Reference

Technical reference for the DirectGTD MCP Server tools and data structures.

## Overview

DirectGTD MCP Server exposes tools through the Model Context Protocol (MCP). Currently, one tool is available: `directgtd_get_root_items`.

## Server Information

- **Server Name**: `directgtd-mcp-server`
- **Version**: `1.0.0`
- **Protocol**: MCP (Model Context Protocol)
- **Transport**: stdio (Standard Input/Output)
- **Database**: SQLite (read-only)

## Available Tools

### `directgtd_get_root_items`

Retrieves all root-level items from the DirectGTD task management database.

**Purpose**: Query for all tasks and projects that have no parent (top-level items in your task hierarchy).

#### Tool Metadata

| Property | Value |
|----------|-------|
| Tool Name | `directgtd_get_root_items` |
| Title | Get DirectGTD Root Items |
| Read-Only | ✅ Yes |
| Destructive | ❌ No |
| Idempotent | ✅ Yes (same input always returns same result) |
| Open World | ❌ No (returns finite, complete dataset) |

#### Input Parameters

The tool accepts one optional parameter:

**`response_format`** (optional)

| Attribute | Value |
|-----------|-------|
| Type | String (enum) |
| Required | No |
| Default | `"markdown"` |
| Valid Values | `"markdown"` or `"json"` |
| Description | Output format: 'markdown' for human-readable or 'json' for machine-readable |

**Parameter Schema (Zod)**:
```typescript
z.object({
  response_format: z.enum(["markdown", "json"])
    .optional()
    .default("markdown")
    .describe("Output format: 'markdown' for human-readable or 'json' for machine-readable")
}).strict()
```

#### Examples

**Example 1: Default Markdown Output**
```typescript
// Call with no parameters (uses default)
{
  // No parameters needed
}
```

**Example 2: Explicit Markdown Output**
```typescript
{
  "response_format": "markdown"
}
```

**Example 3: JSON Output**
```typescript
{
  "response_format": "json"
}
```

#### Output Formats

##### Markdown Format

**Structure:**
```markdown
# DirectGTD Root Items

Found {count} root-level {item|items}

## {Item Title}
- **ID**: {item_id}
- **Sort Order**: {sort_order}
- **Created**: {created_date}
- **Modified**: {modified_date}
- **Completed**: {completed_date}  # Only if completed
- **Due Date**: {due_date}          # Only if set
- **Earliest Start**: {start_time}  # Only if set

... (repeats for each item)
```

**Example:**
```markdown
# DirectGTD Root Items

Found 2 root-level items

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
```

**Date Formatting in Markdown:**
- Uses localized format: `en-US`
- Format: `{Month} {Day}, {Year}, {Hour}:{Minute} {AM/PM} {Timezone}`
- Null dates shown as: `"None"`

##### JSON Format

**Schema:**
```typescript
{
  total: number,           // Total number of root items found
  items: FormattedItem[]   // Array of formatted items
}
```

**FormattedItem Schema:**
```typescript
{
  id: string,                        // Unique item identifier
  title: string,                     // Item title/name
  parentId: string | null,           // Parent ID (always null for root items)
  sortOrder: number,                 // Sort order within parent
  createdAt: string,                 // Creation timestamp (ISO 8601)
  modifiedAt: string,                // Last modification timestamp (ISO 8601)
  completedAt: string | null,        // Completion timestamp (ISO 8601) or null
  dueDate: string | null,            // Due date (ISO 8601) or null
  earliestStartTime: string | null   // Earliest start time (ISO 8601) or null
}
```

**Example:**
```json
{
  "total": 2,
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
    }
  ]
}
```

**Date Formatting in JSON:**
- Uses ISO 8601 format
- Format: `YYYY-MM-DDTHH:mm:ssZ`
- Null dates remain `null` (not converted to strings)

#### Return Value

The tool returns an MCP tool response object:

```typescript
{
  content: [
    {
      type: "text",
      text: string  // Formatted output (Markdown or JSON)
    }
  ],
  isError?: boolean  // Only present and true if an error occurred
}
```

#### Error Responses

Errors are returned as text content with `isError: true`:

**Database Not Found**
```
Error: Database not found at ~/Library/Application Support/DirectGTD/directgtd.sqlite. Please ensure DirectGTD is installed and has created its database.
```

**Cannot Open Database**
```
Error: Cannot open database at ~/Library/Application Support/DirectGTD/directgtd.sqlite. Please check file permissions.
```

**Database Corrupted**
```
Error: Database file is corrupted. Please check the DirectGTD database integrity.
```

**No Root Items**
```
No root items found in DirectGTD database.
```
(Note: This is NOT an error response - `isError` is not set)

#### Behavior Specifications

##### Sorting
- Results are sorted by `sort_order` (ascending)
- This is the same order items appear in the DirectGTD application

##### Filtering
- Only returns items where `parent_id IS NULL`
- Items with a parent are excluded (not root-level)

##### Character Limit
- Maximum response size: 25,000 characters
- If exceeded, response is automatically truncated
- Truncation happens at the item level (never mid-item)
- Truncation retains first N items that fit within the limit

**Truncated Markdown Example:**
```markdown
# DirectGTD Root Items

Found 3 root-level items

## Item 1
...

## Item 2
...

**Note**: Response truncated from 50 to 2 items due to size limits.
```

**Truncated JSON Example:**
```json
{
  "total": 50,
  "count": 2,
  "items": [ /* 2 items */ ],
  "truncated": true,
  "truncation_message": "Response truncated from 50 to 2 items. The database contains more items than can be displayed at once."
}
```

##### Database Access
- Opens database in **read-only mode**
- Connection is opened for each request
- Connection is always closed after the request (even on error)
- No connection pooling (stateless)

## Database Schema

The tool queries the DirectGTD SQLite database with the following schema:

### Table: `items`

| Column Name | SQL Type | Nullable | Description |
|-------------|----------|----------|-------------|
| `id` | TEXT | No | Unique identifier |
| `title` | TEXT | No | Item title/name |
| `parent_id` | TEXT | Yes | ID of parent item (null for root items) |
| `sort_order` | INTEGER | No | Position in list |
| `created_at` | TEXT | No | ISO 8601 timestamp |
| `modified_at` | TEXT | No | ISO 8601 timestamp |
| `completed_at` | TEXT | Yes | ISO 8601 timestamp or null |
| `due_date` | TEXT | Yes | ISO 8601 timestamp or null |
| `earliest_start_time` | TEXT | Yes | ISO 8601 timestamp or null |

### SQL Query

The exact query executed:
```sql
SELECT * FROM items WHERE parent_id IS NULL ORDER BY sort_order
```

## Type Definitions

### TypeScript Types

**Database Item (Raw)**
```typescript
interface DirectGTDItem {
  id: string;
  title: string;
  parent_id: string | null;
  sort_order: number;
  created_at: string;
  modified_at: string;
  completed_at: string | null;
  due_date: string | null;
  earliest_start_time: string | null;
}
```

**Formatted Item (API Response)**
```typescript
interface FormattedItem {
  id: string;
  title: string;
  parentId: string | null;        // Converted from parent_id
  sortOrder: number;              // Converted from sort_order
  createdAt: string;              // Converted from created_at
  modifiedAt: string;             // Converted from modified_at
  completedAt: string | null;     // Converted from completed_at
  dueDate: string | null;         // Converted from due_date
  earliestStartTime: string | null; // Converted from earliest_start_time
}
```

**Response Format Enum**
```typescript
enum ResponseFormat {
  MARKDOWN = "markdown",
  JSON = "json"
}
```

## Constants

| Constant | Value | Description |
|----------|-------|-------------|
| `DB_PATH` | `~/Library/Application Support/DirectGTD/directgtd.sqlite` | Database location |
| `CHARACTER_LIMIT` | `25000` | Maximum response size in characters |
| `SERVER_NAME` | `directgtd-mcp-server` | MCP server identifier |
| `SERVER_VERSION` | `1.0.0` | Current version |

## MCP Protocol Compliance

### Tool Registration

The tool is registered with the MCP server using:
```typescript
server.registerTool(
  "directgtd_get_root_items",  // Tool name
  {
    title: "Get DirectGTD Root Items",
    description: "...",
    inputSchema: GetRootItemsInputSchema,
    annotations: {
      readOnlyHint: true,      // Indicates read-only operation
      destructiveHint: false,  // Indicates non-destructive operation
      idempotentHint: true,    // Same input always returns same result
      openWorldHint: false     // Returns complete, finite dataset
    }
  },
  async (params) => { /* handler */ }
);
```

### Transport

- **Type**: stdio (Standard Input/Output)
- **Implementation**: `StdioServerTransport` from `@modelcontextprotocol/sdk`

### Server Lifecycle

1. Server starts via `main()`
2. Creates stdio transport
3. Connects to transport
4. Logs "DirectGTD MCP server running via stdio" to stderr
5. Waits for tool calls
6. Processes each call independently (stateless)
7. Runs until process terminates

## Error Handling

### Error Categories

| Error Type | Detection | Response |
|------------|-----------|----------|
| Database not found | `ENOENT` or "no such file" in error | User-friendly error message |
| Permission denied | `SQLITE_CANTOPEN` in error | Suggest checking file permissions |
| Database corrupted | `SQLITE_CORRUPT` in error | Suggest checking database integrity |
| Other database errors | Any other database error | Generic database error message |
| Unexpected errors | Non-Error thrown | String conversion with context |

### Error Response Format

```typescript
{
  content: [{
    type: "text",
    text: "Error: {description}"
  }],
  isError: true
}
```

## Performance Considerations

### Query Performance
- Simple query with WHERE and ORDER BY clauses
- Performance depends on number of root items
- SQLite index on `parent_id` recommended (not enforced by this server)

### Memory Usage
- All items loaded into memory
- Formatted before character limit check
- Memory scales with number of root items

### Character Limit Impact
- Limits response size to prevent overwhelming clients
- Truncation is inefficient (formats all items, then truncates)
- Consider reducing root items if truncation occurs frequently

## Limitations

### Current Limitations (v1.0.0)

1. **No Child Items**: Cannot retrieve items with a parent
2. **No Filtering**: Returns ALL root items (no search, no filters)
3. **No Pagination**: Returns all items in one response (subject to character limit)
4. **No Write Operations**: Read-only access
5. **No Custom Queries**: Fixed SQL query
6. **macOS Only**: Database path is hardcoded for macOS
7. **No Configuration**: Database path cannot be customized

### Future Considerations

Potential additions for future versions:
- Child item retrieval
- Filtered queries (by date, completion status, etc.)
- Pagination support
- Configurable database path
- Additional database tables/views
- Write operations (create, update, delete)

## Next Steps

- **[Usage Guide](./usage.md)**: Learn how to use the API effectively
- **[Troubleshooting](./troubleshooting.md)**: Solutions to common API issues
- **[Development Guide](./development.md)**: Learn how to extend the API
