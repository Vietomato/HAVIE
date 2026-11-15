// Danh sách tỉnh/thành, quận/huyện, phường/xã cho form địa chỉ.
// File dữ liệu nằm ở public/data (khoảng 48KB sau nén) và chỉ tải khi cần, không nằm trong bundle.
// Dạng dữ liệu: [[tênTỉnh, [[tênHuyện, [tênXã, ...]], ...]], ...]

const DATA_URL = '/data/vn-administrative-units.json';

let pending;

/** Tải dữ liệu một lần; các lần gọi sau dùng lại kết quả. Lỗi thì cho phép thử lại. */
export function loadAdministrativeUnits() {
  if (!pending) {
    pending = fetch(DATA_URL)
      .then((response) => {
        if (!response.ok) throw new Error('Không tải được danh sách địa chỉ.');
        return response.json();
      })
      .catch((error) => {
        pending = undefined;
        throw error;
      });
  }
  return pending;
}

export function provinceNames(units) {
  return units.map(([name]) => name);
}

export function districtNames(units, province) {
  return units.find(([name]) => name === province)?.[1].map(([name]) => name) ?? [];
}

export function wardNames(units, province, district) {
  const districts = units.find(([name]) => name === province)?.[1] ?? [];
  return districts.find(([name]) => name === district)?.[1] ?? [];
}

// "Thành phố Hồ Chí Minh" -> "thanh pho ho chi minh": bỏ dấu, chữ thường, để gõ không dấu vẫn tìm được.
export function normalizeSearch(text) {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

// Tiền tố đơn vị hành chính, bỏ đi khi so khớp để "ha noi" hay "quan 1" đều khớp đúng.
const UNIT_PREFIX = /^(thanh pho|tinh|quan|huyen|thi xa|phuong|xa|thi tran)\s+/;

export function stripUnitPrefix(normalized) {
  return normalized.replace(UNIT_PREFIX, '');
}

/** Lọc và xếp hạng: khớp từ đầu tên (sau tiền tố) lên trước, khớp ở giữa xếp sau. */
export function filterOptions(options, query) {
  const needle = normalizeSearch(query);
  if (!needle) return options;

  const starts = [];
  const contains = [];
  for (const option of options) {
    const full = normalizeSearch(option);
    const bare = stripUnitPrefix(full);
    if (bare.startsWith(needle) || full.startsWith(needle)) starts.push(option);
    else if (full.includes(needle)) contains.push(option);
  }
  return [...starts, ...contains];
}

/** Tìm lựa chọn trùng khớp hoàn toàn với chữ đã gõ (có hoặc không có tiền tố). */
export function findExactOption(options, query) {
  const needle = normalizeSearch(query);
  if (!needle) return undefined;
  return options.find((option) => {
    const full = normalizeSearch(option);
    return full === needle || stripUnitPrefix(full) === needle;
  });
}
