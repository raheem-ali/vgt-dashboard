<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('blog_posts')) {
            return;
        }

        Schema::create('blog_posts', function (Blueprint $table) {
            $table->id();
            $table->string('slug', 191)->unique();
            $table->string('title');
            $table->text('excerpt')->nullable();
            $table->string('category', 100)->default('News');
            $table->date('published_at')->nullable();
            $table->unsignedSmallInteger('read_time')->nullable(); // null = calculated automatically
            $table->string('status', 20)->default('published');
            $table->text('image')->nullable(); // path on the public disk or a pasted URL
            $table->json('intro')->nullable(); // ["paragraph", ...]
            $table->json('sections')->nullable(); // [{id, heading, paragraphs: []}]
            $table->text('seo_title')->nullable();
            $table->text('seo_description')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('blog_posts');
    }
};