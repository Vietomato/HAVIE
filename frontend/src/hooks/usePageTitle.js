import { useEffect } from 'react';

export default function usePageTitle(title) {
  useEffect(() => {
    document.title = title ? `${title} — HAVIE` : 'HAVIE — Cửa hàng cầu lông';
  }, [title]);
}
