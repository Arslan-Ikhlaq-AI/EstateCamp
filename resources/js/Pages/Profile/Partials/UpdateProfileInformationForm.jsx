import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { useTranslation } from '@/hooks/use-translation';
import { Link, useForm, usePage } from '@inertiajs/react';
import { CheckIcon, MailWarningIcon } from 'lucide-react';

export default function UpdateProfileInformationForm({ mustVerifyEmail, status }) {
    const { t } = useTranslation();
    const user = usePage().props.auth.user;

    const { data, setData, patch, errors, processing, recentlySuccessful } = useForm({
        name: user.name,
        email: user.email,
    });

    const submit = (e) => {
        e.preventDefault();

        patch(route('profile.update'), { preserveScroll: true });
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>{t('settings.profile.title')}</CardTitle>
                <CardDescription>{t('settings.profile.description')}</CardDescription>
            </CardHeader>

            <form onSubmit={submit} className="contents">
                <CardContent>
                    <FieldGroup className="max-w-xl">
                        <Field data-invalid={errors.name ? true : undefined}>
                            <FieldLabel htmlFor="name">{t('settings.profile.name')}</FieldLabel>
                            <Input
                                id="name"
                                value={data.name}
                                onChange={(e) => setData('name', e.target.value)}
                                required
                                autoComplete="name"
                                aria-invalid={Boolean(errors.name)}
                                aria-describedby={errors.name ? 'name-error' : undefined}
                            />
                            <FieldError id="name-error">{errors.name}</FieldError>
                        </Field>

                        <Field data-invalid={errors.email ? true : undefined}>
                            <FieldLabel htmlFor="email">{t('settings.profile.email')}</FieldLabel>
                            <Input
                                id="email"
                                type="email"
                                value={data.email}
                                onChange={(e) => setData('email', e.target.value)}
                                required
                                autoComplete="username"
                                aria-invalid={Boolean(errors.email)}
                                aria-describedby={errors.email ? 'email-error' : undefined}
                            />
                            <FieldError id="email-error">{errors.email}</FieldError>
                        </Field>

                        {mustVerifyEmail && user.email_verified_at === null && (
                            <Alert>
                                <MailWarningIcon />
                                <AlertDescription className="flex flex-col items-start gap-1">
                                    {t('settings.profile.unverified')}
                                    <Link href={route('verification.send')} method="post" as="button">
                                        {t('settings.profile.resend')}
                                    </Link>
                                    {status === 'verification-link-sent' && (
                                        <span className="font-medium text-success">
                                            {t('settings.profile.verificationSent')}
                                        </span>
                                    )}
                                </AlertDescription>
                            </Alert>
                        )}
                    </FieldGroup>
                </CardContent>

                <CardFooter className="gap-3">
                    <Button type="submit" disabled={processing}>
                        {processing && <Spinner data-icon="inline-start" />}
                        {t('settings.profile.save')}
                    </Button>
                    {recentlySuccessful && (
                        <span role="status" className="flex items-center gap-1.5 text-sm text-success animate-in fade-in">
                            <CheckIcon className="size-4" />
                            {t('settings.profile.saved')}
                        </span>
                    )}
                </CardFooter>
            </form>
        </Card>
    );
}
