import { db } from '../lib/db';

// Cache for compound IDs to avoid repeated lookups
const compoundIdCache = new Map<number, string>();

/**
 * Find the actual compound ID for a numeric student ID
 */
async function findCompoundId(numericStudentId: number): Promise<string | null> {
  if (compoundIdCache.has(numericStudentId)) {
    return compoundIdCache.get(numericStudentId) || null;
  }
  
  // Look in attendance table first (usually has the most records)
  const attendanceRecord = await db.attendance.filter(record => 
    typeof record.studentId === 'string' && record.studentId.includes(`_${numericStudentId}_`)
  ).first();
  
  if (attendanceRecord) {
    compoundIdCache.set(numericStudentId, attendanceRecord.studentId);
    return attendanceRecord.studentId;
  }
  
  // Try assessments table
  const assessmentRecord = await db.assessments.filter(record => 
    typeof record.studentId === 'string' && record.studentId.includes(`_${numericStudentId}_`)
  ).first();
  
  if (assessmentRecord) {
    compoundIdCache.set(numericStudentId, assessmentRecord.studentId);
    return assessmentRecord.studentId;
  }
  
  return null;
}

/**
 * Helper function to query data with multiple ID formats
 * First tries numeric and string IDs, then falls back to compound ID pattern matching
 */
export async function queryByStudentId<T>(
  table: any,
  numericStudentId: number
): Promise<T[]> {
  // First try direct queries with numeric and string IDs
  let results = await table.where('studentId').anyOf([numericStudentId, String(numericStudentId)]).toArray();
  
  // If no results found, find and use the compound ID
  if (results.length === 0) {
    const compoundId = await findCompoundId(numericStudentId);
    if (compoundId) {
      results = await table.where('studentId').equals(compoundId).toArray();
    }
  }
  
  return results;
}

/**
 * Helper function to count records with multiple ID formats
 */
export async function countByStudentId(
  table: any,
  numericStudentId: number
): Promise<number> {
  // First try direct queries with numeric and string IDs
  let count = await table.where('studentId').anyOf([numericStudentId, String(numericStudentId)]).count();
  
  // If no results found, try compound ID pattern search
  if (count === 0) {
    count = await table.filter((record: any) => 
      typeof record.studentId === 'string' && record.studentId.includes(`_${numericStudentId}_`)
    ).count();
  }
  
  return count;
}