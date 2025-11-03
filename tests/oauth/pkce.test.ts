/**
 * PKCE Utilities Tests
 */

import { describe, test, expect } from "bun:test";
import {
  generateCodeVerifier,
  generateCodeChallenge,
  generateState,
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
  });
});

