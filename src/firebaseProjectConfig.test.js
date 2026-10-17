import { describe, expect, it } from "vitest";
import { DEFAULT_FIREBASE_CONFIG, resolveFirebaseConfig } from "./firebaseProjectConfig";

describe("Firebase project configuration", () => {
  it("keeps the current distributor project when no deployment variables are supplied", () => {
    expect(resolveFirebaseConfig({})).toEqual(DEFAULT_FIREBASE_CONFIG);
  });

  it("uses a complete alternate Firebase project without changing the default configuration", () => {
    const alternate = resolveFirebaseConfig({
      VITE_FIREBASE_API_KEY: "new-key",
      VITE_FIREBASE_AUTH_DOMAIN: "other.firebaseapp.com",
      VITE_FIREBASE_PROJECT_ID: "other-project",
      VITE_FIREBASE_STORAGE_BUCKET: "other.firebasestorage.app",
      VITE_FIREBASE_MESSAGING_SENDER_ID: "123",
      VITE_FIREBASE_APP_ID: "1:123:web:new",
      VITE_FIREBASE_MEASUREMENT_ID: "G-NEW",
    });

    expect(alternate).toEqual({
      apiKey: "new-key",
      authDomain: "other.firebaseapp.com",
      projectId: "other-project",
      storageBucket: "other.firebasestorage.app",
      messagingSenderId: "123",
      appId: "1:123:web:new",
      measurementId: "G-NEW",
    });
    expect(DEFAULT_FIREBASE_CONFIG.projectId).toBe("agua-correa-e8c6b");
  });
});
