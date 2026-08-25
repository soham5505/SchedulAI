# Batch Duplicate Cleanup & Re-Import Guide

## Problem Summary

Your database contains batch-duplicated teaching assignments from the old imports:
- **BEIT 7th Semester**: 60 periods (should be ~30-40)
- **SEIT 3rd Semester**: 101 periods (should be ~50-70)
- **TEIT 5th Semester**: 96 periods (should be 74)

These duplicates exist because the old import process created separate assignment records for each batch variant (B1, B2, B3, B4, W1, W2, W3, W4, etc.).

## Solution Overview

There are **3 steps** to fix this:

### Step 1: Run the Cleanup Script (Dry Run First)

The cleanup script will identify and remove duplicate assignments while keeping the first occurrence.

#### 1a. Review what will be deleted (SAFE - Dry Run)

```bash
# In terminal, from SchedulAI root directory
cd d:\SchedulAI
npm run ts-node -- apps/api/src/scripts/cleanup-batch-duplicates.ts
```

This will:
- Show all duplicate assignment groups
- List which ones would be deleted
- NOT actually delete anything (dry run only)

**Expected output**:
```
Duplicate found: 4 assignments
  Teacher: Prof. John Doe
  Subject: DevOps Lab
  Semester: TEIT 5th Semester
  Periods per week: 8, 8, 8, 8
  Action: Keep 1st, DELETE 3 others
```

#### 1b. Review the dry run results carefully

- Look for duplicates with identical periodsPerWeek (e.g., 8, 8, 8, 8)
- These are batch variants that should be consolidated
- If all 4 copies have the same value, they're definitely duplicates

### Step 2: Enable Actual Deletion

Once you've verified the dry run output is correct:

1. Open: `apps/api/src/scripts/cleanup-batch-duplicates.ts`
2. Find the comment: `// STEP 2: Uncomment below to actually perform deletion`
3. Uncomment the deletion code block (lines with `await TeachingAssignmentModel.findByIdAndDelete...`)
4. Run the script again:

```bash
npm run ts-node -- apps/api/src/scripts/cleanup-batch-duplicates.ts
```

**BACKUP YOUR DATABASE FIRST!** This operation deletes records.

### Step 3: Re-Import the Excel File (Updated Logic)

After cleanup, re-import your Excel file using the updated import logic:

1. Go to **Admin > Imports**
2. Upload your original Excel file
3. The improved batch detection will now:
   - Detect batch identifiers in the course code (B1-B4, W1-W4, etc.)
   - Detect batch patterns in other row fields
   - Consolidate variants into a single assignment
   - Log each consolidation

**Expected logs during import**:
```
Batch consolidation: Row 45 skipped, using row 42 for DEVOPS_LAB
Batch consolidation: Row 46 skipped, using row 42 for DEVOPS_LAB
Batch consolidation: Row 47 skipped, using row 42 for DEVOPS_LAB
Batch consolidation: 12 batch variants consolidated during import
```

### Step 4: Generate Timetable (Verify Fix)

After re-importing, generate the timetable:

1. Go to **Generate > Create New Generation**
2. Select the semesters (BEIT 7th, SEIT 3rd, TEIT 5th)
3. Click **Generate**

**Expected diagnostics output** (in logs/console):
```
SEMESTER WORKLOAD ANALYSIS:

Semester: TEIT 5th Semester (A)
  Theory Weekly Periods: 22
  Lab Weekly Periods: 52
  Total Weekly Periods Required: 74  ✓ (NOT 96)
  Active Time Slots Available: 40

Semester: SEIT 3rd Semester (A)
  Total Weekly Periods Required: ~50-70  ✓ (NOT 101)

Semester: BEIT 7th Semester (A)
  Total Weekly Periods Required: ~30-40  ✓ (NOT 60)
```

---

## Troubleshooting

### Q: Script won't run / "ts-node not found"

**A**: Make sure Node dependencies are installed:
```bash
cd d:\SchedulAI
npm install
```

### Q: Still seeing high period counts after cleanup + re-import?

**A**: The batch identifier might be in a column our detection doesn't recognize:
- Can you share a sample of your Excel file structure?
- Show which column contains batch info (B1, B2, etc.)
- Show the course code column

Then we can update the batch detection regex.

### Q: Cleanup script shows 0 duplicates found?

**A**: Either:
1. Duplicates have already been cleaned up
2. Batch variants are stored differently than expected (different periodsPerWeek values, etc.)
3. Batch info is in a separate column that wasn't imported

Run the script and check the total assignment count. If it's reasonable, you might just need to re-import.

### Q: I want to just start fresh

**A**: You can clear all teaching assignments and re-import:

```bash
# ⚠️  WARNING: This deletes ALL teaching assignments. Backup first!
# In MongoDB Compass or mongo shell:
db.teachingassignments.deleteMany({})
```

Then re-import your Excel file.

---

## Summary of Fixes

1. ✅ **Old duplicates cleaned**: One assignment per (teacher, subject, semester)
2. ✅ **Improved batch detection**: Checks both course code AND row data
3. ✅ **Generation deduplication**: Safety net prevents duplicates from reaching solver
4. ✅ **Teacher workload**: No hard weekly limit from UI defaults
5. ✅ **Diagnostics**: Clear output shows actual vs required periods

After these steps, your timetable generation should show:
- **TEIT 5th Semester**: 74 periods ✓
- **SEIT 3rd Semester**: Correct consolidated total ✓
- **BEIT 7th Semester**: Correct consolidated total ✓

---

## Questions?

1. **What does your Excel batch column look like?**
   - Show a sample with 2-3 rows
   - Is the batch info in course code or separate column?

2. **After cleanup, does import log "Batch consolidation" messages?**
   - If no, the batch detection isn't triggering

3. **Do you still see violations after these steps?**
   - Share the exact violation message
   - We can refine the batch detection further

