import { BrandMark, BrandWordmark } from '@/Components/BrandLogo';

/**
 * Heading for the auth forms: the EstateCamp lockup above a title whose last
 * word is set in the serif accent over a highlighter stroke.
 */
export default function AuthHeader({ title, highlight, description }) {
    return (
        <div className="flex flex-col gap-8">
            <div className="group/brand flex w-fit items-center gap-3">
                <span className="relative">
                    <span
                        aria-hidden="true"
                        className="absolute -inset-1.5 rounded-2xl bg-brand-cyan/30 opacity-60 blur-lg transition-opacity duration-500 group-hover/brand:opacity-100"
                    />
                    <BrandMark intro className="relative size-11" />
                </span>
                <BrandWordmark className="text-2xl text-brand-navy" />
            </div>

            <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-semibold tracking-tight">
                    {title}{' '}
                    <span className="relative isolate inline-block font-serif text-[1.15em] font-normal tracking-normal italic">
                        <span
                            aria-hidden="true"
                            className="absolute inset-x-[-0.12em] bottom-[0.12em] -z-10 h-[0.36em] rounded-full bg-brand-sun"
                        />
                        {highlight}
                    </span>
                </h1>
                <p className="text-sm leading-relaxed text-muted-foreground">
                    {description}
                </p>
            </div>
        </div>
    );
}
