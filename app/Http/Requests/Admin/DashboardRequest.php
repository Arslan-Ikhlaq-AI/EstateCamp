<?php

namespace App\Http\Requests\Admin;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class DashboardRequest extends FormRequest
{
    /**
     * The number of days the statistics and signups chart can cover.
     *
     * @var list<int>
     */
    public const RANGES = [7, 30, 90];

    /**
     * The users table columns that can be sorted.
     *
     * @var list<string>
     */
    public const SORTABLE_COLUMNS = ['name', 'email', 'created_at'];

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'range' => ['nullable', 'integer', Rule::in(self::RANGES)],
            'search' => ['nullable', 'string', 'max:100'],
            'status' => ['nullable', Rule::in(['verified', 'unverified'])],
            'sort' => ['nullable', Rule::in(self::SORTABLE_COLUMNS)],
            'direction' => ['nullable', Rule::in(['asc', 'desc'])],
            'page' => ['nullable', 'integer', 'min:1'],
        ];
    }

    /**
     * Get the number of days the statistics and chart cover.
     */
    public function rangeDays(): int
    {
        return $this->filled('range') ? $this->integer('range') : 30;
    }

    /**
     * Get the trimmed search term, or an empty string.
     */
    public function searchTerm(): string
    {
        return $this->string('search')->trim()->toString();
    }

    /**
     * Get the verification status to filter by, if any.
     */
    public function verificationStatus(): ?string
    {
        return $this->filled('status') ? $this->string('status')->toString() : null;
    }

    /**
     * Get the column the users table is sorted by.
     */
    public function sortColumn(): string
    {
        return $this->filled('sort') ? $this->string('sort')->toString() : 'created_at';
    }

    /**
     * Get the direction the users table is sorted in.
     */
    public function sortDirection(): string
    {
        return $this->filled('direction') ? $this->string('direction')->toString() : 'desc';
    }
}
