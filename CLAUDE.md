# WASABI Development Instructions

## Data Import System Rebuild (December 2024)

### Master Index: Student Enrollment File
The student enrollment file serves as the master index for all student matching. Only students in this file will appear in search results.

### Key Matching Fields
Students can be matched using three key data points:

1. **Name** (Two columns in enrollment: First, Last)
   - Primary fallback when no ID is available
   - Various formats in other datasets:
     - Single column with "Last, First"
     - Single column with "First Last"
     - Two columns (First, Last)
     - Reversed order columns
   - Special parsing required for each format

2. **DCPS ID / Student ID** (8-digit number)
   - These two fields should contain the same value
   - Most reliable for matching when present
   - Used across most district datasets
   - NOTE: May be empty in some enrollment files

3. **FL ID** (14-character alphanumeric starting with "FL")
   - Primary identifier for FAST testing datasets
   - Format: FL + 12 characters (e.g., "FL000010787857")
   - May be the ONLY identifier available in enrollment

### Enrollment File Requirements
Source: FOCUS Advanced Report
Required fields:
- Firstname
- Lastname  
- Grade
- Student ID / DCPS ID
- Home Room Teacher
- Gender
- Birthdate
- Florida Education Identifier (FL ID)

File format: Excel (.xls or .xlsx)
Reference file: `/Users/darien/Desktop/Development/WASABI : SOBA/WASABI-Reboot/24-25 Datasets/24-25 Enrollment (INC FL ID).xls`

### Implementation Notes
- Show console/debug view on right side during upload
- Display each student's name and grade as processed
- Show final report: successful vs failed rows
- After successful upload, replace upload button with delete button
- All matching logic should check against enrollment master index

### Dataset Matching Strategy
1. Try exact match on DCPS ID (if present)
2. Try exact match on FL ID (if present)
3. Fall back to name matching with fuzzy logic
4. Record confidence level for each match
5. Flag unmatched records for review

## Progress Tracking
See REBOOT_STATUS.md for current implementation status

## Development Workflow
After completing each prompt, notify via macOS say command:
```bash
say "Darien, your changes are done"
```