import { db } from '../lib/db';

export async function clearFASTWritingData() {
  try {
    console.log('🗑️ Clearing old FAST Writing records...');
    
    // Get all FAST Writing records
    const writingRecords = await db.assessments
      .filter(record => record.source === 'FAST' && record.subject === 'Writing')
      .toArray();
    
    console.log(`Found ${writingRecords.length} FAST Writing records to delete`);
    
    // Delete them by ID
    const idsToDelete = writingRecords.map(r => r.id).filter(id => id !== undefined);
    
    if (idsToDelete.length > 0) {
      await db.assessments.bulkDelete(idsToDelete);
      console.log(`✅ Deleted ${idsToDelete.length} FAST Writing records`);
    }
    
    // Verify deletion
    const remainingRecords = await db.assessments
      .filter(record => record.source === 'FAST' && record.subject === 'Writing')
      .count();
    
    console.log(`📊 Remaining FAST Writing records: ${remainingRecords}`);
    
    return {
      deleted: idsToDelete.length,
      remaining: remainingRecords
    };
  } catch (error) {
    console.error('❌ Error clearing FAST Writing data:', error);
    throw error;
  }
}

// Also create a function to clear FAST Science data if needed
export async function clearFASTScienceData() {
  try {
    console.log('🗑️ Clearing old FAST Science records...');
    
    // Get all FAST Science records
    const scienceRecords = await db.assessments
      .filter(record => record.source === 'FAST' && record.subject === 'Science')
      .toArray();
    
    console.log(`Found ${scienceRecords.length} FAST Science records to delete`);
    
    // Delete them by ID
    const idsToDelete = scienceRecords.map(r => r.id).filter(id => id !== undefined);
    
    if (idsToDelete.length > 0) {
      await db.assessments.bulkDelete(idsToDelete);
      console.log(`✅ Deleted ${idsToDelete.length} FAST Science records`);
    }
    
    // Verify deletion
    const remainingRecords = await db.assessments
      .filter(record => record.source === 'FAST' && record.subject === 'Science')
      .count();
    
    console.log(`📊 Remaining FAST Science records: ${remainingRecords}`);
    
    return {
      deleted: idsToDelete.length,
      remaining: remainingRecords
    };
  } catch (error) {
    console.error('❌ Error clearing FAST Science data:', error);
    throw error;
  }
}