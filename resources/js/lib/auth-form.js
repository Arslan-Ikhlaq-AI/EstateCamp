// Mirrors Laravel's default `Password` rule. Client checks are a convenience
// only; the server stays the source of truth for every rule.
const MIN_PASSWORD_LENGTH = 8;

// Deliberately loose (no TLD requirement) so addresses such as
// `admin@localhost`, which Laravel's `email` rule accepts, are not blocked.
const looksLikeEmail = (value) => /^[^\s@]+@[^\s@]+$/.test(value.trim());

function validateEmail(email) {
    if (email.trim() === '') {
        return 'The email field is required.';
    }

    if (!looksLikeEmail(email)) {
        return 'The email field must be a valid email address.';
    }
}

/**
 * Returns `{ field: message }` in on-screen order, so the first key is the
 * first invalid field.
 */
export function validateLogin({ email, password }) {
    const errors = {};

    const emailMessage = validateEmail(email);

    if (emailMessage) {
        errors.email = emailMessage;
    }

    if (password === '') {
        errors.password = 'The password field is required.';
    }

    return errors;
}

export function validateRegistration({
    name,
    email,
    password,
    password_confirmation,
}) {
    const errors = {};

    if (name.trim() === '') {
        errors.name = 'The name field is required.';
    }

    const emailMessage = validateEmail(email);

    if (emailMessage) {
        errors.email = emailMessage;
    }

    if (password === '') {
        errors.password = 'The password field is required.';
    } else if (password.length < MIN_PASSWORD_LENGTH) {
        errors.password = `The password field must be at least ${MIN_PASSWORD_LENGTH} characters.`;
    }

    if (password_confirmation === '') {
        errors.password_confirmation = 'Please confirm your password.';
    } else if (password !== password_confirmation) {
        errors.password_confirmation =
            'The password confirmation does not match.';
    }

    return errors;
}

/**
 * Moves keyboard and screen-reader focus to the first invalid control. Field
 * names double as element ids on the auth forms.
 */
export function focusFirstError(errors) {
    const [firstField] = Object.keys(errors);

    if (firstField) {
        document.getElementById(firstField)?.focus();
    }
}
