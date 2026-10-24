import { Card, CardContent } from '@/components/ui/card';
import { useTranslation } from '@/hooks/use-translation';
import { cn } from '@/lib/utils';

/**
 * A document the company hands over or files, such as a rent receipt or
 * a payment voucher: the company's letterhead, the document's name, number
 * and date, its body, and lines to sign. It prints on its own (the app
 * around it is hidden on paper); `isVoid` stamps it as void.
 */
export default function PrintableDocument({ company, title, number, date, isVoid = false, voidNote, children, signatures = [] }) {
    const { t } = useTranslation();

    return (
        <Card className="relative max-w-4xl overflow-hidden print:max-w-none print:border-0 print:shadow-none">
            {isVoid && (
                <div aria-hidden="true" className="pointer-events-none absolute inset-0 flex items-center justify-center">
                    <span className="-rotate-12 rounded-2xl border-4 border-destructive/40 px-8 py-2 font-heading text-6xl font-black tracking-[0.2em] text-destructive/30 uppercase">
                        {t('finance.documents.void')}
                    </span>
                </div>
            )}
            <div aria-hidden="true" className="h-1.5 bg-linear-to-r from-brand-navy via-brand-cyan to-gold print:h-1" />
            <CardContent className="flex flex-col gap-8 py-8 sm:px-10">
                <header className="flex flex-col justify-between gap-6 sm:flex-row">
                    <div className="flex flex-col gap-1 text-sm">
                        {company.logo_url && <img src={company.logo_url} alt="" className="mb-2 h-11 w-auto self-start" />}
                        <span className="text-base font-semibold">{company.legal_name ?? company.name}</span>
                        {[company.address_line_1, company.address_line_2, company.city].filter(Boolean).map((line) => (
                            <span key={line} className="text-muted-foreground">
                                {line}
                            </span>
                        ))}
                        {[company.phone, company.email].filter(Boolean).length > 0 && <span className="text-muted-foreground">{[company.phone, company.email].filter(Boolean).join(' · ')}</span>}
                        {company.tax_registration_number && <span className="text-muted-foreground">{t('leasing.invoices.show.trn', { number: company.tax_registration_number })}</span>}
                    </div>
                    <div className="flex flex-col gap-1 sm:items-end sm:text-end">
                        <span className="font-heading text-2xl font-black tracking-[0.08em] text-brand-navy uppercase dark:text-white print:text-black">{title}</span>
                        <span className="font-mono text-sm font-semibold">{number}</span>
                        <span className="text-sm text-muted-foreground">{date}</span>
                    </div>
                </header>

                {isVoid && voidNote && <p className="rounded-lg bg-destructive/[0.07] px-4 py-2.5 text-sm text-destructive ring-1 ring-destructive/20">{voidNote}</p>}

                {children}

                {signatures.length > 0 && (
                    <footer className={cn('grid gap-8 pt-6', signatures.length > 2 ? 'sm:grid-cols-3' : 'sm:grid-cols-2')}>
                        {signatures.map((signature) => (
                            <div key={signature.label} className="flex flex-col gap-1.5">
                                <span className="h-10 border-b border-dashed border-foreground/30" />
                                <span className="text-xs font-medium">{signature.label}</span>
                                {signature.name && <span className="text-xs text-muted-foreground">{signature.name}</span>}
                            </div>
                        ))}
                    </footer>
                )}
            </CardContent>
        </Card>
    );
}

/**
 * Labelled facts on a document, in a tinted box.
 */
export function DocumentFacts({ rows, columns = 2 }) {
    return (
        <dl className={cn('grid gap-4 rounded-xl bg-muted/50 p-4 text-sm print:bg-transparent print:p-0', columns === 2 && 'sm:grid-cols-2', columns === 3 && 'sm:grid-cols-3', columns === 4 && 'sm:grid-cols-4')}>
            {rows
                .filter((row) => row.value !== null && row.value !== undefined && row.value !== '')
                .map((row) => (
                    <div key={row.label} className="flex min-w-0 flex-col gap-0.5">
                        <dt className="text-xs text-muted-foreground">{row.label}</dt>
                        <dd className="font-medium break-words">{row.value}</dd>
                    </div>
                ))}
        </dl>
    );
}

/**
 * The amount a document is for, large, with what it is for beside it.
 */
export function DocumentAmount({ label, amount, detail }) {
    return (
        <div className="flex flex-col justify-between gap-3 rounded-xl border-2 border-brand-navy/15 p-5 sm:flex-row sm:items-center dark:border-white/15">
            <div className="flex flex-col gap-0.5">
                <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{label}</span>
                {detail && <span className="text-sm">{detail}</span>}
            </div>
            <span className="font-heading text-3xl font-bold tracking-tight tabular-nums">{amount}</span>
        </div>
    );
}
