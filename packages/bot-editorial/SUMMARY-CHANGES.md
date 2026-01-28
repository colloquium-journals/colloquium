# Editorial Bot: Summary Command Changes

## Summary

Updated the `@editorial-bot summary` command to show status, assigned editor, and assigned reviewers while removing the average score information.

## Changes Made

### 1. Updated Summary Content
**Before:**
```
📊 **Manuscript Review Summary**

**Status:** UNDER REVIEW
**Submitted:** 2024-01-15
**Progress:** 1/2 reviews completed
**Average Score:** 7.5/10
**Last Activity:** 2024-01-20
```

**After:**
```
📊 **Manuscript Review Summary**

**Status:** UNDER REVIEW
**Submitted:** 2024-01-15
**Assigned Editor:** editor@journal.org
**Assigned Reviewers:** reviewer1@uni.edu, reviewer2@inst.org
**Review Progress:** 1/2 reviews completed
**Last Activity:** 2024-01-20
```

### 2. Updated Detailed Format
- Changed "**Assigned Reviewers:**" section to "**Reviewer Status:**" to avoid duplication
- Maintains the individual reviewer status with completion indicators
- Keeps the "Next Steps" section unchanged

### 3. Data Structure Updates
- Added `assignedEditor` field to mock data
- Removed `averageScore` field from mock data
- Updated field names for clarity (`Progress` → `Review Progress`)

### 4. Updated Command Description
- **Before:** "Generate a summary of manuscript review progress"
- **After:** "Generate a summary showing status, assigned editor, and reviewers"

## Example Outputs

### Brief Format:
```bash
@editorial-bot summary
```

**Output:**
```
📊 **Manuscript Review Summary**

**Status:** UNDER REVIEW
**Submitted:** 2024-01-15
**Assigned Editor:** editor@journal.org
**Assigned Reviewers:** reviewer1@uni.edu, reviewer2@inst.org
**Review Progress:** 1/2 reviews completed
**Last Activity:** 2024-01-20
```

### Detailed Format:
```bash
@editorial-bot summary format="detailed"
```

**Output:**
```
📊 **Manuscript Review Summary**

**Status:** UNDER REVIEW
**Submitted:** 2024-01-15
**Assigned Editor:** editor@journal.org
**Assigned Reviewers:** reviewer1@uni.edu, reviewer2@inst.org
**Review Progress:** 1/2 reviews completed
**Last Activity:** 2024-01-20

**Reviewer Status:**
1. reviewer1@uni.edu - ✅ Complete
2. reviewer2@inst.org - ⏳ Pending

**Next Steps:**
- Wait for remaining 1 review(s)
- Follow up with pending reviewers if past deadline
```

## Key Improvements

### ✅ **More Useful Information**
- Shows who is responsible for editorial decisions
- Lists all assigned reviewers at a glance
- Clearer progress tracking

### ✅ **Removed Distracting Elements**
- No longer shows average score which may not be relevant early in review
- Focuses on actionable information (who's assigned, what's pending)

### ✅ **Better Organization**
- Clear separation between basic info and detailed status
- Logical flow from assignment to progress to next steps

## Testing

- ✅ All existing tests updated and passing (52/52 tests)
- ✅ New test added to verify specific content requirements
- ✅ Verified average score is properly removed
- ✅ Confirmed all new fields are present in output

## Backward Compatibility

- ✅ Command syntax unchanged (`@editorial-bot summary [format="brief|detailed"]`)
- ✅ Format parameter behavior preserved
- ✅ Response structure maintained for API consumers
- ✅ All permissions and usage patterns unchanged