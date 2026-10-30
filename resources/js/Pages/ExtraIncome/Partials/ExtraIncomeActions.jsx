import ActionDialog from '@/Components/ActionDialog';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useTranslation } from '@/hooks/use-translation';
import { Link, router, useForm } from '@inertiajs/react';
import { BanIcon, ExternalLinkIcon, MoreHorizontalIcon, PencilIcon, RotateCcwIcon, WalletIcon } from 'lucide-react';
import { useState } from 'react';

function CancelDialog({ income, open, onOpenChange }) {
    const { t } = useTranslation();
    const form = useForm({ status: 'cancelled' });

    return (
        <ActionDialog
            open={open}
            onOpenChange={onOpenChange}
            title={t('finance.extraIncome.cancel.title', { number: income.number })}
            description={t('finance.extraIncome.cancel.description')}
            submitLabel={t('finance.extraIncome.cancel.submit')}
            destructive
            processing={form.processing}
            onSubmit={() => form.post(route('extra-incomes.status', income.id), { preserveScroll: true, onSuccess: () => onOpenChange(false) })}
        />
    );
}

/**
 * The menu of one extra income: correct it, open its invoice or its
 * property's payments, and cancel it when added by mistake or count it
 * again. `fromPayments` brings the form back to the property's payments.
 */
export default function ExtraIncomeActions({ income, fromPayments = false }) {
    const { t } = useTranslation();
    const [isCancelling, setIsCancelling] = useState(false);
    const restore = () => router.post(route('extra-incomes.status', income.id), { status: 'received' }, { preserveScroll: true });

    return (
        <>
            <DropdownMenu>
                <DropdownMenuTrigger
                    render={
                        <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={t('finance.extraIncome.actions.menu', { number: income.number })}
                            className="text-muted-foreground hover:text-foreground data-popup-open:bg-muted data-popup-open:text-foreground"
                        />
                    }
                >
                    <MoreHorizontalIcon />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuGroup>
                        <DropdownMenuLabel className="truncate">{income.number}</DropdownMenuLabel>
                        <DropdownMenuItem render={<Link href={route('extra-incomes.edit', { extraIncome: income.id, ...(fromPayments ? { from: 'payments' } : {}) })} />}>
                            <PencilIcon />
                            {t('finance.extraIncome.actions.edit')}
                        </DropdownMenuItem>
                        {income.invoiceUrl && (
                            <DropdownMenuItem render={<a href={income.invoiceUrl} target="_blank" rel="noreferrer" />}>
                                <ExternalLinkIcon />
                                {t('finance.extraIncome.actions.invoice')}
                            </DropdownMenuItem>
                        )}
                        {!fromPayments && income.property && (
                            <DropdownMenuItem render={<Link href={route('properties.payments', income.property.id)} />}>
                                <WalletIcon />
                                {t('finance.extraIncome.actions.payments')}
                            </DropdownMenuItem>
                        )}
                        {income.status === 'cancelled' && (
                            <DropdownMenuItem onClick={restore}>
                                <RotateCcwIcon />
                                {t('finance.extraIncome.actions.restore')}
                            </DropdownMenuItem>
                        )}
                    </DropdownMenuGroup>
                    {income.status === 'received' && (
                        <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem variant="destructive" onClick={() => setIsCancelling(true)}>
                                <BanIcon />
                                {t('finance.extraIncome.actions.cancel')}
                            </DropdownMenuItem>
                        </>
                    )}
                </DropdownMenuContent>
            </DropdownMenu>

            {isCancelling && <CancelDialog income={income} open onOpenChange={(open) => !open && setIsCancelling(false)} />}
        </>
    );
}
