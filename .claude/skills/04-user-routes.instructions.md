---
applyTo: "app/api/user/**"
---

# ALTFit — User API Routes

## Routes

- `PATCH /api/user/profile` — update name, avatar, styleProfiles, styleIssues
- `PATCH /api/user/onboarding` — set onboarded=true + styleProfiles + styleIssues
- `GET /api/user/subscription` — return current plan from Subscription table
- `POST /api/user/account` — account deletion

## Profile Update Pattern

Only update fields explicitly provided — use spread of conditionals:

```typescript
const updated = await prisma.user.update({
  where: { id: userId },
  data: {
    ...(name !== undefined && { name }),
    ...(avatar !== undefined && { avatar }),
    ...(styleProfiles !== undefined && { styleProfiles }),
    ...(styleIssues !== undefined && { styleIssues }),
  },
  select: { id: true, email: true, name: true, avatar: true, provider: true,
            onboarded: true, styleProfiles: true, styleIssues: true },
});
```

## Onboarding Pattern

```typescript
await prisma.user.update({
  where: { id: userId },
  data: { onboarded: true, styleProfiles, styleIssues },
});
```

## Subscription Check

```typescript
const sub = await prisma.subscription.findFirst({
  where: { userId, status: "active" },
  orderBy: { createdAt: "desc" },
});
const plan = sub?.plan ?? "free";
```

## Security

- Never expose `passwordHash` in any user response
- Account deletion: delete all sessions first, then cascade via Prisma (User has `onDelete: Cascade` on all relations)
