<?php

namespace App\Mail;

use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldBeEncrypted;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

/**
 * A new user's sign-in details: their workspace, email, role and the
 * password generated for them. Encrypted while it waits on the queue, so
 * the password is never stored in plain text.
 */
class AccountCredentials extends Mailable implements ShouldBeEncrypted, ShouldQueue
{
    use Queueable, SerializesModels;

    public function __construct(public User $user, public string $password) {}

    /**
     * Get the message envelope.
     */
    public function envelope(): Envelope
    {
        return new Envelope(
            subject: "Your sign-in for {$this->user->company->name} on ".config('app.name'),
        );
    }

    /**
     * Get the message content definition.
     */
    public function content(): Content
    {
        return new Content(
            view: 'mail.account-credentials',
            text: 'mail.account-credentials-text',
            with: [
                'company' => $this->user->company,
                'role' => $this->user->role,
            ],
        );
    }
}
