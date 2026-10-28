import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useTranslation } from '@/hooks/use-translation';
import { cn } from '@/lib/utils';
import { Link } from '@inertiajs/react';
import {
    CheckIcon,
    CopyIcon,
    DoorOpenIcon,
    FileSignatureIcon,
    FileTextIcon,
    LayoutPanelLeftIcon,
    MapPinnedIcon,
    MoreHorizontalIcon,
    EyeIcon,
    PencilIcon,
    PlusIcon,
    PhoneIcon,
    WalletIcon,
} from 'lucide-react';
import { useState } from 'react';

/**
 * The "more" menu for one property. `onImage` styles the trigger for use on
 * top of a cover picture.
 */
export default function PropertyActions({ property, onImage = false }) {
    const { t } = useTranslation();
    const [hasCopied, setHasCopied] = useState(false);

    const copyCode = async () => {
        try {
            await navigator.clipboard.writeText(property.code);
            setHasCopied(true);
        } catch {
            // Clipboard access can be refused; the code stays visible in the row.
        }
    };

    return (
        <DropdownMenu onOpenChange={(isOpen) => isOpen || setHasCopied(false)}>
            <DropdownMenuTrigger
                render={
                    <Button
                        variant={onImage ? 'secondary' : 'ghost'}
                        size="icon-sm"
                        aria-label={t('properties.actions.menu', { name: property.name })}
                        className={cn(
                            onImage &&
                                'bg-black/40 text-white backdrop-blur hover:bg-black/60 aria-expanded:bg-black/60 aria-expanded:text-white',
                        )}
                    />
                }
            >
                <MoreHorizontalIcon />
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuGroup>
                    <DropdownMenuLabel className="truncate">{property.name}</DropdownMenuLabel>
                    <DropdownMenuItem render={<Link href={route('properties.show', property.id)} />}>
                        <EyeIcon />
                        {t('properties.actions.view')}
                    </DropdownMenuItem>
                    <DropdownMenuItem render={<Link href={route('properties.edit', property.id)} />}>
                        <PencilIcon />
                        {t('properties.actions.edit')}
                    </DropdownMenuItem>
                    <DropdownMenuItem render={<Link href={route('properties.allocation', property.id)} />}>
                        <LayoutPanelLeftIcon />
                        {t('properties.actions.allocation')}
                    </DropdownMenuItem>
                    <DropdownMenuItem render={<Link href={route('properties.tenant-contracts', property.id)} />}>
                        <FileSignatureIcon />
                        {t('properties.actions.tenantContracts')}
                    </DropdownMenuItem>
                    <DropdownMenuItem render={<Link href={route('properties.payments', property.id)} />}>
                        <WalletIcon />
                        {t('properties.actions.payments')}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                        render={<Link href={route('rooms.index', { properties: [property.code] })} />}
                    >
                        <DoorOpenIcon />
                        {t('properties.actions.rooms')}
                    </DropdownMenuItem>
                    <DropdownMenuItem render={<Link href={route('rooms.create', { property: property.id })} />}>
                        <PlusIcon />
                        {t('properties.actions.addRoom')}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                        render={<Link href={route('properties.show', property.id)} />}
                    >
                        <FileTextIcon />
                        {t('properties.actions.documents')}
                    </DropdownMenuItem>
                </DropdownMenuGroup>

                {(property.mapUrl || property.contactPhone) && (
                    <>
                        <DropdownMenuSeparator />
                        <DropdownMenuGroup>
                            {property.mapUrl && (
                                <DropdownMenuItem
                                    render={<a href={property.mapUrl} target="_blank" rel="noreferrer" />}
                                >
                                    <MapPinnedIcon />
                                    {t('properties.actions.map')}
                                </DropdownMenuItem>
                            )}
                            {property.contactPhone && (
                                <DropdownMenuItem render={<a href={`tel:${property.contactPhone.replace(/\s+/g, '')}`} />}>
                                    <PhoneIcon />
                                    <span className="truncate">
                                        {t('properties.actions.call', {
                                            name: property.contactName ?? property.contactPhone,
                                        })}
                                    </span>
                                </DropdownMenuItem>
                            )}
                        </DropdownMenuGroup>
                    </>
                )}

                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                    <DropdownMenuItem closeOnClick={false} onClick={copyCode}>
                        {hasCopied ? <CheckIcon className="text-success" /> : <CopyIcon />}
                        {hasCopied
                            ? t('properties.actions.copied', { code: property.code })
                            : t('properties.actions.copy')}
                    </DropdownMenuItem>
                </DropdownMenuGroup>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
