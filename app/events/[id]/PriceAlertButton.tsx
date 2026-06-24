'use client';

import { useState } from 'react';
import PriceAlertModal from './PriceAlertModal';

interface Props {
  eventId: string;
  eventTitle: string;
}

// TicketListings broadcasts its current state via a custom event so the modal
// can prefill the right qty and suggested price without prop-drilling.
export function usePriceAlertContext() {
  if (typeof window === 'undefined') return;
  return {
    broadcast: (qty: number, cheapestPrice: number | null) => {
      window.dispatchEvent(
        new CustomEvent('tickethub:listings-state', { detail: { qty, cheapestPrice } })
      );
    },
  };
}

export default function PriceAlertButton({ eventId, eventTitle }: Props) {
  const [open, setOpen] = useState(false);
  const [modalQty, setModalQty] = useState(2);
  const [suggestedPrice, setSuggestedPrice] = useState<number | null>(null);

  const handleOpen = () => {
    // Read last-broadcast state from TicketListings
    const handler = (e: Event) => {
      const { qty, cheapestPrice } = (e as CustomEvent<{ qty: number; cheapestPrice: number | null }>).detail;
      setModalQty(qty);
      if (cheapestPrice) {
        // 15% below cheapest, rounded down to nearest $5
        setSuggestedPrice(Math.floor((cheapestPrice * 0.85) / 5) * 5 || null);
      } else {
        setSuggestedPrice(null);
      }
      window.removeEventListener('tickethub:listings-state', handler);
      setOpen(true);
    };
    window.addEventListener('tickethub:listings-state', handler);
    // Request current state; if TicketListings doesn't respond in 100ms, open anyway
    window.dispatchEvent(new CustomEvent('tickethub:request-state'));
    setTimeout(() => {
      window.removeEventListener('tickethub:listings-state', handler);
      setOpen(true);
    }, 100);
  };

  return (
    <>
      <button
        onClick={handleOpen}
        className="inline-flex items-center gap-2 bg-white border border-slate-300 hover:border-indigo-400 hover:text-indigo-700 text-slate-700 font-semibold rounded-xl px-5 py-2.5 text-sm transition-colors shadow-sm"
      >
        🎯 Name Your Price
      </button>
      {open && (
        <PriceAlertModal
          eventId={eventId}
          eventTitle={eventTitle}
          defaultQty={modalQty}
          suggestedPrice={suggestedPrice}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
