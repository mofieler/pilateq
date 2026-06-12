'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { cn } from '@/lib/utils';

const SIZE_MAP = {
  xs: 'size-6 text-[10px]',
  sm: 'size-8 text-xs',
  md: 'size-10 text-sm',
  lg: 'size-16 text-base',
  xl: 'size-24 text-lg',
};

const SIZE_PX = {
  xs: 24,
  sm: 32,
  md: 40,
  lg: 64,
  xl: 96,
};

interface UserAvatarProps {
  name: string;
  avatarUrl?: string | null;
  size?: keyof typeof SIZE_MAP;
  className?: string;
}

export function UserAvatar({ name, avatarUrl, size = 'md', className }: UserAvatarProps) {
  const [imageError, setImageError] = useState(false);

  // Reset error state when avatar URL changes so a new upload can be displayed
  useEffect(() => {
    setImageError(false);
  }, [avatarUrl]);

  const initials = name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const sizeClass = SIZE_MAP[size];

  // Show initials if no avatar URL, image failed to load, or image is empty
  if (!avatarUrl || imageError) {
    return (
      <span
        className={cn(
          'inline-flex shrink-0 items-center justify-center rounded-full',
          'bg-linear-to-br from-[#ede8e5] to-[#e5dfdb]',
          'font-semibold text-[#6b3d32] ring-2 ring-[#faf9f7] shadow-sm',
          sizeClass,
          className,
        )}
      >
        {initials}
      </span>
    );
  }

  return (
    <Image
      key={avatarUrl}
      src={avatarUrl}
      alt={name}
      width={SIZE_PX[size]}
      height={SIZE_PX[size]}
      loading="eager"
      onError={() => setImageError(true)}
      className={cn(
        'rounded-full object-cover shrink-0 ring-2 ring-[#ede8e5] shadow-sm',
        sizeClass,
        className,
      )}
    />
  );
}
