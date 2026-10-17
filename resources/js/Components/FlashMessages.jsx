import { Alert, AlertAction, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/hooks/use-translation';
import { usePage } from '@inertiajs/react';
import { CircleAlertIcon, CircleCheckIcon, XIcon } from 'lucide-react';
import { useState } from 'react';

/**
 * The success message the last action left behind, and any errors from it
 * that belong to no form field (such as "Only a draft contract can be
 * activated"). `errorKeys` names those errors. The success message can be
 * dismissed; a new one from the next action shows again.
 */
export default function FlashMessages({ errorKeys = [] }) {
    const { t } = useTranslation();
    const { flash, errors } = usePage().props;
    const [dismissedFlash, setDismissedFlash] = useState(null);
    const messages = errorKeys.map((key) => errors[key]).filter(Boolean);

    return (
        <>
            {flash.success && dismissedFlash !== flash && (
                <Alert variant="success" role="status" className="motion-safe:animate-enter">
                    <CircleCheckIcon />
                    <AlertDescription className="text-foreground">{flash.success}</AlertDescription>
                    <AlertAction>
                        <Button variant="ghost" size="icon-xs" aria-label={t('common.dismiss')} onClick={() => setDismissedFlash(flash)}>
                            <XIcon />
                        </Button>
                    </AlertAction>
                </Alert>
            )}
            {messages.map((message) => (
                <Alert key={message} variant="destructive" className="motion-safe:animate-enter">
                    <CircleAlertIcon />
                    <AlertDescription>{message}</AlertDescription>
                </Alert>
            ))}
        </>
    );
}
