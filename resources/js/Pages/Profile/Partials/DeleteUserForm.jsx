import PasswordInput from '@/Components/PasswordInput';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Field, FieldError, FieldLabel } from '@/components/ui/field';
import { Spinner } from '@/components/ui/spinner';
import { useTranslation } from '@/hooks/use-translation';
import { useForm } from '@inertiajs/react';
import { Trash2Icon } from 'lucide-react';
import { useState } from 'react';

export default function DeleteUserForm() {
    const { t } = useTranslation();
    const [isConfirming, setIsConfirming] = useState(false);

    const {
        data,
        setData,
        delete: destroy,
        processing,
        reset,
        errors,
        clearErrors,
    } = useForm({
        password: '',
    });

    const changeOpen = (open) => {
        setIsConfirming(open);

        if (!open) {
            clearErrors();
            reset();
        }
    };

    const deleteUser = (e) => {
        e.preventDefault();

        destroy(route('profile.destroy'), {
            preserveScroll: true,
            onSuccess: () => changeOpen(false),
            onError: () => document.getElementById('delete-password')?.focus(),
            onFinish: () => reset(),
        });
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>{t('settings.delete.title')}</CardTitle>
                <CardDescription>{t('settings.delete.description')}</CardDescription>
            </CardHeader>

            <CardFooter>
                <Dialog open={isConfirming} onOpenChange={changeOpen}>
                    <DialogTrigger render={<Button variant="destructive" />}>
                        <Trash2Icon data-icon="inline-start" />
                        {t('settings.delete.button')}
                    </DialogTrigger>

                    <DialogContent>
                        <form onSubmit={deleteUser} className="flex flex-col gap-6">
                            <DialogHeader>
                                <DialogTitle>{t('settings.delete.confirmTitle')}</DialogTitle>
                                <DialogDescription>{t('settings.delete.confirmDescription')}</DialogDescription>
                            </DialogHeader>

                            <Field data-invalid={errors.password ? true : undefined}>
                                <FieldLabel htmlFor="delete-password">{t('settings.delete.password')}</FieldLabel>
                                <PasswordInput
                                    id="delete-password"
                                    name="password"
                                    toggleLabel={t('settings.password.show')}
                                    value={data.password}
                                    onChange={(e) => setData('password', e.target.value)}
                                    autoComplete="current-password"
                                    aria-invalid={Boolean(errors.password)}
                                    aria-describedby={errors.password ? 'delete-password-error' : undefined}
                                />
                                <FieldError id="delete-password-error">{errors.password}</FieldError>
                            </Field>

                            <DialogFooter>
                                <DialogClose render={<Button variant="outline" type="button" />}>
                                    {t('settings.delete.cancel')}
                                </DialogClose>
                                <Button type="submit" variant="destructive" disabled={processing}>
                                    {processing && <Spinner data-icon="inline-start" />}
                                    {t('settings.delete.confirm')}
                                </Button>
                            </DialogFooter>
                        </form>
                    </DialogContent>
                </Dialog>
            </CardFooter>
        </Card>
    );
}
