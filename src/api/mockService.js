// HAVIE API Contract v1 - Complete In-Browser Mock Engine with LocalStorage Persistence
import {
  INITIAL_CATEGORIES,
  INITIAL_BRANDS,
  INITIAL_PRODUCTS,
  INITIAL_USERS,
  INITIAL_ADDRESSES,
  INITIAL_ORDERS,
  INITIAL_REVIEWS,
} from './mockData';

const DB_KEY = 'havie_api_v1_db';

const loadDb = () => {
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to parse database from localStorage', e);
  }
  const initial = {
    categories: INITIAL_CATEGORIES,
    brands: INITIAL_BRANDS,
    products: INITIAL_PRODUCTS,
    users: INITIAL_USERS,
    addresses: INITIAL_ADDRESSES,
    orders: INITIAL_ORDERS,
    reviews: INITIAL_REVIEWS,
    carts: {
      'usr-customer-1': [],
    },
    stockMovements: [],
  };
  saveDb(initial);
  return initial;
};

const saveDb = (db) => {
  try {
    localStorage.setItem(DB_KEY, JSON.stringify(db));
  } catch (e) {
    console.error('Failed to save database to localStorage', e);
  }
};

const delay = (ms = 120) => new Promise((resolve) => setTimeout(resolve, ms));

const generateUuid = () => 'id-' + Math.random().toString(36).substring(2, 9) + '-' + Date.now().toString(36);

export class MockApiError extends Error {
  constructor(status, code, message, details = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

class MockApiService {
  constructor() {
    this.tokenKey = 'havie_access_token';
  }

  getCurrentToken() {
    return localStorage.getItem(this.tokenKey);
  }

  setCurrentToken(token) {
    if (token) localStorage.setItem(this.tokenKey, token);
    else localStorage.removeItem(this.tokenKey);
  }

  getCurrentUser(db) {
    const token = this.getCurrentToken();
    if (!token) return null;
    const parts = token.split('.');
    const userId = parts[0];
    return db.users.find((u) => u.id === userId) || null;
  }

  requireAuth(db) {
    const user = this.getCurrentUser(db);
    if (!user) {
      throw new MockApiError(401, 'UNAUTHORIZED', 'Chưa đăng nhập hoặc token không hợp lệ.');
    }
    if (!user.isActive) {
      throw new MockApiError(403, 'ACCOUNT_DISABLED', 'Tài khoản của bạn đã bị khóa.');
    }
    return user;
  }

  requireAdmin(db) {
    const user = this.requireAuth(db);
    if (user.role !== 'ADMIN') {
      throw new MockApiError(403, 'FORBIDDEN', 'Bạn không có quyền quản trị viên.');
    }
    return user;
  }

  // --- 3.1 AUTH ---
  async register({ fullName, email, phone, password }) {
    await delay();
    const db = loadDb();
    if (!email || !password || !fullName) {
      throw new MockApiError(400, 'VALIDATION_ERROR', 'Vui lòng điền đầy đủ họ tên, email và mật khẩu.');
    }
    if (db.users.some((u) => u.email.toLowerCase() === email.toLowerCase())) {
      throw new MockApiError(409, 'EMAIL_ALREADY_EXISTS', 'Email này đã được sử dụng.');
    }
    const newUser = {
      id: generateUuid(),
      fullName: fullName.trim(),
      email: email.trim().toLowerCase(),
      phone: phone ? phone.trim() : '',
      role: 'CUSTOMER',
      isActive: true,
      password,
    };
    db.users.push(newUser);
    saveDb(db);

    const accessToken = `${newUser.id}.mockjwt.${Date.now()}`;
    this.setCurrentToken(accessToken);

    const { password: _, ...userSafe } = newUser;
    return {
      data: {
        user: userSafe,
        accessToken,
        expiresIn: 3600,
      },
    };
  }

  async login({ email, password }) {
    await delay();
    const db = loadDb();
    const user = db.users.find(
      (u) => u.email.toLowerCase() === (email || '').trim().toLowerCase() && u.password === password,
    );
    if (!user) {
      throw new MockApiError(401, 'INVALID_CREDENTIALS', 'Email hoặc mật khẩu không chính xác.');
    }
    if (!user.isActive) {
      throw new MockApiError(403, 'ACCOUNT_DISABLED', 'Tài khoản đã bị tạm khóa bởi quản trị viên.');
    }

    const accessToken = `${user.id}.mockjwt.${Date.now()}`;
    this.setCurrentToken(accessToken);

    const { password: _, ...userSafe } = user;
    return {
      data: {
        user: userSafe,
        accessToken,
        expiresIn: 3600,
      },
    };
  }

  async logout() {
    await delay(50);
    this.setCurrentToken(null);
    return { message: 'Đăng xuất thành công.' };
  }

  async getMe() {
    await delay();
    const db = loadDb();
    const user = this.requireAuth(db);
    const { password: _, ...userSafe } = user;
    return { data: userSafe };
  }

  async updateMe({ fullName, phone }) {
    await delay();
    const db = loadDb();
    const user = this.requireAuth(db);
    if (fullName) user.fullName = fullName.trim();
    if (phone !== undefined) user.phone = phone.trim();
    saveDb(db);
    const { password: _, ...userSafe } = user;
    return { data: userSafe, message: 'Cập nhật thông tin thành công.' };
  }

  // --- 3.2 ADDRESSES ---
  async getAddresses() {
    await delay();
    const db = loadDb();
    const user = this.requireAuth(db);
    const userAddresses = db.addresses.filter((a) => a.userId === user.id);
    return { data: userAddresses };
  }

  async addAddress(addr) {
    await delay();
    const db = loadDb();
    const user = this.requireAuth(db);
    if (addr.isDefault) {
      db.addresses.filter((a) => a.userId === user.id).forEach((a) => (a.isDefault = false));
    }
    const newAddr = {
      id: generateUuid(),
      userId: user.id,
      ...addr,
    };
    db.addresses.push(newAddr);
    saveDb(db);
    return { data: newAddr, message: 'Thêm địa chỉ thành công.' };
  }

  // --- 3.3 CATALOG ---
  async getCategories() {
    await delay(60);
    const db = loadDb();
    return { data: db.categories };
  }

  async getBrands() {
    await delay(60);
    const db = loadDb();
    return { data: db.brands };
  }

  async getProducts(params = {}) {
    await delay(100);
    const db = loadDb();
    let list = [...db.products];

    if (params.q) {
      const q = params.q.toLowerCase().trim();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q) ||
          p.category.name.toLowerCase().includes(q),
      );
    }
    if (params.category && params.category !== 'All') {
      list = list.filter(
        (p) =>
          p.category.slug === params.category ||
          p.category.name === params.category ||
          p.category.id === params.category,
      );
    }
    if (params.brand && params.brand !== 'All') {
      list = list.filter((p) => p.brand.slug === params.brand || p.brand.id === params.brand);
    }
    if (params.inStock === 'true' || params.inStock === true) {
      list = list.filter((p) => p.variants.some((v) => v.isAvailable && v.stockQuantity > 0));
    }

    // Sort
    const sort = params.sort || 'featured';
    if (sort === 'price_asc' || sort === 'price-low') {
      list.sort((a, b) => (a.variants[0]?.price || 0) - (b.variants[0]?.price || 0));
    } else if (sort === 'price_desc' || sort === 'price-high') {
      list.sort((a, b) => (b.variants[0]?.price || 0) - (a.variants[0]?.price || 0));
    } else if (sort === 'rating_desc' || sort === 'rating') {
      list.sort((a, b) => b.ratingAverage - a.ratingAverage);
    }

    const page = parseInt(params.page || 1, 10);
    const pageSize = parseInt(params.pageSize || 20, 10);
    const total = list.length;
    const totalPages = Math.ceil(total / pageSize) || 1;
    const paged = list.slice((page - 1) * pageSize, page * pageSize);

    return {
      data: paged,
      meta: {
        page,
        pageSize,
        total,
        totalPages,
      },
    };
  }

  async getProductBySlug(slugOrId) {
    await delay(80);
    const db = loadDb();
    const product = db.products.find(
      (p) => p.slug === slugOrId || p.id === slugOrId || String(p.id) === String(slugOrId),
    );
    if (!product) {
      throw new MockApiError(404, 'NOT_FOUND', 'Không tìm thấy sản phẩm.');
    }
    return { data: product };
  }

  async getProductReviews(slugOrId, params = {}) {
    await delay(60);
    const db = loadDb();
    const product = db.products.find(
      (p) => p.slug === slugOrId || p.id === slugOrId || String(p.id) === String(slugOrId),
    );
    if (!product) return { data: [], meta: { page: 1, pageSize: 10, total: 0, totalPages: 0 } };
    const reviews = db.reviews.filter((r) => r.productId === product.id && r.isVisible);
    return {
      data: reviews,
      meta: {
        page: 1,
        pageSize: 20,
        total: reviews.length,
        totalPages: 1,
      },
    };
  }

  // --- 3.4 CART ---
  async getCart() {
    await delay(60);
    const db = loadDb();
    const user = this.getCurrentUser(db);
    const cartKey = user ? user.id : 'guest';
    const items = db.carts[cartKey] || [];

    // Hydrate items with fresh variant and product details
    const hydrated = items
      .map((item) => {
        let foundVariant = null;
        let foundProduct = null;
        for (const p of db.products) {
          const v = p.variants.find((x) => x.id === item.variantId);
          if (v) {
            foundVariant = v;
            foundProduct = p;
            break;
          }
        }
        if (!foundVariant || !foundProduct) return null;
        return {
          id: item.id,
          variantId: item.variantId,
          quantity: item.quantity,
          variant: foundVariant,
          product: {
            id: foundProduct.id,
            name: foundProduct.name,
            slug: foundProduct.slug,
            imageUrls: foundProduct.imageUrls,
            category: foundProduct.category,
          },
        };
      })
      .filter(Boolean);

    return {
      data: {
        items: hydrated,
      },
    };
  }

  async addToCart({ variantId, quantity = 1 }) {
    await delay(80);
    const db = loadDb();
    const user = this.getCurrentUser(db);
    const cartKey = user ? user.id : 'guest';

    if (!db.carts[cartKey]) db.carts[cartKey] = [];

    // Find variant in database
    let variant = null;
    for (const p of db.products) {
      const v = p.variants.find((x) => x.id === variantId);
      if (v) {
        variant = v;
        break;
      }
    }

    if (!variant || !variant.isAvailable) {
      throw new MockApiError(404, 'NOT_FOUND', 'Biến thể sản phẩm không tồn tại hoặc đã ngừng bán.');
    }

    const currentItem = db.carts[cartKey].find((it) => it.variantId === variantId);
    const targetQty = (currentItem ? currentItem.quantity : 0) + quantity;

    if (targetQty > variant.stockQuantity) {
      throw new MockApiError(409, 'INSUFFICIENT_STOCK', 'Số lượng tồn kho không đủ.', {
        available: variant.stockQuantity,
      });
    }

    if (currentItem) {
      currentItem.quantity = targetQty;
    } else {
      db.carts[cartKey].push({
        id: generateUuid(),
        variantId,
        quantity,
      });
    }

    saveDb(db);
    return this.getCart();
  }

  async updateCartItem(itemId, { quantity }) {
    await delay(60);
    const db = loadDb();
    const user = this.getCurrentUser(db);
    const cartKey = user ? user.id : 'guest';
    const items = db.carts[cartKey] || [];

    if (quantity <= 0) {
      db.carts[cartKey] = items.filter((it) => it.id !== itemId);
    } else {
      const item = items.find((it) => it.id === itemId);
      if (item) {
        // Check stock
        for (const p of db.products) {
          const v = p.variants.find((x) => x.id === item.variantId);
          if (v && quantity > v.stockQuantity) {
            throw new MockApiError(409, 'INSUFFICIENT_STOCK', `Chỉ còn ${v.stockQuantity} sản phẩm trong kho.`, {
              available: v.stockQuantity,
            });
          }
        }
        item.quantity = quantity;
      }
    }

    saveDb(db);
    return this.getCart();
  }

  async removeCartItem(itemId) {
    return this.updateCartItem(itemId, { quantity: 0 });
  }

  // --- 3.5 ORDERS & CHECKOUT ---
  async createOrder({ addressId, recipientName, recipientPhone, shippingAddress, paymentMethod = 'COD', customerNote = '' }) {
    await delay(120);
    const db = loadDb();
    const user = this.requireAuth(db);
    const cartKey = user.id;
    const cartItems = db.carts[cartKey] || [];

    if (!cartItems.length) {
      throw new MockApiError(400, 'CART_EMPTY', 'Giỏ hàng của bạn đang trống.');
    }

    // Determine final address
    let fullAddress = '';
    let name = recipientName;
    let phone = recipientPhone;

    if (addressId) {
      const addr = db.addresses.find((a) => a.id === addressId && a.userId === user.id);
      if (!addr) throw new MockApiError(404, 'ADDRESS_NOT_FOUND', 'Không tìm thấy địa chỉ đã chọn.');
      fullAddress = `${addr.streetAddress}, ${addr.ward}, ${addr.district}, ${addr.province}`;
      name = addr.recipientName;
      phone = addr.phone;
    } else if (shippingAddress) {
      fullAddress = typeof shippingAddress === 'string'
        ? shippingAddress
        : `${shippingAddress.streetAddress}, ${shippingAddress.ward}, ${shippingAddress.district}, ${shippingAddress.province}`;
    }

    if (!name || !phone || !fullAddress) {
      throw new MockApiError(400, 'VALIDATION_ERROR', 'Vui lòng cung cấp đầy đủ thông tin người nhận và địa chỉ giao hàng.');
    }

    // Validate inventory and calculate prices from DB (Rule: frontend cannot dictate price)
    let subtotal = 0;
    const orderItems = [];

    for (const item of cartItems) {
      let foundVariant = null;
      let foundProduct = null;
      for (const p of db.products) {
        const v = p.variants.find((x) => x.id === item.variantId);
        if (v) {
          foundVariant = v;
          foundProduct = p;
          break;
        }
      }

      if (!foundVariant || foundVariant.stockQuantity < item.quantity) {
        throw new MockApiError(409, 'INSUFFICIENT_STOCK', `Sản phẩm "${foundProduct?.name || ''}" không đủ số lượng tồn kho.`);
      }

      // Deduct stock in transaction
      foundVariant.stockQuantity -= item.quantity;
      db.stockMovements.push({
        id: generateUuid(),
        variantId: foundVariant.id,
        quantityDelta: -item.quantity,
        stockAfter: foundVariant.stockQuantity,
        reason: 'ORDER_PLACED',
        timestamp: new Date().toISOString(),
      });

      subtotal += foundVariant.price * item.quantity;
      orderItems.push({
        id: generateUuid(),
        variantId: foundVariant.id,
        productName: foundProduct.name,
        variantName: foundVariant.name,
        sku: foundVariant.sku,
        unitPrice: foundVariant.price,
        quantity: item.quantity,
        imageUrl: foundProduct.imageUrls[0],
      });
    }

    const shippingFee = 30000;
    const discountAmount = 0;
    const totalAmount = subtotal + shippingFee - discountAmount;
    const orderCode = `HV-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`;

    const newOrder = {
      id: generateUuid(),
      orderCode,
      userId: user.id,
      recipientName: name,
      recipientPhone: phone,
      shippingAddress: fullAddress,
      status: paymentMethod === 'MOCK_QR' ? 'PENDING_PAYMENT' : 'PENDING_CONFIRMATION',
      paymentMethod,
      paymentStatus: paymentMethod === 'MOCK_QR' ? 'PENDING' : 'PENDING',
      subtotal,
      shippingFee,
      discountAmount,
      totalAmount,
      customerNote,
      items: orderItems,
      createdAt: new Date().toISOString(),
    };

    if (paymentMethod === 'MOCK_QR') {
      newOrder.payment = {
        id: generateUuid(),
        amount: totalAmount,
        qrData: `vietqr://havie-store?amount=${totalAmount}&orderCode=${orderCode}`,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      };
    }

    db.orders.unshift(newOrder);
    // Clear cart in transaction
    db.carts[cartKey] = [];
    saveDb(db);

    return { data: newOrder, message: 'Đặt hàng thành công!' };
  }

  async getMyOrders(params = {}) {
    await delay(80);
    const db = loadDb();
    const user = this.requireAuth(db);
    let list = db.orders.filter((o) => o.userId === user.id);
    if (params.status) {
      list = list.filter((o) => o.status === params.status);
    }
    return {
      data: list,
      meta: {
        page: 1,
        pageSize: 50,
        total: list.length,
        totalPages: 1,
      },
    };
  }

  async cancelOrder(orderId, { reason }) {
    await delay(100);
    const db = loadDb();
    const user = this.requireAuth(db);
    const order = db.orders.find((o) => o.id === orderId && (o.userId === user.id || user.role === 'ADMIN'));

    if (!order) {
      throw new MockApiError(404, 'ORDER_NOT_FOUND', 'Không tìm thấy đơn hàng.');
    }

    if (['SHIPPING', 'COMPLETED', 'CANCELLED'].includes(order.status)) {
      throw new MockApiError(409, 'ORDER_CANNOT_BE_CANCELLED', 'Đơn hàng không thể hủy ở trạng thái hiện tại.');
    }

    // Return stock once
    for (const item of order.items) {
      for (const p of db.products) {
        const v = p.variants.find((x) => x.id === item.variantId);
        if (v) {
          v.stockQuantity += item.quantity;
          db.stockMovements.push({
            id: generateUuid(),
            variantId: v.id,
            quantityDelta: item.quantity,
            stockAfter: v.stockQuantity,
            reason: 'ORDER_CANCELLED',
            timestamp: new Date().toISOString(),
          });
        }
      }
    }

    if (order.paymentStatus === 'PAID') {
      order.status = 'REFUND_PENDING';
      order.paymentStatus = 'REFUND_PENDING';
    } else {
      order.status = 'CANCELLED';
    }
    order.cancelReason = reason || 'Khách yêu cầu hủy';
    order.cancelledAt = new Date().toISOString();

    saveDb(db);
    return { data: order, message: 'Đã hủy đơn hàng thành công.' };
  }

  // Simulated QR confirmation
  async simulateQrPaymentSuccess(orderId) {
    await delay(100);
    const db = loadDb();
    const order = db.orders.find((o) => o.id === orderId);
    if (!order) throw new MockApiError(404, 'ORDER_NOT_FOUND', 'Không tìm thấy đơn hàng.');
    order.status = 'PENDING_CONFIRMATION';
    order.paymentStatus = 'PAID';
    if (order.payment) {
      order.payment.status = 'PAID';
      order.payment.paidAt = new Date().toISOString();
    }
    saveDb(db);
    return { data: order, message: 'Thanh toán QR thành công!' };
  }

  // --- 3.6 REVIEWS ---
  async createReview({ orderId, productId, rating, comment }) {
    await delay(100);
    const db = loadDb();
    const user = this.requireAuth(db);
    const order = db.orders.find((o) => o.id === orderId && o.userId === user.id);

    if (!order || order.status !== 'COMPLETED') {
      throw new MockApiError(400, 'VALIDATION_ERROR', 'Chỉ có thể đánh giá sản phẩm từ đơn hàng đã hoàn thành.');
    }

    const hasProduct = order.items.some((it) => it.variantId && db.products.find((p) => p.id === productId)?.variants.some((v) => v.id === it.variantId));
    if (!hasProduct) {
      throw new MockApiError(400, 'VALIDATION_ERROR', 'Sản phẩm này không nằm trong đơn hàng đã chọn.');
    }

    const newRev = {
      id: generateUuid(),
      productId,
      userId: user.id,
      userName: user.fullName,
      rating: Number(rating) || 5,
      comment: (comment || '').trim(),
      createdAt: new Date().toISOString(),
      isVisible: true,
    };

    db.reviews.unshift(newRev);

    // Update ratingAverage in product
    const p = db.products.find((x) => x.id === productId);
    if (p) {
      const revs = db.reviews.filter((r) => r.productId === productId && r.isVisible);
      const avg = revs.reduce((s, r) => s + r.rating, 0) / revs.length;
      p.ratingAverage = Number(avg.toFixed(1));
      p.reviewCount = revs.length;
    }

    saveDb(db);
    return { data: newRev, message: 'Đăng đánh giá thành công.' };
  }

  // --- 4. ADMIN API ---
  async adminGetProducts() {
    await delay();
    const db = loadDb();
    this.requireAdmin(db);
    return { data: db.products };
  }

  async adminGetOrders() {
    await delay();
    const db = loadDb();
    this.requireAdmin(db);
    return { data: db.orders };
  }

  async adminUpdateOrderStatus(orderId, status, note = '') {
    await delay(100);
    const db = loadDb();
    this.requireAdmin(db);
    const order = db.orders.find((o) => o.id === orderId);
    if (!order) throw new MockApiError(404, 'ORDER_NOT_FOUND', 'Không tìm thấy đơn hàng.');

    order.status = status;
    if (status === 'COMPLETED' && order.paymentMethod === 'COD' && order.paymentStatus !== 'PAID') {
      order.paymentStatus = 'PAID';
    }
    order.adminNote = note;
    saveDb(db);
    return { data: order, message: `Cập nhật trạng thái sang ${status} thành công.` };
  }

  async adminRecordCodPayment(orderId) {
    await delay(80);
    const db = loadDb();
    this.requireAdmin(db);
    const order = db.orders.find((o) => o.id === orderId);
    if (!order) throw new MockApiError(404, 'ORDER_NOT_FOUND', 'Không tìm thấy đơn hàng.');
    order.paymentStatus = 'PAID';
    saveDb(db);
    return { data: order, message: 'Ghi nhận thu tiền COD thành công.' };
  }

  async adminGetCustomers() {
    await delay();
    const db = loadDb();
    this.requireAdmin(db);
    const customers = db.users
      .filter((u) => u.role === 'CUSTOMER')
      .map(({ password: _, ...rest }) => ({
        ...rest,
        orderCount: db.orders.filter((o) => o.userId === rest.id).length,
      }));
    return { data: customers };
  }

  async adminUpdateCustomerStatus(customerId, isActive, reason = '') {
    await delay(100);
    const db = loadDb();
    this.requireAdmin(db);
    const cust = db.users.find((u) => u.id === customerId);
    if (!cust) throw new MockApiError(404, 'CUSTOMER_NOT_FOUND', 'Không tìm thấy khách hàng.');
    cust.isActive = isActive;
    cust.statusReason = reason;
    saveDb(db);
    const { password: _, ...safeCust } = cust;
    return { data: safeCust, message: isActive ? 'Mở khóa khách hàng thành công.' : 'Khóa tài khoản thành công.' };
  }

  async adminGetInventory() {
    await delay();
    const db = loadDb();
    this.requireAdmin(db);
    const inventory = [];
    db.products.forEach((p) => {
      p.variants.forEach((v) => {
        inventory.push({
          productId: p.id,
          productName: p.name,
          categoryName: p.category.name,
          variantId: v.id,
          variantName: v.name,
          sku: v.sku,
          price: v.price,
          stockQuantity: v.stockQuantity,
          lowStockThreshold: 8,
          isLowStock: v.stockQuantity <= 8,
        });
      });
    });
    return { data: inventory };
  }

  async adminAdjustStock({ variantId, quantityDelta, reason }) {
    await delay(100);
    const db = loadDb();
    this.requireAdmin(db);
    let foundVariant = null;
    for (const p of db.products) {
      const v = p.variants.find((x) => x.id === variantId);
      if (v) {
        foundVariant = v;
        break;
      }
    }
    if (!foundVariant) throw new MockApiError(404, 'VARIANT_NOT_FOUND', 'Không tìm thấy biến thể sản phẩm.');

    const newStock = foundVariant.stockQuantity + Number(quantityDelta);
    if (newStock < 0) {
      throw new MockApiError(400, 'INVALID_STOCK', 'Tồn kho không được nhỏ hơn 0.');
    }

    foundVariant.stockQuantity = newStock;
    db.stockMovements.push({
      id: generateUuid(),
      variantId,
      quantityDelta: Number(quantityDelta),
      stockAfter: newStock,
      reason: reason || 'Kiểm kê thực tế',
      timestamp: new Date().toISOString(),
    });

    saveDb(db);
    return { data: foundVariant, message: 'Điều chỉnh tồn kho thành công.' };
  }

  async adminGetDashboard(from, to) {
    await delay();
    const db = loadDb();
    this.requireAdmin(db);

    const paidOrders = db.orders.filter(
      (o) => (o.status === 'COMPLETED' || o.paymentStatus === 'PAID') && o.status !== 'CANCELLED',
    );
    const totalRevenue = paidOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
    const pendingOrdersCount = db.orders.filter((o) => ['PENDING_PAYMENT', 'PENDING_CONFIRMATION'].includes(o.status)).length;
    const shippingOrdersCount = db.orders.filter((o) => o.status === 'SHIPPING').length;
    const completedOrdersCount = db.orders.filter((o) => o.status === 'COMPLETED').length;

    let lowStockCount = 0;
    db.products.forEach((p) => {
      p.variants.forEach((v) => {
        if (v.stockQuantity <= 8) lowStockCount++;
      });
    });

    return {
      data: {
        totalRevenue,
        totalOrders: db.orders.length,
        pendingOrdersCount,
        shippingOrdersCount,
        completedOrdersCount,
        lowStockCount,
        totalProducts: db.products.length,
        totalCustomers: db.users.filter((u) => u.role === 'CUSTOMER').length,
        recentOrders: db.orders.slice(0, 10),
      },
    };
  }
}

export const mockApi = new MockApiService();

