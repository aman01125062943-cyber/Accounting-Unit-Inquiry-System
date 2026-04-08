# Research: Custom Prefix Extraction Logic

## Problem Statement
Standard extraction logic fails when prefixes are complex or when the user wants a specific part of a delimited string. The requirement is to extract the content immediately following a user-defined prefix, delimited by the next separator.

## Technical Analysis

### Prefix Matching
- **Constraint**: Multiple prefixes may overlap (e.g., `Army-` and `Army-c-`).
- **Solution**: Sort custom prefixes by length in descending order before matching.
- **Implementation**: `prefixes.sort((a, b) => b.length - a.length)`.

### Extraction Regex/Logic
- **Scenario**: `Army-c-463-7-02-2026` with prefix `Army-c`.
- **Logic**:
  1. Find index of prefix.
  2. Substring from `index + prefix.length`.
  3. The result is `-463-7-02-2026`.
  4. Trim leading separators: `463-7-02-2026`.
  5. Split by separator ( `-`, `.`, `_`, space).
  6. Result: `['463', '7', '02', '2026']`.
  7. Take index 0: `463`.

### Fallback Mechanism
- If no prefix matches:
  1. Regex for 5+ digits: `/\d{5,}/`.
  2. If found, return it.
  3. Otherwise, return the first "word" before any separator.

## Decision: Robust Multi-Stage Extraction
We will implement a 3-stage extraction in `app.js`:
1. **Explicit Match**: Use sorted custom prefixes.
2. **Numeric Fallback**: Look for sequences of 5+ digits (handles standard numeric codes).
3. **Structure Fallback**: Take the first alphanumeric segment.

## Rationale
This approach allows users to be very specific with their prefixes (`Army-c-`) while keeping the system flexible enough to handle data without prefixes or with different separation styles.

## Alternatives Considered
- **Regex-only**: Too complex for non-technical users to manage in settings.
- **Fixed Position**: Doesn't work because prefixes vary in length and separators are not consistent.
