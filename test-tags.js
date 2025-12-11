import Database from "better-sqlite3";
import { homedir } from "os";
import { join } from "path";

const DB_PATH = join(homedir(), "Library/Containers/com.zendegi.DirectGTD/Data/Library/Application Support/DirectGTD/directgtd.sqlite");

console.log("Testing directgtd_get_all_tags function...\n");
const db = new Database(DB_PATH);

// Query all tags
const tags = db.prepare("SELECT * FROM tags ORDER BY name").all();

console.log("# DirectGTD Tags");
console.log("");
console.log(`Found ${tags.length} tag${tags.length === 1 ? '' : 's'}:`);
console.log("");

for (const tag of tags) {
  const colorIndicator = tag.color ? ` ● ${tag.color}` : "";
  console.log(`## ${tag.name}${colorIndicator}`);
  console.log(`- **ID**: ${tag.id}`);
  if (tag.color) {
    console.log(`- **Color**: ${tag.color}`);
  }
  console.log("");
}

// Also show JSON format
console.log("\n=== JSON Format ===\n");
console.log(JSON.stringify({
  total: tags.length,
  tags: tags.map(tag => ({
    id: tag.id,
    name: tag.name,
    color: tag.color
  }))
}, null, 2));

db.close();