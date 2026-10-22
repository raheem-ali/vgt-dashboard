<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Off-Plan listings show a handover date (e.g. "Q3 2027")
        Schema::table('properties', function (Blueprint $table) {
            $table->string('handover_date', 50)->nullable()->after('tagline');
        });

        Schema::create('developers', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('slug')->unique();
            $table->string('short_name', 100)->nullable(); // how listings spell it, e.g. "EMAAR"
            $table->text('description')->nullable();
            $table->string('logo')->nullable(); // pasted URL or path on the public disk
            $table->boolean('is_featured')->default(false)->index();
            $table->string('status', 20)->default('published')->index();
            $table->timestamps();
        });

        Schema::create('communities', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('slug')->unique();
            $table->string('city', 100)->index();
            $table->string('tagline')->nullable();   // featured cards only
            $table->text('description')->nullable(); // featured cards + detail page
            $table->string('image')->nullable();
            $table->boolean('is_featured')->default(false)->index();
            $table->string('status', 20)->default('published')->index();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('communities');
        Schema::dropIfExists('developers');
        Schema::table('properties', fn (Blueprint $t) => $t->dropColumn('handover_date'));
    }
};
