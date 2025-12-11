# Simple Test Tasks - Do These Today

## Already Done ✅
- [x] Database exists
- [x] Returns root items
- [x] Items sorted correctly
- [x] ParentId is null
- [x] Schema correct
- [x] Empty database handling

## Add These (1-2 hours total)

### Format Tests
- [ ] Test JSON format explicitly (verify JSON structure with total and items fields)
- [ ] Test markdown format explicitly (verify markdown headers and bullets)
- [ ] Test default format when no parameter provided

### Error Tests
- [ ] Test database not found (verify helpful error message)
- [ ] Test invalid response_format value (should fail Zod validation)

### Edge Case
- [ ] Test character truncation when response exceeds 25K characters

## That's It
**6 new tests + 6 existing = 12 total tests**

You're building a simple tool. Keep testing simple too.

Add features first, then add tests for those features.
