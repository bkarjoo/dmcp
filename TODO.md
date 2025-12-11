# DirectGTD MCP Server - TODO

## ⚠️ IMPORTANT: Any implementation must be approved by the user before proceeding.

## 📝 NOTE: We implement 1 function at a time and test it thoroughly before moving to the next.

---

## 🔴 High Priority Improvements

### Search & Discovery
- [ ] `directgtd_search` - Full-text search across all items (titles + notes)
- [ ] `directgtd_filter_by_type` - Filter items by type (Task, Note, Project, Folder)

### Code Quality
- [ ] **Expand Tests** - Add integration tests, write operation tests
- [ ] **Modularize Code** - Split index.ts into separate modules

---

## 🟡 Medium Priority Improvements

### Bulk Operations
- [ ] `directgtd_move_multiple_items` - Move multiple items to a new parent
- [ ] `directgtd_delete_multiple_items` - Delete multiple items at once
- [ ] `directgtd_add_tag_to_multiple_items` - Apply tag to multiple items
- [ ] `directgtd_remove_tag_from_multiple_items` - Remove tag from multiple items

### Performance Optimization
- [ ] Add `include_children` option to `directgtd_get_children` - Reduce round trips
- [ ] Add `include_children` option to `directgtd_get_root_items` - Get full tree

### Documentation
- [ ] **Add Evaluations** - Create evaluation questions per MCP best practices

---

## 🟢 Low Priority Enhancements

### Statistics & Reporting
- [ ] `directgtd_get_stats` - Task counts, completion rates
- [ ] `directgtd_get_productivity_report` - Completion rates over time
- [ ] `directgtd_get_tag_statistics` - Usage statistics per tag

### Undo Support
- [ ] `directgtd_undo_last_action` - Integration with DirectGTD undo system

### Advanced Organization
- [ ] `directgtd_copy_item` - Create a copy of an item
- [ ] `directgtd_duplicate_structure` - Duplicate item with all children
- [ ] `directgtd_merge_tags` - Merge two tags into one

### Bulk Import/Export
- [ ] `directgtd_export_to_json` - Export items/structure to JSON
- [ ] `directgtd_import_from_json` - Import items from JSON

### GTD Workflows
- [ ] **Inbox Processing** - Guide user through clarify/organize for each inbox item
- [ ] **Review** - Daily and weekly review workflows
- [ ] **Runway** - Next actions, calendar, waiting-for (ground level)
- [ ] **Altitude Planning** - Projects (10k), Areas of focus (20k), Goals (30k), Vision (40k), Purpose (50k)

### Next Action Suggestions
- [x] `directgtd_get_dashboard` - Show all Next + urgent + overdue items in one view
- [ ] `directgtd_suggest_next_actions` - Surface actionable items for user to choose from
- [ ] `directgtd_get_stuck_projects` - Find projects with no Next-tagged items anywhere in their tree (recursive)

### Quick Actions
- [ ] `directgtd_quick_capture` - Capture with natural language parsing

### Relationships
- [ ] `directgtd_link_items` - Create relationship between items
- [ ] `directgtd_get_linked_items` - Get items linked to an item

### Backup & Maintenance
- [ ] `directgtd_backup_database` - Create database backup
- [ ] `directgtd_verify_database` - Check database integrity
