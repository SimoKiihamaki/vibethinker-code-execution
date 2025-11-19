
const OptimizedUserService = require('../src/index');

describe('OptimizedUserService', () => {
  let service;

  beforeEach(() => {
    service = new OptimizedUserService();
  });

  test('should create a user efficiently', async () => {
    const user = await service.createUser({
      name: 'John Doe',
      email: 'john@example.com'
    });

    expect(user).toHaveProperty('id');
    expect(user.name).toBe('John Doe');
    expect(user.email).toBe('john@example.com');
    expect(user.createdAt).toBeInstanceOf(Date);
  });

  test('should get user from cache', async () => {
    const created = await service.createUser({
      name: 'Jane Doe',
      email: 'jane@example.com'
    });

    const user = await service.getUser(created.id);
    expect(user.name).toBe('Jane Doe');
    
    // Second call should hit cache
    const cachedUser = await service.getUser(created.id);
    expect(cachedUser).toEqual(user);
  });

  test('should batch create users efficiently', async () => {
    const users = await service.batchCreateUsers([
      { name: 'User 1', email: 'user1@example.com' },
      { name: 'User 2', email: 'user2@example.com' },
      { name: 'User 3', email: 'user3@example.com' }
    ]);

    expect(users).toHaveLength(3);
    expect(service.users.size).toBe(3);
  });

  test('should provide performance metrics', () => {
    const metrics = service.getMetrics();
    
    expect(metrics).toHaveProperty('totalUsers');
    expect(metrics).toHaveProperty('cacheSize');
    expect(metrics).toHaveProperty('memoryUsage');
  });
});
