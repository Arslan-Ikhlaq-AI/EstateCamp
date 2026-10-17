<?php

use App\Models\User;

it('sends guests from the home page to the login page', function () {
    $this->get('/')->assertRedirect(route('login'));
});

it('sends signed-in users from the home page to their dashboard', function () {
    $user = User::factory()->create();

    $this->actingAs($user)->get('/')->assertRedirect(route('dashboard'));
});
