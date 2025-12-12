#!/usr/bin/env node
/**
 * MCP Server for DirectGTD task management.
 *
 * This server provides tools to interact with the DirectGTD SQLite database,
 * allowing users to query and retrieve task information.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import Database from "better-sqlite3";
import { homedir } from "os";
import { join } from "path";

// Constants
const DB_PATH = join(homedir(), "Library/Application Support/DirectGTD/directgtd.sqlite");
const CHARACTER_LIMIT = 25000;

// Enums
enum ResponseFormat {
  MARKDOWN = "markdown",
  JSON = "json"
}

// Zod schemas
const GetRootItemsInputSchema = z.object({
  response_format: z.nativeEnum(ResponseFormat)
    .optional()
    .default(ResponseFormat.MARKDOWN)
    .describe("Output format: 'markdown' for human-readable or 'json' for machine-readable")
}).strict();

const GetChildrenInputSchema = z.object({
  parent_id: z.string()
    .min(1)
    .describe("The ID of the parent item whose children to retrieve. Example: '2EADCE4C-538A-444F-BE61-B4AF0047B2EC'"),
  response_format: z.nativeEnum(ResponseFormat)
    .optional()
    .default(ResponseFormat.MARKDOWN)
    .describe("Output format: 'markdown' for human-readable or 'json' for machine-readable")
}).strict();

const AddToInboxInputSchema = z.object({
  title: z.string()
    .min(1)
    .describe("The title/name of the item to add. Example: 'buy milk'"),
  item_type: z.string()
    .optional()
    .default("Task")
    .describe("Type of item: 'Task', 'Note', 'Project', etc. (default: 'Task')"),
  due_date: z.string()
    .optional()
    .describe("Due date in ISO 8601 format. Example: '2024-11-20T17:00:00Z'")
}).strict();

const CreateItemInputSchema = z.object({
  title: z.string()
    .min(1)
    .describe("The title/name of the item to create. Example: 'buy milk'"),
  parent_id: z.string()
    .min(1)
    .describe("The parent folder/project ID where the item will be created. Example: '2EADCE4C-538A-444F-BE61-B4AF0047B2EC'"),
  item_type: z.string()
    .optional()
    .default("Task")
    .describe("Type of item: 'Task', 'Note', 'Project', 'Folder', etc. (default: 'Task')"),
  due_date: z.string()
    .optional()
    .describe("Due date in ISO 8601 format. Example: '2024-11-20T17:00:00Z'"),
  earliest_start_time: z.string()
    .optional()
    .describe("Earliest start time in ISO 8601 format. Example: '2024-11-20T09:00:00Z'")
}).strict();

const CreateRootItemInputSchema = z.object({
  title: z.string()
    .min(1)
    .describe("The title/name of the item to create. Example: 'Home'"),
  item_type: z.string()
    .optional()
    .default("Folder")
    .describe("Type of item: 'Folder', 'Project', 'Task', 'Note', etc. (default: 'Folder')"),
  due_date: z.string()
    .optional()
    .describe("Due date in ISO 8601 format. Example: '2024-11-20T17:00:00Z'"),
  earliest_start_time: z.string()
    .optional()
    .describe("Earliest start time in ISO 8601 format. Example: '2024-11-20T09:00:00Z'")
}).strict();

const CompleteTaskInputSchema = z.object({
  task_id: z.string()
    .min(1)
    .describe("The ID of the task to complete/uncomplete. Example: '2EADCE4C-538A-444F-BE61-B4AF0047B2EC'"),
  completed: z.boolean()
    .optional()
    .default(true)
    .describe("Whether to mark as completed (true) or uncompleted (false). Default: true")
}).strict();

const ChangeItemTypeInputSchema = z.object({
  item_id: z.string()
    .min(1)
    .describe("The ID of the item whose type to change. Example: '2EADCE4C-538A-444F-BE61-B4AF0047B2EC'"),
  new_type: z.string()
    .min(1)
    .describe("The new item type. Example: 'Task', 'Note', 'Project', 'Folder', etc.")
}).strict();

const DeleteItemInputSchema = z.object({
  item_id: z.string()
    .min(1)
    .describe("The ID of the item to delete. Example: '2EADCE4C-538A-444F-BE61-B4AF0047B2EC'")
}).strict();

const MoveItemInputSchema = z.object({
  item_id: z.string()
    .min(1)
    .describe("The ID of the item to move. Example: '2EADCE4C-538A-444F-BE61-B4AF0047B2EC'"),
  new_parent_id: z.string()
    .min(1)
    .describe("The ID of the new parent folder/project. Example: '3F8A9B2C-1D4E-5F6A-7B8C-9D0E1F2A3B4C'")
}).strict();

const ArchiveItemInputSchema = z.object({
  item_id: z.string()
    .min(1)
    .describe("The ID of the item to archive. Example: '2EADCE4C-538A-444F-BE61-B4AF0047B2EC'")
}).strict();

const GetItemInputSchema = z.object({
  item_id: z.string()
    .min(1)
    .describe("The ID of the item to retrieve. Example: '2EADCE4C-538A-444F-BE61-B4AF0047B2EC'"),
  response_format: z.nativeEnum(ResponseFormat)
    .optional()
    .default(ResponseFormat.MARKDOWN)
    .describe("Output format: 'markdown' for human-readable or 'json' for machine-readable")
}).strict();

const UpdateTitleInputSchema = z.object({
  item_id: z.string()
    .min(1)
    .describe("The ID of the item whose title to update. Example: '2EADCE4C-538A-444F-BE61-B4AF0047B2EC'"),
  new_title: z.string()
    .min(1)
    .describe("The new title for the item. Example: 'Buy organic milk'")
}).strict();

const UpdateDueDateInputSchema = z.object({
  item_id: z.string()
    .min(1)
    .describe("The ID of the item whose due date to update. Example: '2EADCE4C-538A-444F-BE61-B4AF0047B2EC'"),
  due_date: z.string()
    .optional()
    .nullable()
    .describe("New due date in ISO 8601 format, or null to clear. Example: '2024-11-20T17:00:00Z'")
}).strict();

const UpdateEarliestStartTimeInputSchema = z.object({
  item_id: z.string()
    .min(1)
    .describe("The ID of the item whose earliest start time to update. Example: '2EADCE4C-538A-444F-BE61-B4AF0047B2EC'"),
  earliest_start_time: z.string()
    .optional()
    .nullable()
    .describe("New earliest start time in ISO 8601 format, or null to clear. Example: '2024-11-20T09:00:00Z'")
}).strict();

const GetAllTagsInputSchema = z.object({
  response_format: z.nativeEnum(ResponseFormat)
    .optional()
    .default(ResponseFormat.MARKDOWN)
    .describe("Output format: 'markdown' for human-readable or 'json' for machine-readable")
}).strict();

const AddTagToItemInputSchema = z.object({
  item_id: z.string()
    .min(1)
    .describe("The ID of the item to tag. Example: '2EADCE4C-538A-444F-BE61-B4AF0047B2EC'"),
  tag_id: z.string()
    .min(1)
    .describe("The ID of the tag to add. Example: '22B0B1F4-1950-4E2B-9E1C-4DD059AB2267'")
}).strict();

const RemoveTagFromItemInputSchema = z.object({
  item_id: z.string()
    .min(1)
    .describe("The ID of the item to untag. Example: '2EADCE4C-538A-444F-BE61-B4AF0047B2EC'"),
  tag_id: z.string()
    .min(1)
    .describe("The ID of the tag to remove. Example: '22B0B1F4-1950-4E2B-9E1C-4DD059AB2267'")
}).strict();

const GetItemTagsInputSchema = z.object({
  item_id: z.string()
    .min(1)
    .describe("The ID of the item whose tags to retrieve. Example: '2EADCE4C-538A-444F-BE61-B4AF0047B2EC'"),
  response_format: z.nativeEnum(ResponseFormat)
    .optional()
    .default(ResponseFormat.MARKDOWN)
    .describe("Output format: 'markdown' for human-readable or 'json' for machine-readable")
}).strict();

const GetOverdueItemsInputSchema = z.object({
  include_completed: z.boolean()
    .optional()
    .default(false)
    .describe("Whether to include completed overdue items. Default: false"),
  include_archive: z.boolean()
    .optional()
    .default(false)
    .describe("Include items from Archive folder. Default: false (archive excluded)"),
  response_format: z.nativeEnum(ResponseFormat)
    .optional()
    .default(ResponseFormat.MARKDOWN)
    .describe("Output format: 'markdown' for human-readable or 'json' for machine-readable")
}).strict();

const GetDueTodayInputSchema = z.object({
  include_completed: z.boolean()
    .optional()
    .default(false)
    .describe("Whether to include completed items. Default: false"),
  include_archive: z.boolean()
    .optional()
    .default(false)
    .describe("Include items from Archive folder. Default: false (archive excluded)"),
  response_format: z.nativeEnum(ResponseFormat)
    .optional()
    .default(ResponseFormat.MARKDOWN)
    .describe("Output format: 'markdown' for human-readable or 'json' for machine-readable")
}).strict();

const GetDueTomorrowInputSchema = z.object({
  include_completed: z.boolean()
    .optional()
    .default(false)
    .describe("Whether to include completed items. Default: false"),
  include_archive: z.boolean()
    .optional()
    .default(false)
    .describe("Include items from Archive folder. Default: false (archive excluded)"),
  response_format: z.nativeEnum(ResponseFormat)
    .optional()
    .default(ResponseFormat.MARKDOWN)
    .describe("Output format: 'markdown' for human-readable or 'json' for machine-readable")
}).strict();

const GetDueThisWeekInputSchema = z.object({
  include_completed: z.boolean()
    .optional()
    .default(false)
    .describe("Whether to include completed items. Default: false"),
  include_archive: z.boolean()
    .optional()
    .default(false)
    .describe("Include items from Archive folder. Default: false (archive excluded)"),
  response_format: z.nativeEnum(ResponseFormat)
    .optional()
    .default(ResponseFormat.MARKDOWN)
    .describe("Output format: 'markdown' for human-readable or 'json' for machine-readable")
}).strict();

const SwapItemsInputSchema = z.object({
  item_id_1: z.string()
    .min(1)
    .describe("The ID of the first item to swap. Example: '2EADCE4C-538A-444F-BE61-B4AF0047B2EC'"),
  item_id_2: z.string()
    .min(1)
    .describe("The ID of the second item to swap. Example: '3F8A9B2C-1D4E-5F6A-7B8C-9D0E1F2A3B4C'")
}).strict();

const MoveToPositionInputSchema = z.object({
  item_id: z.string()
    .min(1)
    .describe("The ID of the item to move. Example: '2EADCE4C-538A-444F-BE61-B4AF0047B2EC'"),
  position: z.number()
    .min(0)
    .describe("The target position (0-based index) among siblings. Example: 0 for first, 1 for second, etc.")
}).strict();

const ReorderChildrenInputSchema = z.object({
  parent_id: z.string()
    .min(1)
    .describe("The ID of the parent whose children to reorder. Example: '2EADCE4C-538A-444F-BE61-B4AF0047B2EC'"),
  item_ids: z.array(z.string())
    .min(1)
    .describe("Array of child item IDs in the desired order. All children must be included.")
}).strict();

const SearchItemsInputSchema = z.object({
  query: z.string()
    .min(1)
    .describe("Search query to match against item titles. Case-insensitive."),
  item_type: z.string()
    .optional()
    .describe("Filter by item type (e.g., 'Task', 'Note', 'Folder', 'Project'). If omitted, searches all types."),
  include_archive: z.boolean()
    .optional()
    .default(false)
    .describe("Include items from Archive folder. Default: false (archive excluded)"),
  limit: z.number()
    .optional()
    .default(500)
    .describe("Maximum number of results to return. Default: 500"),
  response_format: z.nativeEnum(ResponseFormat)
    .optional()
    .default(ResponseFormat.MARKDOWN)
    .describe("Output format: 'markdown' for human-readable or 'json' for machine-readable")
}).strict();

const GetAvailableTasksInputSchema = z.object({
  parent_id: z.string()
    .optional()
    .describe("Optional parent ID to filter tasks within a specific folder/project. If omitted, returns all available tasks."),
  include_deferred: z.boolean()
    .optional()
    .default(false)
    .describe("Include tasks with future earliest_start_time (deferred tasks). Default: false"),
  include_archive: z.boolean()
    .optional()
    .default(false)
    .describe("Include items from Archive folder. Default: false (archive excluded)"),
  response_format: z.nativeEnum(ResponseFormat)
    .optional()
    .default(ResponseFormat.MARKDOWN)
    .describe("Output format: 'markdown' for human-readable or 'json' for machine-readable")
}).strict();

const GetCompletedTasksInputSchema = z.object({
  parent_id: z.string()
    .optional()
    .describe("Optional parent ID to filter tasks within a specific folder/project. If omitted, returns all completed tasks."),
  since: z.string()
    .optional()
    .describe("Only return tasks completed after this date. ISO 8601 format (e.g., '2024-11-01T00:00:00Z')."),
  include_archive: z.boolean()
    .optional()
    .default(false)
    .describe("Include items from Archive folder. Default: false (archive excluded)"),
  limit: z.number()
    .optional()
    .default(100)
    .describe("Maximum number of results to return. Default: 100"),
  response_format: z.nativeEnum(ResponseFormat)
    .optional()
    .default(ResponseFormat.MARKDOWN)
    .describe("Output format: 'markdown' for human-readable or 'json' for machine-readable")
}).strict();

const UpdateNotesInputSchema = z.object({
  item_id: z.string()
    .min(1)
    .describe("The ID of the item whose notes to update. Example: '2EADCE4C-538A-444F-BE61-B4AF0047B2EC'"),
  notes: z.string()
    .nullable()
    .describe("The new notes content (supports Markdown formatting), or null to clear. The app renders notes using Markdown.")
}).strict();

const GetNotesInputSchema = z.object({
  item_id: z.string()
    .min(1)
    .describe("The ID of the item whose notes to retrieve. Example: '2EADCE4C-538A-444F-BE61-B4AF0047B2EC'")
}).strict();

const GetDeferredTasksInputSchema = z.object({
  parent_id: z.string()
    .optional()
    .describe("Optional parent ID to filter tasks within a specific folder/project. If omitted, returns all deferred tasks."),
  include_archive: z.boolean()
    .optional()
    .default(false)
    .describe("Include items from Archive folder. Default: false (archive excluded)"),
  response_format: z.nativeEnum(ResponseFormat)
    .optional()
    .default(ResponseFormat.MARKDOWN)
    .describe("Output format: 'markdown' for human-readable or 'json' for machine-readable")
}).strict();

const CompleteMultipleTasksInputSchema = z.object({
  task_ids: z.array(z.string())
    .min(1)
    .describe("Array of task IDs to complete. Example: ['id1', 'id2', 'id3']"),
  completed: z.boolean()
    .optional()
    .default(true)
    .describe("Whether to mark as completed (true) or uncompleted (false). Default: true")
}).strict();

const GetNodeTreeInputSchema = z.object({
  root_id: z.string()
    .optional()
    .describe("Optional ID of the root item to start from. If omitted, returns tree from all root items."),
  max_depth: z.number()
    .optional()
    .default(10)
    .describe("Maximum depth to traverse. Default: 10, max: 20"),
  response_format: z.nativeEnum(ResponseFormat)
    .optional()
    .default(ResponseFormat.MARKDOWN)
    .describe("Output format: 'markdown' for human-readable or 'json' for machine-readable")
}).strict();

const GetItemsByTagNamesInputSchema = z.object({
  tag_names: z.array(z.string())
    .min(1)
    .describe("Array of tag names. Items must have ALL specified tags. Example: ['urgent', 'home']"),
  include_completed: z.boolean()
    .optional()
    .default(false)
    .describe("Include completed items. Default: false"),
  include_archive: z.boolean()
    .optional()
    .default(false)
    .describe("Include items from Archive folder. Default: false (archive excluded)"),
  response_format: z.nativeEnum(ResponseFormat)
    .optional()
    .default(ResponseFormat.MARKDOWN)
    .describe("Output format: 'markdown' for human-readable or 'json' for machine-readable")
}).strict();

const GetItemsByTagIdsInputSchema = z.object({
  tag_ids: z.array(z.string())
    .min(1)
    .describe("Array of tag IDs. Items must have ALL specified tags. Example: ['id1', 'id2']"),
  include_completed: z.boolean()
    .optional()
    .default(false)
    .describe("Include completed items. Default: false"),
  include_archive: z.boolean()
    .optional()
    .default(false)
    .describe("Include items from Archive folder. Default: false (archive excluded)"),
  response_format: z.nativeEnum(ResponseFormat)
    .optional()
    .default(ResponseFormat.MARKDOWN)
    .describe("Output format: 'markdown' for human-readable or 'json' for machine-readable")
}).strict();

const StartTimerInputSchema = z.object({
  item_id: z.string()
    .min(1)
    .describe("The ID of the item to start timing. Example: '2EADCE4C-538A-444F-BE61-B4AF0047B2EC'")
}).strict();

const StopTimerInputSchema = z.object({
  entry_id: z.string()
    .optional()
    .describe("The ID of the time entry to stop. If omitted, stops the active timer for the item_id."),
  item_id: z.string()
    .optional()
    .describe("The ID of the item whose timer to stop. Used if entry_id is not provided.")
}).strict();

const GetTimeEntriesInputSchema = z.object({
  item_id: z.string()
    .min(1)
    .describe("The ID of the item to get time entries for. Example: '2EADCE4C-538A-444F-BE61-B4AF0047B2EC'"),
  response_format: z.nativeEnum(ResponseFormat)
    .optional()
    .default(ResponseFormat.MARKDOWN)
    .describe("Output format: 'markdown' for human-readable or 'json' for machine-readable")
}).strict();

const GetTotalTimeInputSchema = z.object({
  item_id: z.string()
    .min(1)
    .describe("The ID of the item to get total time for. Example: '2EADCE4C-538A-444F-BE61-B4AF0047B2EC'")
}).strict();

const GetActiveTimersInputSchema = z.object({
  response_format: z.nativeEnum(ResponseFormat)
    .optional()
    .default(ResponseFormat.MARKDOWN)
    .describe("Output format: 'markdown' for human-readable or 'json' for machine-readable")
}).strict();

const GetDashboardInputSchema = z.object({
  response_format: z.nativeEnum(ResponseFormat)
    .optional()
    .default(ResponseFormat.MARKDOWN)
    .describe("Output format: 'markdown' for human-readable or 'json' for machine-readable")
}).strict();

const GetStuckProjectsInputSchema = z.object({
  root_id: z.string()
    .optional()
    .describe("Optional root folder ID to search within (e.g., Home, Work). If omitted, searches all areas."),
  response_format: z.nativeEnum(ResponseFormat)
    .optional()
    .default(ResponseFormat.MARKDOWN)
    .describe("Output format: 'markdown' for human-readable or 'json' for machine-readable")
}).strict();

const UpdateStartTimeInputSchema = z.object({
  entry_id: z.string()
    .min(1)
    .describe("The ID of the time entry to update. Example: 'AE0A11B6-5A72-4FCA-AA8C-9FB6596BAE44'"),
  started_at: z.string()
    .describe("New start time in ISO 8601 format. Example: '2024-12-03T19:00:00Z'")
}).strict();

const UpdateEndTimeInputSchema = z.object({
  entry_id: z.string()
    .min(1)
    .describe("The ID of the time entry to update. Example: 'AE0A11B6-5A72-4FCA-AA8C-9FB6596BAE44'"),
  ended_at: z.string()
    .describe("New end time in ISO 8601 format. Example: '2024-12-03T19:30:00Z'")
}).strict();

const CreateTagInputSchema = z.object({
  name: z.string()
    .min(1)
    .describe("The name of the tag to create. Example: 'home'"),
  color: z.string()
    .optional()
    .describe("Hex color code for the tag. Example: '#FF0000' for red. Defaults to a random color if not provided.")
}).strict();

const DeleteTagInputSchema = z.object({
  tag_id: z.string()
    .min(1)
    .describe("The ID of the tag to delete. Example: '9649F8E6-5FE2-42E8-93D2-E82929F97844'")
}).strict();

const RenameTagInputSchema = z.object({
  tag_id: z.string()
    .min(1)
    .describe("The ID of the tag to rename. Example: '9649F8E6-5FE2-42E8-93D2-E82929F97844'"),
  new_name: z.string()
    .min(1)
    .describe("The new name for the tag. Example: 'office'")
}).strict();

const EmptyTrashInputSchema = z.object({
  keep_items_since: z.string()
    .optional()
    .describe("Keep items modified after this date. ISO 8601 format (e.g., '2024-11-01T00:00:00Z'). If omitted, empties entire trash.")
}).strict();

const InstantiateTemplateInputSchema = z.object({
  template_id: z.string()
    .min(1)
    .describe("The ID of the template to instantiate. Example: '2EADCE4C-538A-444F-BE61-B4AF0047B2EC'"),
  name: z.string()
    .min(1)
    .describe("The name for the new instance. Example: 'Monday Morning Routine'"),
  parent_id: z.string()
    .optional()
    .describe("The parent folder/project ID where the instance will be created. If omitted, creates in Inbox."),
  as_type: z.string()
    .optional()
    .default("Project")
    .describe("The item type for the root of the instance. Default: 'Project'. Options: 'Project', 'Folder', 'Task'")
}).strict();

const GetOldestTasksInputSchema = z.object({
  limit: z.number()
    .optional()
    .default(20)
    .describe("Maximum number of tasks to return. Default: 20"),
  root_id: z.string()
    .optional()
    .describe("Optional root folder ID to filter tasks within (e.g., Home, Work). If omitted, searches all areas."),
  response_format: z.nativeEnum(ResponseFormat)
    .optional()
    .default(ResponseFormat.MARKDOWN)
    .describe("Output format: 'markdown' for human-readable or 'json' for machine-readable")
}).strict();

// Database types
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
  item_type: string;
  notes: string | null;
}

interface DirectGTDTag {
  id: string;
  name: string;
  color: string | null;
}

interface TimeEntry {
  id: string;
  item_id: string;
  started_at: number;
  ended_at: number | null;
  duration: number | null;
}

interface FormattedItem {
  id: string;
  title: string;
  parentId: string | null;
  sortOrder: number;
  createdAt: string;
  modifiedAt: string;
  completedAt: string | null;
  dueDate: string | null;
  earliestStartTime: string | null;
  notes: string | null;
}

// Database utility functions
function openDatabase(): Database.Database {
  try {
    const db = new Database(DB_PATH);
    return db;
  } catch (error) {
    throw new Error(`Failed to open database at ${DB_PATH}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function formatItem(item: DirectGTDItem): FormattedItem {
  // Convert Unix timestamps (in seconds) to ISO date strings
  const convertTimestamp = (timestamp: string | null): string | null => {
    if (!timestamp) return null;
    try {
      // Unix timestamps from SQLite are in seconds, convert to milliseconds
      const ms = parseFloat(timestamp) * 1000;
      return new Date(ms).toISOString();
    } catch {
      return timestamp; // Return as-is if conversion fails
    }
  };

  return {
    id: item.id,
    title: item.title,
    parentId: item.parent_id,
    sortOrder: item.sort_order,
    createdAt: convertTimestamp(item.created_at) || item.created_at,
    modifiedAt: convertTimestamp(item.modified_at) || item.modified_at,
    completedAt: convertTimestamp(item.completed_at),
    dueDate: convertTimestamp(item.due_date),
    earliestStartTime: convertTimestamp(item.earliest_start_time),
    notes: item.notes
  };
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "None";

  try {
    // Try parsing as ISO date
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
      return date.toLocaleString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        timeZoneName: "short"
      });
    }
  } catch {
    // Fall through to return original string
  }

  return dateStr;
}

// Date calculation utilities
function getStartOfDay(date: Date): Date {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  return start;
}

function getEndOfDay(date: Date): Date {
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  return end;
}

function getStartOfWeek(date: Date): Date {
  const start = new Date(date);
  const day = start.getDay();
  const diff = start.getDate() - day;
  start.setDate(diff);
  start.setHours(0, 0, 0, 0);
  return start;
}

function getEndOfWeek(date: Date): Date {
  const end = new Date(date);
  const day = end.getDay();
  const diff = end.getDate() + (6 - day);
  end.setDate(diff);
  end.setHours(23, 59, 59, 999);
  return end;
}

function calculateOverdueBy(dueDate: string): string {
  const now = new Date();
  const due = new Date(dueDate);
  const diffMs = now.getTime() - due.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

  if (diffDays === 0) {
    if (diffHours === 0) {
      return "Just overdue";
    } else if (diffHours === 1) {
      return "1 hour overdue";
    } else {
      return `${diffHours} hours overdue`;
    }
  } else if (diffDays === 1) {
    return "1 day overdue";
  } else {
    return `${diffDays} days overdue`;
  }
}

function formatItemsAsMarkdown(items: FormattedItem[]): string {
  if (items.length === 0) {
    return "No root items found in DirectGTD database.";
  }

  const lines: string[] = [
    `# DirectGTD Root Items`,
    "",
    `Found ${items.length} root-level ${items.length === 1 ? "item" : "items"}`,
    ""
  ];

  for (const item of items) {
    lines.push(`## ${item.title}`);
    lines.push(`- **ID**: ${item.id}`);
    lines.push(`- **Sort Order**: ${item.sortOrder}`);
    lines.push(`- **Created**: ${formatDate(item.createdAt)}`);
    lines.push(`- **Modified**: ${formatDate(item.modifiedAt)}`);

    if (item.completedAt) {
      lines.push(`- **Completed**: ${formatDate(item.completedAt)}`);
    }

    if (item.dueDate) {
      lines.push(`- **Due Date**: ${formatDate(item.dueDate)}`);
    }

    if (item.earliestStartTime) {
      lines.push(`- **Earliest Start**: ${formatDate(item.earliestStartTime)}`);
    }

    lines.push("");
  }

  return lines.join("\n");
}

function formatItemsAsJSON(items: FormattedItem[]): string {
  const response = {
    total: items.length,
    items: items
  };

  return JSON.stringify(response, null, 2);
}

function formatChildrenAsMarkdown(items: FormattedItem[], parentId: string): string {
  if (items.length === 0) {
    return `No child items found for parent ID: ${parentId}`;
  }

  const lines: string[] = [
    `# DirectGTD Child Items`,
    "",
    `Parent ID: ${parentId}`,
    `Found ${items.length} child ${items.length === 1 ? "item" : "items"}`,
    ""
  ];

  for (const item of items) {
    lines.push(`## ${item.title}`);
    lines.push(`- **ID**: ${item.id}`);
    lines.push(`- **Sort Order**: ${item.sortOrder}`);
    lines.push(`- **Created**: ${formatDate(item.createdAt)}`);
    lines.push(`- **Modified**: ${formatDate(item.modifiedAt)}`);

    if (item.completedAt) {
      lines.push(`- **Completed**: ${formatDate(item.completedAt)}`);
    }

    if (item.dueDate) {
      lines.push(`- **Due Date**: ${formatDate(item.dueDate)}`);
    }

    if (item.earliestStartTime) {
      lines.push(`- **Earliest Start**: ${formatDate(item.earliestStartTime)}`);
    }

    lines.push("");
  }

  return lines.join("\n");
}

function formatChildrenAsJSON(items: FormattedItem[], parentId: string): string {
  const response = {
    parentId: parentId,
    total: items.length,
    items: items
  };

  return JSON.stringify(response, null, 2);
}

function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16).toUpperCase();
  });
}

function getInboxId(db: Database.Database): string {
  const result = db.prepare("SELECT value FROM app_settings WHERE key = 'quick_capture_folder_id'").get() as { value: string } | undefined;
  if (!result) {
    throw new Error("Inbox folder not configured in app_settings");
  }
  return result.value;
}

function getArchiveFolderId(db: Database.Database): string | null {
  const result = db.prepare("SELECT value FROM app_settings WHERE key = 'archive_folder_id'").get() as { value: string } | undefined;
  return result?.value ?? null;
}

function getArchiveDescendantIds(db: Database.Database): Set<string> {
  const archiveId = getArchiveFolderId(db);
  if (!archiveId) {
    return new Set();
  }

  const descendantIds = new Set<string>();
  descendantIds.add(archiveId);

  // Recursively get all descendants
  const getChildren = db.prepare("SELECT id FROM items WHERE parent_id = ? AND deleted_at IS NULL");

  function collectDescendants(parentId: string) {
    const children = getChildren.all(parentId) as { id: string }[];
    for (const child of children) {
      descendantIds.add(child.id);
      collectDescendants(child.id);
    }
  }

  collectDescendants(archiveId);
  return descendantIds;
}

function getNextSortOrder(db: Database.Database, parentId: string): number {
  const result = db.prepare("SELECT MAX(sort_order) as max_order FROM items WHERE parent_id = ? AND deleted_at IS NULL").get(parentId) as { max_order: number | null };
  return (result.max_order ?? -1) + 1;
}

function handleDatabaseError(error: unknown): string {
  if (error instanceof Error) {
    if (error.message.includes("ENOENT") || error.message.includes("no such file")) {
      return `Error: Database not found at ${DB_PATH}. Please ensure DirectGTD is installed and has created its database.`;
    }
    if (error.message.includes("SQLITE_CANTOPEN")) {
      return `Error: Cannot open database at ${DB_PATH}. Please check file permissions.`;
    }
    if (error.message.includes("SQLITE_CORRUPT")) {
      return `Error: Database file is corrupted. Please check the DirectGTD database integrity.`;
    }
    return `Error: Database error: ${error.message}`;
  }
  return `Error: Unexpected error occurred: ${String(error)}`;
}

// Create MCP server instance
const server = new McpServer({
  name: "directgtd-mcp-server",
  version: "1.9.0"
});

// Register the get_root_items tool
server.registerTool(
  "directgtd_get_root_items",
  {
    title: "Get DirectGTD Root Items",
    description: `Retrieve all root-level items from the DirectGTD task management database.

This tool queries the DirectGTD SQLite database for all items that have no parent (root-level items), returning them sorted by their sort order. Root items are top-level tasks or projects in the DirectGTD hierarchy.

Args:
  - response_format ('markdown' | 'json'): Output format (default: 'markdown')

Returns:
  For JSON format: Structured data with schema:
  {
    "total": number,           // Total number of root items found
    "items": [
      {
        "id": string,                    // Unique item identifier
        "title": string,                 // Item title/name
        "parentId": string | null,       // Parent ID (always null for root items)
        "sortOrder": number,             // Sort order within parent
        "createdAt": string,             // Creation timestamp
        "modifiedAt": string,            // Last modification timestamp
        "completedAt": string | null,    // Completion timestamp (if completed)
        "dueDate": string | null,        // Due date (if set)
        "earliestStartTime": string | null  // Earliest start time (if set)
      }
    ]
  }

  For Markdown format: Human-readable formatted text with item details.

Examples:
  - Use when: "Show me all my root tasks in DirectGTD"
  - Use when: "What are my top-level projects?"
  - Use when: "List all root items from DirectGTD"

Error Handling:
  - Returns "Error: Database not found" if DirectGTD database doesn't exist
  - Returns "Error: Cannot open database" if file permissions are incorrect
  - Returns "No root items found" if database has no root-level items`,
    inputSchema: GetRootItemsInputSchema,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false
    }
  },
  async (params: { response_format?: ResponseFormat }) => {
    let db: Database.Database | null = null;

    try {
      // Apply default for response_format
      const responseFormat = params.response_format ?? ResponseFormat.MARKDOWN;

      // Open database
      db = openDatabase();

      // Query for root items
      const query = "SELECT * FROM items WHERE parent_id IS NULL AND deleted_at IS NULL ORDER BY sort_order";
      const stmt = db.prepare(query);
      const rows = stmt.all() as DirectGTDItem[];

      // Format items
      const items = rows.map(formatItem);

      // Format response based on requested format
      let result: string;

      if (responseFormat === ResponseFormat.MARKDOWN) {
        result = formatItemsAsMarkdown(items);
      } else {
        result = formatItemsAsJSON(items);
      }

      // Check character limit
      if (result.length > CHARACTER_LIMIT) {
        const halfLength = Math.floor(items.length / 2);
        const truncatedItems = items.slice(0, Math.max(1, halfLength));

        if (responseFormat === ResponseFormat.MARKDOWN) {
          result = formatItemsAsMarkdown(truncatedItems);
          result += `\n\n**Note**: Response truncated from ${items.length} to ${truncatedItems.length} items due to size limits.`;
        } else {
          result = JSON.stringify({
            total: items.length,
            count: truncatedItems.length,
            items: truncatedItems,
            truncated: true,
            truncation_message: `Response truncated from ${items.length} to ${truncatedItems.length} items. The database contains more items than can be displayed at once.`
          }, null, 2);
        }
      }

      return {
        content: [{
          type: "text",
          text: result
        }]
      };

    } catch (error) {
      return {
        content: [{
          type: "text",
          text: handleDatabaseError(error)
        }],
        isError: true
      };
    } finally {
      // Clean up database connection
      if (db) {
        try {
          db.close();
        } catch {
          // Ignore errors on close
        }
      }
    }
  }
);

// Register the get_children tool
server.registerTool(
  "directgtd_get_children",
  {
    title: "Get DirectGTD Child Items",
    description: `Retrieve all child items of a specific parent item from the DirectGTD task management database.

This tool queries the DirectGTD SQLite database for all items that belong to a specific parent item, returning them sorted by their sort order. Use this to explore the contents of folders, projects, or any item that contains sub-items.

Args:
  - parent_id (string, required): The unique ID of the parent item. Example: '2EADCE4C-538A-444F-BE61-B4AF0047B2EC'
  - response_format ('markdown' | 'json', optional): Output format (default: 'markdown')

Returns:
  For JSON format: Structured data with schema:
  {
    "parentId": string,          // The parent item ID
    "total": number,             // Total number of child items found
    "items": [
      {
        "id": string,                    // Unique item identifier
        "title": string,                 // Item title/name
        "parentId": string,              // Parent ID (matches the input parent_id)
        "sortOrder": number,             // Sort order within parent
        "createdAt": string,             // Creation timestamp
        "modifiedAt": string,            // Last modification timestamp
        "completedAt": string | null,    // Completion timestamp (if completed)
        "dueDate": string | null,        // Due date (if set)
        "earliestStartTime": string | null  // Earliest start time (if set)
      }
    ]
  }

  For Markdown format: Human-readable formatted text with item details.

Examples:
  - Use when: "Show me what's inside the Home folder"
  - Use when: "List all tasks under Project X"
  - Use when: "What items are in my Inbox?"

Workflow:
  1. First call directgtd_get_root_items to get top-level items
  2. Find the item you want to explore (e.g., "Home" folder)
  3. Use that item's ID with this tool to get its children
  4. Repeat to navigate deeper into the hierarchy

Error Handling:
  - Returns "Error: Database not found" if DirectGTD database doesn't exist
  - Returns "Error: Cannot open database" if file permissions are incorrect
  - Returns "No child items found" if the parent has no children (not an error)`,
    inputSchema: GetChildrenInputSchema,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false
    }
  },
  async (params: { parent_id: string; response_format?: ResponseFormat }) => {
    let db: Database.Database | null = null;

    try {
      // Apply default for response_format
      const responseFormat = params.response_format ?? ResponseFormat.MARKDOWN;
      const parentId = params.parent_id;

      // Open database
      db = openDatabase();

      // Query for child items
      const query = "SELECT * FROM items WHERE parent_id = ? AND deleted_at IS NULL ORDER BY sort_order";
      const stmt = db.prepare(query);
      const rows = stmt.all(parentId) as DirectGTDItem[];

      // Format items
      const items = rows.map(formatItem);

      // Format response based on requested format
      let result: string;

      if (responseFormat === ResponseFormat.MARKDOWN) {
        result = formatChildrenAsMarkdown(items, parentId);
      } else {
        result = formatChildrenAsJSON(items, parentId);
      }

      // Check character limit
      if (result.length > CHARACTER_LIMIT) {
        const halfLength = Math.floor(items.length / 2);
        const truncatedItems = items.slice(0, Math.max(1, halfLength));

        if (responseFormat === ResponseFormat.MARKDOWN) {
          result = formatChildrenAsMarkdown(truncatedItems, parentId);
          result += `\n\n**Note**: Response truncated from ${items.length} to ${truncatedItems.length} items due to size limits.`;
        } else {
          result = JSON.stringify({
            parentId: parentId,
            total: items.length,
            count: truncatedItems.length,
            items: truncatedItems,
            truncated: true,
            truncation_message: `Response truncated from ${items.length} to ${truncatedItems.length} items. The database contains more items than can be displayed at once.`
          }, null, 2);
        }
      }

      return {
        content: [{
          type: "text",
          text: result
        }]
      };

    } catch (error) {
      return {
        content: [{
          type: "text",
          text: handleDatabaseError(error)
        }],
        isError: true
      };
    } finally {
      // Clean up database connection
      if (db) {
        try {
          db.close();
        } catch {
          // Ignore errors on close
        }
      }
    }
  }
);

// Register the add_to_inbox tool
server.registerTool(
  "directgtd_add_to_inbox",
  {
    title: "Add Item to Inbox",
    description: `Add a new item to the DirectGTD Inbox (quick capture folder).

This tool creates a new task, note, or project in your Inbox. The Inbox is the default quick capture location in DirectGTD.

Args:
  - title (string, required): The name/title of the item. Example: 'buy milk'
  - item_type (string, optional): Type of item - 'Task', 'Note', 'Project', etc. (default: 'Task')
  - due_date (string, optional): Due date in ISO 8601 format. Example: '2024-11-20T17:00:00Z'

Returns:
  The created item with its ID and details.

Examples:
  - Use when: "Add buy milk to my inbox"
  - Use when: "Create a task called 'call dentist' in inbox"
  - Use when: "Quick capture: review quarterly reports"

Error Handling:
  - Returns error if inbox is not configured
  - Returns error if database write fails`,
    inputSchema: AddToInboxInputSchema,
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: false
    }
  },
  async (params: { title: string; item_type?: string; due_date?: string }) => {
    let db: Database.Database | null = null;

    try {
      // Open database
      db = openDatabase();

      // Get inbox ID
      const inboxId = getInboxId(db);

      // Generate new item ID
      const itemId = generateUUID();

      // Get next sort order
      const sortOrder = getNextSortOrder(db, inboxId);

      // Get current timestamp (Unix timestamp in seconds)
      const now = Math.floor(Date.now() / 1000);

      // Parse due date if provided
      let dueDateTimestamp: number | null = null;
      if (params.due_date) {
        dueDateTimestamp = Math.floor(new Date(params.due_date).getTime() / 1000);
      }

      // Insert new item
      const insertStmt = db.prepare(`
        INSERT INTO items (
          id, title, parent_id, sort_order,
          created_at, modified_at, item_type,
          due_date, completed_at, earliest_start_time, needs_push
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
      `);

      insertStmt.run(
        itemId,
        params.title,
        inboxId,
        sortOrder,
        now,
        now,
        params.item_type || "Task",
        dueDateTimestamp,
        null,
        null
      );

      // Fetch the created item
      const createdItem = db.prepare("SELECT * FROM items WHERE id = ?").get(itemId) as DirectGTDItem;

      // Format and return
      const formattedItem = formatItem(createdItem);

      const result = `# Item Added to Inbox

**${formattedItem.title}**

- **ID**: ${formattedItem.id}
- **Type**: ${params.item_type || "Task"}
- **Sort Order**: ${formattedItem.sortOrder}
- **Created**: ${formatDate(formattedItem.createdAt)}
${params.due_date ? `- **Due Date**: ${formatDate(formattedItem.dueDate)}` : ''}

Item successfully added to Inbox.`;

      return {
        content: [{
          type: "text",
          text: result
        }]
      };

    } catch (error) {
      return {
        content: [{
          type: "text",
          text: handleDatabaseError(error)
        }],
        isError: true
      };
    } finally {
      // Clean up database connection
      if (db) {
        try {
          db.close();
        } catch {
          // Ignore errors on close
        }
      }
    }
  }
);

// Register the create_item tool
server.registerTool(
  "directgtd_create_item",
  {
    title: "Create Item",
    description: `Create a new item in any folder or project.

This tool creates a new item at a specific location in the DirectGTD hierarchy. Unlike add_to_inbox, this allows you to create items anywhere.

Args:
  - title (string, required): The item title/name. Example: 'Buy organic milk'
  - parent_id (string, required): The parent folder/project ID. Example: '2EADCE4C-538A-444F-BE61-B4AF0047B2EC'
  - item_type (string, optional): Type: Task, Note, Project, Folder, etc. (default: 'Task')
  - due_date (string, optional): Due date in ISO 8601 format. Example: '2024-11-20T17:00:00Z'
  - earliest_start_time (string, optional): Earliest start time in ISO 8601 format. Example: '2024-11-20T09:00:00Z'

Returns:
  The created item with its ID and details.

Examples:
  - Use when: "Create a new task in the Home folder"
  - Use when: "Add a note to this project"
  - Use when: "Create a subtask under this item"

Error Handling:
  - Returns error if parent_id doesn't exist
  - Returns error if database write fails`,
    inputSchema: CreateItemInputSchema,
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: false
    }
  },
  async (params: { title: string; parent_id: string; item_type?: string; due_date?: string; earliest_start_time?: string }) => {
    let db: Database.Database | null = null;

    try {
      db = openDatabase();

      // Verify parent exists
      const parent = db.prepare("SELECT * FROM items WHERE id = ?").get(params.parent_id) as DirectGTDItem | undefined;
      if (!parent) {
        return {
          content: [{
            type: "text",
            text: `Error: No parent found with ID: ${params.parent_id}`
          }],
          isError: true
        };
      }

      // Generate new item ID
      const itemId = generateUUID();

      // Get next sort order
      const sortOrder = getNextSortOrder(db, params.parent_id);

      // Get current timestamp (Unix timestamp in seconds)
      const now = Math.floor(Date.now() / 1000);

      // Parse due date if provided
      let dueDateTimestamp: number | null = null;
      if (params.due_date) {
        dueDateTimestamp = Math.floor(new Date(params.due_date).getTime() / 1000);
      }

      // Parse earliest start time if provided
      let earliestStartTimestamp: number | null = null;
      if (params.earliest_start_time) {
        earliestStartTimestamp = Math.floor(new Date(params.earliest_start_time).getTime() / 1000);
      }

      // Insert new item
      const insertStmt = db.prepare(`
        INSERT INTO items (
          id, title, parent_id, sort_order,
          created_at, modified_at, item_type,
          due_date, completed_at, earliest_start_time, needs_push
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
      `);

      insertStmt.run(
        itemId,
        params.title,
        params.parent_id,
        sortOrder,
        now,
        now,
        params.item_type || "Task",
        dueDateTimestamp,
        null,
        earliestStartTimestamp
      );

      // Fetch the created item
      const createdItem = db.prepare("SELECT * FROM items WHERE id = ?").get(itemId) as DirectGTDItem;
      const formattedItem = formatItem(createdItem);

      const result = `# Item Created

**${formattedItem.title}**

- **ID**: ${formattedItem.id}
- **Type**: ${params.item_type || "Task"}
- **Parent**: ${params.parent_id} (${parent.title})
- **Sort Order**: ${formattedItem.sortOrder}
- **Created**: ${formatDate(formattedItem.createdAt)}
${params.due_date ? `- **Due Date**: ${formatDate(formattedItem.dueDate)}` : ''}
${params.earliest_start_time ? `- **Earliest Start**: ${formatDate(formattedItem.earliestStartTime)}` : ''}

Item successfully created in "${parent.title}".`;

      return {
        content: [{
          type: "text",
          text: result
        }]
      };

    } catch (error) {
      return {
        content: [{
          type: "text",
          text: handleDatabaseError(error)
        }],
        isError: true
      };
    } finally {
      if (db) {
        try {
          db.close();
        } catch {
          // Ignore errors on close
        }
      }
    }
  }
);

// Register the create_root_item tool
server.registerTool(
  "directgtd_create_root_item",
  {
    title: "Create Root Item",
    description: `Create a new root-level item in DirectGTD.

This tool creates a new item at the root level (no parent). Use this for creating top-level folders, projects, etc.

Args:
  - title (string, required): The item title/name. Example: 'Home'
  - item_type (string, optional): Type: Folder, Project, Task, Note, etc. (default: 'Folder')
  - due_date (string, optional): Due date in ISO 8601 format. Example: '2024-11-20T17:00:00Z'
  - earliest_start_time (string, optional): Earliest start time in ISO 8601 format. Example: '2024-11-20T09:00:00Z'

Returns:
  The created item with its ID and details.

Examples:
  - Use when: "Create a new root folder called Home"
  - Use when: "Add a top-level project"
  - Use when: "Create a root-level folder for Work"

Error Handling:
  - Returns error if database write fails`,
    inputSchema: CreateRootItemInputSchema,
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: false
    }
  },
  async (params: { title: string; item_type?: string; due_date?: string; earliest_start_time?: string }) => {
    let db: Database.Database | null = null;

    try {
      db = openDatabase();

      // Generate new item ID
      const itemId = generateUUID();

      // Get next sort order for root items (parent_id IS NULL)
      const sortOrderResult = db.prepare(
        "SELECT COALESCE(MAX(sort_order), -1) + 1 as next_order FROM items WHERE parent_id IS NULL AND deleted_at IS NULL"
      ).get() as { next_order: number };
      const sortOrder = sortOrderResult.next_order;

      // Get current timestamp (Unix timestamp in seconds)
      const now = Math.floor(Date.now() / 1000);

      // Parse due date if provided
      let dueDateTimestamp: number | null = null;
      if (params.due_date) {
        dueDateTimestamp = Math.floor(new Date(params.due_date).getTime() / 1000);
      }

      // Parse earliest start time if provided
      let earliestStartTimestamp: number | null = null;
      if (params.earliest_start_time) {
        earliestStartTimestamp = Math.floor(new Date(params.earliest_start_time).getTime() / 1000);
      }

      // Insert new item with NULL parent_id
      const insertStmt = db.prepare(`
        INSERT INTO items (
          id, title, parent_id, sort_order,
          created_at, modified_at, item_type,
          due_date, completed_at, earliest_start_time, needs_push
        ) VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, 1)
      `);

      insertStmt.run(
        itemId,
        params.title,
        sortOrder,
        now,
        now,
        params.item_type || "Folder",
        dueDateTimestamp,
        null,
        earliestStartTimestamp
      );

      // Fetch the created item
      const createdItem = db.prepare("SELECT * FROM items WHERE id = ?").get(itemId) as DirectGTDItem;
      const formattedItem = formatItem(createdItem);

      const result = `# Root Item Created

**${formattedItem.title}**

- **ID**: ${formattedItem.id}
- **Type**: ${params.item_type || "Folder"}
- **Sort Order**: ${formattedItem.sortOrder}
- **Created**: ${formatDate(formattedItem.createdAt)}
${params.due_date ? `- **Due Date**: ${formatDate(formattedItem.dueDate)}` : ''}
${params.earliest_start_time ? `- **Earliest Start**: ${formatDate(formattedItem.earliestStartTime)}` : ''}

Root-level item successfully created.`;

      return {
        content: [{
          type: "text",
          text: result
        }]
      };

    } catch (error) {
      return {
        content: [{
          type: "text",
          text: handleDatabaseError(error)
        }],
        isError: true
      };
    } finally {
      if (db) {
        try {
          db.close();
        } catch {
          // Ignore errors on close
        }
      }
    }
  }
);

// Register the complete_task tool
server.registerTool(
  "directgtd_complete_task",
  {
    title: "Complete/Uncomplete Task",
    description: `Mark a task as completed or uncompleted in DirectGTD.

This tool updates the completion status of a task. Only items with item_type='Task' can be completed - notes, projects, and folders cannot be marked as completed.

Args:
  - task_id (string, required): The ID of the task to complete/uncomplete. Example: '2EADCE4C-538A-444F-BE61-B4AF0047B2EC'
  - completed (boolean, optional): Whether to mark as completed (true) or uncompleted (false). Default: true

Returns:
  The updated task with its completion status.

Examples:
  - Use when: "Mark task X as completed"
  - Use when: "Complete the 'buy milk' task"
  - Use when: "Uncomplete the last task I finished"

Error Handling:
  - Returns error if task_id doesn't exist
  - Returns error if the item is not a Task (e.g., it's a Note, Project, or Folder)
  - Returns error if database write fails`,
    inputSchema: CompleteTaskInputSchema,
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false
    }
  },
  async (params: { task_id: string; completed?: boolean }) => {
    let db: Database.Database | null = null;

    try {
      // Open database
      db = openDatabase();

      // Check if item exists and get its type
      const item = db.prepare("SELECT * FROM items WHERE id = ?").get(params.task_id) as DirectGTDItem | undefined;

      if (!item) {
        return {
          content: [{
            type: "text",
            text: `Error: No item found with ID: ${params.task_id}`
          }],
          isError: true
        };
      }

      // Validate that the item is a Task
      if (item.item_type !== "Task") {
        return {
          content: [{
            type: "text",
            text: `Error: Cannot complete item of type '${item.item_type}'. Only Tasks can be marked as completed. This item is a ${item.item_type}.`
          }],
          isError: true
        };
      }

      // Determine completion timestamp
      const shouldComplete = params.completed ?? true;
      const completedAt = shouldComplete ? Math.floor(Date.now() / 1000) : null;
      const modifiedAt = Math.floor(Date.now() / 1000);

      // Update the task
      const updateStmt = db.prepare(`
        UPDATE items
        SET completed_at = ?, modified_at = ?, needs_push = 1
        WHERE id = ?
      `);

      updateStmt.run(completedAt, modifiedAt, params.task_id);

      // Fetch the updated item
      const updatedItem = db.prepare("SELECT * FROM items WHERE id = ?").get(params.task_id) as DirectGTDItem;
      const formattedItem = formatItem(updatedItem);

      const statusText = shouldComplete ? "completed" : "uncompleted";
      const result = `# Task ${shouldComplete ? "Completed" : "Uncompleted"}

**${formattedItem.title}**

- **ID**: ${formattedItem.id}
- **Type**: Task
- **Status**: ${shouldComplete ? "✓ Completed" : "○ Not Completed"}
- **Modified**: ${formatDate(formattedItem.modifiedAt)}
${formattedItem.completedAt ? `- **Completed At**: ${formatDate(formattedItem.completedAt)}` : ''}

Task successfully marked as ${statusText}.`;

      return {
        content: [{
          type: "text",
          text: result
        }]
      };

    } catch (error) {
      return {
        content: [{
          type: "text",
          text: handleDatabaseError(error)
        }],
        isError: true
      };
    } finally {
      // Clean up database connection
      if (db) {
        try {
          db.close();
        } catch {
          // Ignore errors on close
        }
      }
    }
  }
);

// Register the change_item_type tool
server.registerTool(
  "directgtd_change_item_type",
  {
    title: "Change Item Type",
    description: `Change the type of any item in DirectGTD.

This tool allows you to convert items between different types (Task, Note, Project, Folder, etc.). You can change any item type to any other type.

Args:
  - item_id (string, required): The ID of the item to change. Example: '2EADCE4C-538A-444F-BE61-B4AF0047B2EC'
  - new_type (string, required): The new item type. Example: 'Task', 'Note', 'Project', 'Folder'

Returns:
  The updated item with its new type.

Important Notes:
  - When changing FROM Task to non-Task type, any completion status will be cleared (since only Tasks can be completed)
  - All other properties (title, parent, due date, etc.) remain unchanged

Examples:
  - Use when: "Convert this note to a task"
  - Use when: "Change the project to a folder"
  - Use when: "Make this task a note"

Error Handling:
  - Returns error if item_id doesn't exist
  - Returns error if database write fails`,
    inputSchema: ChangeItemTypeInputSchema,
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false
    }
  },
  async (params: { item_id: string; new_type: string }) => {
    let db: Database.Database | null = null;

    try {
      // Open database
      db = openDatabase();

      // Check if item exists
      const item = db.prepare("SELECT * FROM items WHERE id = ?").get(params.item_id) as DirectGTDItem | undefined;

      if (!item) {
        return {
          content: [{
            type: "text",
            text: `Error: No item found with ID: ${params.item_id}`
          }],
          isError: true
        };
      }

      const oldType = item.item_type;
      const newType = params.new_type;
      const modifiedAt = Math.floor(Date.now() / 1000);

      // If changing FROM Task to non-Task, clear completed_at
      let completedAt = item.completed_at;
      if (oldType === "Task" && newType !== "Task" && completedAt) {
        completedAt = null;
      }

      // Update the item type
      const updateStmt = db.prepare(`
        UPDATE items
        SET item_type = ?, modified_at = ?, completed_at = ?, needs_push = 1
        WHERE id = ?
      `);

      updateStmt.run(newType, modifiedAt, completedAt, params.item_id);

      // Fetch the updated item
      const updatedItem = db.prepare("SELECT * FROM items WHERE id = ?").get(params.item_id) as DirectGTDItem;
      const formattedItem = formatItem(updatedItem);

      const clearedCompletionNote = (oldType === "Task" && newType !== "Task" && item.completed_at)
        ? "\n- **Note**: Completion status cleared (only Tasks can be completed)"
        : "";

      const result = `# Item Type Changed

**${formattedItem.title}**

- **ID**: ${formattedItem.id}
- **Old Type**: ${oldType}
- **New Type**: ${newType}
- **Modified**: ${formatDate(formattedItem.modifiedAt)}${clearedCompletionNote}

Item type successfully changed from ${oldType} to ${newType}.`;

      return {
        content: [{
          type: "text",
          text: result
        }]
      };

    } catch (error) {
      return {
        content: [{
          type: "text",
          text: handleDatabaseError(error)
        }],
        isError: true
      };
    } finally {
      // Clean up database connection
      if (db) {
        try {
          db.close();
        } catch {
          // Ignore errors on close
        }
      }
    }
  }
);

// Register the get_item tool
server.registerTool(
  "directgtd_get_item",
  {
    title: "Get Item by ID",
    description: `Retrieve a single item by its ID.

This tool fetches a specific item's complete details using its unique identifier.

Args:
  - item_id (string, required): The item ID. Example: '2EADCE4C-538A-444F-BE61-B4AF0047B2EC'
  - response_format ('markdown' | 'json', optional): Output format (default: 'markdown')

Returns:
  The item with all its details.

Examples:
  - Use when: "Get details for item X"
  - Use when: "Show me the item with ID ABC123"
  - Use when: "What are the details of this task?"

Error Handling:
  - Returns error if item_id doesn't exist`,
    inputSchema: GetItemInputSchema,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false
    }
  },
  async (params: { item_id: string; response_format?: ResponseFormat }) => {
    let db: Database.Database | null = null;

    try {
      db = openDatabase();
      const responseFormat = params.response_format ?? ResponseFormat.MARKDOWN;

      const item = db.prepare("SELECT * FROM items WHERE id = ?").get(params.item_id) as DirectGTDItem | undefined;

      if (!item) {
        return {
          content: [{
            type: "text",
            text: `Error: No item found with ID: ${params.item_id}`
          }],
          isError: true
        };
      }

      const formattedItem = formatItem(item);

      let result: string;
      if (responseFormat === ResponseFormat.MARKDOWN) {
        result = `# ${formattedItem.title}

- **ID**: ${formattedItem.id}
- **Type**: ${item.item_type}
- **Parent ID**: ${formattedItem.parentId || "None (root item)"}
- **Sort Order**: ${formattedItem.sortOrder}
- **Created**: ${formatDate(formattedItem.createdAt)}
- **Modified**: ${formatDate(formattedItem.modifiedAt)}
${formattedItem.completedAt ? `- **Completed**: ${formatDate(formattedItem.completedAt)}` : ''}
${formattedItem.dueDate ? `- **Due Date**: ${formatDate(formattedItem.dueDate)}` : ''}
${formattedItem.earliestStartTime ? `- **Earliest Start**: ${formatDate(formattedItem.earliestStartTime)}` : ''}`;
      } else {
        result = JSON.stringify({
          ...formattedItem,
          item_type: item.item_type
        }, null, 2);
      }

      return {
        content: [{
          type: "text",
          text: result
        }]
      };

    } catch (error) {
      return {
        content: [{
          type: "text",
          text: handleDatabaseError(error)
        }],
        isError: true
      };
    } finally {
      if (db) {
        try {
          db.close();
        } catch {
          // Ignore errors on close
        }
      }
    }
  }
);

// Register the delete_item tool
server.registerTool(
  "directgtd_delete_item",
  {
    title: "Delete Item",
    description: `Delete an item from DirectGTD by moving it to the Trash folder.

This tool moves an item (and its children) to the Trash folder. Use directgtd_empty_trash to permanently delete trashed items.

Args:
  - item_id (string, required): The ID of the item to delete. Example: '2EADCE4C-538A-444F-BE61-B4AF0047B2EC'

Returns:
  Confirmation of deletion with item details.

Examples:
  - Use when: "Delete this item"
  - Use when: "Remove the task 'buy milk'"
  - Use when: "Clean up completed items"

Error Handling:
  - Returns error if item_id doesn't exist
  - Returns error if Trash folder doesn't exist
  - Returns error if database write fails`,
    inputSchema: DeleteItemInputSchema,
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: false
    }
  },
  async (params: { item_id: string }) => {
    let db: Database.Database | null = null;

    try {
      db = openDatabase();

      // Get item before moving to show confirmation
      const item = db.prepare("SELECT * FROM items WHERE id = ?").get(params.item_id) as DirectGTDItem | undefined;

      if (!item) {
        return {
          content: [{
            type: "text",
            text: `Error: No item found with ID: ${params.item_id}`
          }],
          isError: true
        };
      }

      // Find the Trash folder
      const trashFolder = db.prepare(
        "SELECT id FROM items WHERE LOWER(title) = 'trash' AND parent_id IS NULL"
      ).get() as { id: string } | undefined;

      if (!trashFolder) {
        return {
          content: [{
            type: "text",
            text: `Error: Trash folder not found. Please create a root-level folder named "Trash".`
          }],
          isError: true
        };
      }

      // Move item to Trash
      const now = Math.floor(Date.now() / 1000);
      db.prepare("UPDATE items SET parent_id = ?, modified_at = ?, needs_push = 1 WHERE id = ?").run(trashFolder.id, now, params.item_id);

      const result = `# Item Deleted

**${item.title}**

- **ID**: ${item.id}
- **Type**: ${item.item_type}

Item moved to Trash.`;

      return {
        content: [{
          type: "text",
          text: result
        }]
      };

    } catch (error) {
      return {
        content: [{
          type: "text",
          text: handleDatabaseError(error)
        }],
        isError: true
      };
    } finally {
      if (db) {
        try {
          db.close();
        } catch {
          // Ignore errors on close
        }
      }
    }
  }
);

// Register the move_item tool
server.registerTool(
  "directgtd_move_item",
  {
    title: "Move Item",
    description: `Move an item to a different parent folder or project.

This tool changes an item's parent_id, reorganizing it within the DirectGTD hierarchy. Essential for inbox processing and organization.

Args:
  - item_id (string, required): The item to move. Example: '2EADCE4C-538A-444F-BE61-B4AF0047B2EC'
  - new_parent_id (string, required): The new parent folder/project ID. Example: '3F8A9B2C-1D4E-5F6A-7B8C-9D0E1F2A3B4C'

Returns:
  Confirmation with item details and new location.

Examples:
  - Use when: "Move this task to Home folder"
  - Use when: "Organize inbox item into Projects"
  - Use when: "Relocate this note to Archive"

Error Handling:
  - Returns error if item_id doesn't exist
  - Returns error if new_parent_id doesn't exist
  - Returns error if database write fails`,
    inputSchema: MoveItemInputSchema,
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false
    }
  },
  async (params: { item_id: string; new_parent_id: string }) => {
    let db: Database.Database | null = null;

    try {
      db = openDatabase();

      // Verify item exists
      const item = db.prepare("SELECT * FROM items WHERE id = ?").get(params.item_id) as DirectGTDItem | undefined;
      if (!item) {
        return {
          content: [{
            type: "text",
            text: `Error: No item found with ID: ${params.item_id}`
          }],
          isError: true
        };
      }

      // Verify new parent exists
      const newParent = db.prepare("SELECT * FROM items WHERE id = ?").get(params.new_parent_id) as DirectGTDItem | undefined;
      if (!newParent) {
        return {
          content: [{
            type: "text",
            text: `Error: No parent found with ID: ${params.new_parent_id}`
          }],
          isError: true
        };
      }

      const oldParentId = item.parent_id;
      const modifiedAt = Math.floor(Date.now() / 1000);

      // Get next sort order in new parent
      const sortOrder = getNextSortOrder(db, params.new_parent_id);

      // Move the item
      const updateStmt = db.prepare(`
        UPDATE items
        SET parent_id = ?, sort_order = ?, modified_at = ?, needs_push = 1
        WHERE id = ?
      `);
      updateStmt.run(params.new_parent_id, sortOrder, modifiedAt, params.item_id);

      const result = `# Item Moved

**${item.title}**

- **ID**: ${item.id}
- **Type**: ${item.item_type}
- **Old Parent**: ${oldParentId || "None (was root)"}
- **New Parent**: ${params.new_parent_id} (${newParent.title})
- **New Sort Order**: ${sortOrder}
- **Modified**: ${formatDate(new Date(modifiedAt * 1000).toISOString())}

Item successfully moved to "${newParent.title}".`;

      return {
        content: [{
          type: "text",
          text: result
        }]
      };

    } catch (error) {
      return {
        content: [{
          type: "text",
          text: handleDatabaseError(error)
        }],
        isError: true
      };
    } finally {
      if (db) {
        try {
          db.close();
        } catch {
          // Ignore errors on close
        }
      }
    }
  }
);

// Register the archive_item tool
server.registerTool(
  "directgtd_archive_item",
  {
    title: "Archive Item",
    description: `Archive an item by moving it to the default Archive folder.

This tool moves an item (and all its descendants) to the Archive folder configured in app settings. Use this when you want to keep an item for reference but remove it from active lists.

Args:
  - item_id (string, required): The item to archive. Example: '2EADCE4C-538A-444F-BE61-B4AF0047B2EC'

Returns:
  Confirmation with item details and archive location.

Examples:
  - Use when: "Archive this completed project"
  - Use when: "Move this task to archive"
  - Use when: "Archive the old folder"

Error Handling:
  - Returns error if item_id doesn't exist
  - Returns error if archive folder is not configured
  - Returns error if database write fails`,
    inputSchema: ArchiveItemInputSchema,
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false
    }
  },
  async (params: { item_id: string }) => {
    let db: Database.Database | null = null;

    try {
      db = openDatabase();

      // Get archive folder ID
      const archiveFolderId = getArchiveFolderId(db);
      if (!archiveFolderId) {
        return {
          content: [{
            type: "text",
            text: "Error: Archive folder not configured in app settings. Please set an archive folder in the DirectGTD app."
          }],
          isError: true
        };
      }

      // Verify item exists
      const item = db.prepare("SELECT * FROM items WHERE id = ?").get(params.item_id) as DirectGTDItem | undefined;
      if (!item) {
        return {
          content: [{
            type: "text",
            text: `Error: No item found with ID: ${params.item_id}`
          }],
          isError: true
        };
      }

      // Verify archive folder exists
      const archiveFolder = db.prepare("SELECT * FROM items WHERE id = ?").get(archiveFolderId) as DirectGTDItem | undefined;
      if (!archiveFolder) {
        return {
          content: [{
            type: "text",
            text: `Error: Archive folder not found with ID: ${archiveFolderId}. Please reconfigure the archive folder in the DirectGTD app.`
          }],
          isError: true
        };
      }

      // Check if item is already in archive
      const existingArchiveIds = getArchiveDescendantIds(db);
      if (existingArchiveIds.has(params.item_id)) {
        return {
          content: [{
            type: "text",
            text: `Item "${item.title}" is already in the Archive folder.`
          }],
          isError: false
        };
      }

      // Get old parent info for reporting
      const oldParentId = item.parent_id;
      let oldParentTitle = "Root";
      if (oldParentId) {
        const oldParent = db.prepare("SELECT title FROM items WHERE id = ?").get(oldParentId) as { title: string } | undefined;
        oldParentTitle = oldParent?.title ?? "Unknown";
      }

      // Get new sort order in archive folder
      const sortOrder = getNextSortOrder(db, archiveFolderId);

      // Update the item
      const modifiedAt = Date.now() / 1000;
      db.prepare(
        "UPDATE items SET parent_id = ?, sort_order = ?, modified_at = ?, needs_push = 1 WHERE id = ?"
      ).run(archiveFolderId, sortOrder, modifiedAt, params.item_id);

      const result = `# Item Archived

**${item.title}**

- **ID**: ${item.id}
- **Type**: ${item.item_type}
- **From**: ${oldParentTitle}
- **To**: ${archiveFolder.title}
- **Archived**: ${formatDate(new Date(modifiedAt * 1000).toISOString())}

Item successfully archived.`;

      return {
        content: [{
          type: "text",
          text: result
        }]
      };

    } catch (error) {
      return {
        content: [{
          type: "text",
          text: handleDatabaseError(error)
        }],
        isError: true
      };
    } finally {
      if (db) {
        try {
          db.close();
        } catch {
          // Ignore errors on close
        }
      }
    }
  }
);

// Register the update_title tool
server.registerTool(
  "directgtd_update_title",
  {
    title: "Update Item Title",
    description: `Update an item's title.

This tool changes the title/name of any item. Useful for fixing typos or refining descriptions.

Args:
  - item_id (string, required): The item to update. Example: '2EADCE4C-538A-444F-BE61-B4AF0047B2EC'
  - new_title (string, required): The new title. Example: 'Buy organic milk'

Returns:
  Confirmation with old and new titles.

Examples:
  - Use when: "Rename this task to 'Buy organic milk'"
  - Use when: "Fix typo in item title"
  - Use when: "Update the title to be more specific"

Error Handling:
  - Returns error if item_id doesn't exist
  - Returns error if database write fails`,
    inputSchema: UpdateTitleInputSchema,
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false
    }
  },
  async (params: { item_id: string; new_title: string }) => {
    let db: Database.Database | null = null;

    try {
      db = openDatabase();

      const item = db.prepare("SELECT * FROM items WHERE id = ?").get(params.item_id) as DirectGTDItem | undefined;
      if (!item) {
        return {
          content: [{
            type: "text",
            text: `Error: No item found with ID: ${params.item_id}`
          }],
          isError: true
        };
      }

      const oldTitle = item.title;
      const modifiedAt = Math.floor(Date.now() / 1000);

      const updateStmt = db.prepare(`
        UPDATE items
        SET title = ?, modified_at = ?, needs_push = 1
        WHERE id = ?
      `);
      updateStmt.run(params.new_title, modifiedAt, params.item_id);

      const result = `# Title Updated

- **ID**: ${item.id}
- **Type**: ${item.item_type}
- **Old Title**: ${oldTitle}
- **New Title**: ${params.new_title}
- **Modified**: ${formatDate(new Date(modifiedAt * 1000).toISOString())}

Title successfully updated.`;

      return {
        content: [{
          type: "text",
          text: result
        }]
      };

    } catch (error) {
      return {
        content: [{
          type: "text",
          text: handleDatabaseError(error)
        }],
        isError: true
      };
    } finally {
      if (db) {
        try {
          db.close();
        } catch {
          // Ignore errors on close
        }
      }
    }
  }
);

// Register the update_due_date tool
server.registerTool(
  "directgtd_update_due_date",
  {
    title: "Update Due Date",
    description: `Update an item's due date.

This tool changes or clears an item's due date. Pass null to remove the due date.

Args:
  - item_id (string, required): The item to update. Example: '2EADCE4C-538A-444F-BE61-B4AF0047B2EC'
  - due_date (string | null, optional): New due date in ISO 8601 format, or null to clear. Example: '2024-11-20T17:00:00Z'

Returns:
  Confirmation with old and new due dates.

Examples:
  - Use when: "Reschedule this task to next Monday"
  - Use when: "Set due date to December 1st"
  - Use when: "Remove the due date"

Error Handling:
  - Returns error if item_id doesn't exist
  - Returns error if database write fails`,
    inputSchema: UpdateDueDateInputSchema,
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false
    }
  },
  async (params: { item_id: string; due_date?: string | null }) => {
    let db: Database.Database | null = null;

    try {
      db = openDatabase();

      const item = db.prepare("SELECT * FROM items WHERE id = ?").get(params.item_id) as DirectGTDItem | undefined;
      if (!item) {
        return {
          content: [{
            type: "text",
            text: `Error: No item found with ID: ${params.item_id}`
          }],
          isError: true
        };
      }

      const oldDueDate = item.due_date;
      const modifiedAt = Math.floor(Date.now() / 1000);

      let newDueDateTimestamp: number | null = null;
      if (params.due_date && params.due_date !== null) {
        newDueDateTimestamp = Math.floor(new Date(params.due_date).getTime() / 1000);
      }

      const updateStmt = db.prepare(`
        UPDATE items
        SET due_date = ?, modified_at = ?, needs_push = 1
        WHERE id = ?
      `);
      updateStmt.run(newDueDateTimestamp, modifiedAt, params.item_id);

      const oldDueDateStr = oldDueDate ? formatDate(new Date(parseInt(oldDueDate) * 1000).toISOString()) : "None";
      const newDueDateStr = newDueDateTimestamp ? formatDate(new Date(newDueDateTimestamp * 1000).toISOString()) : "None";

      const result = `# Due Date Updated

**${item.title}**

- **ID**: ${item.id}
- **Type**: ${item.item_type}
- **Old Due Date**: ${oldDueDateStr}
- **New Due Date**: ${newDueDateStr}
- **Modified**: ${formatDate(new Date(modifiedAt * 1000).toISOString())}

Due date successfully updated.`;

      return {
        content: [{
          type: "text",
          text: result
        }]
      };

    } catch (error) {
      return {
        content: [{
          type: "text",
          text: handleDatabaseError(error)
        }],
        isError: true
      };
    } finally {
      if (db) {
        try {
          db.close();
        } catch {
          // Ignore errors on close
        }
      }
    }
  }
);

// Register the update_earliest_start_time tool
server.registerTool(
  "directgtd_update_earliest_start_time",
  {
    title: "Update Earliest Start Time",
    description: `Update an item's earliest start time (defer/schedule).

This tool changes or clears an item's earliest start time. Pass null to remove the start time. Useful for deferring items or scheduling when work can begin.

Args:
  - item_id (string, required): The item to update. Example: '2EADCE4C-538A-444F-BE61-B4AF0047B2EC'
  - earliest_start_time (string | null, optional): New start time in ISO 8601 format, or null to clear. Example: '2024-11-20T09:00:00Z'

Returns:
  Confirmation with old and new earliest start times.

Examples:
  - Use when: "Defer this task until next Monday"
  - Use when: "Set start time to December 1st at 9am"
  - Use when: "Remove the start time restriction"

Error Handling:
  - Returns error if item_id doesn't exist
  - Returns error if database write fails`,
    inputSchema: UpdateEarliestStartTimeInputSchema,
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false
    }
  },
  async (params: { item_id: string; earliest_start_time?: string | null }) => {
    let db: Database.Database | null = null;

    try {
      db = openDatabase();

      const item = db.prepare("SELECT * FROM items WHERE id = ?").get(params.item_id) as DirectGTDItem | undefined;
      if (!item) {
        return {
          content: [{
            type: "text",
            text: `Error: No item found with ID: ${params.item_id}`
          }],
          isError: true
        };
      }

      const oldStartTime = item.earliest_start_time;
      const modifiedAt = Math.floor(Date.now() / 1000);

      let newStartTimeTimestamp: number | null = null;
      if (params.earliest_start_time && params.earliest_start_time !== null) {
        newStartTimeTimestamp = Math.floor(new Date(params.earliest_start_time).getTime() / 1000);
      }

      const updateStmt = db.prepare(`
        UPDATE items
        SET earliest_start_time = ?, modified_at = ?, needs_push = 1
        WHERE id = ?
      `);
      updateStmt.run(newStartTimeTimestamp, modifiedAt, params.item_id);

      const oldStartTimeStr = oldStartTime ? formatDate(new Date(parseInt(oldStartTime) * 1000).toISOString()) : "None";
      const newStartTimeStr = newStartTimeTimestamp ? formatDate(new Date(newStartTimeTimestamp * 1000).toISOString()) : "None";

      const result = `# Earliest Start Time Updated

**${item.title}**

- **ID**: ${item.id}
- **Type**: ${item.item_type}
- **Old Start Time**: ${oldStartTimeStr}
- **New Start Time**: ${newStartTimeStr}
- **Modified**: ${formatDate(new Date(modifiedAt * 1000).toISOString())}

Earliest start time successfully updated.`;

      return {
        content: [{
          type: "text",
          text: result
        }]
      };

    } catch (error) {
      return {
        content: [{
          type: "text",
          text: handleDatabaseError(error)
        }],
        isError: true
      };
    } finally {
      if (db) {
        try {
          db.close();
        } catch {
          // Ignore errors on close
        }
      }
    }
  }
);

// Register the get_all_tags tool
server.registerTool(
  "directgtd_get_all_tags",
  {
    title: "Get All Tags",
    description: `Get a list of all available tags in DirectGTD.

This tool retrieves all tags defined in the system, including their names and colors. Useful for seeing what tags are available for organizing items.

Args:
  - response_format ('markdown' | 'json', optional): Output format (default: 'markdown')

Returns:
  List of all tags with their IDs, names, and colors.

Examples:
  - Use when: "Show me all available tags"
  - Use when: "What tags can I use?"
  - Use when: "List all tags in the system"

Error Handling:
  - Returns empty list if no tags exist
  - Returns error if database read fails`,
    inputSchema: GetAllTagsInputSchema,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false
    }
  },
  async (params: { response_format?: ResponseFormat }) => {
    let db: Database.Database | null = null;

    try {
      db = openDatabase();
      const responseFormat = params.response_format ?? ResponseFormat.MARKDOWN;

      // Query all tags
      const tags = db.prepare("SELECT * FROM tags ORDER BY name").all() as DirectGTDTag[];

      let result: string;
      if (responseFormat === ResponseFormat.MARKDOWN) {
        if (tags.length === 0) {
          result = "No tags found in DirectGTD.";
        } else {
          const lines: string[] = [
            "# DirectGTD Tags",
            "",
            `Found ${tags.length} tag${tags.length === 1 ? '' : 's'}:`,
            ""
          ];

          for (const tag of tags) {
            const colorIndicator = tag.color ? ` ● ${tag.color}` : "";
            lines.push(`## ${tag.name}${colorIndicator}`);
            lines.push(`- **ID**: ${tag.id}`);
            if (tag.color) {
              lines.push(`- **Color**: ${tag.color}`);
            }
            lines.push("");
          }

          result = lines.join("\n");
        }
      } else {
        result = JSON.stringify({
          total: tags.length,
          tags: tags.map(tag => ({
            id: tag.id,
            name: tag.name,
            color: tag.color
          }))
        }, null, 2);
      }

      return {
        content: [{
          type: "text",
          text: result
        }]
      };

    } catch (error) {
      return {
        content: [{
          type: "text",
          text: handleDatabaseError(error)
        }],
        isError: true
      };
    } finally {
      if (db) {
        try {
          db.close();
        } catch {
          // Ignore errors on close
        }
      }
    }
  }
);

// Register the add_tag_to_item tool
server.registerTool(
  "directgtd_add_tag_to_item",
  {
    title: "Add Tag to Item",
    description: `Add a tag to an item in DirectGTD.

This tool creates an association between an item and a tag. If the tag is already applied, no duplicate will be created.

Args:
  - item_id (string, required): The item to tag. Example: '2EADCE4C-538A-444F-BE61-B4AF0047B2EC'
  - tag_id (string, required): The tag to add. Example: '22B0B1F4-1950-4E2B-9E1C-4DD059AB2267'

Returns:
  Confirmation with item and tag details.

Examples:
  - Use when: "Tag this task with @home"
  - Use when: "Add @office tag to this item"
  - Use when: "Apply the @errand tag"

Error Handling:
  - Returns error if item_id doesn't exist
  - Returns error if tag_id doesn't exist
  - Returns info if tag already applied`,
    inputSchema: AddTagToItemInputSchema,
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false
    }
  },
  async (params: { item_id: string; tag_id: string }) => {
    let db: Database.Database | null = null;

    try {
      db = openDatabase();

      // Verify item exists
      const item = db.prepare("SELECT * FROM items WHERE id = ?").get(params.item_id) as DirectGTDItem | undefined;
      if (!item) {
        return {
          content: [{
            type: "text",
            text: `Error: No item found with ID: ${params.item_id}`
          }],
          isError: true
        };
      }

      // Verify tag exists
      const tag = db.prepare("SELECT * FROM tags WHERE id = ?").get(params.tag_id) as DirectGTDTag | undefined;
      if (!tag) {
        return {
          content: [{
            type: "text",
            text: `Error: No tag found with ID: ${params.tag_id}`
          }],
          isError: true
        };
      }

      // Check if already tagged
      const existing = db.prepare("SELECT * FROM item_tags WHERE item_id = ? AND tag_id = ?")
        .get(params.item_id, params.tag_id);

      if (existing) {
        return {
          content: [{
            type: "text",
            text: `# Tag Already Applied

**${item.title}** already has tag **${tag.name}**

No changes made.`
          }]
        };
      }

      // Add the tag
      const tagNow = Math.floor(Date.now() / 1000);
      db.prepare("INSERT INTO item_tags (item_id, tag_id, created_at, modified_at, needs_push) VALUES (?, ?, ?, ?, 1)")
        .run(params.item_id, params.tag_id, tagNow, tagNow);

      // Update modified_at for the item
      const modifiedAt = Math.floor(Date.now() / 1000);
      db.prepare("UPDATE items SET modified_at = ?, needs_push = 1 WHERE id = ?")
        .run(modifiedAt, params.item_id);

      const result = `# Tag Added

**${item.title}**

Added tag: **${tag.name}** ${tag.color ? `● ${tag.color}` : ''}

- **Item ID**: ${params.item_id}
- **Tag ID**: ${params.tag_id}
- **Modified**: ${formatDate(new Date(modifiedAt * 1000).toISOString())}

Tag successfully applied.`;

      return {
        content: [{
          type: "text",
          text: result
        }]
      };

    } catch (error) {
      return {
        content: [{
          type: "text",
          text: handleDatabaseError(error)
        }],
        isError: true
      };
    } finally {
      if (db) {
        try {
          db.close();
        } catch {
          // Ignore errors on close
        }
      }
    }
  }
);

// Register the remove_tag_from_item tool
server.registerTool(
  "directgtd_remove_tag_from_item",
  {
    title: "Remove Tag from Item",
    description: `Remove a tag from an item in DirectGTD.

This tool removes the association between an item and a tag.

Args:
  - item_id (string, required): The item to untag. Example: '2EADCE4C-538A-444F-BE61-B4AF0047B2EC'
  - tag_id (string, required): The tag to remove. Example: '22B0B1F4-1950-4E2B-9E1C-4DD059AB2267'

Returns:
  Confirmation with item and tag details.

Examples:
  - Use when: "Remove @home tag from this task"
  - Use when: "Untag this item from @office"
  - Use when: "Delete the @errand tag from this"

Error Handling:
  - Returns error if item_id doesn't exist
  - Returns error if tag_id doesn't exist
  - Returns info if tag wasn't applied`,
    inputSchema: RemoveTagFromItemInputSchema,
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false
    }
  },
  async (params: { item_id: string; tag_id: string }) => {
    let db: Database.Database | null = null;

    try {
      db = openDatabase();

      // Verify item exists
      const item = db.prepare("SELECT * FROM items WHERE id = ?").get(params.item_id) as DirectGTDItem | undefined;
      if (!item) {
        return {
          content: [{
            type: "text",
            text: `Error: No item found with ID: ${params.item_id}`
          }],
          isError: true
        };
      }

      // Verify tag exists
      const tag = db.prepare("SELECT * FROM tags WHERE id = ?").get(params.tag_id) as DirectGTDTag | undefined;
      if (!tag) {
        return {
          content: [{
            type: "text",
            text: `Error: No tag found with ID: ${params.tag_id}`
          }],
          isError: true
        };
      }

      // Check if tag is applied
      const existing = db.prepare("SELECT * FROM item_tags WHERE item_id = ? AND tag_id = ?")
        .get(params.item_id, params.tag_id);

      if (!existing) {
        return {
          content: [{
            type: "text",
            text: `# Tag Not Applied

**${item.title}** doesn't have tag **${tag.name}**

No changes made.`
          }]
        };
      }

      // Remove the tag
      db.prepare("DELETE FROM item_tags WHERE item_id = ? AND tag_id = ?")
        .run(params.item_id, params.tag_id);

      // Update modified_at for the item
      const modifiedAt = Math.floor(Date.now() / 1000);
      db.prepare("UPDATE items SET modified_at = ?, needs_push = 1 WHERE id = ?")
        .run(modifiedAt, params.item_id);

      const result = `# Tag Removed

**${item.title}**

Removed tag: **${tag.name}** ${tag.color ? `● ${tag.color}` : ''}

- **Item ID**: ${params.item_id}
- **Tag ID**: ${params.tag_id}
- **Modified**: ${formatDate(new Date(modifiedAt * 1000).toISOString())}

Tag successfully removed.`;

      return {
        content: [{
          type: "text",
          text: result
        }]
      };

    } catch (error) {
      return {
        content: [{
          type: "text",
          text: handleDatabaseError(error)
        }],
        isError: true
      };
    } finally {
      if (db) {
        try {
          db.close();
        } catch {
          // Ignore errors on close
        }
      }
    }
  }
);

// Register the get_item_tags tool
server.registerTool(
  "directgtd_get_item_tags",
  {
    title: "Get Item Tags",
    description: `Get all tags applied to an item.

This tool retrieves all tags associated with a specific item.

Args:
  - item_id (string, required): The item whose tags to retrieve. Example: '2EADCE4C-538A-444F-BE61-B4AF0047B2EC'
  - response_format ('markdown' | 'json', optional): Output format (default: 'markdown')

Returns:
  List of tags applied to the item.

Examples:
  - Use when: "What tags does this item have?"
  - Use when: "Show me the tags on this task"
  - Use when: "List tags for this item"

Error Handling:
  - Returns error if item_id doesn't exist
  - Returns empty list if no tags applied`,
    inputSchema: GetItemTagsInputSchema,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false
    }
  },
  async (params: { item_id: string; response_format?: ResponseFormat }) => {
    let db: Database.Database | null = null;

    try {
      db = openDatabase();
      const responseFormat = params.response_format ?? ResponseFormat.MARKDOWN;

      // Verify item exists
      const item = db.prepare("SELECT * FROM items WHERE id = ?").get(params.item_id) as DirectGTDItem | undefined;
      if (!item) {
        return {
          content: [{
            type: "text",
            text: `Error: No item found with ID: ${params.item_id}`
          }],
          isError: true
        };
      }

      // Get tags for the item
      const tags = db.prepare(`
        SELECT t.* FROM tags t
        JOIN item_tags it ON t.id = it.tag_id
        WHERE it.item_id = ?
        ORDER BY t.name
      `).all(params.item_id) as DirectGTDTag[];

      let result: string;
      if (responseFormat === ResponseFormat.MARKDOWN) {
        if (tags.length === 0) {
          result = `# Tags for "${item.title}"

No tags applied to this item.`;
        } else {
          const lines: string[] = [
            `# Tags for "${item.title}"`,
            "",
            `Item has ${tags.length} tag${tags.length === 1 ? '' : 's'}:`,
            ""
          ];

          for (const tag of tags) {
            const colorIndicator = tag.color ? ` ● ${tag.color}` : "";
            lines.push(`- **${tag.name}**${colorIndicator}`);
          }

          result = lines.join("\n");
        }
      } else {
        result = JSON.stringify({
          item_id: params.item_id,
          item_title: item.title,
          total: tags.length,
          tags: tags.map(tag => ({
            id: tag.id,
            name: tag.name,
            color: tag.color
          }))
        }, null, 2);
      }

      return {
        content: [{
          type: "text",
          text: result
        }]
      };

    } catch (error) {
      return {
        content: [{
          type: "text",
          text: handleDatabaseError(error)
        }],
        isError: true
      };
    } finally {
      if (db) {
        try {
          db.close();
        } catch {
          // Ignore errors on close
        }
      }
    }
  }
);

// Register the get_overdue_items tool
server.registerTool(
  "directgtd_get_overdue_items",
  {
    title: "Get Overdue Items",
    description: `Get all overdue items from DirectGTD.

This tool retrieves items where the due date has passed and the task is not completed.

Args:
  - include_completed (boolean, optional): Include completed overdue items (default: false)
  - response_format ('markdown' | 'json', optional): Output format (default: 'markdown')

Returns:
  Items that are overdue, sorted by due date (oldest first).

Examples:
  - Use when: "Show me all overdue tasks"
  - Use when: "What items are past their due date?"
  - Use when: "List overdue items"

Error Handling:
  - Returns empty list if no overdue items exist`,
    inputSchema: GetOverdueItemsInputSchema,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false
    }
  },
  async (params: { include_completed?: boolean; include_archive?: boolean; response_format?: ResponseFormat }) => {
    let db: Database.Database | null = null;

    try {
      db = openDatabase();
      const responseFormat = params.response_format ?? ResponseFormat.MARKDOWN;
      const includeCompleted = params.include_completed ?? false;
      const includeArchive = params.include_archive ?? false;
      const now = Date.now() / 1000; // Convert to Unix timestamp

      // Get archive IDs to exclude
      const archiveIds = includeArchive ? new Set<string>() : getArchiveDescendantIds(db);

      // Query for overdue items
      const query = includeCompleted
        ? "SELECT * FROM items WHERE due_date < ? AND due_date IS NOT NULL AND deleted_at IS NULL ORDER BY due_date ASC"
        : "SELECT * FROM items WHERE due_date < ? AND due_date IS NOT NULL AND completed_at IS NULL AND deleted_at IS NULL ORDER BY due_date ASC";

      let items = db.prepare(query).all(now) as DirectGTDItem[];

      // Filter out archive items
      if (archiveIds.size > 0) {
        items = items.filter(item => !archiveIds.has(item.id));
      }

      const formattedItems = items.map(formatItem);

      let result: string;
      if (responseFormat === ResponseFormat.MARKDOWN) {
        if (formattedItems.length === 0) {
          result = "# Overdue Items\n\nNo overdue items found.";
        } else {
          const lines: string[] = [
            `# Overdue Items`,
            "",
            `Found ${formattedItems.length} overdue item${formattedItems.length === 1 ? '' : 's'}:`,
            ""
          ];

          for (const item of formattedItems) {
            lines.push(`## ${item.title}`);
            lines.push(`- **ID**: ${item.id}`);
            if (item.dueDate) {
              lines.push(`- **Due Date**: ${formatDate(item.dueDate)}`);
              lines.push(`- **Status**: ${calculateOverdueBy(item.dueDate)}`);
            }
            if (item.completedAt) {
              lines.push(`- **Completed**: ${formatDate(item.completedAt)}`);
            }
            lines.push("");
          }

          result = lines.join("\n");
        }
      } else {
        result = JSON.stringify({
          total: formattedItems.length,
          items: formattedItems
        }, null, 2);
      }

      return {
        content: [{
          type: "text",
          text: result
        }]
      };

    } catch (error) {
      return {
        content: [{
          type: "text",
          text: handleDatabaseError(error)
        }],
        isError: true
      };
    } finally {
      if (db) {
        try {
          db.close();
        } catch {
          // Ignore errors on close
        }
      }
    }
  }
);

// Register the get_due_today tool
server.registerTool(
  "directgtd_get_due_today",
  {
    title: "Get Items Due Today",
    description: `Get all items due today from DirectGTD.

This tool retrieves items with due dates falling within today.

Args:
  - include_completed (boolean, optional): Include completed items (default: false)
  - response_format ('markdown' | 'json', optional): Output format (default: 'markdown')

Returns:
  Items due today, sorted by due date.

Examples:
  - Use when: "What's due today?"
  - Use when: "Show me today's tasks"
  - Use when: "List items due today"

Error Handling:
  - Returns empty list if no items are due today`,
    inputSchema: GetDueTodayInputSchema,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false
    }
  },
  async (params: { include_completed?: boolean; include_archive?: boolean; response_format?: ResponseFormat }) => {
    let db: Database.Database | null = null;

    try {
      db = openDatabase();
      const responseFormat = params.response_format ?? ResponseFormat.MARKDOWN;
      const includeCompleted = params.include_completed ?? false;
      const includeArchive = params.include_archive ?? false;

      // Get archive IDs to exclude
      const archiveIds = includeArchive ? new Set<string>() : getArchiveDescendantIds(db);

      const now = new Date();
      const startOfToday = getStartOfDay(now).getTime() / 1000;
      const endOfToday = getEndOfDay(now).getTime() / 1000;

      // Query for items due today
      const query = includeCompleted
        ? "SELECT * FROM items WHERE due_date >= ? AND due_date <= ? AND due_date IS NOT NULL AND deleted_at IS NULL ORDER BY due_date ASC"
        : "SELECT * FROM items WHERE due_date >= ? AND due_date <= ? AND due_date IS NOT NULL AND completed_at IS NULL AND deleted_at IS NULL ORDER BY due_date ASC";

      let items = db.prepare(query).all(startOfToday, endOfToday) as DirectGTDItem[];

      // Filter out archive items
      if (archiveIds.size > 0) {
        items = items.filter(item => !archiveIds.has(item.id));
      }

      const formattedItems = items.map(formatItem);

      let result: string;
      if (responseFormat === ResponseFormat.MARKDOWN) {
        if (formattedItems.length === 0) {
          result = "# Due Today\n\nNo items due today.";
        } else {
          const lines: string[] = [
            `# Due Today`,
            "",
            `${formattedItems.length} item${formattedItems.length === 1 ? '' : 's'} due today:`,
            ""
          ];

          for (const item of formattedItems) {
            lines.push(`## ${item.title}`);
            lines.push(`- **ID**: ${item.id}`);
            if (item.dueDate) {
              lines.push(`- **Due Date**: ${formatDate(item.dueDate)}`);
            }
            if (item.completedAt) {
              lines.push(`- **Completed**: ${formatDate(item.completedAt)}`);
            }
            lines.push("");
          }

          result = lines.join("\n");
        }
      } else {
        result = JSON.stringify({
          date: now.toISOString().split('T')[0],
          total: formattedItems.length,
          items: formattedItems
        }, null, 2);
      }

      return {
        content: [{
          type: "text",
          text: result
        }]
      };

    } catch (error) {
      return {
        content: [{
          type: "text",
          text: handleDatabaseError(error)
        }],
        isError: true
      };
    } finally {
      if (db) {
        try {
          db.close();
        } catch {
          // Ignore errors on close
        }
      }
    }
  }
);

// Register the get_due_tomorrow tool
server.registerTool(
  "directgtd_get_due_tomorrow",
  {
    title: "Get Items Due Tomorrow",
    description: `Get all items due tomorrow from DirectGTD.

This tool retrieves items with due dates falling within tomorrow.

Args:
  - include_completed (boolean, optional): Include completed items (default: false)
  - response_format ('markdown' | 'json', optional): Output format (default: 'markdown')

Returns:
  Items due tomorrow, sorted by due date.

Examples:
  - Use when: "What's due tomorrow?"
  - Use when: "Show me tomorrow's tasks"
  - Use when: "List items due tomorrow"

Error Handling:
  - Returns empty list if no items are due tomorrow`,
    inputSchema: GetDueTomorrowInputSchema,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false
    }
  },
  async (params: { include_completed?: boolean; include_archive?: boolean; response_format?: ResponseFormat }) => {
    let db: Database.Database | null = null;

    try {
      db = openDatabase();
      const responseFormat = params.response_format ?? ResponseFormat.MARKDOWN;
      const includeCompleted = params.include_completed ?? false;
      const includeArchive = params.include_archive ?? false;

      // Get archive IDs to exclude
      const archiveIds = includeArchive ? new Set<string>() : getArchiveDescendantIds(db);

      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const startOfTomorrow = getStartOfDay(tomorrow).getTime() / 1000;
      const endOfTomorrow = getEndOfDay(tomorrow).getTime() / 1000;

      // Query for items due tomorrow
      const query = includeCompleted
        ? "SELECT * FROM items WHERE due_date >= ? AND due_date <= ? AND due_date IS NOT NULL AND deleted_at IS NULL ORDER BY due_date ASC"
        : "SELECT * FROM items WHERE due_date >= ? AND due_date <= ? AND due_date IS NOT NULL AND completed_at IS NULL AND deleted_at IS NULL ORDER BY due_date ASC";

      let items = db.prepare(query).all(startOfTomorrow, endOfTomorrow) as DirectGTDItem[];

      // Filter out archive items
      if (archiveIds.size > 0) {
        items = items.filter(item => !archiveIds.has(item.id));
      }

      const formattedItems = items.map(formatItem);

      let result: string;
      if (responseFormat === ResponseFormat.MARKDOWN) {
        if (formattedItems.length === 0) {
          result = "# Due Tomorrow\n\nNo items due tomorrow.";
        } else {
          const lines: string[] = [
            `# Due Tomorrow`,
            "",
            `${formattedItems.length} item${formattedItems.length === 1 ? '' : 's'} due tomorrow:`,
            ""
          ];

          for (const item of formattedItems) {
            lines.push(`## ${item.title}`);
            lines.push(`- **ID**: ${item.id}`);
            if (item.dueDate) {
              lines.push(`- **Due Date**: ${formatDate(item.dueDate)}`);
            }
            if (item.completedAt) {
              lines.push(`- **Completed**: ${formatDate(item.completedAt)}`);
            }
            lines.push("");
          }

          result = lines.join("\n");
        }
      } else {
        result = JSON.stringify({
          date: tomorrow.toISOString().split('T')[0],
          total: formattedItems.length,
          items: formattedItems
        }, null, 2);
      }

      return {
        content: [{
          type: "text",
          text: result
        }]
      };

    } catch (error) {
      return {
        content: [{
          type: "text",
          text: handleDatabaseError(error)
        }],
        isError: true
      };
    } finally {
      if (db) {
        try {
          db.close();
        } catch {
          // Ignore errors on close
        }
      }
    }
  }
);

// Register the get_due_this_week tool
server.registerTool(
  "directgtd_get_due_this_week",
  {
    title: "Get Items Due This Week",
    description: `Get all items due this week from DirectGTD.

This tool retrieves items with due dates falling within the current week (Sunday to Saturday).

Args:
  - include_completed (boolean, optional): Include completed items (default: false)
  - response_format ('markdown' | 'json', optional): Output format (default: 'markdown')

Returns:
  Items due this week, sorted by due date.

Examples:
  - Use when: "What's due this week?"
  - Use when: "Show me this week's tasks"
  - Use when: "List items due this week"

Error Handling:
  - Returns empty list if no items are due this week`,
    inputSchema: GetDueThisWeekInputSchema,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false
    }
  },
  async (params: { include_completed?: boolean; include_archive?: boolean; response_format?: ResponseFormat }) => {
    let db: Database.Database | null = null;

    try {
      db = openDatabase();
      const responseFormat = params.response_format ?? ResponseFormat.MARKDOWN;
      const includeCompleted = params.include_completed ?? false;
      const includeArchive = params.include_archive ?? false;

      // Get archive IDs to exclude
      const archiveIds = includeArchive ? new Set<string>() : getArchiveDescendantIds(db);

      const now = new Date();
      const startOfWeek = getStartOfWeek(now).getTime() / 1000;
      const endOfWeek = getEndOfWeek(now).getTime() / 1000;

      // Query for items due this week
      const query = includeCompleted
        ? "SELECT * FROM items WHERE due_date >= ? AND due_date <= ? AND due_date IS NOT NULL AND deleted_at IS NULL ORDER BY due_date ASC"
        : "SELECT * FROM items WHERE due_date >= ? AND due_date <= ? AND due_date IS NOT NULL AND completed_at IS NULL AND deleted_at IS NULL ORDER BY due_date ASC";

      let items = db.prepare(query).all(startOfWeek, endOfWeek) as DirectGTDItem[];

      // Filter out archive items
      if (archiveIds.size > 0) {
        items = items.filter(item => !archiveIds.has(item.id));
      }

      const formattedItems = items.map(formatItem);

      let result: string;
      if (responseFormat === ResponseFormat.MARKDOWN) {
        if (formattedItems.length === 0) {
          result = "# Due This Week\n\nNo items due this week.";
        } else {
          const lines: string[] = [
            `# Due This Week`,
            "",
            `${formattedItems.length} item${formattedItems.length === 1 ? '' : 's'} due this week:`,
            ""
          ];

          // Group by day
          const itemsByDay: { [key: string]: FormattedItem[] } = {};
          for (const item of formattedItems) {
            if (item.dueDate) {
              const dueDate = new Date(item.dueDate);
              const dayKey = dueDate.toLocaleDateString("en-US", { weekday: 'long', month: 'short', day: 'numeric' });
              if (!itemsByDay[dayKey]) {
                itemsByDay[dayKey] = [];
              }
              itemsByDay[dayKey].push(item);
            }
          }

          for (const [day, dayItems] of Object.entries(itemsByDay)) {
            lines.push(`## ${day}`);
            for (const item of dayItems) {
              lines.push(`### ${item.title}`);
              lines.push(`- **ID**: ${item.id}`);
              if (item.dueDate) {
                lines.push(`- **Due Date**: ${formatDate(item.dueDate)}`);
              }
              if (item.completedAt) {
                lines.push(`- **Completed**: ${formatDate(item.completedAt)}`);
              }
              lines.push("");
            }
          }

          result = lines.join("\n");
        }
      } else {
        result = JSON.stringify({
          week_start: new Date(startOfWeek * 1000).toISOString().split('T')[0],
          week_end: new Date(endOfWeek * 1000).toISOString().split('T')[0],
          total: formattedItems.length,
          items: formattedItems
        }, null, 2);
      }

      return {
        content: [{
          type: "text",
          text: result
        }]
      };

    } catch (error) {
      return {
        content: [{
          type: "text",
          text: handleDatabaseError(error)
        }],
        isError: true
      };
    } finally {
      if (db) {
        try {
          db.close();
        } catch {
          // Ignore errors on close
        }
      }
    }
  }
);

// Register the swap_items tool
server.registerTool(
  "directgtd_swap_items",
  {
    title: "Swap Item Order",
    description: `Swap the sort order of two items.

This tool swaps the sort_order values between two items, effectively switching their positions.

Args:
  - item_id_1 (string, required): First item ID
  - item_id_2 (string, required): Second item ID

Returns:
  Confirmation with the swapped items.

Examples:
  - Use when: "Move this task above the other one"
  - Use when: "Swap these two items"
  - Use when: "Switch the order of these tasks"

Error Handling:
  - Returns error if either item doesn't exist
  - Returns error if items don't have the same parent`,
    inputSchema: SwapItemsInputSchema,
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false
    }
  },
  async (params: { item_id_1: string; item_id_2: string }) => {
    let db: Database.Database | null = null;

    try {
      db = openDatabase();

      // Get both items
      const item1 = db.prepare("SELECT * FROM items WHERE id = ?").get(params.item_id_1) as DirectGTDItem | undefined;
      const item2 = db.prepare("SELECT * FROM items WHERE id = ?").get(params.item_id_2) as DirectGTDItem | undefined;

      if (!item1) {
        return {
          content: [{
            type: "text",
            text: `Error: No item found with ID: ${params.item_id_1}`
          }],
          isError: true
        };
      }

      if (!item2) {
        return {
          content: [{
            type: "text",
            text: `Error: No item found with ID: ${params.item_id_2}`
          }],
          isError: true
        };
      }

      // Check if they have the same parent
      if (item1.parent_id !== item2.parent_id) {
        return {
          content: [{
            type: "text",
            text: `Error: Items must have the same parent to swap. Item 1 parent: ${item1.parent_id}, Item 2 parent: ${item2.parent_id}`
          }],
          isError: true
        };
      }

      // Swap sort_order values
      const tempSortOrder = item1.sort_order;
      db.prepare("UPDATE items SET sort_order = ?, modified_at = ?, needs_push = 1 WHERE id = ?")
        .run(item2.sort_order, Math.floor(Date.now() / 1000), params.item_id_1);
      db.prepare("UPDATE items SET sort_order = ?, modified_at = ?, needs_push = 1 WHERE id = ?")
        .run(tempSortOrder, Math.floor(Date.now() / 1000), params.item_id_2);

      const result = `# Items Swapped

**${item1.title}** ↔️ **${item2.title}**

- Item 1 new position: ${item2.sort_order}
- Item 2 new position: ${tempSortOrder}
- Parent: ${item1.parent_id || 'Root'}

Items successfully reordered.`;

      return {
        content: [{
          type: "text",
          text: result
        }]
      };

    } catch (error) {
      return {
        content: [{
          type: "text",
          text: handleDatabaseError(error)
        }],
        isError: true
      };
    } finally {
      if (db) {
        try {
          db.close();
        } catch {
          // Ignore errors on close
        }
      }
    }
  }
);

// Register the move_to_position tool
server.registerTool(
  "directgtd_move_to_position",
  {
    title: "Move Item to Position",
    description: `Move an item to a specific position among its siblings.

This tool moves an item to a target position (0-based) and renumbers all siblings sequentially.

Args:
  - item_id (string, required): The item to move
  - position (number, required): Target position (0 for first, 1 for second, etc.)

Returns:
  Confirmation with the item's new position.

Examples:
  - Use when: "Move this task to position 3"
  - Use when: "Make this the first item"
  - Use when: "Put this task at the end"

Error Handling:
  - Returns error if item doesn't exist
  - Clamps position to valid range (0 to sibling_count)`,
    inputSchema: MoveToPositionInputSchema,
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false
    }
  },
  async (params: { item_id: string; position: number }) => {
    let db: Database.Database | null = null;

    try {
      db = openDatabase();

      // Get the item to move
      const item = db.prepare("SELECT * FROM items WHERE id = ?").get(params.item_id) as DirectGTDItem | undefined;
      if (!item) {
        return {
          content: [{
            type: "text",
            text: `Error: No item found with ID: ${params.item_id}`
          }],
          isError: true
        };
      }

      // Get all siblings (items with same parent) ordered by sort_order
      const siblings = db.prepare("SELECT * FROM items WHERE parent_id IS ? AND deleted_at IS NULL ORDER BY sort_order ASC")
        .all(item.parent_id) as DirectGTDItem[];

      // Remove the item from the list
      const otherSiblings = siblings.filter(s => s.id !== params.item_id);

      // Clamp position to valid range
      const targetPosition = Math.max(0, Math.min(params.position, otherSiblings.length));

      // Insert the item at the target position
      otherSiblings.splice(targetPosition, 0, item);

      // Update sort_order for all items
      const now = Math.floor(Date.now() / 1000);
      const updateStmt = db.prepare("UPDATE items SET sort_order = ?, modified_at = ?, needs_push = 1 WHERE id = ?");

      otherSiblings.forEach((sibling, index) => {
        updateStmt.run(index, now, sibling.id);
      });

      const result = `# Item Moved

**${item.title}**

- New position: ${targetPosition} (0-based)
- Total siblings: ${otherSiblings.length}
- Parent: ${item.parent_id || 'Root'}

Item successfully moved to position ${targetPosition}.`;

      return {
        content: [{
          type: "text",
          text: result
        }]
      };

    } catch (error) {
      return {
        content: [{
          type: "text",
          text: handleDatabaseError(error)
        }],
        isError: true
      };
    } finally {
      if (db) {
        try {
          db.close();
        } catch {
          // Ignore errors on close
        }
      }
    }
  }
);

// Register the reorder_children tool
server.registerTool(
  "directgtd_reorder_children",
  {
    title: "Reorder Children",
    description: `Reorder all children of a parent in a specific order.

This tool sets the sort_order of children to match the provided array order.

Args:
  - parent_id (string, required): The parent whose children to reorder
  - item_ids (array, required): Array of child IDs in desired order

Returns:
  Confirmation with the new order.

Examples:
  - Use when: "Reorder all items in this folder"
  - Use when: "Set a custom order for these tasks"
  - Use when: "Arrange items in priority order"

Error Handling:
  - Returns error if parent doesn't exist
  - Returns error if item_ids don't match actual children
  - Returns error if any child ID is invalid`,
    inputSchema: ReorderChildrenInputSchema,
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false
    }
  },
  async (params: { parent_id: string; item_ids: string[] }) => {
    let db: Database.Database | null = null;

    try {
      db = openDatabase();

      // Verify parent exists (unless it's root)
      if (params.parent_id !== 'root') {
        const parent = db.prepare("SELECT * FROM items WHERE id = ?").get(params.parent_id) as DirectGTDItem | undefined;
        if (!parent) {
          return {
            content: [{
              type: "text",
              text: `Error: No parent found with ID: ${params.parent_id}`
            }],
            isError: true
          };
        }
      }

      // Get actual children
      const actualParentId = params.parent_id === 'root' ? null : params.parent_id;
      const children = db.prepare("SELECT * FROM items WHERE parent_id IS ? AND deleted_at IS NULL ORDER BY sort_order ASC")
        .all(actualParentId) as DirectGTDItem[];

      // Verify all children are accounted for
      const childIds = new Set(children.map(c => c.id));
      const providedIds = new Set(params.item_ids);

      if (childIds.size !== providedIds.size) {
        return {
          content: [{
            type: "text",
            text: `Error: Mismatch in children count. Expected ${childIds.size} items but got ${providedIds.size}`
          }],
          isError: true
        };
      }

      // Check all provided IDs are valid children
      for (const id of params.item_ids) {
        if (!childIds.has(id)) {
          return {
            content: [{
              type: "text",
              text: `Error: Item ${id} is not a child of parent ${params.parent_id}`
            }],
            isError: true
          };
        }
      }

      // Update sort_order based on array position
      const now = Math.floor(Date.now() / 1000);
      const updateStmt = db.prepare("UPDATE items SET sort_order = ?, modified_at = ?, needs_push = 1 WHERE id = ?");

      params.item_ids.forEach((id, index) => {
        updateStmt.run(index, now, id);
      });

      // Get item titles for confirmation
      const itemTitles = params.item_ids.map((id, index) => {
        const item = children.find(c => c.id === id);
        return `${index + 1}. ${item?.title || 'Unknown'}`;
      }).join("\n");

      const result = `# Children Reordered

**Parent**: ${params.parent_id === 'root' ? 'Root' : params.parent_id}
**Total items reordered**: ${params.item_ids.length}

**New order**:
${itemTitles}

All children successfully reordered.`;

      return {
        content: [{
          type: "text",
          text: result
        }]
      };

    } catch (error) {
      return {
        content: [{
          type: "text",
          text: handleDatabaseError(error)
        }],
        isError: true
      };
    } finally {
      if (db) {
        try {
          db.close();
        } catch {
          // Ignore errors on close
        }
      }
    }
  }
);

// Register the get_available_tasks tool
server.registerTool(
  "directgtd_get_available_tasks",
  {
    title: "Get Available Tasks",
    description: `Get all available (actionable) tasks from DirectGTD.

This tool retrieves tasks that are ready to be worked on - the GTD "Next Actions" list.
An available task is one that is:
1. Not completed (completed_at IS NULL)
2. Not deferred to the future (earliest_start_time IS NULL OR earliest_start_time <= NOW)

Args:
  - parent_id (string, optional): Filter to tasks within a specific folder/project. If omitted, returns all available tasks.
  - include_deferred (boolean, optional): Include tasks with future earliest_start_time (default: false)
  - response_format ('markdown' | 'json', optional): Output format (default: 'markdown')

Returns:
  Available tasks sorted by sort_order within their parent.

Examples:
  - Use when: "What can I work on right now?"
  - Use when: "Show me my next actions"
  - Use when: "List available tasks in the Home folder"

Error Handling:
  - Returns empty list if no available tasks exist
  - Returns error if parent_id doesn't exist`,
    inputSchema: GetAvailableTasksInputSchema,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false
    }
  },
  async (params: { parent_id?: string; include_deferred?: boolean; include_archive?: boolean; response_format?: ResponseFormat }) => {
    let db: Database.Database | null = null;

    try {
      db = openDatabase();
      const responseFormat = params.response_format ?? ResponseFormat.MARKDOWN;
      const includeDeferred = params.include_deferred ?? false;
      const includeArchive = params.include_archive ?? false;
      const parentId = params.parent_id;

      // Get archive IDs to exclude
      const archiveIds = includeArchive ? new Set<string>() : getArchiveDescendantIds(db);

      const nowSeconds = Date.now() / 1000;

      // Build the query based on parameters
      let query: string;
      const queryParams: (string | number)[] = [];

      if (includeDeferred) {
        // Include all incomplete tasks (even those deferred to the future)
        if (parentId) {
          query = `SELECT * FROM items WHERE item_type = 'Task' AND completed_at IS NULL AND deleted_at IS NULL AND parent_id = ? ORDER BY sort_order ASC`;
          queryParams.push(parentId);
        } else {
          query = `SELECT * FROM items WHERE item_type = 'Task' AND completed_at IS NULL AND deleted_at IS NULL ORDER BY parent_id, sort_order ASC`;
        }
      } else {
        // Only include tasks that are available now (not deferred or deferred time has passed)
        if (parentId) {
          query = `SELECT * FROM items WHERE item_type = 'Task' AND completed_at IS NULL AND deleted_at IS NULL AND (earliest_start_time IS NULL OR earliest_start_time <= ?) AND parent_id = ? ORDER BY sort_order ASC`;
          queryParams.push(nowSeconds, parentId);
        } else {
          query = `SELECT * FROM items WHERE item_type = 'Task' AND completed_at IS NULL AND deleted_at IS NULL AND (earliest_start_time IS NULL OR earliest_start_time <= ?) ORDER BY parent_id, sort_order ASC`;
          queryParams.push(nowSeconds);
        }
      }

      let items = db.prepare(query).all(...queryParams) as DirectGTDItem[];

      // Filter out archive items
      if (archiveIds.size > 0) {
        items = items.filter(item => !archiveIds.has(item.id));
      }

      const formattedItems = items.map(formatItem);

      // Count deferred tasks for information
      let deferredCount = 0;
      if (!includeDeferred) {
        const deferredQuery = parentId
          ? `SELECT COUNT(*) as count FROM items WHERE item_type = 'Task' AND completed_at IS NULL AND deleted_at IS NULL AND earliest_start_time > ? AND parent_id = ?`
          : `SELECT COUNT(*) as count FROM items WHERE item_type = 'Task' AND completed_at IS NULL AND deleted_at IS NULL AND earliest_start_time > ?`;
        const deferredParams = parentId ? [nowSeconds, parentId] : [nowSeconds];
        const deferredResult = db.prepare(deferredQuery).get(...deferredParams) as { count: number };
        deferredCount = deferredResult.count;
      }

      let result: string;
      if (responseFormat === ResponseFormat.MARKDOWN) {
        if (formattedItems.length === 0) {
          let message = "# Available Tasks\n\nNo available tasks found.";
          if (deferredCount > 0) {
            message += `\n\n*Note: ${deferredCount} task${deferredCount === 1 ? ' is' : 's are'} deferred to the future.*`;
          }
          result = message;
        } else {
          const lines: string[] = [
            `# Available Tasks`,
            "",
            `${formattedItems.length} task${formattedItems.length === 1 ? '' : 's'} available to work on:`,
            ""
          ];

          // Group by parent
          const itemsByParent: { [key: string]: FormattedItem[] } = {};
          for (const item of formattedItems) {
            const parentKey = item.parentId || 'root';
            if (!itemsByParent[parentKey]) {
              itemsByParent[parentKey] = [];
            }
            itemsByParent[parentKey].push(item);
          }

          // Get parent titles for better display
          const parentTitles: { [key: string]: string } = {};
          for (const parentKey of Object.keys(itemsByParent)) {
            if (parentKey === 'root') {
              parentTitles[parentKey] = 'Root';
            } else {
              const parent = db.prepare("SELECT title FROM items WHERE id = ?").get(parentKey) as { title: string } | undefined;
              parentTitles[parentKey] = parent?.title || parentKey;
            }
          }

          for (const [parentKey, parentItems] of Object.entries(itemsByParent)) {
            lines.push(`## ${parentTitles[parentKey]}`);
            for (const item of parentItems) {
              lines.push(`### ${item.title}`);
              lines.push(`- **ID**: ${item.id}`);
              if (item.dueDate) {
                lines.push(`- **Due**: ${formatDate(item.dueDate)}`);
              }
              if (item.earliestStartTime) {
                lines.push(`- **Start after**: ${formatDate(item.earliestStartTime)}`);
              }
              lines.push("");
            }
          }

          if (deferredCount > 0) {
            lines.push(`---`);
            lines.push(`*${deferredCount} additional task${deferredCount === 1 ? ' is' : 's are'} deferred to the future.*`);
          }

          result = lines.join("\n");
        }
      } else {
        result = JSON.stringify({
          total: formattedItems.length,
          deferred_count: deferredCount,
          parent_filter: parentId || null,
          include_deferred: includeDeferred,
          items: formattedItems
        }, null, 2);
      }

      return {
        content: [{
          type: "text",
          text: result
        }]
      };

    } catch (error) {
      return {
        content: [{
          type: "text",
          text: handleDatabaseError(error)
        }],
        isError: true
      };
    } finally {
      if (db) {
        try {
          db.close();
        } catch {
          // Ignore errors on close
        }
      }
    }
  }
);

// Register the search_items tool
server.registerTool(
  "directgtd_search_items",
  {
    title: "Search Items",
    description: `Search for items by title in DirectGTD.

This tool performs a case-insensitive search across all item titles and returns matching items with just their ID and title.

Args:
  - query (string, required): Search query to match against item titles
  - limit (number, optional): Maximum results to return (default: 50)
  - response_format ('markdown' | 'json', optional): Output format (default: 'markdown')

Returns:
  Matching items with ID and title only.

Examples:
  - Use when: "Find all items containing 'meeting'"
  - Use when: "Search for tasks with 'report' in the title"
  - Use when: "Look for items named 'project'"

Error Handling:
  - Returns empty list if no matches found`,
    inputSchema: SearchItemsInputSchema,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false
    }
  },
  async (params: { query: string; item_type?: string; include_archive?: boolean; limit?: number; response_format?: ResponseFormat }) => {
    let db: Database.Database | null = null;

    try {
      db = openDatabase();
      const responseFormat = params.response_format ?? ResponseFormat.MARKDOWN;
      const limit = params.limit ?? 500;
      const query = params.query;
      const itemType = params.item_type;
      const includeArchive = params.include_archive ?? false;

      // Get archive IDs to exclude
      const archiveIds = includeArchive ? new Set<string>() : getArchiveDescendantIds(db);

      // Search with LIKE for case-insensitive matching
      const searchPattern = `%${query}%`;

      let items: { id: string; title: string }[];
      if (itemType) {
        items = db.prepare(
          "SELECT id, title FROM items WHERE title LIKE ? COLLATE NOCASE AND item_type = ? AND deleted_at IS NULL ORDER BY title ASC LIMIT ?"
        ).all(searchPattern, itemType, limit) as { id: string; title: string }[];
      } else {
        items = db.prepare(
          "SELECT id, title FROM items WHERE title LIKE ? COLLATE NOCASE AND deleted_at IS NULL ORDER BY title ASC LIMIT ?"
        ).all(searchPattern, limit) as { id: string; title: string }[];
      }

      // Filter out archive items
      if (archiveIds.size > 0) {
        items = items.filter(item => !archiveIds.has(item.id));
      }

      let result: string;
      if (responseFormat === ResponseFormat.MARKDOWN) {
        if (items.length === 0) {
          result = `# Search Results\n\nNo items found matching "${query}".`;
        } else {
          const lines: string[] = [
            `# Search Results`,
            "",
            `Found ${items.length} item${items.length === 1 ? '' : 's'} matching "${query}":`,
            ""
          ];

          for (const item of items) {
            lines.push(`- **${item.title}** (${item.id})`);
          }

          result = lines.join("\n");
        }
      } else {
        result = JSON.stringify({
          query: query,
          total: items.length,
          items: items
        }, null, 2);
      }

      return {
        content: [{
          type: "text",
          text: result
        }]
      };

    } catch (error) {
      return {
        content: [{
          type: "text",
          text: handleDatabaseError(error)
        }],
        isError: true
      };
    } finally {
      if (db) {
        try {
          db.close();
        } catch {
          // Ignore errors on close
        }
      }
    }
  }
);

// Register the get_completed_tasks tool
server.registerTool(
  "directgtd_get_completed_tasks",
  {
    title: "Get Completed Tasks",
    description: `Get all completed tasks from DirectGTD.

This tool retrieves tasks that have been marked as completed. Useful for reviews, cleanup, and progress tracking.

Args:
  - parent_id (string, optional): Filter to tasks within a specific folder/project. If omitted, returns all completed tasks.
  - since (string, optional): Only return tasks completed after this date. ISO 8601 format.
  - limit (number, optional): Maximum results to return (default: 100)
  - response_format ('markdown' | 'json', optional): Output format (default: 'markdown')

Returns:
  Completed tasks sorted by completion date (most recent first).

Examples:
  - Use when: "What did I complete this week?"
  - Use when: "Show me finished tasks in the Home folder"
  - Use when: "List tasks completed since Monday"

Error Handling:
  - Returns empty list if no completed tasks exist`,
    inputSchema: GetCompletedTasksInputSchema,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false
    }
  },
  async (params: { parent_id?: string; since?: string; include_archive?: boolean; limit?: number; response_format?: ResponseFormat }) => {
    let db: Database.Database | null = null;

    try {
      db = openDatabase();
      const responseFormat = params.response_format ?? ResponseFormat.MARKDOWN;
      const parentId = params.parent_id;
      const limit = params.limit ?? 100;
      const since = params.since;
      const includeArchive = params.include_archive ?? false;

      // Get archive IDs to exclude
      const archiveIds = includeArchive ? new Set<string>() : getArchiveDescendantIds(db);

      // Build query based on parameters
      let query: string;
      const queryParams: (string | number)[] = [];

      const baseQuery = "SELECT * FROM items WHERE item_type = 'Task' AND completed_at IS NOT NULL AND deleted_at IS NULL";
      const orderBy = " ORDER BY completed_at DESC LIMIT ?";

      if (parentId && since) {
        const sinceSeconds = new Date(since).getTime() / 1000;
        query = baseQuery + " AND parent_id = ? AND completed_at >= ?" + orderBy;
        queryParams.push(parentId, sinceSeconds, limit);
      } else if (parentId) {
        query = baseQuery + " AND parent_id = ?" + orderBy;
        queryParams.push(parentId, limit);
      } else if (since) {
        const sinceSeconds = new Date(since).getTime() / 1000;
        query = baseQuery + " AND completed_at >= ?" + orderBy;
        queryParams.push(sinceSeconds, limit);
      } else {
        query = baseQuery + orderBy;
        queryParams.push(limit);
      }

      let items = db.prepare(query).all(...queryParams) as DirectGTDItem[];

      // Filter out archive items
      if (archiveIds.size > 0) {
        items = items.filter(item => !archiveIds.has(item.id));
      }

      const formattedItems = items.map(formatItem);

      let result: string;
      if (responseFormat === ResponseFormat.MARKDOWN) {
        if (formattedItems.length === 0) {
          result = "# Completed Tasks\n\nNo completed tasks found.";
        } else {
          const lines: string[] = [
            `# Completed Tasks`,
            "",
            `${formattedItems.length} completed task${formattedItems.length === 1 ? '' : 's'}:`,
            ""
          ];

          for (const item of formattedItems) {
            lines.push(`### ${item.title}`);
            lines.push(`- **ID**: ${item.id}`);
            if (item.completedAt) {
              lines.push(`- **Completed**: ${formatDate(item.completedAt)}`);
            }
            if (item.dueDate) {
              lines.push(`- **Due**: ${formatDate(item.dueDate)}`);
            }
            lines.push("");
          }

          result = lines.join("\n");
        }
      } else {
        result = JSON.stringify({
          total: formattedItems.length,
          parent_filter: parentId || null,
          since_filter: since || null,
          items: formattedItems
        }, null, 2);
      }

      return {
        content: [{
          type: "text",
          text: result
        }]
      };

    } catch (error) {
      return {
        content: [{
          type: "text",
          text: handleDatabaseError(error)
        }],
        isError: true
      };
    } finally {
      if (db) {
        try {
          db.close();
        } catch {
          // Ignore errors on close
        }
      }
    }
  }
);

// Register the update_notes tool
server.registerTool(
  "directgtd_update_notes",
  {
    title: "Update Item Notes",
    description: `Update an item's notes field.

This tool sets or clears the notes/description for any item. The DirectGTD app renders notes using **Markdown formatting**, so you can use headers, lists, bold, links, etc.

Args:
  - item_id (string, required): The item to update. Example: '2EADCE4C-538A-444F-BE61-B4AF0047B2EC'
  - notes (string | null, required): The new notes content (Markdown supported), or null to clear.

Returns:
  Confirmation with the updated item.

Markdown Tips:
  - Use **bold** and *italic* for emphasis
  - Use # headers for sections
  - Use - or * for bullet lists
  - Use [text](url) for links
  - Use \`code\` for inline code

Examples:
  - Use when: "Add notes to this task"
  - Use when: "Set the description for this item"
  - Use when: "Clear the notes field"

Error Handling:
  - Returns error if item_id doesn't exist
  - Returns error if database write fails`,
    inputSchema: UpdateNotesInputSchema,
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false
    }
  },
  async (params: { item_id: string; notes: string | null }) => {
    let db: Database.Database | null = null;

    try {
      db = openDatabase();

      // Check if item exists
      const existingItem = db.prepare("SELECT * FROM items WHERE id = ?").get(params.item_id) as DirectGTDItem | undefined;

      if (!existingItem) {
        return {
          content: [{
            type: "text",
            text: `Error: Item with ID '${params.item_id}' not found.`
          }],
          isError: true
        };
      }

      const now = Math.floor(Date.now() / 1000);

      // Update the notes
      db.prepare(
        "UPDATE items SET notes = ?, modified_at = ?, needs_push = 1 WHERE id = ?"
      ).run(params.notes, now, params.item_id);

      // Get the updated item
      const updatedItem = db.prepare("SELECT * FROM items WHERE id = ?").get(params.item_id) as DirectGTDItem;
      const formatted = formatItem(updatedItem);

      const notesPreview = params.notes
        ? (params.notes.length > 100 ? params.notes.substring(0, 100) + "..." : params.notes)
        : "(cleared)";

      const result = `# Notes Updated

**${formatted.title}**

- **ID**: ${formatted.id}
- **Notes**: ${notesPreview}
- **Modified**: ${formatDate(formatted.modifiedAt)}

Notes successfully ${params.notes ? 'updated' : 'cleared'}.`;

      return {
        content: [{
          type: "text",
          text: result
        }]
      };

    } catch (error) {
      return {
        content: [{
          type: "text",
          text: handleDatabaseError(error)
        }],
        isError: true
      };
    } finally {
      if (db) {
        try {
          db.close();
        } catch {
          // Ignore errors on close
        }
      }
    }
  }
);

// Register the get_notes tool
server.registerTool(
  "directgtd_get_notes",
  {
    title: "Get Item Notes",
    description: `Get the notes field for an item.

This tool retrieves just the notes/description for a specific item. Returns the raw notes content.

Args:
  - item_id (string, required): The item ID. Example: '2EADCE4C-538A-444F-BE61-B4AF0047B2EC'

Returns:
  The item's notes content, or a message if no notes exist.

Examples:
  - Use when: "Get the notes for this task"
  - Use when: "Show me the description of this item"
  - Use when: "What are the notes on this?"

Error Handling:
  - Returns error if item_id doesn't exist`,
    inputSchema: GetNotesInputSchema,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false
    }
  },
  async (params: { item_id: string }) => {
    let db: Database.Database | null = null;

    try {
      db = openDatabase();

      const item = db.prepare("SELECT id, title, notes FROM items WHERE id = ? AND deleted_at IS NULL").get(params.item_id) as { id: string; title: string; notes: string | null } | undefined;

      if (!item) {
        return {
          content: [{
            type: "text",
            text: `Error: No item found with ID: ${params.item_id}`
          }],
          isError: true
        };
      }

      if (!item.notes) {
        return {
          content: [{
            type: "text",
            text: `No notes for "${item.title}" (${item.id})`
          }]
        };
      }

      return {
        content: [{
          type: "text",
          text: item.notes
        }]
      };

    } catch (error) {
      return {
        content: [{
          type: "text",
          text: handleDatabaseError(error)
        }],
        isError: true
      };
    } finally {
      if (db) {
        try {
          db.close();
        } catch {
          // Ignore errors on close
        }
      }
    }
  }
);

// Register the get_deferred_tasks tool
server.registerTool(
  "directgtd_get_deferred_tasks",
  {
    title: "Get Deferred Tasks",
    description: `Get all deferred tasks from DirectGTD (the GTD "Tickler" list).

This tool retrieves tasks that have a future earliest_start_time - tasks you've deferred until a later date.

Args:
  - parent_id (string, optional): Filter to tasks within a specific folder/project. If omitted, returns all deferred tasks.
  - response_format ('markdown' | 'json', optional): Output format (default: 'markdown')

Returns:
  Deferred tasks sorted by earliest_start_time (soonest first).

Examples:
  - Use when: "What tasks are deferred?"
  - Use when: "Show me my tickler list"
  - Use when: "What's coming up that I've postponed?"

Error Handling:
  - Returns empty list if no deferred tasks exist`,
    inputSchema: GetDeferredTasksInputSchema,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false
    }
  },
  async (params: { parent_id?: string; include_archive?: boolean; response_format?: ResponseFormat }) => {
    let db: Database.Database | null = null;

    try {
      db = openDatabase();
      const responseFormat = params.response_format ?? ResponseFormat.MARKDOWN;
      const parentId = params.parent_id;
      const includeArchive = params.include_archive ?? false;

      // Get archive IDs to exclude
      const archiveIds = includeArchive ? new Set<string>() : getArchiveDescendantIds(db);

      const nowSeconds = Date.now() / 1000;

      // Build query - deferred means earliest_start_time is in the future and not completed
      let query: string;
      const queryParams: (string | number)[] = [];

      if (parentId) {
        query = `SELECT * FROM items WHERE item_type = 'Task' AND completed_at IS NULL AND deleted_at IS NULL AND earliest_start_time > ? AND parent_id = ? ORDER BY earliest_start_time ASC`;
        queryParams.push(nowSeconds, parentId);
      } else {
        query = `SELECT * FROM items WHERE item_type = 'Task' AND completed_at IS NULL AND deleted_at IS NULL AND earliest_start_time > ? ORDER BY earliest_start_time ASC`;
        queryParams.push(nowSeconds);
      }

      let items = db.prepare(query).all(...queryParams) as DirectGTDItem[];

      // Filter out archive items
      if (archiveIds.size > 0) {
        items = items.filter(item => !archiveIds.has(item.id));
      }

      const formattedItems = items.map(formatItem);

      let result: string;
      if (responseFormat === ResponseFormat.MARKDOWN) {
        if (formattedItems.length === 0) {
          result = "# Deferred Tasks\n\nNo deferred tasks found.";
        } else {
          const lines: string[] = [
            `# Deferred Tasks (Tickler)`,
            "",
            `${formattedItems.length} task${formattedItems.length === 1 ? '' : 's'} deferred to the future:`,
            ""
          ];

          for (const item of formattedItems) {
            lines.push(`### ${item.title}`);
            lines.push(`- **ID**: ${item.id}`);
            if (item.earliestStartTime) {
              lines.push(`- **Available after**: ${formatDate(item.earliestStartTime)}`);
            }
            if (item.dueDate) {
              lines.push(`- **Due**: ${formatDate(item.dueDate)}`);
            }
            lines.push("");
          }

          result = lines.join("\n");
        }
      } else {
        result = JSON.stringify({
          total: formattedItems.length,
          parent_filter: parentId || null,
          items: formattedItems
        }, null, 2);
      }

      return {
        content: [{
          type: "text",
          text: result
        }]
      };

    } catch (error) {
      return {
        content: [{
          type: "text",
          text: handleDatabaseError(error)
        }],
        isError: true
      };
    } finally {
      if (db) {
        try {
          db.close();
        } catch {
          // Ignore errors on close
        }
      }
    }
  }
);

// Register the complete_multiple_tasks tool
server.registerTool(
  "directgtd_complete_multiple_tasks",
  {
    title: "Complete Multiple Tasks",
    description: `Mark multiple tasks as completed or uncompleted in a single operation.

This tool allows bulk completion of tasks. Only items with item_type='Task' can be completed.

Args:
  - task_ids (array, required): Array of task IDs to complete. Example: ['id1', 'id2', 'id3']
  - completed (boolean, optional): Whether to mark as completed (true) or uncompleted (false). Default: true

Returns:
  Summary of completed tasks, with any errors for invalid IDs or non-Task items.

Examples:
  - Use when: "Complete all these tasks"
  - Use when: "Mark these 5 tasks as done"
  - Use when: "Uncomplete these tasks"

Error Handling:
  - Skips invalid IDs and non-Task items
  - Returns summary with successes and failures`,
    inputSchema: CompleteMultipleTasksInputSchema,
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false
    }
  },
  async (params: { task_ids: string[]; completed?: boolean }) => {
    let db: Database.Database | null = null;

    try {
      db = openDatabase();
      const completed = params.completed ?? true;
      const now = Math.floor(Date.now() / 1000);

      const results: { succeeded: { id: string; title: string }[]; failed: { id: string; reason: string }[] } = {
        succeeded: [],
        failed: []
      };

      for (const taskId of params.task_ids) {
        // Check if item exists
        const item = db.prepare("SELECT * FROM items WHERE id = ?").get(taskId) as DirectGTDItem | undefined;

        if (!item) {
          results.failed.push({ id: taskId, reason: "Item not found" });
          continue;
        }

        if (item.item_type !== 'Task') {
          results.failed.push({ id: taskId, reason: `Cannot complete ${item.item_type} (only Tasks can be completed)` });
          continue;
        }

        // Update completion status
        if (completed) {
          db.prepare(
            "UPDATE items SET completed_at = ?, modified_at = ?, needs_push = 1 WHERE id = ?"
          ).run(now, now, taskId);
        } else {
          db.prepare(
            "UPDATE items SET completed_at = NULL, modified_at = ?, needs_push = 1 WHERE id = ?"
          ).run(now, taskId);
        }

        results.succeeded.push({ id: taskId, title: item.title });
      }

      const action = completed ? "completed" : "uncompleted";
      const lines: string[] = [
        `# Bulk Task ${completed ? 'Completion' : 'Uncompletion'}`,
        "",
        `**${results.succeeded.length}** task${results.succeeded.length === 1 ? '' : 's'} ${action} successfully.`,
        ""
      ];

      if (results.succeeded.length > 0) {
        lines.push("## Succeeded");
        for (const item of results.succeeded) {
          lines.push(`- ✓ ${item.title} (${item.id})`);
        }
        lines.push("");
      }

      if (results.failed.length > 0) {
        lines.push("## Failed");
        for (const item of results.failed) {
          lines.push(`- ✗ ${item.id}: ${item.reason}`);
        }
        lines.push("");
      }

      return {
        content: [{
          type: "text",
          text: lines.join("\n")
        }]
      };

    } catch (error) {
      return {
        content: [{
          type: "text",
          text: handleDatabaseError(error)
        }],
        isError: true
      };
    } finally {
      if (db) {
        try {
          db.close();
        } catch {
          // Ignore errors on close
        }
      }
    }
  }
);

// Register the get_node_tree tool
server.registerTool(
  "directgtd_get_node_tree",
  {
    title: "Get Node Tree",
    description: `Get the hierarchical node tree structure from DirectGTD.

This tool retrieves items in a tree format showing parent-child relationships. Returns only id, title, and parent_id for each node.

Args:
  - root_id (string, optional): ID of the root item to start from. If omitted, returns tree from all root items.
  - max_depth (number, optional): Maximum depth to traverse. Default: 10, max: 20
  - response_format ('markdown' | 'json', optional): Output format (default: 'markdown')

Returns:
  Hierarchical tree structure with id, title, and parent_id for each node.

Examples:
  - Use when: "Show me the folder structure"
  - Use when: "What's the hierarchy under Home?"
  - Use when: "Display the node tree"

Error Handling:
  - Returns error if root_id doesn't exist
  - Returns empty tree if no items exist`,
    inputSchema: GetNodeTreeInputSchema,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false
    }
  },
  async (params: { root_id?: string; max_depth?: number; response_format?: ResponseFormat }) => {
    let db: Database.Database | null = null;

    try {
      db = openDatabase();
      const maxDepth = Math.min(params.max_depth ?? 10, 20);
      const responseFormat = params.response_format ?? ResponseFormat.MARKDOWN;

      interface TreeNode {
        id: string;
        title: string;
        parentId: string | null;
        children: TreeNode[];
      }

      // Function to build tree recursively
      function buildTree(parentId: string | null, currentDepth: number): TreeNode[] {
        if (currentDepth > maxDepth) {
          return [];
        }

        let items: { id: string; title: string; parent_id: string | null }[];
        if (parentId === null) {
          items = db!.prepare(
            "SELECT id, title, parent_id FROM items WHERE parent_id IS NULL AND deleted_at IS NULL ORDER BY sort_order"
          ).all() as { id: string; title: string; parent_id: string | null }[];
        } else {
          items = db!.prepare(
            "SELECT id, title, parent_id FROM items WHERE parent_id = ? AND deleted_at IS NULL ORDER BY sort_order"
          ).all(parentId) as { id: string; title: string; parent_id: string | null }[];
        }

        return items.map(item => ({
          id: item.id,
          title: item.title,
          parentId: item.parent_id,
          children: buildTree(item.id, currentDepth + 1)
        }));
      }

      let tree: TreeNode[];

      if (params.root_id) {
        // Check if the root item exists
        const rootItem = db.prepare(
          "SELECT id, title, parent_id FROM items WHERE id = ?"
        ).get(params.root_id) as { id: string; title: string; parent_id: string | null } | undefined;

        if (!rootItem) {
          return {
            content: [{
              type: "text",
              text: `Error: Item with ID '${params.root_id}' not found.`
            }],
            isError: true
          };
        }

        // Build tree starting from the specified root
        tree = [{
          id: rootItem.id,
          title: rootItem.title,
          parentId: rootItem.parent_id,
          children: buildTree(rootItem.id, 1)
        }];
      } else {
        // Build tree from all root items
        tree = buildTree(null, 0);
      }

      let result: string;

      if (responseFormat === ResponseFormat.MARKDOWN) {
        const lines: string[] = ["# Node Tree", ""];

        function renderTree(nodes: TreeNode[], indent: string = ""): void {
          for (const node of nodes) {
            lines.push(`${indent}- **${node.title}** \`${node.id}\``);
            if (node.children.length > 0) {
              renderTree(node.children, indent + "  ");
            }
          }
        }

        if (tree.length === 0) {
          lines.push("*No items found.*");
        } else {
          renderTree(tree);
        }

        result = lines.join("\n");
      } else {
        // JSON format - strip children array if empty for cleaner output
        function cleanTree(nodes: TreeNode[]): object[] {
          return nodes.map(node => {
            const cleaned: { id: string; title: string; parentId: string | null; children?: object[] } = {
              id: node.id,
              title: node.title,
              parentId: node.parentId
            };
            if (node.children.length > 0) {
              cleaned.children = cleanTree(node.children);
            }
            return cleaned;
          });
        }

        result = JSON.stringify({
          rootId: params.root_id || null,
          maxDepth: maxDepth,
          tree: cleanTree(tree)
        }, null, 2);
      }

      return {
        content: [{
          type: "text",
          text: result
        }]
      };

    } catch (error) {
      return {
        content: [{
          type: "text",
          text: handleDatabaseError(error)
        }],
        isError: true
      };
    } finally {
      if (db) {
        try {
          db.close();
        } catch {
          // Ignore errors on close
        }
      }
    }
  }
);

// Register the get_items_by_tag_names tool
server.registerTool(
  "directgtd_get_items_by_tag_names",
  {
    title: "Get Items by Tag Names",
    description: `Get all items that have ALL the specified tags (by tag name).

This tool finds items tagged with every tag in the provided list (AND logic).

Args:
  - tag_names (array, required): Array of tag names. Items must have ALL tags. Example: ['urgent', 'home']
  - include_completed (boolean, optional): Include completed items. Default: false
  - include_archive (boolean, optional): Include archived items. Default: false
  - response_format ('markdown' | 'json', optional): Output format (default: 'markdown')

Returns:
  Items that have all specified tags.

Examples:
  - Use when: "Show me all urgent items"
  - Use when: "Find items tagged with both 'home' and 'urgent'"
  - Use when: "What tasks have the 'Next' tag?"

Error Handling:
  - Returns error if any tag name is not found
  - Returns empty list if no items match`,
    inputSchema: GetItemsByTagNamesInputSchema,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false
    }
  },
  async (params: { tag_names: string[]; include_completed?: boolean; include_archive?: boolean; response_format?: ResponseFormat }) => {
    let db: Database.Database | null = null;

    try {
      db = openDatabase();
      const includeCompleted = params.include_completed ?? false;
      const includeArchive = params.include_archive ?? false;
      const responseFormat = params.response_format ?? ResponseFormat.MARKDOWN;

      // Resolve tag names to IDs
      const tagIds: string[] = [];
      const notFoundTags: string[] = [];

      for (const tagName of params.tag_names) {
        const tag = db.prepare(
          "SELECT id FROM tags WHERE LOWER(name) = LOWER(?)"
        ).get(tagName) as { id: string } | undefined;

        if (tag) {
          tagIds.push(tag.id);
        } else {
          notFoundTags.push(tagName);
        }
      }

      if (notFoundTags.length > 0) {
        return {
          content: [{
            type: "text",
            text: `Error: Tag(s) not found: ${notFoundTags.join(', ')}`
          }],
          isError: true
        };
      }

      // Find items that have ALL the specified tags
      // Using a subquery that counts matching tags and ensures it equals the total requested
      const placeholders = tagIds.map(() => '?').join(',');
      let query = `
        SELECT DISTINCT i.id, i.title, i.parent_id, i.completed_at, i.due_date, i.item_type
        FROM items i
        INNER JOIN item_tags it ON i.id = it.item_id
        WHERE it.tag_id IN (${placeholders})
      `;

      if (!includeCompleted) {
        query += " AND i.completed_at IS NULL";
      }

      query += `
        GROUP BY i.id
        HAVING COUNT(DISTINCT it.tag_id) = ?
        ORDER BY i.sort_order
      `;

      const items = db.prepare(query).all(...tagIds, tagIds.length) as {
        id: string;
        title: string;
        parent_id: string | null;
        completed_at: string | null;
        due_date: string | null;
        item_type: string;
      }[];

      // Filter archive if needed
      let filteredItems = items;
      if (!includeArchive) {
        const archiveDescendants = getArchiveDescendantIds(db);
        filteredItems = items.filter(item => !archiveDescendants.has(item.id));
      }

      let result: string;

      if (responseFormat === ResponseFormat.MARKDOWN) {
        const lines: string[] = [
          `# Items with Tags: ${params.tag_names.join(', ')}`,
          "",
          `Found ${filteredItems.length} item${filteredItems.length === 1 ? '' : 's'}:`,
          ""
        ];

        if (filteredItems.length === 0) {
          lines.push("*No items found with all specified tags.*");
        } else {
          for (const item of filteredItems) {
            const status = item.completed_at ? "✓" : "○";
            const dueInfo = item.due_date ? ` (due: ${new Date(parseFloat(item.due_date) * 1000).toLocaleDateString()})` : "";
            lines.push(`- ${status} **${item.title}**${dueInfo} \`${item.id}\``);
          }
        }

        result = lines.join("\n");
      } else {
        result = JSON.stringify({
          tags: params.tag_names,
          total: filteredItems.length,
          items: filteredItems.map(item => ({
            id: item.id,
            title: item.title,
            parentId: item.parent_id,
            itemType: item.item_type,
            completedAt: item.completed_at ? new Date(parseFloat(item.completed_at) * 1000).toISOString() : null,
            dueDate: item.due_date ? new Date(parseFloat(item.due_date) * 1000).toISOString() : null
          }))
        }, null, 2);
      }

      return {
        content: [{
          type: "text",
          text: result
        }]
      };

    } catch (error) {
      return {
        content: [{
          type: "text",
          text: handleDatabaseError(error)
        }],
        isError: true
      };
    } finally {
      if (db) {
        try {
          db.close();
        } catch {
          // Ignore errors on close
        }
      }
    }
  }
);

// Register the get_items_by_tag_ids tool
server.registerTool(
  "directgtd_get_items_by_tag_ids",
  {
    title: "Get Items by Tag IDs",
    description: `Get all items that have ALL the specified tags (by tag ID).

This tool finds items tagged with every tag in the provided list (AND logic).

Args:
  - tag_ids (array, required): Array of tag IDs. Items must have ALL tags. Example: ['id1', 'id2']
  - include_completed (boolean, optional): Include completed items. Default: false
  - include_archive (boolean, optional): Include archived items. Default: false
  - response_format ('markdown' | 'json', optional): Output format (default: 'markdown')

Returns:
  Items that have all specified tags.

Examples:
  - Use when: "Show me items with these tag IDs"
  - Use when: You already have tag IDs from a previous call

Error Handling:
  - Returns empty list if no items match`,
    inputSchema: GetItemsByTagIdsInputSchema,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false
    }
  },
  async (params: { tag_ids: string[]; include_completed?: boolean; include_archive?: boolean; response_format?: ResponseFormat }) => {
    let db: Database.Database | null = null;

    try {
      db = openDatabase();
      const includeCompleted = params.include_completed ?? false;
      const includeArchive = params.include_archive ?? false;
      const responseFormat = params.response_format ?? ResponseFormat.MARKDOWN;

      // Get tag names for display
      const tagNames: string[] = [];
      for (const tagId of params.tag_ids) {
        const tag = db.prepare("SELECT name FROM tags WHERE id = ?").get(tagId) as { name: string } | undefined;
        tagNames.push(tag?.name ?? tagId);
      }

      // Find items that have ALL the specified tags
      const placeholders = params.tag_ids.map(() => '?').join(',');
      let query = `
        SELECT DISTINCT i.id, i.title, i.parent_id, i.completed_at, i.due_date, i.item_type
        FROM items i
        INNER JOIN item_tags it ON i.id = it.item_id
        WHERE it.tag_id IN (${placeholders})
      `;

      if (!includeCompleted) {
        query += " AND i.completed_at IS NULL";
      }

      query += `
        GROUP BY i.id
        HAVING COUNT(DISTINCT it.tag_id) = ?
        ORDER BY i.sort_order
      `;

      const items = db.prepare(query).all(...params.tag_ids, params.tag_ids.length) as {
        id: string;
        title: string;
        parent_id: string | null;
        completed_at: string | null;
        due_date: string | null;
        item_type: string;
      }[];

      // Filter archive if needed
      let filteredItems = items;
      if (!includeArchive) {
        const archiveDescendants = getArchiveDescendantIds(db);
        filteredItems = items.filter(item => !archiveDescendants.has(item.id));
      }

      let result: string;

      if (responseFormat === ResponseFormat.MARKDOWN) {
        const lines: string[] = [
          `# Items with Tags: ${tagNames.join(', ')}`,
          "",
          `Found ${filteredItems.length} item${filteredItems.length === 1 ? '' : 's'}:`,
          ""
        ];

        if (filteredItems.length === 0) {
          lines.push("*No items found with all specified tags.*");
        } else {
          for (const item of filteredItems) {
            const status = item.completed_at ? "✓" : "○";
            const dueInfo = item.due_date ? ` (due: ${new Date(parseFloat(item.due_date) * 1000).toLocaleDateString()})` : "";
            lines.push(`- ${status} **${item.title}**${dueInfo} \`${item.id}\``);
          }
        }

        result = lines.join("\n");
      } else {
        result = JSON.stringify({
          tagIds: params.tag_ids,
          tagNames: tagNames,
          total: filteredItems.length,
          items: filteredItems.map(item => ({
            id: item.id,
            title: item.title,
            parentId: item.parent_id,
            itemType: item.item_type,
            completedAt: item.completed_at ? new Date(parseFloat(item.completed_at) * 1000).toISOString() : null,
            dueDate: item.due_date ? new Date(parseFloat(item.due_date) * 1000).toISOString() : null
          }))
        }, null, 2);
      }

      return {
        content: [{
          type: "text",
          text: result
        }]
      };

    } catch (error) {
      return {
        content: [{
          type: "text",
          text: handleDatabaseError(error)
        }],
        isError: true
      };
    } finally {
      if (db) {
        try {
          db.close();
        } catch {
          // Ignore errors on close
        }
      }
    }
  }
);

// Register the start_timer tool
server.registerTool(
  "directgtd_start_timer",
  {
    title: "Start Timer",
    description: `Start a timer for an item to track time spent working on it.

This tool creates a new time entry with the current time as the start time.

Args:
  - item_id (string, required): The ID of the item to start timing.

Returns:
  The created time entry with its ID.

Examples:
  - Use when: "Start working on this task"
  - Use when: "Begin timing this item"
  - Use when: "Track time for this task"

Error Handling:
  - Returns error if item_id doesn't exist`,
    inputSchema: StartTimerInputSchema,
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: false
    }
  },
  async (params: { item_id: string }) => {
    let db: Database.Database | null = null;

    try {
      db = openDatabase();

      // Check if item exists
      const item = db.prepare("SELECT id, title FROM items WHERE id = ?").get(params.item_id) as { id: string; title: string } | undefined;
      if (!item) {
        return {
          content: [{
            type: "text",
            text: `Error: Item with ID '${params.item_id}' not found.`
          }],
          isError: true
        };
      }

      // Create new time entry
      const entryId = crypto.randomUUID().toUpperCase();
      const now = Math.floor(Date.now() / 1000);

      db.prepare(
        "INSERT INTO time_entries (id, item_id, started_at, modified_at, needs_push) VALUES (?, ?, ?, ?, 1)"
      ).run(entryId, params.item_id, now, now);

      const startTime = new Date(now * 1000).toLocaleString('en-US', { timeZone: 'America/New_York' });

      return {
        content: [{
          type: "text",
          text: `# Timer Started\n\n**${item.title}**\n\n- **Entry ID**: ${entryId}\n- **Started**: ${startTime} EST\n\nTimer is now running.`
        }]
      };

    } catch (error) {
      return {
        content: [{
          type: "text",
          text: handleDatabaseError(error)
        }],
        isError: true
      };
    } finally {
      if (db) {
        try {
          db.close();
        } catch {
          // Ignore errors on close
        }
      }
    }
  }
);

// Register the stop_timer tool
server.registerTool(
  "directgtd_stop_timer",
  {
    title: "Stop Timer",
    description: `Stop a running timer for an item.

This tool stops a time entry by setting its end time and calculating duration.

Args:
  - entry_id (string, optional): The ID of the specific time entry to stop.
  - item_id (string, optional): The ID of the item whose active timer to stop. Used if entry_id is not provided.

Note: At least one of entry_id or item_id must be provided.

Returns:
  The stopped time entry with duration.

Examples:
  - Use when: "Stop working on this task"
  - Use when: "End the timer"
  - Use when: "I'm done with this task for now"

Error Handling:
  - Returns error if no active timer found`,
    inputSchema: StopTimerInputSchema,
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false
    }
  },
  async (params: { entry_id?: string; item_id?: string }) => {
    let db: Database.Database | null = null;

    try {
      db = openDatabase();

      if (!params.entry_id && !params.item_id) {
        return {
          content: [{
            type: "text",
            text: "Error: Either entry_id or item_id must be provided."
          }],
          isError: true
        };
      }

      let entry: TimeEntry | undefined;

      if (params.entry_id) {
        entry = db.prepare(
          "SELECT * FROM time_entries WHERE id = ? AND ended_at IS NULL"
        ).get(params.entry_id) as TimeEntry | undefined;
      } else if (params.item_id) {
        entry = db.prepare(
          "SELECT * FROM time_entries WHERE item_id = ? AND ended_at IS NULL ORDER BY started_at DESC LIMIT 1"
        ).get(params.item_id) as TimeEntry | undefined;
      }

      if (!entry) {
        return {
          content: [{
            type: "text",
            text: "Error: No active timer found."
          }],
          isError: true
        };
      }

      // Get item title
      const item = db.prepare("SELECT title FROM items WHERE id = ?").get(entry.item_id) as { title: string } | undefined;

      // Stop the timer
      const now = Math.floor(Date.now() / 1000);
      const duration = now - entry.started_at;

      db.prepare(
        "UPDATE time_entries SET ended_at = ?, duration = ?, modified_at = ?, needs_push = 1 WHERE id = ?"
      ).run(now, duration, now, entry.id);

      const startTime = new Date(entry.started_at * 1000).toLocaleString('en-US', { timeZone: 'America/New_York' });
      const endTime = new Date(now * 1000).toLocaleString('en-US', { timeZone: 'America/New_York' });
      const durationStr = formatDuration(duration);

      return {
        content: [{
          type: "text",
          text: `# Timer Stopped\n\n**${item?.title ?? 'Unknown'}**\n\n- **Entry ID**: ${entry.id}\n- **Started**: ${startTime} EST\n- **Ended**: ${endTime} EST\n- **Duration**: ${durationStr}\n\nTimer stopped successfully.`
        }]
      };

    } catch (error) {
      return {
        content: [{
          type: "text",
          text: handleDatabaseError(error)
        }],
        isError: true
      };
    } finally {
      if (db) {
        try {
          db.close();
        } catch {
          // Ignore errors on close
        }
      }
    }
  }
);

// Register the get_time_entries tool
server.registerTool(
  "directgtd_get_time_entries",
  {
    title: "Get Time Entries",
    description: `Get all time entries for an item.

This tool retrieves the time tracking history for a specific item.

Args:
  - item_id (string, required): The ID of the item to get time entries for.
  - response_format ('markdown' | 'json', optional): Output format (default: 'markdown')

Returns:
  List of time entries with start time, end time, and duration.

Examples:
  - Use when: "Show me time spent on this task"
  - Use when: "Get time log for this item"
  - Use when: "How many times did I work on this?"

Error Handling:
  - Returns error if item_id doesn't exist
  - Returns empty list if no time entries exist`,
    inputSchema: GetTimeEntriesInputSchema,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false
    }
  },
  async (params: { item_id: string; response_format?: ResponseFormat }) => {
    let db: Database.Database | null = null;

    try {
      db = openDatabase();
      const responseFormat = params.response_format ?? ResponseFormat.MARKDOWN;

      // Check if item exists
      const item = db.prepare("SELECT id, title FROM items WHERE id = ?").get(params.item_id) as { id: string; title: string } | undefined;
      if (!item) {
        return {
          content: [{
            type: "text",
            text: `Error: Item with ID '${params.item_id}' not found.`
          }],
          isError: true
        };
      }

      const entries = db.prepare(
        "SELECT * FROM time_entries WHERE item_id = ? ORDER BY started_at DESC"
      ).all(params.item_id) as TimeEntry[];

      let result: string;

      if (responseFormat === ResponseFormat.MARKDOWN) {
        const lines: string[] = [
          `# Time Entries for "${item.title}"`,
          "",
          `Found ${entries.length} entr${entries.length === 1 ? 'y' : 'ies'}:`,
          ""
        ];

        if (entries.length === 0) {
          lines.push("*No time entries recorded.*");
        } else {
          let totalSeconds = 0;
          for (const entry of entries) {
            const startTime = new Date(entry.started_at * 1000).toLocaleString('en-US', { timeZone: 'America/New_York' });
            const isRunning = entry.ended_at === null;

            if (isRunning) {
              const elapsed = Math.floor(Date.now() / 1000) - entry.started_at;
              lines.push(`- **🔴 RUNNING** Started: ${startTime} EST (${formatDuration(elapsed)} elapsed) \`${entry.id}\``);
              totalSeconds += elapsed;
            } else {
              const endTime = new Date(entry.ended_at! * 1000).toLocaleString('en-US', { timeZone: 'America/New_York' });
              const duration = entry.duration ?? (entry.ended_at! - entry.started_at);
              lines.push(`- ${startTime} → ${endTime} EST (${formatDuration(duration)}) \`${entry.id}\``);
              totalSeconds += duration;
            }
          }
          lines.push("");
          lines.push(`**Total Time**: ${formatDuration(totalSeconds)}`);
        }

        result = lines.join("\n");
      } else {
        result = JSON.stringify({
          itemId: params.item_id,
          itemTitle: item.title,
          total: entries.length,
          entries: entries.map(entry => ({
            id: entry.id,
            startedAt: new Date(entry.started_at * 1000).toISOString(),
            endedAt: entry.ended_at ? new Date(entry.ended_at * 1000).toISOString() : null,
            duration: entry.duration,
            isRunning: entry.ended_at === null
          }))
        }, null, 2);
      }

      return {
        content: [{
          type: "text",
          text: result
        }]
      };

    } catch (error) {
      return {
        content: [{
          type: "text",
          text: handleDatabaseError(error)
        }],
        isError: true
      };
    } finally {
      if (db) {
        try {
          db.close();
        } catch {
          // Ignore errors on close
        }
      }
    }
  }
);

// Register the get_total_time tool
server.registerTool(
  "directgtd_get_total_time",
  {
    title: "Get Total Time",
    description: `Get total time spent on an item.

This tool calculates the total duration of all time entries for an item.

Args:
  - item_id (string, required): The ID of the item to get total time for.

Returns:
  Total time in human-readable format.

Examples:
  - Use when: "How much time have I spent on this task?"
  - Use when: "Total time for this item"

Error Handling:
  - Returns error if item_id doesn't exist`,
    inputSchema: GetTotalTimeInputSchema,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false
    }
  },
  async (params: { item_id: string }) => {
    let db: Database.Database | null = null;

    try {
      db = openDatabase();

      // Check if item exists
      const item = db.prepare("SELECT id, title FROM items WHERE id = ?").get(params.item_id) as { id: string; title: string } | undefined;
      if (!item) {
        return {
          content: [{
            type: "text",
            text: `Error: Item with ID '${params.item_id}' not found.`
          }],
          isError: true
        };
      }

      // Get completed entries total
      const completedResult = db.prepare(
        "SELECT COALESCE(SUM(duration), 0) as total FROM time_entries WHERE item_id = ? AND ended_at IS NOT NULL"
      ).get(params.item_id) as { total: number };

      // Get running entries elapsed time
      const runningEntries = db.prepare(
        "SELECT started_at FROM time_entries WHERE item_id = ? AND ended_at IS NULL"
      ).all(params.item_id) as { started_at: number }[];

      const now = Math.floor(Date.now() / 1000);
      let runningTotal = 0;
      for (const entry of runningEntries) {
        runningTotal += now - entry.started_at;
      }

      const totalSeconds = completedResult.total + runningTotal;

      return {
        content: [{
          type: "text",
          text: `# Total Time\n\n**${item.title}**\n\n**${formatDuration(totalSeconds)}**${runningEntries.length > 0 ? ` (includes ${runningEntries.length} running timer${runningEntries.length > 1 ? 's' : ''})` : ''}`
        }]
      };

    } catch (error) {
      return {
        content: [{
          type: "text",
          text: handleDatabaseError(error)
        }],
        isError: true
      };
    } finally {
      if (db) {
        try {
          db.close();
        } catch {
          // Ignore errors on close
        }
      }
    }
  }
);

// Register the get_active_timers tool
server.registerTool(
  "directgtd_get_active_timers",
  {
    title: "Get Active Timers",
    description: `Get all currently running timers.

This tool retrieves all time entries that haven't been stopped yet.

Args:
  - response_format ('markdown' | 'json', optional): Output format (default: 'markdown')

Returns:
  List of active timers with item details and elapsed time.

Examples:
  - Use when: "What timers are running?"
  - Use when: "Show active timers"
  - Use when: "Am I tracking any time right now?"

Error Handling:
  - Returns empty list if no active timers`,
    inputSchema: GetActiveTimersInputSchema,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false
    }
  },
  async (params: { response_format?: ResponseFormat }) => {
    let db: Database.Database | null = null;

    try {
      db = openDatabase();
      const responseFormat = params.response_format ?? ResponseFormat.MARKDOWN;

      const entries = db.prepare(`
        SELECT te.*, i.title as item_title
        FROM time_entries te
        JOIN items i ON te.item_id = i.id
        WHERE te.ended_at IS NULL
        ORDER BY te.started_at DESC
      `).all() as (TimeEntry & { item_title: string })[];

      let result: string;

      if (responseFormat === ResponseFormat.MARKDOWN) {
        const lines: string[] = [
          "# Active Timers",
          "",
          `${entries.length} timer${entries.length === 1 ? '' : 's'} running:`,
          ""
        ];

        if (entries.length === 0) {
          lines.push("*No active timers.*");
        } else {
          const now = Math.floor(Date.now() / 1000);
          for (const entry of entries) {
            const startTime = new Date(entry.started_at * 1000).toLocaleString('en-US', { timeZone: 'America/New_York' });
            const elapsed = now - entry.started_at;
            lines.push(`- 🔴 **${entry.item_title}** - ${formatDuration(elapsed)} (started ${startTime} EST) \`${entry.item_id}\``);
          }
        }

        result = lines.join("\n");
      } else {
        const now = Math.floor(Date.now() / 1000);
        result = JSON.stringify({
          total: entries.length,
          entries: entries.map(entry => ({
            entryId: entry.id,
            itemId: entry.item_id,
            itemTitle: entry.item_title,
            startedAt: new Date(entry.started_at * 1000).toISOString(),
            elapsedSeconds: now - entry.started_at
          }))
        }, null, 2);
      }

      return {
        content: [{
          type: "text",
          text: result
        }]
      };

    } catch (error) {
      return {
        content: [{
          type: "text",
          text: handleDatabaseError(error)
        }],
        isError: true
      };
    } finally {
      if (db) {
        try {
          db.close();
        } catch {
          // Ignore errors on close
        }
      }
    }
  }
);

// Register the update_start_time tool
server.registerTool(
  "directgtd_update_start_time",
  {
    title: "Update Timer Start Time",
    description: `Update the start time of a time entry.

This tool changes when a time entry started. Duration is recalculated if the entry has ended.

Args:
  - entry_id (string, required): The ID of the time entry to update.
  - started_at (string, required): New start time in ISO 8601 format. Example: '2024-12-03T19:00:00Z'

Returns:
  The updated time entry.

Examples:
  - Use when: "I actually started this 10 minutes ago"
  - Use when: "Fix the start time to 3pm"

Error Handling:
  - Returns error if entry_id doesn't exist`,
    inputSchema: UpdateStartTimeInputSchema,
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false
    }
  },
  async (params: { entry_id: string; started_at: string }) => {
    let db: Database.Database | null = null;

    try {
      db = openDatabase();

      // Check if entry exists
      const entry = db.prepare("SELECT * FROM time_entries WHERE id = ?").get(params.entry_id) as TimeEntry | undefined;
      if (!entry) {
        return {
          content: [{
            type: "text",
            text: `Error: Time entry with ID '${params.entry_id}' not found.`
          }],
          isError: true
        };
      }

      // Parse new start time
      const newStartedAt = Math.floor(new Date(params.started_at).getTime() / 1000);
      const modifiedAt = Math.floor(Date.now() / 1000);

      // Update entry
      if (entry.ended_at) {
        // Recalculate duration
        const newDuration = entry.ended_at - newStartedAt;
        db.prepare(
          "UPDATE time_entries SET started_at = ?, duration = ?, modified_at = ?, needs_push = 1 WHERE id = ?"
        ).run(newStartedAt, newDuration, modifiedAt, params.entry_id);
      } else {
        db.prepare(
          "UPDATE time_entries SET started_at = ?, modified_at = ?, needs_push = 1 WHERE id = ?"
        ).run(newStartedAt, modifiedAt, params.entry_id);
      }

      // Get item title
      const item = db.prepare("SELECT title FROM items WHERE id = ?").get(entry.item_id) as { title: string } | undefined;

      const startTime = new Date(newStartedAt * 1000).toLocaleString('en-US', { timeZone: 'America/New_York' });

      return {
        content: [{
          type: "text",
          text: `# Start Time Updated\n\n**${item?.title ?? 'Unknown'}**\n\n- **Entry ID**: ${params.entry_id}\n- **New Start Time**: ${startTime} EST\n\nStart time updated successfully.`
        }]
      };

    } catch (error) {
      return {
        content: [{
          type: "text",
          text: handleDatabaseError(error)
        }],
        isError: true
      };
    } finally {
      if (db) {
        try {
          db.close();
        } catch {
          // Ignore errors on close
        }
      }
    }
  }
);

// Register the update_end_time tool
server.registerTool(
  "directgtd_update_end_time",
  {
    title: "Update Timer End Time",
    description: `Update the end time of a time entry.

This tool changes when a time entry ended. Duration is recalculated automatically.

Args:
  - entry_id (string, required): The ID of the time entry to update.
  - ended_at (string, required): New end time in ISO 8601 format. Example: '2024-12-03T19:30:00Z'

Returns:
  The updated time entry with new duration.

Examples:
  - Use when: "I finished this at 5pm, not now"
  - Use when: "Fix the end time"

Error Handling:
  - Returns error if entry_id doesn't exist`,
    inputSchema: UpdateEndTimeInputSchema,
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false
    }
  },
  async (params: { entry_id: string; ended_at: string }) => {
    let db: Database.Database | null = null;

    try {
      db = openDatabase();

      // Check if entry exists
      const entry = db.prepare("SELECT * FROM time_entries WHERE id = ?").get(params.entry_id) as TimeEntry | undefined;
      if (!entry) {
        return {
          content: [{
            type: "text",
            text: `Error: Time entry with ID '${params.entry_id}' not found.`
          }],
          isError: true
        };
      }

      // Parse new end time
      const newEndedAt = Math.floor(new Date(params.ended_at).getTime() / 1000);
      const newDuration = newEndedAt - entry.started_at;
      const modifiedAt = Math.floor(Date.now() / 1000);

      // Update entry
      db.prepare(
        "UPDATE time_entries SET ended_at = ?, duration = ?, modified_at = ?, needs_push = 1 WHERE id = ?"
      ).run(newEndedAt, newDuration, modifiedAt, params.entry_id);

      // Get item title
      const item = db.prepare("SELECT title FROM items WHERE id = ?").get(entry.item_id) as { title: string } | undefined;

      const startTime = new Date(entry.started_at * 1000).toLocaleString('en-US', { timeZone: 'America/New_York' });
      const endTime = new Date(newEndedAt * 1000).toLocaleString('en-US', { timeZone: 'America/New_York' });

      return {
        content: [{
          type: "text",
          text: `# End Time Updated\n\n**${item?.title ?? 'Unknown'}**\n\n- **Entry ID**: ${params.entry_id}\n- **Started**: ${startTime} EST\n- **New End Time**: ${endTime} EST\n- **New Duration**: ${formatDuration(newDuration)}\n\nEnd time updated successfully.`
        }]
      };

    } catch (error) {
      return {
        content: [{
          type: "text",
          text: handleDatabaseError(error)
        }],
        isError: true
      };
    } finally {
      if (db) {
        try {
          db.close();
        } catch {
          // Ignore errors on close
        }
      }
    }
  }
);

// Register the create_tag tool
server.registerTool(
  "directgtd_create_tag",
  {
    title: "Create Tag",
    description: `Create a new tag in the system.

Args:
  - name (string, required): The name of the tag to create.
  - color (string, optional): Hex color code. Defaults to random color.

Returns:
  The created tag with its ID.

Examples:
  - Use when: "Create a tag called 'home'"
  - Use when: "Add a new tag 'waiting-for' with blue color"

Error Handling:
  - Returns error if tag name already exists`,
    inputSchema: CreateTagInputSchema,
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: false
    }
  },
  async (params: { name: string; color?: string }) => {
    let db: Database.Database | null = null;

    try {
      db = openDatabase();

      // Check if tag already exists
      const existing = db.prepare(
        "SELECT id FROM tags WHERE LOWER(name) = LOWER(?)"
      ).get(params.name) as { id: string } | undefined;

      if (existing) {
        return {
          content: [{
            type: "text",
            text: `Error: Tag '${params.name}' already exists.`
          }],
          isError: true
        };
      }

      // Generate random color if not provided
      const color = params.color ?? `#${Math.floor(Math.random()*16777215).toString(16).padStart(6, '0').toUpperCase()}`;

      // Create tag
      const tagId = crypto.randomUUID().toUpperCase();
      const now = Math.floor(Date.now() / 1000);
      db.prepare(
        "INSERT INTO tags (id, name, color, created_at, modified_at, needs_push) VALUES (?, ?, ?, ?, ?, 1)"
      ).run(tagId, params.name, color, now, now);

      return {
        content: [{
          type: "text",
          text: `# Tag Created\n\n**${params.name}** ● ${color}\n\n- **ID**: ${tagId}\n\nTag created successfully.`
        }]
      };

    } catch (error) {
      return {
        content: [{
          type: "text",
          text: handleDatabaseError(error)
        }],
        isError: true
      };
    } finally {
      if (db) {
        try {
          db.close();
        } catch {
          // Ignore errors on close
        }
      }
    }
  }
);

// Register the delete_tag tool
server.registerTool(
  "directgtd_delete_tag",
  {
    title: "Delete Tag",
    description: `Delete a tag from the system entirely.

This removes the tag and all associations with items.

Args:
  - tag_id (string, required): The ID of the tag to delete.

Returns:
  Confirmation of deletion.

Examples:
  - Use when: "Delete the 'old-tag' tag"
  - Use when: "Remove this tag from the system"

Error Handling:
  - Returns error if tag doesn't exist`,
    inputSchema: DeleteTagInputSchema,
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: true,
      openWorldHint: false
    }
  },
  async (params: { tag_id: string }) => {
    let db: Database.Database | null = null;

    try {
      db = openDatabase();

      // Check if tag exists
      const tag = db.prepare(
        "SELECT name, color FROM tags WHERE id = ?"
      ).get(params.tag_id) as { name: string; color: string } | undefined;

      if (!tag) {
        return {
          content: [{
            type: "text",
            text: `Error: Tag with ID '${params.tag_id}' not found.`
          }],
          isError: true
        };
      }

      // Soft-delete tag associations first
      const now = Math.floor(Date.now() / 1000);
      db.prepare("UPDATE item_tags SET deleted_at = ?, modified_at = ?, needs_push = 1 WHERE tag_id = ?").run(now, now, params.tag_id);

      // Soft-delete the tag
      db.prepare("UPDATE tags SET deleted_at = ?, modified_at = ?, needs_push = 1 WHERE id = ?").run(now, now, params.tag_id);

      return {
        content: [{
          type: "text",
          text: `# Tag Deleted\n\n**${tag.name}** ● ${tag.color}\n\n- **ID**: ${params.tag_id}\n\nTag and all associations deleted.`
        }]
      };

    } catch (error) {
      return {
        content: [{
          type: "text",
          text: handleDatabaseError(error)
        }],
        isError: true
      };
    } finally {
      if (db) {
        try {
          db.close();
        } catch {
          // Ignore errors on close
        }
      }
    }
  }
);

// Register the rename_tag tool
server.registerTool(
  "directgtd_rename_tag",
  {
    title: "Rename Tag",
    description: `Rename an existing tag.

Args:
  - tag_id (string, required): The ID of the tag to rename.
  - new_name (string, required): The new name for the tag.

Returns:
  The updated tag.

Examples:
  - Use when: "Rename 'home' tag to 'household'"
  - Use when: "Change tag name"

Error Handling:
  - Returns error if tag doesn't exist
  - Returns error if new name already exists`,
    inputSchema: RenameTagInputSchema,
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false
    }
  },
  async (params: { tag_id: string; new_name: string }) => {
    let db: Database.Database | null = null;

    try {
      db = openDatabase();

      // Check if tag exists
      const tag = db.prepare(
        "SELECT name, color FROM tags WHERE id = ?"
      ).get(params.tag_id) as { name: string; color: string } | undefined;

      if (!tag) {
        return {
          content: [{
            type: "text",
            text: `Error: Tag with ID '${params.tag_id}' not found.`
          }],
          isError: true
        };
      }

      // Check if new name already exists
      const existing = db.prepare(
        "SELECT id FROM tags WHERE LOWER(name) = LOWER(?) AND id != ?"
      ).get(params.new_name, params.tag_id) as { id: string } | undefined;

      if (existing) {
        return {
          content: [{
            type: "text",
            text: `Error: Tag '${params.new_name}' already exists.`
          }],
          isError: true
        };
      }

      // Rename tag
      const now = Math.floor(Date.now() / 1000);
      db.prepare("UPDATE tags SET name = ?, modified_at = ?, needs_push = 1 WHERE id = ?").run(params.new_name, now, params.tag_id);

      return {
        content: [{
          type: "text",
          text: `# Tag Renamed\n\n**${tag.name}** → **${params.new_name}** ● ${tag.color}\n\n- **ID**: ${params.tag_id}\n\nTag renamed successfully.`
        }]
      };

    } catch (error) {
      return {
        content: [{
          type: "text",
          text: handleDatabaseError(error)
        }],
        isError: true
      };
    } finally {
      if (db) {
        try {
          db.close();
        } catch {
          // Ignore errors on close
        }
      }
    }
  }
);

// Get Dashboard - combines Next, urgent, and overdue items
server.registerTool(
  "directgtd_get_dashboard",
  {
    title: "Get Dashboard",
    description: `Get a combined view of actionable items: Next tagged, urgent tagged, and overdue.

This tool provides a single view of items that need attention, combining:
1. Items tagged "Next" (next actions)
2. Items tagged "urgent"
3. Overdue items (past due date)

Args:
  - response_format ('markdown' | 'json', optional): Output format (default: 'markdown')

Returns:
  Combined list of actionable items grouped by category.

Examples:
  - Use when: "What should I work on?"
  - Use when: "Show me my dashboard"
  - Use when: "What needs attention?"

Error Handling:
  - Returns empty sections if no items match each category`,
    inputSchema: GetDashboardInputSchema,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false
    }
  },
  async (params: { response_format?: ResponseFormat }) => {
    let db: Database.Database | null = null;
    const responseFormat = params.response_format || ResponseFormat.MARKDOWN;

    try {
      db = openDatabase();

      // Get archive folder ID to exclude
      const archiveFolder = db.prepare(
        "SELECT id FROM items WHERE LOWER(title) = 'archive' AND parent_id IS NULL"
      ).get() as { id: string } | undefined;
      const archiveId = archiveFolder?.id;

      // Helper to check if item is in archive
      const archiveExclusionSQL = archiveId ? `
        AND i.id NOT IN (
          WITH RECURSIVE archive_tree AS (
            SELECT id FROM items WHERE id = ?
            UNION ALL
            SELECT items.id FROM items
            JOIN archive_tree ON items.parent_id = archive_tree.id
          )
          SELECT id FROM archive_tree
        )
      ` : '';

      // Get items tagged "Next"
      const nextTagQuery = `
        SELECT i.id, i.title, i.item_type, i.due_date, i.parent_id,
               p.title as parent_title
        FROM items i
        LEFT JOIN items p ON i.parent_id = p.id
        JOIN item_tags it ON i.id = it.item_id
        JOIN tags t ON it.tag_id = t.id
        WHERE LOWER(t.name) = 'next'
          AND i.completed_at IS NULL
          ${archiveExclusionSQL}
        ORDER BY i.sort_order
      `;
      const nextItems = archiveId
        ? db.prepare(nextTagQuery).all(archiveId) as Array<{ id: string; title: string; item_type: string; due_date: number | null; parent_id: string | null; parent_title: string | null }>
        : db.prepare(nextTagQuery.replace(archiveExclusionSQL, '')).all() as Array<{ id: string; title: string; item_type: string; due_date: number | null; parent_id: string | null; parent_title: string | null }>;

      // Get items tagged "urgent"
      const urgentTagQuery = `
        SELECT i.id, i.title, i.item_type, i.due_date, i.parent_id,
               p.title as parent_title
        FROM items i
        LEFT JOIN items p ON i.parent_id = p.id
        JOIN item_tags it ON i.id = it.item_id
        JOIN tags t ON it.tag_id = t.id
        WHERE LOWER(t.name) = 'urgent'
          AND i.completed_at IS NULL
          ${archiveExclusionSQL}
        ORDER BY i.due_date ASC NULLS LAST, i.sort_order
      `;
      const urgentItems = archiveId
        ? db.prepare(urgentTagQuery).all(archiveId) as Array<{ id: string; title: string; item_type: string; due_date: number | null; parent_id: string | null; parent_title: string | null }>
        : db.prepare(urgentTagQuery.replace(archiveExclusionSQL, '')).all() as Array<{ id: string; title: string; item_type: string; due_date: number | null; parent_id: string | null; parent_title: string | null }>;

      // Get overdue items
      const now = Math.floor(Date.now() / 1000);
      const overdueQuery = `
        SELECT i.id, i.title, i.item_type, i.due_date, i.parent_id,
               p.title as parent_title
        FROM items i
        LEFT JOIN items p ON i.parent_id = p.id
        WHERE i.due_date IS NOT NULL
          AND i.due_date < ?
          AND i.completed_at IS NULL
          ${archiveExclusionSQL}
        ORDER BY i.due_date ASC
      `;
      const overdueItems = archiveId
        ? db.prepare(overdueQuery).all(now, archiveId) as Array<{ id: string; title: string; item_type: string; due_date: number | null; parent_id: string | null; parent_title: string | null }>
        : db.prepare(overdueQuery.replace(archiveExclusionSQL, '')).all(now) as Array<{ id: string; title: string; item_type: string; due_date: number | null; parent_id: string | null; parent_title: string | null }>;

      // Deduplicate - items may appear in multiple categories
      const seenIds = new Set<string>();
      const dedupeNext = nextItems.filter(item => {
        if (seenIds.has(item.id)) return false;
        seenIds.add(item.id);
        return true;
      });
      const dedupeUrgent = urgentItems.filter(item => {
        if (seenIds.has(item.id)) return false;
        seenIds.add(item.id);
        return true;
      });
      const dedupeOverdue = overdueItems.filter(item => {
        if (seenIds.has(item.id)) return false;
        seenIds.add(item.id);
        return true;
      });

      if (responseFormat === ResponseFormat.JSON) {
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              next: dedupeNext,
              urgent: dedupeUrgent,
              overdue: dedupeOverdue,
              totals: {
                next: dedupeNext.length,
                urgent: dedupeUrgent.length,
                overdue: dedupeOverdue.length,
                total: dedupeNext.length + dedupeUrgent.length + dedupeOverdue.length
              }
            }, null, 2)
          }]
        };
      }

      // Markdown format
      const formatItem = (item: { id: string; title: string; item_type: string; due_date: number | null; parent_title: string | null }) => {
        let line = `- **${item.title}**`;
        if (item.parent_title) {
          line += ` (in ${item.parent_title})`;
        }
        if (item.due_date) {
          const dueDate = new Date(item.due_date * 1000);
          line += ` - Due: ${dueDate.toLocaleDateString()}`;
        }
        return line;
      };

      let output = "# Dashboard\n\n";

      output += `## 🎯 Next Actions (${dedupeNext.length})\n`;
      if (dedupeNext.length === 0) {
        output += "*No items tagged Next*\n";
      } else {
        dedupeNext.forEach(item => {
          output += formatItem(item) + "\n";
        });
      }
      output += "\n";

      output += `## 🔴 Urgent (${dedupeUrgent.length})\n`;
      if (dedupeUrgent.length === 0) {
        output += "*No urgent items*\n";
      } else {
        dedupeUrgent.forEach(item => {
          output += formatItem(item) + "\n";
        });
      }
      output += "\n";

      output += `## ⏰ Overdue (${dedupeOverdue.length})\n`;
      if (dedupeOverdue.length === 0) {
        output += "*No overdue items*\n";
      } else {
        dedupeOverdue.forEach(item => {
          output += formatItem(item) + "\n";
        });
      }

      const total = dedupeNext.length + dedupeUrgent.length + dedupeOverdue.length;
      output += `\n---\n**Total actionable items: ${total}**`;

      return {
        content: [{
          type: "text",
          text: output
        }]
      };

    } catch (error) {
      return {
        content: [{
          type: "text",
          text: handleDatabaseError(error)
        }],
        isError: true
      };
    } finally {
      if (db) {
        try {
          db.close();
        } catch {
          // Ignore errors on close
        }
      }
    }
  }
);

// Get Stuck Projects - projects with no Next-tagged items in their tree
server.registerTool(
  "directgtd_get_stuck_projects",
  {
    title: "Get Stuck Projects",
    description: `Find projects that have no Next-tagged items anywhere in their tree (up to 2 levels deep).

This tool helps identify projects that need attention during GTD reviews - projects that are "stuck" because they don't have a defined next action.

Projects tagged "on-hold" are automatically excluded from results.

Args:
  - root_id (string, optional): Root folder ID to search within (e.g., Home, Work). If omitted, searches all areas.
  - response_format ('markdown' | 'json', optional): Output format (default: 'markdown')

Returns:
  List of projects (folders) that have no Next-tagged descendants.

Examples:
  - Use when: "Show me stuck projects"
  - Use when: "Which Home projects need next actions?"
  - Use when: "Find projects without next actions in Work"

Error Handling:
  - Returns empty list if all projects have next actions
  - Returns error if root_id doesn't exist`,
    inputSchema: GetStuckProjectsInputSchema,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false
    }
  },
  async (params: { root_id?: string; response_format?: ResponseFormat }) => {
    let db: Database.Database | null = null;
    const responseFormat = params.response_format || ResponseFormat.MARKDOWN;

    try {
      db = openDatabase();

      // Get the "Next" tag ID
      const nextTag = db.prepare(
        "SELECT id FROM tags WHERE LOWER(name) = 'next'"
      ).get() as { id: string } | undefined;

      if (!nextTag) {
        return {
          content: [{
            type: "text",
            text: responseFormat === ResponseFormat.JSON
              ? JSON.stringify({ projects: [], total: 0, message: "No 'Next' tag exists in the system" }, null, 2)
              : "# Stuck Projects\n\nNo 'Next' tag exists in the system. Create one to track next actions."
          }]
        };
      }

      // Get the "on-hold" tag ID (optional - may not exist)
      const onHoldTag = db.prepare(
        "SELECT id FROM tags WHERE LOWER(name) = 'on-hold'"
      ).get() as { id: string } | undefined;

      // Get the "routine" tag ID (optional - may not exist)
      const routineTag = db.prepare(
        "SELECT id FROM tags WHERE LOWER(name) = 'routine'"
      ).get() as { id: string } | undefined;

      // Get archive folder ID to exclude
      const archiveFolder = db.prepare(
        "SELECT id FROM items WHERE LOWER(title) = 'archive' AND parent_id IS NULL"
      ).get() as { id: string } | undefined;
      const archiveId = archiveFolder?.id;

      // Get reference folder ID to exclude
      const referenceFolder = db.prepare(
        "SELECT id FROM items WHERE LOWER(title) = 'reference' AND parent_id IS NULL"
      ).get() as { id: string } | undefined;
      const referenceId = referenceFolder?.id;

      // Get templates folder ID to exclude
      const templatesFolder = db.prepare(
        "SELECT id FROM items WHERE LOWER(title) = 'templates' AND parent_id IS NULL"
      ).get() as { id: string } | undefined;
      const templatesId = templatesFolder?.id;

      // Build the query to find projects (folders that are children of root areas or specified root)
      let projectsQuery: string;
      let projectsParams: (string | undefined)[];

      if (params.root_id) {
        // Validate root_id exists
        const rootExists = db.prepare("SELECT id FROM items WHERE id = ?").get(params.root_id);
        if (!rootExists) {
          return {
            content: [{
              type: "text",
              text: `Error: Root folder with ID '${params.root_id}' not found.`
            }],
            isError: true
          };
        }
        // Get direct children of specified root that are folders
        projectsQuery = `
          SELECT id, title FROM items
          WHERE parent_id = ?
          AND item_type = 'Folder'
          ${archiveId ? "AND id != ?" : ""}
        `;
        projectsParams = archiveId ? [params.root_id, archiveId] : [params.root_id];
      } else {
        // Get all folders that are children of root-level items (areas)
        // Exclude Archive, Reference, and Templates folders
        const excludedParentIds = [archiveId, referenceId, templatesId].filter(Boolean);
        const excludeParentClause = excludedParentIds.length > 0
          ? `AND p.id NOT IN (${excludedParentIds.map(() => '?').join(', ')})`
          : '';

        projectsQuery = `
          SELECT i.id, i.title, p.title as area_title
          FROM items i
          JOIN items p ON i.parent_id = p.id
          WHERE p.parent_id IS NULL
          AND i.item_type = 'Folder'
          ${excludeParentClause}
        `;
        projectsParams = excludedParentIds as string[];
      }

      const projects = db.prepare(projectsQuery).all(...projectsParams) as Array<{ id: string; title: string; area_title?: string }>;

      // Filter out on-hold and routine projects
      const excludedTagIds = [onHoldTag?.id, routineTag?.id].filter(Boolean) as string[];
      const activeProjects = excludedTagIds.length > 0
        ? projects.filter(project => {
            const hasExcludedTag = db!.prepare(
              `SELECT 1 FROM item_tags WHERE item_id = ? AND tag_id IN (${excludedTagIds.map(() => '?').join(', ')})`
            ).get(project.id, ...excludedTagIds);
            return !hasExcludedTag;
          })
        : projects;

      // For each project, check if it has any Next-tagged descendants (up to 2 levels)
      const stuckProjects: Array<{ id: string; title: string; area_title?: string }> = [];

      for (const project of activeProjects) {
        const hasNextAction = db.prepare(`
          WITH RECURSIVE descendants AS (
            -- Level 1: direct children
            SELECT id, 1 as depth FROM items WHERE parent_id = ? AND deleted_at IS NULL
            UNION ALL
            -- Level 2: grandchildren (stop at depth 2)
            SELECT items.id, descendants.depth + 1
            FROM items
            JOIN descendants ON items.parent_id = descendants.id
            WHERE descendants.depth < 2 AND items.deleted_at IS NULL
          )
          SELECT 1 FROM descendants
          JOIN item_tags ON descendants.id = item_tags.item_id
          WHERE item_tags.tag_id = ?
          LIMIT 1
        `).get(project.id, nextTag.id);

        if (!hasNextAction) {
          stuckProjects.push(project);
        }
      }

      if (responseFormat === ResponseFormat.JSON) {
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              projects: stuckProjects,
              total: stuckProjects.length
            }, null, 2)
          }]
        };
      }

      // Markdown format
      let output = "# Stuck Projects\n\n";
      output += `*Projects with no Next-tagged items (excluding on-hold)*\n\n`;

      if (stuckProjects.length === 0) {
        output += "All projects have next actions defined. Great job!";
      } else {
        output += `Found ${stuckProjects.length} project(s) needing attention:\n\n`;
        stuckProjects.forEach((project, index) => {
          if (project.area_title) {
            output += `${index + 1}. **${project.title}** (in ${project.area_title})\n`;
          } else {
            output += `${index + 1}. **${project.title}**\n`;
          }
        });
      }

      return {
        content: [{
          type: "text",
          text: output
        }]
      };

    } catch (error) {
      return {
        content: [{
          type: "text",
          text: handleDatabaseError(error)
        }],
        isError: true
      };
    } finally {
      if (db) {
        try {
          db.close();
        } catch {
          // Ignore errors on close
        }
      }
    }
  }
);

// Empty Trash - permanently delete items from Trash
server.registerTool(
  "directgtd_empty_trash",
  {
    title: "Empty Trash",
    description: `Permanently delete items from the Trash folder.

This tool permanently deletes items in the Trash. You can optionally keep recent items.

Args:
  - keep_items_since (string, optional): Keep items modified after this date. ISO 8601 format (e.g., '2024-11-01T00:00:00Z'). If omitted, empties entire trash.

Returns:
  Count of permanently deleted items.

Examples:
  - Use when: "Empty the trash"
  - Use when: "Delete trash items older than 1 month"
  - Use when: "Clear all trash"

Error Handling:
  - Returns error if Trash folder doesn't exist
  - Returns error if database write fails`,
    inputSchema: EmptyTrashInputSchema,
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: false,
      openWorldHint: false
    }
  },
  async (params: { keep_items_since?: string }) => {
    let db: Database.Database | null = null;

    try {
      db = openDatabase();

      // Find the Trash folder
      const trashFolder = db.prepare(
        "SELECT id FROM items WHERE LOWER(title) = 'trash' AND parent_id IS NULL"
      ).get() as { id: string } | undefined;

      if (!trashFolder) {
        return {
          content: [{
            type: "text",
            text: `Error: Trash folder not found.`
          }],
          isError: true
        };
      }

      let updateQuery: string;
      let countQuery: string;
      let queryParams: (string | number)[];
      const now = Math.floor(Date.now() / 1000);

      if (params.keep_items_since) {
        // Parse the date and convert to Unix timestamp
        const keepSince = Math.floor(new Date(params.keep_items_since).getTime() / 1000);

        // Soft-delete items in trash that were modified before the keep_since date
        updateQuery = "UPDATE items SET deleted_at = ?, modified_at = ?, needs_push = 1 WHERE parent_id = ? AND modified_at < ? AND deleted_at IS NULL";
        countQuery = "SELECT COUNT(*) as count FROM items WHERE parent_id = ? AND modified_at < ? AND deleted_at IS NULL";
        queryParams = [trashFolder.id, keepSince];
      } else {
        // Soft-delete all items in trash
        updateQuery = "UPDATE items SET deleted_at = ?, modified_at = ?, needs_push = 1 WHERE parent_id = ? AND deleted_at IS NULL";
        countQuery = "SELECT COUNT(*) as count FROM items WHERE parent_id = ? AND deleted_at IS NULL";
        queryParams = [trashFolder.id];
      }

      // Count items before soft-deletion
      const countResult = db.prepare(countQuery).get(...queryParams) as { count: number };

      // Perform soft-deletion
      db.prepare(updateQuery).run(now, now, ...queryParams);

      const result = params.keep_items_since
        ? `# Trash Emptied\n\nPermanently deleted ${countResult.count} item(s) modified before ${params.keep_items_since}.`
        : `# Trash Emptied\n\nPermanently deleted ${countResult.count} item(s).`;

      return {
        content: [{
          type: "text",
          text: result
        }]
      };

    } catch (error) {
      return {
        content: [{
          type: "text",
          text: handleDatabaseError(error)
        }],
        isError: true
      };
    } finally {
      if (db) {
        try {
          db.close();
        } catch {
          // Ignore errors on close
        }
      }
    }
  }
);

server.registerTool(
  "directgtd_instantiate_template",
  {
    title: "Instantiate Template",
    description: `Create a new instance from a template with all its children.

This tool copies a template and all its descendants to create a new project/folder structure. Tags on items are also copied.

Args:
  - template_id (string, required): The ID of the template to instantiate.
  - name (string, required): The name for the new instance.
  - parent_id (string, optional): Where to create the instance. Defaults to Inbox.
  - as_type (string, optional): Item type for the root. Default: 'Project'.

Returns:
  The created instance with its ID and structure.

Examples:
  - Use when: "Create a new morning routine from template"
  - Use when: "Instantiate the friday template"
  - Use when: "Start a new project from the checklist template"

Error Handling:
  - Returns error if template_id doesn't exist
  - Returns error if parent_id doesn't exist
  - Returns error if database write fails`,
    inputSchema: InstantiateTemplateInputSchema,
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: false
    }
  },
  async (params: { template_id: string; name: string; parent_id?: string; as_type?: string }) => {
    let db: Database.Database | null = null;

    try {
      db = openDatabase();

      // Get the template
      const template = db.prepare("SELECT * FROM items WHERE id = ?").get(params.template_id) as DirectGTDItem | undefined;

      if (!template) {
        return {
          content: [{
            type: "text",
            text: `Error: Template not found with ID: ${params.template_id}`
          }],
          isError: true
        };
      }

      // Determine parent ID
      let parentId: string;
      if (params.parent_id) {
        const parent = db.prepare("SELECT id FROM items WHERE id = ?").get(params.parent_id) as { id: string } | undefined;
        if (!parent) {
          return {
            content: [{
              type: "text",
              text: `Error: Parent not found with ID: ${params.parent_id}`
            }],
            isError: true
          };
        }
        parentId = params.parent_id;
      } else {
        parentId = getInboxId(db);
      }

      // Get next sort order
      const sortResult = db.prepare(
        "SELECT COALESCE(MAX(sort_order), -1) + 1 as next_order FROM items WHERE parent_id = ? AND deleted_at IS NULL"
      ).get(parentId) as { next_order: number };

      const now = Math.floor(Date.now() / 1000);
      const rootType = params.as_type || "Project";

      // Map from old IDs to new IDs
      const idMap = new Map<string, string>();

      // Create the root item
      const rootId = generateUUID();
      idMap.set(params.template_id, rootId);

      const insertStmt = db.prepare(`
        INSERT INTO items (
          id, title, parent_id, sort_order,
          created_at, modified_at, item_type,
          due_date, completed_at, earliest_start_time, notes, needs_push
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
      `);

      insertStmt.run(
        rootId,
        params.name,
        parentId,
        sortResult.next_order,
        now,
        now,
        rootType,
        null,
        null,
        null,
        template.notes
      );

      // Copy tags from template to root
      const templateTags = db.prepare(
        "SELECT tag_id FROM item_tags WHERE item_id = ?"
      ).all(params.template_id) as { tag_id: string }[];

      const insertTagStmt = db.prepare("INSERT INTO item_tags (item_id, tag_id, created_at, modified_at, needs_push) VALUES (?, ?, ?, ?, 1)");
      for (const tag of templateTags) {
        insertTagStmt.run(rootId, tag.tag_id, now, now);
      }

      // Recursively copy all children
      const copyChildren = (oldParentId: string, newParentId: string) => {
        const children = db!.prepare(
          "SELECT * FROM items WHERE parent_id = ? AND deleted_at IS NULL ORDER BY sort_order"
        ).all(oldParentId) as DirectGTDItem[];

        for (const child of children) {
          const newChildId = generateUUID();
          idMap.set(child.id, newChildId);

          // Determine item type - keep original type for children (Task, Note, etc.)
          const childType = child.item_type === "Template" ? "Folder" : child.item_type;

          insertStmt.run(
            newChildId,
            child.title,
            newParentId,
            child.sort_order,
            now,
            now,
            childType,
            child.due_date,
            null, // Don't copy completed_at
            child.earliest_start_time,
            child.notes
          );

          // Copy tags
          const childTags = db!.prepare(
            "SELECT tag_id FROM item_tags WHERE item_id = ?"
          ).all(child.id) as { tag_id: string }[];

          for (const tag of childTags) {
            insertTagStmt.run(newChildId, tag.tag_id, now, now);
          }

          // Recursively copy this child's children
          copyChildren(child.id, newChildId);
        }
      };

      copyChildren(params.template_id, rootId);

      // Count created items
      const itemCount = idMap.size;

      // Get the created item for response
      const createdItem = db.prepare("SELECT * FROM items WHERE id = ?").get(rootId) as DirectGTDItem;

      const createdTime = new Date(now * 1000).toLocaleString('en-US', {
        timeZone: 'America/New_York',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }) + " EST";

      return {
        content: [{
          type: "text",
          text: `# Template Instantiated

**${params.name}**

- **ID**: ${rootId}
- **Type**: ${rootType}
- **Parent**: ${parentId}
- **Items Created**: ${itemCount}
- **Created**: ${createdTime}

Template "${template.title}" successfully instantiated.`
        }]
      };

    } catch (error) {
      return {
        content: [{
          type: "text",
          text: handleDatabaseError(error)
        }],
        isError: true
      };
    } finally {
      if (db) {
        try {
          db.close();
        } catch {
          // Ignore errors on close
        }
      }
    }
  }
);

server.registerTool(
  "directgtd_get_oldest_tasks",
  {
    title: "Get Oldest Tasks",
    description: `Get the oldest incomplete tasks - useful for finding neglected items or routines.

This tool retrieves tasks sorted by creation date (oldest first). Excludes:
- Completed tasks
- Items in Templates folder
- Items in Reference folder
- Items in Archive folder
- Items in Trash folder

Args:
  - limit (number, optional): Maximum tasks to return. Default: 20
  - root_id (string, optional): Filter to tasks within a specific area (Home, Work, etc.)
  - response_format ('markdown' | 'json'): Output format (default: 'markdown')

Returns:
  Oldest tasks with age in days, sorted oldest first.

Examples:
  - Use when: "Show me neglected tasks"
  - Use when: "What tasks have fallen through the cracks?"
  - Use when: "Find old tasks that might be routines"

Error Handling:
  - Returns empty list if no tasks match criteria`,
    inputSchema: GetOldestTasksInputSchema,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false
    }
  },
  async (params: { limit?: number; root_id?: string; response_format?: ResponseFormat }) => {
    let db: Database.Database | null = null;

    try {
      db = openDatabase();

      const limit = params.limit ?? 20;
      const now = Math.floor(Date.now() / 1000);

      // Get IDs of folders to exclude (Templates, Reference, Archive, Trash)
      const excludedFolders = db.prepare(`
        SELECT id FROM items
        WHERE parent_id IS NULL
        AND LOWER(title) IN ('templates', 'reference', 'archive', 'trash')
      `).all() as { id: string }[];

      const excludedIds = excludedFolders.map(f => f.id);

      // Build set of all descendants of excluded folders
      const excludedDescendants = new Set<string>(excludedIds);

      const getDescendants = (parentId: string) => {
        const children = db!.prepare("SELECT id FROM items WHERE parent_id = ? AND deleted_at IS NULL").all(parentId) as { id: string }[];
        for (const child of children) {
          excludedDescendants.add(child.id);
          getDescendants(child.id);
        }
      };

      for (const id of excludedIds) {
        getDescendants(id);
      }

      // If root_id specified, get all descendants of that root
      let rootDescendants: Set<string> | null = null;
      if (params.root_id) {
        rootDescendants = new Set<string>();
        rootDescendants.add(params.root_id);
        const getRootDescendants = (parentId: string) => {
          const children = db!.prepare("SELECT id FROM items WHERE parent_id = ? AND deleted_at IS NULL").all(parentId) as { id: string }[];
          for (const child of children) {
            rootDescendants!.add(child.id);
            getRootDescendants(child.id);
          }
        };
        getRootDescendants(params.root_id);
      }

      // Get all incomplete tasks sorted by created_at
      const tasks = db.prepare(`
        SELECT i.*, p.title as parent_title
        FROM items i
        LEFT JOIN items p ON i.parent_id = p.id
        WHERE i.item_type = 'Task'
        AND i.completed_at IS NULL
        AND i.deleted_at IS NULL
        ORDER BY i.created_at ASC
      `).all() as (DirectGTDItem & { parent_title: string | null })[];

      // Filter out excluded items and apply root filter
      const filteredTasks = tasks.filter(task => {
        // Exclude if task or any ancestor is in excluded folders
        if (excludedDescendants.has(task.id)) return false;

        // Check if task's parent chain includes excluded folder
        let currentId: string | null = task.parent_id;
        while (currentId) {
          if (excludedDescendants.has(currentId)) return false;
          const parent = db!.prepare("SELECT parent_id FROM items WHERE id = ?").get(currentId) as { parent_id: string | null } | undefined;
          currentId = parent?.parent_id ?? null;
        }

        // If root filter, check if task is descendant of root
        if (rootDescendants && !rootDescendants.has(task.id)) {
          // Check if any ancestor is in rootDescendants
          let ancestorId: string | null = task.parent_id;
          let isDescendant = false;
          while (ancestorId) {
            if (rootDescendants.has(ancestorId)) {
              isDescendant = true;
              break;
            }
            const parent = db!.prepare("SELECT parent_id FROM items WHERE id = ?").get(ancestorId) as { parent_id: string | null } | undefined;
            ancestorId = parent?.parent_id ?? null;
          }
          if (!isDescendant) return false;
        }

        return true;
      }).slice(0, limit);

      if (filteredTasks.length === 0) {
        return {
          content: [{
            type: "text",
            text: params.response_format === ResponseFormat.JSON
              ? JSON.stringify({ total: 0, items: [] }, null, 2)
              : "# Oldest Tasks\n\nNo incomplete tasks found."
          }]
        };
      }

      if (params.response_format === ResponseFormat.JSON) {
        const items = filteredTasks.map(task => {
          const createdAt = typeof task.created_at === 'number' ? task.created_at : parseInt(task.created_at as string);
          const ageInDays = Math.floor((now - createdAt) / 86400);
          return {
            id: task.id,
            title: task.title,
            parentId: task.parent_id,
            parentTitle: task.parent_title,
            createdAt: new Date(createdAt * 1000).toISOString(),
            ageInDays
          };
        });

        return {
          content: [{
            type: "text",
            text: JSON.stringify({ total: items.length, items }, null, 2)
          }]
        };
      }

      // Markdown format
      const lines = ["# Oldest Tasks\n", `Found ${filteredTasks.length} task(s), oldest first:\n`];

      for (const task of filteredTasks) {
        const createdAt = typeof task.created_at === 'number' ? task.created_at : parseInt(task.created_at as string);
        const ageInDays = Math.floor((now - createdAt) / 86400);
        const createdDate = new Date(createdAt * 1000).toLocaleDateString('en-US', {
          timeZone: 'America/New_York',
          month: 'short',
          day: 'numeric',
          year: 'numeric'
        });

        const parentInfo = task.parent_title ? ` (in ${task.parent_title})` : '';
        lines.push(`- **${task.title}**${parentInfo}`);
        lines.push(`  Created: ${createdDate} (${ageInDays} days old) \`${task.id}\``);
      }

      return {
        content: [{
          type: "text",
          text: lines.join("\n")
        }]
      };

    } catch (error) {
      return {
        content: [{
          type: "text",
          text: handleDatabaseError(error)
        }],
        isError: true
      };
    } finally {
      if (db) {
        try {
          db.close();
        } catch {
          // Ignore errors on close
        }
      }
    }
  }
);

// Helper function to format duration
function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${seconds}s`;
  }
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m ${secs}s`;
  }
  return `${minutes}m ${secs}s`;
}

// Main function
async function main() {
  // Create transport
  const transport = new StdioServerTransport();

  // Connect server to transport
  await server.connect(transport);

  console.error("DirectGTD MCP server running via stdio");
}

// Run the server
main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});
