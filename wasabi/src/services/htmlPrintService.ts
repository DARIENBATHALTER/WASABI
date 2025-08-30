import { db } from '../lib/db';

class HTMLPrintService {
  constructor() {}

  private async fetchStudentData(studentId: string | number) {
    // Validate student ID
    if (!studentId && studentId !== 0) {
      throw new Error(`Invalid student ID: ${studentId}`);
    }

    // Convert to string for database queries (since all data views use string IDs)
    const studentIdStr = String(studentId);

    // Fetch all student data from the database
    const [student, attendance, grades, discipline, assessments] = await Promise.all([
      db.students.get(studentId), // Keep original for primary key lookup
      db.attendance.where('studentId').equals(studentIdStr).toArray(),
      db.grades.where('studentId').equals(studentIdStr).toArray(),
      db.discipline.where('studentId').equals(studentIdStr).toArray(),
      db.assessments.where('studentId').equals(studentIdStr).toArray()
    ]);

    return {
      student,
      attendance,
      grades,
      discipline,
      assessments,
      hasAttendance: attendance.length > 0,
      hasGrades: grades.length > 0,
      hasDiscipline: discipline.length > 0,
      hasIReadyReading: assessments.some(a => 
        (a.source === 'iReady' || a.source === 'iReady Reading') && 
        (a.subject === 'Reading' || a.subject === 'ELA' || a.subject?.includes('Reading'))
      ),
      hasIReadyMath: assessments.some(a => 
        (a.source === 'iReady' || a.source === 'iReady Math') && 
        (a.subject === 'Math' || a.subject?.includes('Math'))
      ),
      hasFastMath: assessments.some(a => a.source === 'FAST' && a.subject === 'Math'),
      hasFastELA: assessments.some(a => a.source === 'FAST' && (a.subject === 'ELA' || a.subject === 'Reading')),
      hasFastScience: assessments.some(a => a.source === 'FAST' && a.subject === 'Science'),
      hasFastWriting: assessments.some(a => a.source === 'FAST' && a.subject === 'Writing'),
    };
  }

  private generateStudentHTML(data: any, reportFormat: 'detailed' | 'parent-friendly' = 'detailed'): string {
    const { student, attendance, grades, discipline, assessments } = data;
    
    if (!student) {
      return '<div class="error">Student not found</div>';
    }

    // Calculate comprehensive stats
    const attendanceStats = this.calculateAttendanceStats(attendance);
    const gradeStats = this.calculateGradeStats(grades);
    const assessmentStats = this.calculateAssessmentStats(assessments);
    const disciplineStats = this.calculateDisciplineStats(discipline);

    const isParentFriendly = reportFormat === 'parent-friendly';

    return `
      <div class="student-profile">
        <!-- Student Header -->
        <div class="student-header">
          <div class="student-avatar">
            <div class="avatar-circle">${student.firstName.charAt(0)}${student.lastName.charAt(0)}</div>
          </div>
          <div class="student-info">
            <h2>${student.firstName} ${student.lastName}</h2>
            <div class="student-details">
              <div><strong>Student ID:</strong> ${student.studentNumber}</div>
              <div><strong>Grade Level:</strong> Grade ${student.grade}</div>
              <div><strong>HR Teacher:</strong> ${student.className || 'Not assigned'}</div>
              <div><strong>Gender:</strong> ${student.gender || 'Not specified'}</div>
            </div>
          </div>
        </div>

        ${this.generateAttendanceSection(attendanceStats, attendance, isParentFriendly)}
        ${this.generateGradesSection(gradeStats, grades, isParentFriendly)}
        ${this.generateDisciplineSection(disciplineStats, discipline, isParentFriendly)}
        ${this.generateAssessmentsSection(assessmentStats, assessments, isParentFriendly)}
      </div>
    `;
  }

  private calculateAttendanceStats(attendance: any[]) {
    const presentCount = attendance.filter(a => {
      const code = a.attendanceCode || a.status;
      return code === 'P' || code === 'PRESENT' || code === 'present';
    }).length;

    const tardyCount = attendance.filter(a => {
      const code = a.attendanceCode || a.status;
      return code === 'T' || code === 'L' || code === 'TARDY';
    }).length;

    const absentCount = attendance.filter(a => {
      const code = a.attendanceCode || a.status;
      return code === 'U' || code === 'A' || code === 'ABSENT';
    }).length;

    const attendanceRate = attendance.length > 0 
      ? Math.round((presentCount / attendance.length) * 100)
      : 0;

    // Calculate recent trends (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const recentAttendance = attendance.filter(a => new Date(a.date) >= thirtyDaysAgo);
    const recentPresentCount = recentAttendance.filter(a => {
      const code = a.attendanceCode || a.status;
      return code === 'P' || code === 'PRESENT' || code === 'present';
    }).length;

    const recentAttendanceRate = recentAttendance.length > 0 
      ? Math.round((recentPresentCount / recentAttendance.length) * 100)
      : 0;

    return {
      total: attendance.length,
      presentCount,
      tardyCount,
      absentCount,
      attendanceRate,
      recentAttendanceRate,
      hasData: attendance.length > 0
    };
  }

  private calculateGradeStats(grades: any[]) {
    const allGradeValues: number[] = [];
    const courseGrades: { [course: string]: any[] } = {};

    grades.forEach(gradeRecord => {
      if (gradeRecord.grades && Array.isArray(gradeRecord.grades)) {
        courseGrades[gradeRecord.course] = gradeRecord.grades;
        gradeRecord.grades.forEach(g => {
          const numericGrade = parseFloat(g.grade);
          if (!isNaN(numericGrade)) {
            allGradeValues.push(numericGrade);
          }
        });
      }
    });

    const avgGrade = allGradeValues.length > 0
      ? allGradeValues.reduce((sum, grade) => sum + grade, 0) / allGradeValues.length
      : 0;

    // Calculate grade distribution
    const gradeDistribution = {
      A: allGradeValues.filter(g => g >= 90).length,
      B: allGradeValues.filter(g => g >= 80 && g < 90).length,
      C: allGradeValues.filter(g => g >= 70 && g < 80).length,
      D: allGradeValues.filter(g => g >= 60 && g < 70).length,
      F: allGradeValues.filter(g => g < 60).length
    };

    return {
      avgGrade,
      totalCourses: grades.length,
      totalGrades: allGradeValues.length,
      courseGrades,
      gradeDistribution,
      hasData: grades.length > 0
    };
  }

  private calculateAssessmentStats(assessments: any[]) {
    const bySource: { [source: string]: any[] } = {};
    const bySubject: { [subject: string]: any[] } = {};

    assessments.forEach(assessment => {
      if (!bySource[assessment.source]) bySource[assessment.source] = [];
      if (!bySubject[assessment.subject]) bySubject[assessment.subject] = [];
      
      bySource[assessment.source].push(assessment);
      bySubject[assessment.subject].push(assessment);
    });

    const recentAssessments = assessments
      .sort((a, b) => new Date(b.testDate).getTime() - new Date(a.testDate).getTime())
      .slice(0, 10);

    return {
      total: assessments.length,
      bySource,
      bySubject,
      recentAssessments,
      hasData: assessments.length > 0
    };
  }

  private calculateDisciplineStats(discipline: any[]) {
    const byInfraction: { [code: string]: number } = {};
    const byMonth: { [month: string]: number } = {};

    discipline.forEach(d => {
      byInfraction[d.infractionCode] = (byInfraction[d.infractionCode] || 0) + 1;
      
      const month = new Date(d.incidentDate).toLocaleString('default', { month: 'long', year: 'numeric' });
      byMonth[month] = (byMonth[month] || 0) + 1;
    });

    return {
      total: discipline.length,
      byInfraction,
      byMonth,
      recentIncidents: discipline.slice(0, 5),
      hasData: discipline.length > 0
    };
  }

  private generateAttendanceSection(stats: any, attendance: any[], isParentFriendly: boolean): string {
    if (!stats.hasData) {
      return `
        <div class="section">
          <h3>📊 School Attendance</h3>
          ${isParentFriendly ? `
            <div class="parent-explanation">
              <p>This section shows your child's daily school attendance. Regular attendance is crucial for academic success - students who attend school consistently perform better and build important learning habits.</p>
              <p><strong>No attendance records found.</strong> This could mean attendance data hasn't been uploaded yet, or your child may be newly enrolled.</p>
            </div>
          ` : ''}
          <p class="no-data">No attendance records found.</p>
        </div>
      `;
    }

    const attendanceColor = stats.attendanceRate >= 95 ? 'excellent' : 
                           stats.attendanceRate >= 90 ? 'good' : 
                           stats.attendanceRate >= 85 ? 'fair' : 'concern';

    return `
      <div class="section">
        <h3>📊 School Attendance</h3>
        ${isParentFriendly ? `
          <div class="parent-explanation">
            <p><strong>Why This Matters:</strong> Regular school attendance is one of the strongest predictors of academic success. Students who attend school consistently are more likely to read proficiently, graduate on time, and develop positive relationships with peers and teachers.</p>
            <p><strong>Understanding the Numbers:</strong> Schools typically aim for at least 95% attendance. Your child's current attendance rate is <strong>${stats.attendanceRate}%</strong>, which is considered <strong>${this.getAttendanceRating(stats.attendanceRate)}</strong>.</p>
            ${stats.attendanceRate < 90 ? `
              <div class="concern-note">
                <strong>📣 Attendance Concern:</strong> When students miss more than 10% of school days (about 18 days in a school year), they are considered "chronically absent." This can significantly impact learning, even when absences are excused.
              </div>
            ` : ''}
          </div>
        ` : ''}
        
        <div class="summary-stats">
          <div class="stat-card ${attendanceColor}">
            <div class="stat-value">${stats.attendanceRate}%</div>
            <div class="stat-label">Overall Attendance Rate</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${stats.presentCount}</div>
            <div class="stat-label">Days Present</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${stats.tardyCount}</div>
            <div class="stat-label">Days Tardy</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${stats.absentCount}</div>
            <div class="stat-label">Days Absent</div>
          </div>
        </div>

        ${stats.recentAttendanceRate !== stats.attendanceRate ? `
          <div class="trend-info">
            <h4>Recent Trend (Last 30 Days)</h4>
            <p>Recent attendance rate: <strong>${stats.recentAttendanceRate}%</strong> 
            ${stats.recentAttendanceRate > stats.attendanceRate ? '📈 Improving' : 
              stats.recentAttendanceRate < stats.attendanceRate ? '📉 Needs attention' : '➡️ Stable'}</p>
          </div>
        ` : ''}

        ${isParentFriendly ? `
          <div class="parent-tips">
            <h4>💡 How You Can Help</h4>
            <ul>
              <li><strong>Establish routines:</strong> Consistent bedtimes and morning routines help children get to school on time</li>
              <li><strong>Communicate with school:</strong> Let us know about planned absences or if your child is struggling with attendance</li>
              <li><strong>Address barriers:</strong> If transportation, health, or other issues affect attendance, please reach out for support</li>
              <li><strong>Emphasize importance:</strong> Help your child understand that school attendance is a priority and responsibility</li>
            </ul>
          </div>
        ` : ''}
      </div>
    `;
  }

  private getAttendanceRating(rate: number): string {
    if (rate >= 97) return 'Excellent';
    if (rate >= 95) return 'Good';
    if (rate >= 90) return 'Fair';
    if (rate >= 85) return 'Below Expectations';
    return 'Concerning';
  }

  private generateGradesSection(stats: any, grades: any[], isParentFriendly: boolean): string {
    if (!stats.hasData) {
      return `
        <div class="section">
          <h3>📚 Academic Performance</h3>
          ${isParentFriendly ? `
            <div class="parent-explanation">
              <p>This section shows your child's grades across all subjects. Grades help track academic progress and identify areas where your child excels or may need additional support.</p>
              <p><strong>No grade records found.</strong> This could mean grades haven't been posted yet, or this may be early in the grading period.</p>
            </div>
          ` : ''}
          <p class="no-data">No grade records found.</p>
        </div>
      `;
    }

    const gpaColor = stats.avgGrade >= 90 ? 'excellent' : 
                     stats.avgGrade >= 80 ? 'good' : 
                     stats.avgGrade >= 70 ? 'fair' : 'concern';

    return `
      <div class="section">
        <h3>📚 Academic Performance</h3>
        ${isParentFriendly ? `
          <div class="parent-explanation">
            <p><strong>Understanding Grades:</strong> Your child's overall average is <strong>${stats.avgGrade.toFixed(1)}</strong>, which corresponds to a <strong>${this.getGradeLetter(stats.avgGrade)}</strong> grade level. This represents their performance across ${stats.totalCourses} courses with ${stats.totalGrades} total grade entries.</p>
            <p><strong>Grade Scale:</strong> Most schools use A (90-100), B (80-89), C (70-79), D (60-69), F (below 60). Consistent performance in the A-B range indicates strong mastery of grade-level content.</p>
            ${stats.avgGrade < 70 ? `
              <div class="concern-note">
                <strong>📣 Academic Support Needed:</strong> Grades below 70% may indicate your child needs additional support. Please consider reaching out to teachers or requesting a parent-teacher conference.
              </div>
            ` : ''}
          </div>
        ` : ''}
        
        <div class="summary-stats">
          <div class="stat-card ${gpaColor}">
            <div class="stat-value">${stats.avgGrade.toFixed(1)}</div>
            <div class="stat-label">Overall Average</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${this.getGradeLetter(stats.avgGrade)}</div>
            <div class="stat-label">Letter Grade</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${stats.totalCourses}</div>
            <div class="stat-label">Total Courses</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${stats.gradeDistribution.A}</div>
            <div class="stat-label">A Grades</div>
          </div>
        </div>

        <div class="detailed-grades">
          <h4>📊 Course-by-Course Breakdown</h4>
          <div class="grades-table">
            ${grades.slice(0, 8).map(gradeRecord => {
              // Sort grades chronologically
              const orderedGrades = this.sortGradesChronologically(gradeRecord.grades || []);
              
              // Get the most recent grade (of any type) for the big display
              const mostRecentGrade = orderedGrades.length > 0 ? orderedGrades[orderedGrades.length - 1] : null;
              const numericGrade = mostRecentGrade ? parseFloat(mostRecentGrade.grade) : null;
              const gradeColor = numericGrade ? (numericGrade >= 80 ? 'good' : numericGrade >= 70 ? 'fair' : 'concern') : '';
              
              // Filter to only show Quarter grades (Q1, Q2, Q3, Q4) for the progression
              const quarterGrades = orderedGrades.filter(g => this.isQuarterGrade(g.period));
              
              
              return `
                <div class="grade-row">
                  <div class="course-info">
                    <div class="course-name">${gradeRecord.course}</div>
                    ${gradeRecord.teacher ? `<div class="teacher-name">👨‍🏫 ${gradeRecord.teacher}</div>` : ''}
                  </div>
                  <div class="current-grade-display ${gradeColor}">
                    <div class="grade-value">${mostRecentGrade ? mostRecentGrade.grade : 'N/A'}</div>
                    <div class="grade-period">${mostRecentGrade ? mostRecentGrade.period : 'No grades yet'}</div>
                  </div>
                  ${quarterGrades.length > 0 ? `
                    <div class="grade-progression">
                      <div class="progression-label">Quarter Grades:</div>
                      ${quarterGrades.map((g) => {
                        const gradeValue = parseFloat(g.grade);
                        const progressColor = !isNaN(gradeValue) ? (gradeValue >= 80 ? 'good' : gradeValue >= 70 ? 'fair' : 'concern') : '';
                        return `
                          <div class="grade-period-item ${progressColor}">
                            <div class="period-name">${g.period}</div>
                            <div class="period-grade">${g.grade}</div>
                          </div>
                        `;
                      }).join('')}
                    </div>
                  ` : `
                    <div class="grade-progression">
                      <div class="no-quarters">No quarter grades yet</div>
                    </div>
                  `}
                </div>
              `;
            }).join('')}
          </div>
        </div>

        ${isParentFriendly ? `
          <div class="parent-tips">
            <h4>💡 Supporting Academic Success</h4>
            <ul>
              <li><strong>Regular check-ins:</strong> Ask your child about their classes and assignments daily</li>
              <li><strong>Create study space:</strong> Provide a quiet, organized area for homework and studying</li>
              <li><strong>Communicate with teachers:</strong> Reach out if you notice grade concerns or changes</li>
              <li><strong>Celebrate progress:</strong> Acknowledge improvements and effort, not just high grades</li>
              <li><strong>Use school resources:</strong> Many schools offer tutoring, study halls, or extra help sessions</li>
            </ul>
          </div>
        ` : ''}
      </div>
    `;
  }

  private getGradeLetter(average: number): string {
    if (average >= 97) return 'A+';
    if (average >= 93) return 'A';
    if (average >= 90) return 'A-';
    if (average >= 87) return 'B+';
    if (average >= 83) return 'B';
    if (average >= 80) return 'B-';
    if (average >= 77) return 'C+';
    if (average >= 73) return 'C';
    if (average >= 70) return 'C-';
    if (average >= 67) return 'D+';
    if (average >= 65) return 'D';
    if (average >= 60) return 'D-';
    return 'F';
  }

  private generateDisciplineSection(stats: any, discipline: any[], isParentFriendly: boolean): string {
    if (!stats.hasData) {
      return `
        <div class="section">
          <h3>✅ Behavioral Record</h3>
          ${isParentFriendly ? `
            <div class="parent-explanation">
              <p><strong>Great News!</strong> Your child has no discipline incidents on record. This indicates they are following school expectations and demonstrating positive behavior choices.</p>
              <p><strong>What This Shows:</strong> A clean disciplinary record suggests your child is respectful, responsible, and making good decisions at school. This creates a positive learning environment for everyone.</p>
            </div>
          ` : ''}
          <p class="no-data">No discipline records found - excellent behavioral record!</p>
        </div>
      `;
    }

    return `
      <div class="section discipline">
        <h3>⚠️ Behavioral Record</h3>
        ${isParentFriendly ? `
          <div class="parent-explanation">
            <p><strong>Understanding Discipline Records:</strong> This section shows incidents where your child's behavior didn't meet school expectations. Schools track this information to identify patterns, provide appropriate support, and ensure a safe learning environment for all students.</p>
            <p><strong>Important Note:</strong> ${stats.total} incident${stats.total !== 1 ? 's' : ''} ${stats.total === 1 ? 'has' : 'have'} been documented. Every child makes mistakes - what matters most is learning from them and developing better strategies.</p>
            <div class="concern-note">
              <strong>📞 Let's Work Together:</strong> If you have questions about any incidents or want to discuss strategies to support positive behavior at home, please reach out to your child's teacher or school counselor.
            </div>
          </div>
        ` : ''}
        
        <div class="summary-stats">
          <div class="stat-card concern">
            <div class="stat-value">${stats.total}</div>
            <div class="stat-label">Total Incidents</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${Object.keys(stats.byInfraction).length}</div>
            <div class="stat-label">Types of Incidents</div>
          </div>
        </div>

        <div class="discipline-details">
          <h4>📋 Recent Incidents</h4>
          <div class="incident-cards">
            ${discipline.slice(0, 6).map((d, index) => `
              <div class="incident-card">
                <div class="incident-header">
                  <div class="incident-number">#${index + 1}</div>
                  <div class="incident-date">${new Date(d.incidentDate).toLocaleDateString()}</div>
                </div>
                <div class="incident-body">
                  <div class="incident-type">
                    <strong>${d.infraction || d.infractionCode}</strong>
                    ${d.location ? `<span class="location-tag">📍 ${d.location}</span>` : ''}
                  </div>
                  ${d.narrative ? `
                    <div class="incident-description">
                      "${d.narrative.length > 120 ? d.narrative.substring(0, 120) + '...' : d.narrative}"
                    </div>
                  ` : ''}
                  <div class="incident-resolution">
                    <span class="action-label">Action Taken:</span>
                    <span class="action-value">${d.action}</span>
                    ${d.actionDays ? `<span class="duration-badge">${d.actionDays} day${d.actionDays !== 1 ? 's' : ''}</span>` : ''}
                  </div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>

        ${isParentFriendly ? `
          <div class="parent-tips">
            <h4>💡 Supporting Positive Behavior</h4>
            <ul>
              <li><strong>Open communication:</strong> Talk with your child about school expectations and problem-solving strategies</li>
              <li><strong>Consistent expectations:</strong> Reinforce school rules and values at home</li>
              <li><strong>Problem-solving skills:</strong> Help your child think through better choices for similar situations</li>
              <li><strong>Stay connected:</strong> Maintain regular contact with teachers and school staff</li>
              <li><strong>Focus on growth:</strong> Emphasize learning from mistakes rather than just consequences</li>
            </ul>
          </div>
        ` : ''}
      </div>
    `;
  }

  private generateAssessmentsSection(stats: any, assessments: any[], isParentFriendly: boolean): string {
    if (!stats.hasData) {
      return `
        <div class="section">
          <h3>📋 Assessment Results</h3>
          ${isParentFriendly ? `
            <div class="parent-explanation">
              <p>This section shows your child's performance on standardized tests and diagnostic assessments. These tests help teachers understand your child's academic strengths and areas for growth.</p>
              <p><strong>No assessment records found.</strong> This could mean testing hasn't occurred yet this year, or results haven't been uploaded to the system.</p>
            </div>
          ` : ''}
          <p class="no-data">No assessment records found.</p>
        </div>
      `;
    }

    return `
      <div class="section">
        <h3>📋 Assessment Results</h3>
        ${isParentFriendly ? `
          <div class="parent-explanation">
            <p><strong>Understanding Assessments:</strong> Your child has taken ${stats.total} assessment${stats.total !== 1 ? 's' : ''} across different subjects. These tests help teachers identify what your child knows well and where they might benefit from additional support or challenge.</p>
            <p><strong>Types of Tests:</strong> This includes standardized tests (like FAST), diagnostic assessments (like iReady), and other evaluations that measure academic progress and growth over time.</p>
            <p><strong>Reading the Scores:</strong> Each assessment type has different scoring systems. Higher scores generally indicate stronger performance, but the most important thing is growth over time.</p>
          </div>
        ` : ''}
        
        <div class="summary-stats">
          <div class="stat-card">
            <div class="stat-value">${stats.total}</div>
            <div class="stat-label">Total Assessments</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${Object.keys(stats.bySource).length}</div>
            <div class="stat-label">Assessment Types</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${Object.keys(stats.bySubject).length}</div>
            <div class="stat-label">Subjects Tested</div>
          </div>
        </div>

        ${Object.keys(stats.bySource).map(source => `
          <div class="assessment-section">
            <div class="assessment-section-header">
              <h4>📊 ${source} Results</h4>
              ${isParentFriendly ? `
                <div class="assessment-help-text">
                  ${this.getAssessmentExplanation(source)}
                </div>
              ` : ''}
            </div>
            
            <div class="assessment-grid">
              ${stats.bySource[source].slice(0, 6).map(assessment => {
                const scoreValue = assessment.score || 0;
                const scoreColor = this.getScoreColor(assessment.source, scoreValue, assessment.proficiency);
                
                return `
                  <div class="assessment-card">
                    <div class="assessment-card-header">
                      <div class="subject-name">${assessment.subject}</div>
                      <div class="test-date">${new Date(assessment.testDate).toLocaleDateString()}</div>
                    </div>
                    <div class="assessment-score ${scoreColor}">
                      <div class="main-score">${assessment.score || 'N/A'}</div>
                      ${assessment.proficiency ? `
                        <div class="proficiency-badge">
                          ${this.formatProficiency(assessment.proficiency)}
                        </div>
                      ` : ''}
                    </div>
                    ${assessment.percentile ? `
                      <div class="percentile-info">
                        <small>Better than ${assessment.percentile}% of students</small>
                      </div>
                    ` : ''}
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        `).join('')}

        ${isParentFriendly ? `
          <div class="parent-tips">
            <h4>💡 Understanding and Supporting Test Performance</h4>
            <ul>
              <li><strong>Focus on growth:</strong> Look for improvement over time rather than comparing to other students</li>
              <li><strong>Use results as information:</strong> Test scores help identify what to work on, not define your child's worth</li>
              <li><strong>Ask teachers:</strong> Request explanations of what scores mean and how to support learning at home</li>
              <li><strong>Consider whole picture:</strong> Tests are just one measure - daily work, effort, and growth matter too</li>
              <li><strong>Support test-taking skills:</strong> Help your child with good sleep, nutrition, and calm mindset on test days</li>
            </ul>
          </div>
        ` : ''}
      </div>
    `;
  }

  private getAssessmentExplanation(source: string): string {
    const explanations: { [key: string]: string } = {
      'FAST': 'FAST (Florida Assessment of Student Thinking) is the state test that measures your child\'s progress in meeting Florida\'s academic standards. Results help determine if your child is on track for grade-level expectations.',
      'iReady': 'iReady is a diagnostic assessment that identifies your child\'s strengths and areas for growth. It adapts to your child\'s responses to provide a personalized learning path.',
      'iReady Reading': 'This diagnostic measures your child\'s reading skills including phonics, vocabulary, comprehension, and more. Results guide personalized reading instruction.',
      'iReady Math': 'This diagnostic assesses your child\'s math understanding across key concepts for their grade level. Results help teachers provide targeted math support.',
      'STAR': 'STAR assessments provide quick, accurate measures of your child\'s academic progress and help predict performance on state tests.'
    };
    return explanations[source] || `${source} assessments help measure your child's academic progress and inform instruction.`;
  }

  private formatProficiency(level: string): string {
    const formatted = level.charAt(0).toUpperCase() + level.slice(1).toLowerCase();
    const colors: { [key: string]: string } = {
      'Exceeds': 'excellent',
      'Meets': 'good', 
      'Approaching': 'fair',
      'Below': 'concern'
    };
    return `<span class="${colors[formatted] || ''}">${formatted} Standards</span>`;
  }

  private getScoreColor(source: string, score: number, proficiency?: string): string {
    // If proficiency is available, use that
    if (proficiency) {
      const level = proficiency.toLowerCase();
      if (level.includes('exceed')) return 'excellent';
      if (level.includes('meet')) return 'good';
      if (level.includes('approach')) return 'fair';
      if (level.includes('below')) return 'concern';
    }
    
    // Otherwise use score-based logic (this is a simplified approach)
    if (score >= 80) return 'excellent';
    if (score >= 70) return 'good';
    if (score >= 60) return 'fair';
    if (score > 0) return 'concern';
    return '';
  }

  private isQuarterGrade(period: string): boolean {
    if (!period) return false;
    
    const quarterPeriods = [
      'Q1', 'Quarter 1', 'Gradebook Quarter 1', 'First Quarter',
      'Q2', 'Quarter 2', 'Gradebook Quarter 2', 'Second Quarter',
      'Q3', 'Quarter 3', 'Gradebook Quarter 3', 'Third Quarter',
      'Q4', 'Quarter 4', 'Gradebook Quarter 4', 'Fourth Quarter'
    ];
    
    return quarterPeriods.some(qPeriod => 
      qPeriod.toLowerCase() === period.toLowerCase()
    );
  }

  private sortGradesChronologically(grades: any[]): any[] {
    // Define the correct chronological order
    const periodOrder = [
      // Progress Period 1
      'PP1', 'Progress Period 1', 'Progress Quarter 1', 'Progress Quarter 1 (Fall)',
      // Quarter 1
      'Q1', 'Quarter 1', 'Gradebook Quarter 1', 'First Quarter',
      // Progress Period 2
      'PP2', 'Progress Period 2', 'Progress Quarter 2', 'Progress Quarter 2 (Fall)',
      // Quarter 2
      'Q2', 'Quarter 2', 'Gradebook Quarter 2', 'Second Quarter',
      // Progress Period 3
      'PP3', 'Progress Period 3', 'Progress Quarter 3', 'Progress Quarter 3 (Spring)',
      // Quarter 3
      'Q3', 'Quarter 3', 'Gradebook Quarter 3', 'Third Quarter',
      // Progress Period 4
      'PP4', 'Progress Period 4', 'Progress Quarter 4', 'Progress Quarter 4 (Spring)',
      // Quarter 4
      'Q4', 'Quarter 4', 'Gradebook Quarter 4', 'Fourth Quarter',
      // Final grades
      'Final', 'Final Grade', 'Year Final', 'Annual Final'
    ];

    return grades
      .filter(grade => !grade.period?.toLowerCase().includes('full year')) // Skip full year grades
      .sort((a, b) => {
        const aIndex = periodOrder.findIndex(period => 
          period.toLowerCase() === a.period?.toLowerCase()
        );
        const bIndex = periodOrder.findIndex(period => 
          period.toLowerCase() === b.period?.toLowerCase()
        );
        
        // If both periods are found in our order array, sort by that
        if (aIndex !== -1 && bIndex !== -1) {
          return aIndex - bIndex;
        }
        
        // If only one is found, put it first
        if (aIndex !== -1) return -1;
        if (bIndex !== -1) return 1;
        
        // If neither is found, sort alphabetically as fallback
        return (a.period || '').localeCompare(b.period || '');
      });
  }

  async openPrintWindow(studentId: string | number, reportFormat: 'detailed' | 'parent-friendly' = 'detailed'): Promise<void> {
    // First, fetch all the data we need
    const studentData = await this.fetchStudentData(studentId);
    
    const printWindow = window.open('', '_blank', 'width=816,height=1056,scrollbars=yes');
    
    if (!printWindow) {
      throw new Error('Failed to open print window. Please check popup blocker settings.');
    }

    // Generate the complete HTML with data
    const studentHTML = this.generateStudentHTML(studentData, reportFormat);

    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Student Report - ${studentData.student?.firstName} ${studentData.student?.lastName}</title>
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
            background: white;
            width: 8.5in;
            min-height: 11in;
            margin: 0 auto;
            padding: 0.5in;
            color: #333;
            line-height: 1.4;
          }
          
          .print-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
            padding: 10px 0;
            border-bottom: 2px solid #e0e0e0;
          }
          
          .print-button {
            background: #007bff;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 5px;
            cursor: pointer;
            font-size: 14px;
            font-weight: 500;
          }
          
          .print-button:hover {
            background: #0056b3;
          }
          
          .student-profile {
            width: 100%;
            max-width: 7.5in;
          }
          
          .student-header {
            display: flex;
            align-items: center;
            margin-bottom: 30px;
            padding: 20px;
            background: #f8f9fa;
            border-radius: 8px;
          }
          
          .student-avatar {
            margin-right: 20px;
          }
          
          .avatar-circle {
            width: 60px;
            height: 60px;
            border-radius: 50%;
            background: #007bff;
            color: white;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: bold;
            font-size: 20px;
          }
          
          .student-info h2 {
            font-size: 24px;
            color: #2c3e50;
            margin-bottom: 10px;
          }
          
          .student-details {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 5px;
            font-size: 14px;
          }
          
          .student-details div {
            margin-bottom: 4px;
          }
          
          .section {
            margin-bottom: 25px;
            break-inside: avoid;
          }
          
          .section h3 {
            font-size: 18px;
            color: #2c3e50;
            margin-bottom: 15px;
            padding-bottom: 8px;
            border-bottom: 2px solid #e0e0e0;
          }
          
          .section.discipline h3 {
            color: #dc3545;
          }
          
          .summary-stats {
            display: flex;
            gap: 15px;
            margin-bottom: 15px;
          }
          
          .stat-card {
            background: #f8f9fa;
            padding: 15px;
            border-radius: 6px;
            text-align: center;
            flex: 1;
            border: 1px solid #e0e0e0;
          }
          
          .stat-value {
            font-size: 24px;
            font-weight: bold;
            color: #007bff;
          }
          
          .stat-label {
            font-size: 12px;
            color: #666;
            margin-top: 5px;
          }
          
          .grades-list, .discipline-list, .assessments-list {
            background: #f8f9fa;
            border-radius: 6px;
            overflow: hidden;
          }
          
          .grade-item, .discipline-item, .assessment-item {
            padding: 12px 15px;
            border-bottom: 1px solid #e0e0e0;
            display: flex;
            justify-content: space-between;
            align-items: center;
          }
          
          .grade-item:last-child,
          .discipline-item:last-child,
          .assessment-item:last-child {
            border-bottom: none;
          }
          
          .assessment-item {
            flex-direction: column;
            align-items: flex-start;
          }
          
          .assessment-header {
            display: flex;
            justify-content: space-between;
            width: 100%;
            margin-bottom: 5px;
          }
          
          .assessment-source {
            font-weight: bold;
            color: #007bff;
          }
          
          .assessment-date {
            color: #666;
            font-size: 12px;
          }
          
          .no-data {
            color: #28a745;
            font-style: italic;
            padding: 15px;
            background: #f8f9fa;
            border-radius: 6px;
          }
          
          .error {
            color: #dc3545;
            padding: 20px;
            background: #f8f9fa;
            border-radius: 6px;
            text-align: center;
          }

          /* Parent-Friendly Styling */
          .parent-explanation {
            background: #e8f4fd;
            border-left: 4px solid #007bff;
            padding: 15px;
            margin-bottom: 20px;
            border-radius: 4px;
            font-size: 14px;
            line-height: 1.6;
          }

          .concern-note {
            background: #fff3cd;
            border-left: 4px solid #ffc107;
            padding: 12px;
            margin: 10px 0;
            border-radius: 4px;
            font-size: 13px;
          }

          .parent-tips {
            background: #f8f9fa;
            border-radius: 6px;
            padding: 15px;
            margin-top: 20px;
          }

          .parent-tips h4 {
            color: #28a745;
            margin-bottom: 10px;
            font-size: 16px;
          }

          .parent-tips ul {
            list-style-position: inside;
            margin-left: 0;
          }

          .parent-tips li {
            margin-bottom: 8px;
            font-size: 13px;
            line-height: 1.5;
          }

          .trend-info {
            background: #f8f9fa;
            padding: 12px;
            border-radius: 6px;
            margin: 15px 0;
            border-left: 3px solid #007bff;
          }

          .trend-info h4 {
            font-size: 14px;
            margin-bottom: 5px;
            color: #2c3e50;
          }

          /* Enhanced Stat Cards */
          .stat-card.excellent {
            background: #d4edda;
            border-color: #28a745;
          }

          .stat-card.good {
            background: #cce7f0;
            border-color: #17a2b8;
          }

          .stat-card.fair {
            background: #fff3cd;
            border-color: #ffc107;
          }

          .stat-card.concern {
            background: #f8d7da;
            border-color: #dc3545;
          }

          /* Enhanced Section Spacing with Page Breaks */
          .section {
            margin-bottom: 25px;
            break-inside: avoid;
            page-break-inside: avoid;
            page-break-before: always;
          }

          .section:first-of-type,
          .section:nth-of-type(2) {
            page-break-before: avoid;
          }

          .section h3 {
            font-size: 20px;
            color: #2c3e50;
            margin-bottom: 15px;
            padding-bottom: 8px;
            border-bottom: 3px solid #e0e0e0;
            display: flex;
            align-items: center;
            gap: 8px;
          }

          /* Improved Grade Tables */
          .detailed-grades {
            margin-top: 25px;
          }

          .detailed-grades h4 {
            color: #2c3e50;
            margin-bottom: 15px;
            font-size: 16px;
          }

          .grades-table {
            border: 1px solid #e0e0e0;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 2px 4px rgba(0,0,0,0.05);
          }

          .grade-row {
            display: flex;
            padding: 8px 12px;
            border-bottom: 1px solid #f0f0f0;
            align-items: center;
            background: white;
            min-height: 40px;
          }

          .grade-row:last-child {
            border-bottom: none;
          }

          .grade-row:nth-child(even) {
            background: #f9f9f9;
          }

          .course-info {
            flex: 2;
            padding-right: 10px;
          }

          .course-name {
            font-weight: bold;
            color: #2c3e50;
            font-size: 13px;
            margin-bottom: 2px;
          }

          .teacher-name {
            font-size: 10px;
            color: #666;
            font-style: italic;
          }

          .current-grade-display {
            flex: 1;
            text-align: center;
            padding: 6px;
            border-radius: 4px;
            margin: 0 8px;
            min-width: 70px;
            height: 45px;
            display: flex;
            flex-direction: column;
            justify-content: center;
          }

          .current-grade-display.good {
            background: #d4edda;
            border: 2px solid #28a745;
          }

          .current-grade-display.fair {
            background: #fff3cd;
            border: 2px solid #ffc107;
          }

          .current-grade-display.concern {
            background: #f8d7da;
            border: 2px solid #dc3545;
          }

          .grade-value {
            font-size: 18px;
            font-weight: bold;
            color: #2c3e50;
          }

          .grade-period {
            font-size: 9px;
            color: #666;
            margin-top: 1px;
          }

          .grade-progression {
            flex: 3;
            display: flex;
            gap: 6px;
            flex-wrap: wrap;
            justify-content: flex-end;
            align-items: center;
          }

          .progression-label {
            font-size: 9px;
            color: #666;
            font-weight: bold;
            margin-right: 6px;
            white-space: nowrap;
          }

          .grade-period-item {
            background: #f8f9fa;
            border: 1px solid #e0e0e0;
            border-radius: 3px;
            padding: 4px 6px;
            text-align: center;
            min-width: 40px;
            font-size: 9px;
          }

          .grade-period-item.current-period {
            transform: scale(1.1);
            box-shadow: 0 2px 6px rgba(0,0,0,0.15);
            z-index: 1;
            position: relative;
          }

          .grade-period-item.good {
            background: #d4edda;
            border-color: #28a745;
            color: #155724;
          }

          .grade-period-item.fair {
            background: #fff3cd;
            border-color: #ffc107;
            color: #856404;
          }

          .grade-period-item.concern {
            background: #f8d7da;
            border-color: #dc3545;
            color: #721c24;
          }

          .period-name {
            font-weight: bold;
            font-size: 8px;
          }

          .period-grade {
            font-size: 10px;
            margin-top: 1px;
          }

          .no-grades, .no-quarters {
            color: #666;
            font-style: italic;
            text-align: center;
            padding: 20px;
            font-size: 12px;
          }

          /* Discipline Cards */
          .incident-cards {
            display: grid;
            gap: 15px;
            margin-top: 15px;
          }

          .incident-card {
            background: white;
            border: 1px solid #e0e0e0;
            border-radius: 8px;
            padding: 15px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.05);
          }

          .incident-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 12px;
            padding-bottom: 8px;
            border-bottom: 1px solid #f0f0f0;
          }

          .incident-number {
            background: #dc3545;
            color: white;
            padding: 4px 8px;
            border-radius: 12px;
            font-size: 11px;
            font-weight: bold;
          }

          .incident-date {
            color: #666;
            font-size: 13px;
            font-weight: bold;
          }

          .incident-type {
            font-size: 15px;
            font-weight: bold;
            color: #2c3e50;
            margin-bottom: 8px;
            display: flex;
            align-items: center;
            gap: 8px;
          }

          .location-tag {
            background: #f8f9fa;
            color: #666;
            padding: 2px 8px;
            border-radius: 12px;
            font-size: 11px;
            font-weight: normal;
          }

          .incident-description {
            background: #f8f9fa;
            padding: 8px;
            border-radius: 4px;
            font-size: 13px;
            color: #555;
            margin: 8px 0;
            font-style: italic;
          }

          .incident-resolution {
            display: flex;
            align-items: center;
            gap: 8px;
            margin-top: 10px;
          }

          .action-label {
            color: #666;
            font-size: 12px;
          }

          .action-value {
            font-weight: bold;
            color: #856404;
          }

          .duration-badge {
            background: #fff3cd;
            color: #856404;
            padding: 2px 6px;
            border-radius: 8px;
            font-size: 10px;
            font-weight: bold;
          }

          /* Assessment Cards */
          .assessment-section {
            margin: 25px 0;
            break-inside: avoid;
          }

          .assessment-section-header {
            margin-bottom: 20px;
          }

          .assessment-section-header h4 {
            color: #2c3e50;
            font-size: 18px;
            margin-bottom: 10px;
          }

          .assessment-help-text {
            background: #e8f4fd;
            border-left: 4px solid #007bff;
            padding: 12px;
            border-radius: 4px;
            font-size: 13px;
            color: #333;
          }

          .assessment-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
          }

          .assessment-card {
            background: white;
            border: 1px solid #e0e0e0;
            border-radius: 8px;
            padding: 15px;
            text-align: center;
            box-shadow: 0 2px 4px rgba(0,0,0,0.05);
          }

          .assessment-card-header {
            margin-bottom: 12px;
            padding-bottom: 8px;
            border-bottom: 1px solid #f0f0f0;
          }

          .subject-name {
            font-weight: bold;
            color: #2c3e50;
            font-size: 14px;
          }

          .test-date {
            color: #666;
            font-size: 11px;
            margin-top: 3px;
          }

          .assessment-score {
            padding: 12px 8px;
            border-radius: 6px;
            margin: 8px 0;
          }

          .assessment-score.excellent {
            background: #d4edda;
            border: 2px solid #28a745;
          }

          .assessment-score.good {
            background: #cce7f0;
            border: 2px solid #17a2b8;
          }

          .assessment-score.fair {
            background: #fff3cd;
            border: 2px solid #ffc107;
          }

          .assessment-score.concern {
            background: #f8d7da;
            border: 2px solid #dc3545;
          }

          .main-score {
            font-size: 24px;
            font-weight: bold;
            color: #2c3e50;
          }

          .proficiency-badge {
            margin-top: 6px;
            font-size: 11px;
            font-weight: bold;
          }

          .proficiency-badge .excellent {
            color: #28a745;
          }

          .proficiency-badge .good {
            color: #17a2b8;
          }

          .proficiency-badge .fair {
            color: #856404;
          }

          .proficiency-badge .concern {
            color: #dc3545;
          }

          .percentile-info {
            margin-top: 8px;
            color: #666;
            font-size: 11px;
          }
          
          @media print {
            body {
              width: 8.5in;
              height: 11in;
              margin: 0;
              padding: 0.5in;
            }
            
            .print-header {
              display: none !important;
            }
            
            .student-profile {
              width: 100%;
              max-width: none;
            }
            
            .section {
              break-inside: avoid;
            }
          }
          
          @page {
            size: letter;
            margin: 0.5in;
          }
        </style>
      </head>
      <body>
        <div class="print-header">
          <h1>Student Report - ${studentData.student?.firstName} ${studentData.student?.lastName}</h1>
          <button class="print-button" onclick="window.print()">Print Report</button>
        </div>
        ${studentHTML}
      </body>
      </html>
    `);
    
    printWindow.document.close();
    printWindow.focus();
  }

  async generateReports(studentIds: (string | number)[], reportFormat: 'detailed' | 'parent-friendly' = 'detailed'): Promise<void> {
    if (studentIds.length === 0) {
      throw new Error('No students selected for report generation.');
    }

    // Validate all student IDs first - just check they're not null/undefined
    const invalidIds = studentIds.filter(id => !id && id !== 0);
    if (invalidIds.length > 0) {
      throw new Error(`Invalid student IDs found: ${invalidIds.join(', ')}`);
    }

    // Open each student report in a separate window
    const errors: string[] = [];
    for (const studentId of studentIds) {
      try {
        await this.openPrintWindow(studentId, reportFormat);
        // Small delay between windows to prevent browser from blocking
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        console.error(`Failed to open print window for student ${studentId}:`, error);
        errors.push(`Student ${studentId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    // If any errors occurred, log them but don't throw (since some windows might have opened successfully)
    if (errors.length > 0) {
      console.warn(`Some print windows failed to open:\n${errors.join('\n')}`);
    }
  }
}

export const htmlPrintService = new HTMLPrintService();