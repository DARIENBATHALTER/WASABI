import React, { useState } from 'react';
import { Users, Plus, Pencil, Trash2, Save, X } from 'lucide-react';
import PageHeader from '../../shared/components/PageHeader';
import PageWrapper from '../../shared/components/PageWrapper';

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  createdAt: Date;
  lastLogin?: Date;
  isActive: boolean;
}

const DEFAULT_USERS: User[] = [
  {
    id: '1',
    email: 'techsupport@wayman.org',
    name: 'Tech Support',
    role: 'Administrator',
    createdAt: new Date('2024-01-01'),
    lastLogin: new Date(),
    isActive: true
  }
];

export default function UserManagementPage() {
  const [users, setUsers] = useState<User[]>(DEFAULT_USERS);
  const [editingUser, setEditingUser] = useState<string | null>(null);
  const [newUser, setNewUser] = useState<Partial<User>>({});
  const [showAddForm, setShowAddForm] = useState(false);

  const handleEdit = (userId: string) => {
    setEditingUser(userId);
  };

  const handleSave = (userId: string, updatedUser: Partial<User>) => {
    setUsers(users.map(user => 
      user.id === userId 
        ? { ...user, ...updatedUser }
        : user
    ));
    setEditingUser(null);
  };

  const handleDelete = (userId: string) => {
    if (confirm('Are you sure you want to delete this user?')) {
      setUsers(users.filter(user => user.id !== userId));
    }
  };

  const handleAddUser = () => {
    if (newUser.email && newUser.name && newUser.role) {
      const user: User = {
        id: Date.now().toString(),
        email: newUser.email,
        name: newUser.name,
        role: newUser.role,
        createdAt: new Date(),
        isActive: true,
        ...newUser
      } as User;
      
      setUsers([...users, user]);
      setNewUser({});
      setShowAddForm(false);
    }
  };

  const UserRow = ({ user }: { user: User }) => {
    const [editedUser, setEditedUser] = useState(user);
    const isEditing = editingUser === user.id;

    if (isEditing) {
      return (
        <tr className="border-b border-gray-200">
          <td className="py-3 px-4">
            <input
              type="email"
              value={editedUser.email}
              onChange={(e) => setEditedUser({ ...editedUser, email: e.target.value })}
              className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </td>
          <td className="py-3 px-4">
            <input
              type="text"
              value={editedUser.name}
              onChange={(e) => setEditedUser({ ...editedUser, name: e.target.value })}
              className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </td>
          <td className="py-3 px-4">
            <select
              value={editedUser.role}
              onChange={(e) => setEditedUser({ ...editedUser, role: e.target.value })}
              className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="Administrator">Administrator</option>
              <option value="Teacher">Teacher</option>
              <option value="Principal">Principal</option>
              <option value="Counselor">Counselor</option>
            </select>
          </td>
          <td className="py-3 px-4">
            <div className="flex items-center">
              <input
                type="checkbox"
                checked={editedUser.isActive}
                onChange={(e) => setEditedUser({ ...editedUser, isActive: e.target.checked })}
                className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
            </div>
          </td>
          <td className="py-3 px-4 text-sm text-gray-600">
            {user.createdAt.toLocaleDateString()}
          </td>
          <td className="py-3 px-4 text-sm text-gray-600">
            {user.lastLogin?.toLocaleDateString() || 'Never'}
          </td>
          <td className="py-3 px-4">
            <div className="flex items-center space-x-2">
              <button
                onClick={() => handleSave(user.id, editedUser)}
                className="text-green-600 hover:text-green-800 p-1 rounded hover:bg-green-50"
                title="Save"
              >
                <Save className="w-4 h-4" />
              </button>
              <button
                onClick={() => setEditingUser(null)}
                className="text-gray-600 hover:text-gray-800 p-1 rounded hover:bg-gray-50"
                title="Cancel"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </td>
        </tr>
      );
    }

    return (
      <tr className="border-b border-gray-200 hover:bg-gray-50">
        <td className="py-3 px-4 text-sm font-medium text-gray-900">{user.email}</td>
        <td className="py-3 px-4 text-sm text-gray-900">{user.name}</td>
        <td className="py-3 px-4">
          <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
            user.role === 'Administrator' 
              ? 'bg-purple-100 text-purple-800' 
              : user.role === 'Principal'
              ? 'bg-blue-100 text-blue-800'
              : user.role === 'Teacher'
              ? 'bg-green-100 text-green-800'
              : 'bg-yellow-100 text-yellow-800'
          }`}>
            {user.role}
          </span>
        </td>
        <td className="py-3 px-4">
          <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
            user.isActive 
              ? 'bg-green-100 text-green-800' 
              : 'bg-red-100 text-red-800'
          }`}>
            {user.isActive ? 'Active' : 'Inactive'}
          </span>
        </td>
        <td className="py-3 px-4 text-sm text-gray-600">
          {user.createdAt.toLocaleDateString()}
        </td>
        <td className="py-3 px-4 text-sm text-gray-600">
          {user.lastLogin?.toLocaleDateString() || 'Never'}
        </td>
        <td className="py-3 px-4">
          <div className="flex items-center space-x-2">
            <button
              onClick={() => handleEdit(user.id)}
              className="text-blue-600 hover:text-blue-800 p-1 rounded hover:bg-blue-50"
              title="Edit"
            >
              <Pencil className="w-4 h-4" />
            </button>
            <button
              onClick={() => handleDelete(user.id)}
              className="text-red-600 hover:text-red-800 p-1 rounded hover:bg-red-50"
              title="Delete"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </td>
      </tr>
    );
  };

  return (
    <PageWrapper>
      <PageHeader
        title="User Management"
        description="Manage user accounts and permissions"
        icon={Users}
        iconColor="text-gray-600 dark:text-gray-300"
      >
        <button
          onClick={() => setShowAddForm(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Add User</span>
        </button>
      </PageHeader>

      {/* Content */}
      <div className="p-6">
        <div className="bg-white dark:bg-gray-800 shadow-sm rounded-lg overflow-hidden">
          {/* Add User Form */}
          {showAddForm && (
            <div className="p-4 border-b border-gray-200 bg-gray-50">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Add New User</h3>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={newUser.email || ''}
                    onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="user@wayman.org"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                  <input
                    type="text"
                    value={newUser.name || ''}
                    onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="John Doe"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                  <select
                    value={newUser.role || ''}
                    onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Select role</option>
                    <option value="Administrator">Administrator</option>
                    <option value="Principal">Principal</option>
                    <option value="Teacher">Teacher</option>
                    <option value="Counselor">Counselor</option>
                  </select>
                </div>
                <div className="flex items-end space-x-2">
                  <button
                    onClick={handleAddUser}
                    className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md transition-colors"
                  >
                    Add User
                  </button>
                  <button
                    onClick={() => {
                      setShowAddForm(false);
                      setNewUser({});
                    }}
                    className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-md transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Users Table */}
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Role
                  </th>
                  <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Created
                  </th>
                  <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Last Login
                  </th>
                  <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {users.map(user => (
                  <UserRow key={user.id} user={user} />
                ))}
              </tbody>
            </table>
          </div>

          {/* Stats Footer */}
          <div className="bg-gray-50 px-4 py-3 border-t border-gray-200">
            <div className="flex items-center justify-between text-sm text-gray-600">
              <span>Total Users: {users.length}</span>
              <span>Active: {users.filter(u => u.isActive).length}</span>
            </div>
          </div>
        </div>
      </div>
    </PageWrapper>
  );
}