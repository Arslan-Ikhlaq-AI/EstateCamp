import { TERMS_SECTIONS } from '@/lib/terms';
import { cn } from '@/lib/utils';

const sectionNumber = (index) => String(index + 1).padStart(2, '0');

/**
 * The Terms of Service, section by section, each numbered and linkable
 * (`#terms-<id>`).
 */
export default function TermsContent({ className }) {
    return (
        <div className={cn('flex flex-col gap-8', className)}>
            {TERMS_SECTIONS.map((section, index) => (
                <section key={section.id} id={`terms-${section.id}`} aria-labelledby={`terms-${section.id}-title`} className="flex scroll-mt-28 flex-col gap-3">
                    <h2 id={`terms-${section.id}-title`} className="flex items-baseline gap-3 text-[1.05rem] font-bold tracking-tight text-foreground">
                        <span className="text-sm font-extrabold text-brand-ink tabular-nums">{sectionNumber(index)}</span>
                        {section.title}
                    </h2>
                    {section.paragraphs.map((paragraph) => (
                        <p key={paragraph} className="text-[0.9375rem] leading-relaxed text-pretty text-foreground/80">
                            {paragraph}
                        </p>
                    ))}
                    {section.points && (
                        <ul className="flex flex-col gap-2.5">
                            {section.points.map((point) => (
                                <li key={point} className="flex gap-3 text-[0.9375rem] leading-relaxed text-pretty text-foreground/80">
                                    <span aria-hidden="true" className="mt-[0.6rem] size-1.5 shrink-0 rounded-full bg-brand-cyan" />
                                    {point}
                                </li>
                            ))}
                        </ul>
                    )}
                </section>
            ))}
        </div>
    );
}

/**
 * Links to each section, for a table of contents.
 */
export function TermsOutline({ className }) {
    return (
        <nav aria-label="Sections" className={className}>
            <ol className="flex flex-col gap-0.5">
                {TERMS_SECTIONS.map((section, index) => (
                    <li key={section.id}>
                        <a
                            href={`#terms-${section.id}`}
                            className="flex gap-3 rounded-lg px-3 py-1.5 text-sm text-muted-foreground transition-colors outline-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
                        >
                            <span className="font-semibold text-brand-ink tabular-nums">{sectionNumber(index)}</span>
                            {section.title}
                        </a>
                    </li>
                ))}
            </ol>
        </nav>
    );
}
