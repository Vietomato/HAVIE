import test from "node:test";
import assert from "node:assert/strict";
import { createMockService } from "../src/services/mockService.js";

const credentials = {
  email: "admin.test@example.com",
  password: "local-admin-password",
};

function createHarness({ existingUser = null, environment = {} } = {}) {
  let createdUser;
  const database = {
    user: {
      findUnique: async () => existingUser,
      create: async ({ data }) => {
        createdUser = {
          id: "local-admin-id",
          ...data,
          isActive: true,
          phone: null,
        };
        return createdUser;
      },
    },
  };
  const service = createMockService({
    database,
    hashPassword: async (password) => `hashed:${password}`,
    comparePassword: async (password, hash) => hash === `hashed:${password}`,
    createToken: async () => ({ accessToken: "test-token", expiresIn: 3600 }),
    environment: {
      NODE_ENV: "development",
      MOCK_ADMIN_ENABLED: "true",
      MOCK_ADMIN_EMAIL: credentials.email,
      MOCK_ADMIN_PASSWORD: credentials.password,
      ...environment,
    },
  });
  return { service, getCreatedUser: () => createdUser };
}

test("mock Admin login creates a local Admin only with configured credentials", async () => {
  const { service, getCreatedUser } = createHarness();
  const result = await service.loginMockAdmin(credentials);

  assert.equal(getCreatedUser().role, "ADMIN");
  assert.equal(getCreatedUser().passwordHash, `hashed:${credentials.password}`);
  assert.equal(result.data.user.id, "local-admin-id");
  assert.equal(result.data.accessToken, "test-token");
  assert.equal("passwordHash" in result.data.user, false);
});

test("mock Admin login rejects credentials that do not match local configuration", async () => {
  const { service, getCreatedUser } = createHarness();
  await assert.rejects(
    service.loginMockAdmin({ ...credentials, password: "wrong-password" }),
    { status: 401, code: "INVALID_CREDENTIALS" },
  );
  assert.equal(getCreatedUser(), undefined);
});

test("mock Admin login is disabled outside development", async () => {
  const { service } = createHarness({
    environment: { NODE_ENV: "production" },
  });
  await assert.rejects(service.loginMockAdmin(credentials), {
    status: 404,
    code: "NOT_FOUND",
  });
});

test("mock Admin login cannot promote an existing Customer", async () => {
  const { service } = createHarness({
    existingUser: {
      id: "customer-id",
      email: credentials.email,
      role: "CUSTOMER",
      isActive: true,
      passwordHash: `hashed:${credentials.password}`,
    },
  });
  await assert.rejects(service.loginMockAdmin(credentials), {
    status: 409,
    code: "MOCK_ADMIN_EMAIL_IN_USE",
  });
});
