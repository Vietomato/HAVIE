import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Maximize2, Minimize2 } from 'lucide-react';
import { chatApi } from '../api';
import { useStore } from '../context/StoreContext.jsx';
import './AdvisorChat.css';

const greeting = {
  role: 'assistant',
  content:
    'Chào bạn! Bạn đang tìm vợt hay giày cầu lông? Hãy chia sẻ hãng mong muốn, ngân sách và nhu cầu sử dụng nhé.',
};

const money = new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
});

function toMessages(conversation) {
  return conversation.messages.length
    ? conversation.messages.map((message) => ({
        role: message.role,
        content: message.content,
        candidates: message.candidates || [],
        pricingNotice: message.pricingNotice,
      }))
    : [greeting];
}

export default function AdvisorChat() {
  const { account } = useStore();
  const [open, setOpen] = useState(false);
  const [sizeMode, setSizeMode] = useState('compact');
  const [messages, setMessages] = useState([greeting]);
  const [conversations, setConversations] = useState([]);
  const [activeConversationId, setActiveConversationId] = useState(null);
  const [input, setInput] = useState('');
  const [pendingConversationIds, setPendingConversationIds] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [creatingConversation, setCreatingConversation] = useState(false);
  const [error, setError] = useState('');
  const [resizeGeometry, setResizeGeometry] = useState(null);

  const controllersRef = useRef(new Map());
  const activeRequestsRef = useRef(new Set());
  const activeConversationIdRef = useRef(null);
  const accountIdRef = useRef(account?.id);
  const selectionRequestRef = useRef(0);
  const panelRef = useRef(null);
  const resizeRef = useRef(null);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  activeConversationIdRef.current = activeConversationId;
  accountIdRef.current = account?.id;
  const currentIsPending =
    isProcessing || pendingConversationIds.includes(activeConversationId);

  useEffect(() => {
    if (open) {
      bottomRef.current?.scrollIntoView({ block: 'nearest' });
    }
  }, [messages, currentIsPending, open, error]);

  useEffect(() => {
    if (open && account && !currentIsPending) {
      inputRef.current?.focus();
    }
  }, [open, currentIsPending, account]);

  useEffect(() => {
    if (!open || sizeMode !== 'fullscreen') return undefined;

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setSizeMode('compact');
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, sizeMode]);

  useEffect(() => {
    controllersRef.current.forEach((controller) => controller.abort());
    controllersRef.current.clear();
    activeRequestsRef.current.clear();
    setPendingConversationIds([]);
    setInput('');
    setError('');
    setCreatingConversation(false);
    setLoadingHistory(false);
    setIsProcessing(false);
    setActiveConversationId(null);
    activeConversationIdRef.current = null;
    setMessages([greeting]);
    setConversations([]);

    if (!account) return undefined;

    let cancelled = false;
    setLoadingHistory(true);
    chatApi
      .getConversations()
      .then(async (items) => {
        if (cancelled) return;
        setConversations(items);
        if (!items.length) return;
        const latest = await chatApi.getConversation(items[0].id);
        if (cancelled) return;
        setActiveConversationId(latest.id);
        activeConversationIdRef.current = latest.id;
        setMessages(toMessages(latest));
        setIsProcessing(latest.isProcessing);
      })
      .catch((loadError) => {
        if (!cancelled) setError(loadError.message || 'Không thể tải lịch sử tư vấn.');
      })
      .finally(() => {
        if (!cancelled) setLoadingHistory(false);
      });

    return () => {
      cancelled = true;
    };
  }, [account?.id]);

  useEffect(
    () => () => {
      controllersRef.current.forEach((controller) => controller.abort());
    },
    [],
  );

  async function startNewChat() {
    if (!account || creatingConversation) return;
    const requestAccountId = account.id;
    selectionRequestRef.current += 1;
    setCreatingConversation(true);
    setError('');
    try {
      const conversation = await chatApi.createConversation();
      if (accountIdRef.current !== requestAccountId) return;
      setConversations((current) => [conversation, ...current]);
      setActiveConversationId(conversation.id);
      activeConversationIdRef.current = conversation.id;
      setMessages([greeting]);
      setIsProcessing(false);
      setInput('');
    } catch (createError) {
      if (accountIdRef.current === requestAccountId) {
        setError(createError.message || 'Không thể tạo cuộc trò chuyện mới.');
      }
    } finally {
      if (accountIdRef.current === requestAccountId) setCreatingConversation(false);
    }
  }

  async function selectConversation(conversationId) {
    const requestAccountId = account?.id;
    const requestId = ++selectionRequestRef.current;
    setError('');
    setLoadingHistory(true);
    try {
      const conversation = await chatApi.getConversation(conversationId);
      if (
        accountIdRef.current !== requestAccountId ||
        selectionRequestRef.current !== requestId
      ) return;
      setActiveConversationId(conversation.id);
      activeConversationIdRef.current = conversation.id;
      setMessages(toMessages(conversation));
      setIsProcessing(conversation.isProcessing);
      setInput('');
    } catch (loadError) {
      if (
        accountIdRef.current === requestAccountId &&
        selectionRequestRef.current === requestId
      ) {
        setError(loadError.message || 'Không thể mở cuộc trò chuyện.');
      }
    } finally {
      if (
        accountIdRef.current === requestAccountId &&
        selectionRequestRef.current === requestId
      ) setLoadingHistory(false);
    }
  }

  async function renameConversation(conversation) {
    const title = window.prompt(
      'Nhập tên cuộc trò chuyện (tối đa 60 ký tự):',
      conversation.title,
    );
    if (title === null || !title.trim() || title.trim() === conversation.title) return;

    try {
      const updated = await chatApi.renameConversation(conversation.id, title.trim());
      setConversations((current) =>
        current.map((item) => (item.id === updated.id ? { ...item, ...updated } : item)),
      );
    } catch (renameError) {
      setError(renameError.message || 'Không thể đổi tên cuộc trò chuyện.');
    }
  }

  async function deleteConversation(conversation) {
    if (!window.confirm(`Xóa cuộc trò chuyện "${conversation.title}"?`)) return;

    try {
      await chatApi.deleteConversation(conversation.id);
      const remaining = conversations.filter((item) => item.id !== conversation.id);
      setConversations(remaining);

      if (activeConversationIdRef.current !== conversation.id) return;
      if (remaining.length) {
        await selectConversation(remaining[0].id);
      } else {
        setActiveConversationId(null);
        activeConversationIdRef.current = null;
        setMessages([greeting]);
        setIsProcessing(false);
        setInput('');
      }
    } catch (deleteError) {
      setError(deleteError.message || 'Không thể xóa cuộc trò chuyện.');
    }
  }

  async function sendMessage(event) {
    event.preventDefault();
    const text = input.trim();
    if (!account || !text || currentIsPending || loadingHistory) return;

    let conversationId = activeConversationId;
    const requestAccountId = account.id;
    setError('');

    if (!conversationId) {
      try {
        const conversation = await chatApi.createConversation();
        conversationId = conversation.id;
        setConversations((current) => [conversation, ...current]);
        setActiveConversationId(conversationId);
        activeConversationIdRef.current = conversationId;
        setMessages([greeting]);
      } catch (createError) {
        setError(createError.message || 'Không thể tạo cuộc trò chuyện mới.');
        return;
      }
    }

    if (activeRequestsRef.current.has(conversationId)) return;
    activeRequestsRef.current.add(conversationId);
    setPendingConversationIds((current) => [...current, conversationId]);
    setInput('');
    setMessages((current) => [...current, { role: 'user', content: text }]);

    const controller = new AbortController();
    controllersRef.current.set(conversationId, controller);
    const timeout = setTimeout(() => controller.abort(), 360_000);

    try {
      const conversation = await chatApi.sendMessage(
        conversationId,
        text,
        controller.signal,
      );

      if (accountIdRef.current === requestAccountId) {
        setConversations((current) => [
          conversation,
          ...current.filter((item) => item.id !== conversation.id),
        ]);
        if (
          activeConversationIdRef.current === conversationId ||
          !activeConversationIdRef.current
        ) {
          setActiveConversationId(conversation.id);
          activeConversationIdRef.current = conversation.id;
          setMessages(toMessages(conversation));
          setIsProcessing(conversation.isProcessing);
        }
      }
    } catch (sendError) {
      if (accountIdRef.current === requestAccountId) {
        setError(sendError.message || 'Không gửi được tin nhắn.');
      }
      try {
        const conversation = await chatApi.getConversation(conversationId);
        if (accountIdRef.current === requestAccountId) {
          setConversations((current) => [
            conversation,
            ...current.filter((item) => item.id !== conversation.id),
          ]);
          if (activeConversationIdRef.current === conversationId) {
            setMessages(toMessages(conversation));
            setIsProcessing(conversation.isProcessing);
          }
        }
      } catch {
        if (
          accountIdRef.current === requestAccountId &&
          activeConversationIdRef.current === conversationId
        ) {
          setMessages((current) => [
            ...current,
            { role: 'assistant', content: 'Tin nhắn đã được lưu. Hãy tải lại cuộc trò chuyện để kiểm tra trạng thái.' },
          ]);
        }
      }
    } finally {
      clearTimeout(timeout);
      controllersRef.current.delete(conversationId);
      activeRequestsRef.current.delete(conversationId);
      setPendingConversationIds((current) => current.filter((id) => id !== conversationId));
    }
  }

  function closeAdvisor() {
    setOpen(false);
    setSizeMode('compact');
  }

  function startResize(event, direction) {
    if (sizeMode === 'fullscreen' || !panelRef.current) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const bounds = panelRef.current.getBoundingClientRect();
    const viewportWidth = document.documentElement.clientWidth;
    const viewportHeight = document.documentElement.clientHeight;
    resizeRef.current = {
      pointerId: event.pointerId,
      direction,
      startX: event.clientX,
      startY: event.clientY,
      width: bounds.width,
      height: bounds.height,
      rightGap: viewportWidth - bounds.right,
      bottomGap: viewportHeight - bounds.bottom,
    };
  }

  function updateResize(event) {
    const start = resizeRef.current;
    if (!start || event.pointerId !== start.pointerId) return;

    const deltaX = event.clientX - start.startX;
    const deltaY = event.clientY - start.startY;
    const viewportWidth = document.documentElement.clientWidth;
    const viewportHeight = document.documentElement.clientHeight;
    const maxWidth = Math.max(1, viewportWidth - start.rightGap - 20);
    const minWidth = Math.min(320, maxWidth);
    const maxHeight = Math.max(1, viewportHeight - start.bottomGap - 20);
    const minHeight = Math.min(420, maxHeight);
    const width = start.direction.includes('x')
      ? Math.min(maxWidth, Math.max(minWidth, start.width - deltaX))
      : start.width;
    const height = start.direction.includes('y')
      ? Math.min(maxHeight, Math.max(minHeight, start.height - deltaY))
      : start.height;

    setResizeGeometry({ width, height });
  }

  function stopResize(event) {
    if (resizeRef.current?.pointerId === event.pointerId) {
      resizeRef.current = null;
    }
  }

  return (
    <div
      className={`havie-advisor${open ? ` havie-advisor--${sizeMode}` : ''}`}
    >
      {open && (
        <section
          id="havie-advisor-panel"
          className="havie-advisor__panel"
          aria-label="Tư vấn sản phẩm cầu lông"
          ref={panelRef}
          style={
            resizeGeometry && sizeMode !== 'fullscreen'
              ? { width: `${resizeGeometry.width}px`, height: `${resizeGeometry.height}px` }
              : undefined
          }
        >
          <header className="havie-advisor__header">
            <div>
              <strong>HAVIE · Tư vấn sản phẩm</strong>
              <small>Tìm vợt và giày trong danh mục cửa hàng</small>
            </div>

            <div className="havie-advisor__header-actions">
              {sizeMode === 'fullscreen' ? (
                <button
                  type="button"
                  onClick={() => setSizeMode('compact')}
                  aria-label="Thu về kích thước thường"
                  title="Thu về kích thước thường"
                >
                  <Minimize2 size={18} />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setSizeMode('fullscreen')}
                  aria-label="Phóng toàn màn hình"
                  title="Phóng toàn màn hình"
                >
                  <Maximize2 size={18} />
                </button>
              )}
              <button
                type="button"
                onClick={closeAdvisor}
                aria-label="Đóng chatbot"
                title="Đóng chatbot"
              >
                ✕
              </button>
            </div>
          </header>

          {!account ? (
            <div className="havie-advisor__login">
              <p>Đăng nhập để lưu và xem lại các cuộc trò chuyện tư vấn.</p>
              <Link to="/auth" onClick={closeAdvisor}>
                Đăng nhập / Đăng ký
              </Link>
            </div>
          ) : (
            <>
              <div className="havie-advisor__toolbar">
                <strong>Lịch sử tư vấn</strong>
                <button
                  type="button"
                  onClick={startNewChat}
                  disabled={creatingConversation || loadingHistory}
                >
                  {creatingConversation ? 'Đang tạo…' : '+ Cuộc trò chuyện mới'}
                </button>
              </div>

              <nav className="havie-advisor__history" aria-label="Các cuộc trò chuyện">
                {loadingHistory && conversations.length === 0 ? (
                  <span role="status">Đang tải lịch sử…</span>
                ) : conversations.length === 0 ? (
                  <span>Chưa có cuộc trò chuyện nào.</span>
                ) : (
                  conversations.map((conversation) => (
                    <div
                      key={conversation.id}
                      className="havie-advisor__history-card"
                    >
                      <button
                        type="button"
                        className={
                          conversation.id === activeConversationId
                            ? 'havie-advisor__history-item is-active'
                            : 'havie-advisor__history-item'
                        }
                        onClick={() => selectConversation(conversation.id)}
                        aria-current={
                          conversation.id === activeConversationId ? 'page' : undefined
                        }
                      >
                        <span>{conversation.title || 'Cuộc trò chuyện mới'}</span>
                        <small>
                          {conversation.isProcessing
                            ? 'Đang xử lý'
                            : new Date(conversation.updatedAt).toLocaleDateString('vi-VN')}
                        </small>
                      </button>
                      <div className="havie-advisor__history-actions">
                        <button
                          type="button"
                          onClick={() => renameConversation(conversation)}
                          aria-label={`Đổi tên ${conversation.title}`}
                        >
                          Đổi tên
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteConversation(conversation)}
                          disabled={conversation.isProcessing}
                          aria-label={`Xóa ${conversation.title}`}
                          title={
                            conversation.isProcessing
                              ? 'Đợi trợ lý xử lý xong để xóa'
                              : 'Xóa cuộc trò chuyện'
                          }
                        >
                          Xóa
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </nav>

              <div
                className="havie-advisor__messages"
                role="log"
                aria-label="Nội dung trò chuyện"
                aria-live="polite"
                aria-relevant="additions"
                aria-busy={currentIsPending}
              >
                {loadingHistory ? (
                  <p role="status">Đang mở cuộc trò chuyện…</p>
                ) : (
                  messages.map((message, index) => (
                    <div
                      key={`${activeConversationId || 'new'}-${index}`}
                      className={`havie-advisor__message havie-advisor__message--${message.role}`}
                    >
                      <span className="havie-advisor__speaker">
                        {message.role === 'user' ? 'Bạn' : 'HAVIE'}
                      </span>

                      <p>{message.content}</p>

                      {message.candidates?.length > 0 && (
                        <div className="havie-advisor__candidates">
                          <strong>Sản phẩm tìm được</strong>

                          {message.candidates.map((candidate) => {
                            const price = candidate.priceVnd ?? candidate.racketPriceVnd;
                            const productPath = candidate.slug || candidate.productId;
                            const content = (
                              <>
                                <strong>{candidate.name}</strong>
                                {candidate.variantName &&
                                  candidate.variantName !== 'Default Title' && (
                                    <span>{candidate.variantName}</span>
                                  )}
                                <span>
                                  Giá niêm yết:{' '}
                                  {Number.isFinite(price) && price > 0
                                    ? money.format(price)
                                    : 'Liên hệ'}
                                </span>
                              </>
                            );

                            return candidate.isPublished && productPath ? (
                              <Link
                                key={candidate.variantId}
                                to={`/products/${encodeURIComponent(productPath)}`}
                                className="havie-advisor__product"
                              >
                                {content}
                              </Link>
                            ) : (
                              <div key={candidate.variantId} className="havie-advisor__product">
                                {content}
                              </div>
                            );
                          })}

                          {message.pricingNotice && <small>{message.pricingNotice}</small>}
                        </div>
                      )}
                    </div>
                  ))
                )}

                {currentIsPending && (
                  <p className="havie-advisor__waiting" role="status">
                    HAVIE đang xử lý. Bạn có thể mở cuộc trò chuyện mới trong lúc chờ.
                  </p>
                )}

                <div ref={bottomRef} />
              </div>

              {error && <div className="havie-advisor__error" role="alert">{error}</div>}

              <form className="havie-advisor__form" onSubmit={sendMessage}>
                <label className="havie-advisor__sr-only" htmlFor="havie-advisor-input">
                  Tin nhắn tư vấn
                </label>

                <input
                  ref={inputRef}
                  id="havie-advisor-input"
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  placeholder={
                    currentIsPending
                      ? 'Tạo cuộc trò chuyện mới để gửi prompt khác'
                      : 'Nhập nhu cầu của bạn…'
                  }
                  maxLength={2000}
                  disabled={currentIsPending || loadingHistory}
                  autoComplete="off"
                />

                <button
                  type="submit"
                  disabled={currentIsPending || loadingHistory || !input.trim()}
                >
                  {currentIsPending ? 'Đang chờ…' : 'Gửi'}
                </button>
              </form>
            </>
          )}
          {sizeMode !== 'fullscreen' && (
            <>
              <button
                type="button"
                className="havie-advisor__resize-handle havie-advisor__resize-handle--horizontal"
                aria-label="Kéo để đổi chiều rộng chatbot"
                title="Kéo để đổi chiều rộng"
                onPointerDown={(event) => startResize(event, 'x')}
                onPointerMove={updateResize}
                onPointerUp={stopResize}
                onPointerCancel={stopResize}
                onLostPointerCapture={stopResize}
              />
              <button
                type="button"
                className="havie-advisor__resize-handle havie-advisor__resize-handle--vertical"
                aria-label="Kéo để đổi chiều cao chatbot"
                title="Kéo để đổi chiều cao"
                onPointerDown={(event) => startResize(event, 'y')}
                onPointerMove={updateResize}
                onPointerUp={stopResize}
                onPointerCancel={stopResize}
                onLostPointerCapture={stopResize}
              />
              <button
                type="button"
                className="havie-advisor__resize-handle havie-advisor__resize-handle--diagonal"
                aria-label="Kéo chéo để đổi kích thước chatbot"
                title="Kéo chéo để đổi kích thước"
                onPointerDown={(event) => startResize(event, 'xy')}
                onPointerMove={updateResize}
                onPointerUp={stopResize}
                onPointerCancel={stopResize}
                onLostPointerCapture={stopResize}
              >
                <span aria-hidden="true" />
              </button>
            </>
          )}
        </section>
      )}

      {!open && (
        <button
          type="button"
          className="havie-advisor__launcher"
          onClick={() => setOpen(true)}
          aria-expanded={open}
          aria-controls="havie-advisor-panel"
        >
          Tư vấn sản phẩm
        </button>
      )}
    </div>
  );
}
