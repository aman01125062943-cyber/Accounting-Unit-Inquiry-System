# Quickstart: Custom Prefix Extraction

## Overview
This feature allows you to control exactly what numerical or reference code is extracted from your File Codes. This is particularly useful for complex formats like `Army-c-463-7...` where you want to isolate `463`.

## How to Configure

1. **Navigate to Settings**: Go to the "Database & Sync" tab.
2. **Locate Prefix Manager**: Find the field titled "📝 إدارة بادئات استخراج كود المرتد".
3. **Add Your Prefixes**: 
   - Type each prefix on a new line.
   - Example: `Army-c-` or `Army-`.
4. **Save**: Click the "Save" button.

## How it Works
- The system looks for your prefix first.
- If it finds `Army-c-463-7`, it stops at the prefix and looks at the next part.
- It identifies `463` because it's followed by a separator (`-`).
- Your Return Code column will now show `463` for that record.

## Automatic Fallback
If you don't define a prefix for a code like `8001012600651`, the system automatically detects the long numeric sequence (5+ digits) and displays it.

## Verification
You can see the results immediately in the "Returns" table after saving your settings.
