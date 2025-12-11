# Troubleshooting Guide

This guide helps you diagnose and resolve common issues with DirectGTD MCP Server.

## Quick Diagnostics

Before diving into specific issues, run these quick checks:

### 1. Check Database Exists
```bash
ls -l ~/Library/Application\ Support/DirectGTD/directgtd.sqlite
```

**Expected**: File exists and shows size and permissions
**Problem**: "No such file or directory" error

### 2. Check Node Version
```bash
node --version
```

**Expected**: `v18.0.0` or higher
**Problem**: Version below v18

### 3. Check Server Build
```bash
ls -l /path/to/directmcp/dist/index.js
```

**Expected**: File exists
**Problem**: File not found (need to run `npm run build`)

### 4. Run Tests
```bash
cd /path/to/directmcp
npm test
```

**Expected**: All tests pass
**Problem**: Tests fail with specific errors

## Common Issues and Solutions

### Database Issues

#### Error: "Database not found"

**Full Error Message:**
```
Error: Database not found at ~/Library/Application Support/DirectGTD/directgtd.sqlite.
Please ensure DirectGTD is installed and has created its database.
```

**Cause**: DirectGTD database file doesn't exist

**Solutions:**

1. **Verify DirectGTD is installed:**
   ```bash
   # Check if DirectGTD app exists
   ls -la /Applications/DirectGTD.app
   ```

2. **Launch DirectGTD and create a task:**
   - Open DirectGTD application
   - Create at least one task
   - This initializes the database

3. **Verify database was created:**
   ```bash
   ls -l ~/Library/Application\ Support/DirectGTD/directgtd.sqlite
   ```

4. **Check database directory permissions:**
   ```bash
   ls -ld ~/Library/Application\ Support/DirectGTD/
   ```

#### Error: "Cannot open database"

**Full Error Message:**
```
Error: Cannot open database at ~/Library/Application Support/DirectGTD/directgtd.sqlite.
Please check file permissions.
```

**Cause**: File permissions prevent reading the database

**Solutions:**

1. **Check file permissions:**
   ```bash
   ls -l ~/Library/Application\ Support/DirectGTD/directgtd.sqlite
   ```

   Should show read permission for your user: `-rw-r--r--` or similar

2. **Fix permissions:**
   ```bash
   chmod 644 ~/Library/Application\ Support/DirectGTD/directgtd.sqlite
   ```

3. **Check ownership:**
   ```bash
   ls -l ~/Library/Application\ Support/DirectGTD/directgtd.sqlite
   ```

   Owner should be your username

4. **Fix ownership (if needed):**
   ```bash
   sudo chown $(whoami) ~/Library/Application\ Support/DirectGTD/directgtd.sqlite
   ```

#### Error: "Database file is corrupted"

**Full Error Message:**
```
Error: Database file is corrupted. Please check the DirectGTD database integrity.
```

**Cause**: SQLite database file is corrupted

**Solutions:**

1. **Check database integrity:**
   ```bash
   sqlite3 ~/Library/Application\ Support/DirectGTD/directgtd.sqlite "PRAGMA integrity_check;"
   ```

   Expected output: `ok`

2. **Try to recover from DirectGTD:**
   - Open DirectGTD application
   - Check if it loads correctly
   - DirectGTD may have built-in recovery

3. **Restore from backup (if available):**
   - Check for DirectGTD backup files
   - Restore from Time Machine or other backup
   - Replace corrupted database with backup

4. **Last resort - start fresh:**
   - Backup existing database
   - Delete corrupted database
   - Launch DirectGTD to create new database
   - Manually recreate tasks

#### "No root items found"

**Message:**
```
No root items found in DirectGTD database.
```

**Cause**: Database has no root-level items (items with no parent)

**This is NOT an error** - it's a valid state. Solutions:

1. **Create root-level tasks in DirectGTD:**
   - Open DirectGTD
   - Create tasks at the top level
   - Don't nest them under other items

2. **Verify items exist in database:**
   ```bash
   sqlite3 ~/Library/Application\ Support/DirectGTD/directgtd.sqlite \
     "SELECT COUNT(*) FROM items;"
   ```

   If count > 0 but still no root items:
   ```bash
   sqlite3 ~/Library/Application\ Support/DirectGTD/directgtd.sqlite \
     "SELECT COUNT(*) FROM items WHERE parent_id IS NULL;"
   ```

   If this returns 0, all items have parents

3. **Check if all items are nested:**
   - Open DirectGTD
   - Look for items that aren't under a project or category
   - Create at least one top-level item

### Installation Issues

#### "npm install" fails

**Symptoms**: Dependencies don't install

**Solutions:**

1. **Check Node version:**
   ```bash
   node --version
   ```
   Must be v18 or higher

2. **Clear npm cache:**
   ```bash
   npm cache clean --force
   rm -rf node_modules
   npm install
   ```

3. **Check for permission errors:**
   ```bash
   # If using global npm, may need sudo (not recommended)
   # Better: use nvm or fix npm permissions
   ```

4. **Use a Node version manager:**
   ```bash
   # Install nvm (if not already installed)
   # Then:
   nvm install 18
   nvm use 18
   npm install
   ```

#### "npm run build" fails

**Symptoms**: TypeScript compilation errors

**Solutions:**

1. **Clean and rebuild:**
   ```bash
   npm run clean
   npm install
   npm run build
   ```

2. **Check TypeScript version:**
   ```bash
   npx tsc --version
   ```
   Should be 5.x

3. **Check for syntax errors:**
   - Read the build output carefully
   - Look for line numbers and error messages
   - Fix any reported TypeScript errors

4. **Verify all dependencies installed:**
   ```bash
   npm install
   ```

#### "npm test" fails

**Symptoms**: Tests don't pass

**Solutions:**

1. **Build first:**
   ```bash
   npm run build
   npm test
   ```

2. **Check database exists:**
   Tests require a valid DirectGTD database

3. **Read test output:**
   - Tests show which specific check failed
   - Follow the error message guidance

4. **Common test failures:**
   - "Database not found": Create DirectGTD database
   - "No root items": Add root-level tasks in DirectGTD
   - "Schema mismatch": DirectGTD version may be incompatible

### Configuration Issues

#### Claude Code doesn't recognize the server

**Symptoms**: Can't use DirectGTD MCP tool in Claude Code

**Solutions:**

1. **Verify server is added:**
   ```bash
   claude mcp list
   ```

   Should show `directgtd` in the list

2. **Re-add the server:**
   ```bash
   claude mcp remove directgtd
   claude mcp add --transport stdio directgtd -- node /absolute/path/to/dist/index.js
   ```

   **Important**: Use absolute path, not relative

3. **Check path is correct:**
   ```bash
   # The path in your claude mcp add command should exist:
   ls -l /path/you/used/in/add/command/dist/index.js
   ```

4. **Restart Claude Code:**
   - Close all Claude Code sessions
   - Restart your terminal
   - Try again

#### Claude Desktop doesn't recognize the server

**Symptoms**: Can't use DirectGTD MCP tool in Claude Desktop

**Solutions:**

1. **Check config file location:**
   ```bash
   cat ~/Library/Application\ Support/Claude/claude_desktop_config.json
   ```

2. **Verify JSON syntax:**
   - Use a JSON validator: https://jsonlint.com/
   - Common mistakes: missing commas, extra commas, quotes

3. **Verify path is absolute:**
   ```json
   {
     "mcpServers": {
       "directgtd": {
         "type": "stdio",
         "command": "node",
         "args": ["/Users/yourname/path/to/dist/index.js"]  // Must be absolute
       }
     }
   }
   ```

4. **Restart Claude Desktop:**
   - Quit Claude Desktop completely
   - Reopen Claude Desktop
   - Try your query

5. **Check Claude Desktop logs:**
   - Look for error messages in Console.app
   - Filter by "Claude" or "MCP"

### Usage Issues

#### Response is truncated

**Symptoms**: Message says "Response truncated from X to Y items"

**This is normal behavior**, not an error.

**Cause**: Too many root items (>25,000 characters)

**Solutions:**

1. **This is expected for large task lists:**
   - Character limit prevents overwhelming responses
   - First items (by sort order) are shown

2. **Request JSON format for details:**
   ```
   Get my DirectGTD tasks in JSON format
   ```

   JSON response shows truncation details

3. **Organize tasks into hierarchies:**
   - In DirectGTD, nest tasks under projects
   - This reduces root item count
   - Use parent-child relationships

4. **Future versions may add:**
   - Pagination support
   - Filtering options
   - Configurable limits

#### Dates show as "None"

**Symptoms**: Dates display as "None" in Markdown format

**This is normal** - not an error

**Cause**: Field is null (not set)

**Meaning:**
- `completedAt: None` = Task not completed
- `dueDate: None` = No due date set
- `earliestStartTime: None` = No start time set

**Solution**: Set dates in DirectGTD application

#### Can't see child tasks

**Symptoms**: Only see some of my tasks

**This is by design**, not a bug

**Cause**: Current version only retrieves root items

**Solutions:**

1. **Use DirectGTD app for hierarchical view:**
   - DirectGTD shows full task hierarchy
   - MCP server currently limited to root items

2. **Request enhancement:**
   - Future versions may support child items
   - This is a known limitation

3. **Promote tasks to root level:**
   - If you need a task visible via MCP
   - Make it a root-level item in DirectGTD

### Performance Issues

#### Server is slow to respond

**Symptoms**: Long wait time for results

**Causes and Solutions:**

1. **Large number of root items:**
   - Server must load and format all items
   - Consider organizing into hierarchies
   - Check how many root items you have:
     ```bash
     sqlite3 ~/Library/Application\ Support/DirectGTD/directgtd.sqlite \
       "SELECT COUNT(*) FROM items WHERE parent_id IS NULL;"
     ```

2. **Database on network drive:**
   - DirectGTD database should be on local disk
   - Network access is slower
   - Move database to local storage

3. **System resource constraints:**
   - Check CPU and memory usage
   - Close unnecessary applications
   - Restart your computer

#### Server crashes or times out

**Symptoms**: Server stops responding, error messages

**Solutions:**

1. **Check Node memory limits:**
   ```bash
   node --max-old-space-size=4096 /path/to/dist/index.js
   ```

2. **Verify database isn't locked:**
   - Close DirectGTD application
   - Try query again
   - SQLite allows multiple readers but may have locks

3. **Restart MCP server:**
   - For Claude Code: Restart terminal
   - For Claude Desktop: Restart application

## Platform-Specific Issues

### macOS

#### Database path doesn't exist

**Solution**: Path is hardcoded for macOS standard location
```
~/Library/Application Support/DirectGTD/directgtd.sqlite
```

If DirectGTD uses a different path:
1. Check DirectGTD settings
2. Create symlink (advanced):
   ```bash
   ln -s /actual/path/to/directgtd.sqlite ~/Library/Application\ Support/DirectGTD/directgtd.sqlite
   ```

#### Permission denied despite correct permissions

**Solution**: Check macOS privacy settings
1. System Preferences → Security & Privacy → Privacy
2. Full Disk Access
3. Add Terminal or Claude Code/Desktop

### Linux

**Status**: Not officially supported

**Issues**: Database path is macOS-specific

**Workaround** (for developers):
1. Modify `src/index.ts`
2. Change `DB_PATH` constant to Linux path
3. Rebuild

### Windows

**Status**: Not officially supported

**Issues**: Path separator and location differ

**No current workaround** - contribution welcome

## Getting Help

### Before Asking for Help

1. **Check this troubleshooting guide**
2. **Run diagnostics** (see Quick Diagnostics section)
3. **Check error messages** carefully
4. **Try the suggested solutions**

### Information to Provide

When asking for help, include:

1. **Environment:**
   - Operating system and version
   - Node.js version (`node --version`)
   - npm version (`npm --version`)
   - DirectGTD version

2. **Error details:**
   - Full error message
   - Steps to reproduce
   - When the error occurs

3. **Diagnostic output:**
   ```bash
   # Database check
   ls -l ~/Library/Application\ Support/DirectGTD/directgtd.sqlite

   # Build check
   ls -l /path/to/dist/index.js

   # Test output
   npm test
   ```

4. **Configuration:**
   - How you installed (Claude Code vs Desktop)
   - Configuration file contents (without sensitive info)

### Where to Get Help

1. **Documentation:**
   - [Getting Started](./getting-started.md)
   - [Installation Guide](./installation.md)
   - [Usage Guide](./usage.md)
   - [API Reference](./api-reference.md)

2. **Project repository:**
   - Check existing issues
   - Search for similar problems
   - Create new issue if needed

3. **Community:**
   - MCP community forums
   - DirectGTD user community

## Advanced Troubleshooting

### Enable Debug Mode

**For developers** - check server logs:

```bash
# Run server directly (not via MCP)
node dist/index.js
```

Server logs to stderr: "DirectGTD MCP server running via stdio"

### Inspect Database Directly

**Check database contents:**

```bash
# Open database
sqlite3 ~/Library/Application\ Support/DirectGTD/directgtd.sqlite

# List tables
.tables

# Check schema
.schema items

# Count root items
SELECT COUNT(*) FROM items WHERE parent_id IS NULL;

# View root items
SELECT * FROM items WHERE parent_id IS NULL ORDER BY sort_order;

# Exit
.quit
```

### Test Database Connection Manually

**Create test script:**

```javascript
// test-db.js
const Database = require('better-sqlite3');
const { join } = require('path');
const { homedir } = require('os');

const dbPath = join(homedir(), 'Library/Application Support/DirectGTD/directgtd.sqlite');
console.log('Database path:', dbPath);

try {
  const db = new Database(dbPath, { readonly: true });
  console.log('✅ Database opened successfully');

  const result = db.prepare('SELECT COUNT(*) as count FROM items WHERE parent_id IS NULL').get();
  console.log('Root items found:', result.count);

  db.close();
  console.log('✅ Database closed successfully');
} catch (error) {
  console.error('❌ Error:', error.message);
}
```

**Run test:**
```bash
node test-db.js
```

### Verify MCP Communication

**Test MCP protocol:**

The server uses stdio transport. Test manually:

```bash
# Run server
node dist/index.js

# In another terminal, send MCP initialization
# (This is advanced - requires understanding MCP protocol)
```

## Known Issues

### DirectGTD Schema Changes

**Issue**: DirectGTD database schema may change

**Impact**: Server may fail if schema is incompatible

**Solution**: Update to latest server version when DirectGTD updates

### Character Limit Truncation

**Issue**: Large response gets truncated

**Impact**: Can't see all items in one request

**Workaround**: Organize tasks into hierarchies in DirectGTD

**Future**: May add pagination

### macOS Only

**Issue**: Hardcoded macOS path

**Impact**: Doesn't work on Linux or Windows

**Workaround**: Modify source code and rebuild

**Future**: May add configurable paths

## Next Steps

- **[Development Guide](./development.md)**: Learn how to modify the server
- **[API Reference](./api-reference.md)**: Understand the technical details
- **[Usage Guide](./usage.md)**: Learn effective usage patterns
