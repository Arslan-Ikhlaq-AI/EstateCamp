import { ToneBadge } from '@/Components/LeasingBadges';
import { useTranslation } from '@/hooks/use-translation';
import { BanIcon, CircleCheckIcon, ClockIcon, HandCoinsIcon, WalletIcon } from 'lucide-react';

const TONES = { to_collect: 'warning', held: 'primary', part_settled: 'info', settled: 'success', cancelled: 'muted' };
const ICONS = { to_collect: ClockIcon, held: WalletIcon, part_settled: HandCoinsIcon, settled: CircleCheckIcon, cancelled: BanIcon };

export { ICONS as STANDING_ICONS };

/**
 * Where an extra payment's money stands: still to arrive, held, settled in
 * part or in full, or cancelled.
 */
export default function StandingBadge({ standing }) {
    const { t } = useTranslation();

    return (
        <ToneBadge tone={TONES[standing]} icon={ICONS[standing]}>
            {t(`extraPayments.standing.${standing}`)}
        </ToneBadge>
    );
}
