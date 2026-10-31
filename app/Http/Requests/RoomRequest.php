<?php

namespace App\Http\Requests;

use App\Models\Room;
use Closure;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

class RoomRequest extends FormRequest
{
    /**
     * Only members of a company can save rooms, and only their own. Another
     * company's room answers 404 so its existence is not revealed.
     */
    public function authorize(): bool
    {
        $room = $this->route('room');

        if ($room instanceof Room && $room->company_id !== $this->user()->company_id) {
            throw new NotFoundHttpException;
        }

        return $this->user()->company_id !== null;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'property_id' => [
                'required', 'integer',
                Rule::exists('properties', 'id')
                    ->where('company_id', $this->user()->company_id)
                    ->whereNull('deleted_at'),
            ],
            'room_number' => [
                'required', 'string', 'max:30',
                Rule::unique('rooms')
                    ->where('property_id', $this->integer('property_id'))
                    ->whereNull('deleted_at')
                    ->ignore($this->route('room')),
            ],
            'block' => ['nullable', 'string', 'max:50'],
            'floor_number' => ['nullable', 'integer', 'between:-5,200'],
            'room_type_id' => ['required', 'integer', Rule::exists('room_types', 'id')],
            'gender_policy' => ['nullable', Rule::in(Room::GENDER_POLICIES)],
            'capacity' => [
                'required', 'integer', 'between:1,100',
                // A room cannot shrink below the people checked into it.
                function (string $attribute, mixed $value, Closure $fail) {
                    $room = $this->route('room');
                    $staying = $room instanceof Room ? $room->peopleStaying() : 0;

                    if ((int) $value < $staying) {
                        $fail("{$staying} people are staying in this room, so it must sleep at least {$staying}.");
                    }
                },
            ],
            'area_sqm' => ['nullable', 'numeric', 'gt:0', 'max:10000'],
            'monthly_rent' => ['nullable', 'numeric', 'min:0', 'max:1000000'],
            'amenities' => ['array'],
            'amenities.*' => ['distinct', Rule::in(Room::AMENITIES)],
            'status' => ['required', Rule::in(Room::STATUSES)],
            'notes' => ['nullable', 'string', 'max:5000'],
            'photos' => ['array', 'max:10'],
            'photos.*' => ['image', 'max:5120'],
            'keep_photos' => ['array'],
            'keep_photos.*' => ['integer'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function attributes(): array
    {
        return [
            'property_id' => 'property',
            'room_type_id' => 'room type',
            'capacity' => 'sleeps',
            'monthly_rent' => 'rent per month',
            'photos.*' => 'photo',
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'room_number.unique' => 'This property already has a room with that number.',
        ];
    }
}
