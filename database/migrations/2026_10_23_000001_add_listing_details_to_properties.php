<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /** Every column this migration adds. */
    private array $columns = [
        'price_from', 'developer_id', 'community_id', 'unit_types',
        'faqs', 'payment_plan',
        'hero_eyebrow', 'hero_title', 'hero_subtitle', 'hero_image',
        'hero_btn1_label', 'hero_btn1_target', 'hero_btn2_label', 'hero_btn2_target',
        'mp_label', 'mp_heading', 'mp_intro', 'mp_image', 'mp_caption', 'mp_list_title',
        'mp_rows', 'mp_footnote', 'breadcrumb', 'gallery_captions',
        'offers_heading', 'offers_footnote',
        'story_label', 'story_heading', 'story_paragraphs', 'story_image', 'story_caption',
        'story_btn_label', 'story_btn_link',
        'res_label', 'res_heading', 'res_intro', 'res_btn_label', 'res_btn_target',
        'stats',
        'amenities_label', 'amenities_heading', 'amenities_intro', 'amenities_btn_label', 'amenities_btn_link',
        'pay_label', 'payment_plans',
        'related_label', 'related_heading', 'related_mode', 'related_picks',
        'enq_label', 'enq_heading', 'enq_intro', 'enq_perks', 'enq_email', 'enq_privacy',
        'sections', 'seo_title', 'seo_description', 'seo_image',
    ];

    /** Text columns. TEXT is stored off-row in MySQL, so it does not count toward the 65,535-byte row limit. */
    private array $textColumns = [
        'hero_eyebrow', 'hero_title', 'hero_subtitle', 'hero_image',
        'hero_btn1_label', 'hero_btn1_target', 'hero_btn2_label', 'hero_btn2_target',
        'mp_label', 'mp_heading', 'mp_intro', 'mp_image', 'mp_caption', 'mp_list_title',
        'mp_footnote', 'breadcrumb',
        'offers_heading', 'offers_footnote',
        'story_label', 'story_heading', 'story_image', 'story_caption',
        'story_btn_label', 'story_btn_link',
        'res_label', 'res_heading', 'res_intro', 'res_btn_label', 'res_btn_target',
        'amenities_label', 'amenities_heading', 'amenities_intro', 'amenities_btn_label', 'amenities_btn_link',
        'pay_label',
        'related_label', 'related_heading', 'related_mode',
        'enq_label', 'enq_heading', 'enq_intro', 'enq_email', 'enq_privacy',
        'seo_title', 'seo_description', 'seo_image',
    ];

    private array $jsonColumns = [
        'unit_types', 'faqs', 'payment_plan', 'mp_rows', 'gallery_captions', 'story_paragraphs', 'stats',
        'payment_plans', 'related_picks', 'enq_perks', 'sections',
    ];

    public function up(): void
    {
        // A previous failed run may have added some of these columns. Remove them first.
        $this->dropExisting();

        Schema::table('properties', function (Blueprint $table) {
            $table->boolean('price_from')->default(false);
            $table->unsignedBigInteger('developer_id')->nullable();
            $table->unsignedBigInteger('community_id')->nullable();

            foreach ($this->jsonColumns as $column) {
                $table->json($column)->nullable();
            }
            foreach ($this->textColumns as $column) {
                $table->text($column)->nullable();
            }
        });
    }

    public function down(): void
    {
        $this->dropExisting();
    }

    private function dropExisting(): void
    {
        $existing = array_values(array_filter(
            $this->columns,
            fn (string $column) => Schema::hasColumn('properties', $column),
        ));

        if ($existing) {
            Schema::table('properties', function (Blueprint $table) use ($existing) {
                $table->dropColumn($existing);
            });
        }
    }
};