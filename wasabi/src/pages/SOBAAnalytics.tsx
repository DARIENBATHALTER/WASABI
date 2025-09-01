import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, Users, TrendingUp } from 'lucide-react';
import { sobaService, type SOBAObservation } from '../services/sobaService';
import PageWrapper from '../shared/components/PageWrapper';
import PageHeader from '../shared/components/PageHeader';
import SOBAIcon from '../shared/components/SOBAIcon';

interface ObservationTrend {
  date: string;
  classEngagement: number;
  planning: number;
  instruction: number;
  environment: number;
  responsibility: number;
}

export default function SOBAAnalytics() {
  const [instructors, setInstructors] = useState<string[]>([]);
  const [homerooms, setHomerooms] = useState<string[]>([]);
  const [selectedInstructor, setSelectedInstructor] = useState('');
  const [selectedHomeroom, setSelectedHomeroom] = useState('');
  const [filterType, setFilterType] = useState<'instructor' | 'homeroom'>('instructor');
  const [observations, setObservations] = useState<SOBAObservation[]>([]);
  const [trendData, setTrendData] = useState<ObservationTrend[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadFilters();
  }, []);

  useEffect(() => {
    if ((filterType === 'instructor' && selectedInstructor) || 
        (filterType === 'homeroom' && selectedHomeroom)) {
      loadObservations();
    } else {
      setObservations([]);
      setTrendData([]);
    }
  }, [selectedInstructor, selectedHomeroom, filterType]);

  const loadFilters = async () => {
    try {
      setLoading(true);
      const [instructorsData, homeroomsData] = await Promise.all([
        sobaService.getInstructors(),
        sobaService.getHomerooms()
      ]);
      setInstructors(instructorsData);
      setHomerooms(homeroomsData);
    } catch (error) {
      console.error('Error loading filters:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadObservations = async () => {
    try {
      setLoading(true);
      const allObservations = await sobaService.getAllObservations();
      
      let filtered: SOBAObservation[] = [];
      if (filterType === 'instructor' && selectedInstructor) {
        filtered = allObservations.filter(obs => obs.teacherName === selectedInstructor);
      } else if (filterType === 'homeroom' && selectedHomeroom) {
        filtered = allObservations.filter(obs => obs.homeroom === selectedHomeroom);
      }

      // Sort by date (newest first for table, oldest first for trends)
      const sortedObservations = filtered.sort((a, b) => 
        new Date(b.observationTimestamp).getTime() - new Date(a.observationTimestamp).getTime()
      );
      
      setObservations(sortedObservations);

      // Create trend data (oldest to newest for line chart)
      const trendObservations = [...sortedObservations].reverse();
      const trends: ObservationTrend[] = trendObservations.map(obs => ({
        date: new Date(obs.observationTimestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        classEngagement: obs.classEngagementScore,
        planning: obs.teacherScorePlanning,
        instruction: obs.teacherScoreDelivery,
        environment: obs.teacherScoreEnvironment,
        responsibility: obs.teacherScoreFeedback
      }));
      
      setTrendData(trends);
    } catch (error) {
      console.error('Error loading observations:', error);
    } finally {
      setLoading(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 4) return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
    if (score >= 3) return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
    if (score >= 2) return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
    return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Simple line chart component
  const LineChart = ({ data, title, color }: { data: ObservationTrend[], title: string, color: string }) => {
    if (data.length === 0) return null;

    // Only display the 8 most recent data points to avoid overflow
    const displayData = data.slice(-8);

    const maxValue = 5;
    const minValue = 1;
    const height = 120;
    const baseWidth = 400;
    const padding = 40;
    const rightPadding = 50; // extra space to prevent clipping on the right
    const minXStep = 60; // ensure readable spacing between points
    const computedWidth = Math.max(
      baseWidth,
      padding + rightPadding + Math.max(displayData.length - 1, 1) * minXStep
    );

    const xStep = (computedWidth - padding - rightPadding) / Math.max(displayData.length - 1, 1);
    const yScale = (height - padding * 2) / (maxValue - minValue);

    const getYValue = (score: number) => height - padding - ((score - minValue) * yScale);

    const pathData = displayData.map((point, index) => {
      const x = padding + (index * xStep);
      let y: number;
      
      switch (color) {
        case 'blue': y = getYValue(point.classEngagement); break;
        case 'green': y = getYValue(point.planning); break;
        case 'purple': y = getYValue(point.instruction); break;
        case 'orange': y = getYValue(point.environment); break;
        case 'red': y = getYValue(point.responsibility); break;
        default: y = getYValue(point.classEngagement); break;
      }
      
      return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
    }).join(' ');

    const colorClasses = {
      blue: 'stroke-blue-500',
      green: 'stroke-green-500', 
      purple: 'stroke-purple-500',
      orange: 'stroke-orange-500',
      red: 'stroke-red-500'
    };

    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
        <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">{title}</h4>
        <svg
          width="100%"
          height={height}
          viewBox={`0 0 ${computedWidth} ${height}`}
          preserveAspectRatio="xMidYMid meet"
        >
          {/* Grid lines */}
          {[1, 2, 3, 4, 5].map(score => (
            <g key={score}>
              <line
                x1={padding}
                y1={getYValue(score)}
                x2={computedWidth - rightPadding}
                y2={getYValue(score)}
                stroke="#e5e7eb"
                strokeWidth="1"
                strokeDasharray="3,3"
              />
              <text
                x={padding - 10}
                y={getYValue(score) + 4}
                fontSize="12"
                fill="#6b7280"
                textAnchor="end"
              >
                {score}
              </text>
            </g>
          ))}
          
          {/* Data line */}
          <path
            d={pathData}
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className={colorClasses[color as keyof typeof colorClasses]}
          />
          
          {/* Data points */}
          {displayData.map((point, index) => {
            const x = padding + (index * xStep);
            let y: number;
            
            switch (color) {
              case 'blue': y = getYValue(point.classEngagement); break;
              case 'green': y = getYValue(point.planning); break;
              case 'purple': y = getYValue(point.instruction); break;
              case 'orange': y = getYValue(point.environment); break;
              case 'red': y = getYValue(point.responsibility); break;
              default: y = getYValue(point.classEngagement); break;
            }
            
            return (
              <circle
                key={index}
                cx={x}
                cy={y}
                r="4"
                fill="currentColor"
                className={colorClasses[color as keyof typeof colorClasses]}
              />
            );
          })}
          
          {/* X-axis labels */}
          {displayData.map((point, index) => (
            <text
              key={index}
              x={padding + (index * xStep)}
              y={height - 10}
              fontSize="10"
              fill="#6b7280"
              textAnchor="middle"
            >
              {point.date}
            </text>
          ))}
        </svg>
      </div>
    );
  };

  const currentFilter = filterType === 'instructor' ? selectedInstructor : selectedHomeroom;
  // For transposed table: show oldest -> newest left to right
  const observationsChronological = [...observations].reverse();

  return (
    <PageWrapper>
      <PageHeader
        title="SOBA - Student Observation Based Analytics"
        description="Historical observation trends and performance analytics"
        icon={SOBAIcon}
        iconColor="text-blue-600"
      />

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {/* Filters */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">View Analytics For</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Filter Type
              </label>
              <select
                value={filterType}
                onChange={(e) => {
                  setFilterType(e.target.value as 'instructor' | 'homeroom');
                  setSelectedInstructor('');
                  setSelectedHomeroom('');
                }}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-wasabi-green focus:border-wasabi-green bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              >
                <option value="instructor">Instructor</option>
                <option value="homeroom">Homeroom</option>
              </select>
            </div>
            
            {filterType === 'instructor' ? (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Select Instructor
                </label>
                <select
                  value={selectedInstructor}
                  onChange={(e) => setSelectedInstructor(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-wasabi-green focus:border-wasabi-green bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                >
                  <option value="">Select an instructor...</option>
                  {instructors.map(instructor => (
                    <option key={instructor} value={instructor}>{instructor}</option>
                  ))}
                </select>
              </div>
            ) : (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Select Homeroom
                </label>
                <select
                  value={selectedHomeroom}
                  onChange={(e) => setSelectedHomeroom(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-wasabi-green focus:border-wasabi-green bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                >
                  <option value="">Select a homeroom...</option>
                  {homerooms.map(homeroom => (
                    <option key={homeroom} value={homeroom}>{homeroom}</option>
                  ))}
                </select>
              </div>
            )}
            
            <div className="flex items-end">
              <div className="text-sm text-gray-600 dark:text-gray-400">
                {observations.length > 0 && (
                  <span className="bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-3 py-2 rounded-lg font-medium">
                    {observations.length} observation{observations.length !== 1 ? 's' : ''} found
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-wasabi-green"></div>
          </div>
        ) : observations.length > 0 ? (
          <>
            {/* Trend Charts */}
            {trendData.length > 1 && (
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <div className="flex items-center mb-6">
                  <TrendingUp className="w-5 h-5 text-blue-600 mr-2" />
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Performance Trends</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  <LineChart data={trendData} title="Class Engagement" color="blue" />
                  <LineChart data={trendData} title="Planning/Preparation" color="green" />
                  <LineChart data={trendData} title="Instruction" color="purple" />
                  <LineChart data={trendData} title="Classroom Environment" color="orange" />
                  <LineChart data={trendData} title="Professional Responsibility" color="red" />
                </div>
              </div>
            )}

            {/* Observations Table (transposed: dates as columns, metrics as rows) */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  Historical Observations - {currentFilter}
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Columns are observation dates; rows are metric scores.</p>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Metric
                      </th>
                      {observationsChronological.map((observation) => (
                        <th
                          key={observation.observationId}
                          className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider whitespace-nowrap"
                          title={formatDate(observation.observationTimestamp)}
                        >
                          {new Date(observation.observationTimestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {/* Class Engagement row */}
                    <tr>
                      <td className="px-6 py-3 text-sm font-medium text-gray-900 dark:text-gray-100 whitespace-nowrap">
                        Class Engagement
                      </td>
                      {observationsChronological.map((observation) => (
                        <td
                          key={`${observation.observationId}-eng`}
                          className={`px-4 py-3 text-center whitespace-nowrap font-medium ${getScoreColor(observation.classEngagementScore)}`}
                          title={formatDate(observation.observationTimestamp)}
                        >
                          {observation.classEngagementScore}/5
                        </td>
                      ))}
                    </tr>
                    {/* Planning row */}
                    <tr>
                      <td className="px-6 py-3 text-sm font-medium text-gray-900 dark:text-gray-100 whitespace-nowrap">
                        Planning
                      </td>
                      {observationsChronological.map((observation) => (
                        <td
                          key={`${observation.observationId}-plan`}
                          className={`px-4 py-3 text-center whitespace-nowrap font-medium ${getScoreColor(observation.teacherScorePlanning)}`}
                          title={formatDate(observation.observationTimestamp)}
                        >
                          {observation.teacherScorePlanning}/5
                        </td>
                      ))}
                    </tr>
                    {/* Instruction row */}
                    <tr>
                      <td className="px-6 py-3 text-sm font-medium text-gray-900 dark:text-gray-100 whitespace-nowrap">
                        Instruction
                      </td>
                      {observationsChronological.map((observation) => (
                        <td
                          key={`${observation.observationId}-instr`}
                          className={`px-4 py-3 text-center whitespace-nowrap font-medium ${getScoreColor(observation.teacherScoreDelivery)}`}
                          title={formatDate(observation.observationTimestamp)}
                        >
                          {observation.teacherScoreDelivery}/5
                        </td>
                      ))}
                    </tr>
                    {/* Environment row */}
                    <tr>
                      <td className="px-6 py-3 text-sm font-medium text-gray-900 dark:text-gray-100 whitespace-nowrap">
                        Environment
                      </td>
                      {observationsChronological.map((observation) => (
                        <td
                          key={`${observation.observationId}-env`}
                          className={`px-4 py-3 text-center whitespace-nowrap font-medium ${getScoreColor(observation.teacherScoreEnvironment)}`}
                          title={formatDate(observation.observationTimestamp)}
                        >
                          {observation.teacherScoreEnvironment}/5
                        </td>
                      ))}
                    </tr>
                    {/* Responsibility row */}
                    <tr>
                      <td className="px-6 py-3 text-sm font-medium text-gray-900 dark:text-gray-100 whitespace-nowrap">
                        Responsibility
                      </td>
                      {observationsChronological.map((observation) => (
                        <td
                          key={`${observation.observationId}-resp`}
                          className={`px-4 py-3 text-center whitespace-nowrap font-medium ${getScoreColor(observation.teacherScoreFeedback)}`}
                          title={formatDate(observation.observationTimestamp)}
                        >
                          {observation.teacherScoreFeedback}/5
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </>
        ) : currentFilter ? (
          <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
            <Calendar size={48} className="mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">No observations found</h3>
            <p className="text-gray-600 dark:text-gray-400">
              No observations found for {currentFilter}. Create some observations to see analytics here.
            </p>
          </div>
        ) : (
          <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
            <Users size={48} className="mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">Select a filter</h3>
            <p className="text-gray-600 dark:text-gray-400">
              Choose an instructor or homeroom to view historical observation analytics.
            </p>
          </div>
        )}
      </div>
    </PageWrapper>
  );
}
