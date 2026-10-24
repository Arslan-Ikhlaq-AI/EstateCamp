import { COUNTRIES, countryName } from '@/lib/onboarding';
import {
    Building2Icon,
    CalendarClockIcon,
    FileBadgeIcon,
    FileSignatureIcon,
    GlobeIcon,
    MailIcon,
    MapPinIcon,
    MapPinnedIcon,
    PhoneIcon,
    ReceiptTextIcon,
} from 'lucide-react';
import { FieldSection, IconField, IconSelect } from './OnboardingFields';

const COUNTRY_ITEMS = COUNTRIES.map(({ code }) => ({ value: code, label: countryName(code), hint: code }));

/**
 * Step 1: the company's identity, how to reach it and where it is.
 */
export default function CompanyStep({ bind, onCountryChange }) {
    const country = bind('country_code');

    return (
        <div className="flex flex-col gap-10">
            <FieldSection icon={Building2Icon} title="Identity" description="How your company is named on documents.">
                <div className="grid gap-5 sm:grid-cols-2">
                    <IconField {...bind('name')} label="Company name" icon={Building2Icon} placeholder="Horizon Facilities Management" autoComplete="organization" className="sm:col-span-2" />
                    <IconField {...bind('legal_name')} label="Legal name" icon={FileSignatureIcon} optional placeholder="As on your trade licence" description="Printed on invoices and contracts." />
                    <IconField {...bind('trade_license_number')} label="Trade licence number" icon={FileBadgeIcon} optional placeholder="CN-4518273" />
                    <IconField
                        {...bind('expiry_date')}
                        label="Licence expiry"
                        icon={CalendarClockIcon}
                        type="date"
                        optional
                        description="You are reminded 90 days before it expires."
                    />
                    <IconField
                        {...bind('tax_registration_number')}
                        label="Tax registration number (TRN)"
                        icon={ReceiptTextIcon}
                        optional
                        inputMode="numeric"
                        maxLength={15}
                        placeholder="15 digits"
                        className="tabular-nums"
                    />
                </div>
            </FieldSection>

            <FieldSection icon={MailIcon} title="Contact" description="Where clients and EstateCamp reach you.">
                <div className="grid gap-5 sm:grid-cols-2">
                    <IconField
                        {...bind('email')}
                        label="Company email"
                        icon={MailIcon}
                        type="email"
                        inputMode="email"
                        autoComplete="email"
                        placeholder="info@company.com"
                        description="Your workspace summary is sent here."
                    />
                    <IconField {...bind('phone')} label="Company phone" icon={PhoneIcon} type="tel" autoComplete="tel" placeholder="+971 4 321 7788" />
                    <IconField
                        {...bind('website')}
                        label="Website"
                        icon={GlobeIcon}
                        optional
                        inputMode="url"
                        autoComplete="url"
                        placeholder="company.com"
                        className="sm:col-span-2"
                    />
                </div>
            </FieldSection>

            <FieldSection icon={MapPinIcon} title="Location" description="Sets your suggested currency and time zone.">
                <div className="grid gap-5 sm:grid-cols-2">
                    <IconSelect {...country} onChange={onCountryChange} label="Country" icon={GlobeIcon} items={COUNTRY_ITEMS} placeholder="Choose a country" />
                    <IconField {...bind('city')} label="City" icon={MapPinnedIcon} optional autoComplete="address-level2" placeholder="Dubai" />
                    <IconField
                        {...bind('address_line_1')}
                        label="Office address"
                        icon={MapPinIcon}
                        optional
                        autoComplete="address-line1"
                        placeholder="Office 1204, Opal Tower, Business Bay"
                        className="sm:col-span-2"
                    />
                </div>
            </FieldSection>
        </div>
    );
}
