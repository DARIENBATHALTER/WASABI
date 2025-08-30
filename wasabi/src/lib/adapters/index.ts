import type { DataSourceAdapter } from './base';
import { StudentEnrollmentAdapter } from './student-enrollment';
import { AttendanceAdapter } from './attendance';
import { GradesAdapter } from './grades';
import { IReadyReadingAdapter } from './iready-reading';
import { IReadyMathAdapter } from './iready-math';
import { FastReadingAdapter } from './fast-reading';
import { FastMathAdapter } from './fast-math';
import { EnhancedFASTAdapter } from './enhanced-fast-adapter';
import { StarEarlyLiteracyAdapter } from './star-early-literacy';
import { StarMathAdapter } from './star-math';
import { Achieve3000Adapter } from './achieve3000';

// Registry of all available adapters  
const adapters = {
  'student-enrollment': new StudentEnrollmentAdapter(),
  attendance: new AttendanceAdapter(),
  grades: new GradesAdapter(),
  'iready-reading': new IReadyReadingAdapter(),
  'iready-math': new IReadyMathAdapter(),
  'fast-reading': new FastReadingAdapter(),
  'fast-math': new FastMathAdapter(),
  'star-early-literacy': new StarEarlyLiteracyAdapter(),
  'star-math': new StarMathAdapter(),
  achieve3000: new Achieve3000Adapter(),
} as const;

export type DataSourceType = keyof typeof adapters;

export function getDataAdapter(type: DataSourceType): DataSourceAdapter {
  const adapter = adapters[type];
  if (!adapter) {
    throw new Error(`Unknown data source type: ${type}`);
  }
  return adapter;
}

export function getAvailableAdapters(): Array<{ type: DataSourceType; adapter: DataSourceAdapter }> {
  return Object.entries(adapters).map(([type, adapter]) => ({
    type: type as DataSourceType,
    adapter,
  }));
}

export * from './base';
export * from './student-enrollment';
export * from './attendance';
export * from './grades';
export * from './iready-reading';
export * from './iready-math';
export * from './fast-reading';
export * from './fast-math';
export * from './enhanced-fast-adapter';
export * from './star-early-literacy';
export * from './star-math';
export * from './achieve3000';