interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface OpenAIResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: {
    index: number;
    message: {
      role: 'assistant';
      content: string;
    };
    finish_reason: string;
  }[];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

class OpenAIService {
  private apiKey: string;
  private baseUrl = 'https://api.openai.com/v1';
  private model: string;
  private maxTokens: number;
  private temperature: number;

  constructor() {
    this.apiKey = import.meta.env.VITE_OPENAI_API_KEY;
    this.model = import.meta.env.VITE_OPENAI_MODEL || 'gpt-4o';
    this.maxTokens = parseInt(import.meta.env.VITE_OPENAI_MAX_TOKENS) || 2000;
    this.temperature = parseFloat(import.meta.env.VITE_OPENAI_TEMPERATURE) || 0.7;

    if (!this.apiKey || this.apiKey === 'your_openai_api_key_here') {
      console.warn('OpenAI API key not configured. Please set VITE_OPENAI_API_KEY in your .env file.');
    }
  }

  private buildDataAnalysisInstructions(context?: any): string {
    const queryModeInstruction = this.getQueryModeInstructions(context);
    
    // Add specific student data details to force AI to use actual data
    let specificDataDetails = '';
    if (context?.students?.length > 0) {
      specificDataDetails = `\n\nSPECIFIC STUDENT DATA YOU MUST ANALYZE:\n`;
      
      // Show first few students to demonstrate data availability
      const studentsToShow = context.students.slice(0, Math.min(5, context.students.length));
      studentsToShow.forEach((student: any, index: number) => {
        const studentAttendance = context.attendance?.find((a: any) => a.studentId === student.id);
        const studentGrades = context.grades?.find((g: any) => g.studentId === student.id);
        const studentFlags = context.flags?.filter((f: any) => f.studentId === student.id);
        
        const studentName = student.name || `Student ${index + 1}`;
        specificDataDetails += `\n${studentName} (ID: ${student.id}):\n`;
        if (studentAttendance) {
          specificDataDetails += `- Attendance: ${studentAttendance.rate.toFixed(1)}% (${studentAttendance.presentDays}/${studentAttendance.totalDays} days)\n`;
        }
        if (studentGrades) {
          specificDataDetails += `- GPA: ${studentGrades.averageGrade.toFixed(2)} (${studentGrades.letterGrade})\n`;
        }
        if (studentFlags?.length > 0) {
          specificDataDetails += `- Flags: ${studentFlags.length} active (${studentFlags.map((f: any) => f.flagName).join(', ')})\n`;
        }
      });
      
      specificDataDetails += `\n**CRITICAL: You have access to detailed individual data for ALL ${context.students.length} students. ANALYZE THIS DATA, not generic frameworks!**\n`;
    }
    
    return `\n\nDATA ANALYSIS INSTRUCTIONS:
- **ALWAYS refer to students by name with Wasabi ID**: Use "Gabriel Turner (ID: 150)" instead of "Student 150"
- **Maintain an encouraging, solution-focused tone** while delivering precise data insights
- Analyze ALL available data for mentioned students
- Provide SPECIFIC NUMBERS for every metric mentioned
- Include percentiles, averages, and comparisons
- Show trends with exact dates and values
- Calculate and display correlations between different data types
- Identify specific intervention points based on data thresholds
- Use the comprehensive attendance, grades, assessments, discipline, and flags data provided
${specificDataDetails}

${queryModeInstruction}

CRITICAL CAPABILITIES - You can answer specific questions like:
- "Was [Student] at school on [specific date]?" - Check allAttendanceRecords for exact date
- "What happened in [Student]'s behavioral report on [date]?" - Check detailed incident records
- "How did [Student] score on their latest iReady test?" - Use assessment history with dates
- "What grades did [Student] get in Math last month?" - Use allGrades with date filtering
- "When was [Student]'s last absence?" - Sort attendance records by date
- "What was the specific incident on [date]?" - Match incident date and provide full details
- "Tell me about recent SOBA observations" - Use sobaObservations data with class engagement scores and teacher feedback
- "What SOBA notes do we have on [Student]?" - Check sobaStudentNotes for individual observations
- "How is [Teacher]'s classroom engagement?" - Analyze SOBA observation data by teacher/homeroom
- "What instructional strategies have been noted for [Student]?" - Review SOBA student notes by category

GPA DIFFERENTIATION REQUIREMENTS:
When discussing GPA, ALWAYS differentiate between:
- **Academic GPA**: Core subjects only (Reading, Writing, Math, Science, Social Studies)
- **Total GPA**: Includes everything (core + resource classes + conduct)

IMPORTANT: Most students get As in resource classes and conduct, which inflates Total GPA. Always emphasize Academic GPA for meaningful academic analysis. Example:
- "Academic GPA: 78.5 (C+) - shows true academic performance in core subjects"
- "Total GPA: 92.3 (A-) - inflated by resource classes and conduct grades"

When ranking students or identifying those needing support, use ACADEMIC GPA as the primary metric.

GRADE-LEVEL ANALYSIS:
When asked about an entire grade level (e.g., "Tell me about 1st grade's reading comprehension"), provide analysis for ALL students in that grade:
- Include EVERY student in the grade level, not just one student
- Provide individual summaries for each student
- Calculate grade-level averages and ranges
- Identify patterns and outliers across the entire grade
- Give grade-level recommendations

SUBJECT-AREA COMPREHENSIVE ANALYSIS:
When asked about subject areas (reading, math, ELA, etc.), provide COMPREHENSIVE REPORTS that include:
- CLASSROOM GRADES: Specific subject grades, assignment details, trends over time
- iREADY ASSESSMENTS: Domain-specific scores (phonics, vocabulary, comprehension for reading; number operations, algebra, geometry for math)
- FAST ASSESSMENTS: Component scores and standards-based mastery levels (ELA, Math, Science, Writing)
- SOBA INSTRUCTIONAL OBSERVATIONS: Teacher feedback, classroom engagement, instructional quality scores
- SOBA STUDENT NOTES: Individual observations by category (engagement, behavior, academic, strategy)
- CROSS-CORRELATION ANALYSIS: Compare classroom performance vs. standardized assessments vs. observational data
- STANDARDS MASTERY: Specific skill areas where student excels or struggles
- INTERVENTION RECOMMENDATIONS: Targeted suggestions based on data patterns and observational insights

Examples of comprehensive subject queries:
- "Tell me about 1st grade's reading comprehension" → Analyze ALL 1st grade students, not just one
- "Tell me about [Student]'s reading comprehension" → Analyze reading grades + iReady Reading domains + FAST ELA comprehension + SOBA notes + correlations
- "How is [Student] doing in math?" → Math grades + iReady Math domains + FAST Math standards + SOBA observations + cross-analysis
- "What are [Student]'s strengths in ELA?" → All language arts data with specific skill identification + instructional observations
- "Tell me about recent SOBA observations" → Classroom engagement, teacher feedback, instructional quality scores
- "How are our FAST Science scores this year?" → FAST Science assessment data with grade-level breakdowns and trends

RANKING AND COMPARISON QUERIES:
When asked for rankings (e.g., "lowest GPA", "highest scores", "attendance challenges"), provide:
- **SPECIFIC STUDENT RANKINGS** with exact numbers using WASABI IDs
- **ALWAYS USE ACADEMIC GPA** for rankings (not Total GPA which is inflated by resource/conduct)
- **COMPARATIVE ANALYSIS** across all students with encouraging, solution-focused language
- **TOP/BOTTOM lists** with detailed metrics and intervention suggestions
- **PERCENTILE POSITIONS** within the cohort

Examples of ranking queries:
- "Who has the highest GPA?" → Rank by ACADEMIC GPA (core subjects only), show both Academic and Total for context
- "Who are students needing academic support?" → Use ACADEMIC GPA to identify true academic needs
- "Which students have excellent attendance?" → Rank by attendance rate
- "Who would benefit from reading support?" → Combine reading grades + assessments

🚨🚨🚨 CRITICAL FORMATTING RULES 🚨🚨🚨:

YOU MUST ALWAYS USE WASABI IDs WHEN REFERRING TO STUDENTS!

❌ NEVER DO THESE:
- "[Student Name]"
- "Eden Mcdowell Za'Ki Stewart" (fake generated names)
- "Za'Ki Stewart" (real names without ID)
- Making up or guessing student names

✅ ALWAYS DO THIS:
- Use the exact WASABI ID from the student data: "wasabi_20292876_1756152003853_121"
- Write: "Student wasabi_20292876_1756152003853_121 has the highest GPA"
- Or: "The top performer is wasabi_20292876_1756152003853_121 with 103.85 GPA"

PROCESS:
1. Look at the student data provided
2. Find the WASABI ID (like "wasabi_20292876_1756152003853_121")
3. Use ONLY that WASABI ID in your response 
4. The system will automatically convert it to the real student name
5. NEVER guess, make up, or use any names - only use the exact WASABI ID

Example: "The highest GPA belongs to wasabi_20292876_1756152003853_121 with 103.85"

🎭 RESPONSE STRUCTURE & TONE REQUIREMENTS:

ALWAYS START WITH ANECDOTAL BREAKDOWN:
- Begin every response with a short, digestible, human-readable summary (2-3 sentences)
- Paint the big picture story before diving into numbers
- Use relatable language that helps educators understand the key insights
- Examples:
  * "This class shows strong reading foundations with most students performing at or above grade level..."
  * "We're seeing some attendance challenges that may be impacting academic performance..."
  * "The data reveals a few standout performers alongside students who could benefit from targeted support..."

THEN PROVIDE DETAILED ANALYSIS:
- After the anecdotal overview, dive into specific numbers, percentages, and detailed breakdowns
- Use clear headings and bullet points for easy scanning
- Include specific WASABI IDs for student references

ALWAYS END WITH DISCLAIMER:
- End every response with: "\n⚠️ *Nori is in beta and may produce inaccurate results. Double check output for accuracy.*"

TONE REQUIREMENTS:
- Be friendly, helpful, and supportive - you're assisting educators with student data
- Use emojis very sparingly, only when truly meaningful (📊 for data insights, ⚠️ for concerns)
- Use markdown formatting: **bold for emphasis**, *italics for nuance*, bullet points for clarity  
- Present information clearly and objectively
- Sound professional yet approachable
- Focus on actionable insights without excessive enthusiasm

IMPORTANT: Use actual Wasabi IDs from the provided data, maintain a professional and supportive tone, and provide clear actionable insights!`;
  }

  private getQueryModeInstructions(context?: any): string {
    if (!context?.summary?.queryType) return '';
    
    const modes = {
      individual: 'INDIVIDUAL STUDENT ANALYSIS MODE: Provide comprehensive profile with ALL available metrics, comparisons, and specific recommendations.',
      group: 'GROUP ANALYSIS MODE: Compare and contrast students with specific data points and identify patterns.',
      analysis: 'TREND ANALYSIS MODE: Focus on patterns, correlations, and system-wide insights with supporting statistics.'
    };
    
    return modes[context.summary.queryType] || '';
  }

  private buildSystemPrompt(context?: any): string {
    const hasData = context && Object.keys(context).length > 0;
    
    let prompt = `🚨 CRITICAL: ALWAYS use WASABI IDs when referring to students - NEVER use names or "[Student Name]"!

You are Nori, a friendly AI educational data analyst who helps educators support every student to reach their full potential! I'm here to provide clear, actionable insights that help you make a meaningful difference in students' lives.

MANDATORY: When referring to students, use ONLY their WASABI ID (like "wasabi_20292876_1756152003853_121"). The system will translate this to the real name automatically. NEVER make up names or use "[Student Name]".

`;
    
    if (hasData) {
      prompt += this.buildDataSummary(context);
      prompt += this.buildObjectivesAndGuidelines();
      prompt += this.buildSpecificStudentData(context);
      prompt += this.buildSubjectAnalysisContext(context, context.originalQuery || '');
      prompt += this.buildDataAnalysisInstructions(context);
    } else {
      prompt += 'Ready to analyze student data when provided. Will provide specific metrics and statistics upon data access.';
    }
    
    return prompt;
  }
  
  private buildDataSummary(context: any): string {
    console.log('🔍 Building data summary with context:', {
      totalStudents: context?.summary?.totalStudents,
      attendanceRecords: context?.attendance?.length,
      gradeRecords: context?.grades?.length,
      assessmentRecords: context?.assessments?.length,
      disciplineRecords: context?.discipline?.length,
      flagRecords: context?.flags?.length
    });
    
    // Debug: Log first few student records to see actual data format
    if (context?.grades?.length > 0) {
      console.log('🔍 Sample grade data (first 3 students):', context.grades.slice(0, 3));
    }
    
    return `STUDENT DATA ANALYSIS:
You have access to comprehensive data for ${context?.summary?.totalStudents || 0} students:

⚠️ CRITICAL: You MUST analyze ALL ${context?.summary?.totalStudents || 0} students provided in this data set!
- If asked about a class with 13 students, you must list ALL 13 students
- If asked about a grade with 20 students, you must include ALL 20 students
- NEVER truncate or show only a subset unless specifically asked for top/bottom performers

PERFORMANCE SUMMARY:
- Average Attendance: ${context?.summary?.averageAttendance?.toFixed(1) || 0}%
- Average GPA: ${context?.summary?.averageGrade?.toFixed(2) || 0}
- Students with Flags: ${context?.summary?.studentsWithFlags || 0}
- Risk Categories: ${context?.summary?.riskCategories?.highRisk || 0} High Risk, ${context?.summary?.riskCategories?.mediumRisk || 0} Medium Risk, ${context?.summary?.riskCategories?.lowRisk || 0} Low Risk

COMPREHENSIVE DATA AVAILABLE:
${context?.attendance ? `• ATTENDANCE DATA (${context.attendance.length} students): Daily records, monthly breakdowns, attendance rates, chronic absenteeism flags, recent patterns
` : ''}${context?.grades ? `• ACADEMIC GRADES (${context.grades.length} students): Subject-specific grades, GPA calculations (4.0 scale), letter grades, grade trends, recent assignments
` : ''}${context?.assessments ? `• ASSESSMENT SCORES (${context.assessments.length} records): iReady Reading/Math scores, FAST ELA/Math/Science/Writing results, percentiles, grade levels, test dates
` : ''}${context?.discipline ? `• DISCIPLINE DATA (${context.discipline.length} students): Incident counts, behavioral trends, severity levels, intervention records, location data
` : ''}${context?.flags ? `• ACTIVE FLAGS (${context.flags.length} total): Automated risk indicators, flag categories, trigger thresholds, creation dates
` : ''}${context?.sobaObservations ? `• SOBA CLASSROOM OBSERVATIONS (${context.sobaObservations.length} observations): Teacher feedback, class engagement scores (1-5 scale), instructional quality ratings for planning/delivery/environment/feedback (1-5 scale)
` : ''}${context?.sobaStudentNotes ? `• SOBA STUDENT NOTES (${context.sobaStudentNotes.length} notes): Individual student observations, engagement tracking, instructional strategies, behavior notes by category
` : ''}${context?.students ? `• STUDENT DEMOGRAPHICS (${context.students.length} students): Grade levels, classroom assignments, enrollment data, basic demographics
` : ''}

${this.buildActualDataSample(context)}`;
  }
  
  private buildActualDataSample(context: any): string {
    if (!context?.attendance?.length && !context?.grades?.length) {
      return 'WARNING: No specific student data found! This should not happen.';
    }
    
    let sample = 'SAMPLE OF ACTUAL DATA YOU HAVE ACCESS TO:\n\n';
    
    // Show actual attendance data
    if (context.attendance?.length > 0) {
      sample += 'ATTENDANCE RECORDS (sample):\n';
      context.attendance.slice(0, 3).forEach((record: any, i: number) => {
        const student = context.students?.find((s: any) => s.id === record.studentId);
        const studentName = student?.name || `Student ${i + 1}`;
        sample += `${studentName} (ID: ${record.studentId}): ${record.rate.toFixed(1)}% attendance (${record.presentDays}/${record.totalDays} days)\n`;
      });
      sample += '\n';
    }
    
    // Show actual grade data
    if (context.grades?.length > 0) {
      sample += 'GRADE RECORDS (sample):\n';
      context.grades.slice(0, 3).forEach((record: any, i: number) => {
        const student = context.students?.find((s: any) => s.id === record.studentId);
        const studentName = student?.name || `Student ${i + 1}`;
        sample += `${studentName} (ID: ${record.studentId}): ${record.averageGrade.toFixed(2)} GPA (${record.letterGrade}) - ${record.subjects.length} subjects\n`;
      });
      sample += '\n';
    }
    
    // Show actual assessment data
    if (context.assessments?.length > 0) {
      sample += 'ASSESSMENT RECORDS (sample):\n';
      context.assessments.slice(0, 3).forEach((record: any, i: number) => {
        const totalTests = (record.iReadyReading?.length || 0) + (record.iReadyMath?.length || 0) + 
                          (record.fastELA?.length || 0) + (record.fastMath?.length || 0);
        const student = context.students?.find((s: any) => s.id === record.studentId);
        const studentName = student?.name || `Student ${i + 1}`;
        sample += `${studentName} (ID: ${record.studentId}): ${totalTests} total assessments across multiple subjects\n`;
      });
      sample += '\n';
    }
    
    // Show flag data
    if (context.flags?.length > 0) {
      sample += 'ACTIVE FLAGS (sample):\n';
      context.flags.slice(0, 5).forEach((flag: any, i: number) => {
        sample += `Flag ${i + 1}: ${flag.flagName} (${flag.color}) - ${flag.message}\n`;
      });
      sample += '\n';
    }
    
    // Show SOBA observations data
    if (context.sobaObservations?.length > 0) {
      sample += 'SOBA CLASSROOM OBSERVATIONS (sample):\n';
      context.sobaObservations.slice(0, 3).forEach((obs: any, i: number) => {
        sample += `Observation ${i + 1}: ${obs.homeroom} (${obs.teacherName}) - Engagement: ${obs.classEngagementScore}/5\n`;
        sample += `  Planning: ${obs.teacherScorePlanning}/5, Delivery: ${obs.teacherScoreDelivery}/5, Environment: ${obs.teacherScoreEnvironment}/5, Feedback: ${obs.teacherScoreFeedback}/5\n`;
        if (obs.classEngagementNotes) sample += `  Notes: ${obs.classEngagementNotes.substring(0, 100)}...\n`;
      });
      sample += '\n';
    }
    
    // Show SOBA student notes data
    if (context.sobaStudentNotes?.length > 0) {
      sample += 'SOBA STUDENT NOTES (sample):\n';
      context.sobaStudentNotes.slice(0, 5).forEach((note: any, i: number) => {
        const student = context.students?.find((s: any) => s.id === note.studentId);
        const studentName = student?.name || `Student ${i + 1}`;
        sample += `${studentName} (${note.category || 'general'}): ${note.noteText.substring(0, 80)}...\n`;
      });
      sample += '\n';
    }
    
    sample += 'THIS IS REAL DATA - ANALYZE IT! Always use student names with Wasabi IDs and maintain a supportive, solution-focused tone. Do not provide generic frameworks.';
    return sample;
  }
  
  private buildSpecificStudentData(context: any): string {
    if (!context?.students?.length) return '';
    
    let studentData = '\n\nSPECIFIC STUDENT DATA FOR ANALYSIS:\n\n';
    
    context.students.forEach((student: any, index: number) => {
      const studentName = student.name || `Student ${index + 1}`;
      studentData += `${studentName.toUpperCase()} (ID: ${student.id}):\n`;
      studentData += `Grade: ${student.grade} | Class: ${student.className || 'Not specified'}\n`;
      
      // Find and include detailed attendance data
      const attendance = context.attendance?.find((a: any) => a.studentId === student.id);
      if (attendance) {
        studentData += `ATTENDANCE: ${attendance.rate.toFixed(1)}% (${attendance.presentDays}/${attendance.totalDays} days) - ${attendance.chronicAbsenteeism ? 'CHRONIC ABSENTEEISM' : 'OK'}\n`;
        
        if (attendance.allAttendanceRecords?.length > 0) {
          studentData += `DAILY ATTENDANCE RECORDS (${attendance.allAttendanceRecords.length} days):\n`;
          // Show last 10 days for context, but note that ALL records are available
          const recentDays = attendance.allAttendanceRecords.slice(0, 10);
          recentDays.forEach((day: any) => {
            studentData += `  ${day.date} (${day.dayOfWeek}): ${day.status.toUpperCase()} [${day.attendanceCode}]\n`;
          });
          if (attendance.allAttendanceRecords.length > 10) {
            studentData += `  ... and ${attendance.allAttendanceRecords.length - 10} more daily records available\n`;
          }
          
          // Add monthly breakdown
          if (attendance.monthlyBreakdown?.length > 0) {
            studentData += `Monthly rates: ${attendance.monthlyBreakdown.map((m: any) => `${m.month}: ${m.rate.toFixed(1)}%`).join(', ')}\n`;
          }
        }
      }
      
      // Find and include grade data
      const grades = context.grades?.find((g: any) => g.studentId === student.id);
      if (grades) {
        studentData += `ACADEMICS: ${grades.averageGrade.toFixed(2)} GPA (${grades.letterGrade}) - ${grades.trend} trend\n`;
        if (grades.subjects?.length > 0) {
          studentData += `DETAILED SUBJECT BREAKDOWN:\n`;
          grades.subjects.forEach((subject: any) => {
            studentData += `  ${subject.subject}: ${subject.grade.toFixed(1)}% average (${subject.gradeCount} assignments)\n`;
            studentData += `    Range: ${subject.lowestGrade}% - ${subject.highestGrade}% | Passing: ${subject.passingGradeCount}/${subject.gradeCount}\n`;
            
            if (subject.allGrades?.length > 0) {
              const recentGrades = subject.allGrades.slice(0, 5);
              studentData += `    Recent grades: ${recentGrades.map((g: any) => `${g.grade}%(${g.date})`).join(', ')}\n`;
            }
          });
        }
      }
      
      // Find and include detailed assessment data
      const assessments = context.assessments?.find((a: any) => a.studentId === student.id);
      if (assessments) {
        studentData += `DETAILED ASSESSMENT HISTORY:\n`;
        
        if (assessments.iReadyReading?.length > 0) {
          studentData += `iReady Reading (${assessments.iReadyReading.length} tests):\n`;
          assessments.iReadyReading.forEach((test: any, i: number) => {
            studentData += `  Test ${i + 1} (${test.testDate}): ${test.score} points (${test.percentile}th percentile, Grade ${test.gradeLevel} level)`;
            if (test.lexileLevel) studentData += ` | Lexile: ${test.lexileLevel}`;
            studentData += `\n`;
          });
          
          // Calculate progress
          if (assessments.iReadyReading.length > 1) {
            const first = assessments.iReadyReading[assessments.iReadyReading.length - 1];
            const latest = assessments.iReadyReading[0];
            const scoreChange = latest.score - first.score;
            const percentileChange = latest.percentile - first.percentile;
            studentData += `  Progress: ${scoreChange > 0 ? '+' : ''}${scoreChange} points, ${percentileChange > 0 ? '+' : ''}${percentileChange} percentile points\n`;
          }
        }
        
        if (assessments.iReadyMath?.length > 0) {
          studentData += `iReady Math (${assessments.iReadyMath.length} tests):\n`;
          assessments.iReadyMath.forEach((test: any, i: number) => {
            studentData += `  Test ${i + 1} (${test.testDate}): ${test.score} points (${test.percentile}th percentile, Grade ${test.gradeLevel} level)\n`;
          });
          
          // Calculate progress
          if (assessments.iReadyMath.length > 1) {
            const first = assessments.iReadyMath[assessments.iReadyMath.length - 1];
            const latest = assessments.iReadyMath[0];
            const scoreChange = latest.score - first.score;
            const percentileChange = latest.percentile - first.percentile;
            studentData += `  Progress: ${scoreChange > 0 ? '+' : ''}${scoreChange} points, ${percentileChange > 0 ? '+' : ''}${percentileChange} percentile points\n`;
          }
        }
        
        // Add other assessment types with similar detail
        ['fastELA', 'fastMath', 'fastScience', 'fastWriting'].forEach(testType => {
          const tests = assessments[testType];
          if (tests?.length > 0) {
            const testName = testType.replace('fast', 'FAST ').replace('ELA', 'ELA').replace('Math', 'Math').replace('Science', 'Science').replace('Writing', 'Writing');
            studentData += `${testName} (${tests.length} tests):\n`;
            tests.forEach((test: any, i: number) => {
              studentData += `  Test ${i + 1} (${test.testDate}): Level ${test.level} (${test.percentile}th percentile)\n`;
            });
            
            if (tests.length > 1) {
              const first = tests[tests.length - 1];
              const latest = tests[0];
              const levelChange = latest.level - first.level;
              const percentileChange = latest.percentile - first.percentile;
              studentData += `  Progress: Level ${levelChange > 0 ? '+' : ''}${levelChange}, ${percentileChange > 0 ? '+' : ''}${percentileChange} percentile points\n`;
            }
          }
        });
      }
      
      // Find and include detailed discipline data
      const discipline = context.discipline?.find((d: any) => d.studentId === student.id);
      if (discipline && discipline.incidentCount > 0) {
        studentData += `DISCIPLINE: ${discipline.incidentCount} total incidents - ${discipline.behaviorTrend} trend\n`;
        studentData += `Most common incident type: ${discipline.mostCommonIncidentType}\n`;
        studentData += `Average incidents per month: ${discipline.averageIncidentsPerMonth?.toFixed(1)}\n`;
        
        if (discipline.incidents?.length > 0) {
          studentData += `DETAILED INCIDENT RECORDS:\n`;
          discipline.incidents.forEach((incident: any, i: number) => {
            studentData += `  Incident ${i + 1} (${incident.date}):\n`;
            studentData += `    Type: ${incident.type} | Severity: ${incident.severity}\n`;
            studentData += `    Location: ${incident.location} | Time: ${incident.timeOfDay}\n`;
            studentData += `    Description: ${incident.description}\n`;
            studentData += `    Action taken: ${incident.action}\n`;
            studentData += `    Staff: ${incident.staffMember} | Follow-up: ${incident.followUp}\n`;
            if (i < discipline.incidents.length - 1) studentData += `\n`;
          });
        }
        
        if (discipline.incidentsByMonth) {
          const monthlyIncidents = Object.entries(discipline.incidentsByMonth)
            .map(([month, count]) => `${month}: ${count}`);
          studentData += `\nIncidents by month: ${monthlyIncidents.join(', ')}\n`;
        }
      }
      
      // Find and include flag data
      const flags = context.flags?.filter((f: any) => f.studentId === student.id);
      if (flags?.length > 0) {
        studentData += `FLAGS: ${flags.map((f: any) => `${f.flagName}(${f.color}): ${f.message}`).join(' | ')}\n`;
      }
      
      studentData += '\n';
    });
    
    if (context?.students?.length > 10) {
      studentData += `\n\nRANKING DATA AVAILABLE: You have access to data for ALL ${context.students.length} students. For ranking queries:\n`;
      studentData += `- Sort students by requested metric (GPA, attendance, test scores, etc.)\n`;
      studentData += `- Provide specific rankings with exact numbers\n`;
      studentData += `- Show percentile positions and comparative analysis\n`;
      studentData += `- Identify patterns in top and bottom performers\n\n`;
    }
    
    studentData += 'ANALYSIS REQUIREMENT: Always refer to students by name with Wasabi ID (e.g., "Gabriel Turner (ID: 150)"). Maintain an encouraging, solution-focused tone while providing detailed data-driven insights. For ranking queries, sort and rank ALL students by the requested metric with specific intervention suggestions. Do NOT give generic frameworks!';
    return studentData;
  }
  
  private buildSubjectAnalysisContext(context: any, userMessage: string): string {
    // Detect if this is a subject-specific query
    const subjectKeywords = {
      reading: ['reading', 'comprehension', 'lexile', 'phonics', 'vocabulary', 'literature', 'informational text'],
      math: ['math', 'mathematics', 'algebra', 'geometry', 'fractions', 'multiplication', 'division', 'number operations'],
      ela: ['ela', 'language arts', 'writing', 'grammar', 'language usage'],
      science: ['science', 'scientific', 'inquiry'],
      writing: ['writing', 'composition', 'essay']
    };
    
    const messageLower = userMessage.toLowerCase();
    let detectedSubjects: string[] = [];
    
    Object.entries(subjectKeywords).forEach(([subject, keywords]) => {
      if (keywords.some(keyword => messageLower.includes(keyword))) {
        detectedSubjects.push(subject);
      }
    });
    
    if (detectedSubjects.length === 0) return '';
    
    // Import the StudentDataRetrieval class to use buildSubjectAnalysis
    let subjectAnalysis = '';
    detectedSubjects.forEach(subject => {
      // This would call the buildSubjectAnalysis method
      subjectAnalysis += `\n\n=== SUBJECT-SPECIFIC ANALYSIS FOR ${subject.toUpperCase()} ===\n`;
      subjectAnalysis += `The user is asking about ${subject}. Provide comprehensive analysis that includes:\n`;
      
      if (subject === 'reading' || subject === 'ela') {
        subjectAnalysis += `- Classroom reading/ELA grades with assignment details\n`;
        subjectAnalysis += `- iReady Reading scores with domain breakdowns (phonics, vocabulary, comprehension)\n`;
        subjectAnalysis += `- FAST ELA scores with standards mastery (literary text, informational text, etc.)\n`;
        subjectAnalysis += `- Lexile levels and reading comprehension analysis\n`;
        subjectAnalysis += `- Cross-correlation between classroom performance and standardized assessments\n`;
        subjectAnalysis += `- Identification of specific skill gaps or strengths\n`;
      }
      
      if (subject === 'math') {
        subjectAnalysis += `- Classroom math grades with assignment details\n`;
        subjectAnalysis += `- iReady Math scores with domain breakdowns (number operations, algebra, geometry, etc.)\n`;
        subjectAnalysis += `- FAST Math scores with standards mastery (addition/subtraction, fractions, etc.)\n`;
        subjectAnalysis += `- Cross-correlation between classroom performance and standardized assessments\n`;
        subjectAnalysis += `- Identification of specific mathematical concept strengths and weaknesses\n`;
      }
      
      subjectAnalysis += `- Progress trends over time across all data sources\n`;
      subjectAnalysis += `- Specific skill gaps and strengths identification\n`;
      subjectAnalysis += `- Standards mastery analysis with Florida Standards alignment\n`;
      subjectAnalysis += `- Recommendations for targeted intervention or enrichment\n`;
      subjectAnalysis += `- Correlation analysis between different assessment types\n\n`;
      
      subjectAnalysis += `IMPORTANT: When analyzing ${subject}, look for:\n`;
      if (subject === 'reading' || subject === 'ela') {
        subjectAnalysis += `- Discrepancies between phonics skills and comprehension\n`;
        subjectAnalysis += `- Lexile level vs grade level performance\n`;
        subjectAnalysis += `- Vocabulary acquisition patterns\n`;
        subjectAnalysis += `- Literary vs informational text performance differences\n`;
      }
      if (subject === 'math') {
        subjectAnalysis += `- Computational vs conceptual understanding gaps\n`;
        subjectAnalysis += `- Number sense vs algebraic thinking performance\n`;
        subjectAnalysis += `- Geometry and measurement concept mastery\n`;
        subjectAnalysis += `- Fraction and decimal operation proficiency\n`;
      }
      subjectAnalysis += `\n`;
    });
    
    return subjectAnalysis;
  }

  private buildObjectivesAndGuidelines(): string {
    return `PRIMARY OBJECTIVES:
1. **PROVIDE SPECIFIC DATA ANALYTICS**: Always give exact numbers, percentages, scores, and statistics
2. **INDIVIDUAL STUDENT PROFILES**: Comprehensive analysis with all available metrics and comparisons
3. **TREND ANALYSIS**: Show performance changes over time with specific dates and values
4. **COMPARATIVE INSIGHTS**: Compare students to class, grade, and school averages
5. **CORRELATIONAL ANALYSIS**: Identify relationships between attendance, grades, assessments, and behavior
6. **PERCENTILE RANKINGS**: Provide percentile positions and grade-level equivalents
7. **INTERVENTION RECOMMENDATIONS**: Suggest specific actions based on data thresholds and patterns

RESPONSE GUIDELINES:
- **ALWAYS USE STUDENT NAMES WITH WASABI IDS**: Instead of "Student 1" or "Student 150", use "Gabriel Turner (ID: 150)" or "[Student Name] (ID: [WasabiID])"
- **MAINTAIN A POSITIVE, SUPPORTIVE TONE**: Frame findings constructively while being direct about data
- **ALWAYS BE SPECIFIC WITH NUMBERS**: Provide exact percentages, scores, dates, and statistics
- **CITE CONCRETE DATA**: Every statement must be backed by specific data points
- **DETAILED ANALYTICS**: Give comprehensive breakdowns with numbers and metrics
- **SHOW CALCULATIONS**: Explain how averages, percentiles, and trends are determined
- **COMPARATIVE ANALYSIS**: Compare individual performance to class/grade/school averages
- **TEMPORAL TRENDS**: Show performance changes over time with specific dates and values
- **MULTI-METRIC ANALYSIS**: Connect attendance, grades, assessments with exact correlations
- **PERCENTILE RANKINGS**: Provide percentile positions and grade-level equivalents
- **STATISTICAL SIGNIFICANCE**: Highlight meaningful patterns in the data
- **FOCUS ON SOLUTIONS**: Always suggest specific intervention strategies alongside data findings

REQUIRED DATA REPORTING FORMAT:
For Individual Students, ALWAYS include:
- **Current Academic Performance**: Exact GPA (3.2/4.0), letter grade (B-), class rank/percentile
- **Attendance Statistics**: Exact attendance rate (87.3%), days present (124/142), chronic absenteeism status
- **Assessment Performance**: Specific test scores with percentiles (e.g., iReady Math: 489 - 42nd percentile)
- **Grade Trends**: Show improvement/decline with specific numbers (improved from 78% to 85% over 6 weeks)
- **Subject Breakdowns**: Individual subject averages (Math: 92%, ELA: 78%, Science: 85%)
- **Behavioral Data**: Exact incident counts, severity levels, dates of recent incidents
- **Flag Analysis**: Specific flag reasons with triggering thresholds

For Data Comparisons, ALWAYS show:
- Student vs. class average (Student: 85% | Class Avg: 91%)
- Student vs. grade level (Student: 78% | Grade 3 Avg: 83%)
- Performance percentile within cohort (Ranks 23rd out of 28 students)
- Improvement rates with time periods (+12% improvement over 8 weeks)

Remember: Your mission is to help every student succeed! Use data to identify opportunities for growth and celebrate improvements while addressing challenges with specific, actionable recommendations. Always refer to students by name with their Wasabi ID in parentheses (e.g., "Sarah Johnson (ID: 42)").

`;
  }

  // Estimate token count for a message (rough approximation)
  private estimateTokenCount(message: OpenAIMessage): number {
    // Rough estimate: ~4 characters per token
    return Math.ceil(message.content.length / 4);
  }

  // Truncate messages to stay within token limits
  private truncateMessagesForTokenLimit(messages: OpenAIMessage[]): OpenAIMessage[] {
    const MAX_TOKENS = 120000; // Leave room for response tokens
    const SYSTEM_MESSAGE_PRIORITY = true;
    const KEEP_RECENT_MESSAGES = 4; // Always keep last 4 messages for context
    
    // Calculate total tokens
    let totalTokens = 0;
    const messageTokens = messages.map(msg => {
      const tokens = this.estimateTokenCount(msg);
      totalTokens += tokens;
      return { message: msg, tokens };
    });
    
    console.log(`📊 Total estimated tokens: ${totalTokens}`);
    
    // If under limit, return as is
    if (totalTokens <= MAX_TOKENS) {
      console.log('✅ Token count within limits');
      return messages;
    }
    
    console.log('⚠️ Token limit exceeded, truncating conversation...');
    
    // Keep system message (first) and recent messages
    const systemMsg = messages[0]?.role === 'system' ? messages[0] : null;
    const userMessages = messages.filter(msg => msg.role !== 'system');
    
    // Keep the most recent messages
    const recentMessages = userMessages.slice(-KEEP_RECENT_MESSAGES);
    
    // Calculate tokens for essential messages
    let essentialTokens = 0;
    if (systemMsg) {
      essentialTokens += this.estimateTokenCount(systemMsg);
    }
    recentMessages.forEach(msg => {
      essentialTokens += this.estimateTokenCount(msg);
    });
    
    const result: OpenAIMessage[] = [];
    
    // Add system message first
    if (systemMsg) {
      result.push(systemMsg);
    }
    
    // If even essential messages exceed limit, truncate system message
    if (essentialTokens > MAX_TOKENS && systemMsg) {
      console.log('🔧 Even essential messages exceed limit, truncating system message');
      const truncatedSystemContent = this.truncateContent(systemMsg.content, MAX_TOKENS * 0.4); // Use 40% for system
      result[0] = { ...systemMsg, content: truncatedSystemContent };
      essentialTokens = this.estimateTokenCount(result[0]) + 
                      recentMessages.reduce((sum, msg) => sum + this.estimateTokenCount(msg), 0);
    }
    
    // Add recent messages
    result.push(...recentMessages);
    
    const finalTokens = result.reduce((sum, msg) => sum + this.estimateTokenCount(msg), 0);
    console.log(`✂️ Truncated to ${result.length} messages (~${finalTokens} tokens)`);
    
    return result;
  }

  // Truncate content to fit within token limit
  private truncateContent(content: string, maxTokens: number): string {
    const maxChars = maxTokens * 4; // Rough conversion
    if (content.length <= maxChars) return content;
    
    // Try to cut at a natural break point
    const truncated = content.substring(0, maxChars);
    const lastNewline = truncated.lastIndexOf('\n');
    const lastPeriod = truncated.lastIndexOf('.');
    const lastSpace = truncated.lastIndexOf(' ');
    
    // Cut at the best break point
    const breakPoint = lastNewline > maxChars * 0.8 ? lastNewline :
                      lastPeriod > maxChars * 0.8 ? lastPeriod + 1 :
                      lastSpace > maxChars * 0.8 ? lastSpace : maxChars;
    
    return content.substring(0, breakPoint) + '\n\n[Content truncated for token limit...]';
  }

  async sendMessage(
    messages: OpenAIMessage[],
    context?: any,
    onStream?: (chunk: string) => void
  ): Promise<string> {
    if (!this.apiKey || this.apiKey === 'your_openai_api_key_here') {
      throw new Error('OpenAI API key not configured. Please set VITE_OPENAI_API_KEY in your .env file.');
    }

    // Add system prompt if not present
    const systemMessage: OpenAIMessage = {
      role: 'system',
      content: this.buildSystemPrompt(context)
    };

    let finalMessages = messages[0]?.role === 'system' 
      ? messages 
      : [systemMessage, ...messages];

    // Automatic token management - truncate conversation if needed
    finalMessages = this.truncateMessagesForTokenLimit(finalMessages);

    // Retry logic for API failures
    const MAX_RETRIES = 3;
    const RETRY_DELAY = 1000; // Start with 1 second
    
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        console.log(`🔄 OpenAI API attempt ${attempt}/${MAX_RETRIES}`);
        
        const response = await fetch(`${this.baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: this.model,
            messages: finalMessages,
            max_tokens: this.maxTokens,
            temperature: this.temperature,
            stream: !!onStream,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => null);
          const errorMessage = `OpenAI API error: ${response.status} ${response.statusText}${errorData ? ` - ${errorData.error?.message}` : ''}`;
          
          // If it's a rate limit error (429) or server error (5xx), retry
          if ((response.status === 429 || response.status >= 500) && attempt < MAX_RETRIES) {
            const waitTime = RETRY_DELAY * Math.pow(2, attempt - 1); // Exponential backoff
            console.warn(`⚠️ ${errorMessage}. Retrying in ${waitTime}ms...`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
            continue;
          }
          
          throw new Error(errorMessage);
        }

        // Success! Process the response
        if (onStream) {
          return this.handleStreamResponse(response, onStream);
        } else {
          const data: OpenAIResponse = await response.json();
          return data.choices[0]?.message?.content || 'No response generated.';
        }
        
      } catch (error) {
        // Network errors and other failures
        if (attempt === MAX_RETRIES) {
          console.error(`❌ All ${MAX_RETRIES} attempts failed:`, error);
          throw error;
        }
        
        const waitTime = RETRY_DELAY * Math.pow(2, attempt - 1);
        console.warn(`⚠️ Attempt ${attempt} failed. Retrying in ${waitTime}ms...`, error);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
    
    throw new Error('Failed to get response from OpenAI after maximum retries');
  }

  private async handleStreamResponse(
    response: Response,
    onStream: (chunk: string) => void
  ): Promise<string> {
    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body');

    let fullContent = '';
    const decoder = new TextDecoder();

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n').filter(line => line.trim() !== '');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') continue;

            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices?.[0]?.delta?.content;
              if (content) {
                fullContent += content;
                onStream(content);
              }
            } catch (e) {
              // Ignore parsing errors for individual chunks
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    return fullContent;
  }

  // Method to test API connection
  async testConnection(): Promise<{ success: boolean; error?: string }> {
    try {
      await this.sendMessage([
        { role: 'user', content: 'Hello, can you confirm you are working?' }
      ]);
      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }
}

export const openAIService = new OpenAIService();
export type { OpenAIMessage };