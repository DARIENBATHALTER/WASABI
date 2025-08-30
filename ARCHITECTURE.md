# WASABI Architecture Design

## Overview
WASABI (Wide Array Student Analytics and Benchmarking Interface) is a charter school data analytics platform that aggregates multiple data sources into unified student profiles.

## Core Principles
1. **Simplicity First**: Avoid over-engineering and unnecessary abstraction
2. **Feature-Based Organization**: Group related code by feature, not by type
3. **Loose Coupling**: Minimize dependencies between modules
4. **Type Safety**: TypeScript throughout with strict mode
5. **Local-First**: All data processing happens client-side for privacy

## Tech Stack
- **Frontend Framework**: React 18+ with TypeScript
- **Build Tool**: Vite (fast, simple configuration)
- **Styling**: TailwindCSS + CSS Modules for component-specific styles
- **State Management**: Zustand (simpler than Context API, less boilerplate)
- **Data Storage**: IndexedDB via Dexie.js
- **Data Fetching**: React Query (caching, background updates)
- **Charts**: Recharts (more React-friendly than Chart.js)
- **Routing**: React Router v6
- **CSV Parsing**: Papa Parse
- **Icons**: Lucide React

## Project Structure
```
wasabi/
├── src/
│   ├── features/           # Feature-based modules
│   │   ├── students/       # Student profiles & search
│   │   ├── data-import/    # CSV import & processing
│   │   ├── analytics/      # Charts & visualizations
│   │   ├── reports/        # Report generation
│   │   ├── flagging/       # At-risk student flagging
│   │   └── admin/          # Admin panel
│   ├── shared/            # Shared utilities & components
│   │   ├── components/    # Reusable UI components
│   │   ├── hooks/         # Custom React hooks
│   │   ├── utils/         # Helper functions
│   │   └── types/         # Shared TypeScript types
│   ├── lib/               # Third-party integrations
│   │   ├── db/            # Database configuration
│   │   └── adapters/      # Data source adapters
│   ├── styles/            # Global styles & themes
│   └── App.tsx            # Root component
├── public/                # Static assets
└── config files...        # Vite, TypeScript, etc.
```

## Key Components

### 1. Data Layer
```typescript
// Simple adapter pattern for data sources
interface DataSourceAdapter {
  name: string;
  parseCSV(file: File): Promise<ParsedData>;
  validateData(data: ParsedData): ValidationResult;
  transformData(data: ParsedData): StudentRecord[];
}

// Each data source (FOCUS, iReady, FAST, etc.) implements this interface
```

### 2. State Management
```typescript
// Zustand stores for different domains
interface AppStore {
  // UI state
  theme: 'light' | 'dark';
  sidebarOpen: boolean;
  
  // Student data
  students: Student[];
  selectedStudent: Student | null;
  
  // Simple actions
  setTheme: (theme: 'light' | 'dark') => void;
  selectStudent: (id: string) => void;
}
```

### 3. Component Architecture
```typescript
// Composition-based components
<StudentCard>
  <StudentHeader student={student} />
  <DataModules>
    <AttendanceModule data={attendanceData} />
    <GradesModule data={gradesData} />
    <AssessmentModule source="iReady" data={iReadyData} />
  </DataModules>
</StudentCard>
```

## Data Flow
1. **Import**: User uploads CSV → Adapter parses → Validates → Transforms
2. **Storage**: Transformed data → IndexedDB (via Dexie)
3. **Query**: React Query fetches from IndexedDB → Caches in memory
4. **Display**: Components consume data via hooks → Render UI

## UI Architecture
- **Layout**: App shell with persistent sidebar and header
- **Routing**: Feature-based routes (/students, /reports, /analytics)
- **Styling**: Tailwind utilities + CSS modules for complex components
- **Theming**: CSS variables for colors, controlled by Zustand

## Security & Privacy
- No server communication (all client-side)
- Optional encryption for stored data
- CSV files never uploaded to any server
- Local authentication via IndexedDB

## Performance Optimizations
- Lazy load feature modules
- Virtual scrolling for large lists
- Memoized expensive calculations
- Background data processing with Web Workers
- Progressive data loading (show UI immediately, load data async)

## Testing Strategy
- Unit tests for data adapters and utilities
- Component tests with React Testing Library
- E2E tests for critical user flows (optional)

## Migration from Old Version
1. Start with core features only
2. Implement one data source at a time
3. Build UI incrementally
4. Add advanced features after core is stable