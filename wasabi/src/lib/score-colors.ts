/**
 * Utility functions for score-based color coding
 * Colors range from red (worst) to green (best) based on score thresholds
 */

export interface ColorResult {
  className: string;
  bgClassName: string;
}

export interface PastelColorResult {
  textClassName: string;
  bgClassName: string;
  borderClassName: string;
}

/**
 * Get color classes for attendance rates (percentage)
 * 95%+ = Blue (excellent)
 * 90-94% = Green (good) 
 * 85-89% = Yellow (needs attention)
 * 80-84% = Orange (concerning)
 * <80% = Red (critical)
 */
export function getAttendanceColor(rate: number): ColorResult {
  if (rate >= 95) {
    return {
      className: 'text-blue-600 dark:text-blue-400',
      bgClassName: 'bg-gradient-to-r from-blue-100 to-blue-200 dark:from-blue-800 dark:to-blue-700 border-blue-300 dark:border-blue-600'
    };
  }
  if (rate >= 90) {
    return {
      className: 'text-green-600 dark:text-green-400',
      bgClassName: 'bg-gradient-to-r from-green-100 to-green-200 dark:from-green-800 dark:to-green-700 border-green-300 dark:border-green-600'
    };
  }
  if (rate >= 85) {
    return {
      className: 'text-yellow-600 dark:text-yellow-400',
      bgClassName: 'bg-gradient-to-r from-yellow-100 to-yellow-200 dark:from-yellow-800 dark:to-yellow-700 border-yellow-300 dark:border-yellow-600'
    };
  }
  if (rate >= 80) {
    return {
      className: 'text-orange-600 dark:text-orange-400',
      bgClassName: 'bg-gradient-to-r from-orange-100 to-orange-200 dark:from-orange-800 dark:to-orange-700 border-orange-300 dark:border-orange-600'
    };
  }
  return {
    className: 'text-red-600 dark:text-red-400',
    bgClassName: 'bg-gradient-to-r from-red-100 to-red-200 dark:from-red-800 dark:to-red-700 border-red-300 dark:border-red-600'
  };
}

/**
 * Get color classes for GPA scores (0.0 - 4.0)
 * 3.5+ = Blue (excellent)
 * 3.0-3.49 = Green (good)
 * 2.5-2.99 = Yellow (needs attention)
 * 2.0-2.49 = Orange (concerning)
 * <2.0 = Red (critical)
 */
export function getGPAColor(gpa: number): ColorResult {
  if (gpa >= 3.5) {
    return {
      className: 'text-blue-600 dark:text-blue-400',
      bgClassName: 'bg-gradient-to-r from-blue-100 to-blue-200 dark:from-blue-800 dark:to-blue-700 border-blue-300 dark:border-blue-600'
    };
  }
  if (gpa >= 3.0) {
    return {
      className: 'text-green-600 dark:text-green-400',
      bgClassName: 'bg-gradient-to-r from-green-100 to-green-200 dark:from-green-800 dark:to-green-700 border-green-300 dark:border-green-600'
    };
  }
  if (gpa >= 2.5) {
    return {
      className: 'text-yellow-600 dark:text-yellow-400',
      bgClassName: 'bg-gradient-to-r from-yellow-100 to-yellow-200 dark:from-yellow-800 dark:to-yellow-700 border-yellow-300 dark:border-yellow-600'
    };
  }
  if (gpa >= 2.0) {
    return {
      className: 'text-orange-600 dark:text-orange-400',
      bgClassName: 'bg-gradient-to-r from-orange-100 to-orange-200 dark:from-orange-800 dark:to-orange-700 border-orange-300 dark:border-orange-600'
    };
  }
  return {
    className: 'text-red-600 dark:text-red-400',
    bgClassName: 'bg-gradient-to-r from-red-100 to-red-200 dark:from-red-800 dark:to-red-700 border-red-300 dark:border-red-600'
  };
}

/**
 * Get color classes for iReady scores (typically 100-800 range)
 * 650+ = Green (excellent)
 * 550-649 = Blue (good)
 * 450-549 = Yellow (needs attention)
 * 350-449 = Orange (concerning)
 * <350 = Red (critical)
 */
export function getIReadyColor(score: number): ColorResult {
  if (score >= 650) {
    return {
      className: 'text-green-600 dark:text-green-400',
      bgClassName: 'bg-gradient-to-r from-green-100 to-green-200 dark:from-green-800 dark:to-green-700 border-green-300 dark:border-green-600'
    };
  }
  if (score >= 550) {
    return {
      className: 'text-blue-600 dark:text-blue-400',
      bgClassName: 'bg-gradient-to-r from-blue-100 to-blue-200 dark:from-blue-800 dark:to-blue-700 border-blue-300 dark:border-blue-600'
    };
  }
  if (score >= 450) {
    return {
      className: 'text-yellow-600 dark:text-yellow-400',
      bgClassName: 'bg-gradient-to-r from-yellow-100 to-yellow-200 dark:from-yellow-800 dark:to-yellow-700 border-yellow-300 dark:border-yellow-600'
    };
  }
  if (score >= 350) {
    return {
      className: 'text-orange-600 dark:text-orange-400',
      bgClassName: 'bg-gradient-to-r from-orange-100 to-orange-200 dark:from-orange-800 dark:to-orange-700 border-orange-300 dark:border-orange-600'
    };
  }
  return {
    className: 'text-red-600 dark:text-red-400',
    bgClassName: 'bg-gradient-to-r from-red-100 to-red-200 dark:from-red-800 dark:to-red-700 border-red-300 dark:border-red-600'
  };
}

/**
 * Get color classes for FAST scores (typically 1-5 scale)
 * 5 = Green (excellent)
 * 4 = Blue (good)
 * 3 = Yellow (needs attention)
 * 2 = Orange (concerning)
 * 1 = Red (critical)
 */
export function getFASTColor(score: number): ColorResult {
  if (score >= 5) {
    return {
      className: 'text-green-600 dark:text-green-400',
      bgClassName: 'bg-gradient-to-r from-green-100 to-green-200 dark:from-green-800 dark:to-green-700 border-green-300 dark:border-green-600'
    };
  }
  if (score >= 4) {
    return {
      className: 'text-blue-600 dark:text-blue-400',
      bgClassName: 'bg-gradient-to-r from-blue-100 to-blue-200 dark:from-blue-800 dark:to-blue-700 border-blue-300 dark:border-blue-600'
    };
  }
  if (score >= 3) {
    return {
      className: 'text-yellow-600 dark:text-yellow-400',
      bgClassName: 'bg-gradient-to-r from-yellow-100 to-yellow-200 dark:from-yellow-800 dark:to-yellow-700 border-yellow-300 dark:border-yellow-600'
    };
  }
  if (score >= 2) {
    return {
      className: 'text-orange-600 dark:text-orange-400',
      bgClassName: 'bg-gradient-to-r from-orange-100 to-orange-200 dark:from-orange-800 dark:to-orange-700 border-orange-300 dark:border-orange-600'
    };
  }
  return {
    className: 'text-red-600 dark:text-red-400',
    bgClassName: 'bg-gradient-to-r from-red-100 to-red-200 dark:from-red-800 dark:to-red-700 border-red-300 dark:border-red-600'
  };
}

/**
 * Get pastel colors for attendance cards
 */
export function getAttendancePastelColor(rate: number): PastelColorResult {
  if (rate >= 95) {
    return {
      textClassName: 'text-gray-900 dark:text-gray-100',
      bgClassName: 'bg-blue-50 dark:bg-blue-950',
      borderClassName: 'border-blue-300 dark:border-blue-700'
    };
  }
  if (rate >= 90) {
    return {
      textClassName: 'text-gray-900 dark:text-gray-100',
      bgClassName: 'bg-green-50 dark:bg-green-950',
      borderClassName: 'border-green-300 dark:border-green-700'
    };
  }
  if (rate >= 85) {
    return {
      textClassName: 'text-gray-900 dark:text-gray-100',
      bgClassName: 'bg-yellow-50 dark:bg-yellow-950',
      borderClassName: 'border-yellow-300 dark:border-yellow-700'
    };
  }
  if (rate >= 80) {
    return {
      textClassName: 'text-gray-900 dark:text-gray-100',
      bgClassName: 'bg-orange-50 dark:bg-orange-950',
      borderClassName: 'border-orange-300 dark:border-orange-700'
    };
  }
  return {
    textClassName: 'text-gray-900 dark:text-gray-100',
    bgClassName: 'bg-red-50 dark:bg-red-950',
    borderClassName: 'border-red-300 dark:border-red-700'
  };
}

/**
 * Get pastel colors for GPA cards
 */
export function getGPAPastelColor(gpa: number): PastelColorResult {
  if (gpa >= 3.5) {
    return {
      textClassName: 'text-gray-900 dark:text-gray-100',
      bgClassName: 'bg-blue-50 dark:bg-blue-950',
      borderClassName: 'border-blue-300 dark:border-blue-700'
    };
  }
  if (gpa >= 3.0) {
    return {
      textClassName: 'text-gray-900 dark:text-gray-100',
      bgClassName: 'bg-green-50 dark:bg-green-950',
      borderClassName: 'border-green-300 dark:border-green-700'
    };
  }
  if (gpa >= 2.5) {
    return {
      textClassName: 'text-gray-900 dark:text-gray-100',
      bgClassName: 'bg-yellow-50 dark:bg-yellow-950',
      borderClassName: 'border-yellow-300 dark:border-yellow-700'
    };
  }
  if (gpa >= 2.0) {
    return {
      textClassName: 'text-gray-900 dark:text-gray-100',
      bgClassName: 'bg-orange-50 dark:bg-orange-950',
      borderClassName: 'border-orange-300 dark:border-orange-700'
    };
  }
  return {
    textClassName: 'text-gray-900 dark:text-gray-100',
    bgClassName: 'bg-red-50 dark:bg-red-950',
    borderClassName: 'border-red-300 dark:border-red-700'
  };
}

/**
 * Get pastel colors for iReady cards
 */
export function getIReadyPastelColor(score: number): PastelColorResult {
  if (score >= 650) {
    return {
      textClassName: 'text-gray-900 dark:text-gray-100',
      bgClassName: 'bg-green-50 dark:bg-green-950',
      borderClassName: 'border-green-300 dark:border-green-700'
    };
  }
  if (score >= 550) {
    return {
      textClassName: 'text-gray-900 dark:text-gray-100',
      bgClassName: 'bg-blue-50 dark:bg-blue-950',
      borderClassName: 'border-blue-300 dark:border-blue-700'
    };
  }
  if (score >= 450) {
    return {
      textClassName: 'text-gray-900 dark:text-gray-100',
      bgClassName: 'bg-yellow-50 dark:bg-yellow-950',
      borderClassName: 'border-yellow-300 dark:border-yellow-700'
    };
  }
  if (score >= 350) {
    return {
      textClassName: 'text-gray-900 dark:text-gray-100',
      bgClassName: 'bg-orange-50 dark:bg-orange-950',
      borderClassName: 'border-orange-300 dark:border-orange-700'
    };
  }
  return {
    textClassName: 'text-gray-900 dark:text-gray-100',
    bgClassName: 'bg-red-50 dark:bg-red-950',
    borderClassName: 'border-red-300 dark:border-red-700'
  };
}

/**
 * Get pastel colors for FAST cards
 */
export function getFASTPastelColor(score: number): PastelColorResult {
  if (score >= 5) {
    return {
      textClassName: 'text-gray-900 dark:text-gray-100',
      bgClassName: 'bg-green-50 dark:bg-green-950',
      borderClassName: 'border-green-300 dark:border-green-700'
    };
  }
  if (score >= 4) {
    return {
      textClassName: 'text-gray-900 dark:text-gray-100',
      bgClassName: 'bg-blue-50 dark:bg-blue-950',
      borderClassName: 'border-blue-300 dark:border-blue-700'
    };
  }
  if (score >= 3) {
    return {
      textClassName: 'text-gray-900 dark:text-gray-100',
      bgClassName: 'bg-yellow-50 dark:bg-yellow-950',
      borderClassName: 'border-yellow-300 dark:border-yellow-700'
    };
  }
  if (score >= 2) {
    return {
      textClassName: 'text-gray-900 dark:text-gray-100',
      bgClassName: 'bg-orange-50 dark:bg-orange-950',
      borderClassName: 'border-orange-300 dark:border-orange-700'
    };
  }
  return {
    textClassName: 'text-gray-900 dark:text-gray-100',
    bgClassName: 'bg-red-50 dark:bg-red-950',
    borderClassName: 'border-red-300 dark:border-red-700'
  };
}

/**
 * Get neutral colors for non-performance cards (student count, etc.)
 */
export function getNeutralPastelColor(): PastelColorResult {
  return {
    textClassName: 'text-gray-900 dark:text-gray-100',
    bgClassName: 'bg-gray-50 dark:bg-gray-900',
    borderClassName: 'border-gray-300 dark:border-gray-700'
  };
}

/**
 * Get inverted colors for "at-risk" cards where LOWER numbers are better
 * 0 = Blue (excellent - no at-risk students)
 * Higher numbers = progressively worse colors
 */
export function getAtRiskPastelColor(count: number, total: number): PastelColorResult {
  if (count === 0) {
    return {
      textClassName: 'text-gray-900 dark:text-gray-100',
      bgClassName: 'bg-blue-50 dark:bg-blue-950',
      borderClassName: 'border-blue-300 dark:border-blue-700'
    };
  }
  
  const percentage = (count / total) * 100;
  
  if (percentage <= 5) {
    return {
      textClassName: 'text-gray-900 dark:text-gray-100',
      bgClassName: 'bg-green-50 dark:bg-green-950',
      borderClassName: 'border-green-300 dark:border-green-700'
    };
  }
  if (percentage <= 15) {
    return {
      textClassName: 'text-gray-900 dark:text-gray-100',
      bgClassName: 'bg-yellow-50 dark:bg-yellow-950',
      borderClassName: 'border-yellow-300 dark:border-yellow-700'
    };
  }
  if (percentage <= 25) {
    return {
      textClassName: 'text-gray-900 dark:text-gray-100',
      bgClassName: 'bg-orange-50 dark:bg-orange-950',
      borderClassName: 'border-orange-300 dark:border-orange-700'
    };
  }
  return {
    textClassName: 'text-gray-900 dark:text-gray-100',
    bgClassName: 'bg-red-50 dark:bg-red-950',
    borderClassName: 'border-red-300 dark:border-red-700'
  };
}

/**
 * Calculate percentile-based color for any score array
 * Top 20% = Blue, Next 20% = Green, Next 20% = Yellow, Next 20% = Orange, Bottom 20% = Red
 */
function getPercentileColor(score: number, allScores: number[]): ColorResult {
  const validScores = allScores.filter(s => s > 0).sort((a, b) => b - a); // Sort descending
  
  if (validScores.length === 0) {
    return {
      className: 'text-gray-500 dark:text-gray-400',
      bgClassName: 'bg-gradient-to-r from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-600 border-gray-300 dark:border-gray-500'
    };
  }
  
  const percentile80 = validScores[Math.floor(validScores.length * 0.2)];
  const percentile60 = validScores[Math.floor(validScores.length * 0.4)];
  const percentile40 = validScores[Math.floor(validScores.length * 0.6)];
  const percentile20 = validScores[Math.floor(validScores.length * 0.8)];
  
  if (score >= percentile80) {
    return {
      className: 'text-blue-600 dark:text-blue-400',
      bgClassName: 'bg-gradient-to-r from-blue-100 to-blue-200 dark:from-blue-800 dark:to-blue-700 border-blue-300 dark:border-blue-600'
    };
  }
  if (score >= percentile60) {
    return {
      className: 'text-green-600 dark:text-green-400',
      bgClassName: 'bg-gradient-to-r from-green-100 to-green-200 dark:from-green-800 dark:to-green-700 border-green-300 dark:border-green-600'
    };
  }
  if (score >= percentile40) {
    return {
      className: 'text-yellow-600 dark:text-yellow-400',
      bgClassName: 'bg-gradient-to-r from-yellow-100 to-yellow-200 dark:from-yellow-800 dark:to-yellow-700 border-yellow-300 dark:border-yellow-600'
    };
  }
  if (score >= percentile20) {
    return {
      className: 'text-orange-600 dark:text-orange-400',
      bgClassName: 'bg-gradient-to-r from-orange-100 to-orange-200 dark:from-orange-800 dark:to-orange-700 border-orange-300 dark:border-orange-600'
    };
  }
  return {
    className: 'text-red-600 dark:text-red-400',
    bgClassName: 'bg-gradient-to-r from-red-100 to-red-200 dark:from-red-800 dark:to-red-700 border-red-300 dark:border-red-600'
  };
}

/**
 * Calculate percentile-based pastel color for any score array
 */
function getPercentilePastelColor(score: number, allScores: number[]): PastelColorResult {
  const validScores = allScores.filter(s => s > 0).sort((a, b) => b - a); // Sort descending
  
  if (validScores.length === 0) {
    return getNeutralPastelColor();
  }
  
  const percentile80 = validScores[Math.floor(validScores.length * 0.2)];
  const percentile60 = validScores[Math.floor(validScores.length * 0.4)];
  const percentile40 = validScores[Math.floor(validScores.length * 0.6)];
  const percentile20 = validScores[Math.floor(validScores.length * 0.8)];
  
  if (score >= percentile80) {
    return {
      textClassName: 'text-gray-900 dark:text-gray-100',
      bgClassName: 'bg-blue-50 dark:bg-blue-950',
      borderClassName: 'border-blue-300 dark:border-blue-700'
    };
  }
  if (score >= percentile60) {
    return {
      textClassName: 'text-gray-900 dark:text-gray-100',
      bgClassName: 'bg-green-50 dark:bg-green-950',
      borderClassName: 'border-green-300 dark:border-green-700'
    };
  }
  if (score >= percentile40) {
    return {
      textClassName: 'text-gray-900 dark:text-gray-100',
      bgClassName: 'bg-yellow-50 dark:bg-yellow-950',
      borderClassName: 'border-yellow-300 dark:border-yellow-700'
    };
  }
  if (score >= percentile20) {
    return {
      textClassName: 'text-gray-900 dark:text-gray-100',
      bgClassName: 'bg-orange-50 dark:bg-orange-950',
      borderClassName: 'border-orange-300 dark:border-orange-700'
    };
  }
  return {
    textClassName: 'text-gray-900 dark:text-gray-100',
    bgClassName: 'bg-red-50 dark:bg-red-950',
    borderClassName: 'border-red-300 dark:border-red-700'
  };
}

/**
 * Get percentile-based color for iReady scores using all student data
 */
export function getIReadyPercentileColor(score: number, allScores: number[]): ColorResult {
  return getPercentileColor(score, allScores);
}

/**
 * Get percentile-based color for FAST scores using all student data
 */
export function getFASTPercentileColor(score: number, allScores: number[]): ColorResult {
  return getPercentileColor(score, allScores);
}

/**
 * Get percentile-based pastel color for iReady scores using all student data
 */
export function getIReadyPercentilePastelColor(score: number, allScores: number[]): PastelColorResult {
  return getPercentilePastelColor(score, allScores);
}

/**
 * Get percentile-based pastel color for FAST scores using all student data
 */
export function getFASTPercentilePastelColor(score: number, allScores: number[]): PastelColorResult {
  return getPercentilePastelColor(score, allScores);
}

/**
 * Get overall trend description based on student performance distribution
 */
export function getOverallTrendDescription(excellentCount: number, goodCount: number, needsAttentionCount: number, atRiskCount: number, totalCount: number): string {
  if (totalCount === 0) {
    return 'No Data';
  }
  
  const excellentPercentage = (excellentCount / totalCount) * 100;
  const atRiskPercentage = (atRiskCount / totalCount) * 100;
  const positivePercentage = ((excellentCount + goodCount) / totalCount) * 100;
  
  // Excellent trend: 40%+ excellent students, <10% at-risk
  if (excellentPercentage >= 40 && atRiskPercentage < 10) {
    return 'Excellent Trend';
  }
  
  // Good trend: 60%+ positive (excellent + good), <20% at-risk
  if (positivePercentage >= 60 && atRiskPercentage < 20) {
    return 'Good Trend';
  }
  
  // Needs attention: 30%+ at-risk students
  if (atRiskPercentage >= 30) {
    return 'Needs Attention';
  }
  
  // Concerning: 20-29% at-risk students
  if (atRiskPercentage >= 20) {
    return 'Concerning Trend';
  }
  
  // Moderate: Everything else
  return 'Moderate Trend';
}

/**
 * Get color classes for overall class/grade trend based on student performance distribution
 */
export function getOverallTrendPastelColor(excellentCount: number, goodCount: number, needsAttentionCount: number, atRiskCount: number, totalCount: number): PastelColorResult {
  if (totalCount === 0) {
    return getNeutralPastelColor();
  }
  
  const excellentPercentage = (excellentCount / totalCount) * 100;
  const atRiskPercentage = (atRiskCount / totalCount) * 100;
  const positivePercentage = ((excellentCount + goodCount) / totalCount) * 100;
  
  // Excellent trend: 40%+ excellent students, <10% at-risk
  if (excellentPercentage >= 40 && atRiskPercentage < 10) {
    return {
      textClassName: 'text-blue-900 dark:text-blue-100',
      bgClassName: 'bg-blue-50 dark:bg-blue-950',
      borderClassName: 'border-blue-300 dark:border-blue-700'
    };
  }
  
  // Good trend: 60%+ positive (excellent + good), <20% at-risk
  if (positivePercentage >= 60 && atRiskPercentage < 20) {
    return {
      textClassName: 'text-green-900 dark:text-green-100',
      bgClassName: 'bg-green-50 dark:bg-green-950',
      borderClassName: 'border-green-300 dark:border-green-700'
    };
  }
  
  // Needs attention: 30%+ at-risk students
  if (atRiskPercentage >= 30) {
    return {
      textClassName: 'text-red-900 dark:text-red-100',
      bgClassName: 'bg-red-50 dark:bg-red-950',
      borderClassName: 'border-red-300 dark:border-red-700'
    };
  }
  
  // Concerning: 20-29% at-risk students
  if (atRiskPercentage >= 20) {
    return {
      textClassName: 'text-orange-900 dark:text-orange-100',
      bgClassName: 'bg-orange-50 dark:bg-orange-950',
      borderClassName: 'border-orange-300 dark:border-orange-700'
    };
  }
  
  // Moderate: Everything else
  return {
    textClassName: 'text-yellow-900 dark:text-yellow-100',
    bgClassName: 'bg-yellow-50 dark:bg-yellow-950',
    borderClassName: 'border-yellow-300 dark:border-yellow-700'
  };
}