import AuthHeader from '@/Components/AuthHeader';
import PasswordInput from '@/Components/PasswordInput';
import AuthLayout from '@/Layouts/AuthLayout';
import { Button } from '@/components/ui/button';
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Spinner } from '@/components/ui/spinner';
import { Head, useForm } from '@inertiajs/react';
import { LockKeyholeIcon } from 'lucide-react';

export default function ConfirmPassword() {
    const { data, setData, post, processing, errors, reset, clearErrors } = useForm({
        password: '',
    });

    const submit = (e) => {
        e.preventDefault();

        post(route('password.confirm'), {
            onFinish: () => reset('password'),
        });
    };

    return (
        <AuthLayout>
            <Head title="Confirm password" />

            <form onSubmit={submit} noValidate aria-busy={processing} className="flex flex-col gap-8">
                <AuthHeader
                    title="Confirm it's"
                    highlight="you"
                    description="This is a secure area of the application. Please confirm your password before continuing."
                />

                <FieldGroup>
                    <Field data-invalid={errors.password ? true : undefined}>
                        <FieldLabel htmlFor="password">Password</FieldLabel>
                        <PasswordInput
                            id="password"
                            name="password"
                            icon={LockKeyholeIcon}
                            groupClassName="h-11"
                            autoComplete="current-password"
                            autoFocus
                            value={data.password}
                            onChange={(e) => {
                                setData('password', e.target.value);
                                clearErrors('password');
                            }}
                            aria-invalid={Boolean(errors.password)}
                            aria-describedby={errors.password ? 'password-error' : undefined}
                        />
                        <FieldError id="password-error">{errors.password}</FieldError>
                    </Field>

                    <Field>
                        <Button type="submit" variant="brand" size="lg" className="h-11 w-full" disabled={processing}>
                            {processing && <Spinner data-icon="inline-start" />}
                            {processing ? 'Confirming…' : 'Confirm'}
                        </Button>
                    </Field>
                </FieldGroup>
            </form>
        </AuthLayout>
    );
}
