import AuthHeader from '@/Components/AuthHeader';
import InputIcon from '@/Components/InputIcon';
import PasswordInput from '@/Components/PasswordInput';
import AuthLayout from '@/Layouts/AuthLayout';
import { Button } from '@/components/ui/button';
import {
    Field,
    FieldDescription,
    FieldError,
    FieldGroup,
    FieldLabel,
} from '@/components/ui/field';
import { InputGroup, InputGroupInput } from '@/components/ui/input-group';
import { Spinner } from '@/components/ui/spinner';
import { focusFirstError, validateRegistration } from '@/lib/auth-form';
import { Head, Link, useForm } from '@inertiajs/react';
import {
    ArrowRightIcon,
    LockKeyholeIcon,
    MailIcon,
    ShieldCheckIcon,
    UserRoundIcon,
} from 'lucide-react';

export default function Register() {
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
        name: '',
        email: '',
        password: '',
        password_confirmation: '',
    });

    const updateField = (field) => (e) => {
        setData(field, e.target.value);
        clearErrors(field);
    };

    const submit = (e) => {
        e.preventDefault();

        const clientErrors = validateRegistration(data);

        if (Object.keys(clientErrors).length > 0) {
            setError(clientErrors);
            focusFirstError(clientErrors);

            return;
        }

        post(route('register'), {
            onError: focusFirstError,
            onFinish: () => reset('password', 'password_confirmation'),
        });
    };

    return (
        <AuthLayout>
            <Head title="Create account" />

            <form
                onSubmit={submit}
                noValidate
                aria-busy={processing}
                className="flex flex-col gap-8"
            >
                <AuthHeader
                    title="Create your"
                    highlight="account"
                    description="Set up your workspace and start managing your camps."
                />

                <FieldGroup>
                    <Field data-invalid={errors.name ? true : undefined}>
                        <FieldLabel htmlFor="name">Full name</FieldLabel>
                        <InputGroup className="h-11">
                            <InputGroupInput
                                id="name"
                                name="name"
                                autoComplete="name"
                                placeholder="Jane Doe"
                                value={data.name}
                                onChange={updateField('name')}
                                aria-invalid={Boolean(errors.name)}
                                aria-describedby={
                                    errors.name ? 'name-error' : undefined
                                }
                            />
                            <InputIcon icon={UserRoundIcon} />
                        </InputGroup>
                        <FieldError id="name-error">{errors.name}</FieldError>
                    </Field>

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
                            autoComplete="new-password"
                            value={data.password}
                            onChange={updateField('password')}
                            aria-invalid={Boolean(errors.password)}
                            aria-describedby={
                                errors.password
                                    ? 'password-hint password-error'
                                    : 'password-hint'
                            }
                        />
                        <FieldDescription id="password-hint">
                            Use at least 8 characters.
                        </FieldDescription>
                        <FieldError id="password-error">
                            {errors.password}
                        </FieldError>
                    </Field>

                    <Field
                        data-invalid={
                            errors.password_confirmation ? true : undefined
                        }
                    >
                        <FieldLabel htmlFor="password_confirmation">
                            Confirm password
                        </FieldLabel>
                        <PasswordInput
                            id="password_confirmation"
                            name="password_confirmation"
                            icon={ShieldCheckIcon}
                            toggleLabel="Show password confirmation"
                            groupClassName="h-11"
                            autoComplete="new-password"
                            value={data.password_confirmation}
                            onChange={updateField('password_confirmation')}
                            aria-invalid={Boolean(errors.password_confirmation)}
                            aria-describedby={
                                errors.password_confirmation
                                    ? 'password_confirmation-error'
                                    : undefined
                            }
                        />
                        <FieldError id="password_confirmation-error">
                            {errors.password_confirmation}
                        </FieldError>
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
                            {processing
                                ? 'Creating account…'
                                : 'Create account'}
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
                    Already have an account?{' '}
                    <Link
                        href={route('login')}
                        className="rounded-sm font-semibold text-foreground underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
                    >
                        Sign in
                    </Link>
                </p>
            </form>
        </AuthLayout>
    );
}
