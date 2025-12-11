# DirectGTD MCP Server - Comprehensive Test Plan

## Test Team Assessment
**Date**: 2025-11-18
**Project**: DirectGTD MCP Server v1.0.0
**Scope**: Read-only MCP server with `directgtd_get_root_items` tool

---

## Executive Summary

This document outlines comprehensive test cases for the DirectGTD MCP Server. The existing test suite (src/test.ts) covers basic database operations. This plan identifies 35+ additional test scenarios across 7 categories to ensure production readiness.

---

## Current Test Coverage (Implemented)

| Test ID | Test Name | Status | File Location |
|---------|-----------|--------|---------------|
| DB-01 | Database exists | ✅ Implemented | src/test.ts:28 |
| DB-02 | Returns items when database has root items | ✅ Implemented | src/test.ts:35 |
| DB-03 | Returns empty array when no root items exist | ✅ Implemented | src/test.ts:60 |
| DB-04 | Items are sorted by sort_order | ✅ Implemented | src/test.ts:92 |
| DB-05 | All returned items have null parentId | ✅ Implemented | src/test.ts:124 |
| DB-06 | Database schema has expected columns | ✅ Implemented | src/test.ts:152 |

**Coverage**: Basic database operations and schema validation

---

## Missing Test Coverage - Priority Categories

### Category 1: Input Validation Tests (HIGH PRIORITY)

| Test ID | Test Name | Description | Expected Outcome |
|---------|-----------|-------------|------------------|
| IV-01 | Valid markdown format parameter | Call with `response_format: "markdown"` | Returns markdown formatted response |
| IV-02 | Valid JSON format parameter | Call with `response_format: "json"` | Returns JSON formatted response |
| IV-03 | Default format parameter | Call without `response_format` parameter | Returns markdown (default) |
| IV-04 | Invalid format parameter | Call with `response_format: "xml"` | Validation error from Zod schema |
| IV-05 | Extra unknown parameters | Call with extra fields in request | Strict schema should reject |
| IV-06 | Null format parameter | Call with `response_format: null` | Uses default (markdown) |

**Rationale**: Input validation is critical for security and preventing unexpected behavior.

---

### Category 2: Error Handling Tests (HIGH PRIORITY)

| Test ID | Test Name | Description | Expected Outcome |
|---------|-----------|-------------|------------------|
| EH-01 | Database file not found | Test with non-existent DB path | Error message: "Error: Database not found" |
| EH-02 | Database permission denied | Test with read-protected DB file | Error message: "Error: Cannot open database" |
| EH-03 | Corrupted database file | Test with corrupted SQLite file | Error message: "Error: Database file is corrupted" |
| EH-04 | Database connection failure | Simulate connection failure | Proper error handling with cleanup |
| EH-05 | Invalid SQL in database | Test schema mismatch scenarios | Graceful error with helpful message |
| EH-06 | Database locked | Test with locked database file | Proper error message |

**Rationale**: Users need clear, actionable error messages for troubleshooting.

---

### Category 3: Response Format Tests (MEDIUM PRIORITY)

| Test ID | Test Name | Description | Expected Outcome |
|---------|-----------|-------------|------------------|
| RF-01 | Markdown format structure | Verify markdown headers, bullets, formatting | Proper markdown syntax |
| RF-02 | Markdown date formatting | Verify dates are human-readable | Format: "Jan 15, 2024, 10:30 AM EST" |
| RF-03 | Markdown optional field handling | Test with/without optional fields | Only populated fields shown |
| RF-04 | JSON format structure | Verify JSON has `total` and `items` | Valid JSON with correct schema |
| RF-05 | JSON field mapping | Verify snake_case → camelCase conversion | All fields properly converted |
| RF-06 | JSON null handling | Verify null values in optional fields | Null preserved (not undefined) |
| RF-07 | JSON empty array | Test JSON with 0 items | `{"total": 0, "items": []}` |
| RF-08 | Markdown empty state | Test markdown with 0 items | "No root items found in DirectGTD database." |

**Rationale**: Both format outputs must be correct and consistent.

---

### Category 4: Character Limit Tests (HIGH PRIORITY)

| Test ID | Test Name | Description | Expected Outcome |
|---------|-----------|-------------|------------------|
| CL-01 | Response under 25K characters | Normal response size | Full response returned |
| CL-02 | Markdown truncation | Force response > 25K chars | Truncated with note |
| CL-03 | JSON truncation | Force JSON response > 25K chars | Truncated with `truncated: true` field |
| CL-04 | Truncation message presence | Verify truncation message in both formats | Clear message explaining truncation |
| CL-05 | Truncation at boundary | Test exactly at 25K character limit | Proper handling |
| CL-06 | Minimum truncation | Ensure at least 1 item returned when truncated | Never return completely empty |

**Rationale**: Character limits prevent overwhelming responses and ensure performance.

---

### Category 5: Data Integrity Tests (MEDIUM PRIORITY)

| Test ID | Test Name | Description | Expected Outcome |
|---------|-----------|-------------|------------------|
| DI-01 | Field mapping accuracy | Verify all 9 fields map correctly | Exact mapping verified |
| DI-02 | ID field preservation | Verify IDs are strings and preserved | No ID modification |
| DI-03 | Title field handling | Test titles with special characters | Proper encoding/escaping |
| DI-04 | Sort order data type | Verify sortOrder is number | Numeric type preserved |
| DI-05 | Date field types | Verify date fields are strings (ISO 8601) | String format preserved |
| DI-06 | Null vs undefined | Verify null fields are null, not undefined | Correct null handling |
| DI-07 | Unicode title support | Test titles with emoji, Chinese, Arabic | Proper UTF-8 handling |
| DI-08 | Very long title | Test with 1000+ character title | Properly handled |

**Rationale**: Data must be accurately transformed without loss or corruption.

---

### Category 6: Edge Cases (MEDIUM PRIORITY)

| Test ID | Test Name | Description | Expected Outcome |
|---------|-----------|-------------|------------------|
| EC-01 | Single root item | Database with exactly 1 root item | Correct singular formatting |
| EC-02 | Large number of root items | Database with 1000+ root items | Performance and truncation |
| EC-03 | All optional fields populated | Item with all fields set | All fields displayed |
| EC-04 | No optional fields populated | Item with only required fields | Only required fields shown |
| EC-05 | Mixed completion states | Some completed, some not | Correct display for each |
| EC-06 | Future due dates | Items with dates in future | Proper date formatting |
| EC-07 | Past due dates | Items with dates in past | Proper date formatting |
| EC-08 | Very old timestamps | Dates from years ago | Correct parsing |
| EC-09 | Items with same sort_order | Multiple items with identical sort_order | Stable sorting |
| EC-10 | Negative sort_order | Items with negative numbers | Correct sorting |

**Rationale**: Edge cases often reveal bugs in production scenarios.

---

### Category 7: Integration Tests (LOW PRIORITY)

| Test ID | Test Name | Description | Expected Outcome |
|---------|-----------|-------------|------------------|
| IT-01 | MCP server initialization | Test server starts correctly | Server running via stdio |
| IT-02 | Tool registration | Verify tool is registered with correct name | "directgtd_get_root_items" available |
| IT-03 | Tool metadata | Verify tool description and schema | Complete metadata present |
| IT-04 | Tool annotations | Verify readOnly, idempotent hints | Correct annotations |
| IT-05 | Transport connection | Test stdio transport connection | Successful connection |
| IT-06 | Database cleanup on error | Verify DB closes even on error | No resource leaks |
| IT-07 | Concurrent requests | Multiple simultaneous tool calls | Proper handling (each gets own DB connection) |
| IT-08 | End-to-end with Claude Code | Full integration test via MCP | Complete workflow works |

**Rationale**: Integration tests verify the entire system works together.

---

## Test Execution Priority

### Phase 1 - Critical (Week 1)
- All **Input Validation Tests** (IV-01 through IV-06)
- All **Error Handling Tests** (EH-01 through EH-06)
- All **Character Limit Tests** (CL-01 through CL-06)

### Phase 2 - Important (Week 2)
- All **Response Format Tests** (RF-01 through RF-08)
- All **Data Integrity Tests** (DI-01 through DI-08)

### Phase 3 - Complete Coverage (Week 3)
- All **Edge Cases** (EC-01 through EC-10)
- All **Integration Tests** (IT-01 through IT-08)

---

## Test Data Requirements

### Minimum Test Database States Needed:
1. **Empty database**: 0 items total
2. **Single root item**: 1 root item, 0 children
3. **Multiple root items**: 5+ root items with varying fields
4. **Large dataset**: 100+ root items (for performance testing)
5. **Maximum fields**: Items with all optional fields populated
6. **Minimum fields**: Items with only required fields
7. **Mixed completion**: Some completed, some active
8. **Special characters**: Titles with Unicode, emoji, special chars

---

## Test Environment Setup

### Prerequisites:
1. DirectGTD installed with database at: `~/Library/Application Support/DirectGTD/directgtd.sqlite`
2. Node.js 18+ installed
3. Built server: `npm run build`
4. Test runner available: `npm test`

### Test Data Seeding:
Since this is read-only, test data must be created via the DirectGTD application or direct database manipulation for testing purposes.

---

## Success Criteria

The test suite is considered complete when:
- ✅ All 41 test cases have passing implementations
- ✅ Code coverage is ≥ 90% for src/index.ts
- ✅ All error scenarios have proper error messages
- ✅ Both response formats (JSON, Markdown) are fully validated
- ✅ Performance testing shows < 100ms response time for typical queries
- ✅ No memory leaks detected (database connections properly closed)
- ✅ Integration test with Claude Code succeeds end-to-end

---

## Known Limitations

1. **Database schema changes**: Tests may break if DirectGTD changes schema
2. **Platform dependency**: Tests assume macOS path (`~/Library/Application Support/`)
3. **Read-only testing**: Cannot test write operations (by design)
4. **Requires live database**: Tests need actual DirectGTD database file

---

## Recommendations

### Immediate Actions:
1. ✅ Implement all Phase 1 (Critical) tests first
2. ✅ Create test database fixtures for consistent testing
3. ✅ Add code coverage reporting (Istanbul/c8)
4. ✅ Set up CI/CD pipeline with automated test execution

### Future Enhancements:
1. Add performance benchmarking tests
2. Create mock database for unit testing (reduce dependency on live DB)
3. Add mutation testing to verify test quality
4. Create test data generators for edge cases
5. Add load testing for concurrent request handling

---

## Test Metrics to Track

| Metric | Target | Current |
|--------|--------|---------|
| Test Cases Implemented | 41 | 6 |
| Code Coverage | 90% | ~40% (estimated) |
| Pass Rate | 100% | 100% |
| Average Test Execution Time | < 5s | ~2s |
| Error Scenarios Covered | 6 | 0 |

---

## Appendix A: Test Case Template

```typescript
test("Test Name", () => {
  // Arrange: Set up test data and preconditions

  // Act: Execute the functionality being tested

  // Assert: Verify expected outcomes

  // Cleanup: Close connections, restore state
});
```

---

## Appendix B: Example Test Implementations

### Example 1: Input Validation Test
```typescript
test("IV-01: Valid markdown format parameter", async () => {
  // Would test calling the tool with explicit markdown format
  // This requires MCP server testing infrastructure
});
```

### Example 2: Error Handling Test
```typescript
test("EH-01: Database file not found", () => {
  const fakePath = "/nonexistent/path/database.sqlite";
  // Mock or modify DB_PATH temporarily
  // Call function and verify error message matches expected
});
```

### Example 3: Character Limit Test
```typescript
test("CL-02: Markdown truncation", () => {
  // Create or use database with many items
  // Verify response length and truncation message
});
```

---

**End of Test Plan**
