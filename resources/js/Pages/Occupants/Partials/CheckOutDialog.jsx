import ActionDialog from '@/Components/ActionDialog';
import { TextField } from '@/Components/FormFields';
import { todayIso } from '@/hooks/use-leasing-format';
import { useTranslation } from '@/hooks/use-translation';
import { useForm } from '@inertiajs/react';

/**
 * Check an occupant out of their room. `stay` needs `id`, `occupantName`,
 * `roomNumber` and `checkInDate`.
 */
export default function CheckOutDialog({ stay, open, onOpenChange }) {
    const { t, formatDate } = useTranslation();
    const form = useForm({ check_out_date: todayIso() });

    return (
        <ActionDialog
            open={open}
            onOpenChange={onOpenChange}
            title={t('leasing.occupants.checkOut.title', { name: stay.occupantName })}
            description={t('leasing.occupants.checkOut.description', {
                room: stay.roomNumber,
                date: formatDate(stay.checkInDate),
            })}
            submitLabel={t('leasing.occupants.checkOut.submit')}
            processing={form.processing}
            onSubmit={() =>
                form.patch(route('occupancies.check-out', stay.id), {
                    preserveScroll: true,
                    onSuccess: () => onOpenChange(false),
                })
            }
        >
            <TextField
                id="check_out_date"
                type="date"
                label={t('leasing.occupants.checkOut.date')}
                description={t('leasing.occupants.checkOut.dateHint')}
                value={form.data.check_out_date}
                onChange={(value) => form.setData('check_out_date', value)}
                error={form.errors.check_out_date}
                max={todayIso()}
            />
        </ActionDialog>
    );
}
