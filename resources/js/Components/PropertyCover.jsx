import { cn } from '@/lib/utils';
import { Building2Icon } from 'lucide-react';
import { useState } from 'react';

/**
 * A property's cover picture, filling its container. Falls back to a branded
 * placeholder when the property has no picture or it fails to load.
 */
export default function PropertyCover({ src, className }) {
    const [hasFailed, setHasFailed] = useState(false);

    if (!src || hasFailed) {
        return (
            <div className="flex size-full items-center justify-center bg-linear-to-br from-primary/15 to-chart-5/20">
                <Building2Icon className="size-1/3 max-h-8 max-w-8 text-primary/60" />
            </div>
        );
    }

    return (
        <img
            src={src}
            alt=""
            loading="lazy"
            onError={() => setHasFailed(true)}
            className={cn('size-full object-cover', className)}
        />
    );
}
