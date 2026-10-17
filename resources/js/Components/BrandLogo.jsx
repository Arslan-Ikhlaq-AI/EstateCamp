import { cn } from '@/lib/utils';
import { Link } from '@inertiajs/react';
import { useId } from 'react';

const BRAND_NAME = 'EstateCamp';

/**
 * The EstateCamp mark: a pitched tent under a night star on the brand
 * gradient. Inside a `group/brand` element, hovering lights the tent door,
 * lifts the star and sweeps a sheen across the tile. `intro` pitches the
 * tent once on mount.
 */
export function BrandMark({ className, intro = false }) {
    // Unique ids keep gradients working when the mark renders more than once.
    const id = useId().replace(/:/g, '');

    return (
        <svg
            viewBox="0 0 40 40"
            fill="none"
            aria-hidden="true"
            className={cn('size-9 shrink-0', className)}
        >
            <defs>
                <linearGradient
                    id={`${id}-tile`}
                    x1="6"
                    y1="2"
                    x2="34"
                    y2="38"
                    gradientUnits="userSpaceOnUse"
                >
                    <stop stopColor="#1CB5E0" />
                    <stop offset="1" stopColor="#000851" />
                </linearGradient>
                <linearGradient
                    id={`${id}-rim`}
                    x1="20"
                    y1="0"
                    x2="20"
                    y2="40"
                    gradientUnits="userSpaceOnUse"
                >
                    <stop stopColor="#fff" stopOpacity="0.55" />
                    <stop offset="0.45" stopColor="#fff" stopOpacity="0" />
                </linearGradient>
                <radialGradient
                    id={`${id}-glow`}
                    cx="20"
                    cy="27"
                    r="11"
                    gradientUnits="userSpaceOnUse"
                >
                    <stop stopColor="#CFF6FF" stopOpacity="0.85" />
                    <stop offset="1" stopColor="#1CB5E0" stopOpacity="0" />
                </radialGradient>
                <clipPath id={`${id}-clip`}>
                    <rect width="40" height="40" rx="11" />
                </clipPath>
            </defs>

            <rect width="40" height="40" rx="11" fill={`url(#${id}-tile)`} />

            <g clipPath={`url(#${id}-clip)`}>
                <circle
                    cx="20"
                    cy="27"
                    r="11"
                    fill={`url(#${id}-glow)`}
                    className="opacity-0 transition-opacity duration-500 group-hover/brand:opacity-100"
                />
                <path
                    d="M-6-4h9l-14 48h-9z"
                    fill="#fff"
                    fillOpacity="0.22"
                    className="group-hover/brand:translate-x-[62px] group-hover/brand:transition-[translate] group-hover/brand:duration-700 group-hover/brand:ease-out"
                />
            </g>

            <rect
                x="0.75"
                y="0.75"
                width="38.5"
                height="38.5"
                rx="10.25"
                stroke={`url(#${id}-rim)`}
                strokeWidth="1.5"
            />

            <g
                className={cn(
                    'origin-center [transform-box:fill-box]',
                    intro && 'motion-safe:animate-mark-pop',
                )}
            >
                <circle
                    cx="30.5"
                    cy="11.5"
                    r="1.6"
                    fill="#fff"
                    className="transition-[translate] duration-500 group-hover/brand:-translate-y-[2px] motion-safe:animate-twinkle"
                />
            </g>

            <path
                d="M8 32.5h24"
                stroke="#fff"
                strokeOpacity="0.45"
                strokeWidth="1.5"
                strokeLinecap="round"
            />

            <g
                className={cn(
                    'origin-bottom [transform-box:fill-box]',
                    intro && 'motion-safe:animate-mark-rise',
                )}
            >
                <path
                    d="M9.5 29 20 11l10.5 18h-6.9L20 22l-3.6 7z"
                    fill="#fff"
                    stroke="#fff"
                    strokeWidth="1.5"
                    strokeLinejoin="round"
                />
                <path
                    d="m20 11 1.7-2.9M20 11l-1.7-2.9"
                    stroke="#fff"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                />
                <path
                    d="m16.4 29 3.6-7 3.6 7z"
                    fill="#6FDCF7"
                    className="opacity-0 transition-opacity duration-500 group-hover/brand:opacity-100"
                />
            </g>
        </svg>
    );
}

/**
 * The two-tone brand name: "Estate" takes the surrounding text colour and
 * "Camp" is always brand cyan.
 */
export function BrandWordmark({ className }) {
    return (
        <span
            className={cn('font-display font-bold tracking-tight', className)}
        >
            Estate<span className="text-brand-cyan">Camp</span>
        </span>
    );
}

export default function BrandLogo({ className, intro = false }) {
    return (
        <Link
            href="/"
            aria-label={`${BRAND_NAME} home`}
            className={cn(
                'group/brand flex w-fit items-center gap-2.5 rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
                className,
            )}
        >
            <BrandMark intro={intro} />
            <BrandWordmark className="text-lg" />
        </Link>
    );
}
