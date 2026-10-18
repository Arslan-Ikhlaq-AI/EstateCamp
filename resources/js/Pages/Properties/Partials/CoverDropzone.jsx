import PropertyCover from '@/Components/PropertyCover';
import { Button } from '@/components/ui/button';
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field';
import { useTranslation } from '@/hooks/use-translation';
import { cn } from '@/lib/utils';
import { ImageUpIcon, Trash2Icon } from 'lucide-react';
import { useState } from 'react';

/**
 * The cover photo as a wide drop area: drag a picture onto it or click to
 * choose one. Once there is a picture it fills the area, with buttons to
 * change or remove a newly chosen one.
 */
export default function CoverDropzone({ previewUrl, hasNewFile, onChange, error }) {
    const { t } = useTranslation();
    const [isDragging, setIsDragging] = useState(false);

    const drop = (event) => {
        event.preventDefault();
        setIsDragging(false);
        const file = event.dataTransfer.files[0];

        if (file && file.type.startsWith('image/')) {
            onChange(file);
        }
    };

    return (
        <Field data-invalid={error ? true : undefined} className="relative">
            <FieldLabel htmlFor="cover_image">{t('propertyForm.sections.cover.title')}</FieldLabel>
            <label
                htmlFor="cover_image"
                onDragOver={(event) => {
                    event.preventDefault();
                    setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={drop}
                className={cn(
                    'group/cover relative flex aspect-[16/5] min-h-40 cursor-pointer items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-input bg-linear-to-br from-brand-cyan/[0.06] via-transparent to-gold/[0.08] transition-colors hover:border-brand-cyan/60',
                    'has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50',
                    isDragging && 'border-brand-cyan bg-accent',
                    previewUrl && 'border-solid border-transparent',
                    error && 'border-destructive',
                )}
            >
                {previewUrl ? (
                    <>
                        <PropertyCover key={previewUrl} src={previewUrl} className="transition-transform duration-700 group-hover/cover:scale-105" />
                        <div className="absolute inset-0 bg-linear-to-t from-brand-navy/60 via-transparent to-transparent" />
                        <span className="absolute bottom-3 start-3 flex items-center gap-2 rounded-lg bg-white/90 px-3 py-1.5 text-[0.8125rem] font-semibold text-brand-navy shadow-sm backdrop-blur">
                            <ImageUpIcon className="size-4" />
                            {t('propertyForm.cover.change')}
                        </span>
                    </>
                ) : (
                    <span className="flex flex-col items-center gap-2 px-4 text-center">
                        <span className="flex size-12 items-center justify-center rounded-2xl bg-linear-to-br from-brand-cyan to-brand-navy text-white shadow-lg shadow-brand-cyan/25 transition-transform group-hover/cover:scale-110">
                            <ImageUpIcon className="size-5" />
                        </span>
                        <span className="text-sm font-semibold">{t('propertyForm.dropCover')}</span>
                        <span className="text-xs text-muted-foreground">{t('propertyForm.cover.hint')}</span>
                    </span>
                )}
                <input
                    id="cover_image"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="sr-only"
                    onChange={(event) => onChange(event.target.files[0] ?? null)}
                />
            </label>
            {hasNewFile && (
                <Button type="button" variant="ghost" size="sm" className="self-start text-muted-foreground hover:text-destructive" onClick={() => onChange(null)}>
                    <Trash2Icon data-icon="inline-start" />
                    {t('propertyForm.removeCover')}
                </Button>
            )}
            {previewUrl && !hasNewFile && <FieldDescription>{t('propertyForm.cover.hint')}</FieldDescription>}
            <FieldError>{error}</FieldError>
        </Field>
    );
}
