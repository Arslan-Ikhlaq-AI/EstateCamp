import { TextField } from '@/Components/FormFields';
import { Button } from '@/components/ui/button';
import {
    Field,
    FieldDescription,
    FieldError,
    FieldGroup,
    FieldLabel,
} from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { useTranslation } from '@/hooks/use-translation';
import { ExternalLinkIcon, FileTextIcon, Trash2Icon } from 'lucide-react';

/**
 * One document of the property: its type, title, reference, file, dates and
 * notes. An existing document keeps its file unless a new one is chosen.
 */
export default function DocumentFields({ index, document, documentTypes, errors, onChange, onRemove }) {
    const { t } = useTranslation();
    const prefix = `documents.${index}`;
    const id = (field) => `document-${index}-${field}`;
    const typeItems = documentTypes.map((type) => ({ value: type, label: t(`documentTypes.${type}`) }));

    return (
        <fieldset className="flex flex-col gap-4 rounded-xl p-4 ring-1 ring-foreground/[0.08] motion-safe:animate-enter">
            <div className="flex items-center justify-between gap-2">
                <legend className="flex items-center gap-2.5 text-sm font-semibold">
                    <span className="flex size-8 items-center justify-center rounded-lg bg-warning/12 text-warning">
                        <FileTextIcon className="size-4" />
                    </span>
                    {t('propertyForm.documents.heading', { number: index + 1 })}
                </legend>
                <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={onRemove}
                    aria-label={t('propertyForm.documents.remove')}
                    className="text-muted-foreground hover:text-destructive"
                >
                    <Trash2Icon />
                </Button>
            </div>

            <FieldGroup className="grid gap-4 sm:grid-cols-2">
                <Field data-invalid={errors[`${prefix}.document_type`] ? true : undefined}>
                    <FieldLabel htmlFor={id('type')}>{t('propertyForm.documents.type')}</FieldLabel>
                    <Select
                        items={typeItems}
                        value={document.document_type}
                        onValueChange={(value) => onChange('document_type', value)}
                    >
                        <SelectTrigger id={id('type')} className="w-full">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectGroup>
                                {typeItems.map((item) => (
                                    <SelectItem key={item.value} value={item.value}>
                                        {item.label}
                                    </SelectItem>
                                ))}
                            </SelectGroup>
                        </SelectContent>
                    </Select>
                    <FieldError>{errors[`${prefix}.document_type`]}</FieldError>
                </Field>
                <TextField
                    id={id('title')}
                    label={t('propertyForm.documents.title')}
                    value={document.title}
                    onChange={(value) => onChange('title', value)}
                    error={errors[`${prefix}.title`]}
                    optional
                />
                <TextField
                    id={id('number')}
                    label={t('propertyForm.documents.number')}
                    value={document.document_number}
                    onChange={(value) => onChange('document_number', value)}
                    error={errors[`${prefix}.document_number`]}
                    optional
                />
                <Field data-invalid={errors[`${prefix}.file`] ? true : undefined}>
                    <FieldLabel htmlFor={id('file')}>{t('propertyForm.documents.file')}</FieldLabel>
                    <Input
                        id={id('file')}
                        type="file"
                        accept=".pdf,image/jpeg,image/png,image/webp"
                        onChange={(event) => onChange('file', event.target.files[0] ?? null)}
                        aria-invalid={Boolean(errors[`${prefix}.file`])}
                    />
                    {!errors[`${prefix}.file`] && (
                        <FieldDescription className="flex flex-wrap items-center gap-x-2">
                            {document.file_url ? t('propertyForm.documents.keepFile') : t('propertyForm.documents.fileHint')}
                            {document.file_url && (
                                <a
                                    href={document.file_url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-1 font-medium text-primary underline-offset-4 hover:text-brand-ink hover:underline"
                                >
                                    {t('propertyForm.documents.currentFile')}
                                    <ExternalLinkIcon className="size-3" />
                                </a>
                            )}
                        </FieldDescription>
                    )}
                    <FieldError>{errors[`${prefix}.file`]}</FieldError>
                </Field>
                <TextField
                    id={id('issued')}
                    type="date"
                    label={t('propertyForm.documents.issuedOn')}
                    value={document.issued_on}
                    onChange={(value) => onChange('issued_on', value)}
                    error={errors[`${prefix}.issued_on`]}
                    optional
                />
                <TextField
                    id={id('expires')}
                    type="date"
                    label={t('propertyForm.documents.expiresOn')}
                    value={document.expires_on}
                    onChange={(value) => onChange('expires_on', value)}
                    error={errors[`${prefix}.expires_on`]}
                    optional
                />
                <TextField
                    id={id('notes')}
                    label={t('propertyForm.documents.notes')}
                    value={document.notes}
                    onChange={(value) => onChange('notes', value)}
                    error={errors[`${prefix}.notes`]}
                    optional
                    className="sm:col-span-2"
                />
            </FieldGroup>
        </fieldset>
    );
}
