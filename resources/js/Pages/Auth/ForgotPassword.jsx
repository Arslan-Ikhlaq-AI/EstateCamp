import AuthHeader from '@/Components/AuthHeader';
import InputIcon from '@/Components/InputIcon';
import AuthLayout from '@/Layouts/AuthLayout';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { InputGroup, InputGroupInput } from '@/components/ui/input-group';
import { Spinner } from '@/components/ui/spinner';
import { Head, Link, useForm } from '@inertiajs/react';
import { ArrowLeftIcon, CircleCheckIcon, MailIcon } from 'lucide-react';

export default function ForgotPassword({ status }) {
    const { data, setData, post, processing, errors, clearErrors } = useForm({
        email: '',
    });

    const submit = (e) => {
        e.preventDefault();

        post(route('password.email'));
    };

    return (
        <AuthLayout>
            <Head title="Forgot password" />

            <form onSubmit={submit} noValidate aria-busy={processing} className="flex flex-col gap-8">
                <AuthHeader
                    title="Forgot your"
                    highlight="password?"
                    description="Enter the email address on your account and we'll send you a link to choose a new one."
                />

                {status && (
                    <Alert role="status">
                        <CircleCheckIcon />
                        <AlertDescription>{status}</AlertDescription>
                    </Alert>
                )}

                <FieldGroup>
                    <Field data-invalid={errors.email ? true : undefined}>
                        <FieldLabel htmlFor="email">Email address</FieldLabel>
                        <InputGroup className="h-11">
                            <InputGroupInput
                                id="email"
                                name="email"
                                type="email"
                                inputMode="email"
                                autoComplete="username"
                                autoFocus
                                placeholder="name@company.com"
                                value={data.email}
                                onChange={(e) => {
                                    setData('email', e.target.value);
                                    clearErrors('email');
                                }}
                                aria-invalid={Boolean(errors.email)}
                                aria-describedby={errors.email ? 'email-error' : undefined}
                            />
                            <InputIcon icon={MailIcon} />
                        </InputGroup>
                        <FieldError id="email-error">{errors.email}</FieldError>
                    </Field>

                    <Field>
                        <Button type="submit" variant="brand" size="lg" className="h-11 w-full" disabled={processing}>
                            {processing && <Spinner data-icon="inline-start" />}
                            {processing ? 'Sending link…' : 'Email me a reset link'}
                        </Button>
                    </Field>
                </FieldGroup>

                <Link
                    href={route('login')}
                    className="group/back mx-auto flex items-center gap-1.5 rounded-sm text-sm font-semibold text-foreground underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                    <ArrowLeftIcon className="size-4 transition-transform group-hover/back:-translate-x-0.5" />
                    Back to sign in
                </Link>
            </form>
        </AuthLayout>
    );
}
