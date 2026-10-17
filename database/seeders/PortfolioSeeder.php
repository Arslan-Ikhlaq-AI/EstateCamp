<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

/**
 * The demo company and its portfolio: users, properties, rooms, apartments,
 * shops, documents and photos. Tests of those pages seed only this, which
 * keeps them quick; DatabaseSeeder adds the leasing data on top.
 */
class PortfolioSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Run the database seeds. The order matters: each seeder needs the
     * records created by the ones before it.
     */
    public function run(): void
    {
        $this->call([
            UserRoleSeeder::class,
            CompanySeeder::class,
            UserSeeder::class,
            PropertySeeder::class,
            RoomSeeder::class,
            ApartmentSeeder::class,
            ShopSeeder::class,
            PropertyDocumentSeeder::class,
            RoomAttachmentSeeder::class,
        ]);
    }
}
