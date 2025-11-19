
const express = require('express');
const compression = require('compression');
const helmet = require('helmet');
const _ = require('lodash');
const axios = require('axios');

class OptimizedUserService {
  constructor() {
    this.users = new Map(); // Use Map for better performance
    this.cache = new Map(); // Add caching layer
  }

  async getUser(id) {
    try {
      // Check cache first
      if (this.cache.has(id)) {
        return this.cache.get(id);
      }

      const user = this.users.get(id);
      if (!user) {
        throw new Error('User not found');
      }

      // Cache the result
      this.cache.set(id, user);
      return user;
    } catch (error) {
      console.error('Error getting user:', error);
      throw error;
    }
  }

  async createUser(userData) {
    const user = {
      id: _.uniqueId(),
      ...userData,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    this.users.set(user.id, user);
    this.cache.clear(); // Clear cache on write
    return user;
  }

  async batchCreateUsers(userDataArray) {
    return Promise.all(
      userDataArray.map(userData => this.createUser(userData))
    );
  }

  getMetrics() {
    return {
      totalUsers: this.users.size,
      cacheSize: this.cache.size,
      memoryUsage: process.memoryUsage()
    };
  }
}

module.exports = OptimizedUserService;
