import { studentMatcher } from '../student-matcher';
import { db } from '../db';
import type { DisciplineRecord } from '../../shared/types';

export interface EnhancedDisciplineUploadResult {
  totalRows: number;
  validRows: number;
  matchedRows: number;
  unmatchedRows: number;
  processedRecords: number;
  errors: string[];
  disciplineSummary: {
    totalIncidents: number;
    uniqueStudents: number;
    topInfractions: Array<{infraction: string; count: number}>;
    severityBreakdown: Record<string, number>;
    avgActionsPerIncident: number;
  };
}

export class EnhancedDisciplineAdapter {
  async processFile(file: File): Promise<EnhancedDisciplineUploadResult> {
    console.log('⚖️ Starting enhanced discipline file processing...');
    
    const text = await file.text();
    const lines = text.split('\n');
    
    if (lines.length < 2) {
      throw new Error('File appears to be empty or invalid');
    }
    
    // Parse header
    const headers = this.parseCSVLine(lines[0]);
    const columnMap = this.mapColumns(headers);
    
    console.log('⚖️ Column mapping:', columnMap);
    
    const disciplineRecords: DisciplineRecord[] = [];
    let validRows = 0;
    let matchedRows = 0;
    let unmatchedRows = 0;
    const errors: string[] = [];
    
    // Process each incident row
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      try {
        const columns = this.parseCSVLine(line);
        if (columns.length < Math.max(...Object.values(columnMap)) + 1) continue;
        
        validRows++;
        
        const studentName = this.cleanValue(columns[columnMap.studentName]);
        const studentId = this.cleanValue(columns[columnMap.studentId]);
        const grade = this.cleanValue(columns[columnMap.grade]);
        
        // Match student
        const matchResult = await studentMatcher.findStudent({
          name: studentName,
          studentId: studentId,
          grade: grade
        });
        
        if (!matchResult.wasabiId) {
          unmatchedRows++;
          errors.push(`No match found for: ${studentName} (ID: ${studentId})`);
          continue;
        }
        
        matchedRows++;
        
        // Extract rich discipline data
        const incidentDate = this.parseDate(this.cleanValue(columns[columnMap.incidentDate]));
        const submissionDate = this.parseDate(this.cleanValue(columns[columnMap.submissionDate]));
        
        const record: DisciplineRecord = {
          studentId: matchResult.wasabiId,
          incidentDate: incidentDate,
          submissionDate: submissionDate,
          infractionCode: this.cleanValue(columns[columnMap.infractionCode]),
          infractionDescription: this.cleanValue(columns[columnMap.infractionDescription]),
          
          // Enhanced incident details
          reporter: this.cleanValue(columns[columnMap.reporter]),
          location: this.cleanValue(columns[columnMap.location]),
          incidentTime: this.cleanValue(columns[columnMap.incidentTime]),
          referralTime: this.cleanValue(columns[columnMap.referralTime]),
          incidentNarrative: this.cleanValue(columns[columnMap.incidentNarrative]),
          
          // Administrative actions and findings
          actionsTaken: this.cleanValue(columns[columnMap.actionsTaken]),
          adminFindings: this.cleanValue(columns[columnMap.adminFindings]),
          adminSummary: this.cleanValue(columns[columnMap.adminSummary]),
          administrator: this.cleanValue(columns[columnMap.administrator]),
          
          // Student and witness information
          studentStatement: this.cleanValue(columns[columnMap.studentStatement]),
          witnessStatement: this.cleanValue(columns[columnMap.witnessStatement]),
          
          // Previous interventions
          previousActions: this.cleanValue(columns[columnMap.previousActions]),
          parentContactResult: this.cleanValue(columns[columnMap.parentContactResult]),
          
          // Risk assessments and special circumstances
          threatAssessment: this.cleanValue(columns[columnMap.threatAssessment]) === 'Yes',
          threatAssessmentDate: this.parseDate(this.cleanValue(columns[columnMap.threatAssessmentDate])),
          hopeFormInitiated: this.cleanValue(columns[columnMap.hopeForm]) === 'Yes',
          hopeFormDate: this.parseDate(this.cleanValue(columns[columnMap.hopeFormDate])),
          
          // Severity indicators
          schoolRelatedArrest: this.cleanValue(columns[columnMap.arrest]) === 'Yes',
          alcoholUse: this.cleanValue(columns[columnMap.alcohol]) === 'Yes',
          drugUse: this.cleanValue(columns[columnMap.drugs]) === 'Yes',
          bullying: this.cleanValue(columns[columnMap.bullying]) === 'Yes',
          hateCrime: this.cleanValue(columns[columnMap.hateCrime]) === 'Yes',
          gangRelated: this.cleanValue(columns[columnMap.gangRelated]) === 'Yes',
          weaponUse: this.cleanValue(columns[columnMap.weaponUse]) === 'Yes',
          policeInvolved: this.cleanValue(columns[columnMap.police]) === 'Yes',
          
          // Action details
          actionTakenBy: this.cleanValue(columns[columnMap.actionTakenBy]),
          actionDaysCompleted: this.parseNumber(this.cleanValue(columns[columnMap.actionDaysCompleted])),
          actionLength: this.parseNumber(this.cleanValue(columns[columnMap.actionLength])),
          actionBeginDate: this.parseDate(this.cleanValue(columns[columnMap.actionBeginDate])),
          actionEndDate: this.parseDate(this.cleanValue(columns[columnMap.actionEndDate])),
          attendanceCode: this.cleanValue(columns[columnMap.attendanceCode]),
          actionNotes: this.cleanValue(columns[columnMap.actionNotes]),
          
          // Enhanced analytics
          severityLevel: this.calculateSeverityLevel(columns, columnMap),
          riskScore: this.calculateRiskScore(columns, columnMap),
          interventionType: this.categorizeIntervention(this.cleanValue(columns[columnMap.actionsTaken])),
          
          // Matching metadata
          matchedBy: matchResult.matchedBy,
          matchConfidence: matchResult.confidence,
          originalStudentId: studentId
        };
        
        disciplineRecords.push(record);
        
      } catch (error) {
        errors.push(`Error processing row ${i}: ${error}`);
      }
    }
    
    // Bulk insert records
    await db.discipline.bulkPut(disciplineRecords);
    
    // Generate summary statistics
    const summary = this.generateSummaryStatistics(disciplineRecords);
    
    const result: EnhancedDisciplineUploadResult = {
      totalRows: lines.length - 1,
      validRows,
      matchedRows,
      unmatchedRows,
      processedRecords: disciplineRecords.length,
      errors,
      disciplineSummary: summary
    };
    
    console.log('⚖️ Enhanced discipline processing complete:', result);
    return result;
  }
  
  private mapColumns(headers: string[]): Record<string, number> {
    const map: Record<string, number> = {};
    
    headers.forEach((header, index) => {
      const lower = header.toLowerCase();
      
      if (lower.includes('student') && !lower.includes('id') && !lower.includes('statement')) map.studentName = index;
      else if (lower.includes('student id')) map.studentId = index;
      else if (lower === 'grade') map.grade = index;
      else if (lower.includes('reporter')) map.reporter = index;
      else if (lower.includes('incident date')) map.incidentDate = index;
      else if (lower.includes('submission date')) map.submissionDate = index;
      else if (lower.includes('infraction') && lower.includes('code')) map.infractionCode = index;
      else if (lower.includes('incident') && !lower.includes('date') && !lower.includes('time')) map.infractionDescription = index;
      else if (lower.includes('location')) map.location = index;
      else if (lower.includes('incident time')) map.incidentTime = index;
      else if (lower.includes('referral time')) map.referralTime = index;
      else if (lower.includes('brief narrative') || lower.includes('incident narrative')) map.incidentNarrative = index;
      else if (lower.includes('action(s)') || lower.includes('actions taken')) map.actionsTaken = index;
      else if (lower.includes('admin findings')) map.adminFindings = index;
      else if (lower.includes('administrative summary')) map.adminSummary = index;
      else if (lower.includes('administrator') && !lower.includes('summary')) map.administrator = index;
      else if (lower.includes('student statement')) map.studentStatement = index;
      else if (lower.includes('witness statement')) map.witnessStatement = index;
      else if (lower.includes('previous actions')) map.previousActions = index;
      else if (lower.includes('parent contact result') || lower.includes('parent/guardian contact')) map.parentContactResult = index;
      else if (lower.includes('threat assessment') && !lower.includes('date')) map.threatAssessment = index;
      else if (lower.includes('threat assessment') && lower.includes('date')) map.threatAssessmentDate = index;
      else if (lower.includes('hope form') && !lower.includes('date')) map.hopeForm = index;
      else if (lower.includes('hope form') && lower.includes('date')) map.hopeFormDate = index;
      else if (lower.includes('arrest')) map.arrest = index;
      else if (lower.includes('alcohol')) map.alcohol = index;
      else if (lower.includes('drugs')) map.drugs = index;
      else if (lower.includes('bullying')) map.bullying = index;
      else if (lower.includes('hate crime')) map.hateCrime = index;
      else if (lower.includes('gang')) map.gangRelated = index;
      else if (lower.includes('weapon')) map.weaponUse = index;
      else if (lower.includes('police')) map.police = index;
      else if (lower.includes('action taken by')) map.actionTakenBy = index;
      else if (lower.includes('days completed')) map.actionDaysCompleted = index;
      else if (lower.includes('length of action')) map.actionLength = index;
      else if (lower.includes('date begins')) map.actionBeginDate = index;
      else if (lower.includes('date ends')) map.actionEndDate = index;
      else if (lower.includes('attendance code')) map.attendanceCode = index;
      else if (lower.includes('action record notes') || lower.includes('action notes')) map.actionNotes = index;
    });
    
    return map;
  }
  
  private parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    
    result.push(current);
    return result;
  }
  
  private cleanValue(value: string): string {
    if (!value) return '';
    return value.replace(/^[="']+|[="']+$/g, '').trim();
  }
  
  private parseDate(dateStr: string): Date | undefined {
    if (!dateStr) return undefined;
    
    try {
      // Handle various date formats
      const cleaned = dateStr.replace(/\s+\d{1,2}:\d{2}\s*(am|pm)/i, ''); // Remove time part
      const date = new Date(cleaned);
      return isNaN(date.getTime()) ? undefined : date;
    } catch {
      return undefined;
    }
  }
  
  private parseNumber(value: string): number | undefined {
    if (!value) return undefined;
    const num = parseFloat(value);
    return isNaN(num) ? undefined : num;
  }
  
  private calculateSeverityLevel(columns: string[], columnMap: Record<string, number>): number {
    let severity = 1; // Base severity
    
    // Increase severity based on various factors
    if (this.cleanValue(columns[columnMap.arrest]) === 'Yes') severity += 4;
    if (this.cleanValue(columns[columnMap.weaponUse]) === 'Yes') severity += 4;
    if (this.cleanValue(columns[columnMap.drugs]) === 'Yes') severity += 3;
    if (this.cleanValue(columns[columnMap.alcohol]) === 'Yes') severity += 3;
    if (this.cleanValue(columns[columnMap.bullying]) === 'Yes') severity += 2;
    if (this.cleanValue(columns[columnMap.hateCrime]) === 'Yes') severity += 3;
    if (this.cleanValue(columns[columnMap.gangRelated]) === 'Yes') severity += 3;
    if (this.cleanValue(columns[columnMap.threatAssessment]) === 'Yes') severity += 2;
    
    // Check action severity
    const action = this.cleanValue(columns[columnMap.actionsTaken])?.toLowerCase() || '';
    if (action.includes('expulsion')) severity += 4;
    else if (action.includes('suspension')) severity += 2;
    else if (action.includes('detention')) severity += 1;
    
    return Math.min(severity, 10); // Cap at 10
  }
  
  private calculateRiskScore(columns: string[], columnMap: Record<string, number>): number {
    let risk = 0;
    
    // Risk factors
    if (this.cleanValue(columns[columnMap.threatAssessment]) === 'Yes') risk += 20;
    if (this.cleanValue(columns[columnMap.hopeForm]) === 'Yes') risk += 15;
    if (this.cleanValue(columns[columnMap.weaponUse]) === 'Yes') risk += 25;
    if (this.cleanValue(columns[columnMap.drugs]) === 'Yes') risk += 20;
    if (this.cleanValue(columns[columnMap.alcohol]) === 'Yes') risk += 15;
    if (this.cleanValue(columns[columnMap.bullying]) === 'Yes') risk += 15;
    if (this.cleanValue(columns[columnMap.gangRelated]) === 'Yes') risk += 20;
    
    // Previous actions indicate pattern
    const previousActions = this.cleanValue(columns[columnMap.previousActions]);
    if (previousActions && previousActions.length > 50) risk += 10; // Lengthy previous actions
    
    return Math.min(risk, 100); // Cap at 100
  }
  
  private categorizeIntervention(action: string): string {
    if (!action) return 'None';
    
    const lower = action.toLowerCase();
    
    if (lower.includes('expulsion')) return 'Expulsion';
    if (lower.includes('suspension')) return 'Suspension';
    if (lower.includes('detention')) return 'Detention';
    if (lower.includes('conference')) return 'Conference';
    if (lower.includes('counseling') || lower.includes('guidance')) return 'Counseling';
    if (lower.includes('warning')) return 'Warning';
    if (lower.includes('contract')) return 'Behavioral Contract';
    if (lower.includes('alternative')) return 'Alternative Placement';
    
    return 'Other';
  }
  
  private generateSummaryStatistics(records: DisciplineRecord[]) {
    const uniqueStudents = new Set(records.map(r => r.studentId)).size;
    
    // Top infractions
    const infractionCounts: Record<string, number> = {};
    records.forEach(r => {
      const infraction = r.infractionDescription || r.infractionCode || 'Unknown';
      infractionCounts[infraction] = (infractionCounts[infraction] || 0) + 1;
    });
    
    const topInfractions = Object.entries(infractionCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([infraction, count]) => ({ infraction, count }));
    
    // Severity breakdown
    const severityBreakdown: Record<string, number> = {
      'Low (1-3)': 0,
      'Medium (4-6)': 0,
      'High (7-8)': 0,
      'Critical (9-10)': 0
    };
    
    records.forEach(r => {
      const severity = r.severityLevel || 1;
      if (severity <= 3) severityBreakdown['Low (1-3)']++;
      else if (severity <= 6) severityBreakdown['Medium (4-6)']++;
      else if (severity <= 8) severityBreakdown['High (7-8)']++;
      else severityBreakdown['Critical (9-10)']++;
    });
    
    // Average actions per incident
    const totalActions = records.filter(r => r.actionsTaken && r.actionsTaken.length > 0).length;
    const avgActionsPerIncident = records.length > 0 ? totalActions / records.length : 0;
    
    return {
      totalIncidents: records.length,
      uniqueStudents,
      topInfractions,
      severityBreakdown,
      avgActionsPerIncident: Math.round(avgActionsPerIncident * 100) / 100
    };
  }
}