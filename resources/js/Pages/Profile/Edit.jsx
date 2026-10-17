import PageHeader from '@/Components/PageHeader';
import DashboardLayout from '@/Layouts/DashboardLayout';
import { useTranslation } from '@/hooks/use-translation';
import { Head } from '@inertiajs/react';
import DeleteUserForm from './Partials/DeleteUserForm';
import UpdatePasswordForm from './Partials/UpdatePasswordForm';
import UpdateProfileInformationForm from './Partials/UpdateProfileInformationForm';

export default function Edit({ mustVerifyEmail, status }) {
    const { t } = useTranslation();

    return (
        <DashboardLayout>
            <Head title={t('settings.title')} />

            <PageHeader
                breadcrumbs={[{ label: t('settings.title') }]}
                title={t('settings.title')}
                description={t('settings.description')}
            />

            <div className="flex max-w-3xl flex-col gap-6">
                <UpdateProfileInformationForm mustVerifyEmail={mustVerifyEmail} status={status} />
                <UpdatePasswordForm />
                <DeleteUserForm />
            </div>
        </DashboardLayout>
    );
}
