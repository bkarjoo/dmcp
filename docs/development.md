# Development Guide

This guide is for developers who want to understand, modify, extend, or contribute to DirectGTD MCP Server.

## Table of Contents

1. [Development Setup](#development-setup)
2. [Project Structure](#project-structure)
3. [Architecture Overview](#architecture-overview)
4. [Development Workflow](#development-workflow)
5. [Building and Testing](#building-and-testing)
6. [Adding New Features](#adding-new-features)
7. [Code Style Guidelines](#code-style-guidelines)
8. [Contributing](#contributing)
9. [Release Process](#release-process)

## Development Setup

### Prerequisites

- **Node.js**: v18 or higher
- **npm**: Comes with Node.js
- **TypeScript**: Installed via npm (dev dependency)
- **Git**: For version control
- **Code Editor**: VS Code recommended (TypeScript support)
- **DirectGTD**: For testing with real database

### Initial Setup

```bash
# Clone the repository (or navigate to project)
cd /path/to/directmcp

# Install dependencies
npm install

# Build the project
npm run build

# Run tests
npm test

# Optional: Run in development mode
npm run dev
```

### Development Dependencies

The project uses these development tools:

| Package | Purpose | Version |
|---------|---------|---------|
| `typescript` | TypeScript compiler | ^5.7.2 |
| `tsx` | TypeScript execution for development | ^4.19.2 |
| `@types/node` | Node.js type definitions | ^22.10.0 |
| `@types/better-sqlite3` | better-sqlite3 type definitions | ^7.6.12 |

### Runtime Dependencies

| Package | Purpose | Version |
|---------|---------|---------|
| `@modelcontextprotocol/sdk` | MCP protocol implementation | ^1.6.1 |
| `better-sqlite3` | SQLite database driver | ^11.7.0 |
| `zod` | Schema validation | ^3.23.8 |

## Project Structure

```
directmcp/
├── src/
│   ├── index.ts          # Main server implementation
│   └── test.ts           # Test suite
├── dist/                 # Compiled JavaScript (generated)
│   ├── index.js
│   └── test.js
├── docs/                 # Documentation
│   ├── README.md
│   ├── getting-started.md
│   ├── installation.md
│   ├── usage.md
│   ├── api-reference.md
│   ├── troubleshooting.md
│   └── development.md
├── node_modules/         # Dependencies (generated)
├── package.json          # Project metadata and scripts
├── tsconfig.json         # TypeScript configuration
├── README.md             # Main README
└── TODO.md               # Project tasks and notes
```

### Key Files

#### `src/index.ts`

Main server implementation. Contains:
- MCP server initialization
- Tool registration (`directgtd_get_root_items`)
- Database access functions
- Formatting functions
- Error handling
- Main entry point

**Size**: ~314 lines

#### `src/test.ts`

Test suite using Node.js built-in test runner. Tests:
- Database existence
- Root items query
- Empty database handling
- Sort order verification
- Parent ID validation
- Schema verification

**Size**: ~220 lines

#### `package.json`

Project configuration:
- Dependencies
- Scripts (build, test, dev, clean)
- Metadata (name, version, description)
- Node engine requirement

#### `tsconfig.json`

TypeScript compiler configuration:
- Target: ES2020
- Module: ESNext
- Strict type checking enabled
- Output to `dist/` directory

## Architecture Overview

### High-Level Architecture

```
┌─────────────────────────────────────────────┐
│         Claude Code / Claude Desktop        │
│              (MCP Client)                   │
└─────────────────┬───────────────────────────┘
                  │ MCP Protocol
                  │ (stdio transport)
                  │
┌─────────────────▼───────────────────────────┐
│         DirectGTD MCP Server                │
│                                             │
│  ┌─────────────────────────────────────┐   │
│  │  MCP Server (SDK)                   │   │
│  └─────────────┬───────────────────────┘   │
│                │                            │
│  ┌─────────────▼───────────────────────┐   │
│  │  Tool: directgtd_get_root_items     │   │
│  │  - Input validation (Zod)           │   │
│  │  - Database query                   │   │
│  │  - Formatting                       │   │
│  │  - Error handling                   │   │
│  └─────────────┬───────────────────────┘   │
│                │                            │
└────────────────┼────────────────────────────┘
                 │ SQLite query
                 │ (read-only)
                 │
┌────────────────▼────────────────────────────┐
│     DirectGTD SQLite Database               │
│     ~/Library/Application Support/          │
│     DirectGTD/directgtd.sqlite              │
└─────────────────────────────────────────────┘
```

### Data Flow

1. **Client Request**:
   - User asks Claude: "Show me my DirectGTD tasks"
   - Claude decides to use `directgtd_get_root_items` tool

2. **MCP Protocol**:
   - Request sent via stdio to MCP server
   - MCP SDK deserializes request

3. **Input Validation**:
   - Zod schema validates `response_format` parameter
   - Default applied if not specified

4. **Database Query**:
   - Open database in read-only mode
   - Execute: `SELECT * FROM items WHERE parent_id IS NULL ORDER BY sort_order`
   - Map database rows to formatted objects

5. **Response Formatting**:
   - Convert to Markdown or JSON based on parameter
   - Apply character limit (truncate if needed)
   - Format dates appropriately

6. **Response**:
   - Return MCP tool response
   - Close database connection
   - Claude presents result to user

### Component Breakdown

#### MCP Server (`McpServer`)

**Responsibilities**:
- Protocol compliance
- Tool registration
- Request routing
- Transport management

**Implementation**: From `@modelcontextprotocol/sdk`

#### StdioServerTransport

**Responsibilities**:
- Communication via stdin/stdout
- Message serialization/deserialization
- Connection management

**Implementation**: From `@modelcontextprotocol/sdk`

#### Tool Handler (async function)

**Responsibilities**:
- Parameter validation
- Database access
- Response formatting
- Error handling

**Implementation**: Custom (in `src/index.ts`)

#### Database Access Layer

**Functions**:
- `openDatabase()`: Opens read-only connection
- Database is closed in `finally` block

**Implementation**: Uses `better-sqlite3`

#### Formatting Layer

**Functions**:
- `formatItem()`: Converts DB row to API format
- `formatItemsAsMarkdown()`: Creates Markdown output
- `formatItemsAsJSON()`: Creates JSON output
- `formatDate()`: Formats dates for Markdown

**Implementation**: Pure functions, no side effects

#### Error Handling

**Function**: `handleDatabaseError(error: unknown): string`

**Responsibilities**:
- Detect error type (ENOENT, SQLITE_CANTOPEN, etc.)
- Return user-friendly error messages
- Provide actionable guidance

## Development Workflow

### Day-to-Day Development

1. **Make changes** to `src/index.ts` or `src/test.ts`

2. **Test in development mode**:
   ```bash
   npm run dev
   ```
   This uses `tsx watch` for auto-reload

3. **Build for testing**:
   ```bash
   npm run build
   npm test
   ```

4. **Test with actual MCP client**:
   ```bash
   # Rebuild
   npm run build

   # If using Claude Code, it automatically picks up changes
   # If using Claude Desktop, restart the app
   ```

### Making Changes

#### Modify Existing Tool

**Example**: Change character limit

1. Edit `src/index.ts`:
   ```typescript
   const CHARACTER_LIMIT = 50000; // Changed from 25000
   ```

2. Rebuild and test:
   ```bash
   npm run build
   npm test
   ```

#### Add New Parameter

**Example**: Add `limit` parameter to control max items

1. Update Zod schema:
   ```typescript
   const GetRootItemsInputSchema = z.object({
     response_format: z.nativeEnum(ResponseFormat)
       .optional()
       .default(ResponseFormat.MARKDOWN),
     limit: z.number()
       .int()
       .positive()
       .optional()
       .describe("Maximum number of items to return")
   }).strict();
   ```

2. Update tool handler:
   ```typescript
   async (params: { response_format?: ResponseFormat; limit?: number }) => {
     // ...
     const rows = stmt.all() as DirectGTDItem[];
     const limitedRows = params.limit ? rows.slice(0, params.limit) : rows;
     const items = limitedRows.map(formatItem);
     // ...
   }
   ```

3. Update documentation in tool description

4. Add tests for new parameter

#### Add New Tool

**Example**: Add `directgtd_get_item_by_id` tool

1. Define input schema:
   ```typescript
   const GetItemByIdInputSchema = z.object({
     item_id: z.string().describe("The ID of the item to retrieve")
   }).strict();
   ```

2. Register tool:
   ```typescript
   server.registerTool(
     "directgtd_get_item_by_id",
     {
       title: "Get DirectGTD Item by ID",
       description: "...",
       inputSchema: GetItemByIdInputSchema,
       annotations: {
         readOnlyHint: true,
         destructiveHint: false,
         idempotentHint: true,
         openWorldHint: false
       }
     },
     async (params: { item_id: string }) => {
       // Implementation
       const db = openDatabase();
       try {
         const query = "SELECT * FROM items WHERE id = ?";
         const item = db.prepare(query).get(params.item_id);
         // Format and return
       } finally {
         db.close();
       }
     }
   );
   ```

3. Add tests for new tool

4. Update documentation

## Building and Testing

### Build Commands

```bash
# Clean build
npm run clean
npm run build

# Development mode (auto-reload)
npm run dev

# Production build
npm run build
```

### Test Commands

```bash
# Run all tests
npm test

# Run tests with coverage (not configured yet)
# Future: Add coverage reporting
```

### Test Strategy

#### Unit Tests

Current tests in `src/test.ts`:
- Database existence
- Query correctness
- Sort order
- Schema validation
- Empty database handling

#### Integration Tests

Tests use real DirectGTD database:
- Requires DirectGTD to be installed
- Tests may skip if database doesn't exist
- Tests read actual data

#### Future Testing Ideas

- Mock database for unit tests
- Test error conditions
- Test truncation logic
- Test with large datasets
- Performance benchmarks

### Continuous Integration

**Not currently configured**

**Recommendations**:
- Set up GitHub Actions or similar
- Run tests on every commit
- Test on multiple Node versions
- Automated linting

## Adding New Features

### Example: Add Filtering Support

**Goal**: Allow filtering by completion status

#### 1. Design the API

**New parameter**:
```typescript
show_completed?: boolean  // If true, include completed items; if false, exclude them
```

#### 2. Update Schema

```typescript
const GetRootItemsInputSchema = z.object({
  response_format: z.nativeEnum(ResponseFormat)
    .optional()
    .default(ResponseFormat.MARKDOWN),
  show_completed: z.boolean()
    .optional()
    .default(true)
    .describe("Include completed items in results")
}).strict();
```

#### 3. Update Query Logic

```typescript
async (params: { response_format?: ResponseFormat; show_completed?: boolean }) => {
  const showCompleted = params.show_completed ?? true;

  // Modify query
  let query = "SELECT * FROM items WHERE parent_id IS NULL";
  if (!showCompleted) {
    query += " AND completed_at IS NULL";
  }
  query += " ORDER BY sort_order";

  const rows = db.prepare(query).all() as DirectGTDItem[];
  // ... rest of handler
}
```

#### 4. Add Tests

```typescript
test("get_root_items filters out completed items when show_completed is false", () => {
  // Test implementation
});
```

#### 5. Update Documentation

- Update API Reference
- Update Usage Guide with examples
- Add to CHANGELOG

### Example: Support Child Items

**Goal**: Retrieve items with a specific parent

#### 1. Create New Tool

**New tool**: `directgtd_get_children`

```typescript
const GetChildrenInputSchema = z.object({
  parent_id: z.string().describe("ID of the parent item"),
  response_format: z.nativeEnum(ResponseFormat).optional().default(ResponseFormat.MARKDOWN)
}).strict();

server.registerTool(
  "directgtd_get_children",
  {
    title: "Get DirectGTD Child Items",
    description: "Retrieve child items of a specific parent",
    inputSchema: GetChildrenInputSchema,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false
    }
  },
  async (params: { parent_id: string; response_format?: ResponseFormat }) => {
    const db = openDatabase();
    try {
      const query = "SELECT * FROM items WHERE parent_id = ? ORDER BY sort_order";
      const rows = db.prepare(query).all(params.parent_id) as DirectGTDItem[];
      // Format and return...
    } finally {
      db.close();
    }
  }
);
```

#### 2. Add Tests

#### 3. Update Documentation

## Code Style Guidelines

### TypeScript

- **Strict mode**: Enabled (`tsconfig.json`)
- **Explicit types**: Prefer explicit over inferred when public
- **Interfaces over types**: For object shapes
- **Enums**: Use for fixed sets of values

### Naming Conventions

- **Variables**: camelCase
- **Functions**: camelCase
- **Interfaces**: PascalCase
- **Enums**: PascalCase
- **Constants**: UPPER_SNAKE_CASE
- **Files**: kebab-case or camelCase

### Code Organization

- **Imports**: Group by external, SDK, Node built-ins
- **Constants**: Top of file after imports
- **Types**: After constants
- **Functions**: Utilities before main logic
- **Main**: At bottom

### Comments

- **Function docs**: JSDoc style for exported functions
- **Inline comments**: Explain "why", not "what"
- **TODO**: Mark with `// TODO:` and description

### Error Handling

- **Always use try/finally** for database connections
- **User-friendly errors**: Convert technical errors to helpful messages
- **Type guards**: Use `instanceof Error` before accessing `.message`

### Example Code Style

```typescript
/**
 * Formats a DirectGTD item from database format to API format.
 *
 * Converts snake_case database fields to camelCase API fields.
 *
 * @param item - Raw database item
 * @returns Formatted item for API response
 */
function formatItem(item: DirectGTDItem): FormattedItem {
  return {
    id: item.id,
    title: item.title,
    parentId: item.parent_id,
    sortOrder: item.sort_order,
    createdAt: item.created_at,
    modifiedAt: item.modified_at,
    completedAt: item.completed_at,
    dueDate: item.due_date,
    earliestStartTime: item.earliest_start_time
  };
}
```

## Contributing

### Before Contributing

1. **Check existing issues**: Avoid duplicate work
2. **Discuss major changes**: Open an issue first
3. **Read this guide**: Understand the architecture
4. **Test your changes**: Run tests before submitting

### Contribution Process

1. **Fork** the repository (if external contributor)

2. **Create a branch**:
   ```bash
   git checkout -b feature/your-feature-name
   ```

3. **Make changes**:
   - Follow code style guidelines
   - Add tests for new features
   - Update documentation

4. **Test thoroughly**:
   ```bash
   npm run build
   npm test
   ```

5. **Commit**:
   ```bash
   git add .
   git commit -m "feat: add support for filtering by completion status"
   ```

   Use conventional commit format:
   - `feat:` New feature
   - `fix:` Bug fix
   - `docs:` Documentation changes
   - `test:` Test additions/changes
   - `refactor:` Code refactoring
   - `chore:` Build/tooling changes

6. **Push**:
   ```bash
   git push origin feature/your-feature-name
   ```

7. **Submit Pull Request**:
   - Describe changes
   - Reference related issues
   - Include test results

### Contribution Guidelines

**Do**:
- ✅ Write tests for new features
- ✅ Update documentation
- ✅ Follow existing code style
- ✅ Keep commits focused and atomic
- ✅ Provide clear commit messages

**Don't**:
- ❌ Break existing tests
- ❌ Mix unrelated changes in one commit
- ❌ Submit without testing
- ❌ Forget to update documentation

## Release Process

### Version Numbering

Follow [Semantic Versioning](https://semver.org/):
- **MAJOR**: Breaking changes
- **MINOR**: New features (backward compatible)
- **PATCH**: Bug fixes

### Release Steps

1. **Update version** in `package.json`:
   ```json
   {
     "version": "1.1.0"
   }
   ```

2. **Update CHANGELOG**:
   - Document all changes since last release
   - Group by: Added, Changed, Fixed, Removed

3. **Update documentation**:
   - Verify all docs are current
   - Update version references

4. **Test thoroughly**:
   ```bash
   npm run clean
   npm install
   npm run build
   npm test
   ```

5. **Commit release**:
   ```bash
   git add .
   git commit -m "chore: release v1.1.0"
   ```

6. **Tag release**:
   ```bash
   git tag v1.1.0
   git push origin main --tags
   ```

7. **Build and publish** (if publishing to npm):
   ```bash
   npm publish
   ```

8. **Create GitHub release**:
   - Use tag as base
   - Include CHANGELOG content
   - Attach build artifacts if needed

## Advanced Topics

### Database Schema Changes

If DirectGTD changes its database schema:

1. **Identify changes**:
   ```bash
   sqlite3 ~/Library/Application\ Support/DirectGTD/directgtd.sqlite .schema
   ```

2. **Update types**:
   - Modify `DirectGTDItem` interface
   - Update `formatItem()` function

3. **Update tests**:
   - Adjust schema validation tests
   - Test with new schema

4. **Version bump**: This is likely a MINOR or MAJOR change

### Performance Optimization

**Current bottlenecks**:
1. Loading all root items into memory
2. Formatting before checking character limit
3. No caching

**Optimization ideas**:
1. Implement streaming for large datasets
2. Check character limit while formatting
3. Add LRU cache for recent queries
4. Use prepared statements (already done)
5. Pagination support

### Security Considerations

**Current security**:
- ✅ Read-only database access
- ✅ Input validation (Zod)
- ✅ No SQL injection (parameterized queries)
- ✅ Local-only access (no network)

**Future considerations**:
- Database encryption (if DirectGTD adds it)
- Audit logging
- Rate limiting (if needed)

### Multi-Platform Support

**To support Linux/Windows**:

1. **Make DB path configurable**:
   ```typescript
   const DB_PATH = process.env.DIRECTGTD_DB_PATH ||
     join(homedir(), 'Library/Application Support/DirectGTD/directgtd.sqlite');
   ```

2. **Add platform detection**:
   ```typescript
   function getDefaultDbPath(): string {
     const platform = process.platform;
     switch (platform) {
       case 'darwin':
         return join(homedir(), 'Library/Application Support/DirectGTD/directgtd.sqlite');
       case 'linux':
         return join(homedir(), '.local/share/DirectGTD/directgtd.sqlite');
       case 'win32':
         return join(homedir(), 'AppData/Local/DirectGTD/directgtd.sqlite');
       default:
         throw new Error(`Unsupported platform: ${platform}`);
     }
   }
   ```

3. **Update tests** for multiple platforms

4. **Document** platform-specific paths

## Next Steps for Developers

### Immediate Improvements

1. **Add more tools**:
   - Get item by ID
   - Get child items
   - Search items

2. **Add filtering**:
   - By completion status
   - By due date range
   - By creation date

3. **Add pagination**:
   - Offset/limit parameters
   - Cursor-based pagination

### Long-Term Roadmap

1. **Write operations** (if DirectGTD allows):
   - Create items
   - Update items
   - Mark complete/incomplete

2. **Advanced features**:
   - Full-text search
   - Aggregation (counts, statistics)
   - Batch operations

3. **Infrastructure**:
   - CI/CD pipeline
   - Automated releases
   - Code coverage reporting

4. **Multi-platform**:
   - Support Linux
   - Support Windows
   - Configurable database path

## Resources

### External Documentation

- [MCP SDK Documentation](https://github.com/anthropics/anthropic-sdk-typescript)
- [better-sqlite3 Documentation](https://github.com/WiseLibs/better-sqlite3)
- [Zod Documentation](https://zod.dev/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)

### Internal Documentation

- [Getting Started](./getting-started.md)
- [Installation](./installation.md)
- [Usage Guide](./usage.md)
- [API Reference](./api-reference.md)
- [Troubleshooting](./troubleshooting.md)

### Community

- MCP Community Forums
- DirectGTD User Community
- GitHub Issues
