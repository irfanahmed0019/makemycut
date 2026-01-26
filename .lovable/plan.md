
# Plan: Fix Customer Name Display and Booking Flow

## Summary
This plan addresses three key issues:
1. **Salon Dashboard showing "Walk-in Customer"** - Fix the profile lookup to always show real customer names for logged-in users
2. **Service Selection visibility** - Already working correctly (no changes needed)
3. **Clean up fallback labels** - Remove "Walk-in Customer" label for authenticated bookings

---

## What Will Change

### 1. Salon Dashboard - Customer Name Display
**File:** `src/pages/SalonDashboard.tsx`

**Current behavior:**  
- Fetches customer name from `profiles` table using `booking.user_id`
- Falls back to "Walk-in Customer" if profile is empty

**Problem:**  
The fallback "Walk-in Customer" appears for logged-in users if:
- Profile query returns empty due to RLS policy restrictions
- Salon owners cannot read customer profiles

**Solution:**  
- Check RLS policies on the `profiles` table - salon owners need SELECT access to see customer names
- If RLS allows access: simply remove the fallback and show actual name
- If RLS restricts access: use a database function or modify RLS to allow salon owners to view names of customers who booked at their salon

### 2. Service Selection - Verification
**File:** `src/features/customer/components/ConfirmBooking.tsx`

**Current Status:** Already implemented correctly (lines 170-190)
- Services are fetched from database on component mount
- Radio button selection works
- First service is auto-selected by default

**Result:** No changes needed - service selection is visible and functional.

---

## Technical Details

### Step 1: Add RLS Policy for Salon Owners to View Customer Names
A new RLS policy will allow salon owners to SELECT from the `profiles` table ONLY for users who have bookings at their salon.

```text
Policy: "Salon owners can view customer profiles for their bookings"
Command: SELECT
Expression: EXISTS (
  SELECT 1 FROM bookings b
  INNER JOIN barbers bar ON b.barber_id = bar.id
  WHERE b.user_id = profiles.id
  AND bar.owner_id = auth.uid()
)
```

### Step 2: Update Salon Dashboard Logic
Remove the "Walk-in Customer" fallback since all bookings come from authenticated users.

**Before:**
```text
customer_name: customerName || 'Walk-in Customer'
```

**After:**
```text
customer_name: profile?.full_name || 'Customer'
```

The word "Customer" is a safety fallback that should never appear for valid bookings, but exists for edge cases.

### Step 3: Verification
- Confirm service selection renders correctly in customer booking flow
- Confirm payment and reviews sections remain removed (no changes)
- Test that dashboard shows real names

---

## Files to Modify

| File | Change Type | Description |
|------|-------------|-------------|
| Database (RLS) | Migration | Add SELECT policy on `profiles` for salon owners |
| `src/pages/SalonDashboard.tsx` | Edit | Remove "Walk-in Customer" fallback label |

---

## What Will NOT Change (Per Your Instructions)
- Payment logic (already removed from customer flow)
- Reviews/ratings (already removed)
- Dashboard layout structure
- Analytics tab
- Calendar logic
- Navigation

---

## Expected Outcome
1. Salon owners see real customer names (e.g., "Arjun Dx", "Prathyush")
2. "Walk-in Customer" label never appears for logged-in users
3. Service selection continues to work in customer booking flow
4. Booking flow works end-to-end
