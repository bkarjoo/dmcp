#!/usr/bin/env node

import { spawn } from 'child_process';

// Helper function to call MCP tools
async function callTool(toolName, params = {}) {
  return new Promise((resolve, reject) => {
    const mcp = spawn('npx', ['@modelcontextprotocol/cli', 'call-tool'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: true
    });

    const input = JSON.stringify({
      method: 'tools/call',
      params: {
        name: toolName,
        arguments: params
      }
    });

    let output = '';
    let error = '';

    mcp.stdout.on('data', (data) => {
      output += data.toString();
    });

    mcp.stderr.on('data', (data) => {
      error += data.toString();
    });

    mcp.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Process exited with code ${code}: ${error}`));
      } else {
        try {
          resolve(JSON.parse(output));
        } catch (e) {
          resolve(output);
        }
      }
    });

    mcp.stdin.write(input);
    mcp.stdin.end();
  });
}

// Direct API call function
async function callDirectAPI(toolName, params = {}) {
  try {
    const module = await import('./dist/index.js');

    // For testing, we'll directly call the functions
    // This is a simplified test that doesn't use the full MCP server
    console.log(`\n=== Testing ${toolName} ===`);
    console.log('Parameters:', JSON.stringify(params, null, 2));

    // Since we can't easily extract the handler functions from the server,
    // we'll use the npx command to test
    const command = `echo '{"jsonrpc": "2.0", "method": "tools/call", "params": {"name": "${toolName}", "arguments": ${JSON.stringify(params)}}, "id": 1}' | npx @modelcontextprotocol/cli client ./dist/index.js`;

    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);

    try {
      const { stdout, stderr } = await execAsync(command);
      if (stderr) console.error('Error:', stderr);
      if (stdout) {
        const lines = stdout.split('\n').filter(line => line.trim());
        const lastLine = lines[lines.length - 1];
        try {
          const result = JSON.parse(lastLine);
          if (result.result && result.result.content) {
            console.log('Result:', result.result.content[0].text);
          } else {
            console.log('Result:', result);
          }
        } catch (e) {
          console.log('Raw output:', stdout);
        }
      }
    } catch (error) {
      console.error('Execution error:', error);
    }
  } catch (error) {
    console.error('Error calling tool:', error);
  }
}

async function testDueDateFunctions() {
  console.log('🧪 Testing Due Date Query Functions\n');
  console.log('=====================================\n');

  // First, let's create some test items with various due dates
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);

  const today = new Date(now);

  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const laterThisWeek = new Date(now);
  laterThisWeek.setDate(laterThisWeek.getDate() + 3);

  const nextWeek = new Date(now);
  nextWeek.setDate(nextWeek.getDate() + 10);

  // Test items to create (if they don't exist)
  const testItems = [
    {
      title: 'Overdue task (yesterday)',
      due_date: yesterday.toISOString()
    },
    {
      title: 'Task due today',
      due_date: today.toISOString()
    },
    {
      title: 'Task due tomorrow',
      due_date: tomorrow.toISOString()
    },
    {
      title: 'Task due later this week',
      due_date: laterThisWeek.toISOString()
    },
    {
      title: 'Task due next week',
      due_date: nextWeek.toISOString()
    }
  ];

  console.log('📝 Creating test items with various due dates...\n');

  for (const item of testItems) {
    console.log(`Creating: ${item.title}`);
    console.log(`Due date: ${item.due_date}`);
    await callDirectAPI('directgtd_add_to_inbox', item);
    console.log('---');
  }

  console.log('\n\n📋 Testing Query Functions\n');
  console.log('=====================================\n');

  // Test 1: Get overdue items
  console.log('\n1. Testing directgtd_get_overdue_items');
  console.log('---------------------------------------');
  await callDirectAPI('directgtd_get_overdue_items', {
    response_format: 'markdown'
  });

  // Test 2: Get items due today
  console.log('\n2. Testing directgtd_get_due_today');
  console.log('-----------------------------------');
  await callDirectAPI('directgtd_get_due_today', {
    response_format: 'markdown'
  });

  // Test 3: Get items due tomorrow
  console.log('\n3. Testing directgtd_get_due_tomorrow');
  console.log('--------------------------------------');
  await callDirectAPI('directgtd_get_due_tomorrow', {
    response_format: 'markdown'
  });

  // Test 4: Get items due this week
  console.log('\n4. Testing directgtd_get_due_this_week');
  console.log('---------------------------------------');
  await callDirectAPI('directgtd_get_due_this_week', {
    response_format: 'markdown'
  });

  // Test 5: Test with JSON format
  console.log('\n5. Testing JSON output format');
  console.log('------------------------------');
  await callDirectAPI('directgtd_get_overdue_items', {
    response_format: 'json'
  });

  // Test 6: Test including completed items
  console.log('\n6. Testing with include_completed=true');
  console.log('---------------------------------------');
  await callDirectAPI('directgtd_get_overdue_items', {
    include_completed: true,
    response_format: 'markdown'
  });

  console.log('\n✅ All tests completed!');
}

// Run tests
testDueDateFunctions().catch(console.error);