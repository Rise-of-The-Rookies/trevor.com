# RLS Policies Fix - user_presence Table

## Issue Fixed

**Error**: `POST https://frdyixpjtunzllewusfp.supabase.co/rest/v1/user_presence 403 (Forbidden)`

**Root Cause**: After enabling RLS on all tables, the `user_presence` table only had a SELECT policy. The application uses `upsert()` which requires both INSERT and UPDATE policies.

## Solution Applied

✅ **Migration Applied**: `add_user_presence_insert_update_policies`

### Policies Created

1. **INSERT Policy**: "Users can insert their own presence"
   - Allows authenticated users to insert their own presence record
   - Restriction: `user_id` must match `auth.uid()`

2. **UPDATE Policy**: "Users can update their own presence"
   - Allows authenticated users to update their own presence record
   - Restriction: `user_id` must match `auth.uid()` (both for reading and updating)

### Existing Policy

- **SELECT Policy**: "presence: read org peers"
  - Users can read their own presence
  - Users can read presence of other users in their organization

## Current Policy Status

| Operation | Policy Name | Status |
|-----------|-------------|--------|
| SELECT | presence: read org peers | ✅ Active |
| INSERT | Users can insert their own presence | ✅ Active |
| UPDATE | Users can update their own presence | ✅ Active |
| DELETE | (none) | ⚠️ Not needed |

## Verification

The `upsert()` operations in your application should now work:
- `OnlinePresence.tsx` - `updatePresence()`
- `OnlinePresence.tsx` - `setUserOnline()`
- `OnlinePresence.tsx` - `setUserOffline()`
- `OrganizationSelector.tsx` - Clock in/out operations

## Next Steps

If you encounter similar 403 errors on other tables, you'll need to create RLS policies for those tables as well. Common operations that need policies:

- **INSERT**: For creating new records
- **UPDATE**: For modifying existing records
- **DELETE**: For removing records (if needed)
- **SELECT**: Already exists for most tables, but verify

## Testing

Test the following in your deployed application:
1. ✅ Clock in/out functionality
2. ✅ Presence status updates
3. ✅ Online presence display
4. ✅ User status changes

The 403 error should now be resolved! 🎉

