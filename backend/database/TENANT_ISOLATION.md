# Tenant Isolation Checklist

This document outlines the tenant isolation requirements and best practices for the AltFit backend.

## Overview

Strict tenant isolation ensures users can only access their own data. This is enforced at multiple levels:

1. **Authentication** - Verify user identity
2. **Authorization** - Verify user owns the resource
3. **Database Queries** - Filter all queries by `userId`
4. **Audit Logging** - Monitor all data access

## Authentication & Authorization Pattern

All API endpoints must follow this pattern:

```typescript
export async function GET(request: NextRequest) {
  // Step 1: Authenticate the request
  const authError = authenticateRequest(request);
  if (authError) return authError;

  // Step 2: Extract authenticated user ID
  const userId = getAuthenticatedUserId(request);

  // Step 3: Get the resource from database
  const resource = await prisma.model.findUnique({
    where: { id },
  });

  // Step 4: Verify tenant ownership
  if (!resource || !isUserAuthorized(userId, resource.userId)) {
    return errorResponse("Unauthorized", 403);
  }

  // Step 5: Return resource to user
  return successResponse(resource, "Success");
}
```

## Common Patterns by Operation Type

### GET Single Resource

```typescript
// ✓ CORRECT: Verify ownership
const resource = await prisma.model.findUnique({ where: { id } });
if (!isUserAuthorized(userId, resource.userId)) {
  return errorResponse("Unauthorized", 403);
}
```

### GET List (Collection)

```typescript
// ✓ CORRECT: Filter by userId in query
const resources = await prisma.model.findMany({
  where: { userId }, // implicit tenant isolation
});
```

### CREATE

```typescript
// ✓ CORRECT: Always set userId from authenticated user
const created = await prisma.model.create({
  data: {
    userId, // from getAuthenticatedUserId()
    // ... other fields from request body
  },
});
```

### UPDATE

```typescript
// ✓ CORRECT: Verify ownership AND filter by userId
const updated = await prisma.model.updateMany({
  where: { id, userId }, // double-check userId
  data: {
    /* ... */
  },
});
```

### DELETE (Bulk)

```typescript
// ✓ CORRECT: Always include userId in where clause
const { count } = await prisma.wardrobeItem.deleteMany({
  where: { id: { in: ids }, userId }, // critical for bulk ops
});
```

### DELETE (Cascade Patterns)

```typescript
// ✓ CORRECT: Verify user owns the parent resource
const user = await prisma.user.findUnique({ where: { id: userId } });
if (!user) return errorResponse("User not found", 404);

// Delete will cascade via foreign keys
await prisma.user.delete({ where: { id: userId } });
```

## Anti-Patterns to Avoid

### ❌ DON'T: Query without userId

```typescript
// WRONG: No tenant isolation
const item = await prisma.wardrobeItem.findMany({
  where: { category: "top" }, // Missing userId filter!
});
```

### ❌ DON'T: Skip authorization checks

```typescript
// WRONG: No ownership verification
const item = await prisma.wardrobeItem.findUnique({ where: { id } });
return successResponse(item); // Never checked userId!
```

### ❌ DON'T: Trust client-provided IDs

```typescript
// WRONG: Using client data for user ID
const targetUserId = req.body.userId; // NEVER trust client input!
```

### ❌ DON'T: Bulk operations without isolation

```typescript
// WRONG: Could delete other users' items
await prisma.wardrobeItem.deleteMany({ where: { id: { in: ids } } });
// Missing: userId check!
```

## Audit Logging

The Prisma middleware automatically logs:

- All create, update, delete operations
- The userId associated with each operation
- Warnings for bulk operations without userId filters

Check logs for:

```
[Audit] WardrobeItem.deleteMany | userId: user123 | duration: 45ms
[Audit] Outfit.create | userId: user456 | duration: 12ms
[Warning] Bulk operation without userId filter: WardrobeItem.updateMany
```

## Database Schema Enforcement

The Prisma schema enforces relationships:

- `WardrobeItem.userId` - references `User.id` with `onDelete: Cascade`
- `Outfit.userId` - references `User.id` with `onDelete: Cascade`
- `Subscription.userId` - unique constraint ensures 1:1 relationship

This means:

- Deleting a user cascades to all their data
- Every resource must have a valid userId
- No orphaned data can exist

## Testing Tenant Isolation

When testing any endpoint, verify:

1. ✓ Authenticated user CAN access their own resources
2. ✗ Cannot access other users' resources without their token
3. ✗ Cannot update the userId field in requests
4. ✗ Bulk operations only affect own resources
5. ✗ Cannot bypass checks with crafted requests

## Checklist for New Endpoints

- [ ] All endpoints start with `authenticateRequest(request)`
- [ ] All endpoints extract userId with `getAuthenticatedUserId(request)`
- [ ] All database queries filter by `userId`
- [ ] All single-resource reads verify ownership with `isUserAuthorized()`
- [ ] All updates/deletes include `userId` in where clause
- [ ] No userId information is accepted from request body (only from token)
- [ ] Error responses don't leak information about other users' resources
- [ ] Bulk operations explicitly verify ownership

## Related Files

- [auth-middleware.ts](./auth-middleware.ts) - Authentication utilities
- [tenant.ts](./tenant.ts) - Tenant isolation helpers
- [prisma.ts](./prisma.ts) - Prisma client with audit logging middleware
