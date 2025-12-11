# Realistic Test Plan - DirectGTD MCP Server

## What This App Actually Does
- One tool that queries root items from a SQLite database
- Returns them in markdown or JSON format
- That's it

## Tests You Actually Need (Can be done in 1-2 days)

### Core Functionality (Already Done ✅)
1. ✅ Database exists
2. ✅ Returns root items
3. ✅ Items sorted by sort_order
4. ✅ ParentId is null
5. ✅ Schema is correct

### What's Actually Missing (Add These)

#### Format Tests (30 min)
6. **Test JSON format parameter** - Call with `response_format: "json"`, verify JSON structure
7. **Test markdown format parameter** - Call with `response_format: "markdown"`, verify markdown
8. **Test default format** - Call without parameter, should default to markdown

#### Error Handling (30 min)
9. **Test missing database** - Verify error message when DB doesn't exist
10. **Test invalid format parameter** - Should reject `response_format: "xml"`

#### Edge Cases (30 min)
11. **Test empty database** - Verify graceful handling
12. **Test character truncation** - Verify truncation works if response > 25K chars

## That's It: 12 Total Tests

**Time to implement**: 1-2 hours
**Time to run**: < 5 seconds

## What You DON'T Need
- ❌ 3-week timeline
- ❌ 56 tasks
- ❌ Multiple phases
- ❌ Extensive integration testing for a tool with one function
- ❌ Performance testing for a local SQLite query
- ❌ Unicode/emoji tests (SQLite handles this)
- ❌ Concurrent request testing (premature)

## When to Add More Tests
**Only when you add more features!**

If you add:
- More tools → Test those tools
- Write operations → Test data integrity
- Complex queries → Test query logic
- Authentication → Test auth

## Action Items
1. Add tests 6-12 to src/test.ts (2 hours max)
2. Run tests
3. Ship it

**Done.**
