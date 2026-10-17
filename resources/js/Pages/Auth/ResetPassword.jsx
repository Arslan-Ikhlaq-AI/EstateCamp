import AuthHeader from '@/Components/AuthHeader';
import InputIcon from '@/Components/InputIcon';
import PasswordInput from '@/Components/PasswordInput';
import AuthLayout from '@/Layouts/AuthLayout';
import { Button } from '@/components/ui/button';
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { InputGroup, InputGroupInput } from '@/components/ui/input-group';
import { Spinner } from '@/components/ui/spinner';
import { Head, useForm } from '@inertiajs/react';
import { LockKeyholeIcon, MailIcon } from 'lucide-react';

export default function ResetPassword({ token, email }) {
    const { data, setData, post, processing, errors, reset, clearErrors } = useForm({
        token: token,
        email: email,
        password: '',
        password_confirmation: '',
    });

    const updateField = (field) => (e) => {
        setData(field, e.target.value);
        clearErrors(field);
    };

    const submit = (e) => {
        e.preventDefault();

        post(route('password.store'), {
            onFinish: () => reset('password', 'password_confirmation'),
        });
    };

    return (
        <AuthLayout>
            <Head title="Reset password" />

            <form onSubmit={submit} noValidate aria-busy={processing} className="flex flex-col gap-8">
                <AuthHeader title="Choose a new" highlight="password" description="Pick a password you don't use anywhere else. You'll sign in with it from now on." />

                <FieldGroup>
                    <Field data-invalid={errors.email ? true : undefined}>
                        <FieldLabel htmlFor="email">Email address</FieldLabel>
                        <InputGroup className="h-11">
                            <InputGroupInput
                                id="email"
                                name="email"
                                type="email"
                                autoComplete="username"
                                value={data.email}
                                onChange={updateField('email')}
                                aria-invalid={Boolean(errors.email)}
                                aria-describedby={errors.email ? 'email-error' : undefined}
                            />
                            <InputIcon icon={MailIcon} />
                        </InputGroup>
                        <FieldError id="email-error">{errors.email}</FieldError>
                    </Field>

                    <Field data-invalid={errors.password ? true : undefined}>
                        <FieldLabel htmlFor="password">New password</FieldLabel>
                        <PasswordInput
                            id="password"
                            name="password"
                            icon={LockKeyholeIcon}
                            groupClassName="h-11"
                            autoComplete="new-password"
                            autoFocus
                            value={data.password}
                            onChange={updateField('password')}
                            aria-invalid={Boolean(errors.password)}
                            aria-describedby={errors.password ? 'password-error' : undefined}
                        />
                        <FieldError id="password-error">{errors.password}</FieldError>
                    </Field>

                    <Field data-invalid={errors.password_confirmation ? true : undefined}>
                        <FieldLabel htmlFor="password_confirmation">Confirm new password</FieldLabel>
                        <PasswordInput
                            id="password_confirmation"
                            name="password_confirmation"
                            icon={LockKeyholeIcon}
                            groupClassName="h-11"
                            autoComplete="new-password"
                            value={data.password_confirmation}
                            onChange={updateField('password_confirmation')}
                            aria-invalid={Boolean(errors.password_confirmation)}
                            aria-describedby={errors.password_confirmation ? 'password_confirmation-error' : undefined}
                        />
                        <FieldError id="password_confirmation-error">{errors.password_confirmation}</FieldError>
                    </Field>

                    <Field>
                        <Button type="submit" variant="brand" size="lg" className="h-11 w-full" disabled={processing}>
                            {processing && <Spinner data-icon="inline-start" />}
                            {processing ? 'Saving…' : 'Reset password'}
                        </Button>
                    </Field>
                </FieldGroup>
            </form>
        </AuthLayout>
    );
}
