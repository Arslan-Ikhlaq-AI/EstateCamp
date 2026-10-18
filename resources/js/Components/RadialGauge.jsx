import { cn } from '@/lib/utils';
import { useEffect, useId, useState } from 'react';

const clamp = (value) => Math.min(Math.max(value ?? 0, 0), 100);

/**
 * A meter drawn as a ring (`arc="full"`) or a semicircle (`arc="half"`): the
 * filled part is the brand gradient, the track a pale step of the same hue.
 * The fill sweeps in on first render (skipped when motion is reduced), and
 * `children` sit in the middle. `label` names the figure for screen readers.
 */
export default function RadialGauge({ value, label, size = 120, thickness = 10, arc = 'full', className, children }) {
    const id = useId().replace(/:/g, '');
    const [isDrawn, setIsDrawn] = useState(false);

    useEffect(() => {
        const frame = requestAnimationFrame(() => setIsDrawn(true));

        return () => cancelAnimationFrame(frame);
    }, []);

    const isHalf = arc === 'half';
    const radius = (size - thickness) / 2;
    const circumference = 2 * Math.PI * radius;
    const track = isHalf ? circumference / 2 : circumference;
    const filled = (track * clamp(value)) / 100;
    const height = isHalf ? size / 2 + thickness / 2 : size;

    return (
        <div role="img" aria-label={label} className={cn('relative shrink-0', className)} style={{ width: size, height }}>
            <svg width={size} height={height} viewBox={`0 0 ${size} ${height}`} className="overflow-visible rtl:-scale-x-100">
                <defs>
                    <linearGradient id={`${id}-fill`} x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" style={{ stopColor: 'var(--color-brand-cyan)' }} />
                        <stop offset="100%" style={{ stopColor: 'var(--chart-1)' }} />
                    </linearGradient>
                </defs>
                <g transform={isHalf ? `rotate(180 ${size / 2} ${size / 2})` : `rotate(-90 ${size / 2} ${size / 2})`}>
                    <circle
                        cx={size / 2}
                        cy={size / 2}
                        r={radius}
                        fill="none"
                        strokeWidth={thickness}
                        strokeLinecap="round"
                        strokeDasharray={`${track} ${circumference}`}
                        style={{ stroke: 'color-mix(in oklab, var(--chart-1) 14%, transparent)' }}
                    />
                    {value !== null && value !== undefined && (
                        <circle
                            cx={size / 2}
                            cy={size / 2}
                            r={radius}
                            fill="none"
                            stroke={`url(#${id}-fill)`}
                            strokeWidth={thickness}
                            strokeLinecap="round"
                            strokeDasharray={`${isDrawn ? filled : 0} ${circumference}`}
                            className="transition-[stroke-dasharray] duration-1000 ease-out motion-reduce:transition-none"
                        />
                    )}
                </g>
            </svg>
            <div
                className={cn(
                    'pointer-events-none absolute inset-x-0 flex flex-col items-center text-center',
                    isHalf ? 'bottom-0' : 'inset-y-0 justify-center',
                )}
            >
                {children}
            </div>
        </div>
    );
}
