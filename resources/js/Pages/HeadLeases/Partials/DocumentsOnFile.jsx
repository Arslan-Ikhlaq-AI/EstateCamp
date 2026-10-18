import { Badge } from '@/components/ui/badge';
import { useTranslation } from '@/hooks/use-translation';
import { ExternalLinkIcon, FileCheckIcon } from 'lucide-react';

/**
 * Documents on file, each with its type, reference, expiry, a tag and a
 * link to its file. By default the tag is the lease a property document was
 * filed under, `leaseId` marking the lease being edited; `renderTag` shows
 * something else, such as the contract a document came with.
 */
export default function DocumentsOnFile({ documents, leaseId, renderTag }) {
    const { t, formatDate } = useTranslation();

    return (
        <ul className="flex flex-col divide-y rounded-xl ring-1 ring-foreground/[0.08]">
            {documents.map((document) => (
                <li key={document.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-success/12 text-success">
                        <FileCheckIcon className="size-4" />
                    </span>
                    <div className="flex min-w-0 flex-1 flex-col leading-tight">
                        <span className="truncate text-sm font-medium">{document.title || t(`documentTypes.${document.document_type}`)}</span>
                        <span className="truncate text-xs text-muted-foreground">
                            {[
                                document.title && t(`documentTypes.${document.document_type}`),
                                document.document_number,
                                document.expires_on && t('leasing.headLeases.form.documents.expires', { date: formatDate(document.expires_on) }),
                            ]
                                .filter(Boolean)
                                .join(' · ')}
                        </span>
                    </div>
                    {renderTag?.(document)}
                    {!renderTag && document.lease_number && (
                        <Badge variant={document.head_lease_id === leaseId ? 'info' : 'secondary'}>
                            {document.head_lease_id === leaseId ? t('leasing.headLeases.form.documents.thisLease') : document.lease_number}
                        </Badge>
                    )}
                    <a
                        href={document.file_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-xs font-medium text-brand-ink underline-offset-4 hover:underline"
                    >
                        {t('leasing.headLeases.form.documents.view')}
                        <ExternalLinkIcon className="size-3" />
                    </a>
                </li>
            ))}
        </ul>
    );
}
