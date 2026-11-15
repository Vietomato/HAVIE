import { timingSafeEqual } from "node:crypto";
import bcrypt from "bcrypt";
import prisma from "../config/prisma.js";
import {
  createAccessToken,
  publicUserSelect,
} from "../middlewares/authMiddleware.js";
import { HttpError } from "../utils/http.js";
import { validateLoginBody } from "../utils/authValidation.js";

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(left, "utf8");
  const rightBuffer = Buffer.from(right, "utf8");
  return (
    leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer)
  );
}

function getMockAdminConfiguration(environment) {
  if (
    environment.NODE_ENV !== "development" ||
    environment.MOCK_ADMIN_ENABLED !== "true"
  ) {
    throw new HttpError(
      404,
      "NOT_FOUND",
      "Đăng nhập Admin thử nghiệm chỉ khả dụng trong môi trường development.",
    );
  }

  const email = environment.MOCK_ADMIN_EMAIL?.trim().toLowerCase();
  const password = environment.MOCK_ADMIN_PASSWORD;
  if (
    !email ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    typeof password !== "string" ||
    Buffer.byteLength(password, "utf8") < 6 ||
    Buffer.byteLength(password, "utf8") > 72
  ) {
    throw new HttpError(
      500,
      "SERVER_MISCONFIGURED",
      "Cần cấu hình MOCK_ADMIN_EMAIL và MOCK_ADMIN_PASSWORD để dùng Admin thử nghiệm.",
    );
  }

  return { email, password };
}

function toPublicUser(user) {
  return Object.fromEntries(
    Object.keys(publicUserSelect).map((key) => [key, user[key]]),
  );
}

export function createMockService({
  database = prisma,
  hashPassword = (password) => bcrypt.hash(password, 12),
  comparePassword = bcrypt.compare,
  createToken = createAccessToken,
  environment = process.env,
} = {}) {
  return {
    async loginMockAdmin(credentials) {
      const { email, password } = getMockAdminConfiguration(environment);
      const input = validateLoginBody(credentials);
      if (input.email !== email || !safeEqual(input.password, password)) {
        throw new HttpError(
          401,
          "INVALID_CREDENTIALS",
          "Thông tin Admin thử nghiệm không chính xác.",
        );
      }

      const user = await database.user.findUnique({
        where: { email },
        select: { ...publicUserSelect, passwordHash: true },
      });

      let admin = user;
      if (!admin) {
        admin = await database.user.create({
          data: {
            email,
            fullName: "HAVIE Local Admin",
            passwordHash: await hashPassword(password),
            role: "ADMIN",
            emailVerifiedAt: new Date(),
          },
          select: { ...publicUserSelect, passwordHash: true },
        });
      } else if (admin.role !== "ADMIN") {
        throw new HttpError(
          409,
          "MOCK_ADMIN_EMAIL_IN_USE",
          "Email Admin thử nghiệm đang thuộc tài khoản không phải Admin.",
        );
      } else if (!(await comparePassword(password, admin.passwordHash))) {
        throw new HttpError(
          409,
          "MOCK_ADMIN_EMAIL_IN_USE",
          "Email Admin thử nghiệm đã thuộc một tài khoản khác.",
        );
      }

      if (!admin.isActive) {
        throw new HttpError(
          403,
          "ACCOUNT_DISABLED",
          "Tài khoản Admin đã bị khóa.",
        );
      }

      const { accessToken, expiresIn } = await createToken(admin);
      return {
        data: {
          user: toPublicUser(admin),
          accessToken,
          expiresIn,
        },
        message: "Đăng nhập Admin thử nghiệm thành công.",
      };
    },
  };
}

export const mockService = createMockService();
