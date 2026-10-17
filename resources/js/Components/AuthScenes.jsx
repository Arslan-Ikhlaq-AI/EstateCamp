/**
 * Illustrated camp scenes for the auth showcase, drawn in the brand palette.
 *
 * Every scene is split into depth layers. The showcase sets `--mx` / `--my`
 * (-1..1) from the pointer position on an ancestor element and `Layer` turns
 * them into a parallax offset, so moving the pointer never re-renders React.
 */

const round = (value) => Math.round(value * 10) / 10;

/**
 * Seeded PRNG so star fields and forests are identical on every render.
 *
 * @param {number} seed
 * @return {() => number}
 */
function createRandom(seed) {
    let state = seed;

    return () => {
        state = (state * 16807) % 2147483647;

        return (state - 1) / 2147483646;
    };
}

/**
 * Stars behind the showcase copy are dimmed and still, and none sit beside
 * the logo, so they never read as stray punctuation.
 *
 * @param {{x: number, y: number}} star
 */
const isBehindLogo = ({ x, y }) => x < 330 && y < 120;
const isBehindCopy = ({ x, y }) => x < 620 && y < 400;

/**
 * @param {Array<{key: string, x: number, y: number, r: number, opacity: number, twinkles: boolean, delay: number}>} stars
 */
function settleStars(stars) {
    return stars
        .filter((star) => !isBehindLogo(star))
        .map((star) => {
            const isMuted = isBehindCopy(star);

            return {
                ...star,
                opacity: round(isMuted ? star.opacity * 0.35 : star.opacity),
                twinkles: star.twinkles && !isMuted,
            };
        });
}

/**
 * @param {{seed: number, count: number, bottom: number, maxOpacity?: number}} options
 */
function createStars({ seed, count, bottom, maxOpacity = 0.95 }) {
    const random = createRandom(seed);

    return settleStars(
        Array.from({ length: count }, (_, index) => ({
            key: `star-${index}`,
            x: round(-40 + random() * 880),
            // Raising to a power packs more stars near the top of the sky.
            y: round(random() ** 1.7 * bottom),
            r: round(0.5 + random() * 1.1),
            opacity: (0.3 + random() * 0.7) * maxOpacity,
            twinkles: random() < 0.25,
            delay: round(random() * 4),
        })),
    );
}

/**
 * Stars scattered along a diagonal band, for the night scene's milky way.
 */
function createGalaxyStars({ seed, count }) {
    const random = createRandom(seed);

    return settleStars(
        Array.from({ length: count }, (_, index) => {
            const x = -40 + random() * 880;

            return {
                key: `galaxy-${index}`,
                x: round(x),
                y: round(260 - 0.58 * (x - 560) + (random() - 0.5) * 90),
                r: round(0.5 + random() * 0.9),
                opacity: 0.25 + random() * 0.5,
                twinkles: random() < 0.2,
                delay: round(random() * 4),
            };
        }),
    );
}

/**
 * A three-tier pine silhouette standing on (x, y).
 */
function pine(x, y, height) {
    const point = (dx, dy) =>
        `${round(x + dx * height)} ${round(y - dy * height)}`;

    return [
        `M${point(0, 1)}`,
        `L${point(0.13, 0.62)}L${point(0.06, 0.62)}`,
        `L${point(0.19, 0.32)}L${point(0.09, 0.32)}`,
        `L${point(0.24, 0.06)}L${point(0.035, 0.06)}`,
        `L${point(0.035, 0)}L${point(-0.035, 0)}`,
        `L${point(-0.035, 0.06)}L${point(-0.24, 0.06)}`,
        `L${point(-0.09, 0.32)}L${point(-0.19, 0.32)}`,
        `L${point(-0.06, 0.62)}L${point(-0.13, 0.62)}Z`,
    ].join('');
}

/**
 * @param {Array<[number, number, number]>} trees `[x, y, height]` tuples
 */
const forest = (trees) => trees.map((tree) => pine(...tree)).join('');

/**
 * A palm silhouette whose crown sits `lean` units to the side of its base.
 */
function palm(x, base, height, lean) {
    const crownX = x + lean;
    const crownY = base - height;
    const bendX = x + lean * 0.3;
    const bendY = base - height * 0.55;

    const trunk = `M${x - 5} ${base}Q${bendX - 3} ${bendY} ${crownX - 1.6} ${crownY}L${crownX + 1.6} ${crownY}Q${bendX + 3} ${bendY} ${x + 5} ${base}Z`;

    const fronds = [-166, -138, -108, -74, -44, -14, 18, 160].map(
        (angle, index) => {
            const length = height * (index % 2 === 0 ? 0.52 : 0.44);
            const radians = (angle * Math.PI) / 180;
            const directionX = Math.cos(radians);
            const directionY = Math.sin(radians);
            const width = length * 0.17;
            const tipX = round(crownX + directionX * length);
            const tipY = round(crownY + directionY * length + length * 0.38);
            const middleX = crownX + directionX * length * 0.55;
            const middleY = crownY + directionY * length * 0.55 - length * 0.12;

            return `M${crownX} ${crownY}Q${round(middleX - directionY * width)} ${round(middleY + directionX * width)} ${tipX} ${tipY}Q${round(middleX + directionY * width * 0.5)} ${round(middleY - directionX * width * 0.5)} ${crownX} ${crownY}Z`;
        },
    );

    return trunk + fronds.join('');
}

function SceneCanvas({ children }) {
    return (
        <svg
            viewBox="0 0 800 1000"
            preserveAspectRatio="xMidYMid slice"
            fill="none"
            aria-hidden="true"
            className="absolute inset-0 size-full"
        >
            {children}
        </svg>
    );
}

function Layer({ depth, children }) {
    return (
        <g
            className="transition-transform duration-700 ease-out"
            style={{
                transform: `translate3d(calc(var(--mx) * ${depth}px), calc(var(--my) * ${depth * 0.4}px), 0)`,
            }}
        >
            {children}
        </g>
    );
}

function Stars({ stars }) {
    return stars.map((star) => (
        <circle
            key={star.key}
            cx={star.x}
            cy={star.y}
            r={star.r}
            fill="#fff"
            fillOpacity={star.opacity}
            className={star.twinkles ? 'motion-safe:animate-twinkle' : undefined}
            style={
                star.twinkles ? { animationDelay: `${star.delay}s` } : undefined
            }
        />
    ));
}

/**
 * A live "this camp" pin: a pulsing beacon with a label floating above it.
 */
function CampMarker({ x, y, title, meta }) {
    const width = 222;
    const height = 56;
    const left = x - width / 2;
    const top = y - 40 - height;

    return (
        <g>
            <path
                d={`M${x} ${y - 9}V${top + height}`}
                stroke="#fff"
                strokeOpacity="0.5"
                strokeDasharray="2 4"
                strokeLinecap="round"
            />
            <circle
                cx={x}
                cy={y}
                r="8"
                stroke="#9BE7F7"
                strokeWidth="1.5"
                className="origin-center [transform-box:fill-box] motion-safe:animate-ping-soft"
            />
            <circle cx={x} cy={y} r="7" fill="#1CB5E0" fillOpacity="0.35" />
            <circle cx={x} cy={y} r="3.5" fill="#fff" />

            <g transform={`translate(${left} ${top})`}>
                <rect
                    width={width}
                    height={height}
                    rx="18"
                    fill="#000851"
                    fillOpacity="0.62"
                    stroke="#fff"
                    strokeOpacity="0.2"
                />
                <circle cx="24" cy="28" r="5" fill="#1CB5E0" />
                <circle
                    cx="24"
                    cy="28"
                    r="9"
                    fill="#1CB5E0"
                    fillOpacity="0.25"
                />
                <text x="43" y="24" fill="#fff" fontSize="15" fontWeight="600">
                    {title}
                </text>
                <text x="43" y="42" fill="#fff" fillOpacity="0.72" fontSize="13">
                    {meta}
                </text>
            </g>
        </g>
    );
}

function AFrameCabin({ x, base, width, height }) {
    const half = width / 2;
    const glassHalf = half * 0.56;
    const glassTop = base - height * 0.62;

    return (
        <g>
            <path
                d={`M${x - half - 3} ${base + 1}L${x} ${base - height - 4}L${x + half + 3} ${base + 1}`}
                stroke="#1D4F95"
                strokeWidth="3"
                strokeLinejoin="round"
            />
            <path
                d={`M${x - half} ${base}L${x} ${base - height}L${x + half} ${base}Z`}
                fill="#061744"
            />
            <path
                d={`M${x - glassHalf} ${base}L${x} ${glassTop}L${x + glassHalf} ${base}Z`}
                fill="#D4F6FF"
                fillOpacity="0.92"
            />
            <path
                d={`M${x} ${glassTop}V${base}M${x - glassHalf * 0.66} ${base - height * 0.21}H${x + glassHalf * 0.66}`}
                stroke="#061744"
                strokeWidth="1.5"
            />
        </g>
    );
}

function GlowTent({ x, base, width, height, fill }) {
    const half = width / 2;

    return (
        <g>
            <path
                d={`M${x - half} ${base}Q${x - half * 0.5} ${base - height * 0.55} ${x} ${base - height}Q${x + half * 0.5} ${base - height * 0.55} ${x + half} ${base}Z`}
                fill={fill}
            />
            <path
                d={`M${x - half * 0.24} ${base}L${x} ${base - height * 0.52}L${x + half * 0.24} ${base}Z`}
                fill="#0A2A66"
                fillOpacity="0.6"
            />
            <path
                d={`M${x} ${base - height}V${base - height - 5}`}
                stroke="#0A2A66"
                strokeWidth="1.5"
                strokeLinecap="round"
            />
        </g>
    );
}

function Lantern({ x, base, glow }) {
    return (
        <g>
            <circle cx={x} cy={base - 12} r="9" fill={glow} />
            <path d={`M${x} ${base}V${base - 10}`} stroke="#061744" strokeWidth="1.5" />
            <circle cx={x} cy={base - 12} r="2" fill="#E6FBFF" />
        </g>
    );
}

/**
 * A gabled lodge with lit windows and a rim of morning light on its roof.
 */
function Lodge({ x, base, width, wall, roof, hasChimney = false }) {
    const half = width / 2;
    const eave = base - wall;

    return (
        <g>
            {hasChimney && (
                <rect x={x + half * 0.38} y={eave - roof * 0.95} width="7" height={roof * 0.7} fill="#071D52" />
            )}
            <rect x={x - half} y={eave} width={width} height={wall} fill="#071D52" />
            <path
                d={`M${x - half - 6} ${eave + 1}L${x} ${eave - roof}L${x + half + 6} ${eave + 1}Z`}
                fill="#0A2763"
            />
            <path
                d={`M${x} ${eave - roof}L${x + half + 6} ${eave + 1}`}
                stroke="#9FE2F5"
                strokeOpacity="0.6"
                strokeWidth="1.5"
                strokeLinecap="round"
            />
            <rect x={x - half * 0.62} y={eave + wall * 0.28} width={width * 0.18} height={wall * 0.36} rx="1" fill="#E3FAFF" fillOpacity="0.9" />
            <rect x={x + half * 0.26} y={eave + wall * 0.28} width={width * 0.18} height={wall * 0.36} rx="1" fill="#E3FAFF" fillOpacity="0.9" />
            <rect x={x - width * 0.06} y={base - wall * 0.55} width={width * 0.12} height={wall * 0.55} fill="#04133A" />
        </g>
    );
}

/**
 * A row of modular accommodation units with a scattering of lit windows.
 */
function AccommodationBlock({ x, y, width, height, seed }) {
    const windowWidth = round(height * 0.22);
    const windowHeight = round(height * 0.34);
    const step = round(height * 0.55);
    const count = Math.floor((width - 12) / step);

    return (
        <g>
            <rect x={x} y={y} width={width} height={height} fill="#061A4D" />
            <path d={`M${x} ${y + 0.75}H${x + width}`} stroke="#2F6FBE" strokeOpacity="0.85" strokeWidth="1.5" />
            {Array.from({ length: count }, (_, index) => {
                const isLit = (seed * 7 + index * 3) % 5 < 3;

                return (
                    <rect
                        key={index}
                        x={round(x + 8 + index * step)}
                        y={round(y + height * 0.34)}
                        width={windowWidth}
                        height={windowHeight}
                        fill={isLit ? '#D4F6FF' : '#2A5597'}
                        fillOpacity={isLit ? 0.95 : 0.5}
                    />
                );
            })}
        </g>
    );
}

function LightMast({ x, base, top }) {
    return (
        <g>
            <path d={`M${x - 4} ${top + 3}L${x - 30} ${base}H${x + 30}L${x + 4} ${top + 3}Z`} fill="url(#night-cone)" />
            <circle cx={x} cy={top} r="24" fill="url(#night-lamp)" />
            <path d={`M${x} ${base}V${top}`} stroke="#0A2356" strokeWidth="2.2" />
            <rect x={x - 7} y={top - 3} width="14" height="5" rx="1.5" fill="#0A2356" />
            <rect x={x - 5} y={top + 1} width="10" height="2" fill="#E6FBFF" />
        </g>
    );
}

function WaterTower({ x, base }) {
    return (
        <g stroke="#0A2356" strokeWidth="2">
            <path d={`M${x - 12} ${base}L${x - 8} ${base - 48}M${x + 12} ${base}L${x + 8} ${base - 48}M${x - 11} ${base - 12}L${x + 9} ${base - 30}M${x + 11} ${base - 12}L${x - 9} ${base - 30}`} />
            <rect x={x - 16} y={base - 72} width="32" height="24" rx="2" fill="#081F55" />
            <path d={`M${x - 17} ${base - 72}L${x} ${base - 82}L${x + 17} ${base - 72}Z`} fill="#081F55" />
        </g>
    );
}

const DUSK_FAR_CREST =
    'M-60 670L-10 640L40 610L80 622L130 580L170 595L215 548L250 528L280 555L305 547L340 580L375 562L420 512L470 478L505 508L530 500L570 542L610 555L650 532L685 516L720 542L760 562L800 548L860 580';
const DUSK_MID_CREST =
    'M-60 725L-20 700L30 673L75 685L120 645L160 663L205 635L245 657L290 645L330 675L370 663L410 685L455 657L500 630L540 645L585 623L630 651L670 641L715 670L760 650L800 665L860 685';

const DUSK = {
    stars: createStars({ seed: 11, count: 70, bottom: 470 }),
    farCrest: DUSK_FAR_CREST,
    far: `${DUSK_FAR_CREST}V830H-60Z`,
    snow: 'M470 478L450 491.6L456 497L462 494L468 502L474 496L480 500L485.7 491.5ZM250 528L232.5 538L238 543L244 540L250 546L256 541L261 544L265 541.5ZM685 516L667.5 524L672 529L679 526L685 533L691 528L697 532L702.5 529Z',
    midCrest: DUSK_MID_CREST,
    mid: `${DUSK_MID_CREST}V860H-60Z`,
    ridge: 'M-60 768C40 740 130 728 220 736C290 742 330 750 400 750C470 750 520 740 590 734C680 726 760 740 860 756V930H-60Z',
    ridgePines: forest([
        [-36, 768, 50], [-14, 762, 62], [8, 755, 44], [28, 750, 56],
        [48, 746, 38], [66, 743, 50], [86, 741, 32], [104, 740, 44],
        [124, 739, 28], [142, 738, 36], [164, 738, 24], [186, 739, 30],
        [214, 741, 20], [244, 744, 15],
        [578, 741, 22], [598, 739, 30], [618, 737, 20], [636, 736, 34],
        [656, 735, 26], [674, 735, 42], [694, 736, 32], [714, 738, 50],
        [736, 741, 38], [758, 744, 56], [780, 748, 44], [802, 752, 62],
        [826, 756, 48], [848, 760, 66],
    ]),
    ground: 'M-60 832C80 806 220 810 360 828C500 846 640 830 860 810V1060H-60Z',
    framePines: forest([
        [-24, 852, 250], [34, 846, 175], [714, 834, 130], [766, 828, 270], [826, 822, 205],
    ]),
};

export function DuskScene() {
    return (
        <SceneCanvas>
            <defs>
                <linearGradient id="dusk-sky" x1="0" y1="0" x2="0" y2="610" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#000851" />
                    <stop offset="0.32" stopColor="#041A6B" />
                    <stop offset="0.58" stopColor="#0A3D8F" />
                    <stop offset="0.74" stopColor="#1673BD" />
                    <stop offset="0.86" stopColor="#2FB0E0" />
                    <stop offset="0.95" stopColor="#8BE3F5" />
                    <stop offset="1" stopColor="#D4F7FD" />
                </linearGradient>
                <radialGradient id="dusk-bloom" cx="420" cy="560" r="400" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#C8F6FF" stopOpacity="0.5" />
                    <stop offset="1" stopColor="#C8F6FF" stopOpacity="0" />
                </radialGradient>
                <linearGradient id="dusk-far" x1="0" y1="470" x2="0" y2="800" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#3E6FB3" />
                    <stop offset="1" stopColor="#24589E" />
                </linearGradient>
                <linearGradient id="dusk-mid" x1="0" y1="620" x2="0" y2="840" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#1D4A8F" />
                    <stop offset="1" stopColor="#113472" />
                </linearGradient>
                <linearGradient id="dusk-ridge" x1="0" y1="720" x2="0" y2="920" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#0D2B68" />
                    <stop offset="1" stopColor="#081D4F" />
                </linearGradient>
                <linearGradient id="dusk-ground" x1="0" y1="800" x2="0" y2="1060" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#061543" />
                    <stop offset="1" stopColor="#010622" />
                </linearGradient>
                <linearGradient id="dusk-haze" x1="0" y1="600" x2="0" y2="770" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#D6F6FF" stopOpacity="0" />
                    <stop offset="0.6" stopColor="#D6F6FF" stopOpacity="0.22" />
                    <stop offset="1" stopColor="#D6F6FF" stopOpacity="0" />
                </linearGradient>
                <linearGradient id="dusk-tent" x1="0" y1="0" x2="0" y2="1">
                    <stop stopColor="#7FD6F0" />
                    <stop offset="1" stopColor="#E3FBFF" />
                </linearGradient>
                <radialGradient id="dusk-light">
                    <stop stopColor="#D9F8FF" stopOpacity="0.5" />
                    <stop offset="1" stopColor="#D9F8FF" stopOpacity="0" />
                </radialGradient>
                <mask id="dusk-moon-cut">
                    <rect width="800" height="1000" fill="#fff" />
                    <circle cx="664" cy="143" r="17" fill="#000" />
                </mask>
            </defs>

            <rect x="-60" y="-60" width="920" height="1120" fill="url(#dusk-sky)" />
            <rect x="-60" y="-60" width="920" height="1120" fill="url(#dusk-bloom)" />
            <Stars stars={DUSK.stars} />
            <circle cx="656" cy="150" r="19" fill="#EAFCFF" mask="url(#dusk-moon-cut)" />

            <Layer depth={6}>
                <path d={DUSK.far} fill="url(#dusk-far)" />
                <path d={DUSK.farCrest} stroke="#C8F6FF" strokeOpacity="0.4" strokeWidth="1.2" strokeLinejoin="round" />
                <path d={DUSK.snow} fill="#E6F8FF" fillOpacity="0.55" />
                <rect x="-60" y="600" width="920" height="170" fill="url(#dusk-haze)" />
            </Layer>

            <Layer depth={12}>
                <path d={DUSK.mid} fill="url(#dusk-mid)" />
                <path d={DUSK.midCrest} stroke="#9FDCF5" strokeOpacity="0.2" strokeWidth="1.2" strokeLinejoin="round" />
            </Layer>

            <Layer depth={18}>
                <path d={DUSK.ridge} fill="url(#dusk-ridge)" />
                <path d={DUSK.ridgePines} fill="#0A2259" />
                <ellipse cx="412" cy="762" rx="180" ry="24" fill="url(#dusk-light)" />
                <GlowTent x={292} base={755} width={38} height={30} fill="url(#dusk-tent)" />
                <GlowTent x={532} base={754} width={36} height={28} fill="url(#dusk-tent)" />
                <AFrameCabin x={344} base={756} width={58} height={66} />
                <AFrameCabin x={480} base={756} width={54} height={62} />
                <AFrameCabin x={412} base={758} width={74} height={88} />
                {[318, 376, 448, 506].map((x) => (
                    <Lantern key={x} x={x} base={770} glow="url(#dusk-light)" />
                ))}
                <CampMarker x={412} y={648} title="Basecamp North" meta="184 of 200 beds filled" />
            </Layer>

            <Layer depth={28}>
                <path d={DUSK.ground} fill="url(#dusk-ground)" />
                <path d={DUSK.framePines} fill="#020B2E" />
            </Layer>
        </SceneCanvas>
    );
}

const NIGHT = {
    stars: createStars({ seed: 29, count: 110, bottom: 600 }),
    galaxy: createGalaxyStars({ seed: 53, count: 46 }),
    far: 'M-60 668C40 640 150 634 250 650C350 666 430 632 540 632C650 632 720 656 860 646V830H-60Z',
    farCrest: 'M250 650C350 666 430 632 540 632C650 632 720 656 860 646',
    mid: 'M-60 726C70 694 190 690 300 710C390 726 460 714 540 702C640 688 740 702 860 716V880H-60Z',
    near: 'M-60 812C90 778 230 782 360 802C490 822 600 792 720 790C780 789 830 794 860 798V1060H-60Z',
    ground: 'M-60 900C120 866 300 872 460 898C600 920 720 894 860 882V1060H-60Z',
    palms: palm(748, 900, 150, -18) + palm(794, 892, 116, 10) + palm(36, 908, 118, 14),
    backRow: [196, 304, 412, 520],
    frontRow: [176, 290, 404, 518],
    fencePosts: Array.from({ length: 39 }, (_, index) => 120 + index * 16),
};

export function NightScene() {
    return (
        <SceneCanvas>
            <defs>
                <linearGradient id="night-sky" x1="0" y1="0" x2="0" y2="760" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#00031C" />
                    <stop offset="0.32" stopColor="#000851" />
                    <stop offset="0.66" stopColor="#06297A" />
                    <stop offset="0.86" stopColor="#0D4F9E" />
                    <stop offset="1" stopColor="#1F80C4" />
                </linearGradient>
                <linearGradient id="night-galaxy" x1="0" y1="0" x2="0" y2="1">
                    <stop stopColor="#CFF6FF" stopOpacity="0" />
                    <stop offset="0.5" stopColor="#CFF6FF" stopOpacity="0.09" />
                    <stop offset="1" stopColor="#CFF6FF" stopOpacity="0" />
                </linearGradient>
                <radialGradient id="night-halo" cx="612" cy="506" r="220" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#A8ECFF" stopOpacity="0.42" />
                    <stop offset="1" stopColor="#A8ECFF" stopOpacity="0" />
                </radialGradient>
                <radialGradient id="night-moon" cx="0.4" cy="0.36" r="0.7">
                    <stop stopColor="#FFFFFF" />
                    <stop offset="1" stopColor="#CDEFFA" />
                </radialGradient>
                <linearGradient id="night-meteor" x1="0" y1="0" x2="1" y2="0">
                    <stop stopColor="#fff" stopOpacity="0" />
                    <stop offset="1" stopColor="#fff" />
                </linearGradient>
                <linearGradient id="night-far" x1="0" y1="630" x2="0" y2="800" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#2A5DA3" />
                    <stop offset="1" stopColor="#183F80" />
                </linearGradient>
                <linearGradient id="night-crest" x1="0" y1="0" x2="1" y2="0">
                    <stop stopColor="#A7E4F7" stopOpacity="0" />
                    <stop offset="0.6" stopColor="#A7E4F7" stopOpacity="0.5" />
                    <stop offset="1" stopColor="#A7E4F7" stopOpacity="0" />
                </linearGradient>
                <linearGradient id="night-mid" x1="0" y1="690" x2="0" y2="860" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#12357A" />
                    <stop offset="1" stopColor="#0B2660" />
                </linearGradient>
                <linearGradient id="night-near" x1="0" y1="780" x2="0" y2="1000" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#071B4C" />
                    <stop offset="1" stopColor="#041338" />
                </linearGradient>
                <linearGradient id="night-ground" x1="0" y1="870" x2="0" y2="1060" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#020B2C" />
                    <stop offset="1" stopColor="#00041A" />
                </linearGradient>
                <radialGradient id="night-lamp">
                    <stop stopColor="#E2FBFF" stopOpacity="0.75" />
                    <stop offset="1" stopColor="#E2FBFF" stopOpacity="0" />
                </radialGradient>
                <linearGradient id="night-cone" x1="0" y1="0" x2="0" y2="1">
                    <stop stopColor="#E2FBFF" stopOpacity="0.2" />
                    <stop offset="1" stopColor="#E2FBFF" stopOpacity="0" />
                </linearGradient>
                <radialGradient id="night-pool">
                    <stop stopColor="#8FE3F7" stopOpacity="0.26" />
                    <stop offset="1" stopColor="#8FE3F7" stopOpacity="0" />
                </radialGradient>
            </defs>

            <rect x="-60" y="-60" width="920" height="1120" fill="url(#night-sky)" />
            <rect x="-140" y="180" width="1400" height="170" fill="url(#night-galaxy)" transform="rotate(-30 560 260)" />
            <Stars stars={NIGHT.stars} />
            <Stars stars={NIGHT.galaxy} />
            <g className="motion-safe:animate-shooting-star">
                <path d="M610 64l56 28" stroke="url(#night-meteor)" strokeWidth="1.6" strokeLinecap="round" opacity="0" className="motion-safe:opacity-100" />
            </g>
            <circle cx="612" cy="506" r="220" fill="url(#night-halo)" />
            <circle cx="612" cy="506" r="54" fill="url(#night-moon)" />
            <g fill="#9CC9E0">
                <circle cx="597" cy="493" r="10" fillOpacity="0.2" />
                <circle cx="627" cy="519" r="6.5" fillOpacity="0.18" />
                <circle cx="605" cy="526" r="4.5" fillOpacity="0.14" />
                <circle cx="631" cy="487" r="4" fillOpacity="0.14" />
            </g>

            <Layer depth={5}>
                <path d={NIGHT.far} fill="url(#night-far)" />
                <path d={NIGHT.farCrest} stroke="url(#night-crest)" strokeWidth="1.5" />
            </Layer>

            <Layer depth={10}>
                <path d={NIGHT.mid} fill="url(#night-mid)" />
            </Layer>

            <Layer depth={14}>
                <ellipse cx="400" cy="758" rx="330" ry="48" fill="url(#night-pool)" />
                <LightMast x={140} base={774} top={652} />
                <LightMast x={666} base={774} top={658} />
                <WaterTower x={720} base={774} />
                {NIGHT.backRow.map((x, index) => (
                    <AccommodationBlock key={x} x={x} y={720} width={100} height={18} seed={index + 2} />
                ))}
                {NIGHT.frontRow.map((x, index) => (
                    <AccommodationBlock key={x} x={x} y={746} width={106} height={24} seed={index + 5} />
                ))}
                <path d="M120 778H740" stroke="#24569C" strokeOpacity="0.5" />
                <path
                    d={NIGHT.fencePosts.map((x) => `M${x} 772V778`).join('')}
                    stroke="#24569C"
                    strokeOpacity="0.5"
                />
                <CampMarker x={412} y={700} title="Desert Camp" meta="36 check-ins tonight" />
            </Layer>

            <Layer depth={18}>
                <path d={NIGHT.near} fill="url(#night-near)" />
            </Layer>

            <Layer depth={26}>
                <path d={NIGHT.ground} fill="url(#night-ground)" />
                <path d={NIGHT.palms} fill="#010826" />
            </Layer>
        </SceneCanvas>
    );
}

const DAWN_HILL = [
    [-60, 724], [80, 707], [200, 705], [320, 714], [430, 722],
    [520, 709], [620, 704], [720, 701], [800, 710], [860, 718],
];

/**
 * Linear interpolation along the mid-hill crest, used to plant its forest.
 */
function dawnHillY(x) {
    const nextIndex = DAWN_HILL.findIndex(([pointX]) => pointX >= x);

    if (nextIndex <= 0) {
        return DAWN_HILL.at(nextIndex === 0 ? 0 : -1)[1];
    }

    const [x1, y1] = DAWN_HILL[nextIndex - 1];
    const [x2, y2] = DAWN_HILL[nextIndex];

    return y1 + ((x - x1) / (x2 - x1)) * (y2 - y1);
}

const dawnRandom = createRandom(71);

const DAWN = {
    stars: createStars({ seed: 41, count: 22, bottom: 260, maxOpacity: 0.45 }),
    clouds: [
        { cx: 190, cy: 516, rx: 170, ry: 16, opacity: 0.4, delay: 0 },
        { cx: 630, cy: 462, rx: 190, ry: 18, opacity: 0.3, delay: -9 },
        { cx: 460, cy: 592, rx: 120, ry: 10, opacity: 0.45, delay: -15 },
    ],
    far: 'M-60 694C60 654 170 648 280 668C370 684 430 666 520 676C600 684 640 658 720 652C780 648 820 660 860 666V790H-60Z',
    mid: 'M-60 724C80 700 200 704 320 714C430 723 520 708 620 704C720 700 800 712 860 718V740H-60Z',
    midPines: forest(
        Array.from({ length: 96 }, (_, index) => {
            const x = -56 + index * 9.4 + dawnRandom() * 7;
            // Thinned and uneven, so the tree line reads as forest, not a fence.
            const height = dawnRandom() < 0.3 ? 0 : 7 + dawnRandom() ** 1.5 * 24;

            return [round(x), round(dawnHillY(x) + 3), round(height)];
        }).filter(([, , height]) => height > 0),
    ),
    reflection: 'M-60 748C80 772 200 768 320 758C430 749 520 764 620 768C720 772 800 760 860 754V736H-60Z',
    sunGlints: [
        [744, 64], [752, 50], [760, 56], [769, 38], [779, 42],
        [790, 28], [802, 32], [815, 20], [829, 13],
    ],
    ripples: [
        [90, 760, 70], [260, 776, 54], [640, 772, 84], [720, 790, 46], [380, 798, 40],
    ],
    shore: 'M-60 806C40 792 140 786 250 790C330 793 380 806 420 822C460 838 540 846 640 850C740 854 800 848 860 844V1060H-60Z',
    shorePines: forest([[4, 814, 200], [48, 806, 146], [84, 800, 98]]),
    ground: 'M-60 908C140 878 320 886 470 904C620 922 740 900 860 890V1060H-60Z',
    reeds: Array.from({ length: 14 }, (_, index) => {
        const x = 618 + index * 13;
        const height = 34 + ((index * 17) % 5) * 8;
        const bend = index % 2 === 0 ? 7 : -5;

        return `M${x} 912Q${x + bend * 0.4} ${912 - height * 0.6} ${x + bend} ${912 - height}`;
    }).join(''),
};

export function DawnScene() {
    return (
        <SceneCanvas>
            <defs>
                <linearGradient id="dawn-sky" x1="0" y1="0" x2="0" y2="740" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#04175F" />
                    <stop offset="0.42" stopColor="#0C3F95" />
                    <stop offset="0.64" stopColor="#1679C2" />
                    <stop offset="0.82" stopColor="#3FC0E8" />
                    <stop offset="0.93" stopColor="#B3EEFA" />
                    <stop offset="1" stopColor="#EAFCFF" />
                </linearGradient>
                <radialGradient id="dawn-halo" cx="552" cy="676" r="340" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#FFFFFF" stopOpacity="0.8" />
                    <stop offset="0.3" stopColor="#BFF3FF" stopOpacity="0.32" />
                    <stop offset="1" stopColor="#BFF3FF" stopOpacity="0" />
                </radialGradient>
                <radialGradient id="dawn-cloud">
                    <stop stopColor="#fff" />
                    <stop offset="0.45" stopColor="#fff" stopOpacity="0.6" />
                    <stop offset="1" stopColor="#fff" stopOpacity="0" />
                </radialGradient>
                <linearGradient id="dawn-far" x1="0" y1="650" x2="0" y2="760" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#6D9FD6" />
                    <stop offset="1" stopColor="#5288C7" />
                </linearGradient>
                <linearGradient id="dawn-mist" x1="0" y1="0" x2="0" y2="1">
                    <stop stopColor="#fff" stopOpacity="0" />
                    <stop offset="0.55" stopColor="#fff" stopOpacity="0.42" />
                    <stop offset="1" stopColor="#fff" stopOpacity="0" />
                </linearGradient>
                <linearGradient id="dawn-mid" x1="0" y1="700" x2="0" y2="740" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#2C62A8" />
                    <stop offset="1" stopColor="#1F4F93" />
                </linearGradient>
                <linearGradient id="dawn-lake" x1="0" y1="736" x2="0" y2="860" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#C8F3FB" />
                    <stop offset="0.35" stopColor="#4FB6E0" />
                    <stop offset="1" stopColor="#1663A8" />
                </linearGradient>
                <linearGradient id="dawn-shore" x1="0" y1="786" x2="0" y2="960" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#0B2A68" />
                    <stop offset="1" stopColor="#061D52" />
                </linearGradient>
                <linearGradient id="dawn-ground" x1="0" y1="880" x2="0" y2="1060" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#041542" />
                    <stop offset="1" stopColor="#01072A" />
                </linearGradient>
                <radialGradient id="dawn-pool">
                    <stop stopColor="#F2FDFF" stopOpacity="0.4" />
                    <stop offset="1" stopColor="#F2FDFF" stopOpacity="0" />
                </radialGradient>
            </defs>

            <rect x="-60" y="-60" width="920" height="1120" fill="url(#dawn-sky)" />
            <Stars stars={DAWN.stars} />
            <circle cx="552" cy="676" r="340" fill="url(#dawn-halo)" />
            <circle cx="552" cy="676" r="30" fill="#fff" />
            {DAWN.clouds.map((cloud) => (
                <g
                    key={cloud.cx}
                    className="motion-safe:animate-drift"
                    style={{ animationDelay: `${cloud.delay}s` }}
                >
                    <ellipse
                        cx={cloud.cx}
                        cy={cloud.cy}
                        rx={cloud.rx}
                        ry={cloud.ry}
                        fill="url(#dawn-cloud)"
                        fillOpacity={cloud.opacity}
                    />
                </g>
            ))}

            <Layer depth={4}>
                <path d={DAWN.far} fill="url(#dawn-far)" />
                <g className="motion-safe:animate-drift" style={{ animationDelay: '-11s' }}>
                    <rect x="-100" y="662" width="1000" height="70" fill="url(#dawn-mist)" />
                </g>
            </Layer>

            <Layer depth={8}>
                <path d={DAWN.mid} fill="url(#dawn-mid)" />
                <path d={DAWN.midPines} fill="#1B4A8D" />
                <rect x="-60" y="736" width="920" height="150" fill="url(#dawn-lake)" />
                <path d={DAWN.reflection} fill="#2A5FA6" fillOpacity="0.35" />
                {DAWN.sunGlints.map(([y, width], index) => (
                    <path
                        key={y}
                        d={`M${552 - width / 2} ${y}h${width}`}
                        stroke="#fff"
                        strokeOpacity={0.75 - index * 0.06}
                        strokeWidth="2"
                        strokeLinecap="round"
                        className={index % 3 === 1 ? 'motion-safe:animate-twinkle' : undefined}
                        style={{ animationDelay: `${index * 0.4}s` }}
                    />
                ))}
                {DAWN.ripples.map(([x, y, width]) => (
                    <path
                        key={x}
                        d={`M${x} ${y}h${width}`}
                        stroke="#fff"
                        strokeOpacity="0.22"
                        strokeLinecap="round"
                    />
                ))}
            </Layer>

            <Layer depth={14}>
                <path d={DAWN.shore} fill="url(#dawn-shore)" />
                <ellipse cx="246" cy="800" rx="160" ry="16" fill="url(#dawn-pool)" />
                <path d="M366 805h148v4H366z" fill="#082256" />
                <path d="M424 809v9M454 809v9M484 809v9M512 809v9" stroke="#082256" strokeWidth="2" />
                <path d="M424 820v6M454 820v6M484 820v6M512 820v6" stroke="#082256" strokeOpacity="0.3" strokeWidth="2" />
                <path d="M522 822q22 10 46 0q-23 6-46 0z" fill="#082256" />
                <Lodge x={150} base={794} width={66} wall={26} roof={24} />
                <Lodge x={338} base={800} width={60} wall={24} roof={22} />
                <Lodge x={246} base={793} width={90} wall={34} roof={32} hasChimney />
                <path d={DAWN.shorePines} fill="#061A4A" />
                <CampMarker x={246} y={710} title="Lakeside Lodge" meta="12 work orders closed" />
            </Layer>

            <Layer depth={24}>
                <path d={DAWN.ground} fill="url(#dawn-ground)" />
                <path d={DAWN.reeds} stroke="#021034" strokeWidth="2" strokeLinecap="round" />
            </Layer>
        </SceneCanvas>
    );
}
