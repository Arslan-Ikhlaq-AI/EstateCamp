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
import { getInitials } from '@/lib/format';
import { Head, Link, useForm } from '@inertiajs/react';
import {
    ArrowRightIcon,
    CircleCheckIcon,
    LockKeyholeIcon,
    MailIcon,
} from 'lucide-react';

export default function Login({ status, workspace }) {
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
                    description={
                        workspace
                            ? `Sign in to the ${workspace.name} workspace.`
                            : 'Sign in to manage your camps, rooms and residents.'
                    }
                />

                {workspace && (
                    <div className="flex items-center gap-3 rounded-2xl border bg-white p-3 shadow-xs">
                        <span className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-linear-to-br from-brand-cyan to-brand-navy text-sm font-bold text-white">
                            {workspace.logo_url ? (
                                <img
                                    src={workspace.logo_url}
                                    alt=""
                                    className="size-full bg-white object-contain p-1"
                                />
                            ) : (
                                getInitials(workspace.name)
                            )}
                        </span>
                        <div className="flex min-w-0 flex-col">
                            <span className="text-xs font-semibold text-muted-foreground">
                                Workspace
                            </span>
                            <span className="truncate font-bold">
                                {workspace.name}
                            </span>
                        </div>
                    </div>
                )}

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
                    New to EstateCamp?{' '}
                    <Link
                        href={route('onboarding.create')}
                        className="rounded-sm font-semibold text-foreground underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
                    >
                        Set up your company
                    </Link>
                </p>
            </form>
        </AuthLayout>
    );
}
