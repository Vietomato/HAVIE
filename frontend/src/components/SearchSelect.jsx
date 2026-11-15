import React from 'react';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { filterOptions, findExactOption } from '../utils/vnAddress.js';

// Hiển thị tối đa chừng này kết quả một lúc; gõ thêm chữ để thu hẹp.
const MAX_VISIBLE = 80;

/**
 * Ô chọn có tìm kiếm (combobox): gõ để lọc, dùng phím mũi tên + Enter hoặc chuột để chọn.
 * Chỉ nhận giá trị nằm trong danh sách; rời ô mà chưa chọn thì trả lại giá trị cũ.
 */
export default function SearchSelect({
  id,
  label,
  options,
  value,
  onChange,
  error,
  hint,
  disabled = false,
  placeholder = 'Gõ để tìm...',
  emptyText = 'Không tìm thấy kết quả phù hợp.',
}) {
  const listId = useId();
  const listRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);

  const results = useMemo(
    () => (open ? filterOptions(options, query).slice(0, MAX_VISIBLE) : []),
    [open, options, query],
  );

  useEffect(() => {
    if (!open) return;
    listRef.current
      ?.querySelector(`[data-index="${active}"]`)
      ?.scrollIntoView({ block: 'nearest' });
  }, [active, open]);

  const openList = () => {
    if (disabled) return;
    setQuery('');
    setActive(Math.max(0, options.indexOf(value)));
    setOpen(true);
  };

  const choose = (option) => {
    setOpen(false);
    setQuery('');
    if (option !== value) onChange(option);
  };

  const close = () => {
    // Gõ đúng tên (ví dụ "ha noi") rồi rời ô cũng được tính là đã chọn.
    const exact = findExactOption(options, query);
    if (exact) choose(exact);
    else {
      setOpen(false);
      setQuery('');
    }
  };

  const handleKeyDown = (event) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!open) {
        openList();
        return;
      }
      const step = event.key === 'ArrowDown' ? 1 : -1;
      setActive((current) => Math.min(Math.max(current + step, 0), Math.max(results.length - 1, 0)));
    } else if (event.key === 'Enter' && open) {
      // Không để Enter gửi cả form đặt hàng khi đang chọn trong danh sách.
      event.preventDefault();
      if (results[active]) choose(results[active]);
    } else if (event.key === 'Escape' && open) {
      event.preventDefault();
      setOpen(false);
      setQuery('');
    }
  };

  const describedBy = [hint ? `${id}-hint` : '', error ? `${id}-error` : ''].filter(Boolean).join(' ');
  const activeId = open && results[active] ? `${listId}-${active}` : undefined;

  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className="field-control has-action">
        <input
          id={id}
          type="text"
          role="combobox"
          autoComplete="off"
          spellCheck={false}
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={listId}
          aria-activedescendant={activeId}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={describedBy || undefined}
          disabled={disabled}
          placeholder={open && value ? value : placeholder}
          value={open ? query : value}
          onFocus={openList}
          onClick={() => !open && openList()}
          onBlur={close}
          onChange={(event) => {
            setQuery(event.target.value);
            setActive(0);
            if (!open) setOpen(true);
          }}
          onKeyDown={handleKeyDown}
        />
        <span className="field-action pointer-events-none" aria-hidden="true">
          <ChevronDown
            size={18}
            className={'transition-transform duration-150 ' + (open ? 'rotate-180' : 'rotate-0')}
          />
        </span>
        {open && (
          <ul
            ref={listRef}
            id={listId}
            role="listbox"
            aria-label={label}
            className="absolute inset-x-0 top-[calc(100%+4px)] z-30 m-0 max-h-[280px] list-none overflow-y-auto rounded-[var(--radius-sm)] border border-[var(--border-strong)] bg-[var(--surface)] p-1 shadow-[var(--shadow-lg)]"
          >
            {results.length ? (
              results.map((option, index) => (
                <li
                  key={option}
                  id={`${listId}-${index}`}
                  data-index={index}
                  role="option"
                  aria-selected={option === value}
                  // mousedown chạy trước blur của ô nhập, nên chọn được trước khi danh sách đóng.
                  onMouseDown={(event) => {
                    event.preventDefault();
                    choose(option);
                  }}
                  onMouseMove={() => index !== active && setActive(index)}
                  className={
                    'cursor-pointer rounded-[4px] px-3 py-2 text-[15px] leading-snug ' +
                    (index === active ? 'bg-[var(--highlight)] text-[var(--link)] ' : 'text-[var(--ink)] ') +
                    (option === value ? 'font-semibold' : 'font-normal')
                  }
                >
                  {option}
                </li>
              ))
            ) : (
              <li role="presentation" className="px-3 py-2 text-[14px] text-[var(--muted)]">
                {emptyText}
              </li>
            )}
          </ul>
        )}
      </div>
      {hint && (
        <small className="field-hint" id={`${id}-hint`}>
          {hint}
        </small>
      )}
      {error && (
        <small className="field-error" id={`${id}-error`}>
          {error}
        </small>
      )}
    </div>
  );
}
