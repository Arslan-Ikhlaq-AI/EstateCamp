import { COUNTRY_KEYWORDS, countryName } from '@/lib/onboarding';
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
import { useMemo } from 'react';
import LogoUpload from './LogoUpload';
import { FieldSection, IconCombobox, IconField } from './OnboardingFields';

/**
 * Step 1: the company's identity and logo, how to reach it and where it is.
 */
export default function CompanyStep({ bind, countries, onCountryChange, logo }) {
    const countryItems = useMemo(
        () =>
            countries
                .map(({ code }) => ({ value: code, label: countryName(code), hint: code, keywords: COUNTRY_KEYWORDS[code] }))
                .sort((first, second) => first.label.localeCompare(second.label)),
        [countries],
    );

    return (
        <div className="flex flex-col gap-10">
            <FieldSection icon={Building2Icon} title="Identity" description="How your company looks and is named on documents.">
                <LogoUpload {...logo} />
                <div className="grid gap-5 sm:grid-cols-2">
                    <IconField {...bind('name')} label="Company name" icon={Building2Icon} placeholder="Northwind Properties" autoComplete="organization" className="sm:col-span-2" />
                    <IconField {...bind('legal_name')} label="Legal name" icon={FileSignatureIcon} optional placeholder="As registered" description="Printed on invoices and contracts." />
                    <IconField
                        {...bind('trade_license_number')}
                        label="Registration number"
                        icon={FileBadgeIcon}
                        optional
                        placeholder="Company or licence number"
                        description="Trade licence, commercial registration or company number."
                    />
                    <IconField
                        {...bind('expiry_date')}
                        label="Registration expiry"
                        icon={CalendarClockIcon}
                        type="date"
                        optional
                        description="If it expires, you are reminded 90 days before."
                    />
                    <IconField
                        {...bind('tax_registration_number')}
                        label="Tax registration number"
                        icon={ReceiptTextIcon}
                        optional
                        autoCapitalize="characters"
                        maxLength={50}
                        placeholder="VAT, GST or tax ID"
                        description="Shown on your invoices, if you are registered for tax."
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
                    <IconField
                        {...bind('phone')}
                        label="Company phone"
                        icon={PhoneIcon}
                        type="tel"
                        autoComplete="tel"
                        placeholder="+ country code and number"
                        description="Include the country code."
                    />
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
                    <IconCombobox
                        {...bind('country_code')}
                        onChange={onCountryChange}
                        label="Country"
                        icon={GlobeIcon}
                        items={countryItems}
                        placeholder="Search for your country"
                        emptyText="No country matches that search."
                    />
                    <IconField {...bind('city')} label="City" icon={MapPinnedIcon} optional autoComplete="address-level2" placeholder="City" />
                    <IconField
                        {...bind('address_line_1')}
                        label="Office address"
                        icon={MapPinIcon}
                        optional
                        autoComplete="address-line1"
                        placeholder="Street, building and suite"
                        className="sm:col-span-2"
                    />
                </div>
            </FieldSection>
        </div>
    );
}
