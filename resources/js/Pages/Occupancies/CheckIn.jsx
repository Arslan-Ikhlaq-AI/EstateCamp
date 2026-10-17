import { FormSection, SelectField, TextareaField, TextField } from '@/Components/FormFields';
import FormShell from '@/Components/FormShell';
import DashboardLayout from '@/Layouts/DashboardLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { todayIso } from '@/hooks/use-leasing-format';
import { useTranslation } from '@/hooks/use-translation';
import { cn } from '@/lib/utils';
import { Head, Link, router, useForm } from '@inertiajs/react';
import { BedSingleIcon, FileSignatureIcon, MarsIcon, UserPlusIcon, VenusIcon } from 'lucide-react';
import { useEffect } from 'react';

const GENDER_ICONS = { male: MarsIcon, female: VenusIcon };

/**
 * Free beds grouped by room; a bed in a room for the other gender is shown but cannot be picked.
 */
function BedPicker({ beds, value, onChange, occupantGender, error }) {
    const { t } = useTranslation();
    const rooms = Object.values(
        beds.reduce((groups, bed) => {
            groups[bed.roomNumber] ??= { roomNumber: bed.roomNumber, genderPolicy: bed.genderPolicy, beds: [] };
            groups[bed.roomNumber].beds.push(bed);

            return groups;
        }, {}),
    );
    const fits = (bed) => !occupantGender || !['male', 'female'].includes(bed.genderPolicy) || bed.genderPolicy === occupantGender;

    return (
        <Field data-invalid={error ? true : undefined}>
            <FieldLabel id="bed-label">{t('leasing.checkIn.fields.bed')}</FieldLabel>
            <div className="flex flex-col gap-4">
                {rooms.map((room) => {
                    const GenderIcon = GENDER_ICONS[room.genderPolicy];

                    return (
                        <div key={room.roomNumber} className="flex flex-col gap-2">
                            <div className="flex items-center gap-2 text-sm font-medium">
                                {t('leasing.lines.roomName', { room: room.roomNumber })}
                                {room.genderPolicy && (
                                    <Badge variant="secondary">
                                        {GenderIcon && <GenderIcon data-icon="inline-start" />}
                                        {t(`gender.${room.genderPolicy}`)}
                                    </Badge>
                                )}
                            </div>
                            <ToggleGroup
                                aria-labelledby="bed-label"
                                variant="outline"
                                value={value ? [String(value)] : []}
                                onValueChange={([next]) => next && onChange(Number(next))}
                                className="flex-wrap"
                            >
                                {room.beds.map((bed) => (
                                    <ToggleGroupItem
                                        key={bed.id}
                                        value={String(bed.id)}
                                        disabled={!fits(bed)}
                                        className={cn('aria-pressed:border-primary aria-pressed:bg-primary/5 aria-pressed:text-primary')}
                                    >
                                        <BedSingleIcon data-icon="inline-start" />
                                        {t('leasing.checkIn.bed', { bed: bed.label })}
                                    </ToggleGroupItem>
                                ))}
                            </ToggleGroup>
                        </div>
                    );
                })}
            </div>
            <FieldError>{error}</FieldError>
        </Field>
    );
}

export default function CheckIn({ lines, selectedLineId, selectedOccupantId, beds, occupants, clientId }) {
    const { t } = useTranslation();
    const form = useForm({
        contract_line_id: selectedLineId,
        occupant_id: selectedOccupantId,
        bed_id: null,
        check_in_date: todayIso(),
        notes: '',
    });
    const { data, setData, errors, processing } = form;
    const occupant = occupants.find((person) => person.id === data.occupant_id);
    const title = t('leasing.checkIn.title');

    // A different line brings a different set of beds and people.
    useEffect(() => {
        setData((values) => ({
            ...values,
            contract_line_id: selectedLineId,
            bed_id: null,
            occupant_id: occupants.some((person) => person.id === values.occupant_id) ? values.occupant_id : null,
        }));
    }, [selectedLineId]);

    const chooseLine = (lineId) =>
        router.reload({
            data: { contract_line: lineId, occupant: data.occupant_id ?? undefined },
            only: ['selectedLineId', 'beds', 'occupants', 'clientId'],
        });

    return (
        <DashboardLayout>
            <Head title={title} />

            <FormShell
                breadcrumbs={[{ label: t('leasing.occupants.title'), href: route('occupants.index') }, { label: title }]}
                title={title}
                description={t('leasing.checkIn.description')}
                cancelHref={route('occupants.index')}
                submitLabel={t('leasing.checkIn.submit')}
                processing={processing}
                onSubmit={() => form.post(route('occupancies.store'))}
            >
                {lines.length === 0 ? (
                    <Empty className="border">
                        <EmptyHeader>
                            <EmptyMedia variant="icon">
                                <FileSignatureIcon />
                            </EmptyMedia>
                            <EmptyTitle>{t('leasing.checkIn.noLines.title')}</EmptyTitle>
                            <EmptyDescription>{t('leasing.checkIn.noLines.description')}</EmptyDescription>
                        </EmptyHeader>
                        <EmptyContent>
                            <Button nativeButton={false} render={<Link href={route('contracts.index')} />}>
                                {t('leasing.contracts.title')}
                            </Button>
                        </EmptyContent>
                    </Empty>
                ) : (
                    <>
                        <FormSection title={t('leasing.checkIn.line.title')} description={t('leasing.checkIn.line.description')}>
                            <SelectField
                                id="contract_line_id"
                                label={t('leasing.checkIn.fields.line')}
                                placeholder={t('leasing.checkIn.fields.chooseLine')}
                                value={data.contract_line_id}
                                onChange={chooseLine}
                                items={lines.map((line) => ({
                                    value: line.id,
                                    label: `${line.contractNumber} · ${line.clientName} · ${line.description} (${line.staying}/${line.capacity})`,
                                }))}
                                error={errors.contract_line_id}
                            />
                        </FormSection>

                        {selectedLineId && (
                            <>
                                <FormSection title={t('leasing.checkIn.person.title')} description={t('leasing.checkIn.person.description')}>
                                    {occupants.length === 0 ? (
                                        <div className="flex flex-col items-start gap-3">
                                            <p className="text-sm text-muted-foreground">{t('leasing.checkIn.noOccupants')}</p>
                                            <Button variant="outline" nativeButton={false} render={<Link href={route('occupants.create', { client: clientId })} />}>
                                                <UserPlusIcon data-icon="inline-start" />
                                                {t('leasing.occupants.add')}
                                            </Button>
                                        </div>
                                    ) : (
                                        <SelectField
                                            id="occupant_id"
                                            label={t('leasing.checkIn.fields.occupant')}
                                            placeholder={t('leasing.checkIn.fields.chooseOccupant')}
                                            value={data.occupant_id}
                                            onChange={(value) => setData('occupant_id', value)}
                                            items={occupants.map((person) => ({
                                                value: person.id,
                                                label: [person.name, t(`gender.${person.gender}`), person.employeeNumber].filter(Boolean).join(' · '),
                                            }))}
                                            description={
                                                <Link href={route('occupants.create', { client: clientId })} className="underline underline-offset-3 hover:text-foreground">
                                                    {t('leasing.checkIn.registerSomeone')}
                                                </Link>
                                            }
                                            error={errors.occupant_id}
                                        />
                                    )}
                                </FormSection>

                                <FormSection title={t('leasing.checkIn.bedSection.title')} description={t('leasing.checkIn.bedSection.description')}>
                                    {beds.length === 0 ? (
                                        <p className="text-sm text-muted-foreground">{t('leasing.checkIn.noBeds')}</p>
                                    ) : (
                                        <BedPicker
                                            beds={beds}
                                            value={data.bed_id}
                                            onChange={(value) => setData('bed_id', value)}
                                            occupantGender={occupant?.gender}
                                            error={errors.bed_id}
                                        />
                                    )}
                                </FormSection>

                                <FormSection title={t('leasing.checkIn.when.title')} description={t('leasing.checkIn.when.description')}>
                                    <FieldGroup className="grid gap-4 sm:grid-cols-2">
                                        <TextField
                                            id="check_in_date"
                                            type="date"
                                            label={t('leasing.checkIn.fields.date')}
                                            value={data.check_in_date}
                                            onChange={(value) => setData('check_in_date', value)}
                                            error={errors.check_in_date}
                                            max={todayIso()}
                                        />
                                        <TextareaField
                                            id="notes"
                                            label={t('leasing.common.notes')}
                                            value={data.notes}
                                            onChange={(value) => setData('notes', value)}
                                            error={errors.notes}
                                            optional
                                            rows={2}
                                            className="sm:col-span-2"
                                        />
                                    </FieldGroup>
                                </FormSection>
                            </>
                        )}
                    </>
                )}
            </FormShell>
        </DashboardLayout>
    );
}
