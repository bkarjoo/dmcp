# DirectGTD MCP Server - Test Tasks Checklist

## Instructions
This file contains all test tasks that need to be completed. Copy these tasks into DirectGTD or your preferred task management system.

---

## Phase 1: Critical Tests (Week 1)

### Input Validation Tests
- [ ] **IV-01**: Test valid markdown format parameter
- [ ] **IV-02**: Test valid JSON format parameter
- [ ] **IV-03**: Test default format parameter (no param provided)
- [ ] **IV-04**: Test invalid format parameter (should fail validation)
- [ ] **IV-05**: Test extra unknown parameters (strict schema rejection)
- [ ] **IV-06**: Test null format parameter (should use default)

### Error Handling Tests
- [ ] **EH-01**: Test database file not found error
- [ ] **EH-02**: Test database permission denied error
- [ ] **EH-03**: Test corrupted database file error
- [ ] **EH-04**: Test database connection failure
- [ ] **EH-05**: Test invalid SQL/schema mismatch scenarios
- [ ] **EH-06**: Test database locked error

### Character Limit Tests
- [ ] **CL-01**: Test response under 25K characters
- [ ] **CL-02**: Test markdown truncation (response > 25K)
- [ ] **CL-03**: Test JSON truncation (response > 25K)
- [ ] **CL-04**: Verify truncation message presence in both formats
- [ ] **CL-05**: Test truncation at exact 25K character boundary
- [ ] **CL-06**: Ensure minimum 1 item returned when truncated

---

## Phase 2: Important Tests (Week 2)

### Response Format Tests
- [ ] **RF-01**: Verify markdown format structure (headers, bullets)
- [ ] **RF-02**: Verify markdown date formatting is human-readable
- [ ] **RF-03**: Test markdown optional field handling
- [ ] **RF-04**: Verify JSON format structure (total, items fields)
- [ ] **RF-05**: Verify JSON field mapping (snake_case to camelCase)
- [ ] **RF-06**: Verify JSON null handling in optional fields
- [ ] **RF-07**: Test JSON with 0 items (empty array)
- [ ] **RF-08**: Test markdown with 0 items (empty state message)

### Data Integrity Tests
- [ ] **DI-01**: Verify field mapping accuracy (all 9 fields)
- [ ] **DI-02**: Verify ID field preservation (no modification)
- [ ] **DI-03**: Test title field with special characters
- [ ] **DI-04**: Verify sortOrder is numeric type
- [ ] **DI-05**: Verify date fields are string (ISO 8601) type
- [ ] **DI-06**: Verify null vs undefined handling
- [ ] **DI-07**: Test Unicode title support (emoji, Chinese, Arabic)
- [ ] **DI-08**: Test very long title (1000+ characters)

---

## Phase 3: Complete Coverage (Week 3)

### Edge Cases
- [ ] **EC-01**: Test single root item (exactly 1)
- [ ] **EC-02**: Test large number of root items (1000+)
- [ ] **EC-03**: Test item with all optional fields populated
- [ ] **EC-04**: Test item with no optional fields populated
- [ ] **EC-05**: Test mixed completion states
- [ ] **EC-06**: Test future due dates
- [ ] **EC-07**: Test past due dates
- [ ] **EC-08**: Test very old timestamps (years ago)
- [ ] **EC-09**: Test items with same sort_order (stable sorting)
- [ ] **EC-10**: Test negative sort_order values

### Integration Tests
- [ ] **IT-01**: Test MCP server initialization
- [ ] **IT-02**: Verify tool registration (correct name)
- [ ] **IT-03**: Verify tool metadata (description, schema)
- [ ] **IT-04**: Verify tool annotations (readOnly, idempotent)
- [ ] **IT-05**: Test stdio transport connection
- [ ] **IT-06**: Verify database cleanup on error (no leaks)
- [ ] **IT-07**: Test concurrent requests handling
- [ ] **IT-08**: End-to-end test with Claude Code

---

## Setup Tasks

- [ ] **SETUP-01**: Create test database fixtures
- [ ] **SETUP-02**: Set up code coverage reporting (c8 or Istanbul)
- [ ] **SETUP-03**: Configure CI/CD pipeline for automated tests
- [ ] **SETUP-04**: Create test data generator scripts
- [ ] **SETUP-05**: Document test environment setup process

---

## Documentation Tasks

- [ ] **DOC-01**: Document each test case implementation
- [ ] **DOC-02**: Create test execution guide
- [ ] **DOC-03**: Document test data requirements
- [ ] **DOC-04**: Create troubleshooting guide for failed tests
- [ ] **DOC-05**: Update README with testing instructions

---

## Metrics & Reporting Tasks

- [ ] **METRICS-01**: Track code coverage (target: 90%)
- [ ] **METRICS-02**: Track test pass rate (target: 100%)
- [ ] **METRICS-03**: Measure test execution time (target: < 5s total)
- [ ] **METRICS-04**: Generate test coverage report
- [ ] **METRICS-05**: Create test results dashboard

---

## Total Tasks: 56

**Phase 1 (Critical)**: 18 tests
**Phase 2 (Important)**: 16 tests
**Phase 3 (Complete)**: 18 tests
**Setup**: 5 tasks
**Documentation**: 5 tasks
**Metrics**: 5 tasks

---

## Priority Legend
- **Critical**: Must be completed before any release
- **Important**: Should be completed for production readiness
- **Complete**: Nice to have for comprehensive coverage

---

## Notes for Test Team

1. **No code modifications allowed** - Test team may not modify src/index.ts
2. **Read-only testing** - All tests must work with read-only database access
3. **Test isolation** - Each test should be independent and not affect others
4. **Clean up resources** - Always close database connections
5. **Clear assertions** - Use descriptive error messages in assertions
6. **Document failures** - Record any bugs found with reproduction steps

---

## Bug Tracking

When bugs are found during testing:
1. Document the test case that failed
2. Record exact steps to reproduce
3. Include error messages and stack traces
4. Note expected vs actual behavior
5. Create a bug report (separate from this task list)

---

**Test Team Lead**: [To be assigned]
**Start Date**: 2025-11-18
**Target Completion**: 3 weeks from start
