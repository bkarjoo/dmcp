import Database from "better-sqlite3";
import { homedir } from "os";
import { join } from "path";

const DB_PATH = join(homedir(), "Library/Containers/com.zendegi.DirectGTD/Data/Library/Application Support/DirectGTD/directgtd.sqlite");

function formatDate(timestamp) {
  if (!timestamp) return "None";
  try {
    const date = new Date(timestamp * 1000);
    return date.toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZoneName: "short"
    });
  } catch {
    return timestamp;
  }
}

console.log("Retrieving item details using our API pattern...\n");
const db = new Database(DB_PATH);

const itemId = "6B36D7DA-446B-4990-BB53-8D97EB4456A0";
const item = db.prepare("SELECT * FROM items WHERE id = ?").get(itemId);

if (!item) {
  console.log("Error: Item not found");
} else {
  console.log("# " + item.title);
  console.log("");
  console.log("- **ID**: " + item.id);
  console.log("- **Type**: " + (item.item_type || "Unknown"));
  console.log("- **Parent ID**: " + (item.parent_id || "None (root item)"));
  console.log("- **Sort Order**: " + item.sort_order);
  console.log("- **Created**: " + formatDate(item.created_at));
  console.log("- **Modified**: " + formatDate(item.modified_at));

  if (item.completed_at) {
    console.log("- **Completed**: " + formatDate(item.completed_at));
  }

  if (item.due_date) {
    console.log("- **Due Date**: " + formatDate(item.due_date));
  }

  if (item.earliest_start_time) {
    console.log("- **Earliest Start**: " + formatDate(item.earliest_start_time));
  }

  console.log("\n✅ Successfully retrieved item with both timestamps set!");
}

db.close();