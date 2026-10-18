import { TextField } from '@/Components/FormFields';
import { Badge } from '@/components/ui/badge';
import { FieldError } from '@/components/ui/field';
import { useTranslation } from '@/hooks/use-translation';
import { cn } from '@/lib/utils';
import { BookUserIcon, CheckIcon, CloudUploadIcon, ExternalLinkIcon, FileBadgeIcon, FileCheckIcon, FileSignatureIcon, IdCardIcon } from 'lucide-react';
import { TONES } from './FormSteps';

const STYLES = {
    tenancy_contract: { icon: FileSignatureIcon, tone: 'brand' },
    emirates_id: { icon: IdCardIcon, tone: 'green' },
    trade_license: { icon: FileBadgeIcon, tone: 'gold' },
    passport: { icon: BookUserIcon, tone: 'navy' },
};

export const hasFile = (document) => Boolean(document?.file || document?.file_url);

/**
 * One required document: what it is, whether its file is in, a picker for
 * the file, and its reference number and expiry date.
 */
function RequiredDocumentCard({ type, index, document, errors, onChange }) {
    const { t } = useTranslation();
    const style = STYLES[type] ?? STYLES.tenancy_contract;
    const id = (field) => `document-${index}-${field}`;
    const fileError = errors[`documents.${index}.file`];
    const isUploaded = hasFile(document);

    return (
        <div
            className={cn(
                'flex flex-col gap-4 rounded-xl bg-surface p-4 ring-1 transition-shadow',
                fileError ? 'ring-destructive/50' : isUploaded ? 'ring-success/30' : 'ring-foreground/10',
            )}
        >
            <div className="flex items-start gap-3">
                <span className={cn('flex size-10 shrink-0 items-center justify-center rounded-xl bg-linear-to-br shadow-sm', TONES[style.tone].badge)}>
                    <style.icon className="size-5" />
                </span>
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="text-sm font-semibold">{t(`documentTypes.${type}`)}</span>
                    <span className="text-xs text-muted-foreground">{t(`propertyForm.documents.hints.${type}`)}</span>
                </div>
                {isUploaded ? (
                    <Badge variant="success">
                        <CheckIcon data-icon="inline-start" />
                        {t('propertyForm.documents.required.uploaded')}
                    </Badge>
                ) : (
                    <Badge variant="secondary">{t('propertyForm.documents.required.missing')}</Badge>
                )}
            </div>

            <div className="flex flex-col gap-1.5">
                <label
                    htmlFor={id('file')}
                    className={cn(
                        'relative flex cursor-pointer items-center gap-3 rounded-lg border border-dashed px-3 py-2.5 transition-colors hover:border-brand-cyan hover:bg-accent has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50',
                        isUploaded && 'border-solid border-success/30 bg-success/[0.05]',
                        fileError && 'border-destructive/60',
                    )}
                >
                    <input
                        id={id('file')}
                        type="file"
                        accept=".pdf,image/jpeg,image/png,image/webp"
                        className="sr-only"
                        aria-invalid={Boolean(fileError)}
                        onChange={(event) => onChange('file', event.target.files[0] ?? null)}
                    />
                    <span className={cn('flex size-8 shrink-0 items-center justify-center rounded-md', isUploaded ? 'bg-success/12 text-success' : 'bg-brand-cyan/10 text-brand-ink')}>
                        {isUploaded ? <FileCheckIcon className="size-4" /> : <CloudUploadIcon className="size-4" />}
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col leading-tight">
                        <span className="truncate text-[0.8125rem] font-medium">
                            {document.file?.name ?? t(isUploaded ? 'propertyForm.documents.required.replace' : 'propertyForm.documents.required.choose')}
                        </span>
                        <span className="text-xs text-muted-foreground">
                            {document.file_url && !document.file ? t('propertyForm.documents.keepFile') : t('propertyForm.documents.fileHint')}
                        </span>
                    </span>
                </label>
                {document.file_url && (
                    <a
                        href={document.file_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 self-start text-xs font-medium text-brand-ink underline-offset-4 hover:underline"
                    >
                        {t('propertyForm.documents.currentFile')}
                        <ExternalLinkIcon className="size-3" />
                    </a>
                )}
                <FieldError>{fileError}</FieldError>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
                <TextField
                    id={id('number')}
                    label={t('propertyForm.documents.number')}
                    value={document.document_number}
                    onChange={(value) => onChange('document_number', value)}
                    error={errors[`documents.${index}.document_number`]}
                />
                <TextField
                    id={id('expires')}
                    type="date"
                    label={t('propertyForm.documents.expiresOn')}
                    value={document.expires_on}
                    onChange={(value) => onChange('expires_on', value)}
                    error={errors[`documents.${index}.expires_on`]}
                />
            </div>
        </div>
    );
}

/**
 * The documents every property must have, as a grid of upload cards with a
 * tally of how many are in. `slots` are `{ type, index, document }`, where
 * `index` is the document's place in the form's list.
 */
export default function RequiredDocuments({ slots, errors, onChange }) {
    const { t } = useTranslation();
    const uploaded = slots.filter((slot) => hasFile(slot.document)).length;

    return (
        <section className="flex flex-col gap-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
                <div className="flex flex-col gap-0.5">
                    <h3 className="text-sm font-bold">{t('propertyForm.documents.required.title')}</h3>
                    <p className="text-[0.8125rem] text-muted-foreground">{t('propertyForm.documents.required.description')}</p>
                </div>
                <div className="flex items-center gap-2.5">
                    <span className="text-xs font-semibold tabular-nums">
                        {t('propertyForm.documents.required.progress', { done: uploaded, total: slots.length })}
                    </span>
                    <span aria-hidden="true" className="flex gap-1">
                        {slots.map((slot) => (
                            <span key={slot.type} className={cn('h-1.5 w-6 rounded-full transition-colors', hasFile(slot.document) ? 'bg-success' : 'bg-muted inset-ring inset-ring-foreground/10')} />
                        ))}
                    </span>
                </div>
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
                {slots.map((slot) => (
                    <RequiredDocumentCard
                        key={slot.type}
                        type={slot.type}
                        index={slot.index}
                        document={slot.document}
                        errors={errors}
                        onChange={(field, value) => onChange(slot.index, field, value)}
                    />
                ))}
            </div>
        </section>
    );
}
