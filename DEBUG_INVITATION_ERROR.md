# Debugging Invitation Creation Error

## Error
`Error creating invitation: {code: '42501', details: null, hint: null, message: 'new row violates row-level security policy for table "org_invites"'}`

## Troubleshooting Steps

### 1. Verify Your User Role
Check that you have the correct role in the organization:
```sql
SELECT 
    om.organization_id,
    om.user_id,
    om.role,
    o.name as org_name
FROM organization_members om
JOIN organizations o ON o.id = om.organization_id
WHERE om.user_id = auth.uid();
```

### 2. Verify Policy Exists
```sql
SELECT policyname, cmd, with_check
FROM pg_policies
WHERE tablename = 'org_invites' AND cmd = 'INSERT';
```

### 3. Test the Policy Logic
```sql
-- Replace with your actual organization_id
SELECT 
    EXISTS (
        SELECT 1
        FROM public.organization_members m
        WHERE m.organization_id = 'YOUR_ORG_ID_HERE'
          AND m.user_id = auth.uid()
          AND m.role IN ('owner'::user_role, 'admin'::user_role, 'supervisor'::user_role)
    ) as can_create_invite;
```

### 4. Check Browser Console
- Open browser DevTools (F12)
- Go to Console tab
- Try creating an invitation
- Look for the exact error message
- Check if `auth.uid()` is returning a value

### 5. Verify Authentication
```javascript
// In browser console, run:
const { data: { user } } = await supabase.auth.getUser();
console.log('Current user:', user);
```

## Common Issues

1. **User not authenticated**: Make sure you're logged in
2. **Wrong role**: You must be owner, admin, or supervisor
3. **Not a member**: You must be a member of the organization
4. **RLS blocking organization_members check**: The policy check should work, but if not, we may need to adjust

## Current Policy

The policy allows INSERT if:
- User is authenticated
- User is a member of the organization
- User has role: owner, admin, or supervisor

## Next Steps

If the issue persists:
1. Check the browser console for the exact error
2. Verify your role in the database
3. Try testing the policy directly in Supabase SQL Editor
4. Check if there are any other RLS policies interfering

