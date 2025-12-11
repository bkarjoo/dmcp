# DirectGTD MCP Server Documentation

Welcome to the DirectGTD MCP Server documentation. This MCP (Model Context Protocol) server provides read-only access to your DirectGTD task management database, allowing AI assistants to query and retrieve your task information.

## Table of Contents

### Quick Reference

**[Function Glossary](./function-glossary.md)** 📋 - Quick reference for all available functions

### For End Users

1. **[Getting Started](./getting-started.md)**
   - What is DirectGTD MCP Server?
   - What is MCP (Model Context Protocol)?
   - Prerequisites
   - Quick start guide

2. **[Installation](./installation.md)**
   - System requirements
   - Installing the server
   - Configuring with Claude Code
   - Configuring with Claude Desktop
   - Verifying installation

3. **[Usage Guide](./usage.md)**
   - Basic usage examples
   - Asking for your tasks
   - Understanding the output formats
   - Best practices
   - Common use cases

4. **[API Reference](./api-reference.md)**
   - Available tools (2 tools)
   - `directgtd_get_root_items` - Get top-level items
   - `directgtd_get_children` - Get items in a folder
   - Input parameters
   - Output formats
   - Response schemas

5. **[Troubleshooting](./troubleshooting.md)**
   - Common issues and solutions
   - Error messages explained
   - Database location issues
   - Permission problems
   - Getting help

### For Developers

6. **[Developer API Guide](./developer-api-guide.md)** ⭐ NEW
   - Quick start for developers
   - Complete API reference for both tools
   - Request/response examples
   - Code examples (TypeScript & Python)
   - Navigation patterns
   - Error handling
   - Best practices

7. **[Development Guide](./development.md)**
   - Setting up development environment
   - Project structure
   - Building from source
   - Running tests
   - Contributing guidelines
   - Architecture overview

## Quick Links

- **Source Code**: Located in `/src`
- **Tests**: Located in `/src/test.ts`
- **Build Output**: Located in `/dist` (after building)
- **DirectGTD Database Location**: `~/Library/Application Support/DirectGTD/directgtd.sqlite`

## About This Project

DirectGTD MCP Server is a read-only integration that allows LLMs and AI assistants to access your DirectGTD task management data through the Model Context Protocol. It's designed to be:

- **Safe**: Read-only access ensures your data is never modified
- **Simple**: Two focused tools for navigating your task hierarchy
- **Flexible**: Supports both human-readable (Markdown) and machine-readable (JSON) formats
- **Reliable**: Comprehensive error handling and testing

## Version

Current version: **1.1.0**

## License

MIT

## Support

For issues, questions, or contributions, please refer to the [Troubleshooting Guide](./troubleshooting.md) or the [Development Guide](./development.md).
