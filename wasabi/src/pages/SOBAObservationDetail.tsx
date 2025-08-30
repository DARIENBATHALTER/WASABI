import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Calendar, Users, FileText, Edit, Lightbulb } from 'lucide-react';
import { sobaService, type SOBAObservation, type SOBAStudentNote } from '../services/sobaService';
import PageWrapper from '../shared/components/PageWrapper';
import PageHeader from '../shared/components/PageHeader';
import SOBAIcon from '../shared/components/SOBAIcon';

interface ScoreDisplayProps {
  label: string;
  score: number;
  description?: string;
}

function ScoreDisplay({ label, score, description }: ScoreDisplayProps) {
  const getScoreColor = (score: number) => {
    if (score >= 4) return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
    if (score >= 3) return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
    if (score >= 2) return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
    return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="font-medium text-gray-900 dark:text-gray-100">{label}</h4>
        <span className={`px-3 py-1 rounded-full text-sm font-medium ${getScoreColor(score)}`}>
          {score}/5
        </span>
      </div>
      {description && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg p-3">
          <div className="flex items-start">
            <Lightbulb className="w-4 h-4 text-yellow-600 dark:text-yellow-400 mt-0.5 mr-2 flex-shrink-0" />
            <p className="text-xs text-yellow-800 dark:text-yellow-200">
              {description}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default function SOBAObservationDetail() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [observation, setObservation] = useState<SOBAObservation | null>(null);
  const [studentNotes, setStudentNotes] = useState<SOBAStudentNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (id) {
      loadObservation(id);
    }
  }, [id]);

  const loadObservation = async (observationId: string) => {
    try {
      setLoading(true);
      setError(null);
      
      const observationData = await sobaService.getObservation(observationId);
      if (!observationData) {
        setError('Observation not found');
        return;
      }
      
      setObservation(observationData);
      
      // Load associated student notes
      const notes = await sobaService.getStudentNotesByObservation(observationId);
      setStudentNotes(notes);
    } catch (error) {
      console.error('Error loading observation:', error);
      setError('Failed to load observation');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(date));
  };

  const getEngagementColor = (score: number) => {
    if (score >= 4) return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
    if (score >= 3) return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
    if (score >= 2) return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
    return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
  };

  if (loading) {
    return (
      <PageWrapper>
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-wasabi-green"></div>
        </div>
      </PageWrapper>
    );
  }

  if (error || !observation) {
    return (
      <PageWrapper>
        <PageHeader
          title="Observation Not Found"
          description="The requested observation could not be found"
          icon={SOBAIcon}
          iconColor="text-blue-600"
        >
          <button
            onClick={() => navigate('/soba')}
            className="inline-flex items-center px-3 py-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <ArrowLeft size={16} className="mr-1" />
            Back to Observations
          </button>
        </PageHeader>
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="text-center py-12">
            <p className="text-gray-600 dark:text-gray-400">{error}</p>
          </div>
        </div>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper>
      <PageHeader
        title={`${observation.homeroom} Observation`}
        description={`${observation.teacherName} • ${formatDate(observation.observationTimestamp)}`}
        icon={SOBAIcon}
        iconColor="text-blue-600"
      >
        <button
          onClick={() => navigate('/soba')}
          className="inline-flex items-center px-3 py-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
        >
          <ArrowLeft size={16} className="mr-1" />
          Back to Observations
        </button>
        <button
          onClick={() => navigate(`/soba/${observation.observationId}/edit`)}
          className="inline-flex items-center px-4 py-2 bg-wasabi-green text-white rounded-lg hover:bg-green-600 transition-colors"
        >
          <Edit size={16} className="mr-2" />
          Edit Observation
        </button>
      </PageHeader>

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {/* Observation Overview */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-6">Observation Overview</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="flex items-center space-x-3">
              <Users className="w-5 h-5 text-gray-500 dark:text-gray-400" />
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Homeroom</p>
                <p className="font-medium text-gray-900 dark:text-gray-100">{observation.homeroom}</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <FileText className="w-5 h-5 text-gray-500 dark:text-gray-400" />
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Teacher</p>
                <p className="font-medium text-gray-900 dark:text-gray-100">{observation.teacherName}</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <Calendar className="w-5 h-5 text-gray-500 dark:text-gray-400" />
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Date & Time</p>
                <p className="font-medium text-gray-900 dark:text-gray-100">{formatDate(observation.observationTimestamp)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Class Engagement */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-6">Class Engagement</h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-medium text-gray-900 dark:text-gray-100">Overall Engagement Score</h3>
              <span className={`px-4 py-2 rounded-full text-lg font-semibold ${getEngagementColor(observation.classEngagementScore)}`}>
                {observation.classEngagementScore}/5
              </span>
            </div>
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg p-3">
              <div className="flex items-start">
                <Lightbulb className="w-4 h-4 text-yellow-600 dark:text-yellow-400 mt-0.5 mr-2 flex-shrink-0" />
                <p className="text-xs text-yellow-800 dark:text-yellow-200">
                  Are students showing engagement with the chosen method of instruction, asking questions, and/or engaging in answering? Is there active participation and focus on the lesson content?
                </p>
              </div>
            </div>
            {observation.classEngagementNotes && (
              <div>
                <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2">Class Engagement Notes</h4>
                <p className="text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
                  {observation.classEngagementNotes}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Teacher Performance */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-6">Teacher Performance</h2>
          <div className="grid grid-cols-1 gap-8">
            <ScoreDisplay 
              label="Planning/Preparation"
              score={observation.teacherScorePlanning}
              description="Does the teacher demonstrate a well-thorough understanding of the content they are presenting? Are all elements of instructional design (lesson plans) appropriate for both content, and for students, such that it is accessible and engaging?"
            />
            <ScoreDisplay 
              label="Instruction"
              score={observation.teacherScoreDelivery}
              description="Is the teacher communicating the content effectively with students? Are students showing engagement with the chosen method of instruction, ie, asking questions and/or engaging in answering?"
            />
            <ScoreDisplay 
              label="Classroom Environment"
              score={observation.teacherScoreEnvironment}
              description="Is the classroom a clean, organized, comfortable, and respectful place to learn? Is there a business-like atmosphere? Are non-educational routines being handled efficiently? Are students following behavioral expectations?"
            />
            <ScoreDisplay 
              label="Professional Responsibility"
              score={observation.teacherScoreFeedback}
              description="Is the teacher incorporating feedback that was previously given into their instruction delivery? Are there signs of cooperation between grade-level teachers? Is the teacher communicating effectively with administration when encountering difficulties with either planning or instruction?"
            />
          </div>
        </div>

        {/* Teacher Feedback */}
        {observation.teacherFeedbackNotes && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">Teacher Feedback</h2>
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-4">
              <p className="text-gray-700 dark:text-gray-300">{observation.teacherFeedbackNotes}</p>
            </div>
          </div>
        )}

        {/* Student Notes */}
        {studentNotes.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-6">Student Notes ({studentNotes.length})</h2>
            <div className="space-y-4">
              {studentNotes.map((note, index) => (
                <div key={note.noteId || index} className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <span className="font-medium text-gray-900 dark:text-gray-100">{note.studentName}</span>
                      <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 text-xs rounded-full capitalize">
                        {note.category}
                      </span>
                    </div>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {formatDate(note.noteTimestamp)}
                    </span>
                  </div>
                  <p className="text-gray-700 dark:text-gray-300">{note.noteText}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </PageWrapper>
  );
}