import { db, type User } from '../lib/db';

export class UserService {
  async getAllUsers(): Promise<User[]> {
    return await db.users.orderBy('name').toArray();
  }

  async getUserById(id: number): Promise<User | undefined> {
    return await db.users.get(id);
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return await db.users.where('email').equals(email).first();
  }

  async createUser(userData: Omit<User, 'id' | 'createdAt'>): Promise<number> {
    const user: Omit<User, 'id'> = {
      ...userData,
      createdAt: new Date()
    };
    
    // Check if email already exists
    const existingUser = await this.getUserByEmail(userData.email);
    if (existingUser) {
      throw new Error('User with this email already exists');
    }
    
    return await db.users.add(user);
  }

  async updateUser(id: number, userData: Partial<User>): Promise<void> {
    const existingUser = await this.getUserById(id);
    if (!existingUser) {
      throw new Error('User not found');
    }

    // If email is being changed, check for duplicates
    if (userData.email && userData.email !== existingUser.email) {
      const emailExists = await this.getUserByEmail(userData.email);
      if (emailExists) {
        throw new Error('User with this email already exists');
      }
    }

    await db.users.update(id, userData);
  }

  async deleteUser(id: number): Promise<void> {
    const user = await this.getUserById(id);
    if (!user) {
      throw new Error('User not found');
    }

    // Prevent deletion of the default admin user
    if (user.email === 'techsupport@wayman.org') {
      throw new Error('Cannot delete the default admin user');
    }

    await db.users.delete(id);
  }

  async validateLogin(email: string, password: string): Promise<User | null> {
    const user = await this.getUserByEmail(email);
    
    if (!user || !user.isActive) {
      return null;
    }

    // In a real app, passwords would be hashed
    // For now, we're doing plain text comparison
    if (user.password === password) {
      // Update last login time
      await this.updateUser(user.id!, { lastLogin: new Date() });
      return user;
    }

    return null;
  }

  async getUserCount(): Promise<number> {
    return await db.users.count();
  }

  async getActiveUserCount(): Promise<number> {
    return await db.users.where('isActive').equals(true).count();
  }
}

export const userService = new UserService();