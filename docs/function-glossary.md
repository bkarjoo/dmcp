# Function Glossary

## `directgtd_get_root_items`
Get all top-level folders and projects (items with no parent).

## `directgtd_get_children`
Get all items inside a specific folder or project.

## `directgtd_get_item`
Get a single item by its ID.

## `directgtd_add_to_inbox`
Add a new task, note, or project to your Inbox (quick capture).

## `directgtd_create_item`
Create a new item in any folder or project.

## `directgtd_complete_task`
Mark a task as completed or uncompleted (only works with Tasks, not Notes/Projects).

## `directgtd_change_item_type`
Change an item's type (Task, Note, Project, Folder, etc.) to any other type.

## `directgtd_delete_item`
Permanently delete an item (and its children).

## `directgtd_move_item`
Move an item to a different parent folder or project.

## `directgtd_update_title`
Update an item's title.

## `directgtd_update_due_date`
Change or clear an item's due date.

## `directgtd_update_earliest_start_time`
Change or clear an item's earliest start time (defer/schedule).

## `directgtd_get_all_tags`
Get a list of all available tags in DirectGTD.

## `directgtd_add_tag_to_item`
Add a tag to an item.

## `directgtd_remove_tag_from_item`
Remove a tag from an item.

## `directgtd_get_item_tags`
Get all tags applied to an item.

## `directgtd_get_overdue_items`
Get all items that are past their due date and not completed.

## `directgtd_get_due_today`
Get all items due today.

## `directgtd_get_due_tomorrow`
Get all items due tomorrow.

## `directgtd_get_due_this_week`
Get all items due within the current week (Sunday to Saturday).

## `directgtd_swap_items`
Swap the sort order of two items (they must have the same parent).

## `directgtd_move_to_position`
Move an item to a specific position (0-based) among its siblings.

## `directgtd_reorder_children`
Reorder all children of a parent by providing an array of IDs in the desired order.

## `directgtd_get_available_tasks`
Get all available (actionable) tasks - the GTD "Next Actions" list. Returns incomplete tasks that are not deferred to the future.

## `directgtd_search_items`
Search for items by title. Returns just ID and title for each match.

## `directgtd_get_completed_tasks`
Get completed tasks, optionally filtered by parent folder and completion date.

## `directgtd_update_notes`
Set or clear an item's notes field. The app renders notes using Markdown.

## `directgtd_get_deferred_tasks`
Get tasks deferred to the future (GTD "Tickler" list). Tasks with earliest_start_time in the future.

## `directgtd_complete_multiple_tasks`
Mark multiple tasks as completed or uncompleted in a single operation (bulk completion).
