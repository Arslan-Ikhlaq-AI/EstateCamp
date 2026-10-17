import AuthHeader from '@/Components/AuthHeader';
import AuthLayout from '@/Layouts/AuthLayout';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { Head, Link, useForm } from '@inertiajs/react';
import { CircleCheckIcon, LogOutIcon, MailIcon } from 'lucide-react';

export default function VerifyEmail({ status }) {
    const { post, processing } = useForm({});

    const submit = (e) => {
        e.preventDefault();

        post(route('verification.send'));
    };

    return (
        <AuthLayout>
            <Head title="Verify your email" />

            <form onSubmit={submit} aria-busy={processing} className="flex flex-col gap-8">
                <AuthHeader
                    title="Check your"
                    highlight="inbox"
                    description="Thanks for signing up! Before getting started, verify your email address with the link we just sent you. If it hasn't arrived, we'll gladly send another."
                />

                {status === 'verification-link-sent' && (
                    <Alert role="status">
                        <CircleCheckIcon />
                        <AlertDescription>
                            A new verification link has been sent to the email address you provided during registration.
                        </AlertDescription>
                    </Alert>
                )}

                <div className="flex flex-col gap-3">
                    <Button type="submit" variant="brand" size="lg" className="h-11 w-full" disabled={processing}>
                        {processing ? <Spinner data-icon="inline-start" /> : <MailIcon data-icon="inline-start" />}
                        {processing ? 'Sending…' : 'Resend verification email'}
                    </Button>
                    <Button
                        variant="ghost"
                        size="lg"
                        className="h-11 w-full text-muted-foreground"
                        nativeButton
                        render={<Link href={route('logout')} method="post" as="button" />}
                    >
                        <LogOutIcon data-icon="inline-start" />
                        Log out
                    </Button>
                </div>
            </form>
        </AuthLayout>
    );
}
