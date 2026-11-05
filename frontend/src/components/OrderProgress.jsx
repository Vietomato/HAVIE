import React from 'react';
import { Check, CircleX } from 'lucide-react';
import { ORDER_STATUS_LABELS } from '../api';

const ORDER_PROGRESS_STEPS = [
  { status: 'PENDING_CONFIRMATION', label: 'Chờ xác nhận' },
  { status: 'CONFIRMED', label: 'Đã xác nhận' },
  { status: 'SHIPPING', label: 'Đang giao' },
  { status: 'COMPLETED', label: 'Hoàn thành' },
];

export default function OrderProgress({ order }) {
  if (order.status === 'CANCELLED' || order.status === 'REFUND_PENDING') {
    return (
      <div className="order-cancelled">
        <CircleX size={18} aria-hidden="true" />
        <div>
          <strong>{ORDER_STATUS_LABELS[order.status] || 'Đơn hàng đã hủy'}</strong>
          {order.cancelReason && <span>Lý do: {order.cancelReason}</span>}
        </div>
      </div>
    );
  }

  const currentStep = ORDER_PROGRESS_STEPS.findIndex(({ status }) => status === order.status);
  const activeStep = currentStep < 0 ? 0 : currentStep;

  return (
    <ol
      className="order-progress"
      aria-label={`Tiến trình đơn hàng: ${ORDER_STATUS_LABELS[order.status] || order.status}`}
    >
      {ORDER_PROGRESS_STEPS.map((step, index) => {
        const complete = index < activeStep || order.status === 'COMPLETED';
        const current = index === activeStep && order.status !== 'COMPLETED';
        return (
          <li
            key={step.status}
            className={['order-progress-step', complete ? 'complete' : '', current ? 'current' : '']
              .filter(Boolean)
              .join(' ')}
            aria-current={current ? 'step' : undefined}
          >
            <span className="order-progress-marker">
              {complete ? <Check size={15} aria-hidden="true" /> : index + 1}
            </span>
            <span className="order-progress-label">{step.label}</span>
          </li>
        );
      })}
    </ol>
  );
}
