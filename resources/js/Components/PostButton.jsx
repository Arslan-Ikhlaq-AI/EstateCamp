import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { router } from '@inertiajs/react';
import { useState } from 'react';

/**
 * A button that sends a request to `href`, such as "Activate contract"
 * (POST by default; `method="patch"` for status changes), and shows a
 * spinner until the server answers.
 */
export default function PostButton({ href, method = 'post', data = {}, icon: Icon, children, ...props }) {
    const [isSending, setIsSending] = useState(false);

    return (
        <Button
            {...props}
            disabled={isSending || props.disabled}
            onClick={() =>
                router.visit(href, {
                    method,
                    data,
                    preserveScroll: true,
                    onStart: () => setIsSending(true),
                    onFinish: () => setIsSending(false),
                })
            }
        >
            {isSending ? <Spinner data-icon="inline-start" /> : Icon && <Icon data-icon="inline-start" />}
            {children}
        </Button>
    );
}
