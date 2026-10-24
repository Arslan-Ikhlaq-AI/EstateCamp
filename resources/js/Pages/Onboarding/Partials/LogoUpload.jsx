import { Button } from '@/components/ui/button';
import { Field, FieldError, FieldLabel } from '@/components/ui/field';
import { formatFileSize, LOGO_TYPES } from '@/lib/onboarding';
import { cn } from '@/lib/utils';
import { CircleCheckIcon, ImageUpIcon, RefreshCwIcon, Trash2Icon, UploadIcon } from 'lucide-react';
import { useRef, useState } from 'react';

/**
 * The company logo: dropped onto the box or chosen from the device, then
 * shown on a checkerboard (so a transparent logo reads correctly) with its
 * size, and buttons to replace or remove it.
 */
export default function LogoUpload({ preview, info, error, onChoose, onRemove }) {
    const inputRef = useRef(null);
    const [isDragging, setIsDragging] = useState(false);

    const browse = () => inputRef.current?.click();

    const drop = (event) => {
        event.preventDefault();
        setIsDragging(false);
        onChoose(event.dataTransfer.files?.[0]);
    };

    return (
        <Field data-invalid={error ? true : undefined}>
            <FieldLabel htmlFor="logo" className="text-[0.9rem] font-semibold">
                Company logo
            </FieldLabel>

            <div
                onClick={preview ? undefined : browse}
                onDragOver={(event) => {
                    event.preventDefault();
                    setIsDragging(true);
                }}
                onDragLeave={(event) => !event.currentTarget.contains(event.relatedTarget) && setIsDragging(false)}
                onDrop={drop}
                className={cn(
                    'group/logo relative flex flex-col items-center gap-5 rounded-2xl border-2 border-dashed bg-white p-5 text-center transition-[border-color,background-color,box-shadow] duration-200 sm:flex-row sm:text-start',
                    !preview && 'cursor-pointer hover:border-brand-cyan/60 hover:bg-brand-cyan/[0.025]',
                    preview && 'border-solid border-border shadow-xs',
                    isDragging && 'border-brand-cyan bg-brand-cyan/[0.05] ring-4 ring-brand-cyan/10',
                    error && !isDragging && 'border-destructive/60 bg-destructive/[0.02]',
                )}
            >
                <span
                    className={cn(
                        'relative flex size-24 shrink-0 items-center justify-center overflow-hidden rounded-2xl ring-1 ring-border',
                        preview
                            ? 'bg-[conic-gradient(#eef1f6_25%,#fff_0_50%,#eef1f6_0_75%,#fff_0)] bg-size-[14px_14px] motion-safe:animate-in motion-safe:zoom-in-95'
                            : 'bg-linear-to-br from-brand-cyan/10 to-brand-navy/5 text-brand-ink transition-transform duration-300 group-hover/logo:scale-105',
                    )}
                >
                    {preview ? <img src={preview} alt="Your company logo" className="size-full object-contain p-2.5" /> : <ImageUpIcon className="size-8" aria-hidden="true" />}
                </span>

                <div className="flex min-w-0 flex-1 flex-col gap-1">
                    {preview && info ? (
                        <>
                            <p className="truncate font-bold text-foreground">{info.name}</p>
                            <p className="text-[0.8125rem] text-muted-foreground tabular-nums">
                                {formatFileSize(info.size)} · {info.width} × {info.height} px
                            </p>
                            <p className="mt-1 flex items-center justify-center gap-1.5 text-[0.8125rem] font-semibold text-success sm:justify-start">
                                <CircleCheckIcon className="size-4" aria-hidden="true" /> Shown in your sidebar, on invoices and on your sign-in page.
                            </p>
                        </>
                    ) : (
                        <>
                            <p className="font-bold text-foreground">
                                {isDragging ? (
                                    'Drop to upload'
                                ) : (
                                    <>
                                        Drop your logo here, or <span className="text-brand-ink underline decoration-brand-cyan/40 underline-offset-4">browse</span>
                                    </>
                                )}
                            </p>
                            <p className="text-[0.8125rem] text-muted-foreground">PNG, JPG or WEBP · up to 2 MB · at least 64 × 64 px</p>
                            <p className="text-[0.8125rem] text-muted-foreground">A square logo on a transparent or white background looks best.</p>
                        </>
                    )}
                </div>

                <div className="flex shrink-0 flex-wrap justify-center gap-2" onClick={(event) => event.stopPropagation()}>
                    {preview ? (
                        <>
                            <Button type="button" variant="outline" size="sm" className="text-foreground" onClick={browse}>
                                <RefreshCwIcon data-icon="inline-start" /> Replace
                            </Button>
                            <Button type="button" variant="ghost" size="sm" className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive" onClick={onRemove}>
                                <Trash2Icon data-icon="inline-start" /> Remove
                            </Button>
                        </>
                    ) : (
                        <Button type="button" variant="outline" className="text-foreground" onClick={browse}>
                            <UploadIcon data-icon="inline-start" /> Choose file
                        </Button>
                    )}
                </div>

                <input
                    ref={inputRef}
                    id="logo"
                    name="logo"
                    type="file"
                    accept={LOGO_TYPES.join(',')}
                    tabIndex={-1}
                    className="sr-only"
                    aria-invalid={Boolean(error)}
                    aria-describedby={error ? 'logo-error' : undefined}
                    onClick={(event) => event.stopPropagation()}
                    onChange={(event) => {
                        onChoose(event.target.files?.[0]);
                        // Picking the same file again after removing it still counts as a change.
                        event.target.value = '';
                    }}
                />
            </div>

            {error && <FieldError id="logo-error">{error}</FieldError>}
        </Field>
    );
}
