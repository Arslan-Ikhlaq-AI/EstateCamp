import AuthHeader from '@/Components/AuthHeader';
import InputIcon from '@/Components/InputIcon';
import PasswordInput from '@/Components/PasswordInput';
import AuthLayout from '@/Layouts/AuthLayout';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Field,
    FieldError,
    FieldGroup,
    FieldLabel,
} from '@/components/ui/field';
import { InputGroup, InputGroupInput } from '@/components/ui/input-group';
import { Spinner } from '@/components/ui/spinner';
import { focusFirstError, validateLogin } from '@/lib/auth-form';
import { Head, Link, useForm } from '@inertiajs/react';
import {
    ArrowRightIcon,
    CircleCheckIcon,
    LockKeyholeIcon,
    MailIcon,
} from 'lucide-react';

export default function Login({ status }) {
    const {
        data,
        setData,
        post,
        processing,
        errors,
        setError,
        clearErrors,
        reset,
    } = useForm({
        email: '',
        password: '',
        remember: false,
    });

    const updateField = (field) => (e) => {
        setData(field, e.target.value);
        clearErrors(field);
    };

    const submit = (e) => {
        e.preventDefault();

        const clientErrors = validateLogin(data);

        if (Object.keys(clientErrors).length > 0) {
            setError(clientErrors);
            focusFirstError(clientErrors);

            return;
        }

        post(route('login'), {
            onError: focusFirstError,
            onFinish: () => reset('password'),
        });
    };

    return (
        <AuthLayout>
            <Head title="Sign in" />

            <form
                onSubmit={submit}
                noValidate
                aria-busy={processing}
                className="flex flex-col gap-8"
            >
                <AuthHeader
                    title="Welcome"
                    highlight="back"
                    description="Sign in to manage your camps, rooms and residents."
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
                                placeholder="name@company.com"
                                value={data.email}
                                onChange={updateField('email')}
                                aria-invalid={Boolean(errors.email)}
                                aria-describedby={
                                    errors.email ? 'email-error' : undefined
                                }
                            />
                            <InputIcon icon={MailIcon} />
                        </InputGroup>
                        <FieldError id="email-error">{errors.email}</FieldError>
                    </Field>

                    <Field data-invalid={errors.password ? true : undefined}>
                        <FieldLabel htmlFor="password">Password</FieldLabel>
                        <PasswordInput
                            id="password"
                            name="password"
                            icon={LockKeyholeIcon}
                            groupClassName="h-11"
                            autoComplete="current-password"
                            placeholder="Enter your password"
                            value={data.password}
                            onChange={updateField('password')}
                            aria-invalid={Boolean(errors.password)}
                            aria-describedby={
                                errors.password ? 'password-error' : undefined
                            }
                        />
                        <FieldError id="password-error">
                            {errors.password}
                        </FieldError>
                    </Field>

                    <Field orientation="horizontal">
                        <Checkbox
                            id="remember"
                            name="remember"
                            checked={data.remember}
                            onCheckedChange={(checked) =>
                                setData('remember', checked)
                            }
                        />
                        <FieldLabel htmlFor="remember" className="font-normal">
                            Keep me signed in
                        </FieldLabel>
                    </Field>

                    <Field>
                        <Button
                            type="submit"
                            variant="brand"
                            size="lg"
                            className="h-11 w-full"
                            disabled={processing}
                        >
                            {processing && <Spinner data-icon="inline-start" />}
                            {processing ? 'Signing in…' : 'Sign in'}
                            {!processing && (
                                <ArrowRightIcon
                                    data-icon="inline-end"
                                    className="transition-transform group-hover/button:translate-x-0.5"
                                />
                            )}
                        </Button>
                    </Field>
                </FieldGroup>

                <p className="text-center text-sm text-muted-foreground">
                    Don&apos;t have an account?{' '}
                    <Link
                        href={route('register')}
                        className="rounded-sm font-semibold text-foreground underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
                    >
                        Create one
                    </Link>
                </p>
            </form>
        </AuthLayout>
    );
}
