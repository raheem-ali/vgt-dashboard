<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Property extends Model
{
    public const DEFAULT_PHONE = '+971545834608';

    /** Single-file columns (path on the public disk or a pasted URL). */
    public const FILE_FIELDS = ['hero_image', 'mp_image', 'story_image', 'seo_image'];

    protected $fillable = [
        'title', 'listing_type', 'property_type', 'location', 'developer',
        'price', 'price_period', 'bedrooms', 'bathrooms', 'area_sq_ft',
        'tagline', 'handover_date', 'highlights', 'amenities', 'payment_plan', 'faqs',
        'description', 'images', 'phone', 'whatsapp', 'is_featured', 'status',
        // added by 2026_10_23_000001
        'price_from', 'developer_id', 'community_id', 'unit_types',
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

    protected $casts = [
        'images' => 'array',
        'highlights' => 'array',
        'amenities' => 'array',
        'payment_plan' => 'array',
        'faqs' => 'array',
        'unit_types' => 'array',
        'mp_rows' => 'array',
        'gallery_captions' => 'array',
        'story_paragraphs' => 'array',
        'stats' => 'array',
        'payment_plans' => 'array',
        'related_picks' => 'array',
        'enq_perks' => 'array',
        'sections' => 'array',
        'price' => 'float',
        'price_from' => 'boolean',
        'bathrooms' => 'integer',
        'area_sq_ft' => 'integer',
        'developer_id' => 'integer',
        'community_id' => 'integer',
        'is_featured' => 'boolean',
    ];

    /** Stored value is either a pasted URL or a path on the public disk. */
    public static function isLocalFile(string $value): bool
    {
        return ! preg_match('#^https?://#i', $value);
    }

    public static function resolveImage(string $value): string
    {
        return self::isLocalFile($value)
            ? url('storage/' . ltrim($value, '/'))
            : $value;
    }

    private static function resolveOrNull(?string $value): ?string
    {
        return $value ? self::resolveImage($value) : null;
    }

    /** True when the current request is the single-listing endpoint (route has {property} or {id}). */
    private function isSingleRequest(): bool
    {
        $route = request()->route();

        return $route && ($route->hasParameter('property') || $route->hasParameter('id'));
    }

    /**
     * $admin  -> adds raw stored values for the dashboard (and always returns full detail)
     * $detail -> null = auto (full on admin and on the single-listing endpoint, light elsewhere)
     */
    public function toApi(bool $admin = false, ?bool $detail = null): array
    {
        $detail ??= $admin || $this->isSingleRequest();

        $raw = array_values($this->images ?? []);
        $resolved = array_map([self::class, 'resolveImage'], $raw);

        $data = [
            'id' => $this->id,
            'title' => $this->title,
            'listing_type' => $this->listing_type,
            'property_type' => $this->property_type,
            'location' => $this->location,
            'developer' => $this->developer,
            'developer_id' => $this->developer_id,
            'price' => $this->price,
            'price_from' => (bool) $this->price_from,
            'price_period' => $this->price_period,
            'bedrooms' => $this->bedrooms,
            'bathrooms' => $this->bathrooms,
            'area_sq_ft' => $this->area_sq_ft,
            'tagline' => $this->tagline,
            'handover_date' => $this->handover_date,
            'highlights' => $this->highlights ?? [],
            'amenities' => $this->amenities ?? [],
            'payment_plan' => $this->payment_plan,
            'faqs' => $this->faqs ?? [],
            'description' => $this->description,
            'images' => $resolved,
            'image' => $resolved[0] ?? null,
            'phone' => $this->phone ?: self::DEFAULT_PHONE,
            'whatsapp' => $this->whatsapp ?: ($this->phone ?: self::DEFAULT_PHONE),
            'is_featured' => $this->is_featured,
            'status' => $this->status,
            'created_at' => optional($this->created_at)->toIso8601String(),
        ];

        if ($admin) {
            $data['images_raw'] = $raw;
        }

        if ($detail) {
            $data += $this->detailApi($admin, count($raw));
        }

        return $data;
    }

    private function detailApi(bool $admin, int $imageCount): array
    {
        $units = array_map(function ($u) use ($admin) {
            $u = is_array($u) ? $u : [];
            $plan = $u['floor_plan'] ?? null;
            $row = [
                'type' => (string) ($u['type'] ?? ''),
                'bedrooms' => (string) ($u['bedrooms'] ?? ''),
                'area_sq_ft' => $u['area_sq_ft'] ?? null,
                'price' => $u['price'] ?? null,
                'price_per_sq_ft' => $u['price_per_sq_ft'] ?? null,
                'status' => (string) ($u['status'] ?? ''),
                'note' => (string) ($u['note'] ?? ''),
                'floor_plan' => self::resolveOrNull($plan),
            ];
            if ($admin) {
                $row['floor_plan_raw'] = $plan;
            }

            return $row;
        }, array_values($this->unit_types ?? []));

        $plans = $this->payment_plans ?: ($this->payment_plan
            ? [['tab' => ''] + $this->payment_plan]
            : []);

        $captions = array_values($this->gallery_captions ?? []);
        $captions = array_slice(array_pad($captions, $imageCount, ''), 0, $imageCount);

        $detail = [
            'community_id' => $this->community_id,
            'unit_types' => $units,
            'hero_eyebrow' => $this->hero_eyebrow,
            'hero_title' => $this->hero_title,
            'hero_subtitle' => $this->hero_subtitle,
            'hero_image' => self::resolveOrNull($this->hero_image),
            'hero_btn1_label' => $this->hero_btn1_label,
            'hero_btn1_target' => $this->hero_btn1_target,
            'hero_btn2_label' => $this->hero_btn2_label,
            'hero_btn2_target' => $this->hero_btn2_target,
            'mp_label' => $this->mp_label,
            'mp_heading' => $this->mp_heading,
            'mp_intro' => $this->mp_intro,
            'mp_image' => self::resolveOrNull($this->mp_image),
            'mp_caption' => $this->mp_caption,
            'mp_list_title' => $this->mp_list_title,
            'mp_rows' => array_values($this->mp_rows ?? []),
            'mp_footnote' => $this->mp_footnote,
            'breadcrumb' => $this->breadcrumb,
            'gallery_captions' => $captions,
            'offers_heading' => $this->offers_heading,
            'offers_footnote' => $this->offers_footnote,
            'story_label' => $this->story_label,
            'story_heading' => $this->story_heading,
            'story_paragraphs' => array_values($this->story_paragraphs ?? []),
            'story_image' => self::resolveOrNull($this->story_image),
            'story_caption' => $this->story_caption,
            'story_btn_label' => $this->story_btn_label,
            'story_btn_link' => $this->story_btn_link,
            'res_label' => $this->res_label,
            'res_heading' => $this->res_heading,
            'res_intro' => $this->res_intro,
            'res_btn_label' => $this->res_btn_label,
            'res_btn_target' => $this->res_btn_target,
            'stats' => array_values($this->stats ?? []),
            'amenities_label' => $this->amenities_label,
            'amenities_heading' => $this->amenities_heading,
            'amenities_intro' => $this->amenities_intro,
            'amenities_btn_label' => $this->amenities_btn_label,
            'amenities_btn_link' => $this->amenities_btn_link,
            'pay_label' => $this->pay_label,
            'payment_plans' => array_values($plans),
            'related_label' => $this->related_label,
            'related_heading' => $this->related_heading,
            'related_mode' => $this->related_mode ?: 'auto',
            'related' => $this->related_mode === 'manual' ? $this->relatedCards() : [],
            'enq_label' => $this->enq_label,
            'enq_heading' => $this->enq_heading,
            'enq_intro' => $this->enq_intro,
            'enq_perks' => array_values($this->enq_perks ?? []),
            'enq_email' => $this->enq_email,
            'enq_privacy' => $this->enq_privacy,
            'sections' => (object) ($this->sections ?? []),
            'seo_title' => $this->seo_title,
            'seo_description' => $this->seo_description,
            'seo_image' => self::resolveOrNull($this->seo_image),
        ];

        if ($admin) {
            $detail['related_picks'] = array_values($this->related_picks ?? []);
            $detail['files_raw'] = [
                'hero_image' => $this->hero_image,
                'mp_image' => $this->mp_image,
                'story_image' => $this->story_image,
                'seo_image' => $this->seo_image,
            ];
        }

        return $detail;
    }

    /** Manually picked "continue browsing" cards, in the admin's order. Drafts are skipped. */
    private function relatedCards(): array
    {
        $picks = array_values(array_filter((array) ($this->related_picks ?? []), 'is_array'));
        if (! $picks) {
            return [];
        }

        $ids = array_map(fn ($r) => (int) ($r['id'] ?? 0), $picks);
        $models = self::query()->where('status', 'published')->whereIn('id', $ids)->get()->keyBy('id');

        $out = [];
        foreach ($picks as $r) {
            $m = $models->get((int) ($r['id'] ?? 0));
            if (! $m) {
                continue;
            }
            $first = ($m->images ?? [])[0] ?? null;
            $out[] = [
                'id' => $m->id,
                'title' => $m->title,
                'location' => $m->location,
                'image' => $first ? self::resolveImage($first) : null,
                'price' => $m->price,
                'price_period' => $m->price_period,
                'price_from' => (bool) $m->price_from,
                'listing_type' => $m->listing_type,
                'line' => (string) ($r['line'] ?? ''),
            ];
        }

        return $out;
    }
}