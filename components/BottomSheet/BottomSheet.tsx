'use client';

import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Lead, Service } from '@/types';
import LeadDetail from './LeadDetail';

interface BottomSheetProps {
  isOpen: boolean;
  lead: Lead | null;
  service: Service | null;
  onClose: () => void;
  onStatusChange: (leadId: string, status: Lead['status']) => void;
  onEmailSaved?: (leadId: string, email: string) => void;
}

export default function BottomSheet({ isOpen, lead, service, onClose, onStatusChange, onEmailSaved }: BottomSheetProps) {
  // Close on Escape
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && isOpen) onClose();
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && lead && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/30 z-40"
          />
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 50, height: '65%' }}
            className="bg-[#0f1626] border-t border-[#1e2d4a] rounded-t-2xl flex flex-col"
          >
            <div className="w-10 h-1 bg-[#1e2d4a] rounded-full mx-auto mt-3 mb-2 flex-shrink-0" />
            <div className="flex-1 overflow-hidden">
              <LeadDetail
                lead={lead}
                service={service}
                onClose={onClose}
                onStatusChange={onStatusChange}
                onEmailSaved={onEmailSaved}
              />
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
