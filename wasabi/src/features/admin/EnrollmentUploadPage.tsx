import { useRef } from 'react';
import { Upload, Trash2, AlertCircle, CheckCircle, Database, Download, Save, RefreshCw } from 'lucide-react';
import * as XLSX from 'xlsx';
import { db } from '../../lib/db';
import { attendanceAdapter } from '../../lib/adapters/attendance-adapter';
import { gradesAdapter } from '../../lib/adapters/grades-adapter';
import { disciplineAdapter } from '../../lib/adapters/discipline-adapter';
import { iReadyMathAdapter } from '../../lib/adapters/iready-math-adapter';
import { iReadyReadingAdapter } from '../../lib/adapters/iready-reading-adapter';
import { FastZipAdapter } from '../../lib/adapters/fast-zip';
import { EnhancedFastZipAdapter } from '../../lib/adapters/enhanced-fast-zip-adapter';
import { FastScienceZipAdapter } from '../../lib/adapters/fast-science-zip';
import { FastWritingZipAdapter } from '../../lib/adapters/fast-writing-zip';
import { databaseBackupService } from '../../services/databaseBackupService';
import { clearFASTWritingData, clearFASTScienceData } from '../../utils/clearWritingData';

interface DatasetUploadRowProps {
  dataset: DatasetInfo;
  onUpload: (file: File) => void;
  onDelete: () => void;
  disabled: boolean;
}

function DatasetUploadRow({ dataset, onUpload, onDelete, disabled }: DatasetUploadRowProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    onUpload(file);
    event.target.value = ''; // Reset input
  };

  return (
    <div className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
      <div className="flex items-center gap-4">
        <div className="flex-1">
          <h3 className="font-medium text-gray-900 dark:text-white">
            {dataset.name}
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Expected format: {dataset.fileType}
          </p>
        </div>
      </div>
      
      <div className="flex items-center gap-4">
        {dataset.uploaded ? (
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-green-600">
              <CheckCircle size={20} />
              <span className="text-sm">
                Uploaded {dataset.uploadDate?.toLocaleDateString()}
              </span>
            </div>
            <button
              onClick={onDelete}
              disabled={disabled}
              className="p-2 text-red-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title={`Delete ${dataset.name} data`}
            >
              <Trash2 size={16} />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={disabled}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Upload size={16} />
              Upload
            </button>
            <button
              onClick={onDelete}
              disabled={disabled}
              className="p-2 text-red-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title={`Clear ${dataset.name} data (if any)`}
            >
              <Trash2 size={16} />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept={dataset.fileType}
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>
        )}
      </div>
    </div>
  );
}

interface ConsoleMessage {
  type: 'info' | 'success' | 'error' | 'warning';
  message: string;
  timestamp: Date;
}

interface EnrollmentStudent {
  wasabiId: string;
  dcpsId: string;
  flId: string;
  firstName: string;
  lastName: string;
  grade: string;
  homeRoomTeacher: string;
  gender: 'male' | 'female' | 'other' | 'undisclosed';
  birthdate: string;
}

interface DatasetInfo {
  id: string;
  name: string;
  fileType: string;
  uploaded: boolean;
  uploadDate?: Date;
}

interface EnrollmentUploadPageProps {
  isUploaded: boolean;
  setIsUploaded: (uploaded: boolean) => void;
  isProcessing: boolean;
  setIsProcessing: (processing: boolean) => void;
  consoleMessages: ConsoleMessage[];
  setConsoleMessages: React.Dispatch<React.SetStateAction<ConsoleMessage[]>>;
  datasets: DatasetInfo[];
  setDatasets: React.Dispatch<React.SetStateAction<DatasetInfo[]>>;
  clearAllStoredData: () => void;
}

export default function EnrollmentUploadPage({
  isUploaded,
  setIsUploaded,
  isProcessing,
  setIsProcessing,
  consoleMessages,
  setConsoleMessages,
  datasets,
  setDatasets,
  clearAllStoredData
}: EnrollmentUploadPageProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const backupImportRef = useRef<HTMLInputElement>(null);
  const consoleEndRef = useRef<HTMLDivElement>(null);

  const addConsoleMessage = (type: ConsoleMessage['type'], message: string) => {
    setConsoleMessages(prev => [...prev, { type, message, timestamp: new Date() }]);
    setTimeout(() => {
      consoleEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 10);
  };

  // Database Backup Functions
  const handleExportDatabase = async () => {
    try {
      setIsProcessing(true);
      addConsoleMessage('info', '📦 Starting database export...');
      
      const blob = await databaseBackupService.exportDatabase();
      const counts = await databaseBackupService.getDatabaseCounts();
      
      addConsoleMessage('success', `✅ Database exported successfully!`);
      addConsoleMessage('info', `📊 Exported: ${counts.studentCount} students, ${counts.assessmentCount} assessments, ${counts.attendanceCount} attendance records`);
      
      databaseBackupService.downloadBackup(blob);
    } catch (error) {
      addConsoleMessage('error', `❌ Export failed: ${(error as Error).message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleImportDatabase = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    try {
      setIsProcessing(true);
      addConsoleMessage('info', '📥 Starting database import...');
      
      // Ask user if they want to replace or merge
      const replaceExisting = window.confirm(
        'Do you want to REPLACE all existing data?\n\n' +
        'Click OK to replace all data\n' +
        'Click Cancel to merge with existing data'
      );
      
      await databaseBackupService.importDatabase(file, replaceExisting);
      const counts = await databaseBackupService.getDatabaseCounts();
      
      addConsoleMessage('success', `✅ Database imported successfully!`);
      addConsoleMessage('info', `📊 Current totals: ${counts.studentCount} students, ${counts.assessmentCount} assessments, ${counts.attendanceCount} attendance records`);
      
      // Refresh the page to reload data
      setTimeout(() => {
        window.location.reload();
      }, 2000);
      
    } catch (error) {
      addConsoleMessage('error', `❌ Import failed: ${(error as Error).message}`);
    } finally {
      setIsProcessing(false);
      event.target.value = ''; // Reset input
    }
  };


  const clearEnrollmentData = async () => {
    try {
      addConsoleMessage('info', 'Clearing existing enrollment data...');
      await db.students.clear();
      addConsoleMessage('success', 'Enrollment data cleared successfully');
      setIsUploaded(false);
      setConsoleMessages([]);
    } catch (error) {
      addConsoleMessage('error', `Failed to clear data: ${error}`);
    }
  };

  const clearAllDatabases = async () => {
    try {
      setConsoleMessages([]);
      addConsoleMessage('warning', 'Starting complete database and storage wipe...');
      
      // Clear all tables
      await db.students.clear();
      addConsoleMessage('info', '✓ Students table cleared');
      
      await db.attendance.clear();
      addConsoleMessage('info', '✓ Attendance table cleared');
      
      await db.grades.clear();
      addConsoleMessage('info', '✓ Grades table cleared');
      
      await db.assessments.clear();
      addConsoleMessage('info', '✓ Assessments table cleared');
      
      await db.dataSources.clear();
      addConsoleMessage('info', '✓ Data sources table cleared');
      
      await db.matchingReports.clear();
      addConsoleMessage('info', '✓ Matching reports table cleared');
      
      await db.settings.clear();
      addConsoleMessage('info', '✓ Settings table cleared');
      
      addConsoleMessage('info', '✓ LocalStorage cleared');
      
      addConsoleMessage('success', 'All databases and stored data have been cleared successfully!');
      
      // Clear all stored data and reset to defaults
      clearAllStoredData();
    } catch (error) {
      addConsoleMessage('error', `Failed to clear databases: ${error}`);
    }
  };

  const processEnrollmentFile = async (file: File) => {
    setIsProcessing(true);
    setConsoleMessages([]);
    
    addConsoleMessage('info', `Starting to process file: ${file.name}`);
    
    try {
      // Read the Excel file
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      
      // Get the first worksheet
      const worksheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[worksheetName];
      
      // Convert to JSON with formula evaluation
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { 
        raw: false,
        defval: '', // Default value for empty cells
        blankrows: false // Skip blank rows
      });
      
      // Manually extract formula values if the regular parsing didn't work
      const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1:A1');
      const processedData = jsonData.map((row: any, rowIndex) => {
        const newRow = { ...row };
        
        // Check if Student ID and DCPS Student ID are empty, then try to get formula values
        if (!newRow['Student ID'] || newRow['Student ID'] === '') {
          const cellAddress = XLSX.utils.encode_cell({ r: rowIndex + 1, c: 3 }); // Column D
          const cell = worksheet[cellAddress];
          if (cell && cell.f) {
            // Extract the value from the formula (remove quotes)
            newRow['Student ID'] = cell.f.replace(/^"/, '').replace(/"$/, '');
          }
        }
        
        if (!newRow['DCPS Student ID'] || newRow['DCPS Student ID'] === '') {
          const cellAddress = XLSX.utils.encode_cell({ r: rowIndex + 1, c: 7 }); // Column H  
          const cell = worksheet[cellAddress];
          if (cell && cell.f) {
            // Extract the value from the formula (remove quotes)
            newRow['DCPS Student ID'] = cell.f.replace(/^"/, '').replace(/"$/, '');
          }
        }
        
        return newRow;
      });
      
      addConsoleMessage('info', `Found ${processedData.length} rows in Excel file`);
      
      // Clear existing students
      addConsoleMessage('info', 'Clearing existing enrollment data...');
      await db.students.clear();
      
      let successCount = 0;
      let failCount = 0;
      const failedRows: number[] = [];
      
      // Process each row
      for (let i = 0; i < processedData.length; i++) {
        const row = processedData[i] as any;
        const rowNum = i + 2; // Excel rows start at 1, plus header row
        
        try {
          // Extract fields with various possible column names
          const firstName = row['First'] || row['Firstname'] || row['First Name'] || '';
          const lastName = row['Last'] || row['Lastname'] || row['Last Name'] || '';
          const grade = row['Grade'] || row['Grade Level'] || '';
          // Try multiple columns for DCPS ID - it might be in different columns
          const dcpsId = row['DCPS Student ID'] || row['Student ID'] || row['DCPS ID'] || row['StudentID'] || row['ID'] || '';
          const flId = row['Florida Education Identifier'] || row['FL ID'] || row['FLEID'] || '';
          const homeRoomTeacher = row['Home Room Teacher'] || row['Homeroom Teacher'] || row['Teacher'] || '';
          const genderRaw = row['Gender'] || row['Sex'] || '';
          const birthdate = row['Birthdate'] || row['Date of Birth'] || row['DOB'] || '';
          
          // Parse gender to proper enum value
          let gender: 'male' | 'female' | 'other' | 'undisclosed' | undefined;
          if (genderRaw) {
            const genderStr = String(genderRaw).toLowerCase().trim();
            if (genderStr.includes('f') || genderStr.includes('female')) {
              gender = 'female';
            } else if (genderStr.includes('m') || genderStr.includes('male')) {
              gender = 'male';
            } else if (genderStr) {
              gender = 'other';
            }
          }
          
          // Log what we found for debugging the first few rows
          if (i < 3) {
            addConsoleMessage('info', `Row ${rowNum} raw data: ${JSON.stringify({
              firstName: firstName || '[empty]',
              lastName: lastName || '[empty]',
              dcpsId: dcpsId || '[empty]',
              flId: flId || '[empty]'
            })}`);
          }
          
          // Validate required fields - now we expect to have all three types of IDs
          if (!firstName || !lastName) {
            throw new Error(`Missing required name fields`);
          }
          
          if (!dcpsId && !flId) {
            throw new Error(`Missing both DCPS ID and FL ID - at least one identifier required`);
          }
          
          // Generate WASABI ID - prefer DCPS ID, then FL ID, then name-based
          let idBase;
          if (dcpsId && dcpsId.trim()) {
            idBase = dcpsId.trim();
          } else if (flId && flId.trim()) {
            idBase = flId.trim();
          } else {
            idBase = `${lastName}_${firstName}`.replace(/\s+/g, '_');
          }
          const wasabiId = `wasabi_${idBase}_${Date.now()}_${i}`;
          
          // Create student record
          const student: EnrollmentStudent = {
            wasabiId,
            dcpsId: String(dcpsId || '').trim(),
            flId: String(flId || '').trim(),
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            grade: String(grade).trim(),
            homeRoomTeacher: homeRoomTeacher.trim(),
            gender: gender || 'undisclosed',
            birthdate: birthdate.trim()
          };
          
          // Save to database
          await db.students.add({
            id: student.wasabiId,
            studentNumber: student.dcpsId || student.flId, // Use FL ID as fallback if no DCPS ID
            firstName: student.firstName,
            lastName: student.lastName,
            grade: student.grade,
            className: student.homeRoomTeacher,
            gender: student.gender,
            dateOfBirth: student.birthdate,
            flId: student.flId,
            flags: [],
            createdAt: new Date(),
            lastUpdated: new Date()
          });
          
          successCount++;
          addConsoleMessage('success', `✓ ${student.firstName} ${student.lastName} - Grade ${student.grade}`);
          
        } catch (error) {
          failCount++;
          failedRows.push(rowNum);
          addConsoleMessage('error', `✗ Row ${rowNum}: ${error}`);
        }
      }
      
      // Final report
      addConsoleMessage('info', '═══════════════════════════════════════');
      addConsoleMessage('info', 'IMPORT COMPLETE');
      addConsoleMessage('success', `Successfully imported: ${successCount} students`);
      if (failCount > 0) {
        addConsoleMessage('warning', `Failed rows: ${failCount} (rows: ${failedRows.join(', ')})`);
      }
      addConsoleMessage('info', '═══════════════════════════════════════');
      
      setIsUploaded(true);
      
    } catch (error) {
      addConsoleMessage('error', `Failed to process file: ${error}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDatasetUpload = async (datasetId: string, file: File) => {
    addConsoleMessage('info', `Starting upload for ${datasetId}: ${file.name}`);
    setIsProcessing(true);
    
    try {
      if (datasetId === 'attendance') {
        // Process attendance file
        addConsoleMessage('info', 'Processing attendance data...');
        const result = await attendanceAdapter.processFile(file);
        
        addConsoleMessage('info', '═══════════════════════════════════════');
        addConsoleMessage('info', 'ATTENDANCE PROCESSING COMPLETE');
        addConsoleMessage('success', `Total students processed: ${result.totalRows}`);
        addConsoleMessage('success', `Successfully matched: ${result.matchedRows} students`);
        
        if (result.unmatchedRows > 0) {
          addConsoleMessage('warning', `Unmatched students: ${result.unmatchedRows}`);
        }
        
        addConsoleMessage('success', `Attendance records created: ${result.processedRecords}`);
        addConsoleMessage('info', `Matching breakdown:`);
        addConsoleMessage('info', `  - DCPS ID matches: ${result.matchingReport.dcpsIdMatches}`);
        addConsoleMessage('info', `  - Name matches: ${result.matchingReport.nameMatches}`);
        addConsoleMessage('info', `  - No matches: ${result.matchingReport.noMatches}`);
        
        if (result.errors.length > 0) {
          addConsoleMessage('warning', `Errors: ${result.errors.length}`);
          result.errors.forEach(error => {
            addConsoleMessage('error', error);
          });
        }
        
        addConsoleMessage('info', '═══════════════════════════════════════');
      } else if (datasetId === 'grades') {
        // Process grades file
        addConsoleMessage('info', 'Processing grades data...');
        const result = await gradesAdapter.processFile(file);
        
        addConsoleMessage('info', '═══════════════════════════════════════');
        addConsoleMessage('info', 'GRADES PROCESSING COMPLETE');
        addConsoleMessage('success', `Total rows processed: ${result.totalRows}`);
        addConsoleMessage('success', `Valid course records: ${result.validRows}`);
        addConsoleMessage('success', `Successfully matched: ${result.matchedRows} records`);
        
        if (result.unmatchedRows > 0) {
          addConsoleMessage('warning', `Unmatched records: ${result.unmatchedRows}`);
        }
        
        addConsoleMessage('success', `Grade records created: ${result.processedRecords}`);
        addConsoleMessage('info', `Matching breakdown:`);
        addConsoleMessage('info', `  - DCPS ID matches: ${result.matchingReport.dcpsIdMatches}`);
        addConsoleMessage('info', `  - Name matches: ${result.matchingReport.nameMatches}`);
        addConsoleMessage('info', `  - No matches: ${result.matchingReport.noMatches}`);
        
        if (result.errors.length > 0) {
          addConsoleMessage('warning', `Errors: ${result.errors.length}`);
          result.errors.slice(0, 5).forEach(error => {
            addConsoleMessage('error', error);
          });
          if (result.errors.length > 5) {
            addConsoleMessage('warning', `... and ${result.errors.length - 5} more errors`);
          }
        }
        
        addConsoleMessage('info', '═══════════════════════════════════════');
      } else if (datasetId === 'discipline') {
        // Process discipline file
        addConsoleMessage('info', 'Processing discipline data...');
        const result = await disciplineAdapter.processFile(file);
        
        addConsoleMessage('info', '═══════════════════════════════════════');
        addConsoleMessage('info', 'DISCIPLINE PROCESSING COMPLETE');
        addConsoleMessage('success', `Total records processed: ${result.totalRows}`);
        addConsoleMessage('success', `Successfully matched: ${result.matchedRows} records`);
        
        if (result.unmatchedRows > 0) {
          addConsoleMessage('warning', `Unmatched records: ${result.unmatchedRows}`);
        }
        
        addConsoleMessage('success', `Discipline records created: ${result.processedRecords}`);
        addConsoleMessage('info', `Matching breakdown:`);
        addConsoleMessage('info', `  - DCPS ID matches: ${result.matchingReport.dcpsIdMatches}`);
        addConsoleMessage('info', `  - Name matches: ${result.matchingReport.nameMatches}`);
        addConsoleMessage('info', `  - No matches: ${result.matchingReport.noMatches}`);
        
        if (result.errors.length > 0) {
          addConsoleMessage('warning', `Errors: ${result.errors.length}`);
          result.errors.forEach(error => {
            addConsoleMessage('error', error);
          });
        }
        
        addConsoleMessage('info', '═══════════════════════════════════════');
      } else if (datasetId === 'iready-math') {
        // Process iReady Math file
        addConsoleMessage('info', 'Processing iReady Math assessment data...');
        const result = await iReadyMathAdapter.processFile(file);
        
        addConsoleMessage('info', '═══════════════════════════════════════');
        addConsoleMessage('info', 'IREADY MATH PROCESSING COMPLETE');
        addConsoleMessage('success', `Total records processed: ${result.totalRows}`);
        addConsoleMessage('success', `Successfully matched: ${result.matchedRows} records`);
        
        if (result.unmatchedRows > 0) {
          addConsoleMessage('warning', `Unmatched records: ${result.unmatchedRows}`);
        }
        
        addConsoleMessage('success', `Assessment records created: ${result.processedRecords}`);
        addConsoleMessage('info', `Matching breakdown:`);
        addConsoleMessage('info', `  - DCPS ID matches: ${result.matchingReport.dcpsIdMatches}`);
        addConsoleMessage('info', `  - Name matches: ${result.matchingReport.nameMatches}`);
        addConsoleMessage('info', `  - No matches: ${result.matchingReport.noMatches}`);
        
        if (result.errors.length > 0) {
          addConsoleMessage('warning', `Errors: ${result.errors.length}`);
          result.errors.slice(0, 5).forEach(error => {
            addConsoleMessage('error', error);
          });
          if (result.errors.length > 5) {
            addConsoleMessage('warning', `... and ${result.errors.length - 5} more errors`);
          }
        }
        
        addConsoleMessage('info', '═══════════════════════════════════════');
      } else if (datasetId === 'iready-reading') {
        // Process iReady Reading file
        addConsoleMessage('info', 'Processing iReady Reading assessment data...');
        const result = await iReadyReadingAdapter.processFile(file);
        
        addConsoleMessage('info', '═══════════════════════════════════════');
        addConsoleMessage('info', 'IREADY READING PROCESSING COMPLETE');
        addConsoleMessage('success', `Total records processed: ${result.totalRows}`);
        addConsoleMessage('success', `Successfully matched: ${result.matchedRows} records`);
        
        if (result.unmatchedRows > 0) {
          addConsoleMessage('warning', `Unmatched records: ${result.unmatchedRows}`);
        }
        
        addConsoleMessage('success', `Assessment records created: ${result.processedRecords}`);
        addConsoleMessage('info', `Matching breakdown:`);
        addConsoleMessage('info', `  - DCPS ID matches: ${result.matchingReport.dcpsIdMatches}`);
        addConsoleMessage('info', `  - Name matches: ${result.matchingReport.nameMatches}`);
        addConsoleMessage('info', `  - No matches: ${result.matchingReport.noMatches}`);
        
        if (result.errors.length > 0) {
          addConsoleMessage('warning', `Errors: ${result.errors.length}`);
          result.errors.slice(0, 5).forEach(error => {
            addConsoleMessage('error', error);
          });
          if (result.errors.length > 5) {
            addConsoleMessage('warning', `... and ${result.errors.length - 5} more errors`);
          }
        }
        
        addConsoleMessage('info', '═══════════════════════════════════════');
      } else if (datasetId.includes('fast-pm')) {
        // Process FAST ZIP file with enhanced standards extraction
        const fastZipAdapter = new EnhancedFastZipAdapter();
        addConsoleMessage('info', 'Processing FAST ZIP file with enhanced standards extraction...');
        
        const result = await fastZipAdapter.processFile(file, datasetId);
        
        addConsoleMessage('info', '═══════════════════════════════════════');
        addConsoleMessage('info', 'FAST ZIP PROCESSING COMPLETE');
        addConsoleMessage('success', `Total records processed: ${result.totalRows}`);
        addConsoleMessage('success', `Successfully matched: ${result.matchedRows} records`);
        
        if (result.unmatchedRows > 0) {
          addConsoleMessage('warning', `Unmatched records: ${result.unmatchedRows}`);
        }
        
        addConsoleMessage('success', `Assessment records created: ${result.processedRecords}`);
        addConsoleMessage('info', `Matching breakdown:`);
        addConsoleMessage('info', `  - DCPS ID matches: ${result.matchingReport.dcpsIdMatches}`);
        addConsoleMessage('info', `  - FL ID matches: ${result.matchingReport.flIdMatches}`);
        addConsoleMessage('info', `  - Name matches: ${result.matchingReport.nameMatches}`);
        addConsoleMessage('info', `  - No matches: ${result.matchingReport.noMatches}`);
        
        if (result.errors.length > 0) {
          addConsoleMessage('warning', `Errors: ${result.errors.length}`);
          result.errors.slice(0, 5).forEach(error => {
            addConsoleMessage('error', error);
          });
          if (result.errors.length > 5) {
            addConsoleMessage('info', `... and ${result.errors.length - 5} more errors`);
          }
        }
        
        addConsoleMessage('info', '═══════════════════════════════════════');
      } else if (datasetId.includes('fast-science')) {
        // Process FAST Science ZIP file
        const fastScienceAdapter = new FastScienceZipAdapter();
        addConsoleMessage('info', 'Processing FAST Science ZIP file...');
        
        const result = await fastScienceAdapter.processFile(file, datasetId);
        
        addConsoleMessage('info', '═══════════════════════════════════════');
        addConsoleMessage('info', 'FAST SCIENCE PROCESSING COMPLETE');
        addConsoleMessage('success', `Total records processed: ${result.totalRows}`);
        addConsoleMessage('success', `Successfully matched: ${result.matchedRows} records`);
        
        if (result.unmatchedRows > 0) {
          addConsoleMessage('warning', `Unmatched records: ${result.unmatchedRows}`);
        }
        
        addConsoleMessage('success', `Assessment records created: ${result.processedRecords}`);
        addConsoleMessage('info', `Matching breakdown:`);
        addConsoleMessage('info', `  - DCPS ID matches: ${result.matchingReport.dcpsIdMatches}`);
        addConsoleMessage('info', `  - FL ID matches: ${result.matchingReport.flIdMatches}`);
        addConsoleMessage('info', `  - Name matches: ${result.matchingReport.nameMatches}`);
        addConsoleMessage('info', `  - No matches: ${result.matchingReport.noMatches}`);
        
        if (result.errors.length > 0) {
          addConsoleMessage('warning', `Errors: ${result.errors.length}`);
          result.errors.slice(0, 5).forEach(error => {
            addConsoleMessage('error', error);
          });
          if (result.errors.length > 5) {
            addConsoleMessage('info', `... and ${result.errors.length - 5} more errors`);
          }
        }
        
        addConsoleMessage('info', '═══════════════════════════════════════');
      } else if (datasetId.includes('fast-writing')) {
        // Process FAST Writing ZIP file
        const fastWritingAdapter = new FastWritingZipAdapter();
        addConsoleMessage('info', 'Processing FAST Writing ZIP file...');
        
        const result = await fastWritingAdapter.processFile(file, datasetId);
        
        addConsoleMessage('info', '═══════════════════════════════════════');
        addConsoleMessage('info', 'FAST WRITING PROCESSING COMPLETE');
        addConsoleMessage('success', `Total records processed: ${result.totalRows}`);
        addConsoleMessage('success', `Successfully matched: ${result.matchedRows} records`);
        
        if (result.unmatchedRows > 0) {
          addConsoleMessage('warning', `Unmatched records: ${result.unmatchedRows}`);
        }
        
        addConsoleMessage('success', `Assessment records created: ${result.processedRecords}`);
        addConsoleMessage('info', `Matching breakdown:`);
        addConsoleMessage('info', `  - DCPS ID matches: ${result.matchingReport.dcpsIdMatches}`);
        addConsoleMessage('info', `  - FL ID matches: ${result.matchingReport.flIdMatches}`);
        addConsoleMessage('info', `  - Name matches: ${result.matchingReport.nameMatches}`);
        addConsoleMessage('info', `  - No matches: ${result.matchingReport.noMatches}`);
        
        if (result.errors.length > 0) {
          addConsoleMessage('warning', `Errors: ${result.errors.length}`);
          result.errors.slice(0, 5).forEach(error => {
            addConsoleMessage('error', error);
          });
          if (result.errors.length > 5) {
            addConsoleMessage('info', `... and ${result.errors.length - 5} more errors`);
          }
        }
        
        addConsoleMessage('info', '═══════════════════════════════════════');
      } else {
        // For other datasets, just mark as uploaded for now
        addConsoleMessage('info', `Dataset type '${datasetId}' - basic upload (processing not implemented yet)`);
      }
      
      // Mark dataset as uploaded
      setDatasets(prev => prev.map(dataset => 
        dataset.id === datasetId 
          ? { ...dataset, uploaded: true, uploadDate: new Date() }
          : dataset
      ));
      
      addConsoleMessage('success', `${datasetId} uploaded successfully!`);
      
    } catch (error) {
      addConsoleMessage('error', `Failed to process ${datasetId}: ${error}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDatasetDelete = async (datasetId: string) => {
    if (!confirm(`Are you sure you want to delete all ${datasetId} data? This action cannot be undone.`)) {
      return;
    }

    addConsoleMessage('info', `Deleting ${datasetId} data...`);
    setIsProcessing(true);
    
    try {
      // Delete data based on dataset type
      if (datasetId === 'attendance') {
        await db.attendance.clear();
        addConsoleMessage('success', 'Attendance data deleted successfully');
      } else if (datasetId === 'grades') {
        await db.grades.clear();
        addConsoleMessage('success', 'Grades data deleted successfully');
      } else if (datasetId === 'discipline') {
        await db.discipline.clear();
        addConsoleMessage('success', 'Discipline data deleted successfully');
      } else if (datasetId === 'iready-math') {
        await db.assessments.where('source').equals('iReady Math').delete();
        addConsoleMessage('success', 'iReady Math assessment data deleted successfully');
      } else if (datasetId === 'iready-reading') {
        await db.assessments.where('source').equals('iReady Reading').delete();
        addConsoleMessage('success', 'iReady Reading assessment data deleted successfully');
      } else if (datasetId === 'fast-reading') {
        await db.assessments.where('source').equals('FAST').where('subject').equals('Reading').delete();
        addConsoleMessage('success', 'FAST Reading assessment data deleted successfully');
      } else if (datasetId === 'fast-math') {
        await db.assessments.where('source').equals('FAST').where('subject').equals('Math').delete();
        addConsoleMessage('success', 'FAST Math assessment data deleted successfully');
      } else if (datasetId.includes('fast-writing')) {
        const result = await clearFASTWritingData();
        addConsoleMessage('success', `FAST Writing data deleted successfully - ${result.deleted} records removed`);
      } else if (datasetId.includes('fast-science')) {
        const result = await clearFASTScienceData();
        addConsoleMessage('success', `FAST Science data deleted successfully - ${result.deleted} records removed`);
      } else if (datasetId === 'star-reading') {
        await db.assessments.where('source').equals('STAR Reading').delete();
        addConsoleMessage('success', 'STAR Reading assessment data deleted successfully');
      } else if (datasetId === 'star-math') {
        await db.assessments.where('source').equals('STAR Math').delete();
        addConsoleMessage('success', 'STAR Math assessment data deleted successfully');
      } else if (datasetId.includes('fast-pm')) {
        // Delete FAST data for this test period
        const testPeriod = datasetId.includes('pm1') ? 'PM1' : datasetId.includes('pm2') ? 'PM2' : 'PM3';
        await db.assessments.where('source').equals('FAST').and(record => record.testPeriod === testPeriod).delete();
        addConsoleMessage('success', `FAST ${testPeriod} assessment data deleted successfully`);
      } else {
        addConsoleMessage('warning', `Delete operation not implemented for dataset: ${datasetId}`);
      }

      // Mark dataset as not uploaded
      setDatasets(prev => prev.map(dataset => 
        dataset.id === datasetId 
          ? { ...dataset, uploaded: false, uploadDate: undefined }
          : dataset
      ));

      addConsoleMessage('info', `${datasetId} deletion complete`);
      
    } catch (error) {
      console.error(`Error deleting ${datasetId} data:`, error);
      addConsoleMessage('error', `Failed to delete ${datasetId} data: ${error}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    // Check file type
    if (!file.name.match(/\.(xlsx?|xls)$/i)) {
      addConsoleMessage('error', 'Please select an Excel file (.xls or .xlsx)');
      return;
    }
    
    await processEnrollmentFile(file);
  };

  const getMessageColor = (type: ConsoleMessage['type']) => {
    switch (type) {
      case 'success': return 'text-green-400';
      case 'error': return 'text-red-400';
      case 'warning': return 'text-yellow-400';
      default: return 'text-gray-300';
    }
  };

  const getMessageIcon = (type: ConsoleMessage['type']) => {
    switch (type) {
      case 'success': return <CheckCircle size={14} className="inline mr-1" />;
      case 'error': return <AlertCircle size={14} className="inline mr-1" />;
      case 'warning': return <AlertCircle size={14} className="inline mr-1" />;
      default: return null;
    }
  };

  return (
    <div className="h-full flex">
      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-6xl">
          {/* Database Backup Section */}
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <Save className="w-5 h-5" />
              Database Backup & Restore
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-4 text-sm">
              Export or import complete database backups including all students, assessments, grades, attendance, SOBA observations, and flags.
            </p>
            
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <h3 className="font-medium text-gray-900 dark:text-white">
                      Complete Database Backup
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Includes all data: students, assessments, grades, attendance, SOBA notes, flags
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  {/* Export Database Button */}
                  <button
                    onClick={handleExportDatabase}
                    disabled={isProcessing}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Export complete database to JSON file"
                  >
                    <Download size={16} />
                    Export Database
                  </button>
                  
                  {/* Import Database Button */}
                  <button
                    onClick={() => backupImportRef.current?.click()}
                    disabled={isProcessing}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Import database from JSON backup file"
                  >
                    <RefreshCw size={16} />
                    Import Database
                  </button>
                  
                  {/* Hidden File Input */}
                  <input
                    ref={backupImportRef}
                    type="file"
                    accept=".json"
                    onChange={handleImportDatabase}
                    className="hidden"
                  />
                </div>
              </div>
              
              {/* Info Box */}
              <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                  <div className="text-sm text-blue-800 dark:text-blue-200">
                    <p className="font-medium mb-1">Backup Features:</p>
                    <ul className="list-disc list-inside space-y-1 text-xs">
                      <li><strong>Export:</strong> Downloads a complete backup as a JSON file with timestamp</li>
                      <li><strong>Import:</strong> Choose to replace all data or merge with existing data</li>
                      <li><strong>What's included:</strong> Students, assessments, attendance, grades, SOBA observations, flag rules</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          {/* Master Enrollment File Section */}
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              Master Enrollment File
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-4 text-sm">
              Upload the primary student enrollment file from FOCUS. This serves as the master index for all student records.
            </p>
          
          {/* Student Enrollment Row */}
          <div>
            <div className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <h3 className="font-medium text-gray-900 dark:text-white">
                    Student Enrollment
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Expected format: .xlsx, .xls
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-4">
                {isUploaded ? (
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 text-green-600">
                      <CheckCircle size={20} />
                      <span className="text-sm">
                        Uploaded and processed
                      </span>
                    </div>
                    <button
                      onClick={clearEnrollmentData}
                      disabled={isProcessing}
                      className="p-2 text-red-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Delete enrollment data"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isProcessing}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Upload size={16} />
                      {isProcessing ? 'Processing...' : 'Upload'}
                    </button>
                    <button
                      onClick={clearAllDatabases}
                      disabled={isProcessing}
                      className="p-2 text-red-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Clear all databases"
                    >
                      <Database size={16} />
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".xlsx,.xls"
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                  </div>
                )}
              </div>
            </div>
            
            {!isUploaded && (
              <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">
                  To generate a Student Enrollment file, run an advanced report within FOCUS. Select the following fields:
                </p>
                <ul className="list-disc list-inside text-sm text-gray-600 dark:text-gray-400 space-y-1 ml-2">
                  <li>Firstname</li>
                  <li>Lastname</li>
                  <li>Grade</li>
                  <li>Student ID / DCPS ID</li>
                  <li>Home Room Teacher</li>
                  <li>Gender</li>
                  <li>Birthdate</li>
                  <li>Florida Education Identifier (FL ID)</li>
                </ul>
                <p className="text-sm text-gray-700 dark:text-gray-300 mt-2">
                  Then, click the download button to download the enrollment report as an Excel file.
                </p>
              </div>
            )}
          </div>
          </div>

          {/* Dataset Files Section */}
          {isUploaded && (
            <div className="mt-8">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                Dataset Files
              </h2>
              <p className="text-gray-600 dark:text-gray-400 mb-6 text-sm">
                Upload additional datasets to be matched against the enrolled students.
              </p>
              
              <div className="space-y-3">
                {datasets.map((dataset) => (
                  <DatasetUploadRow
                    key={dataset.id}
                    dataset={dataset}
                    onUpload={(file) => handleDatasetUpload(dataset.id, file)}
                    onDelete={() => handleDatasetDelete(dataset.id)}
                    disabled={isProcessing}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Console View */}
      <div className="w-96 bg-gray-900 border-l border-gray-700 flex flex-col">
        <div className="p-3 border-b border-gray-700">
          <h3 className="text-sm font-mono text-gray-400">Console Output</h3>
        </div>
        <div className="flex-1 overflow-y-auto p-3 font-mono text-xs">
          {consoleMessages.map((msg, index) => (
            <div key={index} className={`mb-1 ${getMessageColor(msg.type)}`}>
              <span className="text-gray-500">
                [{msg.timestamp.toLocaleTimeString()}]
              </span>{' '}
              {getMessageIcon(msg.type)}
              {msg.message}
            </div>
          ))}
          <div ref={consoleEndRef} />
        </div>
      </div>
    </div>
  );
}