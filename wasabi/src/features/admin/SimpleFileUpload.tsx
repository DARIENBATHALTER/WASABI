import { useState } from 'react';
import { Upload, File } from 'lucide-react';

export default function SimpleFileUpload() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    console.log('File input changed:', file);
    if (file) {
      setSelectedFile(file);
    }
  };

  return (
    <div className="card">
      <h3 className="text-lg font-semibold mb-4">Test File Upload</h3>
      
      <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
        <Upload className="mx-auto h-8 w-8 text-gray-400 mb-2" />
        
        {selectedFile ? (
          <div>
            <div className="flex items-center justify-center space-x-2 mb-2">
              <File className="h-4 w-4 text-green-600" />
              <span className="text-sm font-medium">{selectedFile.name}</span>
            </div>
            <button
              onClick={() => setSelectedFile(null)}
              className="text-xs text-red-600 hover:text-red-800"
            >
              Remove
            </button>
          </div>
        ) : (
          <div>
            <p className="text-sm mb-2">Select a CSV file</p>
            <input
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              className="block mx-auto text-sm text-gray-500
                file:mr-4 file:py-2 file:px-4
                file:rounded-full file:border-0
                file:text-sm file:font-semibold
                file:bg-blue-50 file:text-blue-700
                hover:file:bg-blue-100"
            />
          </div>
        )}
      </div>
    </div>
  );
}