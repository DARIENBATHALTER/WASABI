import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Database, Calendar, FileText, Trash2, Eye, Download } from 'lucide-react';
import { db } from '../../lib/db';

export default function DataSourceList() {
  const [selectedSource, setSelectedSource] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data: dataSources, isLoading } = useQuery({
    queryKey: ['data-sources'],
    queryFn: () => db.dataSources.orderBy('uploadDate').reverse().toArray(),
  });

  const deleteMutation = useMutation({
    mutationFn: async (sourceId: string) => {
      await db.dataSources.delete(sourceId);
      // TODO: Also delete associated records
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['data-sources'] });
      queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
    },
  });

  const getTypeColor = (type: string) => {
    const colors = {
      focus: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
      iready: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
      fast: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
      star: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
      achieve3000: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
    };
    return colors[type as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  if (isLoading) {
    return (
      <div className="card">
        <div className="animate-pulse space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-20 bg-gray-200 dark:bg-gray-700 rounded" />
          ))}
        </div>
      </div>
    );
  }

  if (!dataSources?.length) {
    return (
      <div className="card text-center py-12">
        <Database className="mx-auto h-12 w-12 text-gray-400 mb-4" />
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
          No Data Sources
        </h3>
        <p className="text-gray-600 dark:text-gray-400">
          Upload your first CSV file to get started with data analysis.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Data Sources</h2>
        <div className="text-sm text-gray-600 dark:text-gray-400">
          {dataSources.length} source{dataSources.length !== 1 ? 's' : ''} imported
        </div>
      </div>

      <div className="grid gap-4">
        {dataSources.map((source) => (
          <div
            key={source.id}
            className="card hover:shadow-lg transition-shadow duration-200"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="p-2 bg-gray-100 dark:bg-gray-700 rounded-lg">
                  <FileText className="h-6 w-6 text-gray-600 dark:text-gray-300" />
                </div>
                
                <div>
                  <div className="flex items-center space-x-2 mb-1">
                    <h3 className="font-semibold text-gray-900 dark:text-white">
                      {source.name}
                    </h3>
                    <span className={`px-2 py-1 text-xs rounded-full ${getTypeColor(source.type)}`}>
                      {source.type.toUpperCase()}
                    </span>
                  </div>
                  
                  <div className="flex items-center space-x-4 text-sm text-gray-600 dark:text-gray-400">
                    <div className="flex items-center space-x-1">
                      <Calendar size={14} />
                      <span>{source.uploadDate.toLocaleDateString()}</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <Database size={14} />
                      <span>{source.recordCount} records</span>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setSelectedSource(selectedSource === source.id ? null : source.id)}
                  className="p-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                  title="View details"
                >
                  <Eye size={16} />
                </button>
                
                <button
                  className="p-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                  title="Export data"
                >
                  <Download size={16} />
                </button>
                
                <button
                  onClick={() => {
                    if (confirm('Are you sure you want to delete this data source? This action cannot be undone.')) {
                      deleteMutation.mutate(source.id);
                    }
                  }}
                  className="p-2 text-red-600 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                  title="Delete data source"
                  disabled={deleteMutation.isPending}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
            
            {selectedSource === source.id && (
              <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">Type:</span>
                    <div className="font-medium">{source.type}</div>
                  </div>
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">Records:</span>
                    <div className="font-medium">{source.recordCount}</div>
                  </div>
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">Uploaded:</span>
                    <div className="font-medium">{source.uploadDate.toLocaleString()}</div>
                  </div>
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">Status:</span>
                    <div className="font-medium text-green-600">Active</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}