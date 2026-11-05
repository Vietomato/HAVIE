import React from 'react';
import { useEffect, useState } from 'react';
import { ImagePlus, Plus, Star, Trash2, X } from 'lucide-react';
import { adminApi } from '../../api';
import Modal from '../../components/Modal.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { slugify } from '../../utils/product';

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

const EMPTY_VARIANT = {
  sku: '',
  name: '',
  attributes: '{}',
  price: '',
  oldPrice: '',
  stockQuantity: '0',
  isAvailable: true,
};

function createProductForm(product) {
  if (!product) {
    return {
      name: '',
      slug: '',
      description: '',
      categoryId: '',
      brandId: '',
      imageUrls: [],
      specs: '',
      badge: '',
      isActive: true,
      variants: [{ ...EMPTY_VARIANT }],
    };
  }
  return {
    name: product.name,
    slug: product.slug,
    description: product.description || '',
    categoryId: product.categoryId,
    brandId: product.brandId,
    imageUrls: product.imageUrls || [],
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

export default function ProductFormModal({ open, product, categories, brands, onClose, onSaved }) {
  const { notify } = useToast();
  const [form, setForm] = useState(() => createProductForm(product));
  const [initialForm, setInitialForm] = useState(form);
  const [slugEdited, setSlugEdited] = useState(Boolean(product));
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [formError, setFormError] = useState('');
  const [imageError, setImageError] = useState('');
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  useEffect(() => {
    if (!open) return;
    const nextForm = createProductForm(product);
    setForm(nextForm);
    setInitialForm(nextForm);
    setSlugEdited(Boolean(product));
    setFormError('');
    setImageError('');
    setConfirmDiscard(false);
  }, [open, product]);

  const busy = saving || uploading;
  const requestClose = () => {
    if (JSON.stringify(form) !== JSON.stringify(initialForm)) setConfirmDiscard(true);
    else onClose();
  };

  const updateField = (field, value) => setForm((current) => ({ ...current, [field]: value }));

  const updateVariant = (index, field, value) =>
    setForm((current) => ({
      ...current,
      variants: current.variants.map((variant, variantIndex) =>
        variantIndex === index ? { ...variant, [field]: value } : variant,
      ),
    }));

  const uploadImages = async (files) => {
    if (!files.length) return;
    const invalid = files.find(
      (file) => !IMAGE_TYPES.includes(file.type) || file.size > MAX_IMAGE_SIZE,
    );
    if (invalid) {
      setImageError(`"${invalid.name}" không hợp lệ. Chỉ nhận JPG, PNG, WEBP tối đa 5MB.`);
      return;
    }

    setImageError('');
    setUploading(true);
    try {
      for (const file of files) {
        const url = await adminApi.uploadProductImage(file);
        setForm((current) => ({ ...current, imageUrls: [...current.imageUrls, url] }));
      }
    } catch (err) {
      setImageError(err.message || 'Không thể tải ảnh lên.');
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setFormError('');
    let variants;
    try {
      variants = form.variants.map((variant) => ({
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
      setFormError('Thuộc tính mỗi biến thể phải là JSON hợp lệ, ví dụ: {"weight": "4U"}.');
      return;
    }

    const payload = {
      name: form.name.trim(),
      slug: form.slug.trim(),
      description: form.description.trim() || null,
      categoryId: form.categoryId,
      brandId: form.brandId,
      imageUrls: form.imageUrls,
      specs: form.specs
        .split(/\r?\n/)
        .map((value) => value.trim())
        .filter(Boolean),
      badge: form.badge.trim() || null,
      isActive: form.isActive,
      variants,
    };

    try {
      setSaving(true);
      if (product) await adminApi.updateProduct(product.id, payload);
      else await adminApi.createProduct(payload);
      notify({ message: product ? 'Đã cập nhật sản phẩm.' : 'Đã thêm sản phẩm mới.' });
      await onSaved();
      onClose();
    } catch (err) {
      setFormError(err.message || 'Không thể lưu sản phẩm.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Modal
        open={open}
        onClose={requestClose}
        title={product ? 'Cập nhật sản phẩm' : 'Thêm sản phẩm'}
        wide
        busy={busy}
      >
        <form className="admin-form" onSubmit={handleSubmit}>
          <div className="form-grid">
            <label>
              Tên sản phẩm
              <input
                required
                data-autofocus
                maxLength={200}
                value={form.name}
                onChange={(event) => {
                  const name = event.target.value;
                  setForm((current) => ({
                    ...current,
                    name,
                    slug: slugEdited ? current.slug : slugify(name),
                  }));
                }}
              />
            </label>
            <label>
              Đường dẫn (slug)
              <input
                required
                maxLength={200}
                value={form.slug}
                onChange={(event) => {
                  setSlugEdited(Boolean(event.target.value));
                  updateField('slug', event.target.value);
                }}
              />
            </label>
            <label>
              Danh mục
              <select
                required
                value={form.categoryId}
                onChange={(event) => updateField('categoryId', event.target.value)}
              >
                <option value="">Chọn danh mục</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Thương hiệu
              <select
                required
                value={form.brandId}
                onChange={(event) => updateField('brandId', event.target.value)}
              >
                <option value="">Chọn thương hiệu</option>
                {brands.map((brand) => (
                  <option key={brand.id} value={brand.id}>
                    {brand.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Nhãn
              <input
                maxLength={100}
                value={form.badge}
                onChange={(event) => updateField('badge', event.target.value)}
                placeholder="Ví dụ: BEST SELLER"
              />
            </label>
            <label className="check-label">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(event) => updateField('isActive', event.target.checked)}
              />
              Đang kinh doanh
            </label>
          </div>

          <label>
            Mô tả
            <textarea
              rows={3}
              value={form.description}
              onChange={(event) => updateField('description', event.target.value)}
            />
          </label>

          <div className="image-manager">
            <p className="group-label">Ảnh sản phẩm</p>
            {form.imageUrls.length > 0 && (
              <ul className="image-list">
                {form.imageUrls.map((url, index) => (
                  <li key={`${url}-${index}`}>
                    <img src={url} alt={`Ảnh sản phẩm ${index + 1}`} width="96" height="96" />
                    {index === 0 ? (
                      <span className="image-primary">Ảnh chính</span>
                    ) : (
                      <button
                        type="button"
                        className="image-make-primary"
                        aria-label={`Đặt ảnh ${index + 1} làm ảnh chính`}
                        title="Đặt làm ảnh chính"
                        onClick={() =>
                          setForm((current) => ({
                            ...current,
                            imageUrls: [
                              url,
                              ...current.imageUrls.filter((_, imageIndex) => imageIndex !== index),
                            ],
                          }))
                        }
                      >
                        <Star size={14} aria-hidden="true" />
                      </button>
                    )}
                    <button
                      type="button"
                      className="image-remove"
                      aria-label={`Xóa ảnh ${index + 1}`}
                      onClick={() =>
                        setForm((current) => ({
                          ...current,
                          imageUrls: current.imageUrls.filter(
                            (_, imageIndex) => imageIndex !== index,
                          ),
                        }))
                      }
                    >
                      <X size={14} aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <label
              className={'image-dropzone' + (dragging ? ' is-dragging' : '')}
              onDragOver={(event) => {
                event.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(event) => {
                event.preventDefault();
                setDragging(false);
                uploadImages([...event.dataTransfer.files]);
              }}
            >
              <ImagePlus size={22} aria-hidden="true" />
              <span>{uploading ? 'Đang tải ảnh...' : 'Chọn ảnh hoặc kéo thả vào đây'}</span>
              <small>JPG, PNG hoặc WEBP, tối đa 5MB mỗi ảnh.</small>
              <input
                type="file"
                accept={IMAGE_TYPES.join(',')}
                multiple
                className="sr-only"
                disabled={uploading}
                onChange={(event) => {
                  const files = [...event.target.files];
                  event.target.value = '';
                  uploadImages(files);
                }}
              />
            </label>
            {imageError && (
              <p className="field-error" role="alert">
                {imageError}
              </p>
            )}
          </div>

          <label>
            Thông số (mỗi dòng một thông số)
            <textarea
              rows={3}
              value={form.specs}
              onChange={(event) => updateField('specs', event.target.value)}
            />
          </label>

          <div className="variant-heading">
            <h3>Biến thể và giá</h3>
            <button
              type="button"
              className="btn-mini"
              onClick={() =>
                setForm((current) => ({
                  ...current,
                  variants: [...current.variants, { ...EMPTY_VARIANT }],
                }))
              }
            >
              <Plus size={14} aria-hidden="true" /> Thêm biến thể
            </button>
          </div>
          {form.variants.map((variant, index) => (
            <fieldset key={variant.id || index} className="variant-fieldset">
              <legend>Biến thể {index + 1}</legend>
              <div className="form-grid">
                <label>
                  Mã SKU
                  <input
                    required
                    value={variant.sku}
                    onChange={(event) => updateVariant(index, 'sku', event.target.value)}
                  />
                </label>
                <label>
                  Tên biến thể
                  <input
                    required
                    value={variant.name}
                    onChange={(event) => updateVariant(index, 'name', event.target.value)}
                  />
                </label>
                <label>
                  Giá bán (VND)
                  <input
                    required
                    min="1"
                    step="1"
                    type="number"
                    value={variant.price}
                    onChange={(event) => updateVariant(index, 'price', event.target.value)}
                  />
                </label>
                <label>
                  Giá cũ (VND)
                  <input
                    min="1"
                    step="1"
                    type="number"
                    value={variant.oldPrice}
                    onChange={(event) => updateVariant(index, 'oldPrice', event.target.value)}
                  />
                </label>
                <label>
                  Tồn kho
                  <input
                    required
                    min="0"
                    step="1"
                    type="number"
                    value={variant.stockQuantity}
                    onChange={(event) => updateVariant(index, 'stockQuantity', event.target.value)}
                  />
                </label>
                <label className="check-label">
                  <input
                    type="checkbox"
                    checked={variant.isAvailable}
                    onChange={(event) => updateVariant(index, 'isAvailable', event.target.checked)}
                  />
                  Cho phép bán biến thể này
                </label>
              </div>
              <label>
                Thuộc tính (JSON)
                <textarea
                  rows={2}
                  spellCheck={false}
                  value={variant.attributes}
                  placeholder='{"weight": "4U"}'
                  onChange={(event) => updateVariant(index, 'attributes', event.target.value)}
                />
              </label>
              {form.variants.length > 1 && (
                <button
                  type="button"
                  className="btn-mini btn-mini-danger"
                  onClick={() =>
                    setForm((current) => ({
                      ...current,
                      variants: current.variants.filter(
                        (_, variantIndex) => variantIndex !== index,
                      ),
                    }))
                  }
                >
                  <Trash2 size={14} aria-hidden="true" /> Gỡ biến thể
                </button>
              )}
            </fieldset>
          ))}

          {formError && (
            <p className="inline-alert" role="alert">
              {formError}
            </p>
          )}
          <div className="modal-actions modal-actions-sticky">
            <button type="button" className="btn btn-outline" onClick={requestClose} disabled={busy}>
              HỦY
            </button>
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {saving ? 'ĐANG LƯU...' : 'LƯU SẢN PHẨM'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={confirmDiscard}
        onClose={() => setConfirmDiscard(false)}
        title="Bỏ thay đổi chưa lưu?"
      >
        <p className="modal-text">Những nội dung bạn vừa nhập sẽ không được lưu.</p>
        <div className="modal-actions">
          <button type="button" className="btn btn-outline" onClick={() => setConfirmDiscard(false)}>
            TIẾP TỤC CHỈNH SỬA
          </button>
          <button
            type="button"
            className="btn btn-danger"
            onClick={() => {
              setConfirmDiscard(false);
              onClose();
            }}
          >
            BỎ THAY ĐỔI
          </button>
        </div>
      </Modal>
    </>
  );
}
