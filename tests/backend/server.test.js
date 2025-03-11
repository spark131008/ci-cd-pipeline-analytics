const setupApp = require('../../api/server');

describe('Express Server', () => {
  it('should set up the Express app', () => {
    const app = setupApp();
    expect(app).toBeDefined();
    expect(typeof app.listen).toBe('function');
  });
});