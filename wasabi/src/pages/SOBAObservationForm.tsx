import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save, Plus, X, Lightbulb, Trash2 } from 'lucide-react';
import { sobaService, type SOBAObservation, type SOBAStudentNote } from '../services/sobaService';
import { db } from '../lib/db';
import PageWrapper from '../shared/components/PageWrapper';
import PageHeader from '../shared/components/PageHeader';
import SOBAIcon from '../shared/components/SOBAIcon';

interface ScoreButtonGroupProps {
  value: number | null;
  onChange: (value: number) => void;
  label?: string;
  description?: string;
}

function ScoreButtonGroup({ value, onChange, label, description }: ScoreButtonGroupProps) {
  return (
    <div className="space-y-2">
      {label && <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{label}</label>}
      {description && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg p-3 mb-4">
          <div className="flex items-start">
            <Lightbulb className="w-5 h-5 text-yellow-600 dark:text-yellow-400 mt-0.5 mr-3 flex-shrink-0" />
            <p className="text-sm text-yellow-800 dark:text-yellow-200">
              {description}
            </p>
          </div>
        </div>
      )}
      <div className="flex space-x-2">
        {[1, 2, 3, 4, 5].map((score) => (
          <button
            key={score}
            type="button"
            onClick={() => onChange(score)}
            className={`w-10 h-10 rounded-full font-medium text-sm transition-colors ${
              value === score
                ? 'bg-wasabi-green text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            {score}
          </button>
        ))}
      </div>
    </div>
  );
}

interface StudentNoteFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (note: Omit<SOBAStudentNote, 'noteId' | 'noteTimestamp'>) => void;
  homeroom: string;
}

function StudentNoteForm({ isOpen, onClose, onSave, homeroom }: StudentNoteFormProps) {
  const [students, setStudents] = useState<any[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [noteText, setNoteText] = useState('');
  const [category, setCategory] = useState<SOBAStudentNote['category']>('engagement');

  useEffect(() => {
    if (isOpen) {
      loadStudents();
    }
  }, [isOpen, homeroom]);

  const loadStudents = async () => {
    try {
      const allStudents = await db.students.toArray();
      const homeroomStudents = allStudents.filter(s => s.className === homeroom);
      setStudents(homeroomStudents);
    } catch (error) {
      console.error('Error loading students:', error);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudentId || !noteText.trim()) return;

    const student = students.find(s => s.id === selectedStudentId);
    if (!student) return;

    onSave({
      studentId: selectedStudentId,
      studentName: `${student.firstName} ${student.lastName}`,
      homeroom,
      noteText: noteText.trim(),
      category,
      createdBy: 'admin' // TODO: Use actual user
    });

    // Reset form
    setSelectedStudentId('');
    setNoteText('');
    setCategory('engagement');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Add Student Note</h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <X size={20} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Student
              </label>
              <select
                value={selectedStudentId}
                onChange={(e) => setSelectedStudentId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-wasabi-green focus:border-wasabi-green"
                required
              >
                <option value="">Select a student...</option>
                {students.map(student => (
                  <option key={student.id} value={student.id}>
                    {student.firstName} {student.lastName}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as SOBAStudentNote['category'])}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-wasabi-green focus:border-wasabi-green"
              >
                <option value="engagement">Engagement</option>
                <option value="behavior">Behavior</option>
                <option value="academic">Academic</option>
                <option value="strategy">Strategy</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Note
              </label>
              <textarea
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-wasabi-green focus:border-wasabi-green"
                placeholder="Enter observation notes for this student..."
                required
              />
            </div>

            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-wasabi-green text-white rounded-md hover:bg-green-600 transition-colors"
              >
                Add Note
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default function SOBAObservationForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);
  
  const [homerooms, setHomerooms] = useState<string[]>([]);
  const [instructors, setInstructors] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [studentNoteFormOpen, setStudentNoteFormOpen] = useState(false);

  // Helper function to get current local time in datetime-local format
  const getCurrentLocalDateTime = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  const [formData, setFormData] = useState({
    instructor: '',
    homeroom: '',
    observationDate: getCurrentLocalDateTime(), // Auto-populated with current local date/time
    teacherName: '',
    classEngagementScore: null as number | null,
    classEngagementNotes: '',
    teacherFeedbackNotes: '',
    teacherScorePlanning: null as number | null,
    teacherScoreDelivery: null as number | null,
    teacherScoreEnvironment: null as number | null,
    teacherScoreFeedback: null as number | null,
  });

  const [studentNotes, setStudentNotes] = useState<Omit<SOBAStudentNote, 'noteId' | 'noteTimestamp'>[]>([]);

  useEffect(() => {
    loadHomerooms();
    loadInstructors();
    if (isEdit && id) {
      loadObservation(id);
    }
  }, [id, isEdit]);

  const loadHomerooms = async () => {
    try {
      const homeroomsData = await sobaService.getHomerooms();
      setHomerooms(homeroomsData);
    } catch (error) {
      console.error('Error loading homerooms:', error);
    }
  };

  const loadInstructors = async () => {
    try {
      const instructorsData = await sobaService.getInstructors();
      console.log('Loaded instructors:', instructorsData);
      setInstructors(instructorsData);
    } catch (error) {
      console.error('Error loading instructors:', error);
    }
  };

  const loadObservation = async (observationId: string) => {
    try {
      setLoading(true);
      const observation = await sobaService.getObservation(observationId);
      if (observation) {
        setFormData({
          instructor: observation.teacherName,
          homeroom: observation.homeroom,
          observationDate: new Date(observation.observationTimestamp).toISOString().slice(0, 16),
          teacherName: observation.teacherName,
          classEngagementScore: observation.classEngagementScore,
          classEngagementNotes: observation.classEngagementNotes,
          teacherFeedbackNotes: observation.teacherFeedbackNotes,
          teacherScorePlanning: observation.teacherScorePlanning,
          teacherScoreDelivery: observation.teacherScoreDelivery,
          teacherScoreEnvironment: observation.teacherScoreEnvironment,
          teacherScoreFeedback: observation.teacherScoreFeedback,
        });
        
        // Load associated student notes
        const notes = await sobaService.getStudentNotesByObservation(observationId);
        const notesForForm = notes.map(note => ({
          studentId: note.studentId,
          studentName: note.studentName,
          homeroom: note.homeroom,
          noteText: note.noteText,
          category: note.category || 'engagement' as const,
          createdBy: note.createdBy
        }));
        setStudentNotes(notesForForm);
      }
    } catch (error) {
      console.error('Error loading observation:', error);
    } finally {
      setLoading(false);
    }
  };

  // Check if basic info section is complete
  const isBasicInfoComplete = () => {
    return (
      formData.instructor &&
      formData.homeroom &&
      formData.observationDate
    );
  };

  const isFormValid = () => {
    return (
      isBasicInfoComplete() &&
      formData.classEngagementScore !== null &&
      formData.teacherScorePlanning !== null &&
      formData.teacherScoreDelivery !== null &&
      formData.teacherScoreEnvironment !== null &&
      formData.teacherScoreFeedback !== null
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid()) return;

    try {
      setLoading(true);

      const observationData = {
        homeroom: formData.homeroom,
        teacherName: formData.instructor, // Use instructor field instead of teacherName
        observationTimestamp: new Date(formData.observationDate),
        classEngagementScore: formData.classEngagementScore!,
        classEngagementNotes: formData.classEngagementNotes,
        teacherFeedbackNotes: formData.teacherFeedbackNotes,
        teacherScorePlanning: formData.teacherScorePlanning!,
        teacherScoreDelivery: formData.teacherScoreDelivery!,
        teacherScoreEnvironment: formData.teacherScoreEnvironment!,
        teacherScoreFeedback: formData.teacherScoreFeedback!,
        createdBy: 'admin' // TODO: Use actual user
      };

      let observation: SOBAObservation;
      let targetObservationId: string;

      if (isEdit && id) {
        // Update existing observation
        const updatedObservation = await sobaService.updateObservation(id, observationData);
        if (!updatedObservation) {
          throw new Error('Failed to update observation');
        }
        observation = updatedObservation;
        targetObservationId = id;

        // Delete existing student notes before adding new ones
        await sobaService.deleteStudentNotesByObservation(id);
      } else {
        // Create new observation
        observation = await sobaService.createObservation(observationData);
        targetObservationId = observation.observationId;
      }

      // Save student notes
      if (studentNotes.length > 0) {
        for (const note of studentNotes) {
          await sobaService.createStudentNote({
            ...note,
            observationId: targetObservationId,
            noteTimestamp: new Date()
          });
        }
      }

      navigate('/soba');
    } catch (error) {
      console.error('Error saving observation:', error);
      alert('Failed to save observation. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!id) return;
    
    const confirmDelete = window.confirm('Are you sure you want to delete this observation? This action cannot be undone.');
    if (!confirmDelete) return;
    
    try {
      setLoading(true);
      await sobaService.deleteObservation(id);
      navigate('/soba');
    } catch (error) {
      console.error('Error deleting observation:', error);
      alert('Failed to delete observation. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleAddStudentNote = (note: Omit<SOBAStudentNote, 'noteId' | 'noteTimestamp'>) => {
    setStudentNotes(prev => [...prev, note]);
  };

  const removeStudentNote = (index: number) => {
    setStudentNotes(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <PageWrapper>
      <PageHeader
        title={isEdit ? 'Edit Observation' : 'New Observation'}
        description={formData.homeroom || 'Select a homeroom to begin'}
        icon={SOBAIcon}
        iconColor="text-blue-600"
      >
        <button
          onClick={() => navigate('/soba')}
          className="inline-flex items-center px-3 py-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
        >
          <ArrowLeft size={16} className="mr-1" />
          Back
        </button>
        <div className="flex items-center space-x-3">
          {isEdit && (
            <button
              onClick={handleDelete}
              disabled={loading}
              className="inline-flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Trash2 size={20} className="mr-2" />
              {loading ? 'Deleting...' : 'Delete'}
            </button>
          )}
          <button
            onClick={handleSubmit}
            disabled={!isFormValid() || loading}
            className="inline-flex items-center px-4 py-2 bg-wasabi-green text-white rounded-lg hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Save size={20} className="mr-2" />
            {loading ? 'Saving...' : 'Save Observation'}
          </button>
        </div>
      </PageHeader>

      <div className="max-w-7xl mx-auto px-6 py-8">
        <form onSubmit={handleSubmit} className="space-y-8">
        {/* Observation Setup */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-6">Observation Setup</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Instructor *
              </label>
              <select
                value={formData.instructor}
                onChange={(e) => setFormData(prev => ({ ...prev, instructor: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-wasabi-green focus:border-wasabi-green bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                required
              >
                <option value="">Select instructor...</option>
                {instructors.map(instructor => (
                  <option key={instructor} value={instructor}>{instructor}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Student Homeroom *
              </label>
              <select
                value={formData.homeroom}
                onChange={(e) => setFormData(prev => ({ ...prev, homeroom: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-wasabi-green focus:border-wasabi-green bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                required
              >
                <option value="">Select homeroom...</option>
                {homerooms.map(homeroom => (
                  <option key={homeroom} value={homeroom}>{homeroom}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Observation Date & Time *
              </label>
              <input
                type="datetime-local"
                value={formData.observationDate}
                onChange={(e) => setFormData(prev => ({ ...prev, observationDate: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-wasabi-green focus:border-wasabi-green bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                required
              />
            </div>
          </div>
        </div>

        {/* Class Engagement */}
        <div className={`bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 transition-opacity ${!isBasicInfoComplete() ? 'opacity-50 pointer-events-none' : ''}`}>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-6">
            Class Engagement
            {!isBasicInfoComplete() && <span className="text-sm text-gray-400 ml-2">(Complete observation setup first)</span>}
          </h2>
          <div className="space-y-6">
            <div className={!isBasicInfoComplete() ? 'pointer-events-none' : ''}>
              <ScoreButtonGroup
                label="Overall Engagement Score (1-5) *"
                description="Are students showing engagement with the chosen method of instruction, asking questions, and/or engaging in answering? Is there active participation and focus on the lesson content?"
                value={formData.classEngagementScore}
                onChange={(value) => setFormData(prev => ({ ...prev, classEngagementScore: value }))}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Class Engagement Notes
              </label>
              <textarea
                value={formData.classEngagementNotes}
                onChange={(e) => setFormData(prev => ({ ...prev, classEngagementNotes: e.target.value }))}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-wasabi-green focus:border-wasabi-green bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
                placeholder="General notes about class engagement..."
                disabled={!isBasicInfoComplete()}
              />
            </div>
          </div>
        </div>

          {/* Student Notes */}
          <div className={`bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 transition-opacity ${!isBasicInfoComplete() ? 'opacity-50 pointer-events-none' : ''}`}>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                Student Notes
                {!isBasicInfoComplete() && <span className="text-sm text-gray-400 ml-2">(Complete observation setup first)</span>}
              </h2>
              <button
                type="button"
                onClick={() => setStudentNoteFormOpen(true)}
                disabled={!isBasicInfoComplete()}
                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Plus size={20} className="mr-2" />
                Add Student Note
              </button>
            </div>

            {studentNotes.length === 0 ? (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400 border-2 border-dashed border-gray-200 dark:border-gray-600 rounded-xl">
                No student notes added yet. Click "Add Student Note" to begin.
              </div>
            ) : (
              <div className="space-y-4">
                {studentNotes.map((note, index) => (
                  <div key={index} className="flex justify-between items-start p-4 bg-gray-50 dark:bg-gray-700 rounded-xl">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        <span className="font-medium text-gray-900 dark:text-gray-100">{note.studentName}</span>
                        <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 text-xs rounded-full capitalize">
                          {note.category}
                        </span>
                      </div>
                      <p className="text-gray-700 dark:text-gray-300">{note.noteText}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeStudentNote(index)}
                      className="ml-4 text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                      disabled={!isBasicInfoComplete()}
                    >
                      <X size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Teacher Feedback */}
          <div className={`bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 transition-opacity ${!isBasicInfoComplete() ? 'opacity-50 pointer-events-none' : ''}`}>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-6">
              Teacher Feedback
              {!isBasicInfoComplete() && <span className="text-sm text-gray-400 ml-2">(Complete observation setup first)</span>}
            </h2>
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Suggestions / Comments
                </label>
                <textarea
                  value={formData.teacherFeedbackNotes}
                  onChange={(e) => setFormData(prev => ({ ...prev, teacherFeedbackNotes: e.target.value }))}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-wasabi-green focus:border-wasabi-green bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
                  placeholder="Feedback and suggestions for the teacher..."
                  disabled={!isBasicInfoComplete()}
                />
              </div>

              <div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">Domain Scores (1-5) *</h3>
                <div className="grid grid-cols-1 gap-8">
                  <div className={!isBasicInfoComplete() ? 'pointer-events-none' : ''}>
                    <ScoreButtonGroup
                      label="Planning/Preparation"
                      description="Does the teacher demonstrate a well-thorough understanding of the content they are presenting? Are all elements of instructional design (lesson plans) appropriate for both content, and for students, such that it is accessible and engaging?"
                      value={formData.teacherScorePlanning}
                      onChange={(value) => setFormData(prev => ({ ...prev, teacherScorePlanning: value }))}
                    />
                  </div>
                  <div className={!isBasicInfoComplete() ? 'pointer-events-none' : ''}>
                    <ScoreButtonGroup
                      label="Instruction"
                      description="Is the teacher communicating the content effectively with students? Are students showing engagement with the chosen method of instruction, ie, asking questions and/or engaging in answering?"
                      value={formData.teacherScoreDelivery}
                      onChange={(value) => setFormData(prev => ({ ...prev, teacherScoreDelivery: value }))}
                    />
                  </div>
                  <div className={!isBasicInfoComplete() ? 'pointer-events-none' : ''}>
                    <ScoreButtonGroup
                      label="Classroom Environment"
                      description="Is the classroom a clean, organized, comfortable, and respectful place to learn? Is there a business-like atmosphere? Are non-educational routines being handled efficiently? Are students following behavioral expectations?"
                      value={formData.teacherScoreEnvironment}
                      onChange={(value) => setFormData(prev => ({ ...prev, teacherScoreEnvironment: value }))}
                    />
                  </div>
                  <div className={!isBasicInfoComplete() ? 'pointer-events-none' : ''}>
                    <ScoreButtonGroup
                      label="Professional Responsibility"
                      description="Is the teacher incorporating feedback that was previously given into their instruction delivery? Are there signs of cooperation between grade-level teachers? Is the teacher communicating effectively with administration when encountering difficulties with either planning or instruction?"
                      value={formData.teacherScoreFeedback}
                      onChange={(value) => setFormData(prev => ({ ...prev, teacherScoreFeedback: value }))}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

        {/* Save Button */}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={!isFormValid() || loading}
            className="px-8 py-3 bg-wasabi-green text-white rounded-lg hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
          >
            {loading ? 'Saving...' : 'Save Observation'}
          </button>
        </div>
        </form>
      </div>

      {/* Student Note Form Modal */}
      <StudentNoteForm
        isOpen={studentNoteFormOpen}
        onClose={() => setStudentNoteFormOpen(false)}
        onSave={handleAddStudentNote}
        homeroom={formData.homeroom}
      />
    </PageWrapper>
  );
}