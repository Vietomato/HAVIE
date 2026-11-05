export const money = (value) =>
  new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(value);

// Display only: the server calculates the real order total.
export const SHIPPING_FEE = 30000;

export const formatDate = (value) => new Date(value).toLocaleDateString('vi-VN');
