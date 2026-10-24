/**
 * The EstateCamp Terms of Service, shown in the sign-up dialog and on the
 * public /terms page. The version a company accepts is recorded on the
 * server (Company::TERMS_VERSION): change that version whenever this text
 * changes, so every acceptance points to the words that were agreed.
 *
 * Each section has `paragraphs`, and optionally `points` listed after them.
 */
export const TERMS_SECTIONS = [
    {
        id: 'agreement',
        title: 'About these terms',
        paragraphs: [
            'These Terms of Service are an agreement between EstateCamp ("we", "us") and the company that registers a workspace ("the Customer", "you"). They apply to every part of the EstateCamp service, including your workspace and the emails it sends.',
            'The person who completes sign-up confirms that they are authorised to accept these terms on the Customer’s behalf, and that the Customer is bound by them.',
        ],
    },
    {
        id: 'workspace',
        title: 'Your workspace and accounts',
        paragraphs: ['Each Customer gets one workspace, reached at its own workspace address, with the users the Customer creates.'],
        points: [
            'The super admin named at sign-up manages the workspace: who can sign in, their roles and what they can reach.',
            'Every user must have their own account. Sign-in details are personal and must not be shared.',
            'Sign-in details are sent by email when accounts are created. Users should change a temporary password after their first sign-in and delete the email once they have signed in.',
            'You are responsible for everything done through your users’ accounts, and must tell us promptly if you suspect an account has been used without permission.',
        ],
    },
    {
        id: 'accuracy',
        title: 'Accurate company details',
        paragraphs: [
            'The company details you give us, including your legal name, business registration or licence number and tax registration number, must be true and kept up to date in Configuration → Company. We may suspend a workspace registered with false or misleading details.',
        ],
    },
    {
        id: 'use',
        title: 'Using EstateCamp',
        paragraphs: [
            'EstateCamp is provided for running your own business: managing properties, rooms, beds, apartments and shops; landlords, head leases, clients and contracts; occupants and check-ins; cheques, invoices and payments; maintenance jobs, annual maintenance contracts and contractor visits; staff, attendance and payroll; and the reports drawn from them.',
        ],
        points: [
            'Do not use the service for anything unlawful, or to store content you have no right to hold.',
            'Do not try to reach another Customer’s workspace or data, test the service’s security, or disrupt it, including by uploading malicious files.',
            'Do not copy, resell or sublicense the service, or reverse engineer it except where the law allows.',
            'Do not use automated tools to extract data from the service at a rate that affects other Customers.',
        ],
    },
    {
        id: 'data',
        title: 'Your data',
        paragraphs: [
            'You own the information you enter or upload, such as property and tenant records, contracts, cheque images, invoices, staff details and documents ("Customer Data").',
            'You allow us to host, store, back up, process and display Customer Data only as needed to provide, secure and support the service. We do not sell Customer Data or use it to advertise to you or anyone else.',
        ],
    },
    {
        id: 'privacy',
        title: 'Personal data and data protection',
        paragraphs: [
            'Customer Data often includes personal data about other people: occupants and clients, landlords, contractors and your staff, including identity documents (such as passports, national identity cards and visas), contact details, salaries, attendance and payment records.',
        ],
        points: [
            'You decide what personal data is entered and why, and act as its controller. We process it on your behalf and only on your instructions, which are given by using the service.',
            'You are responsible for having a lawful basis for that data, and for giving the people concerned any notice or obtaining any consent required by the data protection and privacy laws that apply to you.',
            'We protect personal data with appropriate technical and organisational measures, including keeping each workspace’s records separate and storing passwords only in hashed form.',
            'Only people who need access to run the service may reach Customer Data, and they are bound by confidentiality. Suppliers we rely on, such as hosting and email delivery, are held to equivalent obligations.',
            'If we become aware of a breach affecting your personal data, we will tell you without undue delay and help you meet your own obligations.',
        ],
    },
    {
        id: 'records',
        title: 'Financial records',
        paragraphs: [
            'EstateCamp records money that moves through your business; it does not hold, transfer or clear funds, and does not present cheques to any bank. You remain responsible for your accounts and tax filings, and for checking the figures, invoices and reports the service produces before relying on them.',
        ],
    },
    {
        id: 'fees',
        title: 'Fees',
        paragraphs: [
            'If your plan has fees, they are set out in your order or invoice from us, and are payable as stated there. Unless stated otherwise, fees exclude taxes such as VAT, GST or sales tax, which are added where they apply. We may suspend a workspace whose fees remain unpaid after we have reminded you.',
        ],
    },
    {
        id: 'availability',
        title: 'Availability and changes to the service',
        paragraphs: [
            'We work to keep EstateCamp available and secure, but it may be interrupted for maintenance and updates, or by causes outside our control. We improve the service over time and may change or remove features; we will give reasonable notice before removing anything you rely on.',
        ],
    },
    {
        id: 'confidentiality',
        title: 'Confidentiality',
        paragraphs: [
            'Each of us will keep the other’s non-public information confidential, use it only for the purposes of this agreement, and share it only with people who need it and are bound to keep it confidential, unless the law requires otherwise.',
        ],
    },
    {
        id: 'termination',
        title: 'Suspension and closing a workspace',
        paragraphs: [
            'You can stop using EstateCamp at any time and ask us to close your workspace. We may suspend or close a workspace that breaks these terms, puts the service or other Customers at risk, or has fees overdue.',
            'When a workspace closes, you can ask for an export of your Customer Data within 30 days. After that we may delete it, except where the law requires us to keep it.',
        ],
    },
    {
        id: 'liability',
        title: 'Liability',
        paragraphs: [
            'To the extent the law allows, the service is provided as is, and we are not liable for indirect or consequential losses, loss of profit, or losses caused by data entered incorrectly. Our total liability under these terms is limited to the fees you paid us in the 12 months before the claim. Nothing in these terms limits liability that cannot be limited by law.',
        ],
    },
    {
        id: 'changes',
        title: 'Changes to these terms',
        paragraphs: [
            'We may update these terms. The version in force is shown at the top. We will email your super admin at least 30 days before a material change takes effect; continuing to use the service after that date means you accept the new version.',
        ],
    },
    {
        id: 'law',
        title: 'Governing law',
        paragraphs: [
            'These terms are governed by the laws of the country in which EstateCamp is established, and its courts have jurisdiction over any dispute about them, except where the law of your country gives you the right to bring a claim there.',
        ],
    },
    {
        id: 'contact',
        title: 'Contact',
        paragraphs: ['For questions about these terms or about your data, contact EstateCamp support using the details on our website.'],
    },
];

/**
 * The version (its effective date, YYYY-MM-DD) as a readable date.
 */
export const formatTermsDate = (version) =>
    new Date(`${version}T00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
