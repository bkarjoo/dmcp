import Database from "better-sqlite3";
import { homedir } from "os";
import { join } from "path";

const DB_PATH = join(homedir(), "Library/Containers/com.zendegi.DirectGTD/Data/Library/Application Support/DirectGTD/directgtd.sqlite");

console.log("Testing tag management functions...\n");
const db = new Database(DB_PATH);

const itemId = "6B36D7DA-446B-4990-BB53-8D97EB4456A0"; // sleep task
const homeTagId = "22B0B1F4-1950-4E2B-9E1C-4DD059AB2267"; // @home tag

// 1. Get current tags for the item
console.log("=== 1. Getting current tags for 'sleep' task ===");
const currentTags = db.prepare(`
  SELECT t.* FROM tags t
  JOIN item_tags it ON t.id = it.tag_id
  WHERE it.item_id = ?
  ORDER BY t.name
`).all(itemId);
console.log(`Current tags: ${currentTags.length === 0 ? 'None' : currentTags.map(t => t.name).join(', ')}\n`);

// 2. Add @home tag
console.log("=== 2. Adding @home tag ===");
const existing = db.prepare("SELECT * FROM item_tags WHERE item_id = ? AND tag_id = ?")
  .get(itemId, homeTagId);

if (!existing) {
  db.prepare("INSERT INTO item_tags (item_id, tag_id) VALUES (?, ?)")
    .run(itemId, homeTagId);
  console.log("@home tag added successfully!\n");
} else {
  console.log("@home tag already applied.\n");
}

// 3. Get tags after adding
console.log("=== 3. Getting tags after adding ===");
const afterAddTags = db.prepare(`
  SELECT t.* FROM tags t
  JOIN item_tags it ON t.id = it.tag_id
  WHERE it.item_id = ?
  ORDER BY t.name
`).all(itemId);

if (afterAddTags.length > 0) {
  console.log(`Item has ${afterAddTags.length} tag(s):`);
  for (const tag of afterAddTags) {
    console.log(`- **${tag.name}** ● ${tag.color}`);
  }
} else {
  console.log("No tags applied.");
}

// 4. Remove the tag
console.log("\n=== 4. Removing @home tag ===");
db.prepare("DELETE FROM item_tags WHERE item_id = ? AND tag_id = ?")
  .run(itemId, homeTagId);
console.log("@home tag removed!\n");

// 5. Verify removal
console.log("=== 5. Verifying removal ===");
const afterRemoveTags = db.prepare(`
  SELECT t.* FROM tags t
  JOIN item_tags it ON t.id = it.tag_id
  WHERE it.item_id = ?
  ORDER BY t.name
`).all(itemId);
console.log(`Tags after removal: ${afterRemoveTags.length === 0 ? 'None' : afterRemoveTags.map(t => t.name).join(', ')}`);

db.close();
console.log("\n✅ Tag functions test complete!");