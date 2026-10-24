import TermsContent from '@/Components/TermsContent';
import { Button } from '@/components/ui/button';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { formatTermsDate } from '@/lib/terms';
import { CheckIcon, ExternalLinkIcon, ScaleIcon } from 'lucide-react';
import { useState } from 'react';

/**
 * The Terms of Service read in place during sign-up, with how far through
 * them the reader is, and a button that accepts them.
 */
export default function TermsDialog({ open, onOpenChange, version, onAccept }) {
    const [progress, setProgress] = useState(0);

    const trackReading = (event) => {
        const { scrollTop, scrollHeight, clientHeight } = event.currentTarget;
        const scrollable = scrollHeight - clientHeight;

        setProgress(scrollable > 0 ? Math.min(1, scrollTop / scrollable) : 1);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="flex max-h-[min(46rem,calc(100svh-2rem))] flex-col gap-0 overflow-hidden p-0 font-display sm:max-w-2xl">
                <header className="flex shrink-0 flex-col gap-3 border-b px-6 pt-6 pb-4">
                    <div className="flex items-center gap-3 pe-8">
                        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-brand-cyan to-brand-navy text-white shadow-sm">
                            <ScaleIcon className="size-4.5" aria-hidden="true" />
                        </span>
                        <div className="flex flex-col gap-1">
                            <DialogTitle className="text-lg font-bold tracking-tight">Terms of Service</DialogTitle>
                            <DialogDescription className="text-[0.8125rem] text-muted-foreground">
                                Version {version} · effective {formatTermsDate(version)}
                            </DialogDescription>
                        </div>
                    </div>
                    <div className="h-1 overflow-hidden rounded-full bg-muted" role="progressbar" aria-label="Read so far" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)}>
                        <div className="h-full rounded-full bg-brand-gradient transition-[width] duration-150" style={{ width: `${progress * 100}%` }} />
                    </div>
                </header>

                <div onScroll={trackReading} tabIndex={0} aria-label="Terms of Service text" className="min-h-0 flex-1 overflow-y-auto px-6 py-6 outline-none focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset">
                    <TermsContent />
                </div>

                <footer className="flex shrink-0 flex-col-reverse gap-3 border-t bg-muted/50 px-6 py-4 sm:flex-row sm:items-center">
                    <a
                        href={route('terms')}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center justify-center gap-1.5 rounded-sm text-sm font-semibold text-brand-ink outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 sm:justify-start"
                    >
                        Open full page <ExternalLinkIcon className="size-3.5" aria-hidden="true" />
                    </a>
                    <div className="flex flex-col-reverse gap-2 sm:ms-auto sm:flex-row">
                        <DialogClose render={<Button variant="outline" />}>Close</DialogClose>
                        <Button variant="brand" onClick={onAccept}>
                            <CheckIcon data-icon="inline-start" /> Accept terms
                        </Button>
                    </div>
                </footer>
            </DialogContent>
        </Dialog>
    );
}
