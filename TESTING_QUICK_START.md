# Testing Quick Start Guide
## DirectGTD MCP Server - Test Team

**Quick reference for test team members to get started immediately.**

---

## ⚡ Quick Start (5 Minutes)

### 1. Understand What You're Testing

**Project**: DirectGTD MCP Server
**Purpose**: Read-only MCP server that retrieves root items from DirectGTD task database
**Main Tool**: `directgtd_get_root_items`
**Your Role**: Test team - you may NOT modify src/index.ts, only test it

### 2. Run Existing Tests

```bash
# Build the project
npm run build

# Run tests
npm test
```

**Expected Output**: 6 passing tests

### 3. Check Coverage

```bash
# Install coverage tool (first time only)
npm install --save-dev c8

# Add to package.json scripts section:
# "test:coverage": "c8 npm test"

# Run with coverage
npm run test:coverage
```

**Current Coverage**: ~40% (estimated)
**Target Coverage**: 90%

---

## 📚 Documentation Overview

| Document | Purpose | When to Use |
|----------|---------|-------------|
| **TEST_PLAN.md** | Complete test specification with all 41+ test cases | Planning & reference |
| **TEST_TASKS.md** | Checklist of all tasks to complete | Daily task tracking |
| **TEST_IMPLEMENTATION_GUIDE.md** | Code examples and patterns for writing tests | When writing tests |
| **TESTING_QUICK_START.md** (this file) | Quick reference | Getting started |

---

## 🎯 Your First Test (10 Minutes)

Let's implement **IV-01**: Test valid markdown format parameter

### Step 1: Create Test File

```bash
mkdir -p src/tests
touch src/tests/input-validation.test.ts
```

### Step 2: Write the Test

```typescript
import { test } from "node:test";
import { strict as assert } from "node:assert";
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
```

### Step 3: Build and Run

```bash
npm run build
node --test dist/tests/input-validation.test.js
```

**Expected**: ✅ Test passes

---

## 🔧 Common Test Patterns

### Pattern 1: Database Query Test

```typescript
import Database from "better-sqlite3";
import { homedir } from "os";
import { join } from "path";

const DB_PATH = join(homedir(), "Library/Application Support/DirectGTD/directgtd.sqlite");

test("test name", () => {
  const db = new Database(DB_PATH, { readonly: true });
  try {
    const rows = db.prepare("SELECT * FROM items WHERE parent_id IS NULL").all();
    assert.ok(Array.isArray(rows));
  } finally {
    db.close(); // ALWAYS close!
  }
});
```

### Pattern 2: Error Test

```typescript
test("error test", () => {
  assert.throws(
    () => {
      // Code that should throw
      new Database("/fake/path.sqlite", { readonly: true });
    },
    "Expected error message"
  );
});
```

### Pattern 3: Validation Test

```typescript
test("validation test", () => {
  const result = SomeSchema.safeParse({ /* data */ });

  assert.ok(result.success, "Should be valid");
  // or
  assert.ok(!result.success, "Should be invalid");
});
```

---

## 📋 Test Implementation Checklist

For each test you implement:

- [ ] Test name is descriptive (follows "IV-01" format from TEST_PLAN.md)
- [ ] Test has clear Arrange/Act/Assert structure
- [ ] Database connections are closed (use try/finally)
- [ ] Assertions have descriptive messages
- [ ] Test handles missing database gracefully (if applicable)
- [ ] Test is independent (doesn't depend on other tests)
- [ ] Test passes when you run it
- [ ] Mark task as complete in TEST_TASKS.md

---

## 🚨 Critical Rules

### ❌ DO NOT:
1. Modify src/index.ts (you're the test team!)
2. Write to the database (read-only testing)
3. Leave database connections open
4. Make tests depend on specific database content
5. Skip error handling in tests

### ✅ DO:
1. Close all database connections (use finally blocks)
2. Write descriptive test names and assertions
3. Handle missing database gracefully
4. Test one thing per test
5. Document bugs you find (don't fix them yourself)

---

## 🐛 Found a Bug?

When you find a bug:

1. **Stop** - Don't try to fix it (you're the test team!)
2. **Document** - Create a bug report with:
   - Test case that exposed the bug
   - Steps to reproduce
   - Expected behavior
   - Actual behavior
   - Error messages/stack traces
3. **Report** - Share with development team
4. **Continue** - Move to next test

### Bug Report Template

```markdown
## Bug Report

**Test ID**: IV-01
**Test Name**: Valid markdown format parameter

**Steps to Reproduce**:
1. Call tool with response_format: "markdown"
2. Observe output

**Expected**: Should return markdown formatted text
**Actual**: Returns JSON instead

**Error Message**: None

**Code Location**: src/index.ts:245
```

---

## 📊 Progress Tracking

### Daily Check-in

Update TEST_TASKS.md with your progress:
- Mark completed tasks with [x]
- Add notes about blocked items
- Report any bugs found

### Weekly Metrics

Track these metrics:
- Tests implemented this week: ___/___
- Tests passing: ___/___
- Code coverage: ___%
- Bugs found: ___

---

## 🎓 Learning Resources

### Key Concepts to Understand

1. **MCP (Model Context Protocol)**: Protocol for LLM tool integration
2. **SQLite**: Database being queried
3. **Zod**: Input validation library
4. **Node.js test runner**: Built-in test framework

### Documentation Links

- Node.js test runner: https://nodejs.org/api/test.html
- Zod validation: https://zod.dev/
- better-sqlite3: https://github.com/WiseLibs/better-sqlite3
- MCP SDK: https://github.com/modelcontextprotocol/sdk

---

## 🔍 Debugging Tips

### Test Won't Pass?

1. **Check database exists**: `ls ~/Library/Application\ Support/DirectGTD/`
2. **Check build**: `npm run build` (rebuild after changes)
3. **Add logging**: `console.log()` for debug output
4. **Run single test**: `node --test dist/tests/filename.test.js`
5. **Check error messages**: Read them carefully!

### Common Errors

**Error**: "Cannot find module"
- **Fix**: Run `npm run build` first

**Error**: "Database not found"
- **Fix**: Ensure DirectGTD app is installed and has created database

**Error**: "Connection busy"
- **Fix**: You forgot to close a database connection!

---

## 🎯 This Week's Goals

### Week 1 (Critical Tests)

Focus on these categories:
1. Input Validation (6 tests)
2. Error Handling (6 tests)
3. Character Limit (6 tests)

**Target**: Complete 18 critical tests

### Week 2 (Important Tests)

Focus on these categories:
1. Response Format (8 tests)
2. Data Integrity (8 tests)

**Target**: Complete 16 important tests

### Week 3 (Complete Coverage)

Focus on these categories:
1. Edge Cases (10 tests)
2. Integration Tests (8 tests)

**Target**: Complete 18 coverage tests

---

## 🤝 Getting Help

### Questions?

1. Check TEST_IMPLEMENTATION_GUIDE.md for code examples
2. Review existing tests in src/test.ts
3. Ask team lead for clarification

### Stuck?

1. Document where you're stuck
2. Show what you've tried
3. Ask specific questions

---

## ✅ Daily Workflow

### Morning (30 min)
1. Pull latest code: `git pull`
2. Build: `npm run build`
3. Run existing tests: `npm test`
4. Review TEST_TASKS.md - choose today's tests

### Work Session (2-4 hours)
1. Create/open test file
2. Write test following patterns from guide
3. Build and run: `npm run build && node --test dist/tests/yourfile.test.js`
4. Fix any issues
5. Mark task complete in TEST_TASKS.md

### End of Day (15 min)
1. Run all tests: `npm test`
2. Update progress in TEST_TASKS.md
3. Document any bugs found
4. Commit your test files (if using git)

---

## 📈 Success Metrics

You're doing great if:
- ✅ All your tests pass
- ✅ Tests are independent (can run in any order)
- ✅ No database connections left open
- ✅ Clear, descriptive test names
- ✅ Good assertion messages
- ✅ Bugs are documented, not "fixed"

---

## 🚀 Ready to Start?

1. ✅ Read this quick start guide
2. ✅ Run existing tests to verify setup
3. ✅ Choose first test from TEST_TASKS.md (suggest IV-01)
4. ✅ Use TEST_IMPLEMENTATION_GUIDE.md for code examples
5. ✅ Write your test
6. ✅ Celebrate when it passes! 🎉

**Remember**: You're the test team - your job is to find problems, not fix them!

Good luck! 🧪
