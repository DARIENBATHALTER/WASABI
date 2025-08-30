import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Calendar, MessageSquare, Plus, Eye, X } from 'lucide-react';
import { sobaService, type SOBAStudentNote } from '../../services/sobaService';

interface SOBADataViewProps {
  studentId: string;
}

interface StudentNoteFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (note: { noteText: string; category: SOBAStudentNote['category'] }) => void;
  studentName: string;
}

function StudentNoteForm({ isOpen, onClose, onSave, studentName }: StudentNoteFormProps) {
  const [noteText, setNoteText] = useState('');
  const [category, setCategory] = useState<SOBAStudentNote['category']>('engagement');

  // Debug modal visibility
  console.log('🔍 SOBA DEBUG: StudentNoteForm render, isOpen:', isOpen, 'studentName:', studentName);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('🔍 SOBA DEBUG: Form submitted with noteText:', noteText, 'category:', category);
    if (!noteText.trim()) return;

    onSave({
      noteText: noteText.trim(),
      category
    });

    setNoteText('');
    setCategory('engagement');
    onClose();
  };

  if (!isOpen) {
    console.log('🔍 SOBA DEBUG: Modal not open, returning null');
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full">
        <div className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Add Note for {studentName}
            </h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
            >
              <X size={20} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as SOBAStudentNote['category'])}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-wasabi-green focus:border-wasabi-green bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              >
                <option value="engagement">Engagement</option>
                <option value="behavior">Behavior</option>
                <option value="academic">Academic</option>
                <option value="strategy">Strategy</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Note
              </label>
              <textarea
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-wasabi-green focus:border-wasabi-green bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400"
                placeholder="Enter observation notes..."
                required
              />
            </div>

            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-600 rounded-md hover:bg-gray-200 dark:hover:bg-gray-500 transition-colors"
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

export default function SOBADataView({ studentId }: SOBADataViewProps) {
  const [noteFormOpen, setNoteFormOpen] = useState(false);
  
  // Debug note form state changes
  console.log('🔍 SOBA DEBUG: Component render, noteFormOpen:', noteFormOpen, 'studentId:', studentId);

  // Get student notes for this student
  const { data: studentNotes, refetch } = useQuery({
    queryKey: ['soba-student-notes', studentId],
    queryFn: async () => {
      console.log(`🔍 SOBA DEBUG: Querying notes for studentId: ${studentId}`);
      const notes = await sobaService.getNotesByStudentId(studentId);
      console.log(`📝 SOBA DEBUG: Found ${notes.length} notes for student ${studentId}:`, notes);
      return notes;
    }
  });

  // Get student info for the form
  const { data: student } = useQuery({
    queryKey: ['student', studentId],
    queryFn: async () => {
      const db = (await import('../../lib/db')).db;
      console.log('🔍 SOBA DEBUG: Fetching student with ID:', studentId, 'as number:', Number(studentId));
      
      // Try to get student by different ID formats
      let studentRecord = await db.students.get(studentId); // Try as string first
      
      if (!studentRecord) {
        studentRecord = await db.students.get(Number(studentId)); // Try as number
      }
      
      if (!studentRecord) {
        // Try to find by studentNumber
        const allStudents = await db.students.toArray();
        studentRecord = allStudents.find(s => 
          s.id === studentId || 
          s.id === Number(studentId) ||
          s.studentNumber === studentId ||
          s.studentNumber === String(studentId)
        );
      }
      
      console.log('🔍 SOBA DEBUG: Found student:', studentRecord);
      return studentRecord || null; // Return null instead of undefined
    }
  });

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    }).format(date);
  };

  const getCategoryColor = (category: SOBAStudentNote['category']) => {
    switch (category) {
      case 'engagement':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-800 dark:text-blue-200';
      case 'behavior':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-800 dark:text-yellow-200';
      case 'academic':
        return 'bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-200';
      case 'strategy':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-800 dark:text-purple-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-600 dark:text-gray-200';
    }
  };

  const handleAddNote = async (formData: { noteText: string; category: SOBAStudentNote['category'] }) => {
    if (!student) {
      console.error('❌ SOBA DEBUG: No student data available to create note');
      alert('Unable to create note: Student data not found. Please refresh and try again.');
      return;
    }

    try {
      console.log(`💾 SOBA DEBUG: Creating note for studentId: ${studentId}`);
      const noteData = {
        studentId: String(studentId),
        studentName: `${student.firstName} ${student.lastName}`,
        homeroom: student.className || 'Unknown',
        noteText: formData.noteText,
        category: formData.category,
        noteTimestamp: new Date(),
        createdBy: 'admin' // TODO: Use actual user
      };
      console.log(`💾 SOBA DEBUG: Note data:`, noteData);
      
      const createdNote = await sobaService.createStudentNote(noteData);
      console.log(`✅ SOBA DEBUG: Note created successfully:`, createdNote);
      
      refetch();
    } catch (error) {
      console.error('❌ SOBA DEBUG: Error adding student note:', error);
      alert('Failed to add note. Please try again.');
    }
  };

  const sortedNotes = studentNotes ? [...studentNotes].sort((a, b) => 
    new Date(b.noteTimestamp).getTime() - new Date(a.noteTimestamp).getTime()
  ) : [];

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h4 className="text-lg font-medium text-gray-900 dark:text-gray-100">SOBA Observations</h4>
        <button
          onClick={() => {
            console.log('🔍 SOBA DEBUG: Add Note button clicked');
            setNoteFormOpen(true);
          }}
          className="inline-flex items-center px-3 py-1.5 bg-wasabi-green text-white rounded-md hover:bg-green-600 transition-colors text-sm"
        >
          <Plus size={16} className="mr-1" />
          Add Note
        </button>
      </div>

      {sortedNotes.length === 0 ? (
        <div className="text-center py-8 bg-gray-50 dark:bg-gray-700 rounded-lg border-2 border-dashed border-gray-200 dark:border-gray-600">
          <Eye size={48} className="mx-auto text-gray-400 dark:text-gray-500 mb-2" />
          <p className="text-gray-600 dark:text-gray-400">No SOBA observations recorded for this student.</p>
          <button
            onClick={() => {
              console.log('🔍 SOBA DEBUG: Add First Note button clicked');
              setNoteFormOpen(true);
            }}
            className="mt-3 inline-flex items-center px-3 py-2 bg-wasabi-green text-white rounded-md hover:bg-green-600 transition-colors text-sm"
          >
            <Plus size={16} className="mr-1" />
            Add First Note
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {sortedNotes.map((note) => (
            <div key={note.noteId} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg p-4 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center space-x-2">
                  <span className={`px-2 py-1 text-xs font-medium rounded-full capitalize ${getCategoryColor(note.category)}`}>
                    {note.category}
                  </span>
                  <span className="text-sm text-gray-500 dark:text-gray-400">{note.homeroom}</span>
                </div>
                <div className="flex items-center space-x-1 text-xs text-gray-500 dark:text-gray-400">
                  <Calendar size={14} />
                  <span>{formatDate(note.noteTimestamp)}</span>
                </div>
              </div>
              <p className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed">{note.noteText}</p>
              <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                Added by {note.createdBy}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Note Form Modal */}
      <StudentNoteForm
        isOpen={noteFormOpen && student !== null}
        onClose={() => setNoteFormOpen(false)}
        onSave={handleAddNote}
        studentName={student ? `${student.firstName} ${student.lastName}` : 'Unknown Student'}
      />
    </div>
  );
}