import test from "node:test";
import assert from "node:assert/strict";
import {
  validateAdminOrderTransition,
  validateProductPayload,
} from "../src/utils/adminValidation.js";
import {
  requireAdmin,
  requireCustomer,
} from "../src/middlewares/authMiddleware.js";

test("product validation normalizes product and variant values", () => {
  assert.deepEqual(
    validateProductPayload({
      name: "  Vợt mẫu ",
      slug: "vot-mau",
      categoryId: "category-id",
      brandId: "brand-id",
      imageUrls: ["/images/racket.jpg"],
      specs: ["  4U  "],
      variants: [
        {
          sku: "RACKET-4U",
          name: "4U",
          attributes: { weight: "4U" },
          price: 1000000,
          oldPrice: null,
          stockQuantity: 3,
        },
      ],
    }),
    {
      name: "Vợt mẫu",
      slug: "vot-mau",
      categoryId: "category-id",
      brandId: "brand-id",
      imageUrls: ["/images/racket.jpg"],
      specs: ["4U"],
      variants: [
        {
          sku: "RACKET-4U",
          name: "4U",
          attributes: { weight: "4U" },
          price: 1000000,
          oldPrice: null,
          stockQuantity: 3,
          isAvailable: true,
        },
      ],
    },
  );
});

test("product validation rejects invalid slugs, prices, and repeated SKUs", () => {
  const product = {
    name: "Vợt",
    slug: "Invalid Slug",
    categoryId: "category-id",
    brandId: "brand-id",
    variants: [
      {
        sku: "RACKET",
        name: "Bản tiêu chuẩn",
        price: 1000,
        stockQuantity: 1,
      },
    ],
  };
  assert.throws(
    () => validateProductPayload(product),
    (error) => error.status === 400,
  );
  assert.throws(
    () =>
      validateProductPayload({
        ...product,
        slug: "vot",
        variants: [{ ...product.variants[0], price: 0 }],
      }),
    (error) => error.status === 400,
  );
  assert.throws(
    () =>
      validateProductPayload({
        ...product,
        slug: "vot",
        variants: [product.variants[0], product.variants[0]],
      }),
    (error) => error.status === 400,
  );
});

test("admin order transitions allow the workflow and prevent skipping or reversing", () => {
  assert.doesNotThrow(() =>
    validateAdminOrderTransition("PENDING_CONFIRMATION", "CONFIRMED"),
  );
  assert.doesNotThrow(() =>
    validateAdminOrderTransition("CONFIRMED", "SHIPPING"),
  );
  assert.doesNotThrow(() =>
    validateAdminOrderTransition("SHIPPING", "COMPLETED"),
  );
  assert.doesNotThrow(() =>
    validateAdminOrderTransition("PENDING_CONFIRMATION", "CANCELLED"),
  );
  assert.throws(
    () => validateAdminOrderTransition("PENDING_CONFIRMATION", "SHIPPING"),
    (error) => error.status === 409,
  );
  assert.throws(
    () => validateAdminOrderTransition("COMPLETED", "CANCELLED"),
    (error) => error.status === 409,
  );
});

test("admin middleware allows only authenticated admin roles", () => {
  let nextError;
  requireAdmin({ user: { role: "CUSTOMER" } }, {}, (error) => {
    nextError = error;
  });
  assert.equal(nextError.status, 403);
  assert.equal(nextError.code, "FORBIDDEN");

  let passed = false;
  requireAdmin({ user: { role: "ADMIN" } }, {}, (error) => {
    assert.equal(error, undefined);
    passed = true;
  });
  assert.equal(passed, true);
});

test("customer-only order middleware rejects admin accounts", () => {
  let nextError;
  requireCustomer({ user: { role: "ADMIN" } }, {}, (error) => {
    nextError = error;
  });
  assert.equal(nextError.status, 403);
  assert.equal(nextError.code, "FORBIDDEN");

  let passed = false;
  requireCustomer({ user: { role: "CUSTOMER" } }, {}, (error) => {
    assert.equal(error, undefined);
    passed = true;
  });
  assert.equal(passed, true);
});
