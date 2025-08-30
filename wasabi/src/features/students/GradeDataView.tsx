import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { db } from '../../lib/db';
import { queryByStudentId } from '../../utils/studentIdQuery';

interface GradeDataViewProps {
  studentId: number;
}

interface GradeRecord {
  id?: number;
  studentId: string;
  course: string;
  teacher?: string;
  period?: string;
  finalGrade?: string | number; // Add finalGrade for GPA calculation
  grades: Array<{ period: string; grade: string }>;
  [key: string]: any;
}

export default function GradeDataView({ studentId }: GradeDataViewProps) {
  // Dark mode detection
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    // Check initial dark mode state
    const checkDarkMode = () => {
      const isDark = document.documentElement.classList.contains('dark');
      setIsDarkMode(isDark);
    };

    checkDarkMode();

    // Set up observer to watch for class changes
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
          checkDarkMode();
        }
      });
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    });

    return () => observer.disconnect();
  }, []);

  const { data: gradeData, isLoading } = useQuery({
    queryKey: ['grades', studentId],
    queryFn: async () => {
      const records = await queryByStudentId(db.grades, studentId);
      return records as GradeRecord[];
    },
  });

  // Get all unique grade periods from the data, ordered correctly (must be before early returns)
  const allPeriods = React.useMemo(() => {
    if (!gradeData?.length) return [];
    
    const periods = new Set<string>();
    gradeData.forEach(record => {
      record.grades?.forEach(grade => {
        // Skip "Full Year" grades - we don't want to display them
        if (grade.period && !grade.period.toLowerCase().includes('full year')) {
          periods.add(grade.period);
        }
      });
    });
    
    // Define the correct order for periods: PP1, Q1, PP2, Q2, PP3, Q3, PP4, Q4, Final
    const periodOrder = [
      // Progress Period 1
      'PP1', 'Progress Period 1', 'Progress Quarter 1', 'Progress Quarter 1 (Fall)',
      // Quarter 1
      'Q1', 'Quarter 1', 'Gradebook Quarter 1',
      // Progress Period 2
      'PP2', 'Progress Period 2', 'Progress Quarter 2', 'Progress Quarter 2 (Fall)',
      // Quarter 2
      'Q2', 'Quarter 2', 'Gradebook Quarter 2',
      // Progress Period 3
      'PP3', 'Progress Period 3', 'Progress Quarter 3', 'Progress Quarter 3 (Spring)',
      // Quarter 3
      'Q3', 'Quarter 3', 'Gradebook Quarter 3',
      // Progress Period 4
      'PP4', 'Progress Period 4', 'Progress Quarter 4', 'Progress Quarter 4 (Spring)',
      // Quarter 4
      'Q4', 'Quarter 4', 'Gradebook Quarter 4',
      // Final at the end
      'Final', 'Final Grade', 'Year Final', 'Semester Final'
    ];
    
    // Sort periods based on the defined order with exact matching
    return Array.from(periods).sort((a, b) => {
      // Find exact matches first, then partial matches
      const getOrderIndex = (period: string) => {
        // Try exact match first
        let index = periodOrder.findIndex(order => period === order);
        if (index !== -1) return index;
        
        // Try partial match (period contains the order term) - more specific first
        index = periodOrder.findIndex(order => period.includes(order));
        if (index !== -1) return index;
        
        // Try reverse partial match (order term contains the period)
        index = periodOrder.findIndex(order => order.includes(period));
        if (index !== -1) return index;
        
        // Not found - assign high number to sort to end
        return 9999;
      };
      
      const indexA = getOrderIndex(a);
      const indexB = getOrderIndex(b);
      
      // If both found in order, sort by index
      if (indexA !== 9999 && indexB !== 9999) {
        return indexA - indexB;
      }
      
      // If only one found, prioritize the ordered one
      if (indexA !== 9999) return -1;
      if (indexB !== 9999) return 1;
      
      // If neither found, sort alphabetically
      return a.localeCompare(b);
    });
  }, [gradeData]);
  
  // Helper function to clean up course names for display
  const cleanCourseName = (courseName: string): string => {
    if (!courseName) return courseName;
    
    let cleanName = courseName.trim();
    
    // Remove grade levels (e.g., "5th Grade Math" -> "Math", "Grade 3 Science" -> "Science")
    cleanName = cleanName
      .replace(/^\d+(st|nd|rd|th)?\s+(Grade\s+)?/i, '') // "5th Grade Math" -> "Math"
      .replace(/^Grade\s+\d+\s+/i, '') // "Grade 3 Science" -> "Science"
      .replace(/\s+\d+(st|nd|rd|th)?\s*$/i, '') // "Math 5th" -> "Math"
      .replace(/\s+Grade\s*$/i, '') // "Math Grade" -> "Math"
      .replace(/^G\d+\s+/i, '') // "G5 Math" -> "Math"
      .replace(/\s+G\d+\s*$/i, ''); // "Math G5" -> "Math"
    
    // Expand common abbreviations
    const expansions: Record<string, string> = {
      // Core subjects
      'soc st': 'Social Studies',
      'soc stud': 'Social Studies',
      'social st': 'Social Studies',
      'soc': 'Social Studies',
      'ss': 'Social Studies',
      
      'lang arts': 'Language Arts',
      'lng arts': 'Language Arts',
      'la': 'Language Arts',
      'ela': 'English Language Arts',
      'eng': 'English',
      'engl': 'English',
      'english lang arts': 'English Language Arts',
      
      'math': 'Mathematics',
      'mth': 'Mathematics',
      'mathematics': 'Mathematics',
      'algebra': 'Algebra',
      'geometry': 'Geometry',
      'calc': 'Calculus',
      
      'sci': 'Science',
      'science': 'Science',
      'bio': 'Biology',
      'chem': 'Chemistry',
      'phys': 'Physics',
      'earth sci': 'Earth Science',
      
      // Specials
      'pe': 'Physical Education',
      'phy ed': 'Physical Education',
      'phys ed': 'Physical Education',
      'physical ed': 'Physical Education',
      'gym': 'Physical Education',
      
      'art': 'Art',
      'arts': 'Art',
      'fine arts': 'Fine Arts',
      'visual arts': 'Visual Arts',
      
      'mus': 'Music',
      'music': 'Music',
      'band': 'Band',
      'choir': 'Choir',
      'orchestra': 'Orchestra',
      
      'lib': 'Library',
      'library': 'Library',
      'media': 'Library/Media',
      
      'tech': 'Technology',
      'technology': 'Technology',
      'comp sci': 'Computer Science',
      'computer sci': 'Computer Science',
      'programming': 'Programming',
      
      // Other subjects
      'span': 'Spanish',
      'spanish': 'Spanish',
      'fr': 'French',
      'french': 'French',
      'ger': 'German',
      'german': 'German',
      
      'hist': 'History',
      'history': 'History',
      'us hist': 'U.S. History',
      'world hist': 'World History',
      'american hist': 'American History',
      
      'geo': 'Geography',
      'geography': 'Geography',
      'econ': 'Economics',
      'economics': 'Economics',
      'gov': 'Government',
      'government': 'Government',
      'civics': 'Civics',
      
      'health': 'Health',
      'hlth': 'Health',
      'nutrition': 'Nutrition',
      
      'study skills': 'Study Skills',
      'study hall': 'Study Hall',
      'homeroom': 'Homeroom',
      'advisory': 'Advisory'
    };
    
    // Apply expansions (case-insensitive)
    const lowerName = cleanName.toLowerCase();
    for (const [abbrev, expansion] of Object.entries(expansions)) {
      if (lowerName === abbrev.toLowerCase()) {
        return expansion;
      }
    }
    
    // Handle partial matches for compound names like "Adv Math" -> "Advanced Mathematics"
    let expandedName = cleanName;
    expandedName = expandedName.replace(/\badv\b/gi, 'Advanced');
    expandedName = expandedName.replace(/\belem\b/gi, 'Elementary');
    expandedName = expandedName.replace(/\bintermed\b/gi, 'Intermediate');
    expandedName = expandedName.replace(/\bbeg\b/gi, 'Beginning');
    expandedName = expandedName.replace(/\bintro\b/gi, 'Introduction to');
    
    // Clean up spacing and capitalize properly
    expandedName = expandedName.replace(/\s+/g, ' ').trim();
    
    // Capitalize first letter of each word
    return expandedName.split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  };

  // Helper function to get display name for period
  const getPeriodDisplayName = (period: string): string => {
    // Map period names to display names
    const displayMap: Record<string, string> = {
      // Progress Periods should show as PP1, PP2, etc.
      'Progress Period 1': 'PP1',
      'Progress Quarter 1': 'PP1',
      'Progress Quarter 1 (Fall)': 'PP1',
      // Quarters should show as Q1, Q2, etc.
      'Quarter 1': 'Q1',
      'Gradebook Quarter 1': 'Q1',
      
      'Progress Period 2': 'PP2',
      'Progress Quarter 2': 'PP2',
      'Progress Quarter 2 (Fall)': 'PP2',
      'Quarter 2': 'Q2',
      'Gradebook Quarter 2': 'Q2',
      
      'Progress Period 3': 'PP3',
      'Progress Quarter 3': 'PP3',
      'Progress Quarter 3 (Spring)': 'PP3',
      'Quarter 3': 'Q3',
      'Gradebook Quarter 3': 'Q3',
      
      'Progress Period 4': 'PP4',
      'Progress Quarter 4': 'PP4',
      'Progress Quarter 4 (Spring)': 'PP4',
      'Quarter 4': 'Q4',
      'Gradebook Quarter 4': 'Q4',
      
      // Final grades
      'Final': 'Final',
      'Final Grade': 'Final',
      'Year Final': 'Final',
      'Semester Final': 'Final'
    };
    
    return displayMap[period] || period;
  };

  // Helper function to categorize and sort courses
  const getCourseOrder = (courseName: string): number => {
    if (!courseName) return 9999;
    
    const cleanName = cleanCourseName(courseName).toLowerCase();
    
    // Core subjects (priority 1-100)
    if (cleanName.includes('math') || cleanName.includes('algebra') || 
        cleanName.includes('geometry') || cleanName.includes('calculus')) {
      return 10;
    }
    if (cleanName.includes('read') || cleanName.includes('english') || 
        cleanName.includes('language arts') || cleanName.includes('ela')) {
      return 20;
    }
    if (cleanName.includes('writ') || cleanName.includes('composition')) {
      return 30;
    }
    if (cleanName.includes('sci') || cleanName.includes('biology') || 
        cleanName.includes('chemistry') || cleanName.includes('physics')) {
      return 40;
    }
    if (cleanName.includes('social') || cleanName.includes('history') || 
        cleanName.includes('geography') || cleanName.includes('civics') || 
        cleanName.includes('government') || cleanName.includes('economics')) {
      return 50;
    }
    
    // Resource/Enrichment classes (priority 200-300)
    if (cleanName.includes('art') || cleanName.includes('visual')) {
      return 200;
    }
    if (cleanName.includes('physical education') || cleanName.includes('pe') || 
        cleanName.includes('gym') || cleanName.includes('health')) {
      return 210;
    }
    if (cleanName.includes('music') || cleanName.includes('band') || 
        cleanName.includes('choir') || cleanName.includes('orchestra')) {
      return 220;
    }
    if (cleanName.includes('library') || cleanName.includes('media') || 
        cleanName.includes('technology') || cleanName.includes('computer')) {
      return 230;
    }
    if (cleanName.includes('spanish') || cleanName.includes('french') || 
        cleanName.includes('german') || cleanName.includes('language')) {
      return 240;
    }
    
    // Conduct/Behavior (priority 900)
    if (cleanName.includes('conduct') || cleanName.includes('behavior') || 
        cleanName.includes('citizenship')) {
      return 900;
    }
    
    // Study skills, advisory, homeroom (priority 800)
    if (cleanName.includes('study') || cleanName.includes('advisory') || 
        cleanName.includes('homeroom')) {
      return 800;
    }
    
    // Everything else (priority 500)
    return 500;
  };

  // Sort grade data by course priority
  const sortedGradeData = React.useMemo(() => {
    if (!gradeData?.length) return [];
    
    return [...gradeData].sort((a, b) => {
      const orderA = getCourseOrder(a.course);
      const orderB = getCourseOrder(b.course);
      
      if (orderA !== orderB) {
        return orderA - orderB;
      }
      
      // If same priority, sort alphabetically
      return cleanCourseName(a.course).localeCompare(cleanCourseName(b.course));
    });
  }, [gradeData]);

  // GPA Calculation Functions (consistent with flag-evaluator.ts)
  const convertGradeToGPA = (grade: string | number): number => {
    console.log(`🔍 GPA CALC DEBUG: Converting grade "${grade}" (type: ${typeof grade}) to GPA`);
    
    // Handle direct letter grades
    if (typeof grade === 'string') {
      const upperGrade = grade.toUpperCase().trim();
      
      // Handle pure letter grades first
      if (['A', 'B', 'C', 'D', 'F'].includes(upperGrade)) {
        const gpaMap: Record<string, number> = {
          'A': 4.0, 'B': 3.0, 'C': 2.0, 'D': 1.0, 'F': 0.0
        };
        const result = gpaMap[upperGrade];
        console.log(`🎯 GPA CALC DEBUG: Pure letter grade ${upperGrade} → ${result}`);
        return result;
      }
      
      // Handle format like "77 C" or "82 B" - extract the number first
      const numericMatch = grade.match(/^\d+(\.\d+)?/);
      if (numericMatch) {
        const numericGrade = parseFloat(numericMatch[0]);
        console.log(`🔢 GPA CALC DEBUG: Extracted numeric ${numericGrade} from "${grade}"`);
        return convertNumericToGPA(numericGrade);
      }
      
      // Try to parse entire string as number (fallback)
      const numericGrade = parseFloat(grade);
      if (!isNaN(numericGrade)) {
        console.log(`🔢 GPA CALC DEBUG: Parsed entire string as ${numericGrade}`);
        return convertNumericToGPA(numericGrade);
      }
    } else if (typeof grade === 'number') {
      return convertNumericToGPA(grade);
    }
    
    console.log(`⚠️ GPA CALC DEBUG: Could not convert grade "${grade}" to GPA, returning 2.0`);
    return 2.0; // Default to C
  };

  const convertNumericToGPA = (grade: number): number => {
    let gpa: number;
    if (grade >= 90) gpa = 4.0; // A
    else if (grade >= 80) gpa = 3.0; // B
    else if (grade >= 70) gpa = 2.0; // C
    else if (grade >= 60) gpa = 1.0; // D
    else gpa = 0.0; // F
    
    console.log(`🧮 GPA CALC DEBUG: Numeric grade ${grade} → GPA ${gpa}`);
    return gpa;
  };

  // Calculate overall GPA from grade records
  const calculateGPA = React.useMemo(() => {
    if (!gradeData?.length) return null;
    
    console.log(`📊 GPA CALC DEBUG: Calculating GPA for ${gradeData.length} course records`);
    
    let totalGradePoints = 0;
    let validGradeCount = 0;
    
    gradeData.forEach((record, index) => {
      console.log(`📝 GPA CALC DEBUG: Course ${index + 1} - ${record.course}`);
      console.log(`📝 GPA CALC DEBUG: finalGrade:`, record.finalGrade);
      
      if (record.finalGrade !== undefined && record.finalGrade !== null && record.finalGrade !== '') {
        const gpaValue = convertGradeToGPA(record.finalGrade);
        console.log(`✅ GPA CALC DEBUG: Added ${gpaValue} GPA points for ${record.course}`);
        totalGradePoints += gpaValue;
        validGradeCount++;
      } else {
        console.log(`❌ GPA CALC DEBUG: No finalGrade found for ${record.course}`);
      }
    });
    
    const calculatedGPA = validGradeCount > 0 ? totalGradePoints / validGradeCount : 0;
    console.log(`🎓 GPA CALC DEBUG: Final GPA = ${totalGradePoints}/${validGradeCount} = ${calculatedGPA.toFixed(2)}`);
    
    return {
      gpa: calculatedGPA,
      validCourses: validGradeCount,
      totalCourses: gradeData.length
    };
  }, [gradeData]);

  const getGradeColor = (grade: string, isDark: boolean = false) => {
    if (!grade || grade === '') return isDark ? 'rgb(75 85 99 / 0.3)' : '#f0f0f0';
    
    const numGrade = parseFloat(grade);
    if (isNaN(numGrade)) {
      // Handle letter grades
      switch (grade.toUpperCase()) {
        case 'A': return isDark ? 'rgb(34 197 94 / 0.3)' : '#ccffcc'; // Light/dark green
        case 'B': return isDark ? 'rgb(59 130 246 / 0.3)' : '#cce6ff'; // Light/dark blue  
        case 'C': return isDark ? 'rgb(234 179 8 / 0.3)' : '#ffff99'; // Light/dark yellow
        case 'D': return isDark ? 'rgb(249 115 22 / 0.3)' : '#ffcc99'; // Light/dark orange
        case 'F': return isDark ? 'rgb(239 68 68 / 0.3)' : '#ffcccc'; // Light/dark red
        default: return isDark ? 'rgb(75 85 99 / 0.3)' : '#f0f0f0'; // Light/dark gray
      }
    }
    
    // Handle numeric grades
    if (numGrade >= 90) return isDark ? 'rgb(34 197 94 / 0.3)' : '#ccffcc'; // A - Light/dark green
    if (numGrade >= 80) return isDark ? 'rgb(59 130 246 / 0.3)' : '#cce6ff'; // B - Light/dark blue
    if (numGrade >= 70) return isDark ? 'rgb(234 179 8 / 0.3)' : '#ffff99'; // C - Light/dark yellow
    if (numGrade >= 60) return isDark ? 'rgb(249 115 22 / 0.3)' : '#ffcc99'; // D - Light/dark orange
    return isDark ? 'rgb(239 68 68 / 0.3)' : '#ffcccc'; // F - Light/dark red
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-wasabi-green"></div>
        <span className="ml-2 text-gray-600 dark:text-gray-400">Loading grade data...</span>
      </div>
    );
  }

  if (!sortedGradeData?.length) {
    return (
      <div className="text-center text-gray-500 dark:text-gray-400 py-8">
        <p>No grade data available</p>
        <p className="text-sm">Data will appear here once grade records are uploaded</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100">
          Current Grades by Subject
        </h4>
        {calculateGPA && (
          <div className="text-right">
            <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              GPA: <span className={`inline-block px-2 py-1 rounded text-sm font-bold ${
                calculateGPA.gpa >= 3.5 ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' :
                calculateGPA.gpa >= 3.0 ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' :
                calculateGPA.gpa >= 2.0 ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' :
                calculateGPA.gpa >= 1.0 ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400' :
                'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
              }`}>
                {calculateGPA.gpa.toFixed(2)}
              </span>
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              {calculateGPA.validCourses}/{calculateGPA.totalCourses} courses
            </div>
          </div>
        )}
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse table-fixed">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-600">
              <th className="text-left py-1 px-1 font-medium text-gray-900 dark:text-gray-100" style={{ width: '18%' }}>
                Course
              </th>
              <th className="text-left py-1 px-1 font-medium text-gray-900 dark:text-gray-100" style={{ width: '20%' }}>
                Teacher
              </th>
              {allPeriods.map(period => {
                // Skip Full Year grades in header
                if (period.toLowerCase().includes('full year')) {
                  return null;
                }
                
                return (
                  <th key={period} className="text-center py-1 px-0.5 font-medium text-gray-900 dark:text-gray-100 w-8 min-w-[30px] max-w-[30px]">
                    {getPeriodDisplayName(period)}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {sortedGradeData.map((record, index) => (
              <tr key={index} className="border-b border-gray-100 dark:border-gray-700">
                <td className="py-1 px-1 text-gray-900 dark:text-gray-100" style={{ width: '18%', maxWidth: '18%' }}>
                  <div className="truncate overflow-hidden whitespace-nowrap" title={cleanCourseName(record.course)}>
                    {cleanCourseName(record.course)}
                  </div>
                </td>
                <td className="py-1 px-1 text-gray-600 dark:text-gray-400">
                  <div className="truncate" title={record.teacher || '-'}>
                    {record.teacher || '-'}
                  </div>
                </td>
                {allPeriods.map((period, periodIndex) => {
                  // Skip Full Year grades in display
                  if (period.toLowerCase().includes('full year')) {
                    return null;
                  }
                  
                  const gradeForPeriod = record.grades?.find(g => g.period === period)?.grade || '';
                  
                  // Determine background color - special handling for dashes
                  let backgroundColor;
                  if (gradeForPeriod === '-' || gradeForPeriod === '') {
                    // Look for the previous period's grade for this student
                    let previousGrade = '';
                    for (let i = periodIndex - 1; i >= 0; i--) {
                      const prevPeriod = allPeriods[i];
                      if (!prevPeriod.toLowerCase().includes('full year')) {
                        const prevGradeObj = record.grades?.find(g => g.period === prevPeriod);
                        if (prevGradeObj && prevGradeObj.grade && prevGradeObj.grade !== '-' && prevGradeObj.grade !== '') {
                          previousGrade = prevGradeObj.grade;
                          break;
                        }
                      }
                    }
                    
                    if (previousGrade) {
                      backgroundColor = getGradeColor(previousGrade, isDarkMode);
                    } else {
                      backgroundColor = getGradeColor('', isDarkMode); // Default grey
                    }
                  } else {
                    backgroundColor = getGradeColor(gradeForPeriod, isDarkMode);
                  }
                  
                  return (
                    <td 
                      key={period}
                      className="py-1 px-0.5 text-center font-medium text-xs w-8"
                      style={{ 
                        backgroundColor,
                        color: isDarkMode ? '#fff' : '#000',
                        minWidth: '30px',
                        maxWidth: '30px'
                      }}
                    >
                      {gradeForPeriod || '-'}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Grade Legend - More Compact */}
      <div className="text-center text-xs flex flex-wrap justify-center gap-2 mt-2 text-gray-700 dark:text-gray-300">
        <span className="inline-flex items-center">
          <div 
            className="w-2 h-2 border border-gray-300 dark:border-gray-600 mr-1"
            style={{ backgroundColor: getGradeColor('A', isDarkMode) }}
          ></div>
          A (90+)
        </span>
        <span className="inline-flex items-center">
          <div 
            className="w-2 h-2 border border-gray-300 dark:border-gray-600 mr-1"
            style={{ backgroundColor: getGradeColor('B', isDarkMode) }}
          ></div>
          B (80-89)
        </span>
        <span className="inline-flex items-center">
          <div 
            className="w-2 h-2 border border-gray-300 dark:border-gray-600 mr-1"
            style={{ backgroundColor: getGradeColor('C', isDarkMode) }}
          ></div>
          C (70-79)
        </span>
        <span className="inline-flex items-center">
          <div 
            className="w-2 h-2 border border-gray-300 dark:border-gray-600 mr-1"
            style={{ backgroundColor: getGradeColor('D', isDarkMode) }}
          ></div>
          D (60-69)
        </span>
        <span className="inline-flex items-center">
          <div 
            className="w-2 h-2 border border-gray-300 dark:border-gray-600 mr-1"
            style={{ backgroundColor: getGradeColor('F', isDarkMode) }}
          ></div>
          F (&lt;60)
        </span>
      </div>
    </div>
  );
}