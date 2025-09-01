# Global Instructor Name Mapping System

This system provides a **global, app-wide solution** for displaying custom instructor names while preserving original data. It works like the student name translation system in Nori - a top-layer filter that updates any mention of a teacher with the corrected name.

## How It Works

### 1. **React Context + Hook System**
The system uses React Context to provide instructor name translation throughout the entire app:

```tsx
// Wrap your app with the provider (already done in App.tsx)
<InstructorNameProvider>
  <YourApp />
</InstructorNameProvider>
```

### 2. **Simple Component Usage**
Use the `<InstructorName>` component anywhere you need to display an instructor name:

```tsx
import InstructorName from '../../shared/components/InstructorName';

// Automatically displays mapped name
<InstructorName originalName={student.homeRoomTeacher} />

// With custom styling
<InstructorName 
  originalName={observation.teacherName} 
  className="font-bold text-blue-600" 
/>

// With fallback text
<InstructorName 
  originalName={student.className} 
  fallback="No Teacher Assigned" 
/>
```

### 3. **Hook Usage for Custom Logic**
For custom components or data processing:

```tsx
import { useInstructorDisplayName, useInstructorDisplayNames } from '../../contexts/InstructorNameContext';

function MyComponent() {
  // Single name translation
  const displayName = useInstructorDisplayName(teacher.originalName);
  
  // Multiple names translation
  const displayNames = useInstructorDisplayNames([
    teacher1.name, 
    teacher2.name, 
    teacher3.name
  ]);
  
  return (
    <div>
      <h3>{displayName}</h3>
      <ul>
        {displayNames.map(name => <li key={name}>{name}</li>)}
      </ul>
    </div>
  );
}
```

## Automatic Integration

The system is **already integrated** into key areas:

### ✅ **Nori AI Assistant**
- SOBA observations show mapped teacher names
- Student data includes mapped homeroom teachers
- All instructor references are automatically translated

### ✅ **StudentDataRetrieval Service**
- Applies mappings to student homeroom teachers
- SOBA observation teacher names are mapped
- All data passed to Nori uses display names

### ✅ **Admin Panel**
- InstructorNames component manages the mappings
- Changes trigger global updates immediately
- Real-time preview of name changes

## Adding to New Components

### **Option 1: Use the Component (Recommended)**
```tsx
import InstructorName from '../../shared/components/InstructorName';

<InstructorName originalName={data.teacherName} />
```

### **Option 2: Use the Hook**
```tsx
import { useInstructorDisplayName } from '../../contexts/InstructorNameContext';

function MyComponent({ teacherName }) {
  const displayName = useInstructorDisplayName(teacherName);
  return <span>{displayName}</span>;
}
```

### **Option 3: Service Integration (for data processing)**
```tsx
import { instructorNameMappingService } from '../../services/instructorNameMapping';

// In async functions
const mappedData = await instructorNameMappingService.applyMappingsToStudents(students);

// For single names
const displayName = await instructorNameMappingService.getDisplayName(originalName);
```

## How Mappings Work

1. **Admin edits instructor name** in Admin Panel → InstructorNames component
2. **Service saves mapping** to database and notifies listeners
3. **React Context updates** automatically across the entire app  
4. **All components** using the system instantly show the new names
5. **Original data preserved** - mappings are a display-layer only

## Real-time Updates

When an admin changes an instructor name mapping:
1. ✅ **Search Results** update immediately
2. ✅ **Profile Cards** show new names
3. ✅ **Exam Analytics** displays mapped names
4. ✅ **Class Analytics** uses new names
5. ✅ **Flagging System** shows updated names
6. ✅ **Nori responses** include mapped names
7. ✅ **SOBA observations** display correctly

**No page refresh needed** - everything updates instantly!

## Integration Points

The system works everywhere instructor names appear:

- **Student Search Results** (`homeRoomTeacher`)
- **Profile Cards** (`homeRoomTeacher`, `className`)  
- **Exam Analytics** (teacher breakdowns)
- **Class Analytics** (teacher comparisons)
- **Flagging System** (teacher-based flags)
- **Nori AI Assistant** (all teacher references)
- **SOBA Observations** (`teacherName`)
- **SOBA Analytics** (teacher performance data)

## Benefits

✅ **Single Source of Truth** - One place to manage all instructor name mappings  
✅ **Preserves Original Data** - Database records remain unchanged  
✅ **Real-time Updates** - Changes appear instantly across the entire app  
✅ **Simple Implementation** - Just wrap with `<InstructorName>` component  
✅ **Automatic Integration** - Major systems already integrated  
✅ **No Special Cases** - Same pattern works everywhere  
✅ **Performance Optimized** - Uses React Context for efficient updates  

## Example Usage in Different Views

```tsx
// In Search Results
<InstructorName originalName={student.homeRoomTeacher} className="text-sm text-gray-600" />

// In Profile Cards  
<InstructorName originalName={student.className} className="font-semibold" />

// In Analytics Tables
<InstructorName originalName={row.teacherName} />

// In SOBA Observations
<InstructorName originalName={observation.teacherName} className="font-bold" />

// In Flagging Rules
<InstructorName originalName={flag.teacherContext} />
```

The system is **robust, simple, and comprehensive** - exactly what you requested for handling instructor name mappings across the entire application!