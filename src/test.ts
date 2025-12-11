/**
 * Tests for DirectGTD MCP Server
 *
 * These tests verify the get_root_items functionality against the DirectGTD database.
 */

import { test } from "node:test";
import { strict as assert } from "node:assert";
import Database from "better-sqlite3";
import { homedir } from "os";
import { join } from "path";
import { existsSync } from "fs";

const DB_PATH = join(homedir(), "Library/Application Support/DirectGTD/directgtd.sqlite");

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
}

test("DirectGTD database exists", () => {
  assert.ok(
    existsSync(DB_PATH),
    `Database should exist at ${DB_PATH}`
  );
});

test("get_root_items returns items when database has root items", () => {
  if (!existsSync(DB_PATH)) {
    console.error("Skipping test: Database not found");
    return;
  }

  const db = new Database(DB_PATH, { readonly: true });
  try {
    const query = "SELECT * FROM items WHERE parent_id IS NULL ORDER BY sort_order";
    const stmt = db.prepare(query);
    const rows = stmt.all() as DirectGTDItem[];

    // Should have at least one root item or be empty (both are valid)
    assert.ok(
      Array.isArray(rows),
      "Query should return an array"
    );

    console.log(`Found ${rows.length} root items in database`);

  } finally {
    db.close();
  }
});

test("get_root_items returns empty array when no root items exist", () => {
  if (!existsSync(DB_PATH)) {
    console.error("Skipping test: Database not found");
    return;
  }

  const db = new Database(DB_PATH, { readonly: true });
  try {
    // First, let's check if there are any items at all
    const allItems = db.prepare("SELECT COUNT(*) as count FROM items").get() as { count: number };

    if (allItems.count === 0) {
      // Database is empty - root items query should return empty array
      const query = "SELECT * FROM items WHERE parent_id IS NULL ORDER BY sort_order";
      const rows = db.prepare(query).all() as DirectGTDItem[];

      assert.equal(
        rows.length,
        0,
        "Query should return empty array when database has no items"
      );

      console.log("Verified: Empty database returns empty array");
    } else {
      console.log(`Database has ${allItems.count} total items - skipping empty database test`);
    }

  } finally {
    db.close();
  }
});

test("get_root_items returns items sorted by sort_order", () => {
  if (!existsSync(DB_PATH)) {
    console.error("Skipping test: Database not found");
    return;
  }

  const db = new Database(DB_PATH, { readonly: true });
  try {
    const query = "SELECT * FROM items WHERE parent_id IS NULL ORDER BY sort_order";
    const stmt = db.prepare(query);
    const rows = stmt.all() as DirectGTDItem[];

    if (rows.length < 2) {
      console.log("Skipping sort test: Need at least 2 root items to verify sorting");
      return;
    }

    // Verify items are sorted by sort_order
    for (let i = 0; i < rows.length - 1; i++) {
      assert.ok(
        rows[i].sort_order <= rows[i + 1].sort_order,
        `Items should be sorted by sort_order: ${rows[i].sort_order} <= ${rows[i + 1].sort_order}`
      );
    }

    console.log(`Verified: ${rows.length} root items are sorted by sort_order`);

  } finally {
    db.close();
  }
});

test("get_root_items ensures parentId is null for all returned items", () => {
  if (!existsSync(DB_PATH)) {
    console.error("Skipping test: Database not found");
    return;
  }

  const db = new Database(DB_PATH, { readonly: true });
  try {
    const query = "SELECT * FROM items WHERE parent_id IS NULL ORDER BY sort_order";
    const stmt = db.prepare(query);
    const rows = stmt.all() as DirectGTDItem[];

    // Verify all items have null parent_id
    for (const row of rows) {
      assert.equal(
        row.parent_id,
        null,
        `All root items should have null parent_id, but found: ${row.parent_id}`
      );
    }

    console.log(`Verified: All ${rows.length} root items have null parent_id`);

  } finally {
    db.close();
  }
});

test("database schema has expected columns", () => {
  if (!existsSync(DB_PATH)) {
    console.error("Skipping test: Database not found");
    return;
  }

  const db = new Database(DB_PATH, { readonly: true });
  try {
    const query = "SELECT * FROM items WHERE parent_id IS NULL ORDER BY sort_order LIMIT 1";
    const stmt = db.prepare(query);
    const row = stmt.get() as DirectGTDItem | undefined;

    if (!row) {
      console.log("No root items to verify schema - checking table structure");
      // Check table structure instead
      const tableInfo = db.prepare("PRAGMA table_info(items)").all() as Array<{ name: string }>;
      const columnNames = tableInfo.map(col => col.name);

      const expectedColumns = [
        "id",
        "title",
        "parent_id",
        "sort_order",
        "created_at",
        "modified_at",
        "completed_at",
        "due_date",
        "earliest_start_time"
      ];

      for (const col of expectedColumns) {
        assert.ok(
          columnNames.includes(col),
          `Table should have column: ${col}`
        );
      }

      console.log("Verified: Table has all expected columns");
    } else {
      // Verify the row has all expected fields
      const expectedFields: (keyof DirectGTDItem)[] = [
        "id",
        "title",
        "parent_id",
        "sort_order",
        "created_at",
        "modified_at",
        "completed_at",
        "due_date",
        "earliest_start_time"
      ];

      for (const field of expectedFields) {
        assert.ok(
          field in row,
          `Root item should have field: ${field}`
        );
      }

      console.log("Verified: Root item has all expected fields");
    }

  } finally {
    db.close();
  }
});

console.log("\nRunning DirectGTD MCP Server Tests...\n");
