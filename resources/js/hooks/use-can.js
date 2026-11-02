import { usePage } from '@inertiajs/react';
import { useCallback, useMemo } from 'react';

/**
 * Whether the signed-in user may do something, from the permissions the
 * server shares (`auth.permissions`, named as in config/permissions.php,
 * such as `rooms.create`). Given several, any one of them is enough. The
 * server refuses the same things, so this only decides what to offer.
 *
 * @return {(...permissions: string[]) => boolean}
 */
export function useCan() {
    const { auth } = usePage().props;
    const granted = useMemo(() => new Set(auth.permissions ?? []), [auth.permissions]);

    return useCallback((...permissions) => permissions.some((permission) => granted.has(permission)), [granted]);
}
