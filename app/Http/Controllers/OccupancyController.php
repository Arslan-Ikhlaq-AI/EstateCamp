<?php

namespace App\Http\Controllers;

use App\Http\Requests\CheckInRequest;
use App\Http\Requests\CheckOutRequest;
use App\Models\ContractLine;
use App\Models\Occupancy;
use App\Models\Occupant;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Checking occupants into rooms and out again.
 */
class OccupancyController extends Controller
{
    /**
     * The check-in page: the rooms running contracts rent, each with how many
     * it sleeps and how many are staying. Choosing one (`?contract_line=`)
     * loads the client's occupants who are not staying anywhere; `?occupant=`
     * preselects the person and narrows the rooms to their client.
     */
    public function create(Request $request): Response
    {
        $company = $this->currentCompany($request);
        $occupant = $request->integer('occupant') ? $company->occupants()->find($request->integer('occupant')) : null;

        $lines = ContractLine::query()
            ->where('company_id', $company->id)
            ->where('unit_type', 'room')
            ->whereDate('start_date', '<=', today())
            ->whereDate('end_date', '>=', today())
            ->whereHas('contract', fn (Builder $contracts) => $contracts->where('status', 'active')
                ->when($occupant, fn (Builder $query) => $query->where('client_id', $occupant->client_id)))
            ->with(['contract:id,contract_number,client_id', 'contract.client:id,name', 'property:id,name', 'room:id,room_number,block,floor_number,capacity,gender_policy,status'])
            ->withCount(['occupancies as staying_count' => fn (Builder $stays) => $stays->whereNull('check_out_date')])
            ->orderBy('contract_id')
            ->orderBy('id')
            ->get();

        $line = $lines->firstWhere('id', $request->integer('contract_line'));

        return Inertia::render('Occupancies/CheckIn', [
            'lines' => $lines->map(fn (ContractLine $line) => [
                'id' => $line->id,
                'contractNumber' => $line->contract->contract_number,
                'clientName' => $line->contract->client->name,
                'description' => $line->describe(),
                'roomNumber' => $line->room->room_number,
                'block' => $line->room->block,
                'floor' => $line->room->floor_number,
                'genderPolicy' => $line->room->gender_policy,
                'isInService' => $line->room->status === 'active',
                'capacity' => $line->capacity(),
                'staying' => $line->staying_count,
            ]),
            'selectedLineId' => $line?->id,
            'selectedOccupantId' => $occupant?->id,
            'occupants' => $line ? $company->occupants()
                ->where('client_id', $line->contract->client_id)
                ->whereDoesntHave('currentStay')
                ->orderBy('full_name')
                ->get(['id', 'full_name', 'gender', 'employee_number'])
                ->map(fn (Occupant $person) => [
                    'id' => $person->id,
                    'name' => $person->full_name,
                    'gender' => $person->gender,
                    'employeeNumber' => $person->employee_number,
                ]) : [],
            'clientId' => $line?->contract->client_id,
        ]);
    }

    /**
     * Check an occupant into the room their contract line rents.
     */
    public function store(CheckInRequest $request): RedirectResponse
    {
        $stay = DB::transaction(function () use ($request) {
            $stay = new Occupancy($request->safe()->only(['check_in_date', 'notes']));
            $stay->forceFill([
                ...$request->safe()->only(['occupant_id', 'contract_line_id']),
                'room_id' => ContractLine::query()->whereKey($request->integer('contract_line_id'))->value('room_id'),
                'company_id' => $request->user()->company_id,
            ])->save();

            $stay->room->recalculateOccupancy();

            return $stay;
        });

        $stay->load(['occupant', 'room']);

        return to_route('occupants.show', $stay->occupant)
            ->with('success', "{$stay->occupant->full_name} is checked into room {$stay->room->room_number}.");
    }

    /**
     * Check an occupant out; their place in the room is free from the check-out date.
     */
    public function update(CheckOutRequest $request, Occupancy $occupancy): RedirectResponse
    {
        $occupancy->checkOut($request->date('check_out_date'));

        return back()->with('success', "{$occupancy->occupant->full_name} was checked out.");
    }
}
