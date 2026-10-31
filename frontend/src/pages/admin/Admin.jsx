import React from 'react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Package, ClipboardList, LogOut, ShieldAlert } from 'lucide-react';
import { money } from '../../data';
import { adminApi, catalogApi, ORDER_STATUS_LABELS, PAYMENT_METHOD_LABELS } from '../../api';
import { useStore } from '../../context/StoreContext.jsx';

const EMPTY_PRODUCT_FORM = {
  name: '',
  slug: '',
  description: '',
  categoryId: '',
  brandId: '',
  imageUrls: '',
  specs: '',
  badge: '',
  isActive: true,
  variants: [],
};

const ORDER_NEXT_STATUSES = {
  PENDING_CONFIRMATION: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['SHIPPING', 'CANCELLED'],
  SHIPPING: ['COMPLETED'],
};

function createProductForm(product) {
  if (!product) {
    return {
      ...EMPTY_PRODUCT_FORM,
      variants: [
        {
          sku: '',
          name: '',
          attributes: '{}',
          price: '',
          oldPrice: '',
          stockQuantity: '0',
          isAvailable: true,
        },
      ],
    };
  }
  return {
    name: product.name,
    slug: product.slug,
    description: product.description || '',
    categoryId: product.categoryId,
    brandId: product.brandId,
    imageUrls: (product.imageUrls || []).join('\n'),
    specs: (product.specs || []).join('\n'),
    badge: product.badge || '',
    isActive: product.isActive,
    variants: product.variants.map((variant) => ({
      id: variant.id,
      sku: variant.sku,
      name: variant.name,
      attributes: JSON.stringify(variant.attributes || {}, null, 2),
      price: String(variant.price),
      oldPrice: variant.oldPrice === null ? '' : String(variant.oldPrice),
      stockQuantity: String(variant.stockQuantity),
      isAvailable: variant.isAvailable,
    })),
  };
}

export default function Admin() {
  const { account } = useStore();
  const [tab, setTab] = useState('Orders');
  const [adminOrders, setAdminOrders] = useState([]);
  const [adminProducts, setAdminProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [productForm, setProductForm] = useState(EMPTY_PRODUCT_FORM);
  const [pageError, setPageError] = useState('');
  const [productError, setProductError] = useState('');
  const [savingProduct, setSavingProduct] = useState(false);

  const reloadData = async () => {
    try {
      setLoading(true);
      setPageError('');
      const [ords, prods, categoryList, brandList] = await Promise.all([
        adminApi.getOrders(),
        adminApi.getProducts(),
        catalogApi.getCategories(),
        catalogApi.getBrands(),
      ]);
      setAdminOrders(ords || []);
      setAdminProducts(prods || []);
      setCategories(categoryList || []);
      setBrands(brandList || []);
    } catch (e) {
      setPageError(e.message || 'Không thể tải dữ liệu quản trị.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (account?.role === 'ADMIN') {
      reloadData();
    }
  }, [account]);

  if (!account || account.role !== 'ADMIN') {
    return (
      <div className="container page-pad empty-state">
        <ShieldAlert size={56} color="var(--danger)" />
        <h1>Yêu cầu quyền Quản trị viên (ADMIN)</h1>
        <p>Tài khoản Admin chỉ được tạo cho email nằm trong danh sách được cho phép.</p>
        <div className="mt-5">
          <Link to="/auth" className="btn btn-primary">
            ĐẾN TRANG ĐĂNG NHẬP
          </Link>
        </div>
      </div>
    );
  }

  const handleUpdateStatus = async (orderId, newStatus) => {
    const reason = newStatus === 'CANCELLED' ? prompt('Vui lòng nhập lý do hủy đơn:') : undefined;
    if (newStatus === 'CANCELLED' && !reason?.trim()) {
      await reloadData();
      return;
    }
    try {
      await adminApi.updateOrderStatus(orderId, newStatus, reason?.trim());
      await reloadData();
    } catch (err) {
      alert(err.message || 'Lỗi cập nhật trạng thái đơn.');
      await reloadData();
    }
  };

  const nav = [
    ['Orders', ClipboardList],
    ['Products', Package],
  ];

  const openProductForm = (product = null) => {
    setEditingProduct(product);
    setProductForm(createProductForm(product));
    setProductError('');
    setProductModalOpen(true);
  };

  const handleSaveProduct = async (event) => {
    event.preventDefault();
    setProductError('');
    let variants;
    try {
      variants = productForm.variants.map((variant) => ({
        ...(variant.id ? { id: variant.id } : {}),
        sku: variant.sku.trim(),
        name: variant.name.trim(),
        attributes: JSON.parse(variant.attributes || '{}'),
        price: Number(variant.price),
        oldPrice: variant.oldPrice === '' ? null : Number(variant.oldPrice),
        stockQuantity: Number(variant.stockQuantity),
        isAvailable: variant.isAvailable,
      }));
    } catch {
      setProductError('Thuộc tính mỗi biến thể phải là JSON hợp lệ.');
      return;
    }

    const payload = {
      name: productForm.name.trim(),
      slug: productForm.slug.trim(),
      description: productForm.description.trim() || null,
      categoryId: productForm.categoryId,
      brandId: productForm.brandId,
      imageUrls: productForm.imageUrls
        .split(/\r?\n/)
        .map((value) => value.trim())
        .filter(Boolean),
      specs: productForm.specs
        .split(/\r?\n/)
        .map((value) => value.trim())
        .filter(Boolean),
      badge: productForm.badge.trim() || null,
      isActive: productForm.isActive,
      variants,
    };

    try {
      setSavingProduct(true);
      if (editingProduct) {
        await adminApi.updateProduct(editingProduct.id, payload);
      } else {
        await adminApi.createProduct(payload);
      }
      setProductModalOpen(false);
      await reloadData();
    } catch (err) {
      setProductError(err.message || 'Không thể lưu sản phẩm.');
    } finally {
      setSavingProduct(false);
    }
  };

  const updateProductField = (field, value) =>
    setProductForm((current) => ({ ...current, [field]: value }));

  const updateVariantField = (index, field, value) =>
    setProductForm((current) => ({
      ...current,
      variants: current.variants.map((variant, variantIndex) =>
        variantIndex === index ? { ...variant, [field]: value } : variant,
      ),
    }));

  return (
    <div className="admin-app">
      <aside className="admin-sidebar">
        <Link to="/" className="admin-brand">
          HAVIE.<small>ADMIN STUDIO v1</small>
        </Link>
        <nav aria-label="Điều hướng quản trị">
          {nav.map(([label, Icon]) => (
            <button
              key={label}
              className={tab === label ? 'active' : ''}
              onClick={() => setTab(label)}
            >
              <Icon size={20} />
              {label}
            </button>
          ))}
        </nav>
        <Link to="/" className="admin-exit">
          <LogOut size={19} /> Về trang bán hàng
        </Link>
      </aside>

      <main className="admin-main">
        <header className="admin-top">
          <span>STORE MANAGEMENT / {tab.toUpperCase()}</span>
          <strong>
            {account.fullName} <span className="admin-avatar">A</span>
          </strong>
        </header>

        <div className="admin-content">
          <div className="admin-title">
            <div>
              <span className="eyebrow">API CONTRACT V1 BACKOFFICE</span>
              <h1>
                {tab}
                <span className="dot">.</span>
              </h1>
            </div>
            {tab === 'Products' && (
              <button className="btn btn-primary" onClick={() => openProductForm()}>
                THÊM SẢN PHẨM
              </button>
            )}
          </div>

          {pageError && (
            <p className="my-4 text-[var(--danger)]" role="alert">
              {pageError}{' '}
              <button className="btn-mini" onClick={reloadData}>
                Thử tải lại
              </button>
            </p>
          )}
          {loading && <p role="status">Đang tải dữ liệu quản trị...</p>}

          {productModalOpen && (
            <div className="qr-overlay">
              <div className="qr-modal max-h-[90vh] max-w-[760px] overflow-y-auto text-left">
                <h2>{editingProduct ? 'CẬP NHẬT SẢN PHẨM' : 'THÊM SẢN PHẨM'}</h2>
                <form onSubmit={handleSaveProduct}>
                  <div className="grid gap-3 md:grid-cols-2">
                    <label className="block">
                      TÊN SẢN PHẨM
                      <input
                        required
                        maxLength={200}
                        value={productForm.name}
                        onChange={(event) => updateProductField('name', event.target.value)}
                      />
                    </label>
                    <label className="block">
                      SLUG
                      <input
                        required
                        maxLength={200}
                        value={productForm.slug}
                        onChange={(event) => updateProductField('slug', event.target.value)}
                      />
                    </label>
                    <label className="block">
                      DANH MỤC
                      <select
                        required
                        value={productForm.categoryId}
                        onChange={(event) => updateProductField('categoryId', event.target.value)}
                      >
                        <option value="">Chọn danh mục</option>
                        {categories.map((category) => (
                          <option key={category.id} value={category.id}>
                            {category.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="block">
                      THƯƠNG HIỆU
                      <select
                        required
                        value={productForm.brandId}
                        onChange={(event) => updateProductField('brandId', event.target.value)}
                      >
                        <option value="">Chọn thương hiệu</option>
                        {brands.map((brand) => (
                          <option key={brand.id} value={brand.id}>
                            {brand.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="block">
                      NHÃN
                      <input
                        maxLength={100}
                        value={productForm.badge}
                        onChange={(event) => updateProductField('badge', event.target.value)}
                        placeholder="Ví dụ: BEST SELLER"
                      />
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={productForm.isActive}
                        onChange={(event) => updateProductField('isActive', event.target.checked)}
                      />
                      Đang kinh doanh
                    </label>
                  </div>

                  <label className="mt-3 block">
                    MÔ TẢ
                    <textarea
                      rows={3}
                      value={productForm.description}
                      onChange={(event) => updateProductField('description', event.target.value)}
                    />
                  </label>
                  <label className="mt-3 block">
                    ẢNH (MỖI URL MỘT DÒNG)
                    <textarea
                      rows={2}
                      value={productForm.imageUrls}
                      onChange={(event) => updateProductField('imageUrls', event.target.value)}
                    />
                  </label>
                  <label className="mt-3 block">
                    THÔNG SỐ (MỖI DÒNG MỘT THÔNG SỐ)
                    <textarea
                      rows={3}
                      value={productForm.specs}
                      onChange={(event) => updateProductField('specs', event.target.value)}
                    />
                  </label>

                  <div className="mt-5 flex items-center justify-between">
                    <h3>BIẾN THỂ VÀ GIÁ</h3>
                    <button
                      type="button"
                      className="btn-mini"
                      onClick={() =>
                        setProductForm((current) => ({
                          ...current,
                          variants: [
                            ...current.variants,
                            {
                              sku: '',
                              name: '',
                              attributes: '{}',
                              price: '',
                              oldPrice: '',
                              stockQuantity: '0',
                              isAvailable: true,
                            },
                          ],
                        }))
                      }
                    >
                      THÊM BIẾN THỂ
                    </button>
                  </div>
                  {productForm.variants.map((variant, index) => (
                    <fieldset key={variant.id || index} className="mt-3 rounded border p-3">
                      <legend>Biến thể {index + 1}</legend>
                      <div className="grid gap-3 md:grid-cols-2">
                        <label className="block">
                          SKU
                          <input
                            required
                            value={variant.sku}
                            onChange={(event) =>
                              updateVariantField(index, 'sku', event.target.value)
                            }
                          />
                        </label>
                        <label className="block">
                          TÊN BIẾN THỂ
                          <input
                            required
                            value={variant.name}
                            onChange={(event) =>
                              updateVariantField(index, 'name', event.target.value)
                            }
                          />
                        </label>
                        <label className="block">
                          GIÁ BÁN (VND)
                          <input
                            required
                            min="1"
                            step="1"
                            type="number"
                            value={variant.price}
                            onChange={(event) =>
                              updateVariantField(index, 'price', event.target.value)
                            }
                          />
                        </label>
                        <label className="block">
                          GIÁ CŨ (VND)
                          <input
                            min="1"
                            step="1"
                            type="number"
                            value={variant.oldPrice}
                            onChange={(event) =>
                              updateVariantField(index, 'oldPrice', event.target.value)
                            }
                          />
                        </label>
                        <label className="block">
                          TỒN KHO BAN ĐẦU / HIỆN TẠI
                          <input
                            required
                            min="0"
                            step="1"
                            type="number"
                            value={variant.stockQuantity}
                            onChange={(event) =>
                              updateVariantField(index, 'stockQuantity', event.target.value)
                            }
                          />
                        </label>
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={variant.isAvailable}
                            onChange={(event) =>
                              updateVariantField(index, 'isAvailable', event.target.checked)
                            }
                          />
                          Cho phép bán biến thể
                        </label>
                      </div>
                      <label className="mt-3 block">
                        THUỘC TÍNH DẠNG JSON
                        <textarea
                          rows={2}
                          value={variant.attributes}
                          onChange={(event) =>
                            updateVariantField(index, 'attributes', event.target.value)
                          }
                        />
                      </label>
                      {productForm.variants.length > 1 && (
                        <button
                          type="button"
                          className="btn-mini mt-2"
                          onClick={() =>
                            setProductForm((current) => ({
                              ...current,
                              variants: current.variants.filter(
                                (_, variantIndex) => variantIndex !== index,
                              ),
                            }))
                          }
                        >
                          GỠ BIẾN THỂ
                        </button>
                      )}
                    </fieldset>
                  ))}

                  {productError && (
                    <p className="mt-3 text-[var(--danger)]" role="alert">
                      {productError}
                    </p>
                  )}
                  <div className="mt-5 flex gap-3">
                    <button type="submit" className="btn btn-primary" disabled={savingProduct}>
                      {savingProduct ? 'ĐANG LƯU...' : 'LƯU SẢN PHẨM'}
                    </button>
                    <button
                      type="button"
                      className="btn btn-outline"
                      onClick={() => setProductModalOpen(false)}
                      disabled={savingProduct}
                    >
                      HỦY
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {tab === 'Orders' && (
            <section className="admin-panel orders-panel">
              <div className="panel-title">
                <h2>Quản lý toàn bộ đơn hàng</h2>
                <span>{adminOrders.length} ĐƠN HÀNG</span>
              </div>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>MÃ ĐƠN</th>
                      <th>NGÀY</th>
                      <th>KHÁCH HÀNG</th>
                      <th>ĐỊA CHỈ</th>
                      <th>TỔNG TIỀN</th>
                      <th>THANH TOÁN</th>
                      <th>CHUYỂN TRẠNG THÁI</th>
                      <th>THAO TÁC</th>
                    </tr>
                  </thead>
                  <tbody>
                    {adminOrders.map((o) => (
                      <tr key={o.id}>
                        <td>
                          <strong>{o.orderCode}</strong>
                        </td>
                        <td>{new Date(o.createdAt).toLocaleDateString('vi-VN')}</td>
                        <td>
                          {o.recipientName}
                          <br />
                          <small>{o.recipientPhone}</small>
                        </td>
                        <td className="max-w-[200px] text-xs">{o.shippingAddress}</td>
                        <td>
                          <strong>{money(o.totalAmount)}</strong>
                        </td>
                        <td>
                          {PAYMENT_METHOD_LABELS[o.paymentMethod] || o.paymentMethod} •{' '}
                          <span className={'status-badge ' + o.paymentStatus}>
                            {o.paymentStatus}
                          </span>
                        </td>
                        <td>
                          <select
                            value={o.status}
                            aria-label={`Trạng thái đơn ${o.orderCode}`}
                            onChange={(e) => handleUpdateStatus(o.id, e.target.value)}
                          >
                            <option value={o.status}>
                              {ORDER_STATUS_LABELS[o.status] || o.status}
                            </option>
                            {(ORDER_NEXT_STATUSES[o.status] || []).map((status) => (
                              <option key={status} value={status}>
                                {ORDER_STATUS_LABELS[status] || status}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td>{o.cancelReason && <small>Lý do hủy: {o.cancelReason}</small>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {tab === 'Products' && (
            <section className="admin-panel">
              <div className="panel-title">
                <h2>Quản lý sản phẩm & biến thể</h2>
                <span>{adminProducts.length} SẢN PHẨM</span>
              </div>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>SẢN PHẨM</th>
                      <th>DANH MỤC</th>
                      <th>THƯƠNG HIỆU</th>
                      <th>BIẾN THỂ (VARIANTS)</th>
                      <th>TRẠNG THÁI</th>
                      <th>THAO TÁC</th>
                    </tr>
                  </thead>
                  <tbody>
                    {adminProducts.map((p) => (
                      <tr key={p.id}>
                        <td>
                          <strong>{p.name}</strong>
                          <small className="block text-[var(--muted)]">{p.slug}</small>
                        </td>
                        <td>{p.category?.name}</td>
                        <td>{p.brand?.name}</td>
                        <td>
                          {p.variants.map((v) => (
                            <div key={v.id} className="my-0.5 text-xs">
                              • {v.name} ({v.sku}): <strong>{money(v.price)}</strong> (Kho:{' '}
                              {v.stockQuantity}) {v.isAvailable ? '' : '— Ngừng bán'}
                            </div>
                          ))}
                        </td>
                        <td>
                          <span
                            className={'status-badge ' + (p.isActive ? 'COMPLETED' : 'CANCELLED')}
                          >
                            {p.isActive ? 'Đang kinh doanh' : 'Đã ẩn'}
                          </span>
                        </td>
                        <td>
                          <button className="btn-mini" onClick={() => openProductForm(p)}>
                            Sửa
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </div>
      </main>
    </div>
  );
}
