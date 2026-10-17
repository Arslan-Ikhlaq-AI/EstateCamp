<?php

namespace App\Http\Requests;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rules\Exists;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

/**
 * A request about one company's records. Only members of a company may send
 * it, and a record from another company in the route answers 404 so its
 * existence is not revealed.
 */
abstract class CompanyScopedRequest extends FormRequest
{
    /**
     * The route parameter holding the record being changed, if any.
     */
    protected ?string $recordParameter = null;

    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        $record = $this->recordParameter ? $this->route($this->recordParameter) : null;

        if ($record instanceof Model && $record->company_id !== $this->user()->company_id) {
            throw new NotFoundHttpException;
        }

        return $this->user()->company_id !== null;
    }

    /**
     * The id of the signed-in user's company.
     */
    protected function companyId(): int
    {
        return $this->user()->company_id;
    }

    /**
     * An `exists` rule limited to live rows of the user's company.
     */
    protected function existsInCompany(string $table, bool $softDeletes = true): Exists
    {
        $rule = (new Exists($table, 'id'))->where('company_id', $this->companyId());

        return $softDeletes ? $rule->whereNull('deleted_at') : $rule;
    }
}
