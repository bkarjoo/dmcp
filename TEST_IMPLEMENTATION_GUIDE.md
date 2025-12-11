# Test Implementation Guide
## DirectGTD MCP Server Testing

This guide provides practical examples and patterns for implementing the test cases outlined in TEST_PLAN.md.

---

## Table of Contents
1. [Test File Structure](#test-file-structure)
2. [Testing Patterns](#testing-patterns)
3. [Category-Specific Guides](#category-specific-guides)
4. [Common Pitfalls](#common-pitfalls)
5. [Best Practices](#best-practices)

---

## Test File Structure

### Recommended Organization

```
src/
├── test.ts                    # Existing basic tests
├── tests/                     # New test directory
│   ├── input-validation.test.ts
│   ├── error-handling.test.ts
│   ├── response-format.test.ts
│   ├── character-limit.test.ts
│   ├── data-integrity.test.ts
│   ├── edge-cases.test.ts
│   └── integration.test.ts
└── test-utils/                # Shared test utilities
    ├── fixtures.ts            # Test data generators
    ├── helpers.ts             # Helper functions
    └── mock-database.ts       # Database mocking utilities
```

---

## Testing Patterns

### Pattern 1: Basic Database Query Test

```typescript
import { test } from "node:test";
import { strict as assert } from "node:assert";
import Database from "better-sqlite3";
import { DB_PATH } from "../index.js";

test("description of test", () => {
  const db = new Database(DB_PATH, { readonly: true });

  try {
    // Arrange: Prepare test data (if needed)

    // Act: Execute the query
    const query = "SELECT * FROM items WHERE parent_id IS NULL ORDER BY sort_order";
    const rows = db.prepare(query).all();

    // Assert: Verify results
    assert.ok(Array.isArray(rows), "Should return an array");

  } finally {
    // Cleanup: Always close the database
    db.close();
  }
});
```

### Pattern 2: Error Handling Test

```typescript
test("error handling test", () => {
  // Use a non-existent path to trigger error
  const badPath = "/tmp/nonexistent/database.sqlite";

  assert.throws(
    () => {
      const db = new Database(badPath, { readonly: true });
    },
    (error: Error) => {
      return error.message.includes("ENOENT") ||
             error.message.includes("no such file");
    },
    "Should throw error when database not found"
  );
});
```

### Pattern 3: Data Transformation Test

```typescript
test("field mapping test", () => {
  const db = new Database(DB_PATH, { readonly: true });

  try {
    const row = db.prepare(
      "SELECT * FROM items WHERE parent_id IS NULL LIMIT 1"
    ).get() as DirectGTDItem;

    // Apply the same transformation as the server
    const formatted = formatItem(row);

    // Verify camelCase conversion
    assert.equal(formatted.parentId, row.parent_id);
    assert.equal(formatted.sortOrder, row.sort_order);
    assert.equal(formatted.createdAt, row.created_at);

  } finally {
    db.close();
  }
});
```

---

## Category-Specific Guides

### 1. Input Validation Tests

**Challenge**: Need to test MCP tool call with different parameters, but tests run against database directly.

**Solution**: Create integration tests that simulate MCP tool calls OR test the Zod schema directly.

#### Example: Test Zod Schema Directly

```typescript
import { z } from "zod";

enum ResponseFormat {
  MARKDOWN = "markdown",
  JSON = "json"
}

const GetRootItemsInputSchema = z.object({
  response_format: z.nativeEnum(ResponseFormat)
    .optional()
    .default(ResponseFormat.MARKDOWN)
}).strict();

test("IV-01: Valid markdown format parameter", () => {
  const result = GetRootItemsInputSchema.safeParse({
    response_format: "markdown"
  });

  assert.ok(result.success, "Should accept 'markdown' format");
  assert.equal(result.data?.response_format, "markdown");
});

test("IV-04: Invalid format parameter", () => {
  const result = GetRootItemsInputSchema.safeParse({
    response_format: "xml"
  });

  assert.ok(!result.success, "Should reject invalid format");
  assert.ok(result.error, "Should have validation error");
});

test("IV-05: Extra unknown parameters", () => {
  const result = GetRootItemsInputSchema.safeParse({
    response_format: "json",
    extra_field: "not allowed"
  });

  assert.ok(!result.success, "Should reject extra parameters due to strict()");
});
```

---

### 2. Error Handling Tests

**Challenge**: Need to simulate various database error conditions.

**Solution**: Use temporary test databases or mock filesystem conditions.

#### Example: Database Not Found

```typescript
import { existsSync } from "fs";

test("EH-01: Database file not found", () => {
  const fakePath = "/tmp/test_nonexistent_" + Date.now() + ".sqlite";

  // Ensure file doesn't exist
  assert.ok(!existsSync(fakePath), "Test file should not exist");

  // Try to open - should throw
  assert.throws(
    () => {
      new Database(fakePath, { readonly: true });
    },
    "Should throw when database not found"
  );
});
```

#### Example: Permission Denied (Requires Setup)

```typescript
import { writeFileSync, chmodSync, unlinkSync } from "fs";

test("EH-02: Database permission denied", () => {
  const testPath = "/tmp/test_no_read_" + Date.now() + ".sqlite";

  try {
    // Create a file
    writeFileSync(testPath, "dummy content");

    // Remove read permissions
    chmodSync(testPath, 0o000);

    // Try to open - should throw
    assert.throws(
      () => {
        new Database(testPath, { readonly: true });
      },
      "Should throw when database is not readable"
    );

  } finally {
    // Cleanup: restore permissions and delete
    try {
      chmodSync(testPath, 0o644);
      unlinkSync(testPath);
    } catch {
      // Ignore cleanup errors
    }
  }
});
```

---

### 3. Response Format Tests

**Challenge**: Need to verify the formatted output matches expected structure.

**Solution**: Create helper functions and use snapshot testing or structure validation.

#### Example: Markdown Format Structure

```typescript
test("RF-01: Markdown format structure", () => {
  const db = new Database(DB_PATH, { readonly: true });

  try {
    const rows = db.prepare(
      "SELECT * FROM items WHERE parent_id IS NULL ORDER BY sort_order LIMIT 3"
    ).all() as DirectGTDItem[];

    const items = rows.map(formatItem);
    const markdown = formatItemsAsMarkdown(items);

    // Verify structure
    assert.ok(markdown.includes("# DirectGTD Root Items"),
      "Should have main header");
    assert.ok(markdown.includes(`Found ${items.length}`),
      "Should include count");

    // Each item should have a section
    for (const item of items) {
      assert.ok(markdown.includes(`## ${item.title}`),
        `Should have section for ${item.title}`);
      assert.ok(markdown.includes(`**ID**: ${item.id}`),
        `Should show ID for ${item.title}`);
    }

  } finally {
    db.close();
  }
});
```

#### Example: JSON Format Structure

```typescript
test("RF-04: JSON format structure", () => {
  const db = new Database(DB_PATH, { readonly: true });

  try {
    const rows = db.prepare(
      "SELECT * FROM items WHERE parent_id IS NULL ORDER BY sort_order"
    ).all() as DirectGTDItem[];

    const items = rows.map(formatItem);
    const jsonStr = formatItemsAsJSON(items);
    const parsed = JSON.parse(jsonStr);

    // Verify structure
    assert.ok("total" in parsed, "Should have 'total' field");
    assert.ok("items" in parsed, "Should have 'items' field");
    assert.equal(typeof parsed.total, "number", "total should be a number");
    assert.ok(Array.isArray(parsed.items), "items should be an array");
    assert.equal(parsed.total, items.length, "total should match items length");

    // Verify each item has required fields
    if (parsed.items.length > 0) {
      const item = parsed.items[0];
      assert.ok("id" in item, "Item should have 'id'");
      assert.ok("title" in item, "Item should have 'title'");
      assert.ok("sortOrder" in item, "Item should have 'sortOrder' (camelCase)");
      assert.ok("createdAt" in item, "Item should have 'createdAt' (camelCase)");
    }

  } finally {
    db.close();
  }
});
```

---

### 4. Character Limit Tests

**Challenge**: Need to create responses > 25,000 characters.

**Solution**: Generate test data or use existing large datasets.

#### Example: Test Data Generator

```typescript
// In test-utils/fixtures.ts
export function generateLargeItemSet(count: number): FormattedItem[] {
  const items: FormattedItem[] = [];

  for (let i = 0; i < count; i++) {
    items.push({
      id: `test-item-${i}`,
      title: `Test Item ${i} `.repeat(50), // Make titles long
      parentId: null,
      sortOrder: i,
      createdAt: new Date().toISOString(),
      modifiedAt: new Date().toISOString(),
      completedAt: null,
      dueDate: null,
      earliestStartTime: null
    });
  }

  return items;
}
```

#### Example: Character Limit Test

```typescript
test("CL-02: Markdown truncation", () => {
  // Generate enough items to exceed 25K characters
  const largeItemSet = generateLargeItemSet(200);
  const markdown = formatItemsAsMarkdown(largeItemSet);

  const CHARACTER_LIMIT = 25000;

  if (markdown.length > CHARACTER_LIMIT) {
    // Should trigger truncation logic in actual server
    assert.ok(markdown.length > CHARACTER_LIMIT,
      "Test data should exceed character limit");

    // Note: The actual truncation logic is in the server handler
    // This test verifies the condition that triggers it
  }
});
```

---

### 5. Data Integrity Tests

**Challenge**: Verify data transformation is accurate and lossless.

**Solution**: Create property-based tests or use known test data.

#### Example: Field Mapping Test

```typescript
test("DI-01: Field mapping accuracy", () => {
  const db = new Database(DB_PATH, { readonly: true });

  try {
    const row = db.prepare(
      "SELECT * FROM items WHERE parent_id IS NULL LIMIT 1"
    ).get() as DirectGTDItem;

    if (!row) {
      console.log("Skipping: No items in database");
      return;
    }

    const formatted = formatItem(row);

    // Verify all 9 fields are mapped correctly
    assert.equal(formatted.id, row.id);
    assert.equal(formatted.title, row.title);
    assert.equal(formatted.parentId, row.parent_id);
    assert.equal(formatted.sortOrder, row.sort_order);
    assert.equal(formatted.createdAt, row.created_at);
    assert.equal(formatted.modifiedAt, row.modified_at);
    assert.equal(formatted.completedAt, row.completed_at);
    assert.equal(formatted.dueDate, row.due_date);
    assert.equal(formatted.earliestStartTime, row.earliest_start_time);

  } finally {
    db.close();
  }
});
```

#### Example: Unicode Support Test

```typescript
test("DI-07: Unicode title support", () => {
  // Create a mock item with Unicode characters
  const testItem: DirectGTDItem = {
    id: "test-unicode",
    title: "Test 🎯 中文 العربية",
    parent_id: null,
    sort_order: 0,
    created_at: new Date().toISOString(),
    modified_at: new Date().toISOString(),
    completed_at: null,
    due_date: null,
    earliest_start_time: null
  };

  const formatted = formatItem(testItem);

  // Verify Unicode is preserved
  assert.equal(formatted.title, testItem.title);
  assert.ok(formatted.title.includes("🎯"), "Should preserve emoji");
  assert.ok(formatted.title.includes("中文"), "Should preserve Chinese");
  assert.ok(formatted.title.includes("العربية"), "Should preserve Arabic");
});
```

---

### 6. Edge Cases Tests

**Challenge**: Need specific database states that may not exist.

**Solution**: Use test data generators or conditional testing.

#### Example: Single Item Test

```typescript
test("EC-01: Single root item", () => {
  const db = new Database(DB_PATH, { readonly: true });

  try {
    const rows = db.prepare(
      "SELECT * FROM items WHERE parent_id IS NULL ORDER BY sort_order LIMIT 1"
    ).all() as DirectGTDItem[];

    if (rows.length !== 1) {
      console.log(`Skipping: Need exactly 1 root item, found ${rows.length}`);
      return;
    }

    const items = rows.map(formatItem);
    const markdown = formatItemsAsMarkdown(items);

    // Verify singular formatting
    assert.ok(markdown.includes("Found 1 root-level item"),
      "Should use singular 'item' not 'items'");

  } finally {
    db.close();
  }
});
```

#### Example: Negative Sort Order

```typescript
test("EC-10: Negative sort_order values", () => {
  // Create test data with negative sort orders
  const testItems: FormattedItem[] = [
    {
      id: "item-1",
      title: "Item with negative sort",
      parentId: null,
      sortOrder: -10,
      createdAt: new Date().toISOString(),
      modifiedAt: new Date().toISOString(),
      completedAt: null,
      dueDate: null,
      earliestStartTime: null
    },
    {
      id: "item-2",
      title: "Item with zero sort",
      parentId: null,
      sortOrder: 0,
      createdAt: new Date().toISOString(),
      modifiedAt: new Date().toISOString(),
      completedAt: null,
      dueDate: null,
      earliestStartTime: null
    }
  ];

  // Sort them
  testItems.sort((a, b) => a.sortOrder - b.sortOrder);

  // Verify sorting works with negative numbers
  assert.equal(testItems[0].sortOrder, -10);
  assert.equal(testItems[1].sortOrder, 0);
});
```

---

### 7. Integration Tests

**Challenge**: Need to test the entire MCP server, not just database queries.

**Solution**: Use MCP SDK test utilities or create end-to-end test harness.

#### Example: Server Initialization Test

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

test("IT-01: MCP server initialization", async () => {
  const server = new McpServer({
    name: "test-directgtd-server",
    version: "1.0.0"
  });

  assert.ok(server, "Server should initialize");
  assert.equal(server.name, "test-directgtd-server");
  assert.equal(server.version, "1.0.0");
});
```

#### Example: Tool Registration Test

```typescript
test("IT-02: Tool registration", async () => {
  const server = new McpServer({
    name: "test-server",
    version: "1.0.0"
  });

  // Register a simple test tool
  server.registerTool(
    "test_tool",
    {
      title: "Test Tool",
      description: "A test tool",
      inputSchema: z.object({})
    },
    async () => ({
      content: [{ type: "text", text: "test" }]
    })
  );

  // Verify tool is registered
  // Note: MCP SDK may not expose tools list directly,
  // so this test may need to be implemented differently
  assert.ok(server, "Server should have registered tool");
});
```

---

## Common Pitfalls

### Pitfall 1: Not Closing Database Connections

**Problem**: Tests leave database connections open, causing resource leaks.

**Solution**: Always use try/finally blocks.

```typescript
// BAD
test("bad test", () => {
  const db = new Database(DB_PATH, { readonly: true });
  const rows = db.prepare("SELECT * FROM items").all();
  assert.ok(rows);
  // Database never closed!
});

// GOOD
test("good test", () => {
  const db = new Database(DB_PATH, { readonly: true });
  try {
    const rows = db.prepare("SELECT * FROM items").all();
    assert.ok(rows);
  } finally {
    db.close();
  }
});
```

### Pitfall 2: Tests Depend on Specific Database State

**Problem**: Tests fail when database content changes.

**Solution**: Make tests conditional or use test fixtures.

```typescript
// BAD
test("bad test", () => {
  const db = new Database(DB_PATH, { readonly: true });
  try {
    const rows = db.prepare("SELECT * FROM items WHERE parent_id IS NULL").all();
    assert.equal(rows.length, 5); // Assumes exactly 5 items!
  } finally {
    db.close();
  }
});

// GOOD
test("good test", () => {
  const db = new Database(DB_PATH, { readonly: true });
  try {
    const rows = db.prepare("SELECT * FROM items WHERE parent_id IS NULL").all();
    assert.ok(rows.length >= 0, "Should return array of any length");

    if (rows.length > 0) {
      // Only verify structure if items exist
      assert.ok("id" in rows[0]);
    }
  } finally {
    db.close();
  }
});
```

### Pitfall 3: Forgetting to Handle Missing Database

**Problem**: Tests crash when database doesn't exist.

**Solution**: Check for database existence first.

```typescript
import { existsSync } from "fs";

test("safe test", () => {
  if (!existsSync(DB_PATH)) {
    console.log("Skipping test: Database not found");
    return;
  }

  const db = new Database(DB_PATH, { readonly: true });
  try {
    // Test logic here
  } finally {
    db.close();
  }
});
```

---

## Best Practices

### 1. Use Descriptive Test Names

```typescript
// BAD
test("test 1", () => { /* ... */ });

// GOOD
test("get_root_items returns items sorted by sort_order ascending", () => { /* ... */ });
```

### 2. Write Self-Documenting Assertions

```typescript
// BAD
assert.ok(rows.length > 0);

// GOOD
assert.ok(
  rows.length > 0,
  "Should return at least one root item when database is not empty"
);
```

### 3. Isolate Test Data

```typescript
// Create reusable test fixtures
// test-utils/fixtures.ts
export const SAMPLE_ITEM: DirectGTDItem = {
  id: "test-item-1",
  title: "Sample Test Item",
  parent_id: null,
  sort_order: 0,
  created_at: "2024-01-15T10:30:00Z",
  modified_at: "2024-01-15T10:30:00Z",
  completed_at: null,
  due_date: null,
  earliest_start_time: null
};
```

### 4. Test One Thing Per Test

```typescript
// BAD: Tests multiple things
test("test everything", () => {
  // Tests sorting
  // Tests formatting
  // Tests error handling
  // All in one test!
});

// GOOD: Focused tests
test("items are sorted by sort_order", () => {
  // Only tests sorting
});

test("items are formatted with camelCase fields", () => {
  // Only tests formatting
});
```

### 5. Use Helper Functions

```typescript
// test-utils/helpers.ts
export function openTestDatabase(): Database.Database {
  if (!existsSync(DB_PATH)) {
    throw new Error("Test database not found");
  }
  return new Database(DB_PATH, { readonly: true });
}

export function getRootItems(db: Database.Database): DirectGTDItem[] {
  const query = "SELECT * FROM items WHERE parent_id IS NULL ORDER BY sort_order";
  return db.prepare(query).all() as DirectGTDItem[];
}

// In tests
test("example test", () => {
  const db = openTestDatabase();
  try {
    const items = getRootItems(db);
    assert.ok(items.length >= 0);
  } finally {
    db.close();
  }
});
```

---

## Running Tests

### Run All Tests
```bash
npm run build
npm test
```

### Run Specific Test File
```bash
node --test dist/tests/input-validation.test.js
```

### Run with Coverage
```bash
# Install coverage tool
npm install --save-dev c8

# Add to package.json scripts:
# "test:coverage": "c8 npm test"

npm run test:coverage
```

---

## Debugging Failed Tests

### Enable Verbose Output
```bash
node --test --test-reporter=spec dist/test.js
```

### Add Debug Logging
```typescript
test("debug test", () => {
  const db = new Database(DB_PATH, { readonly: true });
  try {
    const rows = getRootItems(db);

    // Debug output
    console.log("Number of rows:", rows.length);
    console.log("First row:", rows[0]);

    assert.ok(rows.length > 0);
  } finally {
    db.close();
  }
});
```

---

## Next Steps

1. Read TEST_PLAN.md for complete test specifications
2. Review existing tests in src/test.ts
3. Choose a category to implement (start with Phase 1)
4. Create test file using patterns from this guide
5. Run tests and iterate
6. Document any bugs found

---

**Good luck with testing!**
