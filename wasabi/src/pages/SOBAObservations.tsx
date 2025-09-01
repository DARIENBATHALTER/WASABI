import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Calendar, Users, FileText, Eye, TrendingUp } from 'lucide-react';
import { sobaService, type SOBAObservation } from '../services/sobaService';
import PageHeader from '../shared/components/PageHeader';
import PageWrapper from '../shared/components/PageWrapper';
import SOBAIcon from '../shared/components/SOBAIcon';

export default function SOBAObservations() {
  const [observations, setObservations] = useState<SOBAObservation[]>([]);
  const [homerooms, setHomerooms] = useState<string[]>([]);
  const [selectedHomeroom, setSelectedHomeroom] = useState<string>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [observationsData, homeroomsData] = await Promise.all([
        sobaService.getAllObservations(),
        sobaService.getHomerooms()
      ]);
      setObservations(observationsData);
      setHomerooms(homeroomsData);
    } catch (error) {
      console.error('Error loading SOBA data:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredObservations = selectedHomeroom === 'all'
    ? observations.slice(0, 25) // Show only 25 most recent
    : observations.filter(obs => obs.homeroom === selectedHomeroom).slice(0, 25);

  const formatDate = (date: Date | string) => {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(dateObj.getTime())) {
      return 'Invalid Date';
    }
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    }).format(dateObj);
  };

  const getEngagementColor = (score: number) => {
    if (score >= 4) return 'text-green-600 bg-green-100';
    if (score >= 3) return 'text-yellow-600 bg-yellow-100';
    return 'text-red-600 bg-red-100';
  };

  if (loading) {
    return (
      <PageWrapper>
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-64 mb-6"></div>
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-32 bg-gray-100 dark:bg-gray-800 rounded-lg"></div>
            ))}
          </div>
        </div>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper>
      <PageHeader
        title="Observation"
        description="Classroom Observation and Engagement Tracking for Professional Development"
        icon={Eye}
        iconColor="text-blue-600"
      >
        <Link
          to="/soba/new"
          className="inline-flex items-center px-4 py-2 bg-wasabi-green text-white rounded-lg hover:bg-green-600 transition-colors"
        >
          <Plus size={20} className="mr-2" />
          New Observation
        </Link>
      </PageHeader>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Past Observations */}
        <div className="mb-6">
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 flex items-center">
            <Eye size={24} className="mr-2" />
            Past Observations
            {filteredObservations.length > 0 && (
              <span className="text-sm font-normal text-gray-600 dark:text-gray-400 ml-2">
                ({filteredObservations.length} of {selectedHomeroom === 'all' ? observations.length : observations.filter(obs => obs.homeroom === selectedHomeroom).length})
              </span>
            )}
          </h2>
        </div>

        {/* Filters */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Filter by Homeroom:</label>
              <select
                value={selectedHomeroom}
                onChange={(e) => setSelectedHomeroom(e.target.value)}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-wasabi-green focus:border-wasabi-green bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              >
                <option value="all">All Homerooms</option>
                {homerooms.map(homeroom => (
                  <option key={homeroom} value={homeroom}>{homeroom}</option>
                ))}
              </select>
            </div>
            <Link
              to="/soba/analytics"
              className="inline-flex items-center px-4 py-2 border-2 border-blue-200 bg-blue-50 text-blue-700 hover:border-blue-300 hover:bg-blue-100 dark:border-blue-600 dark:bg-blue-900/20 dark:text-blue-300 dark:hover:border-blue-500 dark:hover:bg-blue-900/30 rounded-lg transition-all duration-200 font-medium shadow-sm hover:shadow-md"
            >
              <TrendingUp size={16} className="mr-2" />
              View Analytics
            </Link>
          </div>
        </div>

        {/* Observations Grid */}
        {filteredObservations.length === 0 ? (
          <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
            <Eye size={48} className="mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">No observations found</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              {selectedHomeroom === 'all' 
                ? 'Get started by creating your first classroom observation.'
                : `No observations found for ${selectedHomeroom}.`
              }
            </p>
            <Link
              to="/soba/new"
              className="inline-flex items-center px-4 py-2 bg-wasabi-green text-white rounded-xl hover:bg-green-600 transition-colors"
            >
              <Plus size={20} className="mr-2" />
              Create First Observation
            </Link>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filteredObservations.map((observation) => (
              <div key={observation.observationId} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow">
                <div className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-2">
                      <Users size={20} className="text-gray-500 dark:text-gray-400" />
                      <span className="font-medium text-gray-900 dark:text-gray-100">{observation.homeroom}</span>
                    </div>
                    <div className={`px-2 py-1 rounded-full text-xs font-medium ${getEngagementColor(observation.classEngagementScore)}`}>
                      {observation.classEngagementScore}/5
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400">
                      <Calendar size={16} />
                      <span>{formatDate(observation.observationTimestamp)}</span>
                    </div>
                    
                    <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400">
                      <FileText size={16} />
                      <span>Teacher: {observation.teacherName}</span>
                    </div>

                    {observation.classEngagementNotes && (
                      <p className="text-sm text-gray-700 dark:text-gray-300 line-clamp-3">
                        {observation.classEngagementNotes}
                      </p>
                    )}

                    <div className="grid grid-cols-2 gap-2 pt-3 border-t border-gray-200 dark:border-gray-600">
                      <div className="text-center">
                        <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                          {observation.teacherScorePlanning}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">Planning</div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                          {observation.teacherScoreDelivery}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">Delivery</div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-600">
                    <Link
                      to={`/soba/${observation.observationId}`}
                      className="block w-full text-center px-4 py-2 bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors text-sm font-medium"
                    >
                      View Details
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </PageWrapper>
  );
}