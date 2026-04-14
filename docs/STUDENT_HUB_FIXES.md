# Student Hub - Comprehensive Fixes Needed

## Database

- [x] Add photo_url column (DONE)

## UI/UX Fixes Required

### 1. Profile Modal Positioning

- Add `window.scrollTo(0, 0)` when opening modals
- Or use `window.requestAnimationFrame`

### 2. Gender-based Avatars

- Add fallback avatars:
  - Boys: Blue background, male icon
  - Girls: Pink/purple background, female icon

### 3. Class Name Display

- Check if `student.classes?.name` is being populated
- Verify relationship query includes `classes(name)`

### 4. Delete Function

- Find `confirmDelete` handler
- Fix database delete call

### 5. Name Change Save Issue

- Check `updateStudent` function
- Verify proper `supabase.from('students').update()` call

## Filters to Add

```typescript
const FILTERS = [
  { id: "all", label: "All Students" },
  { id: "male", label: "Boys" },
  { id: "female", label: "Girls" },
  { id: "by-age-10-12", label: "Age 10-12" },
  { id: "by-age-13-15", label: "Age 13-15" },
  { id: "by-location", label: "By Location" },
  { id: "by-position", label: "By Position" },
  { id: "alphabetical", label: "A-Z" },
  { id: "defaulters", label: "Fee Defaulters" },
];
```

## AI Box Improvements

- Add proper icons
- Make interactive
- Use real data from analytics

## Guidance Cards

- Convert to popup/modal
- Add close button
- Add animations

---

_Run migration 20260415_student_photos.sql first_
