import { db } from '../lib/db';
import type { StandardPerformance, TestAnalytics, TestType } from '../shared/types/examAnalytics';

class ExamAnalyticsService {
  async getTestAnalytics(testType: TestType): Promise<TestAnalytics | null> {
    try {
      const [source, subject, grade] = this.parseTestType(testType);
      
      // Query assessments from database based on test type
      const allRecords = await db.assessments
        .filter(record => {
          // Handle subject matching - support both "MATH"/"Math" and "ELA"/"Reading"
          const recordSubject = record.subject?.toLowerCase();
          const searchSubject = subject.toLowerCase();
          
          const subjectMatch = recordSubject === searchSubject || 
                              (searchSubject === 'math' && (recordSubject === 'mathematics' || recordSubject === 'math')) ||
                              (searchSubject === 'ela' && (recordSubject === 'reading' || recordSubject === 'ela' || recordSubject === 'early literacy')) ||
                              (searchSubject === 'writing' && recordSubject === 'writing') ||
                              (searchSubject === 'science' && recordSubject === 'science');
          
          // Handle different sources
          const sourceMatch = source === 'FAST' 
            ? record.source?.includes('FAST')
            : record.source?.toLowerCase().includes(source.toLowerCase());
          
          return sourceMatch && 
                 subjectMatch && 
                 record.gradeLevel === grade;
        })
        .toArray();

      console.log(`🔍 Found ${allRecords.length} ${source} ${subject} Grade ${grade} records (before standards filter)`);
      
      if (allRecords.length > 0) {
        const withStandards = allRecords.filter(r => r.standardsPerformance);
        const withoutStandards = allRecords.filter(r => !r.standardsPerformance);
        console.log(`📊 ${withStandards.length} have standards data, ${withoutStandards.length} do not`);
        
        if (withoutStandards.length > 0) {
          console.log(`⚠️ Sample record without standards:`, {
            source: withoutStandards[0].source,
            subject: withoutStandards[0].subject,
            gradeLevel: withoutStandards[0].gradeLevel,
            hasStandardsPerformance: !!withoutStandards[0].standardsPerformance,
            allKeys: Object.keys(withoutStandards[0])
          });
        }
      }

      // Handle different data structures for different test types
      const isWritingTest = subject.toLowerCase() === 'writing';
      const isScienceTest = subject.toLowerCase() === 'science';
      const isIReadyTest = source === 'IREADY';
      
      let assessments: any[];
      let dataField: string;
      
      if (isIReadyTest) {
        // iReady uses scale scores (stored as 'score') and percentiles for time-based tracking
        assessments = allRecords.filter(record => 
          record.score && record.percentile && record.normingWindow
        );
        dataField = 'scale scores, percentiles, and norming windows';
        
        // For iReady, we'll process data differently - focus on time series and growth
        return this.processIReadyAnalytics(assessments, testType, source, subject, grade);
      } else if (isWritingTest || isScienceTest) {
        // FAST Writing/Science use categoryPerformances
        assessments = allRecords.filter(record => record.categoryPerformances);
        dataField = 'category performances';
      } else {
        // FAST ELA/Math use standardsPerformance
        assessments = allRecords.filter(record => record.standardsPerformance);
        dataField = 'standards';
      }

      if (assessments.length === 0) {
        console.log(`❌ No ${source} ${subject} Grade ${grade} data with ${dataField} found in database`);
        console.log(`💡 You need to re-upload ${source} datasets to get ${dataField} data`);
        return null;
      }

      console.log(`Found ${assessments.length} ${source} ${subject} Grade ${grade} assessment records`);

      // Extract all unique standards from the assessment data
      const standardsMap = new Map<string, {
        category: string;
        students: Array<{
          studentName: string;
          studentId: string;
          pointsEarned: number;
          pointsPossible: number;
          percentage: number;
        }>;
        totalPointsEarned: number;
        totalPointsPossible: number;
      }>();

      // Process each assessment record
      for (const assessment of assessments) {
        // Get performance data based on test type
        let performanceData: any;
        
        if (isIReadyTest) {
          // For iReady, create synthetic performance data from domain scores
          performanceData = this.extractIReadyDomainScores(assessment, subject);
        } else if (isWritingTest || isScienceTest) {
          performanceData = assessment.categoryPerformances;
        } else {
          performanceData = assessment.standardsPerformance;
        }
        
        if (!performanceData) continue;

        // Get actual student name from enrollment database
        const student = await db.students.get(assessment.studentId);
        const studentName = student 
          ? `${student.lastName}, ${student.firstName}` 
          : assessment.originalStudentId || assessment.studentId;
        
        if (!student) {
          console.log(`⚠️ Could not find student for ID: ${assessment.studentId}, using FL ID: ${assessment.originalStudentId}`);
        }
        
        if (isIReadyTest) {
          // For iReady tests, process domain scores
          Object.entries(performanceData).forEach(([domainName, domainData]: [string, any]) => {
            if (!standardsMap.has(domainName)) {
              standardsMap.set(domainName, {
                category: 'iReady Reading Domain',
                students: [],
                totalPointsEarned: 0,
                totalPointsPossible: 0
              });
            }
            const standardData = standardsMap.get(domainName)!;
            
            const pointsEarned = domainData.pointsEarned || 0;
            const pointsPossible = domainData.pointsPossible || 100;
            const percentage = domainData.masteryPercentage || 0;

            standardData.students.push({
              studentName,
              studentId: String(assessment.studentId),
              pointsEarned,
              pointsPossible,
              percentage
            });

            standardData.totalPointsEarned += pointsEarned;
            standardData.totalPointsPossible += pointsPossible;
          });
        } else if (isWritingTest || isScienceTest) {
          // For Writing and Science tests, process categoryPerformances as standards
          Object.entries(performanceData).forEach(([categoryName, score]: [string, any]) => {
            if (!standardsMap.has(categoryName)) {
              standardsMap.set(categoryName, {
                category: this.extractCategoryFromStandard(categoryName),
                students: [],
                totalPointsEarned: 0,
                totalPointsPossible: 0
              });
            }

            const standardData = standardsMap.get(categoryName)!;
            let pointsEarned = 0;
            let pointsPossible = 4;
            let percentage = 0;
            
            // Handle different scoring systems
            if (isWritingTest) {
              // For Writing modes, assume score is out of 4 or convert to percentage
              const numericScore = parseFloat(String(score)) || 0;
              const scoreOutOf4 = numericScore <= 4 ? numericScore : numericScore / 25; // Convert if it's a percentage
              pointsEarned = scoreOutOf4;
              percentage = Math.round((scoreOutOf4 / 4) * 100);
            } else if (isScienceTest) {
              // For Science domains, convert text performance to numeric
              const scienceScore = this.convertSciencePerformanceToScore(String(score));
              pointsEarned = scienceScore.points;
              pointsPossible = scienceScore.total;
              percentage = Math.round((pointsEarned / pointsPossible) * 100);
            }

            standardData.students.push({
              studentName,
              studentId: assessment.studentId,
              pointsEarned,
              pointsPossible,
              percentage
            });

            standardData.totalPointsEarned += pointsEarned;
            standardData.totalPointsPossible += pointsPossible;
          });
        } else {
          // For regular FAST tests, process standardsPerformance
          Object.entries(performanceData).forEach(([standardCode, performance]: [string, any]) => {
            if (!standardsMap.has(standardCode)) {
              standardsMap.set(standardCode, {
                category: this.extractCategoryFromStandard(standardCode),
                students: [],
                totalPointsEarned: 0,
                totalPointsPossible: 0
              });
            }

            const standardData = standardsMap.get(standardCode)!;
            const percentage = Math.round(performance.masteryPercentage || 0);

            standardData.students.push({
              studentName,
              studentId: assessment.studentId,
              pointsEarned: performance.pointsEarned || 0,
              pointsPossible: performance.pointsPossible || 0,
              percentage
            });

            standardData.totalPointsEarned += performance.pointsEarned || 0;
            standardData.totalPointsPossible += performance.pointsPossible || 0;
          });
        }
      }

      // Convert to StandardPerformance objects, filtering out invalid standards
      const standardsPerformance: StandardPerformance[] = Array.from(standardsMap.entries())
        .filter(([standardCode]) => {
          // Filter out invalid standard codes
          const code = standardCode.toLowerCase().trim();
          return code !== 'nan' && 
                 code !== 'n/a' &&
                 code !== 'na' &&
                 code !== 'n.a.' &&
                 code !== 'n.a' &&
                 code !== 'benchmark' && 
                 code !== 'category' &&
                 !code.includes('undefined') &&
                 !code.includes('n/a') &&
                 !code.includes('na') &&
                 standardCode.trim() !== '' &&
                 standardCode.toLowerCase() !== 'n/a';
        })
        .map(([standardCode, data]) => {
        const averagePercentage = data.totalPointsPossible > 0 
          ? Math.round((data.totalPointsEarned / data.totalPointsPossible) * 100)
          : 0;

        return {
          standardCode,
          standardDescription: this.getStandardDescription(standardCode),
          category: data.category,
          studentsCount: data.students.length,
          averageScore: data.totalPointsPossible > 0 ? data.totalPointsEarned / data.totalPointsPossible : 0,
          averagePercentage,
          pointsEarned: data.totalPointsEarned,
          pointsPossible: data.totalPointsPossible,
          studentScores: data.students
        };
      });

      // Sort by average performance (lowest first for intervention prioritization)
      standardsPerformance.sort((a, b) => a.averagePercentage - b.averagePercentage);

      // Calculate category averages
      const categoryAverages: Record<string, number> = {};
      const categoryGroups: Record<string, number[]> = {};
      
      standardsPerformance.forEach(standard => {
        if (!categoryGroups[standard.category]) {
          categoryGroups[standard.category] = [];
        }
        categoryGroups[standard.category].push(standard.averagePercentage);
      });
      
      Object.entries(categoryGroups).forEach(([category, percentages]) => {
        categoryAverages[category] = Math.round(percentages.reduce((a, b) => a + b, 0) / percentages.length);
      });

      const overallAverage = standardsPerformance.length > 0 
        ? Math.round(standardsPerformance.reduce((sum, s) => sum + s.averagePercentage, 0) / standardsPerformance.length)
        : 0;

      // Count unique students
      const uniqueStudents = new Set(assessments.map(a => a.studentId)).size;

      // Calculate time series data by test period
      const timeSeriesMap = new Map<string, { scores: number[], percentiles: number[], studentIds: Set<string> }>();
      
      allRecords.forEach(assessment => {
        const period = this.normalizeTestPeriod(assessment.testPeriod);
        if (!period) return;
        
        if (!timeSeriesMap.has(period)) {
          timeSeriesMap.set(period, { scores: [], percentiles: [], studentIds: new Set() });
        }
        
        const data = timeSeriesMap.get(period)!;
        if (assessment.score && assessment.score > 0) {
          data.scores.push(assessment.score);
        }
        if (assessment.percentile && assessment.percentile > 0) {
          data.percentiles.push(assessment.percentile);
        }
        data.studentIds.add(assessment.studentId);
      });

      const timeSeriesData = Array.from(timeSeriesMap.entries())
        .map(([period, data]) => ({
          period,
          averageScaleScore: data.scores.length > 0 
            ? Math.round(data.scores.reduce((a, b) => a + b, 0) / data.scores.length)
            : 0,
          averagePercentile: data.percentiles.length > 0 
            ? Math.round(data.percentiles.reduce((a, b) => a + b, 0) / data.percentiles.length)
            : 0,
          studentCount: data.studentIds.size
        }))
        .sort((a, b) => {
          // Sort PM1, PM2, PM3
          const order = { 'PM1': 1, 'PM2': 2, 'PM3': 3 };
          return (order[a.period as keyof typeof order] || 999) - (order[b.period as keyof typeof order] || 999);
        });

      return {
        testName: this.getTestName(testType),
        totalStudents: uniqueStudents,
        overallAverage,
        standardsPerformance,
        categoryAverages,
        timeSeriesData
      };

    } catch (error) {
      console.error(`Error getting test analytics for ${testType}:`, error);
      return null;
    }
  }

  private parseTestType(testType: TestType): [string, string, string] {
    const parts = testType.split('_');
    const source = parts[0]; // FAST or IREADY
    const subject = parts[1]; // ELA, MATH, WRITING, SCIENCE
    const grade = parts[2]; // K, 1, 2, 3, 4, 5
    return [source, subject, grade];
  }

  private extractCategoryFromStandard(standardCode: string): string {
    // Extract category from standard code patterns
    
    // B.E.S.T. Writing Mode categories
    if (standardCode === 'Purpose/Structure') return 'Writing Mode: Purpose/Structure';
    if (standardCode === 'Development') return 'Writing Mode: Development';
    if (standardCode === 'Language') return 'Writing Mode: Language';
    
    // Science Domain categories
    if (standardCode === 'Physical Science') return 'Science Domain: Physical Science';
    if (standardCode === 'Earth and Space Science') return 'Science Domain: Earth and Space Science';
    if (standardCode === 'Life Science') return 'Science Domain: Life Science';
    if (standardCode === 'Nature of Science') return 'Science Domain: Nature of Science';
    
    // ELA Reading categories
    if (standardCode.includes('R.1')) return 'Reading Prose and Poetry';
    if (standardCode.includes('R.2')) return 'Reading Informational Text';
    if (standardCode.includes('R.3')) return 'Reading Across Genres';
    if (standardCode.includes('V.1')) return 'Vocabulary';
    
    // Math categories
    if (standardCode.includes('OA.')) return 'Operations and Algebraic Thinking';
    if (standardCode.includes('NBT.')) return 'Number and Operations in Base Ten';
    if (standardCode.includes('NF.')) return 'Number and Operations - Fractions';
    if (standardCode.includes('MD.')) return 'Measurement and Data';
    if (standardCode.includes('G.')) return 'Geometry';
    
    // Default category extraction
    const parts = standardCode.split('.');
    if (parts.length >= 3) {
      return `${parts[0]} Domain ${parts[2]}`;
    }
    
    return 'Other';
  }

  private getStandardDescription(standardCode: string): string {
    // Comprehensive standard descriptions
    const descriptions: Record<string, string> = {
      // B.E.S.T. Writing Mode descriptions
      'Purpose/Structure': 'Opinion/Argumentative: Purpose and Structure',
      'Development': 'Opinion/Argumentative: Development and Elaboration',
      'Language': 'Opinion/Argumentative: Language Usage and Style',
      // Grade 3 ELA Standards
      'ELA.3.R.1.1': 'Ask and answer questions to demonstrate understanding of a text',
      'ELA.3.R.1.2': 'Recount stories and determine central message, lesson, or moral',
      'ELA.3.R.1.3': 'Describe characters and how their actions contribute to the sequence of events',
      'ELA.3.R.1.4': 'Determine the meaning of words and phrases in a text',
      'ELA.3.R.2.1': 'Ask and answer questions to demonstrate understanding of informational text',
      'ELA.3.R.2.2': 'Determine the main idea of a text and explain how details support it',
      'ELA.3.R.2.3': 'Describe the relationship between events, ideas, concepts, or steps',
      'ELA.3.R.2.4': 'Determine the meaning of domain-specific words and phrases',
      'ELA.3.R.3.1': 'Compare and contrast the themes, settings, and plots of stories',
      'ELA.3.R.3.2': 'Distinguish their own point of view from that of the narrator or characters',
      'ELA.3.R.3.3': 'Compare and contrast the most important points presented by two texts',
      'ELA.3.V.1.2': 'Determine the meaning of words using sentence-level context',
      'ELA.3.V.1.3': 'Acquire and use accurately grade-appropriate conversational, general academic, and domain-specific words',

      // Math Standards (example)
      'MAFS.3.OA.1.1': 'Interpret products of whole numbers',
      'MAFS.3.OA.1.2': 'Interpret whole-number quotients of whole numbers',
      'MAFS.3.OA.1.3': 'Use multiplication and division within 100 to solve word problems',
      'MAFS.3.OA.2.5': 'Apply properties of operations as strategies to multiply and divide',
      'MAFS.3.NBT.1.1': 'Use place value understanding to round whole numbers',
      'MAFS.3.NBT.2.2': 'Fluently add and subtract within 1000',
      'MAFS.3.NBT.2.3': 'Multiply one-digit whole numbers by multiples of 10',
      'MAFS.3.NF.1.1': 'Understand a fraction as a number on the number line',
      'MAFS.3.NF.1.2': 'Understand a fraction as a number on the number line; represent fractions on a number line diagram',
      'MAFS.3.NF.1.3': 'Explain equivalence of fractions and compare fractions by reasoning about their size',
      'MAFS.3.MD.1.1': 'Tell and write time to the nearest minute',
      'MAFS.3.MD.1.2': 'Measure and estimate liquid volumes and masses of objects',
      'MAFS.3.MD.2.3': 'Draw a scaled picture graph and a scaled bar graph',
      'MAFS.3.MD.2.4': 'Generate measurement data and display the data in a line plot',
      'MAFS.3.G.1.1': 'Understand that shapes may share attributes and the shared attributes can define a larger category'
    };

    return descriptions[standardCode] || standardCode;
  }

  private getTestName(testType: TestType): string {
    const testNames: Record<TestType, string> = {
      'FAST_ELA_K': 'FAST Early Literacy - Kindergarten',
      'FAST_ELA_1': 'FAST Early Literacy - Grade 1',
      'FAST_ELA_2': 'FAST Reading - Grade 2',
      'FAST_ELA_3': 'FAST ELA Reading - Grade 3',
      'FAST_ELA_4': 'FAST ELA Reading - Grade 4',
      'FAST_ELA_5': 'FAST ELA Reading - Grade 5',
      'FAST_MATH_K': 'FAST Mathematics - Kindergarten',
      'FAST_MATH_1': 'FAST Mathematics - Grade 1',
      'FAST_MATH_2': 'FAST Mathematics - Grade 2',
      'FAST_MATH_3': 'FAST Mathematics - Grade 3',
      'FAST_MATH_4': 'FAST Mathematics - Grade 4',
      'FAST_MATH_5': 'FAST Mathematics - Grade 5',
      'FAST_WRITING_4': 'FAST Writing - Grade 4',
      'FAST_WRITING_5': 'FAST Writing - Grade 5',
      'FAST_SCIENCE_5': 'FAST Science - Grade 5',
      'IREADY_ELA_K': 'iReady Reading - Kindergarten',
      'IREADY_ELA_1': 'iReady Reading - Grade 1',
      'IREADY_ELA_2': 'iReady Reading - Grade 2',
      'IREADY_ELA_3': 'iReady Reading - Grade 3',
      'IREADY_ELA_4': 'iReady Reading - Grade 4',
      'IREADY_ELA_5': 'iReady Reading - Grade 5'
    };

    return testNames[testType] || testType;
  }

  private convertSciencePerformanceToScore(performance: string): { points: number; total: number } {
    const perfLower = performance.toLowerCase();
    
    // Science performance levels typically include:
    // - "At/Near the Standard" or similar high performance
    // - "Below the Standard" or similar low performance
    
    if (perfLower.includes('at') && perfLower.includes('standard')) {
      return { points: 3, total: 4 }; // At/Near Standard = 75%
    } else if (perfLower.includes('above') || perfLower.includes('exceeds')) {
      return { points: 4, total: 4 }; // Above Standard = 100%
    } else if (perfLower.includes('below') && perfLower.includes('standard')) {
      return { points: 2, total: 4 }; // Below Standard = 50%
    } else if (perfLower.includes('approaching')) {
      return { points: 2.5, total: 4 }; // Approaching = 62.5%
    } else {
      // Try to parse as numeric if it's a number
      const numericScore = parseFloat(performance);
      if (!isNaN(numericScore)) {
        return { points: numericScore, total: 4 };
      }
      // Default fallback
      return { points: 2, total: 4 };
    }
  }

  private normalizeTestPeriod(testPeriod: string | undefined): string | null {
    if (!testPeriod) return null;
    
    const period = testPeriod.toLowerCase();
    
    // Extract PM1, PM2, PM3 from various formats
    if (period.includes('pm1') || period.includes('period 1') || period.includes('1st')) {
      return 'PM1';
    }
    if (period.includes('pm2') || period.includes('period 2') || period.includes('2nd')) {
      return 'PM2';
    }
    if (period.includes('pm3') || period.includes('period 3') || period.includes('3rd')) {
      return 'PM3';
    }
    
    return null;
  }

  async getSchoolwideAnalytics() {
    try {
      // SIMPLIFIED: Just count enrolled students, not test records
      const allStudents = await db.students.toArray();
      const totalEnrolledStudents = allStudents.length;
      console.log(`📊 Total enrolled students: ${totalEnrolledStudents}`);
      
      // Get all FAST assessments
      const allAssessments = await db.assessments
        .filter(record => record.source?.includes('FAST'))
        .toArray();

      console.log(`📊 Found ${allAssessments.length} total FAST assessments`);
      
      // Create student map for homeroom data
      const studentMap = new Map(allStudents.map(s => [s.id, s]));
      
      // Add homeroom data to assessments
      const assessmentsWithHomeroom = allAssessments.map(assessment => ({
        ...assessment,
        homeroom: studentMap.get(assessment.studentId)?.className || 'Unassigned'
      }));
      
      // Get unique grades and homerooms
      const grades = [...new Set(assessmentsWithHomeroom.map(a => a.gradeLevel).filter(Boolean))].sort();
      const homerooms = [...new Set(assessmentsWithHomeroom.map(a => a.homeroom).filter(h => h && h !== 'Unassigned'))].sort();
      
      // Also get grades from enrollment if assessments don't have grade levels
      const enrollmentGrades = [...new Set(allStudents.map(s => s.grade).filter(Boolean))].sort();
      const finalGrades = grades.length > 0 ? grades : enrollmentGrades;
      
      console.log(`📊 Found grades from assessments: ${grades.join(', ')}`);
      console.log(`📊 Found grades from enrollment: ${enrollmentGrades.join(', ')}`);
      console.log(`📊 Using grades: ${finalGrades.join(', ')}`);
      console.log(`📊 Found homerooms: ${homerooms.join(', ')}`);

      // Calculate grade level averages
      const gradeAnalytics = finalGrades.map(grade => {
        const gradeAssessments = assessmentsWithHomeroom.filter(a => a.gradeLevel === grade && a.score);
        const scores = gradeAssessments.map(a => a.score).filter(Boolean);
        const percentiles = gradeAssessments.map(a => a.percentile).filter(Boolean);
        
        // Calculate subject-specific averages for Math and ELA
        const mathAssessments = gradeAssessments.filter(a => 
          a.subject === 'Math' || a.subject === 'Mathematics'
        );
        const elaAssessments = gradeAssessments.filter(a => 
          a.subject === 'ELA' || a.subject === 'Reading' || a.subject === 'Early Literacy'
        );
        
        const mathScores = mathAssessments.map(a => a.score).filter(Boolean);
        const elaScores = elaAssessments.map(a => a.score).filter(Boolean);
        
        // Count proficiency levels
        const proficiencyLevels = gradeAssessments.map(a => a.proficiency).filter(Boolean);
        const proficiencyCounts = {
          exceeds: proficiencyLevels.filter(p => p === 'exceeds').length,
          meets: proficiencyLevels.filter(p => p === 'meets').length,
          approaching: proficiencyLevels.filter(p => p === 'approaching').length,
          below: proficiencyLevels.filter(p => p === 'below').length
        };
        
        // Count students from enrollment data, not test data
        // Need to normalize grade format (enrollment has "01", "KG" while assessments have "1", "K")
        const normalizeGrade = (g: string) => {
          if (g === 'K' || g === 'KG') return 'K';
          return String(parseInt(g) || g);
        };
        const gradeStudents = allStudents.filter(s => normalizeGrade(s.grade) === normalizeGrade(grade));

        return {
          grade,
          studentCount: gradeStudents.length,
          averageScore: scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0,
          averagePercentile: percentiles.length > 0 ? Math.round(percentiles.reduce((a, b) => a + b, 0) / percentiles.length) : 0,
          averageMathScore: mathScores.length > 0 ? Math.round(mathScores.reduce((a, b) => a + b, 0) / mathScores.length) : null,
          averageELAScore: elaScores.length > 0 ? Math.round(elaScores.reduce((a, b) => a + b, 0) / elaScores.length) : null,
          proficiencyDistribution: proficiencyCounts,
          totalWithProficiency: Object.values(proficiencyCounts).reduce((a, b) => a + b, 0)
        };
      });

      // Calculate homeroom averages
      const homeroomAnalytics = homerooms.map(homeroom => {
        const homeroomAssessments = assessmentsWithHomeroom.filter(a => a.homeroom === homeroom && a.score);
        const scores = homeroomAssessments.map(a => a.score).filter(Boolean);
        const percentiles = homeroomAssessments.map(a => a.percentile).filter(Boolean);
        
        // Calculate subject-specific averages for Math and ELA
        const mathAssessments = homeroomAssessments.filter(a => 
          a.subject === 'Math' || a.subject === 'Mathematics'
        );
        const elaAssessments = homeroomAssessments.filter(a => 
          a.subject === 'ELA' || a.subject === 'Reading' || a.subject === 'Early Literacy'
        );
        
        const mathScores = mathAssessments.map(a => a.score).filter(Boolean);
        const elaScores = elaAssessments.map(a => a.score).filter(Boolean);
        
        const proficiencyLevels = homeroomAssessments.map(a => a.proficiency).filter(Boolean);
        const proficiencyCounts = {
          exceeds: proficiencyLevels.filter(p => p === 'exceeds').length,
          meets: proficiencyLevels.filter(p => p === 'meets').length,
          approaching: proficiencyLevels.filter(p => p === 'approaching').length,
          below: proficiencyLevels.filter(p => p === 'below').length
        };
        
        // Count students from enrollment data, not test data
        const homeroomStudents = allStudents.filter(s => s.className === homeroom);

        return {
          homeroom,
          studentCount: homeroomStudents.length,
          averageScore: scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0,
          averagePercentile: percentiles.length > 0 ? Math.round(percentiles.reduce((a, b) => a + b, 0) / percentiles.length) : 0,
          averageMathScore: mathScores.length > 0 ? Math.round(mathScores.reduce((a, b) => a + b, 0) / mathScores.length) : null,
          averageELAScore: elaScores.length > 0 ? Math.round(elaScores.reduce((a, b) => a + b, 0) / elaScores.length) : null,
          proficiencyDistribution: proficiencyCounts,
          totalWithProficiency: Object.values(proficiencyCounts).reduce((a, b) => a + b, 0)
        };
      });

      // Calculate subject area analytics
      const subjects = [...new Set(assessmentsWithHomeroom.map(a => a.subject).filter(Boolean))];
      const subjectAnalytics = subjects.map(subject => {
        const subjectAssessments = assessmentsWithHomeroom.filter(a => a.subject === subject && a.score);
        const scores = subjectAssessments.map(a => a.score).filter(Boolean);
        const percentiles = subjectAssessments.map(a => a.percentile).filter(Boolean);
        
        const proficiencyLevels = subjectAssessments.map(a => a.proficiency).filter(Boolean);
        const proficiencyCounts = {
          exceeds: proficiencyLevels.filter(p => p === 'exceeds').length,
          meets: proficiencyLevels.filter(p => p === 'meets').length,
          approaching: proficiencyLevels.filter(p => p === 'approaching').length,
          below: proficiencyLevels.filter(p => p === 'below').length
        };
        
        // Since all students take Math and ELA, use total enrollment for these subjects
        // For other subjects, count actual test takers
        let studentCount;
        if (subject === 'Math' || subject === 'Mathematics' || 
            subject === 'ELA' || subject === 'Reading' || subject === 'Early Literacy') {
          studentCount = totalEnrolledStudents;
        } else {
          // For specialty subjects, count unique test takers
          const uniqueStudentIds = [...new Set(subjectAssessments.map(a => a.studentId))];
          studentCount = uniqueStudentIds.length;
        }

        return {
          subject,
          studentCount,
          averageScore: scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0,
          averagePercentile: percentiles.length > 0 ? Math.round(percentiles.reduce((a, b) => a + b, 0) / percentiles.length) : 0,
          proficiencyDistribution: proficiencyCounts,
          totalWithProficiency: Object.values(proficiencyCounts).reduce((a, b) => a + b, 0)
        };
      });

      // Overall school statistics
      const allScores = assessmentsWithHomeroom.map(a => a.score).filter(Boolean);
      const allPercentiles = assessmentsWithHomeroom.map(a => a.percentile).filter(Boolean);
      
      // Calculate proficiency based on percentiles if proficiency field is missing
      const calculateProficiency = (percentile: number) => {
        if (percentile >= 75) return 'exceeds';
        if (percentile >= 50) return 'meets';
        if (percentile >= 25) return 'approaching';
        return 'below';
      };
      
      // Try to get proficiency levels, or calculate from percentiles
      const allProficiencyLevels = assessmentsWithHomeroom.map(a => {
        if (a.proficiency) return a.proficiency;
        if (a.percentile) return calculateProficiency(a.percentile);
        return null;
      }).filter(Boolean);
      
      console.log(`📊 Total proficiency levels calculated: ${allProficiencyLevels.length}`);
      console.log(`📊 Sample proficiencies:`, allProficiencyLevels.slice(0, 10));
      
      const schoolwideProficiency = {
        exceeds: allProficiencyLevels.filter(p => p === 'exceeds').length,
        meets: allProficiencyLevels.filter(p => p === 'meets').length,
        approaching: allProficiencyLevels.filter(p => p === 'approaching').length,
        below: allProficiencyLevels.filter(p => p === 'below').length
      };

      return {
        totalStudents: totalEnrolledStudents, // Use enrolled count, not assessment count
        totalAssessments: allAssessments.length,
        schoolwideAverageScore: allScores.length > 0 ? Math.round(allScores.reduce((a, b) => a + b, 0) / allScores.length) : 0,
        schoolwideAveragePercentile: allPercentiles.length > 0 ? Math.round(allPercentiles.reduce((a, b) => a + b, 0) / allPercentiles.length) : 0,
        schoolwideProficiencyDistribution: schoolwideProficiency,
        subjectAnalytics: subjectAnalytics.filter(s => s.studentCount > 0),
        gradeAnalytics: gradeAnalytics.filter(g => g.studentCount > 0),
        homeroomAnalytics: homeroomAnalytics.filter(h => h.studentCount > 0),
        subjects: {
          math: allAssessments.filter(a => ['Math', 'Mathematics'].includes(a.subject)).length,
          ela: allAssessments.filter(a => ['ELA', 'Reading', 'Early Literacy'].includes(a.subject)).length,
          writing: allAssessments.filter(a => a.subject === 'Writing').length
        }
      };
    } catch (error) {
      console.error('Error getting schoolwide analytics:', error);
      throw error;
    }
  }

  private extractIReadyDomainScores(assessment: any, subject: string): Record<string, any> {
    const domainScores: Record<string, any> = {};
    
    // Map iReady domain scores to synthetic standards format based on subject
    let domainFields: Array<{ key: string, name: string, placement: string }>;
    
    if (subject === 'ELA') {
      // ELA/Reading domain fields
      domainFields = [
        { key: 'overallScore', name: 'Overall Performance', placement: 'overallPlacement' },
        { key: 'phonologicalAwarenessScore', name: 'Phonological Awareness', placement: 'phonologicalAwarenessPlacement' },
        { key: 'phonicsScore', name: 'Phonics', placement: 'phonicsPlacement' },
        { key: 'highFrequencyWordsScore', name: 'High-Frequency Words', placement: 'highFrequencyWordsPlacement' },
        { key: 'vocabularyScore', name: 'Vocabulary', placement: 'vocabularyPlacement' },
        { key: 'comprehensionOverallScore', name: 'Comprehension: Overall', placement: 'comprehensionOverallPlacement' },
        { key: 'comprehensionLiteratureScore', name: 'Comprehension: Literature', placement: 'comprehensionLiteraturePlacement' },
        { key: 'comprehensionInformationalScore', name: 'Comprehension: Informational Text', placement: 'comprehensionInformationalPlacement' }
      ];
    } else {
      // Math domain fields - using actual database field names
      domainFields = [
        { key: 'overallScore', name: 'Overall Performance', placement: 'overallPlacement' },
        { key: 'numberOperationsScore', name: 'Number and Operations', placement: 'numberOperationsPlacement' },
        { key: 'algebraScore', name: 'Algebra and Algebraic Thinking', placement: 'algebraPlacement' },
        { key: 'measurementDataScore', name: 'Measurement and Data', placement: 'measurementDataPlacement' },
        { key: 'geometryScore', name: 'Geometry', placement: 'geometryPlacement' }
      ];
    }
    
    domainFields.forEach(field => {
      const score = assessment[field.key];
      if (score && score > 0) {
        // Convert scale scores to synthetic performance data
        // Use placement levels to estimate performance percentages
        const placement = assessment[field.placement] || '';
        let percentage = 50; // Default
        
        if (placement.toLowerCase().includes('above') || placement.toLowerCase().includes('surpassed')) {
          percentage = 85;
        } else if (placement.toLowerCase().includes('mid') || placement.toLowerCase().includes('on grade')) {
          percentage = 75;
        } else if (placement.toLowerCase().includes('1 grade') && placement.toLowerCase().includes('below')) {
          percentage = 60;
        } else if (placement.toLowerCase().includes('2 grade') && placement.toLowerCase().includes('below')) {
          percentage = 45;
        } else if (placement.toLowerCase().includes('3 or more') || placement.toLowerCase().includes('emerging')) {
          percentage = 30;
        }
        
        domainScores[field.name] = {
          pointsEarned: Math.round(score * percentage / 100),
          pointsPossible: score,
          masteryPercentage: percentage,
          mastered: percentage >= 70
        };
      }
    });
    
    return domainScores;
  }

  private async processIReadyAnalytics(
    assessments: any[], 
    testType: TestType, 
    source: string, 
    subject: string, 
    grade: string
  ): Promise<TestAnalytics> {
    console.log(`Processing ${assessments.length} iReady ${subject} Grade ${grade} assessments`);
    
    if (assessments.length === 0) {
      console.log('🚨 No assessments to process - returning empty analytics');
      return {
        testName: this.getTestName(testType),
        totalStudents: 0,
        overallAverage: 0,
        standardsPerformance: [],
        categoryAverages: {},
        timeSeriesData: []
      };
    }
    
    // Group assessments by student to track growth over time
    const studentMap = new Map<string, any[]>();
    assessments.forEach(assessment => {
      const studentId = String(assessment.studentId);
      if (!studentMap.has(studentId)) {
        studentMap.set(studentId, []);
      }
      studentMap.get(studentId)!.push(assessment);
    });

    // Sort each student's assessments by date
    studentMap.forEach(studentAssessments => {
      studentAssessments.sort((a, b) => new Date(a.testDate).getTime() - new Date(b.testDate).getTime());
    });

    console.log(`Found assessments for ${studentMap.size} unique students`);

    // Create time series data by norming window
    const timeSeriesMap = new Map<string, { 
      scores: number[], 
      percentiles: number[], 
      studentIds: Set<string>,
      assessmentCount: number
    }>();

    assessments.forEach(assessment => {
      // Use actual test date instead of norming window
      const testDate = assessment.testDate;
      if (!testDate) return;

      // Format the date as a readable period (e.g., "Sep 2024")
      const date = new Date(testDate);
      const period = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

      if (!timeSeriesMap.has(period)) {
        timeSeriesMap.set(period, { 
          scores: [], 
          percentiles: [], 
          studentIds: new Set(),
          assessmentCount: 0
        });
      }

      const data = timeSeriesMap.get(period)!;
      if (assessment.score) data.scores.push(parseInt(assessment.score));
      if (assessment.percentile) data.percentiles.push(parseInt(assessment.percentile));
      data.studentIds.add(String(assessment.studentId));
      data.assessmentCount++;
    });

    // Create time series data
    const timeSeriesData = Array.from(timeSeriesMap.entries())
      .map(([period, data]) => ({
        period,
        averageScaleScore: data.scores.length > 0 
          ? Math.round(data.scores.reduce((a, b) => a + b, 0) / data.scores.length)
          : 0,
        averagePercentile: data.percentiles.length > 0 
          ? Math.round(data.percentiles.reduce((a, b) => a + b, 0) / data.percentiles.length)
          : 0,
        studentCount: data.studentIds.size
      }))
      .sort((a, b) => {
        // Sort chronologically by parsing the date string (e.g., "Sep 2024")
        const dateA = new Date(a.period + " 01"); // Add day for proper Date parsing
        const dateB = new Date(b.period + " 01");
        return dateA.getTime() - dateB.getTime();
      });

    // Create domain-based "standards" for visualization - treating domain scores as standards
    const domainMap = new Map<string, {
      category: string;
      students: Array<{
        studentName: string;
        studentId: string;
        pointsEarned: number;
        pointsPossible: number;
        percentage: number;
      }>;
      totalPointsEarned: number;
      totalPointsPossible: number;
    }>();

    // Process each assessment for domain performance
    for (const assessment of assessments) {
      const student = await db.students.get(assessment.studentId);
      const studentName = student 
        ? `${student.lastName}, ${student.firstName}` 
        : assessment.originalStudentId || assessment.studentId;

      // Define iReady domains to track based on subject
      let domains: Array<{ key: string, name: string, placement: string }>;
      
      if (subject === 'ELA') {
        // ELA/Reading domains
        domains = [
          { key: 'score', name: 'Overall Performance', placement: 'overallPlacement' },
          { key: 'phonologicalAwarenessScore', name: 'Phonological Awareness', placement: 'phonologicalAwarenessPlacement' },
          { key: 'phonicsScore', name: 'Phonics', placement: 'phonicsPlacement' },
          { key: 'highFrequencyWordsScore', name: 'High-Frequency Words', placement: 'highFrequencyWordsPlacement' },
          { key: 'vocabularyScore', name: 'Vocabulary', placement: 'vocabularyPlacement' },
          { key: 'comprehensionOverallScore', name: 'Comprehension: Overall', placement: 'comprehensionOverallPlacement' },
          { key: 'comprehensionLiteratureScore', name: 'Comprehension: Literature', placement: 'comprehensionLiteraturePlacement' },
          { key: 'comprehensionInformationalScore', name: 'Comprehension: Informational Text', placement: 'comprehensionInformationalPlacement' }
        ];
      } else {
        // Math domains - using actual database field names
        domains = [
          { key: 'score', name: 'Overall Performance', placement: 'overallPlacement' },
          { key: 'numberOperationsScore', name: 'Number and Operations', placement: 'numberOperationsPlacement' },
          { key: 'algebraScore', name: 'Algebra and Algebraic Thinking', placement: 'algebraPlacement' },
          { key: 'measurementDataScore', name: 'Measurement and Data', placement: 'measurementDataPlacement' },
          { key: 'geometryScore', name: 'Geometry', placement: 'geometryPlacement' }
        ];
      }

      domains.forEach(domain => {
        const score = assessment[domain.key];
        const placement = assessment[domain.placement];
        
        if (score && score > 0) {
          if (!domainMap.has(domain.name)) {
            domainMap.set(domain.name, {
              category: subject === 'ELA' ? 'iReady Reading Domain' : 'iReady Math Domain',
              students: [],
              totalPointsEarned: 0,
              totalPointsPossible: 0
            });
          }

          const domainData = domainMap.get(domain.name)!;
          
          // For iReady, store assessment data with test periods for matrix view
          const scaledScore = parseInt(score) || 0;
          
          // Don't use overall percentile for domains - only use for "Overall Performance"
          // Domain-specific percentiles aren't provided by iReady
          const percentage = domain.name === 'Overall Performance' 
            ? (parseInt(assessment.percentile) || 50)
            : null; // No percentile for individual domains
          
          // Use actual test date formatted as "Mon YYYY"
          const testDate = assessment.testDate;
          const date = new Date(testDate);
          const testPeriod = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

          domainData.students.push({
            studentName,
            studentId: String(assessment.studentId),
            score: scaledScore,
            percentile: percentage, // null for domains, actual percentile for Overall Performance
            testPeriod,
            testDate: assessment.testDate
          });

          // Don't use points earned/possible for iReady - use scale scores and percentiles
          domainData.totalPointsEarned += scaledScore;
          domainData.totalPointsPossible += 100; // Keep for compatibility
        }
      });
    }

    // Convert domain map to standards performance with iReady-specific structure
    const standardsPerformance = Array.from(domainMap.entries()).map(([domainName, domainData]) => ({
      standardCode: domainName,
      standardDescription: `iReady ${domainName} Domain Performance`,
      category: domainData.category,
      studentsCount: domainData.students.length,
      averageScore: domainData.students.length > 0
        ? Math.round(domainData.students.reduce((sum, s) => sum + s.score, 0) / domainData.students.length)
        : 0,
      averagePercentage: domainData.students.length > 0
        ? Math.round(domainData.students.reduce((sum, s) => sum + s.percentile, 0) / domainData.students.length)
        : 0,
      // For matrix view - group students by test period
      studentScoresByPeriod: domainData.students.reduce((periods: any, student: any) => {
        if (!periods[student.testPeriod]) {
          periods[student.testPeriod] = [];
        }
        periods[student.testPeriod].push({
          studentName: student.studentName,
          studentId: student.studentId,
          score: student.score,
          percentile: student.percentile,
          testDate: student.testDate
        });
        return periods;
      }, {}),
      studentScores: domainData.students // Keep for compatibility
    }));

    // Sort by average percentage (lowest first for intervention focus)
    standardsPerformance.sort((a, b) => a.averagePercentage - b.averagePercentage);

    // Calculate category averages (all domains are under iReady Reading Domain)
    const categoryAverages: Record<string, number> = {
      'iReady Reading Domain': standardsPerformance.length > 0
        ? Math.round(standardsPerformance.reduce((sum, s) => sum + s.averagePercentage, 0) / standardsPerformance.length)
        : 0
    };

    const overallAverage = standardsPerformance.length > 0 
      ? Math.round(standardsPerformance.reduce((sum, s) => sum + s.averagePercentage, 0) / standardsPerformance.length)
      : 0;

    return {
      testName: this.getTestName(testType),
      totalStudents: studentMap.size,
      overallAverage,
      standardsPerformance,
      categoryAverages,
      timeSeriesData
    };
  }

  private normalizeIReadyPeriod(normingWindow: string): string | null {
    if (!normingWindow) return null;
    
    const window = normingWindow.toLowerCase();
    if (window.includes('beginning') || window.includes('fall')) return 'Fall';
    if (window.includes('winter') || window.includes('november') || window.includes('march')) return 'Winter';
    if (window.includes('spring') || window.includes('end')) return 'Spring';
    
    return null;
  }

  private estimatePercentageFromPlacement(placement: string): number {
    const placementLower = placement.toLowerCase();
    
    if (placementLower.includes('above') || placementLower.includes('surpassed')) return 85;
    if (placementLower.includes('mid') || placementLower.includes('on grade')) return 75;
    if (placementLower.includes('1 grade') && placementLower.includes('below')) return 60;
    if (placementLower.includes('2 grade') && placementLower.includes('below')) return 45;
    if (placementLower.includes('3 or more') || placementLower.includes('emerging')) return 30;
    
    return 50; // Default
  }
}

export const examAnalyticsService = new ExamAnalyticsService();
export default examAnalyticsService;