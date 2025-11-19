
const UserService = require('../src/index');

describe('UserService', () => {
  let service;

  beforeEach(() => {
    service = new UserService();
  });

  test('should create a user', async () => {
    const user = await service.createUser({
      name: 'John Doe',
      email: 'john@example.com'
    });

    expect(user).toHaveProperty('id');
    expect(user.name).toBe('John Doe');
    expect(user.email).toBe('john@example.com');
  });

  test('should get a user by id', async () => {
    const created = await service.createUser({
      name: 'Jane Doe',
      email: 'jane@example.com'
    });

    const user = await service.getUser(created.id);
    expect(user.name).toBe('Jane Doe');
  });
});
