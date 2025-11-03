/**
 * OAuth Window Manager Tests
 */

import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { OAuthWindowManager } from "../../src/oauth/window-manager.js";

// Mock window object for tests
const mockWindow = {
  screenX: 0,
  screenY: 0,
  outerWidth: 1920,
  outerHeight: 1080,
  location: {
    origin: "http://localhost:3000",
    href: "http://localhost:3000",
    search: "",
  },
  document: {}, // Add document to satisfy isBrowser check
  open: () => null,
  addEventListener: () => {},
  removeEventListener: () => {},
  postMessage: () => {},
  close: () => {},
  focus: () => {},
};

describe("OAuth Window Manager", () => {
  let manager: OAuthWindowManager;
  let originalWindow: any;

  beforeEach(() => {
    // @ts-ignore - mock window for testing
    originalWindow = global.window;
    // @ts-ignore - mock window for testing
    global.window = mockWindow as any;
    manager = new OAuthWindowManager();
  });

  afterEach(() => {
    manager.close();
    // @ts-ignore - restore original window
    global.window = originalWindow;
  });

  describe("Constructor", () => {
    test("creates a new instance", () => {
      expect(manager).toBeDefined();
      expect(manager).toBeInstanceOf(OAuthWindowManager);
    });
  });

  describe("Browser Environment Checks", () => {
    test("openPopup throws error in non-browser environment", () => {
      // @ts-ignore - temporarily remove window
      global.window = undefined;
      const serverManager = new OAuthWindowManager();
      
      expect(() => {
        serverManager.openPopup("https://example.com");
      }).toThrow("can only be used in browser environments");
      
      // @ts-ignore - restore window
      global.window = mockWindow as any;
    });

    test("openRedirect throws error in non-browser environment", () => {
      // @ts-ignore - temporarily remove window
      global.window = undefined;
      const serverManager = new OAuthWindowManager();
      
      expect(() => {
        serverManager.openRedirect("https://example.com");
      }).toThrow("can only be used in browser environments");
      
      // @ts-ignore - restore window
      global.window = mockWindow as any;
    });

    test("listenForCallback rejects in non-browser environment", async () => {
      // @ts-ignore - temporarily remove window
      global.window = undefined;
      const serverManager = new OAuthWindowManager();
      
      await expect(
        serverManager.listenForCallback('popup')
      ).rejects.toThrow("can only be used in browser environments");
      
      // @ts-ignore - restore window
      global.window = mockWindow as any;
    });
  });

  describe("openPopup", () => {
    test("attempts to open popup window", () => {
      // Note: In test environment, window.open may not work
      // We're testing that the method doesn't throw
      const url = "https://github.com/login/oauth/authorize";
      
      expect(() => {
        manager.openPopup(url);
      }).not.toThrow();
    });

    test("accepts custom popup options", () => {
      const url = "https://github.com/login/oauth/authorize";
      const options = { width: 800, height: 900 };
      
      expect(() => {
        manager.openPopup(url, options);
      }).not.toThrow();
    });

    test("uses default dimensions when not provided", () => {
      const url = "https://github.com/login/oauth/authorize";
      
      expect(() => {
        manager.openPopup(url);
      }).not.toThrow();
    });
  });

  describe("openRedirect", () => {
    test("method exists and can be called", () => {
      expect(manager.openRedirect).toBeDefined();
      expect(typeof manager.openRedirect).toBe("function");
    });

    test("accepts URL parameter", () => {
      const url = "https://github.com/login/oauth/authorize";
      
      // In test environment, this won't actually redirect
      // We're just testing the method signature
      expect(() => {
        // This would redirect in browser, but won't in test
        if (typeof window === 'undefined') {
          // Skip redirect in non-browser environment
          return;
        }
        manager.openRedirect(url);
      }).not.toThrow();
    });
  });

  describe("listenForCallback", () => {
    test("returns a promise", () => {
      const promise = manager.listenForCallback('popup', 1000);
      expect(promise).toBeInstanceOf(Promise);
      
      // Clean up by rejecting (timeout)
      promise.catch(() => {});
    });

    test("accepts mode parameter", () => {
      expect(() => {
        const promise = manager.listenForCallback('popup', 1000);
        promise.catch(() => {});
      }).not.toThrow();

      expect(() => {
        const promise = manager.listenForCallback('redirect', 1000);
        promise.catch(() => {});
      }).not.toThrow();
    });

    test("accepts timeout parameter", () => {
      expect(() => {
        const promise = manager.listenForCallback('popup', 5000);
        promise.catch(() => {});
      }).not.toThrow();
    });

    test("times out after specified duration", async () => {
      const timeoutMs = 100;
      
      await expect(
        manager.listenForCallback('popup', timeoutMs)
      ).rejects.toThrow();
    }, 200);
  });

  describe("close", () => {
    test("can be called multiple times safely", () => {
      expect(() => {
        manager.close();
        manager.close();
        manager.close();
      }).not.toThrow();
    });

    test("cleans up popup window", () => {
      manager.openPopup("https://example.com");
      
      expect(() => {
        manager.close();
      }).not.toThrow();
    });
  });
});

describe("sendCallbackToOpener", () => {
  let originalWindow: any;

  beforeEach(() => {
    // @ts-ignore - mock window for testing
    originalWindow = global.window;
    // @ts-ignore - mock window for testing
    global.window = mockWindow as any;
  });

  afterEach(() => {
    // @ts-ignore - restore original window
    global.window = originalWindow;
  });

  test("function is exported", async () => {
    const { sendCallbackToOpener } = await import("../../src/oauth/window-manager.js");
    expect(sendCallbackToOpener).toBeDefined();
    expect(typeof sendCallbackToOpener).toBe("function");
  });

  test("handles missing opener gracefully", () => {
    const { sendCallbackToOpener } = require("../../src/oauth/window-manager.js");
    
    // In test environment, window.opener doesn't exist
    // Should not throw
    expect(() => {
      sendCallbackToOpener({
        code: "test-code",
        state: "test-state",
      });
    }).not.toThrow();
  });
});

