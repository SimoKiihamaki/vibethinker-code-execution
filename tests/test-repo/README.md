# Test Repository

This is a test repository for MLX integration testing.

## Installation

```bash
npm install
```

## Usage

```javascript
const UserService = require('./src/index');

const service = new UserService();
const user = await service.createUser({
  name: 'Test User',
  email: 'test@example.com'
});
```

## Testing

```bash
npm test
```
