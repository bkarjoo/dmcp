import Database from "better-sqlite3";
import { homedir } from "os";
import { join } from "path";

const DB_PATH = join(homedir(), "Library/Containers/com.zendegi.DirectGTD/Data/Library/Application Support/DirectGTD/directgtd.sqlite");

console.log("Opening database...");
const db = new Database(DB_PATH);

const itemId = "6B36D7DA-446B-4990-BB53-8D97EB4456A0"; // sleep task

// Get original item
console.log("\n=== Original Item ===");
let item = db.prepare("SELECT * FROM items WHERE id = ?").get(itemId);
console.log("Title:", item.title);
console.log("Due Date:", item.due_date || "None");
console.log("Earliest Start Time:", item.earliest_start_time || "None");

// Update due date
console.log("\n=== Updating Due Date ===");
const dueDateTimestamp = Math.floor(new Date("2024-12-31T23:00:00Z").getTime() / 1000);
const modifiedAt = Math.floor(Date.now() / 1000);
db.prepare("UPDATE items SET due_date = ?, modified_at = ? WHERE id = ?")
  .run(dueDateTimestamp, modifiedAt, itemId);
console.log("Due date updated to: 2024-12-31T23:00:00Z");

// Update earliest start time
console.log("\n=== Updating Earliest Start Time ===");
const startTimeTimestamp = Math.floor(new Date("2024-12-25T09:00:00Z").getTime() / 1000);
db.prepare("UPDATE items SET earliest_start_time = ?, modified_at = ? WHERE id = ?")
  .run(startTimeTimestamp, modifiedAt, itemId);
console.log("Earliest start time updated to: 2024-12-25T09:00:00Z");

// Get updated item
console.log("\n=== Updated Item ===");
item = db.prepare("SELECT * FROM items WHERE id = ?").get(itemId);
console.log("Title:", item.title);
console.log("Due Date (timestamp):", item.due_date);
console.log("Due Date (formatted):", item.due_date ? new Date(item.due_date * 1000).toISOString() : "None");
console.log("Earliest Start Time (timestamp):", item.earliest_start_time);
console.log("Earliest Start Time (formatted):", item.earliest_start_time ? new Date(item.earliest_start_time * 1000).toISOString() : "None");

db.close();
console.log("\n✅ Test complete!");