import PageHeader from '@/Components/PageHeader';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { useTranslation } from '@/hooks/use-translation';
import { Link } from '@inertiajs/react';

/**
 * The bar of form buttons that stays pinned to the bottom of the screen while
 * a long form scrolls, and settles at the bottom of the page. Its form
 * should grow to fill the page (`flex-1`) so a short form's bar sits low too.
 */
export function FormActions({ children }) {
    return (
        <div className="sticky bottom-0 z-10 -mx-4 mt-auto -mb-6 flex flex-wrap items-center justify-end gap-2.5 border-t bg-background px-4 py-4 md:-mx-8 md:-mb-8 md:px-8 xl:-mx-10 xl:-mb-10 xl:px-10">
            {children}
        </div>
    );
}

/**
 * Cancel and Save, with a spinner while the form is sending.
 */
export function FormButtons({ cancelHref, submitLabel, processing }) {
    const { t } = useTranslation();

    return (
        <>
            <Button variant="outline" nativeButton={false} render={<Link href={cancelHref} />}>
                {t('leasing.common.cancel')}
            </Button>
            <Button type="submit" disabled={processing}>
                {processing && <Spinner data-icon="inline-start" />}
                {submitLabel}
            </Button>
        </>
    );
}

/**
 * The frame of an add or edit page: the header with Cancel and Save, the
 * form sections, an optional side column (such as a summary), and the
 * buttons again in a bar pinned to the bottom of the screen.
 */
export default function FormShell({ breadcrumbs, title, description, cancelHref, submitLabel, processing, onSubmit, aside, children }) {
    const buttons = <FormButtons cancelHref={cancelHref} submitLabel={submitLabel} processing={processing} />;

    return (
        <form
            noValidate
            className="flex flex-1 flex-col gap-6"
            onSubmit={(event) => {
                event.preventDefault();
                onSubmit();
            }}
        >
            <PageHeader breadcrumbs={breadcrumbs} title={title} description={description} actions={buttons} actionsClassName="max-sm:hidden" />

            <div className={aside ? 'grid items-start gap-6 xl:grid-cols-3' : 'flex max-w-4xl flex-col gap-6'}>
                <div className="flex min-w-0 flex-col gap-6 xl:col-span-2">{children}</div>
                {aside && <aside className="flex flex-col gap-4 xl:sticky xl:top-20">{aside}</aside>}
            </div>

            <FormActions>{buttons}</FormActions>
        </form>
    );
}
