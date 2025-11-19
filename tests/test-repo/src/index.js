
const express = require('express');
const _ = require('lodash');
const axios = require('axios');

class UserService {
  constructor() {
    this.users = [];
  }

  async getUser(id) {
    try {
      const user = this.users.find(u => u.id === id);
      if (!user) {
        throw new Error('User not found');
      }
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
      createdAt: new Date()
    };
    this.users.push(user);
    return user;
  }
}

module.exports = UserService;
