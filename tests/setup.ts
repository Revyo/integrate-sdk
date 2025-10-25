/**
 * Test Setup
 * Global test configuration and utilities
 */

// Suppress console logs during tests unless DEBUG is set
if (!process.env.DEBUG) {
  const noop = () => {};
  global.console.log = noop;
  global.console.info = noop;
}

// Export test utilities
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function randomPort(): number {
  return 3000 + Math.floor(Math.random() * 1000);
}

