<?php

namespace App\Http\Controllers;

use App\Http\Requests\LookupTypeRequest;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

/**
 * The configuration pages for a list of types shared by every company, such
 * as property and room types, maintenance statuses or staff roles. Anyone
 * can see them; only admins change them. A type's slug is set once from its
 * name, since translations and filters refer to it.
 */
abstract class LookupTypeController extends Controller
{
    /**
     * Which list this is: `property`, `room`, `maintenanceStatus`, `maintenanceCategory` or `staffRole`.
     */
    abstract protected function kind(): string;

    /**
     * The columns each type is listed with; a list with extra settings adds them.
     *
     * @return list<string>
     */
    protected function listedFields(): array
    {
        return ['id', 'name', 'slug', 'description', 'sort_order', 'is_active'];
    }

    /**
     * @return class-string<Model>
     */
    abstract protected function model(): string;

    /**
     * The records using a type, counted for the signed-in company.
     */
    abstract protected function usageInCompany(Model $type, int $companyId): int;

    /**
     * Whether any record anywhere (deleted ones included) still uses a type,
     * which keeps it from being deleted.
     */
    abstract protected function isInUse(Model $type): bool;

    /**
     * List the types with how many of the company's records use each.
     */
    public function index(Request $request): Response
    {
        $companyId = $request->user()->company_id;
        $types = $this->model()::query()->orderBy('sort_order')->orderBy('name')->get();

        return Inertia::render('Configuration/Types', [
            'kind' => $this->kind(),
            'canManage' => Gate::allows('manage-configuration'),
            'types' => $types->map(fn (Model $type) => [
                ...$type->only($this->listedFields()),
                'usage' => $companyId ? $this->usageInCompany($type, $companyId) : 0,
                'inUse' => $this->isInUse($type),
            ]),
        ]);
    }

    /**
     * Add a type at the end of the list unless an order is given.
     */
    public function store(LookupTypeRequest $request): RedirectResponse
    {
        $model = $this->model();
        $slug = $this->uniqueSlug($request->validated('name'));

        $model::query()->create([
            ...$request->validated(),
            'slug' => $slug,
            'sort_order' => $request->validated('sort_order') ?? ((int) $model::query()->max('sort_order') + 1),
        ]);

        return back()->with('success', "{$request->validated('name')} was added.");
    }

    /**
     * Save changes to a type; its slug stays as it was.
     */
    public function update(LookupTypeRequest $request, Model $type): RedirectResponse
    {
        $type->update([...$request->validated(), 'sort_order' => $request->validated('sort_order') ?? $type->sort_order]);

        return back()->with('success', "{$type->name} was updated.");
    }

    /**
     * Delete a type nothing uses; a type in use can be switched off instead.
     *
     * @throws ValidationException When a record still uses the type.
     */
    public function destroy(Model $type): RedirectResponse
    {
        Gate::authorize('manage-configuration');

        if ($this->isInUse($type)) {
            throw ValidationException::withMessages([
                'type' => "{$type->name} is still in use, so it cannot be deleted. Switch it off to stop it being offered.",
            ]);
        }

        $type->delete();

        return back()->with('success', "{$type->name} was deleted.");
    }

    /**
     * A slug from the name (Staff housing → staff_housing), numbered if taken.
     */
    private function uniqueSlug(string $name): string
    {
        $base = Str::slug($name, '_') ?: 'type';
        $slug = $base;

        for ($number = 2; $this->model()::query()->where('slug', $slug)->exists(); $number++) {
            $slug = "{$base}_{$number}";
        }

        return $slug;
    }
}
