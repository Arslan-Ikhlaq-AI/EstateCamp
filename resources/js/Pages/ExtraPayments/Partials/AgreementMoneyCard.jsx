import { SectionCard } from '@/Components/DetailCards';
import { useTranslation } from '@/hooks/use-translation';
import ManageButton from './ManageDialog';
import StandingBadge from './StandingBadge';

/**
 * One commission or deposit: its amount, where it stands, what is left and
 * its Manage button, or None when the agreement has none.
 */
function MoneyRow({ label, record, description, currency, methods, paidTo }) {
    const { t, formatMoney } = useTranslation();

    return (
        <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-muted-foreground">{label}</span>
                {record && <StandingBadge standing={record.standing} />}
            </div>
            {record ? (
                <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 flex-col">
                        <span className="font-semibold tabular-nums">{formatMoney(record.amount, currency)}</span>
                        {record.status === 'received' && (
                            <span className="text-xs text-muted-foreground tabular-nums">{t('extraPayments.show.remaining', { amount: formatMoney(record.remaining, currency) })}</span>
                        )}
                        {record.status === 'pending' && <span className="text-xs text-muted-foreground">{t('extraPayments.notReceived')}</span>}
                    </div>
                    <ManageButton record={record} description={description} currency={currency} methods={methods} paidTo={paidTo} />
                </div>
            ) : (
                <span className="text-sm font-medium">{t('extraPayments.show.none')}</span>
            )}
        </div>
    );
}

/**
 * An agreement's commission and security deposit, kept apart from its rent
 * and managed here or under Extra payments.
 */
export default function AgreementMoneyCard({ commission, deposit, description, currency, methods, tenant }) {
    const { t } = useTranslation();

    return (
        <SectionCard title={t('extraPayments.show.title')} description={t('extraPayments.show.description')} contentClassName="flex flex-col gap-4">
            <MoneyRow label={t('extraPayments.show.commission')} record={commission} description={description} currency={currency} methods={methods} />
            <MoneyRow label={t('extraPayments.show.deposit')} record={deposit} description={description} currency={currency} methods={methods} paidTo={tenant} />
        </SectionCard>
    );
}
