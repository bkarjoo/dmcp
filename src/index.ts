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
    try {
      // Apply default for response_format
      const responseFormat = params.response_format ?? ResponseFormat.MARKDOWN;

      // Use HTTP API to get root items
      const response = await fetch("http://localhost:9876/root-items");

      if (!response.ok) {
        const errorData = await response.json() as { error?: string };
        return {
          content: [{
            type: "text",
            text: `Error: ${errorData.error || 'Failed to get root items'}`
          }],
          isError: true
        };
      }

      const data = await response.json() as { items: Array<{
        id: string;
        title?: string;
        parentId?: string | null;
        sortOrder?: number;
        createdAt?: number;
        modifiedAt?: number;
        completedAt?: number | null;
        dueDate?: number | null;
        earliestStartTime?: number | null;
        itemType?: string;
        notes?: string | null;
      }> };

      // Convert API response to FormattedItem format
      const items: FormattedItem[] = data.items.map(item => ({
        id: item.id,
        title: item.title || "",
        parentId: item.parentId || null,
        sortOrder: item.sortOrder || 0,
        createdAt: item.createdAt ? new Date(item.createdAt * 1000).toISOString() : "",
        modifiedAt: item.modifiedAt ? new Date(item.modifiedAt * 1000).toISOString() : "",
        completedAt: item.completedAt ? new Date(item.completedAt * 1000).toISOString() : null,
        dueDate: item.dueDate ? new Date(item.dueDate * 1000).toISOString() : null,
        earliestStartTime: item.earliestStartTime ? new Date(item.earliestStartTime * 1000).toISOString() : null,
        notes: item.notes || null
      }));

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
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        content: [{
          type: "text",
          text: `Error: Failed to connect to DirectGTD API. Make sure the app is running. Details: ${errorMessage}`
        }],
        isError: true
      };
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
    try {
      // Apply default for response_format
      const responseFormat = params.response_format ?? ResponseFormat.MARKDOWN;
      const parentId = params.parent_id;

      // Use HTTP API to get children
      const response = await fetch(`http://localhost:9876/items/${parentId}/children`);

      if (!response.ok) {
        const errorData = await response.json() as { error?: string };
        return {
          content: [{
            type: "text",
            text: `Error: ${errorData.error || 'Failed to get children'}`
          }],
          isError: true
        };
      }

      const data = await response.json() as { items: Array<{
        id: string;
        title?: string;
        parentId?: string | null;
        sortOrder?: number;
        createdAt?: number;
        modifiedAt?: number;
        completedAt?: number | null;
        dueDate?: number | null;
        earliestStartTime?: number | null;
        itemType?: string;
        notes?: string | null;
      }> };

      // Convert API response to FormattedItem format
      const items: FormattedItem[] = data.items.map(item => ({
        id: item.id,
        title: item.title || "",
        parentId: item.parentId || null,
        sortOrder: item.sortOrder || 0,
        createdAt: item.createdAt ? new Date(item.createdAt * 1000).toISOString() : "",
        modifiedAt: item.modifiedAt ? new Date(item.modifiedAt * 1000).toISOString() : "",
        completedAt: item.completedAt ? new Date(item.completedAt * 1000).toISOString() : null,
        dueDate: item.dueDate ? new Date(item.dueDate * 1000).toISOString() : null,
        earliestStartTime: item.earliestStartTime ? new Date(item.earliestStartTime * 1000).toISOString() : null,
        notes: item.notes || null
      }));

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
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        content: [{
          type: "text",
          text: `Error: Failed to connect to DirectGTD API. Make sure the app is running. Details: ${errorMessage}`
        }],
        isError: true
      };
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
    try {
      // Build request body for quick-capture API
      const body: { title: string; itemType?: string; dueDate?: number } = {
        title: params.title,
        itemType: params.item_type || "Task"
      };

      // Add due date if provided (convert to Unix timestamp)
      if (params.due_date) {
        body.dueDate = Math.floor(new Date(params.due_date).getTime() / 1000);
      }

      // Use HTTP API for quick capture
      const response = await fetch("http://localhost:9876/quick-capture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        const errorData = await response.json() as { error?: string };
        return {
          content: [{
            type: "text",
            text: `Error: Failed to add item to inbox. ${errorData.error || response.statusText}`
          }],
          isError: true
        };
      }

      const data = await response.json() as { item: { id: string; title?: string; itemType?: string; sortOrder?: number; createdAt?: number; dueDate?: number | null } };
      const item = data.item;

      const result = `# Item Added to Inbox

**${item.title}**

- **ID**: ${item.id}
- **Type**: ${item.itemType || params.item_type || "Task"}
- **Sort Order**: ${item.sortOrder}
- **Created**: ${formatDate(item.createdAt ? new Date(item.createdAt * 1000).toISOString() : null)}
${params.due_date ? `- **Due Date**: ${formatDate(item.dueDate ? new Date(item.dueDate * 1000).toISOString() : null)}` : ''}

Item successfully added to Inbox.`;

      return {
        content: [{
          type: "text",
          text: result
        }]
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        content: [{
          type: "text",
          text: `Error: Failed to connect to DirectGTD API. Make sure the app is running. Details: ${errorMessage}`
        }],
        isError: true
      };
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
    try {
      // Build request body for API
      const body: Record<string, unknown> = {
        title: params.title,
        parentId: params.parent_id,
        itemType: (params.item_type || "Task").toLowerCase()
      };

      // Use HTTP API to create item
      const response = await fetch("http://localhost:9876/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });

      const data = await response.json() as { item?: { id: string; title?: string; parentId?: string; sortOrder?: number; createdAt?: number; itemType?: string }; error?: string };

      if (!response.ok) {
        return {
          content: [{
            type: "text",
            text: `Error: ${data.error || 'Failed to create item'}`
          }],
          isError: true
        };
      }

      const item = data.item;
      if (!item) {
        return {
          content: [{
            type: "text",
            text: "Error: No item returned from API"
          }],
          isError: true
        };
      }

      // Get parent name from database for display
      let parentName = params.parent_id;
      let db: Database.Database | null = null;
      try {
        db = openDatabase();
        const parent = db.prepare("SELECT title FROM items WHERE id = ?").get(params.parent_id) as { title: string } | undefined;
        if (parent) parentName = parent.title;
      } catch { /* ignore */ }
      finally { if (db) try { db.close(); } catch { /* ignore */ } }

      // If due_date or earliest_start_time provided, update via PUT (API POST doesn't support these)
      if (params.due_date || params.earliest_start_time) {
        const updateBody: Record<string, unknown> = {};
        if (params.due_date) {
          updateBody.dueDate = Math.floor(new Date(params.due_date).getTime() / 1000);
        }
        if (params.earliest_start_time) {
          updateBody.earliestStartTime = Math.floor(new Date(params.earliest_start_time).getTime() / 1000);
        }
        await fetch(`http://localhost:9876/items/${item.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updateBody)
        });
      }

      const result = `# Item Created

**${item.title}**

- **ID**: ${item.id}
- **Type**: ${params.item_type || "Task"}
- **Parent**: ${params.parent_id} (${parentName})
- **Sort Order**: ${item.sortOrder}
- **Created**: ${item.createdAt ? formatDate(new Date(item.createdAt * 1000).toISOString()) : 'Now'}
${params.due_date ? `- **Due Date**: ${formatDate(params.due_date)}` : ''}
${params.earliest_start_time ? `- **Earliest Start**: ${formatDate(params.earliest_start_time)}` : ''}

Item successfully created in "${parentName}".`;

      return {
        content: [{
          type: "text",
          text: result
        }]
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        content: [{
          type: "text",
          text: `Error: Failed to connect to DirectGTD API. Make sure the app is running. Details: ${errorMessage}`
        }],
        isError: true
      };
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
    try {
      // Build request body
      const requestBody: {
        title: string;
        itemType?: string;
        dueDate?: string;
        earliestStartTime?: string;
      } = {
        title: params.title
      };

      if (params.item_type) {
        requestBody.itemType = params.item_type;
      }
      if (params.due_date) {
        requestBody.dueDate = params.due_date;
      }
      if (params.earliest_start_time) {
        requestBody.earliestStartTime = params.earliest_start_time;
      }

      // Use HTTP API
      const response = await fetch("http://localhost:9876/root-items", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorData = await response.json() as { error?: string };
        return {
          content: [{
            type: "text",
            text: `Error: Failed to create root item. ${errorData.error || response.statusText}`
          }],
          isError: true
        };
      }

      const data = await response.json() as {
        item: {
          id: string;
          title: string;
          itemType: string;
          sortOrder: number;
          createdAt: number;
          dueDate: number | null;
          earliestStartTime: number | null;
        };
      };

      const item = data.item;
      const createdAt = item.createdAt ? new Date(item.createdAt * 1000).toISOString() : null;
      const dueDate = item.dueDate ? new Date(item.dueDate * 1000).toISOString() : null;
      const earliestStart = item.earliestStartTime ? new Date(item.earliestStartTime * 1000).toISOString() : null;

      const result = `# Root Item Created

**${item.title}**

- **ID**: ${item.id}
- **Type**: ${item.itemType}
- **Sort Order**: ${item.sortOrder}
- **Created**: ${createdAt ? formatDate(createdAt) : 'N/A'}
${dueDate ? `- **Due Date**: ${formatDate(dueDate)}` : ''}
${earliestStart ? `- **Earliest Start**: ${formatDate(earliestStart)}` : ''}

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
          text: `Error: Could not connect to DirectGTD API. ${error instanceof Error ? error.message : String(error)}`
        }],
        isError: true
      };
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
    try {
      const shouldComplete = params.completed ?? true;

      // First get current item state via API
      const getResponse = await fetch(`http://localhost:9876/items/${params.task_id}`);
      if (!getResponse.ok) {
        const errorData = await getResponse.json() as { error?: string };
        return {
          content: [{
            type: "text",
            text: `Error: ${errorData.error || 'Item not found'}`
          }],
          isError: true
        };
      }

      const getData = await getResponse.json() as { item: { id: string; title?: string; itemType?: string; completedAt?: number | null; modifiedAt?: number } };
      const currentItem = getData.item;

      // Validate that the item is a Task
      if (currentItem.itemType !== "Task") {
        return {
          content: [{
            type: "text",
            text: `Error: Cannot complete item of type '${currentItem.itemType}'. Only Tasks can be marked as completed. This item is a ${currentItem.itemType}.`
          }],
          isError: true
        };
      }

      // Check if we need to toggle (API toggles, so only call if state differs)
      const isCurrentlyCompleted = currentItem.completedAt != null;
      if (isCurrentlyCompleted !== shouldComplete) {
        // Toggle completion via API
        const toggleResponse = await fetch(`http://localhost:9876/items/${params.task_id}/complete`, {
          method: "POST"
        });

        if (!toggleResponse.ok) {
          const errorData = await toggleResponse.json() as { error?: string };
          return {
            content: [{
              type: "text",
              text: `Error: ${errorData.error || 'Failed to update completion status'}`
            }],
            isError: true
          };
        }
      }

      // Get updated item
      const finalResponse = await fetch(`http://localhost:9876/items/${params.task_id}`);
      const finalData = await finalResponse.json() as { item: { id: string; title?: string; completedAt?: number | null; modifiedAt?: number } };
      const finalItem = finalData.item;

      const statusText = shouldComplete ? "completed" : "uncompleted";
      const result = `# Task ${shouldComplete ? "Completed" : "Uncompleted"}

**${finalItem.title}**

- **ID**: ${finalItem.id}
- **Type**: Task
- **Status**: ${shouldComplete ? "✓ Completed" : "○ Not Completed"}
- **Modified**: ${finalItem.modifiedAt ? formatDate(new Date(finalItem.modifiedAt * 1000).toISOString()) : 'Now'}
${finalItem.completedAt ? `- **Completed At**: ${formatDate(new Date(finalItem.completedAt * 1000).toISOString())}` : ''}

Task successfully marked as ${statusText}.`;

      return {
        content: [{
          type: "text",
          text: result
        }]
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        content: [{
          type: "text",
          text: `Error: Failed to connect to DirectGTD API. Make sure the app is running. Details: ${errorMessage}`
        }],
        isError: true
      };
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
    try {
      const responseFormat = params.response_format ?? ResponseFormat.MARKDOWN;

      // Use HTTP API to get item
      const response = await fetch(`http://localhost:9876/items/${params.item_id}`);

      if (!response.ok) {
        if (response.status === 404) {
          return {
            content: [{
              type: "text",
              text: `Error: No item found with ID: ${params.item_id}`
            }],
            isError: true
          };
        }
        const errorText = await response.text();
        return {
          content: [{
            type: "text",
            text: `Error: API request failed (${response.status}): ${errorText}`
          }],
          isError: true
        };
      }

      const data = await response.json() as { item: {
        id: string;
        title?: string;
        parentId?: string | null;
        sortOrder?: number;
        createdAt?: number;
        modifiedAt?: number;
        completedAt?: number | null;
        dueDate?: number | null;
        earliestStartTime?: number | null;
        itemType?: string;
        notes?: string | null;
      } };
      const item = data.item;

      // Convert API response to FormattedItem format
      const formattedItem: FormattedItem = {
        id: item.id,
        title: item.title || "",
        parentId: item.parentId || null,
        sortOrder: item.sortOrder || 0,
        createdAt: item.createdAt ? new Date(item.createdAt * 1000).toISOString() : "",
        modifiedAt: item.modifiedAt ? new Date(item.modifiedAt * 1000).toISOString() : "",
        completedAt: item.completedAt ? new Date(item.completedAt * 1000).toISOString() : null,
        dueDate: item.dueDate ? new Date(item.dueDate * 1000).toISOString() : null,
        earliestStartTime: item.earliestStartTime ? new Date(item.earliestStartTime * 1000).toISOString() : null,
        notes: item.notes || null
      };

      let result: string;
      if (responseFormat === ResponseFormat.MARKDOWN) {
        result = `# ${formattedItem.title}

- **ID**: ${formattedItem.id}
- **Type**: ${item.itemType || "Unknown"}
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
          item_type: item.itemType
        }, null, 2);
      }

      return {
        content: [{
          type: "text",
          text: result
        }]
      };

    } catch (error) {
      // Check if it's a connection error (API not running)
      if (error instanceof Error && error.message.includes('fetch')) {
        return {
          content: [{
            type: "text",
            text: "Error: Cannot connect to DirectGTD API. Make sure the DirectGTD app is running."
          }],
          isError: true
        };
      }
      return {
        content: [{
          type: "text",
          text: handleDatabaseError(error)
        }],
        isError: true
      };
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
    try {
      // Use HTTP API to delete item (proper soft-delete via app)
      const response = await fetch(`http://localhost:9876/items/${params.item_id}`, {
        method: 'DELETE'
      });

      const data = await response.json() as { deleted?: boolean; id?: string; error?: string; item?: { title?: string; id?: string; itemType?: string } };

      if (!response.ok) {
        return {
          content: [{
            type: "text",
            text: `Error: ${data.error || 'Failed to delete item'}`
          }],
          isError: true
        };
      }

      // Get item details from database for confirmation message
      let db: Database.Database | null = null;
      let itemTitle = params.item_id;
      let itemType = "Item";

      try {
        db = openDatabase();
        const item = db.prepare("SELECT title, item_type FROM items WHERE id = ?").get(params.item_id) as { title: string; item_type: string } | undefined;
        if (item) {
          itemTitle = item.title;
          itemType = item.item_type;
        }
      } catch {
        // Ignore - use defaults
      } finally {
        if (db) {
          try { db.close(); } catch { /* ignore */ }
        }
      }

      const result = `# Item Deleted

**${itemTitle}**

- **ID**: ${params.item_id}
- **Type**: ${itemType}

Item moved to Trash.`;

      return {
        content: [{
          type: "text",
          text: result
        }]
      };

    } catch (error) {
      // If API is not available, return error
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        content: [{
          type: "text",
          text: `Error: Failed to connect to DirectGTD API. Make sure the app is running. Details: ${errorMessage}`
        }],
        isError: true
      };
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
    try {
      // First get item info via API to get old parent
      const getItemResponse = await fetch(`http://localhost:9876/items/${params.item_id}`);
      if (!getItemResponse.ok) {
        if (getItemResponse.status === 404) {
          return {
            content: [{
              type: "text",
              text: `Error: No item found with ID: ${params.item_id}`
            }],
            isError: true
          };
        }
        const errorText = await getItemResponse.text();
        return {
          content: [{
            type: "text",
            text: `Error: API request failed (${getItemResponse.status}): ${errorText}`
          }],
          isError: true
        };
      }

      const itemData = await getItemResponse.json() as { item: {
        id: string;
        title?: string;
        parentId?: string | null;
        itemType?: string;
      } };
      const item = itemData.item;
      const oldParentId = item.parentId;

      // Verify new parent exists
      const getParentResponse = await fetch(`http://localhost:9876/items/${params.new_parent_id}`);
      if (!getParentResponse.ok) {
        if (getParentResponse.status === 404) {
          return {
            content: [{
              type: "text",
              text: `Error: No parent found with ID: ${params.new_parent_id}`
            }],
            isError: true
          };
        }
        const errorText = await getParentResponse.text();
        return {
          content: [{
            type: "text",
            text: `Error: API request failed (${getParentResponse.status}): ${errorText}`
          }],
          isError: true
        };
      }

      const parentData = await getParentResponse.json() as { item: { title?: string } };
      const newParent = parentData.item;

      // Use HTTP API to move item
      const response = await fetch(`http://localhost:9876/items/${params.item_id}/move`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetId: params.new_parent_id })
      });

      if (!response.ok) {
        const errorText = await response.text();
        return {
          content: [{
            type: "text",
            text: `Error: Failed to move item (${response.status}): ${errorText}`
          }],
          isError: true
        };
      }

      const result = `# Item Moved

**${item.title || "Untitled"}**

- **ID**: ${item.id}
- **Type**: ${item.itemType || "Unknown"}
- **Old Parent**: ${oldParentId || "None (was root)"}
- **New Parent**: ${params.new_parent_id} (${newParent.title || "Untitled"})

Item successfully moved to "${newParent.title || "Untitled"}".`;

      return {
        content: [{
          type: "text",
          text: result
        }]
      };

    } catch (error) {
      // Check if it's a connection error (API not running)
      if (error instanceof Error && error.message.includes('fetch')) {
        return {
          content: [{
            type: "text",
            text: "Error: Cannot connect to DirectGTD API. Make sure the DirectGTD app is running."
          }],
          isError: true
        };
      }
      return {
        content: [{
          type: "text",
          text: handleDatabaseError(error)
        }],
        isError: true
      };
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
    try {
      // Use HTTP API
      const response = await fetch(`http://localhost:9876/items/${params.item_id}/archive`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        }
      });

      if (!response.ok) {
        const errorData = await response.json() as { error?: string };
        return {
          content: [{
            type: "text",
            text: `Error: Failed to archive item. ${errorData.error || response.statusText}`
          }],
          isError: true
        };
      }

      const data = await response.json() as {
        item: { id: string; title: string; itemType: string };
        fromFolder: string;
        toFolder: string;
        archivedAt: number;
      };

      const archivedAt = data.archivedAt ? new Date(data.archivedAt * 1000).toISOString() : new Date().toISOString();

      const result = `# Item Archived

**${data.item.title}**

- **ID**: ${data.item.id}
- **Type**: ${data.item.itemType}
- **From**: ${data.fromFolder}
- **To**: ${data.toFolder}
- **Archived**: ${formatDate(archivedAt)}

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
          text: `Error: Could not connect to DirectGTD API. ${error instanceof Error ? error.message : String(error)}`
        }],
        isError: true
      };
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
    try {
      // First get item info via API to get old title
      const getResponse = await fetch(`http://localhost:9876/items/${params.item_id}`);
      if (!getResponse.ok) {
        if (getResponse.status === 404) {
          return {
            content: [{
              type: "text",
              text: `Error: No item found with ID: ${params.item_id}`
            }],
            isError: true
          };
        }
        const errorText = await getResponse.text();
        return {
          content: [{
            type: "text",
            text: `Error: API request failed (${getResponse.status}): ${errorText}`
          }],
          isError: true
        };
      }

      const itemData = await getResponse.json() as { item: {
        id: string;
        title?: string;
        itemType?: string;
      } };
      const oldTitle = itemData.item.title;

      // Use HTTP API to update title
      const response = await fetch(`http://localhost:9876/items/${params.item_id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: params.new_title })
      });

      if (!response.ok) {
        const errorText = await response.text();
        return {
          content: [{
            type: "text",
            text: `Error: Failed to update title (${response.status}): ${errorText}`
          }],
          isError: true
        };
      }

      const data = await response.json() as { item: { modifiedAt?: number; itemType?: string } };

      const result = `# Title Updated

- **ID**: ${params.item_id}
- **Type**: ${data.item.itemType || itemData.item.itemType || "Unknown"}
- **Old Title**: ${oldTitle || "Untitled"}
- **New Title**: ${params.new_title}
- **Modified**: ${data.item.modifiedAt ? formatDate(new Date(data.item.modifiedAt * 1000).toISOString()) : "Unknown"}

Title successfully updated.`;

      return {
        content: [{
          type: "text",
          text: result
        }]
      };

    } catch (error) {
      // Check if it's a connection error (API not running)
      if (error instanceof Error && error.message.includes('fetch')) {
        return {
          content: [{
            type: "text",
            text: "Error: Cannot connect to DirectGTD API. Make sure the DirectGTD app is running."
          }],
          isError: true
        };
      }
      return {
        content: [{
          type: "text",
          text: handleDatabaseError(error)
        }],
        isError: true
      };
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
    try {
      // First get item info via API to get old due date
      const getResponse = await fetch(`http://localhost:9876/items/${params.item_id}`);
      if (!getResponse.ok) {
        if (getResponse.status === 404) {
          return {
            content: [{
              type: "text",
              text: `Error: No item found with ID: ${params.item_id}`
            }],
            isError: true
          };
        }
        const errorText = await getResponse.text();
        return {
          content: [{
            type: "text",
            text: `Error: API request failed (${getResponse.status}): ${errorText}`
          }],
          isError: true
        };
      }

      const itemData = await getResponse.json() as { item: {
        id: string;
        title?: string;
        itemType?: string;
        dueDate?: number | null;
      } };
      const oldDueDate = itemData.item.dueDate;

      // Convert ISO date to Unix timestamp for API
      let newDueDateTimestamp: number | null = null;
      if (params.due_date && params.due_date !== null) {
        newDueDateTimestamp = Math.floor(new Date(params.due_date).getTime() / 1000);
      }

      // Use HTTP API to update due date
      const response = await fetch(`http://localhost:9876/items/${params.item_id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dueDate: newDueDateTimestamp })
      });

      if (!response.ok) {
        const errorText = await response.text();
        return {
          content: [{
            type: "text",
            text: `Error: Failed to update due date (${response.status}): ${errorText}`
          }],
          isError: true
        };
      }

      const data = await response.json() as { item: { modifiedAt?: number } };

      const oldDueDateStr = oldDueDate ? formatDate(new Date(oldDueDate * 1000).toISOString()) : "None";
      const newDueDateStr = newDueDateTimestamp ? formatDate(new Date(newDueDateTimestamp * 1000).toISOString()) : "None";

      const result = `# Due Date Updated

**${itemData.item.title || "Untitled"}**

- **ID**: ${params.item_id}
- **Type**: ${itemData.item.itemType || "Unknown"}
- **Old Due Date**: ${oldDueDateStr}
- **New Due Date**: ${newDueDateStr}
- **Modified**: ${data.item.modifiedAt ? formatDate(new Date(data.item.modifiedAt * 1000).toISOString()) : "Unknown"}

Due date successfully updated.`;

      return {
        content: [{
          type: "text",
          text: result
        }]
      };

    } catch (error) {
      // Check if it's a connection error (API not running)
      if (error instanceof Error && error.message.includes('fetch')) {
        return {
          content: [{
            type: "text",
            text: "Error: Cannot connect to DirectGTD API. Make sure the DirectGTD app is running."
          }],
          isError: true
        };
      }
      return {
        content: [{
          type: "text",
          text: handleDatabaseError(error)
        }],
        isError: true
      };
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
    try {
      // First get item info via API to get old start time
      const getResponse = await fetch(`http://localhost:9876/items/${params.item_id}`);
      if (!getResponse.ok) {
        if (getResponse.status === 404) {
          return {
            content: [{
              type: "text",
              text: `Error: No item found with ID: ${params.item_id}`
            }],
            isError: true
          };
        }
        const errorText = await getResponse.text();
        return {
          content: [{
            type: "text",
            text: `Error: API request failed (${getResponse.status}): ${errorText}`
          }],
          isError: true
        };
      }

      const itemData = await getResponse.json() as { item: {
        id: string;
        title?: string;
        itemType?: string;
        earliestStartTime?: number | null;
      } };
      const oldStartTime = itemData.item.earliestStartTime;

      // Convert ISO date to Unix timestamp for API
      let newStartTimeTimestamp: number | null = null;
      if (params.earliest_start_time && params.earliest_start_time !== null) {
        newStartTimeTimestamp = Math.floor(new Date(params.earliest_start_time).getTime() / 1000);
      }

      // Use HTTP API to update earliest start time
      const response = await fetch(`http://localhost:9876/items/${params.item_id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ earliestStartTime: newStartTimeTimestamp })
      });

      if (!response.ok) {
        const errorText = await response.text();
        return {
          content: [{
            type: "text",
            text: `Error: Failed to update earliest start time (${response.status}): ${errorText}`
          }],
          isError: true
        };
      }

      const data = await response.json() as { item: { modifiedAt?: number } };

      const oldStartTimeStr = oldStartTime ? formatDate(new Date(oldStartTime * 1000).toISOString()) : "None";
      const newStartTimeStr = newStartTimeTimestamp ? formatDate(new Date(newStartTimeTimestamp * 1000).toISOString()) : "None";

      const result = `# Earliest Start Time Updated

**${itemData.item.title || "Untitled"}**

- **ID**: ${params.item_id}
- **Type**: ${itemData.item.itemType || "Unknown"}
- **Old Start Time**: ${oldStartTimeStr}
- **New Start Time**: ${newStartTimeStr}
- **Modified**: ${data.item.modifiedAt ? formatDate(new Date(data.item.modifiedAt * 1000).toISOString()) : "Unknown"}

Earliest start time successfully updated.`;

      return {
        content: [{
          type: "text",
          text: result
        }]
      };

    } catch (error) {
      // Check if it's a connection error (API not running)
      if (error instanceof Error && error.message.includes('fetch')) {
        return {
          content: [{
            type: "text",
            text: "Error: Cannot connect to DirectGTD API. Make sure the DirectGTD app is running."
          }],
          isError: true
        };
      }
      return {
        content: [{
          type: "text",
          text: handleDatabaseError(error)
        }],
        isError: true
      };
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
    try {
      const responseFormat = params.response_format ?? ResponseFormat.MARKDOWN;

      // Use HTTP API to get all tags
      const response = await fetch("http://localhost:9876/tags");

      if (!response.ok) {
        const errorText = await response.text();
        return {
          content: [{
            type: "text",
            text: `Error: API request failed (${response.status}): ${errorText}`
          }],
          isError: true
        };
      }

      const data = await response.json() as { tags: Array<{
        id: string;
        name?: string;
        color?: string;
      }> };
      const tags = data.tags;

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
            lines.push(`## ${tag.name || "Unnamed"}${colorIndicator}`);
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
      // Check if it's a connection error (API not running)
      if (error instanceof Error && error.message.includes('fetch')) {
        return {
          content: [{
            type: "text",
            text: "Error: Cannot connect to DirectGTD API. Make sure the DirectGTD app is running."
          }],
          isError: true
        };
      }
      return {
        content: [{
          type: "text",
          text: handleDatabaseError(error)
        }],
        isError: true
      };
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
    try {
      // Get item info via API
      const itemResponse = await fetch(`http://localhost:9876/items/${params.item_id}`);
      if (!itemResponse.ok) {
        if (itemResponse.status === 404) {
          return {
            content: [{
              type: "text",
              text: `Error: No item found with ID: ${params.item_id}`
            }],
            isError: true
          };
        }
        const errorText = await itemResponse.text();
        return {
          content: [{
            type: "text",
            text: `Error: API request failed (${itemResponse.status}): ${errorText}`
          }],
          isError: true
        };
      }
      const itemData = await itemResponse.json() as { item: { title?: string } };

      // Use HTTP API to add tag to item
      const response = await fetch(`http://localhost:9876/items/${params.item_id}/tags`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tagId: params.tag_id })
      });

      if (!response.ok) {
        if (response.status === 404) {
          return {
            content: [{
              type: "text",
              text: `Error: No tag found with ID: ${params.tag_id}`
            }],
            isError: true
          };
        }
        const errorText = await response.text();
        return {
          content: [{
            type: "text",
            text: `Error: Failed to add tag (${response.status}): ${errorText}`
          }],
          isError: true
        };
      }

      const data = await response.json() as { tag?: { name?: string; color?: string }; alreadyTagged?: boolean };

      if (data.alreadyTagged) {
        return {
          content: [{
            type: "text",
            text: `# Tag Already Applied

**${itemData.item.title || "Untitled"}** already has tag **${data.tag?.name || "Unknown"}**

No changes made.`
          }]
        };
      }

      const result = `# Tag Added

**${itemData.item.title || "Untitled"}**

Added tag: **${data.tag?.name || "Unknown"}** ${data.tag?.color ? `● ${data.tag.color}` : ''}

- **Item ID**: ${params.item_id}
- **Tag ID**: ${params.tag_id}

Tag successfully applied.`;

      return {
        content: [{
          type: "text",
          text: result
        }]
      };

    } catch (error) {
      // Check if it's a connection error (API not running)
      if (error instanceof Error && error.message.includes('fetch')) {
        return {
          content: [{
            type: "text",
            text: "Error: Cannot connect to DirectGTD API. Make sure the DirectGTD app is running."
          }],
          isError: true
        };
      }
      return {
        content: [{
          type: "text",
          text: handleDatabaseError(error)
        }],
        isError: true
      };
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
    try {
      // Get item info via API
      const itemResponse = await fetch(`http://localhost:9876/items/${params.item_id}`);
      if (!itemResponse.ok) {
        if (itemResponse.status === 404) {
          return {
            content: [{
              type: "text",
              text: `Error: No item found with ID: ${params.item_id}`
            }],
            isError: true
          };
        }
        const errorText = await itemResponse.text();
        return {
          content: [{
            type: "text",
            text: `Error: API request failed (${itemResponse.status}): ${errorText}`
          }],
          isError: true
        };
      }
      const itemData = await itemResponse.json() as { item: { title?: string } };

      // Use HTTP API to remove tag from item
      const response = await fetch(`http://localhost:9876/items/${params.item_id}/tags/${params.tag_id}`, {
        method: "DELETE"
      });

      if (!response.ok) {
        if (response.status === 404) {
          return {
            content: [{
              type: "text",
              text: `Error: Tag not found or not applied to this item`
            }],
            isError: true
          };
        }
        const errorText = await response.text();
        return {
          content: [{
            type: "text",
            text: `Error: Failed to remove tag (${response.status}): ${errorText}`
          }],
          isError: true
        };
      }

      const result = `# Tag Removed

**${itemData.item.title || "Untitled"}**

- **Item ID**: ${params.item_id}
- **Tag ID**: ${params.tag_id}

Tag successfully removed.`;

      return {
        content: [{
          type: "text",
          text: result
        }]
      };

    } catch (error) {
      // Check if it's a connection error (API not running)
      if (error instanceof Error && error.message.includes('fetch')) {
        return {
          content: [{
            type: "text",
            text: "Error: Cannot connect to DirectGTD API. Make sure the DirectGTD app is running."
          }],
          isError: true
        };
      }
      return {
        content: [{
          type: "text",
          text: handleDatabaseError(error)
        }],
        isError: true
      };
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
    try {
      const responseFormat = params.response_format ?? ResponseFormat.MARKDOWN;

      // Get item info via API
      const itemResponse = await fetch(`http://localhost:9876/items/${params.item_id}`);
      if (!itemResponse.ok) {
        if (itemResponse.status === 404) {
          return {
            content: [{
              type: "text",
              text: `Error: No item found with ID: ${params.item_id}`
            }],
            isError: true
          };
        }
        const errorText = await itemResponse.text();
        return {
          content: [{
            type: "text",
            text: `Error: API request failed (${itemResponse.status}): ${errorText}`
          }],
          isError: true
        };
      }
      const itemData = await itemResponse.json() as { item: { title?: string } };

      // Use HTTP API to get tags for item
      const response = await fetch(`http://localhost:9876/items/${params.item_id}/tags`);

      if (!response.ok) {
        const errorText = await response.text();
        return {
          content: [{
            type: "text",
            text: `Error: Failed to get tags (${response.status}): ${errorText}`
          }],
          isError: true
        };
      }

      const data = await response.json() as { tags: Array<{
        id: string;
        name?: string;
        color?: string;
      }> };
      const tags = data.tags;

      let result: string;
      if (responseFormat === ResponseFormat.MARKDOWN) {
        if (tags.length === 0) {
          result = `# Tags for "${itemData.item.title || "Untitled"}"

No tags applied to this item.`;
        } else {
          const lines: string[] = [
            `# Tags for "${itemData.item.title || "Untitled"}"`,
            "",
            `Item has ${tags.length} tag${tags.length === 1 ? '' : 's'}:`,
            ""
          ];

          for (const tag of tags) {
            const colorIndicator = tag.color ? ` ● ${tag.color}` : "";
            lines.push(`- **${tag.name || "Unnamed"}**${colorIndicator}`);
          }

          result = lines.join("\n");
        }
      } else {
        result = JSON.stringify({
          item_id: params.item_id,
          item_title: itemData.item.title,
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
      // Check if it's a connection error (API not running)
      if (error instanceof Error && error.message.includes('fetch')) {
        return {
          content: [{
            type: "text",
            text: "Error: Cannot connect to DirectGTD API. Make sure the DirectGTD app is running."
          }],
          isError: true
        };
      }
      return {
        content: [{
          type: "text",
          text: handleDatabaseError(error)
        }],
        isError: true
      };
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
    try {
      const responseFormat = params.response_format ?? ResponseFormat.MARKDOWN;
      const includeCompleted = params.include_completed ?? false;
      const includeArchive = params.include_archive ?? false;

      // Build query params
      const queryParams = new URLSearchParams();
      if (includeCompleted) queryParams.append("includeCompleted", "true");
      if (includeArchive) queryParams.append("includeArchive", "true");

      // Use HTTP API to get overdue items
      const url = `http://localhost:9876/items/overdue${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
      const response = await fetch(url);

      if (!response.ok) {
        const errorData = await response.json() as { error?: string };
        return {
          content: [{
            type: "text",
            text: `Error: Failed to get overdue items. ${errorData.error || response.statusText}`
          }],
          isError: true
        };
      }

      const data = await response.json() as { items: Array<{ id: string; title?: string; dueDate?: number | null; completedAt?: number | null; itemType?: string; parentId?: string | null; sortOrder?: number; createdAt?: number; modifiedAt?: number; earliestStartTime?: number | null }> };
      const items = data.items || [];

      // Format items for display
      const formattedItems = items.map(item => ({
        id: item.id,
        title: item.title || "Untitled",
        dueDate: item.dueDate ? new Date(item.dueDate * 1000).toISOString() : null,
        completedAt: item.completedAt ? new Date(item.completedAt * 1000).toISOString() : null,
        itemType: item.itemType,
        parentId: item.parentId,
        sortOrder: item.sortOrder,
        createdAt: item.createdAt ? new Date(item.createdAt * 1000).toISOString() : null,
        modifiedAt: item.modifiedAt ? new Date(item.modifiedAt * 1000).toISOString() : null
      }));

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
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        content: [{
          type: "text",
          text: `Error: Failed to connect to DirectGTD API. Make sure the app is running. Details: ${errorMessage}`
        }],
        isError: true
      };
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
    try {
      const responseFormat = params.response_format ?? ResponseFormat.MARKDOWN;
      const includeCompleted = params.include_completed ?? false;
      const includeArchive = params.include_archive ?? false;

      // Build query params
      const queryParams = new URLSearchParams();
      if (includeCompleted) queryParams.append("includeCompleted", "true");
      if (includeArchive) queryParams.append("includeArchive", "true");

      // Use HTTP API to get items due today
      const url = `http://localhost:9876/items/due-today${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
      const response = await fetch(url);

      if (!response.ok) {
        const errorData = await response.json() as { error?: string };
        return {
          content: [{
            type: "text",
            text: `Error: Failed to get items due today. ${errorData.error || response.statusText}`
          }],
          isError: true
        };
      }

      const data = await response.json() as { items: Array<{ id: string; title?: string; dueDate?: number | null; completedAt?: number | null; itemType?: string; parentId?: string | null; sortOrder?: number; createdAt?: number; modifiedAt?: number }> };
      const items = data.items || [];

      // Format items for display
      const formattedItems = items.map(item => ({
        id: item.id,
        title: item.title || "Untitled",
        dueDate: item.dueDate ? new Date(item.dueDate * 1000).toISOString() : null,
        completedAt: item.completedAt ? new Date(item.completedAt * 1000).toISOString() : null,
        itemType: item.itemType,
        parentId: item.parentId,
        sortOrder: item.sortOrder,
        createdAt: item.createdAt ? new Date(item.createdAt * 1000).toISOString() : null,
        modifiedAt: item.modifiedAt ? new Date(item.modifiedAt * 1000).toISOString() : null
      }));

      const now = new Date();
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
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        content: [{
          type: "text",
          text: `Error: Failed to connect to DirectGTD API. Make sure the app is running. Details: ${errorMessage}`
        }],
        isError: true
      };
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
    try {
      const responseFormat = params.response_format ?? ResponseFormat.MARKDOWN;
      const includeCompleted = params.include_completed ?? false;
      const includeArchive = params.include_archive ?? false;

      // Build query params
      const queryParams = new URLSearchParams();
      if (includeCompleted) queryParams.append("includeCompleted", "true");
      if (includeArchive) queryParams.append("includeArchive", "true");

      // Use HTTP API to get items due tomorrow
      const url = `http://localhost:9876/items/due-tomorrow${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
      const response = await fetch(url);

      if (!response.ok) {
        const errorData = await response.json() as { error?: string };
        return {
          content: [{
            type: "text",
            text: `Error: Failed to get items due tomorrow. ${errorData.error || response.statusText}`
          }],
          isError: true
        };
      }

      const data = await response.json() as { items: Array<{ id: string; title?: string; dueDate?: number | null; completedAt?: number | null; itemType?: string; parentId?: string | null; sortOrder?: number; createdAt?: number; modifiedAt?: number }> };
      const items = data.items || [];

      // Format items for display
      const formattedItems = items.map(item => ({
        id: item.id,
        title: item.title || "Untitled",
        dueDate: item.dueDate ? new Date(item.dueDate * 1000).toISOString() : null,
        completedAt: item.completedAt ? new Date(item.completedAt * 1000).toISOString() : null,
        itemType: item.itemType,
        parentId: item.parentId,
        sortOrder: item.sortOrder,
        createdAt: item.createdAt ? new Date(item.createdAt * 1000).toISOString() : null,
        modifiedAt: item.modifiedAt ? new Date(item.modifiedAt * 1000).toISOString() : null
      }));

      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

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
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        content: [{
          type: "text",
          text: `Error: Failed to connect to DirectGTD API. Make sure the app is running. Details: ${errorMessage}`
        }],
        isError: true
      };
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
    try {
      const responseFormat = params.response_format ?? ResponseFormat.MARKDOWN;
      const includeCompleted = params.include_completed ?? false;
      const includeArchive = params.include_archive ?? false;

      // Build query params
      const queryParams = new URLSearchParams();
      if (includeCompleted) queryParams.append("includeCompleted", "true");
      if (includeArchive) queryParams.append("includeArchive", "true");

      // Use HTTP API to get items due this week
      const url = `http://localhost:9876/items/due-this-week${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
      const response = await fetch(url);

      if (!response.ok) {
        const errorData = await response.json() as { error?: string };
        return {
          content: [{
            type: "text",
            text: `Error: Failed to get items due this week. ${errorData.error || response.statusText}`
          }],
          isError: true
        };
      }

      const data = await response.json() as { items: Array<{ id: string; title?: string; dueDate?: number | null; completedAt?: number | null; itemType?: string; parentId?: string | null; sortOrder?: number; createdAt?: number; modifiedAt?: number }> };
      const items = data.items || [];

      // Format items for display
      const formattedItems = items.map(item => ({
        id: item.id,
        title: item.title || "Untitled",
        dueDate: item.dueDate ? new Date(item.dueDate * 1000).toISOString() : null,
        completedAt: item.completedAt ? new Date(item.completedAt * 1000).toISOString() : null,
        itemType: item.itemType,
        parentId: item.parentId,
        sortOrder: item.sortOrder,
        createdAt: item.createdAt ? new Date(item.createdAt * 1000).toISOString() : null,
        modifiedAt: item.modifiedAt ? new Date(item.modifiedAt * 1000).toISOString() : null
      }));

      // Calculate week bounds for display
      const now = new Date();
      const startOfWeek = getStartOfWeek(now);
      const endOfWeek = getEndOfWeek(now);

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
          const itemsByDay: { [key: string]: typeof formattedItems } = {};
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
          week_start: startOfWeek.toISOString().split('T')[0],
          week_end: endOfWeek.toISOString().split('T')[0],
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
          text: `Error: Could not connect to DirectGTD API. Make sure the app is running. ${error instanceof Error ? error.message : String(error)}`
        }],
        isError: true
      };
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
    try {
      // Use HTTP API
      const response = await fetch("http://localhost:9876/items/swap", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          itemId1: params.item_id_1,
          itemId2: params.item_id_2
        })
      });

      if (!response.ok) {
        const errorData = await response.json() as { error?: string };
        return {
          content: [{
            type: "text",
            text: `Error: Failed to swap items. ${errorData.error || response.statusText}`
          }],
          isError: true
        };
      }

      const data = await response.json() as {
        item1: { id: string; title: string; sortOrder: number; parentId: string | null };
        item2: { id: string; title: string; sortOrder: number; parentId: string | null };
      };

      const result = `# Items Swapped

**${data.item1.title}** ↔️ **${data.item2.title}**

- Item 1 new position: ${data.item1.sortOrder}
- Item 2 new position: ${data.item2.sortOrder}
- Parent: ${data.item1.parentId || 'Root'}

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
          text: `Error: Could not connect to DirectGTD API. ${error instanceof Error ? error.message : String(error)}`
        }],
        isError: true
      };
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
    try {
      // Use HTTP API
      const response = await fetch(`http://localhost:9876/items/${params.item_id}/move-to-position`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          position: params.position
        })
      });

      if (!response.ok) {
        const errorData = await response.json() as { error?: string };
        return {
          content: [{
            type: "text",
            text: `Error: Failed to move item. ${errorData.error || response.statusText}`
          }],
          isError: true
        };
      }

      const data = await response.json() as {
        item: { id: string; title: string; parentId: string | null };
        newPosition: number;
        totalSiblings: number;
      };

      const result = `# Item Moved

**${data.item.title}**

- New position: ${data.newPosition} (0-based)
- Total siblings: ${data.totalSiblings}
- Parent: ${data.item.parentId || 'Root'}

Item successfully moved to position ${data.newPosition}.`;

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
          text: `Error: Could not connect to DirectGTD API. ${error instanceof Error ? error.message : String(error)}`
        }],
        isError: true
      };
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
    try {
      // Use HTTP API
      const response = await fetch(`http://localhost:9876/items/${params.parent_id}/reorder-children`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          itemIds: params.item_ids
        })
      });

      if (!response.ok) {
        const errorData = await response.json() as { error?: string };
        return {
          content: [{
            type: "text",
            text: `Error: Failed to reorder children. ${errorData.error || response.statusText}`
          }],
          isError: true
        };
      }

      const data = await response.json() as {
        parentId: string;
        items: Array<{ id: string; title: string; sortOrder: number }>;
      };

      // Format item titles for confirmation
      const itemTitles = data.items.map((item, index) =>
        `${index + 1}. ${item.title}`
      ).join("\n");

      const result = `# Children Reordered

**Parent**: ${params.parent_id === 'root' ? 'Root' : params.parent_id}
**Total items reordered**: ${data.items.length}

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
          text: `Error: Could not connect to DirectGTD API. ${error instanceof Error ? error.message : String(error)}`
        }],
        isError: true
      };
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
    try {
      const responseFormat = params.response_format ?? ResponseFormat.MARKDOWN;
      const includeDeferred = params.include_deferred ?? false;
      const includeArchive = params.include_archive ?? false;
      const parentId = params.parent_id;

      // Build query params
      const queryParams = new URLSearchParams();
      if (parentId) queryParams.append("parentId", parentId);
      if (includeDeferred) queryParams.append("includeDeferred", "true");
      if (includeArchive) queryParams.append("includeArchive", "true");

      // Use HTTP API to get available tasks
      const url = `http://localhost:9876/tasks/available${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
      const response = await fetch(url);

      if (!response.ok) {
        const errorData = await response.json() as { error?: string };
        return {
          content: [{
            type: "text",
            text: `Error: Failed to get available tasks. ${errorData.error || response.statusText}`
          }],
          isError: true
        };
      }

      const data = await response.json() as {
        items: Array<{ id: string; title?: string; dueDate?: number | null; completedAt?: number | null; earliestStartTime?: number | null; itemType?: string; parentId?: string | null; parentTitle?: string | null; sortOrder?: number; createdAt?: number; modifiedAt?: number }>;
        deferredCount?: number;
      };
      const items = data.items || [];
      const deferredCount = data.deferredCount || 0;

      // Format items for display
      const formattedItems = items.map(item => ({
        id: item.id,
        title: item.title || "Untitled",
        dueDate: item.dueDate ? new Date(item.dueDate * 1000).toISOString() : null,
        completedAt: item.completedAt ? new Date(item.completedAt * 1000).toISOString() : null,
        earliestStartTime: item.earliestStartTime ? new Date(item.earliestStartTime * 1000).toISOString() : null,
        itemType: item.itemType,
        parentId: item.parentId,
        parentTitle: item.parentTitle,
        sortOrder: item.sortOrder,
        createdAt: item.createdAt ? new Date(item.createdAt * 1000).toISOString() : null,
        modifiedAt: item.modifiedAt ? new Date(item.modifiedAt * 1000).toISOString() : null
      }));

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
          const itemsByParent: { [key: string]: typeof formattedItems } = {};
          for (const item of formattedItems) {
            const parentKey = item.parentId || 'root';
            if (!itemsByParent[parentKey]) {
              itemsByParent[parentKey] = [];
            }
            itemsByParent[parentKey].push(item);
          }

          // Get parent titles from items (API includes parentTitle)
          const parentTitles: { [key: string]: string } = {};
          for (const item of formattedItems) {
            const parentKey = item.parentId || 'root';
            if (parentKey === 'root') {
              parentTitles[parentKey] = 'Root';
            } else if (item.parentTitle) {
              parentTitles[parentKey] = item.parentTitle;
            } else {
              parentTitles[parentKey] = parentKey;
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
          text: `Error: Could not connect to DirectGTD API. Make sure the app is running. ${error instanceof Error ? error.message : String(error)}`
        }],
        isError: true
      };
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
    try {
      const responseFormat = params.response_format ?? ResponseFormat.MARKDOWN;
      const limit = params.limit ?? 500;
      const query = params.query;
      const itemType = params.item_type;

      // Use HTTP API to search items
      const response = await fetch(`http://localhost:9876/search?q=${encodeURIComponent(query)}`);

      if (!response.ok) {
        const errorText = await response.text();
        return {
          content: [{
            type: "text",
            text: `Error: Search failed (${response.status}): ${errorText}`
          }],
          isError: true
        };
      }

      const data = await response.json() as { items: Array<{
        id: string;
        title?: string;
        itemType?: string;
      }> };

      // Apply client-side filters (item_type, limit)
      let items = data.items;
      if (itemType) {
        items = items.filter(item => item.itemType?.toLowerCase() === itemType.toLowerCase());
      }
      items = items.slice(0, limit);

      // Format results
      const formattedItems = items.map(item => ({
        id: item.id,
        title: item.title || "Untitled"
      }));

      let result: string;
      if (responseFormat === ResponseFormat.MARKDOWN) {
        if (formattedItems.length === 0) {
          result = `# Search Results\n\nNo items found matching "${query}".`;
        } else {
          const lines: string[] = [
            `# Search Results`,
            "",
            `Found ${formattedItems.length} item${formattedItems.length === 1 ? '' : 's'} matching "${query}":`,
            ""
          ];

          for (const item of formattedItems) {
            lines.push(`- **${item.title}** (${item.id})`);
          }

          result = lines.join("\n");
        }
      } else {
        result = JSON.stringify({
          query: query,
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
      // Check if it's a connection error (API not running)
      if (error instanceof Error && error.message.includes('fetch')) {
        return {
          content: [{
            type: "text",
            text: "Error: Cannot connect to DirectGTD API. Make sure the DirectGTD app is running."
          }],
          isError: true
        };
      }
      return {
        content: [{
          type: "text",
          text: handleDatabaseError(error)
        }],
        isError: true
      };
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
    try {
      const responseFormat = params.response_format ?? ResponseFormat.MARKDOWN;
      const parentId = params.parent_id;
      const limit = params.limit ?? 100;
      const since = params.since;
      const includeArchive = params.include_archive ?? false;

      // Build query params
      const queryParams = new URLSearchParams();
      if (parentId) queryParams.append("parentId", parentId);
      if (since) queryParams.append("since", since);
      if (limit) queryParams.append("limit", limit.toString());
      if (includeArchive) queryParams.append("includeArchive", "true");

      // Use HTTP API to get completed tasks
      const url = `http://localhost:9876/tasks/completed${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
      const response = await fetch(url);

      if (!response.ok) {
        const errorData = await response.json() as { error?: string };
        return {
          content: [{
            type: "text",
            text: `Error: Failed to get completed tasks. ${errorData.error || response.statusText}`
          }],
          isError: true
        };
      }

      const data = await response.json() as {
        items: Array<{ id: string; title?: string; dueDate?: number | null; completedAt?: number | null; itemType?: string; parentId?: string | null; sortOrder?: number; createdAt?: number; modifiedAt?: number }>;
      };
      const items = data.items || [];

      // Format items for display
      const formattedItems = items.map(item => ({
        id: item.id,
        title: item.title || "Untitled",
        dueDate: item.dueDate ? new Date(item.dueDate * 1000).toISOString() : null,
        completedAt: item.completedAt ? new Date(item.completedAt * 1000).toISOString() : null,
        itemType: item.itemType,
        parentId: item.parentId,
        sortOrder: item.sortOrder,
        createdAt: item.createdAt ? new Date(item.createdAt * 1000).toISOString() : null,
        modifiedAt: item.modifiedAt ? new Date(item.modifiedAt * 1000).toISOString() : null
      }));

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
          text: `Error: Could not connect to DirectGTD API. Make sure the app is running. ${error instanceof Error ? error.message : String(error)}`
        }],
        isError: true
      };
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
    try {
      // First get item info via API
      const getResponse = await fetch(`http://localhost:9876/items/${params.item_id}`);
      if (!getResponse.ok) {
        if (getResponse.status === 404) {
          return {
            content: [{
              type: "text",
              text: `Error: Item with ID '${params.item_id}' not found.`
            }],
            isError: true
          };
        }
        const errorText = await getResponse.text();
        return {
          content: [{
            type: "text",
            text: `Error: API request failed (${getResponse.status}): ${errorText}`
          }],
          isError: true
        };
      }

      const itemData = await getResponse.json() as { item: {
        id: string;
        title?: string;
      } };

      // Use HTTP API to update notes
      const response = await fetch(`http://localhost:9876/items/${params.item_id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: params.notes || "" })
      });

      if (!response.ok) {
        const errorText = await response.text();
        return {
          content: [{
            type: "text",
            text: `Error: Failed to update notes (${response.status}): ${errorText}`
          }],
          isError: true
        };
      }

      const data = await response.json() as { item: { modifiedAt?: number } };

      const notesPreview = params.notes
        ? (params.notes.length > 100 ? params.notes.substring(0, 100) + "..." : params.notes)
        : "(cleared)";

      const result = `# Notes Updated

**${itemData.item.title || "Untitled"}**

- **ID**: ${params.item_id}
- **Notes**: ${notesPreview}
- **Modified**: ${data.item.modifiedAt ? formatDate(new Date(data.item.modifiedAt * 1000).toISOString()) : "Unknown"}

Notes successfully ${params.notes ? 'updated' : 'cleared'}.`;

      return {
        content: [{
          type: "text",
          text: result
        }]
      };

    } catch (error) {
      // Check if it's a connection error (API not running)
      if (error instanceof Error && error.message.includes('fetch')) {
        return {
          content: [{
            type: "text",
            text: "Error: Cannot connect to DirectGTD API. Make sure the DirectGTD app is running."
          }],
          isError: true
        };
      }
      return {
        content: [{
          type: "text",
          text: handleDatabaseError(error)
        }],
        isError: true
      };
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
    try {
      const responseFormat = params.response_format ?? ResponseFormat.MARKDOWN;
      const parentId = params.parent_id;
      const includeArchive = params.include_archive ?? false;

      // Build query params
      const queryParams = new URLSearchParams();
      if (parentId) queryParams.append("parentId", parentId);
      if (includeArchive) queryParams.append("includeArchive", "true");

      // Use HTTP API to get deferred tasks
      const url = `http://localhost:9876/tasks/deferred${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
      const response = await fetch(url);

      if (!response.ok) {
        const errorData = await response.json() as { error?: string };
        return {
          content: [{
            type: "text",
            text: `Error: Failed to get deferred tasks. ${errorData.error || response.statusText}`
          }],
          isError: true
        };
      }

      const data = await response.json() as {
        items: Array<{ id: string; title?: string; dueDate?: number | null; completedAt?: number | null; earliestStartTime?: number | null; itemType?: string; parentId?: string | null; sortOrder?: number; createdAt?: number; modifiedAt?: number }>;
      };
      const items = data.items || [];

      // Format items for display
      const formattedItems = items.map(item => ({
        id: item.id,
        title: item.title || "Untitled",
        dueDate: item.dueDate ? new Date(item.dueDate * 1000).toISOString() : null,
        completedAt: item.completedAt ? new Date(item.completedAt * 1000).toISOString() : null,
        earliestStartTime: item.earliestStartTime ? new Date(item.earliestStartTime * 1000).toISOString() : null,
        itemType: item.itemType,
        parentId: item.parentId,
        sortOrder: item.sortOrder,
        createdAt: item.createdAt ? new Date(item.createdAt * 1000).toISOString() : null,
        modifiedAt: item.modifiedAt ? new Date(item.modifiedAt * 1000).toISOString() : null
      }));

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
          text: `Error: Could not connect to DirectGTD API. Make sure the app is running. ${error instanceof Error ? error.message : String(error)}`
        }],
        isError: true
      };
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
    try {
      const maxDepth = Math.min(params.max_depth ?? 10, 20);
      const responseFormat = params.response_format ?? ResponseFormat.MARKDOWN;

      // Build query params
      const queryParams = new URLSearchParams();
      if (params.root_id) queryParams.append("rootId", params.root_id);
      if (maxDepth) queryParams.append("maxDepth", maxDepth.toString());

      // Use HTTP API to get node tree
      const url = `http://localhost:9876/node-tree${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
      const response = await fetch(url);

      if (!response.ok) {
        const errorData = await response.json() as { error?: string };
        return {
          content: [{
            type: "text",
            text: `Error: Failed to get node tree. ${errorData.error || response.statusText}`
          }],
          isError: true
        };
      }

      interface TreeNode {
        id: string;
        title: string;
        parentId: string | null;
        children?: TreeNode[];
      }

      const data = await response.json() as {
        rootId?: string | null;
        maxDepth?: number;
        tree: TreeNode[];
      };

      const tree = data.tree || [];

      let result: string;

      if (responseFormat === ResponseFormat.MARKDOWN) {
        const lines: string[] = ["# Node Tree", ""];

        function renderTree(nodes: TreeNode[], indent: string = ""): void {
          for (const node of nodes) {
            lines.push(`${indent}- **${node.title}** \`${node.id}\``);
            if (node.children && node.children.length > 0) {
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
        result = JSON.stringify({
          rootId: params.root_id || null,
          maxDepth: maxDepth,
          tree: tree
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
          text: `Error: Could not connect to DirectGTD API. Make sure the app is running. ${error instanceof Error ? error.message : String(error)}`
        }],
        isError: true
      };
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
    try {
      const includeCompleted = params.include_completed ?? false;
      const includeArchive = params.include_archive ?? false;
      const responseFormat = params.response_format ?? ResponseFormat.MARKDOWN;

      // Build query params
      const queryParams = new URLSearchParams();
      for (const tagName of params.tag_names) {
        queryParams.append("tags", tagName);
      }
      if (includeCompleted) queryParams.append("includeCompleted", "true");
      if (includeArchive) queryParams.append("includeArchive", "true");

      // Use HTTP API to get items by tags
      const url = `http://localhost:9876/items/by-tags${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
      const response = await fetch(url);

      if (!response.ok) {
        const errorData = await response.json() as { error?: string };
        return {
          content: [{
            type: "text",
            text: `Error: Failed to get items by tags. ${errorData.error || response.statusText}`
          }],
          isError: true
        };
      }

      const data = await response.json() as {
        items: Array<{ id: string; title: string; parentId?: string | null; completedAt?: number | null; dueDate?: number | null; itemType?: string }>;
        notFoundTags?: string[];
      };

      if (data.notFoundTags && data.notFoundTags.length > 0) {
        return {
          content: [{
            type: "text",
            text: `Error: Tag(s) not found: ${data.notFoundTags.join(', ')}`
          }],
          isError: true
        };
      }

      const items = data.items || [];

      let result: string;

      if (responseFormat === ResponseFormat.MARKDOWN) {
        const lines: string[] = [
          `# Items with Tags: ${params.tag_names.join(', ')}`,
          "",
          `Found ${items.length} item${items.length === 1 ? '' : 's'}:`,
          ""
        ];

        if (items.length === 0) {
          lines.push("*No items found with all specified tags.*");
        } else {
          for (const item of items) {
            const status = item.completedAt ? "✓" : "○";
            const dueInfo = item.dueDate ? ` (due: ${new Date(item.dueDate * 1000).toLocaleDateString()})` : "";
            lines.push(`- ${status} **${item.title}**${dueInfo} \`${item.id}\``);
          }
        }

        result = lines.join("\n");
      } else {
        result = JSON.stringify({
          tags: params.tag_names,
          total: items.length,
          items: items.map(item => ({
            id: item.id,
            title: item.title,
            parentId: item.parentId,
            itemType: item.itemType,
            completedAt: item.completedAt ? new Date(item.completedAt * 1000).toISOString() : null,
            dueDate: item.dueDate ? new Date(item.dueDate * 1000).toISOString() : null
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
          text: `Error: Could not connect to DirectGTD API. Make sure the app is running. ${error instanceof Error ? error.message : String(error)}`
        }],
        isError: true
      };
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
    try {
      // Get item info via API
      const itemResponse = await fetch(`http://localhost:9876/items/${params.item_id}`);
      if (!itemResponse.ok) {
        if (itemResponse.status === 404) {
          return {
            content: [{
              type: "text",
              text: `Error: Item with ID '${params.item_id}' not found.`
            }],
            isError: true
          };
        }
        const errorText = await itemResponse.text();
        return {
          content: [{
            type: "text",
            text: `Error: API request failed (${itemResponse.status}): ${errorText}`
          }],
          isError: true
        };
      }
      const itemData = await itemResponse.json() as { item: { title?: string } };

      // Use HTTP API to start timer
      const response = await fetch(`http://localhost:9876/items/${params.item_id}/timer/start`, {
        method: "POST"
      });

      if (!response.ok) {
        const errorText = await response.text();
        return {
          content: [{
            type: "text",
            text: `Error: Failed to start timer (${response.status}): ${errorText}`
          }],
          isError: true
        };
      }

      const data = await response.json() as { entry: { id: string; startedAt?: number } };
      const startTime = data.entry.startedAt
        ? new Date(data.entry.startedAt * 1000).toLocaleString('en-US', { timeZone: 'America/New_York' })
        : new Date().toLocaleString('en-US', { timeZone: 'America/New_York' });

      return {
        content: [{
          type: "text",
          text: `# Timer Started\n\n**${itemData.item.title || "Untitled"}**\n\n- **Entry ID**: ${data.entry.id}\n- **Started**: ${startTime} EST\n\nTimer is now running.`
        }]
      };

    } catch (error) {
      // Check if it's a connection error (API not running)
      if (error instanceof Error && error.message.includes('fetch')) {
        return {
          content: [{
            type: "text",
            text: "Error: Cannot connect to DirectGTD API. Make sure the DirectGTD app is running."
          }],
          isError: true
        };
      }
      return {
        content: [{
          type: "text",
          text: handleDatabaseError(error)
        }],
        isError: true
      };
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
    try {
      if (!params.entry_id && !params.item_id) {
        return {
          content: [{
            type: "text",
            text: "Error: Either entry_id or item_id must be provided."
          }],
          isError: true
        };
      }

      // The API uses item_id for stop - if only entry_id provided, we need to find the item
      let itemId = params.item_id;

      if (!itemId && params.entry_id) {
        // We need to get item_id from entry - but API doesn't support this directly
        // For now, return error - entry_id not supported via API
        return {
          content: [{
            type: "text",
            text: "Error: entry_id not supported via API. Please use item_id instead."
          }],
          isError: true
        };
      }

      // Get item info via API
      const itemResponse = await fetch(`http://localhost:9876/items/${itemId}`);
      if (!itemResponse.ok) {
        if (itemResponse.status === 404) {
          return {
            content: [{
              type: "text",
              text: `Error: Item with ID '${itemId}' not found.`
            }],
            isError: true
          };
        }
        const errorText = await itemResponse.text();
        return {
          content: [{
            type: "text",
            text: `Error: API request failed (${itemResponse.status}): ${errorText}`
          }],
          isError: true
        };
      }
      const itemData = await itemResponse.json() as { item: { title?: string } };

      // Use HTTP API to stop timer
      const response = await fetch(`http://localhost:9876/items/${itemId}/timer/stop`, {
        method: "POST"
      });

      if (!response.ok) {
        if (response.status === 400) {
          return {
            content: [{
              type: "text",
              text: "Error: No active timer found."
            }],
            isError: true
          };
        }
        const errorText = await response.text();
        return {
          content: [{
            type: "text",
            text: `Error: Failed to stop timer (${response.status}): ${errorText}`
          }],
          isError: true
        };
      }

      const data = await response.json() as { entry: { id: string; startedAt?: number; endedAt?: number; duration?: number } };
      const entry = data.entry;

      const startTime = entry.startedAt
        ? new Date(entry.startedAt * 1000).toLocaleString('en-US', { timeZone: 'America/New_York' })
        : "Unknown";
      const endTime = entry.endedAt
        ? new Date(entry.endedAt * 1000).toLocaleString('en-US', { timeZone: 'America/New_York' })
        : new Date().toLocaleString('en-US', { timeZone: 'America/New_York' });
      const durationStr = entry.duration ? formatDuration(entry.duration) : "Unknown";

      return {
        content: [{
          type: "text",
          text: `# Timer Stopped\n\n**${itemData.item.title || "Untitled"}**\n\n- **Entry ID**: ${entry.id}\n- **Started**: ${startTime} EST\n- **Ended**: ${endTime} EST\n- **Duration**: ${durationStr}\n\nTimer stopped successfully.`
        }]
      };

    } catch (error) {
      // Check if it's a connection error (API not running)
      if (error instanceof Error && error.message.includes('fetch')) {
        return {
          content: [{
            type: "text",
            text: "Error: Cannot connect to DirectGTD API. Make sure the DirectGTD app is running."
          }],
          isError: true
        };
      }
      return {
        content: [{
          type: "text",
          text: handleDatabaseError(error)
        }],
        isError: true
      };
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
    try {
      const responseFormat = params.response_format ?? ResponseFormat.MARKDOWN;

      // Get item info via API
      const itemResponse = await fetch(`http://localhost:9876/items/${params.item_id}`);
      if (!itemResponse.ok) {
        if (itemResponse.status === 404) {
          return {
            content: [{
              type: "text",
              text: `Error: Item with ID '${params.item_id}' not found.`
            }],
            isError: true
          };
        }
        const errorText = await itemResponse.text();
        return {
          content: [{
            type: "text",
            text: `Error: API request failed (${itemResponse.status}): ${errorText}`
          }],
          isError: true
        };
      }
      const itemData = await itemResponse.json() as { item: { title?: string } };

      // Use HTTP API to get time entries
      const response = await fetch(`http://localhost:9876/items/${params.item_id}/time-entries`);

      if (!response.ok) {
        const errorText = await response.text();
        return {
          content: [{
            type: "text",
            text: `Error: Failed to get time entries (${response.status}): ${errorText}`
          }],
          isError: true
        };
      }

      const data = await response.json() as { entries: Array<{
        id: string;
        startedAt?: number;
        endedAt?: number | null;
        duration?: number | null;
      }>; totalTime?: number };
      const entries = data.entries;

      let result: string;

      if (responseFormat === ResponseFormat.MARKDOWN) {
        const lines: string[] = [
          `# Time Entries for "${itemData.item.title || "Untitled"}"`,
          "",
          `Found ${entries.length} entr${entries.length === 1 ? 'y' : 'ies'}:`,
          ""
        ];

        if (entries.length === 0) {
          lines.push("*No time entries recorded.*");
        } else {
          let totalSeconds = 0;
          for (const entry of entries) {
            const startTime = entry.startedAt
              ? new Date(entry.startedAt * 1000).toLocaleString('en-US', { timeZone: 'America/New_York' })
              : "Unknown";
            const isRunning = entry.endedAt === null || entry.endedAt === undefined;

            if (isRunning) {
              const elapsed = entry.startedAt ? Math.floor(Date.now() / 1000) - entry.startedAt : 0;
              lines.push(`- **🔴 RUNNING** Started: ${startTime} EST (${formatDuration(elapsed)} elapsed) \`${entry.id}\``);
              totalSeconds += elapsed;
            } else {
              const endTime = new Date(entry.endedAt! * 1000).toLocaleString('en-US', { timeZone: 'America/New_York' });
              const duration = entry.duration ?? (entry.endedAt! - (entry.startedAt || 0));
              lines.push(`- ${startTime} → ${endTime} EST (${formatDuration(duration)}) \`${entry.id}\``);
              totalSeconds += duration;
            }
          }
          lines.push("");
          lines.push(`**Total Time**: ${formatDuration(data.totalTime ?? totalSeconds)}`);
        }

        result = lines.join("\n");
      } else {
        result = JSON.stringify({
          itemId: params.item_id,
          itemTitle: itemData.item.title,
          total: entries.length,
          entries: entries.map(entry => ({
            id: entry.id,
            startedAt: entry.startedAt ? new Date(entry.startedAt * 1000).toISOString() : null,
            endedAt: entry.endedAt ? new Date(entry.endedAt * 1000).toISOString() : null,
            duration: entry.duration,
            isRunning: entry.endedAt === null || entry.endedAt === undefined
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
      // Check if it's a connection error (API not running)
      if (error instanceof Error && error.message.includes('fetch')) {
        return {
          content: [{
            type: "text",
            text: "Error: Cannot connect to DirectGTD API. Make sure the DirectGTD app is running."
          }],
          isError: true
        };
      }
      return {
        content: [{
          type: "text",
          text: handleDatabaseError(error)
        }],
        isError: true
      };
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
    try {
      // Use HTTP API to get total time
      const url = `http://localhost:9876/items/${params.item_id}/total-time`;
      const response = await fetch(url);

      if (!response.ok) {
        const errorData = await response.json() as { error?: string };
        return {
          content: [{
            type: "text",
            text: `Error: Failed to get total time. ${errorData.error || response.statusText}`
          }],
          isError: true
        };
      }

      const data = await response.json() as {
        itemId: string;
        itemTitle: string;
        totalSeconds: number;
        runningTimers: number;
      };

      return {
        content: [{
          type: "text",
          text: `# Total Time\n\n**${data.itemTitle}**\n\n**${formatDuration(data.totalSeconds)}**${data.runningTimers > 0 ? ` (includes ${data.runningTimers} running timer${data.runningTimers > 1 ? 's' : ''})` : ''}`
        }]
      };

    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `Error: Could not connect to DirectGTD API. Make sure the app is running. ${error instanceof Error ? error.message : String(error)}`
        }],
        isError: true
      };
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
    try {
      const responseFormat = params.response_format ?? ResponseFormat.MARKDOWN;

      // Use HTTP API to get active timers
      const response = await fetch("http://localhost:9876/timers/active");

      if (!response.ok) {
        const errorData = await response.json() as { error?: string };
        return {
          content: [{
            type: "text",
            text: `Error: Failed to get active timers. ${errorData.error || response.statusText}`
          }],
          isError: true
        };
      }

      const data = await response.json() as {
        entries: Array<{ id: string; itemId: string; itemTitle: string; startedAt: number; elapsedSeconds?: number }>;
      };

      const entries = data.entries || [];

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
            const startTime = new Date(entry.startedAt * 1000).toLocaleString('en-US', { timeZone: 'America/New_York' });
            const elapsed = entry.elapsedSeconds ?? (now - entry.startedAt);
            lines.push(`- 🔴 **${entry.itemTitle}** - ${formatDuration(elapsed)} (started ${startTime} EST) \`${entry.itemId}\``);
          }
        }

        result = lines.join("\n");
      } else {
        const now = Math.floor(Date.now() / 1000);
        result = JSON.stringify({
          total: entries.length,
          entries: entries.map(entry => ({
            entryId: entry.id,
            itemId: entry.itemId,
            itemTitle: entry.itemTitle,
            startedAt: new Date(entry.startedAt * 1000).toISOString(),
            elapsedSeconds: entry.elapsedSeconds ?? (now - entry.startedAt)
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
          text: `Error: Could not connect to DirectGTD API. Make sure the app is running. ${error instanceof Error ? error.message : String(error)}`
        }],
        isError: true
      };
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
    try {
      // Use HTTP API
      const response = await fetch(`http://localhost:9876/time-entries/${params.entry_id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          startedAt: params.started_at
        })
      });

      if (!response.ok) {
        const errorData = await response.json() as { error?: string };
        return {
          content: [{
            type: "text",
            text: `Error: Failed to update start time. ${errorData.error || response.statusText}`
          }],
          isError: true
        };
      }

      const data = await response.json() as {
        entry: {
          id: string;
          itemId: string;
          startedAt: number;
          endedAt: number | null;
          duration: number | null;
        };
        itemTitle: string;
      };

      const startTime = new Date(data.entry.startedAt * 1000).toLocaleString('en-US', { timeZone: 'America/New_York' });

      return {
        content: [{
          type: "text",
          text: `# Start Time Updated\n\n**${data.itemTitle}**\n\n- **Entry ID**: ${params.entry_id}\n- **New Start Time**: ${startTime} EST\n\nStart time updated successfully.`
        }]
      };

    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `Error: Could not connect to DirectGTD API. ${error instanceof Error ? error.message : String(error)}`
        }],
        isError: true
      };
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
    try {
      // Use HTTP API
      const response = await fetch(`http://localhost:9876/time-entries/${params.entry_id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          endedAt: params.ended_at
        })
      });

      if (!response.ok) {
        const errorData = await response.json() as { error?: string };
        return {
          content: [{
            type: "text",
            text: `Error: Failed to update end time. ${errorData.error || response.statusText}`
          }],
          isError: true
        };
      }

      const data = await response.json() as {
        entry: {
          id: string;
          itemId: string;
          startedAt: number;
          endedAt: number;
          duration: number;
        };
        itemTitle: string;
      };

      const startTime = new Date(data.entry.startedAt * 1000).toLocaleString('en-US', { timeZone: 'America/New_York' });
      const endTime = new Date(data.entry.endedAt * 1000).toLocaleString('en-US', { timeZone: 'America/New_York' });

      return {
        content: [{
          type: "text",
          text: `# End Time Updated\n\n**${data.itemTitle}**\n\n- **Entry ID**: ${params.entry_id}\n- **Started**: ${startTime} EST\n- **New End Time**: ${endTime} EST\n- **New Duration**: ${formatDuration(data.entry.duration)}\n\nEnd time updated successfully.`
        }]
      };

    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `Error: Could not connect to DirectGTD API. ${error instanceof Error ? error.message : String(error)}`
        }],
        isError: true
      };
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
    try {
      // Generate random color if not provided
      const color = params.color ?? `#${Math.floor(Math.random()*16777215).toString(16).padStart(6, '0').toUpperCase()}`;

      // Create tag via API
      const response = await fetch("http://localhost:9876/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: params.name, color })
      });

      if (!response.ok) {
        if (response.status === 409) {
          return {
            content: [{
              type: "text",
              text: `Error: Tag '${params.name}' already exists.`
            }],
            isError: true
          };
        }
        const errorText = await response.text();
        return {
          content: [{
            type: "text",
            text: `Error creating tag: ${errorText}`
          }],
          isError: true
        };
      }

      const data = await response.json() as { tag: { id: string; name: string; color: string } };
      const tag = data.tag;

      return {
        content: [{
          type: "text",
          text: `# Tag Created\n\n**${tag.name}** ● ${tag.color}\n\n- **ID**: ${tag.id}\n\nTag created successfully.`
        }]
      };

    } catch (error) {
      if (error instanceof Error && error.message.includes('fetch')) {
        return {
          content: [{
            type: "text",
            text: "Error: Cannot connect to DirectGTD API. Make sure the app is running."
          }],
          isError: true
        };
      }
      return {
        content: [{
          type: "text",
          text: handleDatabaseError(error)
        }],
        isError: true
      };
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
    try {
      // First get the tag info for display
      const tagsResponse = await fetch("http://localhost:9876/tags");
      if (!tagsResponse.ok) {
        return {
          content: [{
            type: "text",
            text: "Error: Cannot fetch tags from DirectGTD API."
          }],
          isError: true
        };
      }
      const tagsData = await tagsResponse.json() as { tags: Array<{ id: string; name: string; color: string }> };
      const tag = tagsData.tags.find(t => t.id === params.tag_id);

      if (!tag) {
        return {
          content: [{
            type: "text",
            text: `Error: Tag with ID '${params.tag_id}' not found.`
          }],
          isError: true
        };
      }

      // Delete via API
      const response = await fetch(`http://localhost:9876/tags/${params.tag_id}`, {
        method: "DELETE"
      });

      if (!response.ok) {
        if (response.status === 404) {
          return {
            content: [{
              type: "text",
              text: `Error: Tag with ID '${params.tag_id}' not found.`
            }],
            isError: true
          };
        }
        const errorText = await response.text();
        return {
          content: [{
            type: "text",
            text: `Error deleting tag: ${errorText}`
          }],
          isError: true
        };
      }

      return {
        content: [{
          type: "text",
          text: `# Tag Deleted\n\n**${tag.name}** ● ${tag.color}\n\n- **ID**: ${params.tag_id}\n\nTag and all associations deleted.`
        }]
      };

    } catch (error) {
      if (error instanceof Error && error.message.includes('fetch')) {
        return {
          content: [{
            type: "text",
            text: "Error: Cannot connect to DirectGTD API. Make sure the app is running."
          }],
          isError: true
        };
      }
      return {
        content: [{
          type: "text",
          text: handleDatabaseError(error)
        }],
        isError: true
      };
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
    try {
      // First get the current tag info for display
      const tagsResponse = await fetch("http://localhost:9876/tags");
      if (!tagsResponse.ok) {
        return {
          content: [{
            type: "text",
            text: "Error: Cannot fetch tags from DirectGTD API."
          }],
          isError: true
        };
      }
      const tagsData = await tagsResponse.json() as { tags: Array<{ id: string; name: string; color: string }> };
      const tag = tagsData.tags.find(t => t.id === params.tag_id);

      if (!tag) {
        return {
          content: [{
            type: "text",
            text: `Error: Tag with ID '${params.tag_id}' not found.`
          }],
          isError: true
        };
      }

      const oldName = tag.name;

      // Update via API
      const response = await fetch(`http://localhost:9876/tags/${params.tag_id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: params.new_name })
      });

      if (!response.ok) {
        if (response.status === 404) {
          return {
            content: [{
              type: "text",
              text: `Error: Tag with ID '${params.tag_id}' not found.`
            }],
            isError: true
          };
        }
        if (response.status === 409) {
          return {
            content: [{
              type: "text",
              text: `Error: Tag '${params.new_name}' already exists.`
            }],
            isError: true
          };
        }
        const errorText = await response.text();
        return {
          content: [{
            type: "text",
            text: `Error renaming tag: ${errorText}`
          }],
          isError: true
        };
      }

      return {
        content: [{
          type: "text",
          text: `# Tag Renamed\n\n**${oldName}** → **${params.new_name}** ● ${tag.color}\n\n- **ID**: ${params.tag_id}\n\nTag renamed successfully.`
        }]
      };

    } catch (error) {
      if (error instanceof Error && error.message.includes('fetch')) {
        return {
          content: [{
            type: "text",
            text: "Error: Cannot connect to DirectGTD API. Make sure the app is running."
          }],
          isError: true
        };
      }
      return {
        content: [{
          type: "text",
          text: handleDatabaseError(error)
        }],
        isError: true
      };
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
    const responseFormat = params.response_format || ResponseFormat.MARKDOWN;

    try {
      // Use HTTP API to get dashboard
      const response = await fetch("http://localhost:9876/dashboard");

      if (!response.ok) {
        const errorData = await response.json() as { error?: string };
        return {
          content: [{
            type: "text",
            text: `Error: Failed to get dashboard. ${errorData.error || response.statusText}`
          }],
          isError: true
        };
      }

      const data = await response.json() as {
        next: Array<{ id: string; title: string; itemType: string; dueDate: number | null; parentId: string | null; parentTitle: string | null }>;
        urgent: Array<{ id: string; title: string; itemType: string; dueDate: number | null; parentId: string | null; parentTitle: string | null }>;
        overdue: Array<{ id: string; title: string; itemType: string; dueDate: number | null; parentId: string | null; parentTitle: string | null }>;
        totals?: { next: number; urgent: number; overdue: number; total: number };
      };

      const nextItems = data.next || [];
      const urgentItems = data.urgent || [];
      const overdueItems = data.overdue || [];

      if (responseFormat === ResponseFormat.JSON) {
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              next: nextItems,
              urgent: urgentItems,
              overdue: overdueItems,
              totals: data.totals || {
                next: nextItems.length,
                urgent: urgentItems.length,
                overdue: overdueItems.length,
                total: nextItems.length + urgentItems.length + overdueItems.length
              }
            }, null, 2)
          }]
        };
      }

      // Markdown format
      const formatItem = (item: { id: string; title: string; itemType?: string; dueDate?: number | null; parentTitle?: string | null }) => {
        let line = `- **${item.title}**`;
        if (item.parentTitle) {
          line += ` (in ${item.parentTitle})`;
        }
        if (item.dueDate) {
          const dueDate = new Date(item.dueDate * 1000);
          line += ` - Due: ${dueDate.toLocaleDateString()}`;
        }
        return line;
      };

      let output = "# Dashboard\n\n";

      output += `## 🎯 Next Actions (${nextItems.length})\n`;
      if (nextItems.length === 0) {
        output += "*No items tagged Next*\n";
      } else {
        nextItems.forEach(item => {
          output += formatItem(item) + "\n";
        });
      }
      output += "\n";

      output += `## 🔴 Urgent (${urgentItems.length})\n`;
      if (urgentItems.length === 0) {
        output += "*No urgent items*\n";
      } else {
        urgentItems.forEach(item => {
          output += formatItem(item) + "\n";
        });
      }
      output += "\n";

      output += `## ⏰ Overdue (${overdueItems.length})\n`;
      if (overdueItems.length === 0) {
        output += "*No overdue items*\n";
      } else {
        overdueItems.forEach(item => {
          output += formatItem(item) + "\n";
        });
      }

      const total = nextItems.length + urgentItems.length + overdueItems.length;
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
          text: `Error: Could not connect to DirectGTD API. Make sure the app is running. ${error instanceof Error ? error.message : String(error)}`
        }],
        isError: true
      };
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
    const responseFormat = params.response_format || ResponseFormat.MARKDOWN;

    try {
      // Build query params
      const queryParams = new URLSearchParams();
      if (params.root_id) queryParams.append("rootId", params.root_id);

      // Use HTTP API to get stuck projects
      const url = `http://localhost:9876/projects/stuck${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
      const response = await fetch(url);

      if (!response.ok) {
        const errorData = await response.json() as { error?: string };
        return {
          content: [{
            type: "text",
            text: `Error: Failed to get stuck projects. ${errorData.error || response.statusText}`
          }],
          isError: true
        };
      }

      const data = await response.json() as {
        projects: Array<{ id: string; title: string; areaTitle?: string }>;
        total: number;
        message?: string;
      };

      const stuckProjects = data.projects || [];

      if (data.message) {
        // Special case like "No 'Next' tag exists"
        return {
          content: [{
            type: "text",
            text: responseFormat === ResponseFormat.JSON
              ? JSON.stringify({ projects: [], total: 0, message: data.message }, null, 2)
              : `# Stuck Projects\n\n${data.message}`
          }]
        };
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
          if (project.areaTitle) {
            output += `${index + 1}. **${project.title}** (in ${project.areaTitle})\n`;
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
          text: `Error: Could not connect to DirectGTD API. Make sure the app is running. ${error instanceof Error ? error.message : String(error)}`
        }],
        isError: true
      };
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
    try {
      // Build request body
      const requestBody: { keepItemsSince?: string } = {};
      if (params.keep_items_since) {
        requestBody.keepItemsSince = params.keep_items_since;
      }

      // Use HTTP API
      const response = await fetch("http://localhost:9876/trash/empty", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorData = await response.json() as { error?: string };
        return {
          content: [{
            type: "text",
            text: `Error: Failed to empty trash. ${errorData.error || response.statusText}`
          }],
          isError: true
        };
      }

      const data = await response.json() as {
        deletedCount: number;
        keepItemsSince?: string;
      };

      const result = data.keepItemsSince
        ? `# Trash Emptied\n\nPermanently deleted ${data.deletedCount} item(s) modified before ${data.keepItemsSince}.`
        : `# Trash Emptied\n\nPermanently deleted ${data.deletedCount} item(s).`;

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
          text: `Error: Could not connect to DirectGTD API. ${error instanceof Error ? error.message : String(error)}`
        }],
        isError: true
      };
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
    try {
      // Build request body
      const requestBody: {
        name: string;
        parentId?: string;
        asType?: string;
      } = {
        name: params.name
      };

      if (params.parent_id) {
        requestBody.parentId = params.parent_id;
      }
      if (params.as_type) {
        requestBody.asType = params.as_type;
      }

      // Use HTTP API
      const response = await fetch(`http://localhost:9876/templates/${params.template_id}/instantiate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorData = await response.json() as { error?: string };
        return {
          content: [{
            type: "text",
            text: `Error: Failed to instantiate template. ${errorData.error || response.statusText}`
          }],
          isError: true
        };
      }

      const data = await response.json() as {
        instance: {
          id: string;
          title: string;
          itemType: string;
          parentId: string;
        };
        templateTitle: string;
        itemsCreated: number;
        createdAt: number;
      };

      const createdTime = new Date(data.createdAt * 1000).toLocaleString('en-US', {
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

**${data.instance.title}**

- **ID**: ${data.instance.id}
- **Type**: ${data.instance.itemType}
- **Parent**: ${data.instance.parentId}
- **Items Created**: ${data.itemsCreated}
- **Created**: ${createdTime}

Template "${data.templateTitle}" successfully instantiated.`
        }]
      };

    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `Error: Could not connect to DirectGTD API. ${error instanceof Error ? error.message : String(error)}`
        }],
        isError: true
      };
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
    try {
      const limit = params.limit ?? 20;
      const now = Math.floor(Date.now() / 1000);

      // Build query params
      const queryParams = new URLSearchParams();
      if (limit) queryParams.append("limit", limit.toString());
      if (params.root_id) queryParams.append("rootId", params.root_id);

      // Use HTTP API to get oldest tasks
      const url = `http://localhost:9876/tasks/oldest${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
      const response = await fetch(url);

      if (!response.ok) {
        const errorData = await response.json() as { error?: string };
        return {
          content: [{
            type: "text",
            text: `Error: Failed to get oldest tasks. ${errorData.error || response.statusText}`
          }],
          isError: true
        };
      }

      const data = await response.json() as {
        items: Array<{ id: string; title?: string; parentId?: string | null; parentTitle?: string | null; createdAt?: number; ageInDays?: number }>;
      };
      const items = data.items || [];

      if (items.length === 0) {
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
        const formattedItems = items.map(task => ({
          id: task.id,
          title: task.title,
          parentId: task.parentId,
          parentTitle: task.parentTitle,
          createdAt: task.createdAt ? new Date(task.createdAt * 1000).toISOString() : null,
          ageInDays: task.ageInDays ?? (task.createdAt ? Math.floor((now - task.createdAt) / 86400) : 0)
        }));

        return {
          content: [{
            type: "text",
            text: JSON.stringify({ total: formattedItems.length, items: formattedItems }, null, 2)
          }]
        };
      }

      // Markdown format
      const lines = ["# Oldest Tasks\n", `Found ${items.length} task(s), oldest first:\n`];

      for (const task of items) {
        const createdAt = task.createdAt || 0;
        const ageInDays = task.ageInDays ?? Math.floor((now - createdAt) / 86400);
        const createdDate = new Date(createdAt * 1000).toLocaleDateString('en-US', {
          timeZone: 'America/New_York',
          month: 'short',
          day: 'numeric',
          year: 'numeric'
        });

        const parentInfo = task.parentTitle ? ` (in ${task.parentTitle})` : '';
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
          text: `Error: Could not connect to DirectGTD API. Make sure the app is running. ${error instanceof Error ? error.message : String(error)}`
        }],
        isError: true
      };
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
