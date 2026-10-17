import PasswordInput from '@/Components/PasswordInput';
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
import { Spinner } from '@/components/ui/spinner';
import { useTranslation } from '@/hooks/use-translation';
import { useForm } from '@inertiajs/react';
import { CheckIcon } from 'lucide-react';

const FIELDS = [
    { name: 'current_password', label: 'settings.password.current', autoComplete: 'current-password' },
    { name: 'password', label: 'settings.password.new', autoComplete: 'new-password' },
    { name: 'password_confirmation', label: 'settings.password.confirm', autoComplete: 'new-password' },
];

export default function UpdatePasswordForm() {
    const { t } = useTranslation();

    const { data, setData, errors, put, reset, processing, recentlySuccessful } = useForm({
        current_password: '',
        password: '',
        password_confirmation: '',
    });

    const updatePassword = (e) => {
        e.preventDefault();

        put(route('password.update'), {
            preserveScroll: true,
            onSuccess: () => reset(),
            onError: (errors) => {
                if (errors.password) {
                    reset('password', 'password_confirmation');
                    document.getElementById('password')?.focus();
                }

                if (errors.current_password) {
                    reset('current_password');
                    document.getElementById('current_password')?.focus();
                }
            },
        });
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>{t('settings.password.title')}</CardTitle>
                <CardDescription>{t('settings.password.description')}</CardDescription>
            </CardHeader>

            <form onSubmit={updatePassword} className="contents">
                <CardContent>
                    <FieldGroup className="max-w-xl">
                        {FIELDS.map((field) => (
                            <Field key={field.name} data-invalid={errors[field.name] ? true : undefined}>
                                <FieldLabel htmlFor={field.name}>{t(field.label)}</FieldLabel>
                                <PasswordInput
                                    id={field.name}
                                    toggleLabel={t('settings.password.show')}
                                    value={data[field.name]}
                                    onChange={(e) => setData(field.name, e.target.value)}
                                    autoComplete={field.autoComplete}
                                    aria-invalid={Boolean(errors[field.name])}
                                    aria-describedby={errors[field.name] ? `${field.name}-error` : undefined}
                                />
                                <FieldError id={`${field.name}-error`}>{errors[field.name]}</FieldError>
                            </Field>
                        ))}
                    </FieldGroup>
                </CardContent>

                <CardFooter className="gap-3">
                    <Button type="submit" disabled={processing}>
                        {processing && <Spinner data-icon="inline-start" />}
                        {t('settings.password.save')}
                    </Button>
                    {recentlySuccessful && (
                        <span role="status" className="flex items-center gap-1.5 text-sm text-success animate-in fade-in">
                            <CheckIcon className="size-4" />
                            {t('settings.password.saved')}
                        </span>
                    )}
                </CardFooter>
            </form>
        </Card>
    );
}
