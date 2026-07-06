'use client';

export default function AddServiceButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-2 justify-center py-2 text-sm text-[#8899bb] hover:text-[#2563eb] border border-dashed border-[#1e2d4a] hover:border-[#2563eb] rounded-xl transition-all"
    >
      <span className="text-lg leading-none">+</span>
      Add Service
    </button>
  );
}
