"use client";

import { useEffect, useRef } from "react";

/** A centered dialog that opens and closes with the `open` prop. */
export default function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-label={title}
      className="m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg overflow-y-auto border border-moa-line bg-moa-bg p-8 text-moa-text backdrop:bg-black/75"
    >
      <div className="mb-6 flex items-start justify-between gap-4">
        <h2 className="text-3xl font-medium">{title}</h2>
        <button type="button" onClick={onClose} className="pt-2 text-sm text-moa-muted hover:text-moa-text">
          Cancel
        </button>
      </div>
      {open && children}
    </dialog>
  );
}
