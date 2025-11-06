/**
 * PKCE Utilities Tests
 */

import { describe, test, expect } from "bun:test";
import {
  generateCodeVerifier,
  generateCodeChallenge,
  generateState,
  generateStateWithReturnUrl,
  parseState,
} from "../../src/oauth/pkce.js";

describe("PKCE Utilities", () => {
  describe("generateCodeVerifier", () => {
    test("generates a valid code verifier", () => {
      const verifier = generateCodeVerifier();
      
      expect(verifier).toBeDefined();
      expect(typeof verifier).toBe("string");
      expect(verifier.length).toBeGreaterThanOrEqual(43);
      expect(verifier.length).toBeLessThanOrEqual(128);
    });

    test("generates unique verifiers", () => {
      const verifier1 = generateCodeVerifier();
      const verifier2 = generateCodeVerifier();
      
      expect(verifier1).not.toBe(verifier2);
    });

    test("uses base64url encoding (no +/= characters)", () => {
      const verifier = generateCodeVerifier();
      
      expect(verifier).not.toMatch(/[+/=]/);
      expect(verifier).toMatch(/^[A-Za-z0-9_-]+$/);
    });

    test("generates multiple unique verifiers", () => {
      const verifiers = new Set();
      
      for (let i = 0; i < 10; i++) {
        verifiers.add(generateCodeVerifier());
      }
      
      expect(verifiers.size).toBe(10);
    });
  });

  describe("generateCodeChallenge", () => {
    test("generates a valid code challenge from verifier", async () => {
      const verifier = generateCodeVerifier();
      const challenge = await generateCodeChallenge(verifier);
      
      expect(challenge).toBeDefined();
      expect(typeof challenge).toBe("string");
      expect(challenge.length).toBeGreaterThan(0);
    });

    test("generates consistent challenge for same verifier", async () => {
      const verifier = "test-verifier-12345";
      const challenge1 = await generateCodeChallenge(verifier);
      const challenge2 = await generateCodeChallenge(verifier);
      
      expect(challenge1).toBe(challenge2);
    });

    test("generates different challenges for different verifiers", async () => {
      const verifier1 = generateCodeVerifier();
      const verifier2 = generateCodeVerifier();
      
      const challenge1 = await generateCodeChallenge(verifier1);
      const challenge2 = await generateCodeChallenge(verifier2);
      
      expect(challenge1).not.toBe(challenge2);
    });

    test("uses base64url encoding (no +/= characters)", async () => {
      const verifier = generateCodeVerifier();
      const challenge = await generateCodeChallenge(verifier);
      
      expect(challenge).not.toMatch(/[+/=]/);
      expect(challenge).toMatch(/^[A-Za-z0-9_-]+$/);
    });

    test("generates SHA-256 hash (expected length)", async () => {
      const verifier = generateCodeVerifier();
      const challenge = await generateCodeChallenge(verifier);
      
      // SHA-256 produces 32 bytes, base64url encoded is 43 characters
      expect(challenge.length).toBe(43);
    });
  });

  describe("generateState", () => {
    test("generates a valid state parameter", () => {
      const state = generateState();
      
      expect(state).toBeDefined();
      expect(typeof state).toBe("string");
      expect(state.length).toBeGreaterThan(0);
    });

    test("generates unique state values", () => {
      const state1 = generateState();
      const state2 = generateState();
      
      expect(state1).not.toBe(state2);
    });

    test("uses base64url encoding (no +/= characters)", () => {
      const state = generateState();
      
      expect(state).not.toMatch(/[+/=]/);
      expect(state).toMatch(/^[A-Za-z0-9_-]+$/);
    });

    test("generates multiple unique states", () => {
      const states = new Set();
      
      for (let i = 0; i < 10; i++) {
        states.add(generateState());
      }
      
      expect(states.size).toBe(10);
    });

    test("generates state of expected length", () => {
      const state = generateState();
      
      // 16 bytes base64url encoded should be ~22 characters
      expect(state.length).toBeGreaterThanOrEqual(20);
      expect(state.length).toBeLessThanOrEqual(24);
    });
  });

  describe("generateStateWithReturnUrl", () => {
    test("generates state without return URL", () => {
      const state = generateStateWithReturnUrl();
      
      expect(state).toBeDefined();
      expect(typeof state).toBe("string");
      expect(state.length).toBeGreaterThan(0);
      expect(state).not.toMatch(/[+/=]/);
    });

    test("generates state with return URL", () => {
      const returnUrl = "/marketplace/github";
      const state = generateStateWithReturnUrl(returnUrl);
      
      expect(state).toBeDefined();
      expect(typeof state).toBe("string");
      expect(state.length).toBeGreaterThan(0);
      expect(state).not.toMatch(/[+/=]/);
    });

    test("generates unique states even with same return URL", () => {
      const returnUrl = "/marketplace/github";
      const state1 = generateStateWithReturnUrl(returnUrl);
      const state2 = generateStateWithReturnUrl(returnUrl);
      
      expect(state1).not.toBe(state2);
    });

    test("encodes return URL properly", () => {
      const returnUrl = "/marketplace/github?tab=integrations";
      const state = generateStateWithReturnUrl(returnUrl);
      
      // Should be base64url encoded
      expect(state).toMatch(/^[A-Za-z0-9_-]+$/);
      
      // Should be decodable
      const decoded = parseState(state);
      expect(decoded.returnUrl).toBe(returnUrl);
    });

    test("handles complex return URLs", () => {
      const returnUrl = "/path/with/multiple/segments?param1=value1&param2=value2#hash";
      const state = generateStateWithReturnUrl(returnUrl);
      
      const decoded = parseState(state);
      expect(decoded.returnUrl).toBe(returnUrl);
    });
  });

  describe("parseState", () => {
    test("parses state without return URL", () => {
      const state = generateStateWithReturnUrl();
      const decoded = parseState(state);
      
      expect(decoded).toBeDefined();
      expect(decoded.csrf).toBeDefined();
      expect(typeof decoded.csrf).toBe("string");
      expect(decoded.returnUrl).toBeUndefined();
    });

    test("parses state with return URL", () => {
      const returnUrl = "/marketplace/github";
      const state = generateStateWithReturnUrl(returnUrl);
      const decoded = parseState(state);
      
      expect(decoded.csrf).toBeDefined();
      expect(decoded.returnUrl).toBe(returnUrl);
    });

    test("handles legacy plain string state format", () => {
      const plainState = "plain-csrf-token-12345";
      const decoded = parseState(plainState);
      
      expect(decoded.csrf).toBe(plainState);
      expect(decoded.returnUrl).toBeUndefined();
    });

    test("handles old generateState() format for backward compatibility", () => {
      const oldState = generateState();
      const decoded = parseState(oldState);
      
      expect(decoded.csrf).toBeDefined();
      expect(decoded.returnUrl).toBeUndefined();
    });

    test("returns csrf from invalid base64 gracefully", () => {
      const invalidState = "!!!invalid-base64!!!";
      const decoded = parseState(invalidState);
      
      expect(decoded.csrf).toBe(invalidState);
      expect(decoded.returnUrl).toBeUndefined();
    });

    test("round-trip encoding/decoding preserves data", () => {
      const returnUrl = "/marketplace/github";
      const state = generateStateWithReturnUrl(returnUrl);
      const decoded = parseState(state);
      
      expect(decoded.csrf).toBeDefined();
      expect(decoded.csrf.length).toBeGreaterThan(0);
      expect(decoded.returnUrl).toBe(returnUrl);
    });

    test("round-trip without return URL preserves CSRF", () => {
      const state = generateStateWithReturnUrl();
      const decoded = parseState(state);
      
      expect(decoded.csrf).toBeDefined();
      expect(decoded.csrf.length).toBeGreaterThan(0);
      expect(decoded.returnUrl).toBeUndefined();
    });
  });

  describe("Dynamic Return URL Integration", () => {
    test("different return URLs produce different states", () => {
      const state1 = generateStateWithReturnUrl("/page1");
      const state2 = generateStateWithReturnUrl("/page2");
      
      expect(state1).not.toBe(state2);
      
      const decoded1 = parseState(state1);
      const decoded2 = parseState(state2);
      
      expect(decoded1.returnUrl).toBe("/page1");
      expect(decoded2.returnUrl).toBe("/page2");
    });

    test("handles URL-encoded characters in return URL", () => {
      const returnUrl = "/search?q=hello%20world&filter=active";
      const state = generateStateWithReturnUrl(returnUrl);
      const decoded = parseState(state);
      
      expect(decoded.returnUrl).toBe(returnUrl);
    });

    test("handles empty string return URL", () => {
      const state = generateStateWithReturnUrl("");
      const decoded = parseState(state);
      
      // Empty string is falsy, so it's not included (treated as no return URL)
      expect(decoded.csrf).toBeDefined();
      expect(decoded.returnUrl).toBeUndefined();
    });

    test("CSRF tokens are unique even with same return URL", () => {
      const returnUrl = "/marketplace";
      const state1 = generateStateWithReturnUrl(returnUrl);
      const state2 = generateStateWithReturnUrl(returnUrl);
      
      const decoded1 = parseState(state1);
      const decoded2 = parseState(state2);
      
      expect(decoded1.csrf).not.toBe(decoded2.csrf);
      expect(decoded1.returnUrl).toBe(decoded2.returnUrl);
    });
  });

  describe("PKCE Flow Integration", () => {
    test("complete PKCE flow generates valid parameters", async () => {
      // Generate all PKCE parameters
      const codeVerifier = generateCodeVerifier();
      const codeChallenge = await generateCodeChallenge(codeVerifier);
      const state = generateState();
      
      // Verify all parameters are valid
      expect(codeVerifier).toBeDefined();
      expect(codeChallenge).toBeDefined();
      expect(state).toBeDefined();
      
      expect(codeVerifier.length).toBeGreaterThanOrEqual(43);
      expect(codeChallenge.length).toBe(43);
      expect(state.length).toBeGreaterThan(0);
    });

    test("can generate multiple independent PKCE flows", async () => {
      // Flow 1
      const verifier1 = generateCodeVerifier();
      const challenge1 = await generateCodeChallenge(verifier1);
      const state1 = generateState();
      
      // Flow 2
      const verifier2 = generateCodeVerifier();
      const challenge2 = await generateCodeChallenge(verifier2);
      const state2 = generateState();
      
      // Verify they're all unique
      expect(verifier1).not.toBe(verifier2);
      expect(challenge1).not.toBe(challenge2);
      expect(state1).not.toBe(state2);
    });

    test("complete PKCE flow with return URL", async () => {
      const returnUrl = "/marketplace/github";
      const codeVerifier = generateCodeVerifier();
      const codeChallenge = await generateCodeChallenge(codeVerifier);
      const state = generateStateWithReturnUrl(returnUrl);
      
      expect(codeVerifier).toBeDefined();
      expect(codeChallenge).toBeDefined();
      expect(state).toBeDefined();
      
      const decoded = parseState(state);
      expect(decoded.csrf).toBeDefined();
      expect(decoded.returnUrl).toBe(returnUrl);
    });
  });
});

