import React, { useId } from 'react';

interface LumaBrandLogoProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

/**
 * Pure calligraphic "Luma" wordmark with trailing swash and 5-pointed blue star,
 * matching the signature brand mark requested by the user (without square icon box).
 */
export const LumaBrandLogo: React.FC<LumaBrandLogoProps> = ({
  size = 'md',
  className = '',
}) => {
  const gradId = useId().replace(/:/g, '');
  const heightClass =
    size === 'sm'
      ? 'h-[34px] max-w-[140px]'
      : size === 'lg'
        ? 'h-[56px] max-w-[240px]'
        : 'h-[40px] max-w-[172px]';

  return (
    <span
      className={`inline-flex items-center select-none shrink-0 ${className}`}
      aria-label="Luma"
    >
      <svg
        viewBox="0 0 1010 330"
        preserveAspectRatio="xMidYMid meet"
        className={`${heightClass} w-auto overflow-visible shrink-0`}
        role="img"
        aria-label="Luma"
      >
        <defs>
          <linearGradient id={gradId} x1="0%" y1="50%" x2="100%" y2="50%">
            <stop offset="0%" stopColor="var(--luma-ink)" />
            <stop offset="68%" stopColor="var(--luma-ink)" />
            <stop offset="100%" stopColor="#2B64F5" />
          </linearGradient>
        </defs>
        {/* Calligraphic "Luma" continuous cursive stroke */}
        <path
          d="M 72 152 C 56 146, 64 114, 104 118 C 154 124, 204 174, 254 166 C 292 158, 292 116, 262 116 C 226 116, 178 186, 118 242 C 82 276, 44 274, 40 248 C 36 224, 66 222, 102 250 C 142 280, 212 274, 284 200 C 268 222, 250 260, 276 270 C 304 280, 334 246, 352 208 C 340 238, 338 270, 368 272 C 404 274, 436 236, 456 204 C 444 232, 432 256, 424 270 C 446 236, 474 198, 502 206 C 520 212, 502 248, 486 272 C 508 236, 540 198, 562 210 C 578 220, 546 266, 572 276 C 602 284, 636 212, 688 204 C 648 198, 614 234, 626 264 C 638 286, 676 272, 692 234 C 682 260, 698 286, 746 284 C 796 282, 832 212, 872 210 C 892 210, 892 242, 878 242 C 864 242, 866 216, 892 206 C 918 198, 932 184, 938 166"
          fill="none"
          stroke={`url(#${gradId})`}
          strokeWidth="21"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* 5-pointed star flourish */}
        <path
          d="M 912 174 L 942 108 L 964 164 L 898 138 L 984 104 Z"
          fill="none"
          stroke="#2B64F5"
          strokeWidth="13"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
};
