<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('properties', function (Blueprint $table) {
            $table->id();
            $table->string('title');
            $table->string('listing_type', 20)->index(); // buy | rent | ready | offplan
            $table->string('property_type', 50)->nullable(); // Villa, Apartment, Townhouse...
            $table->string('location');
            $table->string('developer', 100)->nullable()->index();
            $table->decimal('price', 14, 2);
            $table->string('price_period', 20)->nullable(); // Year / Month (rent)
            $table->string('bedrooms', 30)->nullable(); // "3", "Studio", "3, 4"
            $table->unsignedSmallInteger('bathrooms')->nullable();
            $table->unsignedInteger('area_sq_ft')->nullable();
            $table->string('tagline')->nullable(); // optional line shown on home cards
            $table->text('description')->nullable();
            $table->json('images')->nullable(); // first = main image, next two = side images
            $table->string('phone', 30)->nullable();
            $table->string('whatsapp', 30)->nullable();
            $table->boolean('is_featured')->default(false)->index(); // Exclusive carousel + Hot Properties on home
            $table->string('status', 20)->default('published')->index(); // published | draft
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('properties');
    }
};
