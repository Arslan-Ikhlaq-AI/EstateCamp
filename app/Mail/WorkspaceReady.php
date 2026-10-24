<?php

namespace App\Mail;

use App\Models\Company;
use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

/**
 * Sent to the company's own address once it has signed up: its workspace,
 * its settings and who can sign in, without anyone's password.
 */
class WorkspaceReady extends Mailable implements ShouldQueue
{
    use Queueable, SerializesModels;

    public function __construct(public Company $company) {}

    /**
     * Get the message envelope.
     */
    public function envelope(): Envelope
    {
        return new Envelope(
            subject: "{$this->company->name} is live on ".config('app.name'),
        );
    }

    /**
     * Get the message content definition.
     */
    public function content(): Content
    {
        return new Content(
            view: 'mail.workspace-ready',
            text: 'mail.workspace-ready-text',
            with: [
                'businessType' => Company::BUSINESS_TYPES[$this->company->business_type] ?? null,
                'users' => $this->company->users()->with('role')->orderBy('id')->get()->map(fn (User $user) => [
                    'name' => $user->name,
                    'email' => $user->email,
                    'role' => $user->role?->name,
                ]),
            ],
        );
    }
}
