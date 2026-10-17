import { DawnScene, DuskScene, NightScene } from '@/Components/AuthScenes';
import BrandLogo from '@/Components/BrandLogo';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { PauseIcon, PlayIcon } from 'lucide-react';
import { useState } from 'react';

const SLIDE_DURATION_MS = 8000;

const SLIDES = [
    {
        key: 'occupancy',
        label: 'Occupancy',
        Scene: DuskScene,
        title: 'Every camp, every room,',
        accent: 'in one calm view.',
        description:
            'Manage accommodation, residents and facilities across all your sites from a single workspace that is always up to date.',
    },
    {
        key: 'check-ins',
        label: 'Check-ins',
        Scene: NightScene,
        title: 'Know who’s on site,',
        accent: 'around the clock.',
        description:
            'Track check-ins, room allocations and headcounts in real time, from the morning shift to the night shift.',
    },
    {
        key: 'maintenance',
        label: 'Maintenance',
        Scene: DawnScene,
        title: 'Start every day',
        accent: 'a step ahead.',
        description:
            'Plan maintenance, housekeeping and inspections before your teams clock in, and close work orders as they happen.',
    },
];

const prefersReducedMotion = () =>
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Moves the scene layers with the pointer. `--mx` / `--my` (-1..1) are set on
 * the showcase root, so the pointer never triggers a React re-render.
 */
function updateParallax(event) {
    if (prefersReducedMotion()) {
        return;
    }

    const element = event.currentTarget;
    const bounds = element.getBoundingClientRect();

    element.style.setProperty(
        '--mx',
        (((event.clientX - bounds.left) / bounds.width - 0.5) * 2).toFixed(3),
    );
    element.style.setProperty(
        '--my',
        (((event.clientY - bounds.top) / bounds.height - 0.5) * 2).toFixed(3),
    );
}

export default function AuthShowcase() {
    const [activeIndex, setActiveIndex] = useState(0);
    const [isPlaying, setIsPlaying] = useState(() => !prefersReducedMotion());
    const [isHovered, setIsHovered] = useState(false);
    const [hasFocusWithin, setHasFocusWithin] = useState(false);

    const activeSlide = SLIDES[activeIndex];
    const isHeld = isHovered || hasFocusWithin;

    const showNextSlide = () =>
        setActiveIndex((index) => (index + 1) % SLIDES.length);

    const handlePointerLeave = (event) => {
        setIsHovered(false);
        event.currentTarget.style.setProperty('--mx', '0');
        event.currentTarget.style.setProperty('--my', '0');
    };

    const handleBlur = (event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
            setHasFocusWithin(false);
        }
    };

    return (
        <section
            aria-roledescription="carousel"
            aria-label="EstateCamp highlights"
            onPointerEnter={() => setIsHovered(true)}
            onPointerMove={updateParallax}
            onPointerLeave={handlePointerLeave}
            onFocus={() => setHasFocusWithin(true)}
            onBlur={handleBlur}
            style={{ '--mx': 0, '--my': 0 }}
            className="dark relative isolate hidden flex-col overflow-hidden bg-brand-navy text-white lg:flex"
        >
            <div aria-hidden="true" className="absolute inset-0 -z-10">
                {SLIDES.map(({ key, Scene }, index) => (
                    <div
                        key={key}
                        className={cn(
                            'absolute inset-0 transition-[opacity,visibility] duration-[1400ms] ease-out motion-reduce:transition-none',
                            index === activeIndex
                                ? 'visible opacity-100'
                                : 'invisible opacity-0',
                        )}
                    >
                        <Scene />
                    </div>
                ))}
                <div className="absolute inset-x-0 top-0 h-3/5 bg-linear-to-b from-brand-navy/60 via-brand-navy/20 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 h-1/5 bg-linear-to-t from-brand-navy/60 to-transparent" />
                <div className="absolute inset-0 bg-grain opacity-[0.09] mix-blend-overlay" />
            </div>

            <header className="flex items-center p-8 xl:px-12 xl:pt-10">
                <BrandLogo />
            </header>

            <div className="flex flex-1 flex-col justify-between gap-12 px-8 pb-8 xl:px-12 xl:pb-10">
                <div aria-live={isPlaying ? 'off' : 'polite'}>
                    <div
                        key={activeSlide.key}
                        role="group"
                        aria-roledescription="slide"
                        aria-label={`${activeIndex + 1} of ${SLIDES.length}`}
                        className="flex max-w-xl flex-col gap-5 motion-safe:animate-in motion-safe:duration-700 motion-safe:fade-in motion-safe:slide-in-from-bottom-3 2xl:max-w-2xl"
                    >
                        <h2 className="font-display text-[2.6rem] leading-[1.06] font-semibold tracking-tight text-balance xl:text-[3.3rem] 2xl:text-[3.75rem]">
                            {activeSlide.title}{' '}
                            <span className="font-serif font-normal tracking-normal text-brand-sun italic">
                                {activeSlide.accent}
                            </span>
                        </h2>
                        <p className="max-w-md text-base leading-relaxed text-pretty text-white/70">
                            {activeSlide.description}
                        </p>
                    </div>
                </div>

                <div className="flex items-end gap-6">
                    <div className="grid flex-1 grid-cols-3 gap-4">
                        {SLIDES.map((slide, index) => {
                            const isActive = index === activeIndex;

                            return (
                                <button
                                    key={slide.key}
                                    type="button"
                                    onClick={() => setActiveIndex(index)}
                                    aria-current={isActive ? 'true' : undefined}
                                    className="group/slide flex flex-col gap-3 rounded-md pt-2 pb-1 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                                >
                                    <span className="relative h-0.5 overflow-hidden rounded-full bg-white/20">
                                        {isActive && (
                                            <span
                                                key={isPlaying ? 'playing' : 'paused'}
                                                onAnimationEnd={showNextSlide}
                                                className={cn(
                                                    'absolute inset-0 origin-left rounded-full bg-white',
                                                    isPlaying && 'animate-slide-progress',
                                                )}
                                                style={
                                                    isPlaying
                                                        ? {
                                                              animationDuration: `${SLIDE_DURATION_MS}ms`,
                                                              animationPlayState: isHeld ? 'paused' : 'running',
                                                          }
                                                        : undefined
                                                }
                                            />
                                        )}
                                    </span>
                                    <span
                                        className={cn(
                                            'text-sm font-medium text-white/55 transition-colors group-hover/slide:text-white/85',
                                            isActive && 'text-white',
                                        )}
                                    >
                                        {slide.label}
                                    </span>
                                </button>
                            );
                        })}
                    </div>

                    <Button
                        variant="outline"
                        size="icon-lg"
                        className="rounded-full backdrop-blur-md"
                        aria-label={isPlaying ? 'Pause slideshow' : 'Play slideshow'}
                        onClick={() => setIsPlaying((playing) => !playing)}
                    >
                        {isPlaying ? <PauseIcon /> : <PlayIcon />}
                    </Button>
                </div>
            </div>
        </section>
    );
}
