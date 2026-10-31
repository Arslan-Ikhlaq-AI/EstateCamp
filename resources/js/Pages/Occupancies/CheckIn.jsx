import { FormSection, SelectField, TextareaField, TextField } from '@/Components/FormFields';
import FormShell from '@/Components/FormShell';
import DashboardLayout from '@/Layouts/DashboardLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { FieldGroup } from '@/components/ui/field';
import { todayIso } from '@/hooks/use-leasing-format';
import { useTranslation } from '@/hooks/use-translation';
import { Head, Link, router, useForm } from '@inertiajs/react';
import { CircleAlertIcon, DoorOpenIcon, FileSignatureIcon, MarsIcon, UserPlusIcon, VenusIcon } from 'lucide-react';
import { useEffect } from 'react';
import { useRoomPlacement } from '../Rooms/Partials/RoomBits';

const GENDER_ICONS = { male: MarsIcon, female: VenusIcon };

/**
 * The room the chosen contract line rents: where it is, who it is for and
 * how many of the people it sleeps are staying, with why nobody can check
 * in when it is full, out of service or for the other gender.
 */
function RoomCard({ line, occupantGender }) {
    const { t, formatNumber } = useTranslation();
    const placement = useRoomPlacement();
    const GenderIcon = GENDER_ICONS[line.genderPolicy];
    const placesLeft = Math.max(0, line.capacity - line.staying);
    const isForOtherGender = Boolean(occupantGender) && ['male', 'female'].includes(line.genderPolicy) && line.genderPolicy !== occupantGender;
    const problem = !line.isInService
        ? t('leasing.checkIn.room.outOfService')
        : placesLeft === 0
          ? t('leasing.checkIn.room.full')
          : isForOtherGender
            ? t(`leasing.checkIn.room.onlyFor.${line.genderPolicy}`)
            : null;

    return (
        <div className="flex flex-col gap-3 rounded-xl p-4 ring-1 ring-foreground/10">
            <div className="flex items-start gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand-cyan/10 text-brand-ink">
                    <DoorOpenIcon className="size-5" />
                </span>
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold">{t('leasing.lines.roomName', { room: line.roomNumber })}</span>
                        {line.genderPolicy && (
                            <Badge variant="secondary">
                                {GenderIcon && <GenderIcon data-icon="inline-start" />}
                                {t(`gender.${line.genderPolicy}`)}
                            </Badge>
                        )}
                    </div>
                    {placement(line) && <span className="text-sm text-muted-foreground">{placement(line)}</span>}
                </div>
                <div className="flex flex-col items-end text-end">
                    <span className="text-lg font-semibold tabular-nums">
                        {formatNumber(line.staying)} / {formatNumber(line.capacity)}
                    </span>
                    <span className="text-xs text-muted-foreground">{t('leasing.checkIn.room.placesLeft', { count: placesLeft })}</span>
                </div>
            </div>
            {problem && (
                <p className="flex items-center gap-2 text-sm text-destructive">
                    <CircleAlertIcon className="size-4 shrink-0" />
                    {problem}
                </p>
            )}
        </div>
    );
}

export default function CheckIn({ lines, selectedLineId, selectedOccupantId, occupants, clientId }) {
    const { t } = useTranslation();
    const form = useForm({
        contract_line_id: selectedLineId,
        occupant_id: selectedOccupantId,
        check_in_date: todayIso(),
        notes: '',
    });
    const { data, setData, errors, processing } = form;
    const occupant = occupants.find((person) => person.id === data.occupant_id);
    const selectedLine = lines.find((line) => line.id === selectedLineId);
    const title = t('leasing.checkIn.title');

    // A different line brings a different room and set of people.
    useEffect(() => {
        setData((values) => ({
            ...values,
            contract_line_id: selectedLineId,
            occupant_id: occupants.some((person) => person.id === values.occupant_id) ? values.occupant_id : null,
        }));
    }, [selectedLineId]);

    const chooseLine = (lineId) =>
        router.reload({
            data: { contract_line: lineId, occupant: data.occupant_id ?? undefined },
            only: ['selectedLineId', 'occupants', 'clientId'],
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

                        {selectedLine && (
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

                                <FormSection title={t('leasing.checkIn.room.title')} description={t('leasing.checkIn.room.description')}>
                                    <RoomCard line={selectedLine} occupantGender={occupant?.gender} />
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
