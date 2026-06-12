'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { X, Settings } from 'lucide-react';
import { UserAvatar } from './UserAvatar';
import { AvatarUploader } from './AvatarUploader';


interface NavProfileMenuProps {
  name: string;
  email: string;
  avatarUrl?: string | null;
}

export function NavProfileMenu({ name, email, avatarUrl }: NavProfileMenuProps) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  /**
   * Tracks whether the AvatarUploader's fullscreen crop overlay is active.
   * While true, outside-click detection is suspended so that dragging/zooming
   * the crop area does not accidentally close the profile panel.
   */
  const [isCropping, setIsCropping] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;

    function handleOutsideAction(event: MouseEvent | TouchEvent) {
      // Never close while the user is interacting with the crop overlay
      if (isCropping) return;

      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener('mousedown', handleOutsideAction, true);
    document.addEventListener('touchstart', handleOutsideAction, true);

    return () => {
      document.removeEventListener('mousedown', handleOutsideAction, true);
      document.removeEventListener('touchstart', handleOutsideAction, true);
    };
  }, [open, isCropping]);

  // Close on Escape key — but not while cropping (AvatarUploader handles Esc itself)
  useEffect(() => {
    if (!open || isCropping) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, isCropping]);

  const handleClose = useCallback(() => setOpen(false), []);
  const handleCroppingChange = useCallback((cropping: boolean) => setIsCropping(cropping), []);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open profile menu"
        aria-expanded={open}
        className="hidden sm:flex items-center gap-2 rounded-full bg-[#ede8e5]/60 px-3 py-2 transition-colors hover:bg-[#ede8e5] cursor-pointer"
      >
        <UserAvatar name={name} avatarUrl={avatarUrl} size="sm" />
        <p className="text-xs font-medium text-[#4e2b22] truncate max-w-[140px]">{email}</p>
      </button>

      {open && mounted && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop — only closes when not cropping */}
          <div
            className="absolute inset-0 bg-[#4e2b22]/25 backdrop-blur-sm"
            onClick={isCropping ? undefined : handleClose}
            aria-hidden="true"
          />
          <div
            ref={containerRef}
            role="dialog"
            aria-modal="true"
            aria-label="Your Profile"
            className="relative w-full max-w-sm bg-[#faf9f7] rounded-2xl border border-[#ede8e5] shadow-[0_20px_60px_rgba(78,43,34,0.18)] p-8"
          >
            <button
              type="button"
              onClick={handleClose}
              aria-label="Close profile panel"
              className="absolute right-4 top-4 p-1 rounded-full hover:bg-[#ede8e5] transition-colors cursor-pointer"
            >
              <X className="size-4 text-[#8b6b5c]" />
            </button>

            <div className="text-center">
              <h2 className="text-lg font-bold text-[#4e2b22]">Your Profile</h2>
              <p className="text-sm text-[#6b3d32] mt-1">{email}</p>
            </div>

            <div className="mt-6 flex justify-center">
              <AvatarUploader
                name={name}
                currentAvatarUrl={avatarUrl}
                onCroppingChange={handleCroppingChange}
              />
            </div>

            <div className="mt-6 pt-5 border-t border-[#ede8e5]">
              <Link
                href="/profile"
                onClick={handleClose}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#ede8e5]/60 px-4 py-2.5 text-sm font-medium text-[#4e2b22] transition-all hover:bg-[#ede8e5] hover:shadow-sm"
              >
                <Settings className="size-4 text-[#8b6b5c]" />
                Profile Settings
              </Link>
            </div>

          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
