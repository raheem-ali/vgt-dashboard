<?php

namespace App\Http\Controllers;

use App\Models\Property;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;

/** Admin-only CRUD for listings, including image / floor plan upload. */
class AdminPropertyController extends Controller
{
    /** Plain text columns => max length. */
    private const TEXT = [
        'hero_eyebrow' => 255, 'hero_title' => 255, 'hero_subtitle' => 1000,
        'hero_btn1_label' => 60, 'hero_btn2_label' => 60,
        'mp_label' => 80, 'mp_heading' => 255, 'mp_intro' => 2000, 'mp_caption' => 255,
        'mp_list_title' => 120, 'mp_footnote' => 2000, 'breadcrumb' => 255,
        'offers_heading' => 255, 'offers_footnote' => 2000,
        'story_label' => 80, 'story_heading' => 255, 'story_caption' => 255, 'story_btn_label' => 60,
        'res_label' => 80, 'res_heading' => 255, 'res_intro' => 2000, 'res_btn_label' => 80,
        'amenities_label' => 80, 'amenities_heading' => 255, 'amenities_intro' => 2000, 'amenities_btn_label' => 80,
        'pay_label' => 80,
        'related_label' => 80, 'related_heading' => 255,
        'enq_label' => 80, 'enq_heading' => 255, 'enq_intro' => 2000, 'enq_privacy' => 500,
        'seo_title' => 255, 'seo_description' => 500,
    ];

    /** Button targets: "#anchor", "/path" or http(s) URL. */
    private const TARGETS = ['hero_btn1_target', 'hero_btn2_target', 'story_btn_link', 'amenities_btn_link', 'res_btn_target'];

    private const SECTION_KEYS = [
        'masterplan', 'gallery', 'offers', 'story', 'developer', 'residences',
        'stats', 'amenities', 'payment', 'faq', 'related', 'enquiry',
    ];

    public function index(Request $request): JsonResponse
    {
        $query = Property::query();

        if ($type = $request->query('listing_type')) {
            $query->where('listing_type', $type);
        }

        if ($search = trim((string) $request->query('search', ''))) {
            $query->where(function ($w) use ($search) {
                $w->where('title', 'like', "%{$search}%")
                    ->orWhere('location', 'like', "%{$search}%");
            });
        }

        $items = $query->orderByDesc('created_at')->orderByDesc('id')->get();

        return response()->json([
            'data' => $items->map(fn (Property $p) => $p->toApi(true))->values(),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate($this->rules());

        $units = $this->unitRows($request);
        $this->syncHeadline($data, $units);

        $gallery = $this->gallery($request, []);
        $this->requireImage($gallery['images']);

        $property = Property::create($this->payload($request, $data, $gallery, $units, null));

        return response()->json(['data' => $property->toApi(true)], 201);
    }

    // POST (multipart) so files can be sent; the dashboard calls POST /admin/properties/{id}
    public function update(Request $request, Property $property): JsonResponse
    {
        $data = $request->validate($this->rules());

        $units = $this->unitRows($request);
        $this->syncHeadline($data, $units);

        $before = $this->ownedFiles($property);

        $gallery = $this->gallery($request, array_values($property->images ?? []));
        $this->requireImage($gallery['images']);

        $property->update($this->payload($request, $data, $gallery, $units, $property));

        $property = $property->fresh();
        $this->deleteFiles(array_diff($before, $this->ownedFiles($property)));

        return response()->json(['data' => $property->toApi(true)]);
    }

    public function destroy(Property $property): JsonResponse
    {
        $this->deleteFiles($this->ownedFiles($property));
        $property->delete();

        return response()->json(['message' => 'Property deleted.']);
    }

    private function rules(): array
    {
        $rules = [
            'title' => 'required|string|max:255',
            'listing_type' => 'required|in:buy,rent,ready,offplan',
            'property_type' => 'nullable|string|max:50',
            'location' => 'required|string|max:255',
            'developer' => 'nullable|string|max:100',
            'developer_id' => 'nullable|integer|min:1',
            'community_id' => 'nullable|integer|min:1',
            'price' => 'nullable|numeric|min:0',
            'price_period' => 'nullable|string|max:20',
            'bedrooms' => 'nullable|string|max:30',
            'bathrooms' => 'nullable|integer|min:0|max:50',
            'area_sq_ft' => 'nullable|integer|min:0',
            'tagline' => 'nullable|string|max:255',
            'handover_date' => 'nullable|string|max:50',
            'highlights' => 'nullable|string|max:60000',
            'amenities' => 'nullable|string|max:20000',
            'payment_plan' => 'nullable|string|max:20000',
            'faqs' => 'nullable|string|max:60000',
            'description' => 'nullable|string|max:10000',
            'phone' => 'nullable|string|max:30',
            'whatsapp' => 'nullable|string|max:30',
            'is_featured' => 'nullable|boolean',
            'status' => 'required|in:published,draft',
            'related_mode' => 'nullable|in:auto,manual',
            'enq_email' => 'nullable|email|max:150',

            // JSON strings
            'unit_types' => 'nullable|string|max:100000',
            'stats' => 'nullable|string|max:20000',
            'mp_rows' => 'nullable|string|max:40000',
            'story_paragraphs' => 'nullable|string|max:20000',
            'payment_plans' => 'nullable|string|max:100000',
            'enq_perks' => 'nullable|string|max:20000',
            'related_picks' => 'nullable|string|max:20000',
            'sections' => 'nullable|string|max:5000',
            'gallery' => 'nullable|string|max:100000',

            // Gallery files
            'keep_images' => 'nullable|array',
            'keep_images.*' => 'string',
            'image_urls' => 'nullable|array',
            'image_urls.*' => 'url|max:2000',
            'images' => 'nullable|array|max:40',
            'images.*' => 'image|max:4096',

            // Unit floor plans: unit_floor_plans[<row index>]
            'unit_floor_plans' => 'nullable|array',
            'unit_floor_plans.*' => 'nullable|file|mimes:jpg,jpeg,png,webp,pdf|max:8192',
        ];

        foreach (self::TEXT as $field => $max) {
            $rules[$field] = "nullable|string|max:{$max}";
        }
        foreach (self::TARGETS as $field) {
            $rules[$field] = ['nullable', 'string', 'max:500', 'regex:/^(https?:\/\/|\/|#)\S+$/i'];
        }
        foreach (Property::FILE_FIELDS as $field) {
            $rules[$field] = 'nullable|string|max:2000';
            $rules[$field . '_file'] = 'nullable|image|max:4096';
        }

        return $rules;
    }

    // ---------------------------------------------------------------- gallery

    /**
     * Ordered gallery with captions. New dashboards send `gallery` (JSON list of
     * {kind: keep|url|file, value | index, caption}); older clients fall back to
     * keep_images + image_urls + images.
     *
     * @return array{images: string[], captions: string[]}
     */
    private function gallery(Request $request, array $existing): array
    {
        $images = [];
        $captions = [];
        $add = function (string $value, string $caption) use (&$images, &$captions) {
            if ($value === '' || in_array($value, $images, true) || count($images) >= 40) {
                return;
            }
            $images[] = $value;
            $captions[] = mb_substr(trim($caption), 0, 200);
        };

        $files = array_values(array_filter((array) $request->file('images', []), fn ($f) => $f instanceof UploadedFile));

        if ($request->input('gallery') !== null) {
            foreach ($this->list($request->input('gallery'), 60) as $item) {
                $kind = $this->str($item, 'kind', 10);
                $caption = $this->str($item, 'caption', 200);
                if ($kind === 'keep') {
                    $value = $this->str($item, 'value', 2000);
                    if (in_array($value, $existing, true)) {
                        $add($value, $caption);
                    }
                } elseif ($kind === 'url') {
                    $value = $this->str($item, 'value', 2000);
                    if (filter_var($value, FILTER_VALIDATE_URL) && preg_match('#^https?://#i', $value)) {
                        $add($value, $caption);
                    }
                } elseif ($kind === 'file') {
                    $file = $files[(int) ($item['index'] ?? -1)] ?? null;
                    if ($file) {
                        $add($file->store('properties', 'public'), $caption);
                    }
                }
            }

            return ['images' => $images, 'captions' => $captions];
        }

        foreach ((array) $request->input('keep_images', []) as $value) {
            if (is_string($value) && in_array($value, $existing, true)) {
                $add($value, '');
            }
        }
        foreach ((array) $request->input('image_urls', []) as $url) {
            if (is_string($url)) {
                $add($url, '');
            }
        }
        foreach ($files as $file) {
            $add($file->store('properties', 'public'), '');
        }

        return ['images' => $images, 'captions' => $captions];
    }

    private function requireImage(array $images): void
    {
        if (count($images) === 0) {
            throw ValidationException::withMessages([
                'images' => ['Add at least one image.'],
            ]);
        }
    }

    // ------------------------------------------------------------- unit types

    /** Cleaned unit-type rows (no files yet). `_src` is the row's index in the submitted JSON. */
    private function unitRows(Request $request): array
    {
        $out = [];
        foreach ($this->list($request->input('unit_types'), 40) as $i => $row) {
            $price = $this->num($row['price'] ?? null);
            $type = $this->str($row, 'type', 60);
            $beds = $this->str($row, 'bedrooms', 40);
            if ($type === '' && $beds === '' && $price === null) {
                continue;
            }
            $status = $this->str($row, 'status', 20);
            $out[] = [
                '_src' => $i,
                'type' => $type,
                'bedrooms' => $beds,
                'area_sq_ft' => $this->num($row['area_sq_ft'] ?? null),
                'price' => $price,
                'price_per_sq_ft' => $this->num($row['price_per_sq_ft'] ?? null),
                'status' => in_array($status, ['Available', 'Limited', 'Sold out'], true) ? $status : '',
                'note' => $this->str($row, 'note', 200),
                'floor_plan' => $this->str($row, 'floor_plan', 2000),
            ];
        }

        return $out;
    }

    /** Store uploaded floor plans, keep owned ones, accept pasted URLs. */
    private function finishUnits(Request $request, array $units, ?Property $property): array
    {
        $owned = [];
        foreach ((array) ($property?->unit_types ?? []) as $u) {
            if (is_array($u) && ! empty($u['floor_plan'])) {
                $owned[] = $u['floor_plan'];
            }
        }
        $files = (array) $request->file('unit_floor_plans', []);

        foreach ($units as &$u) {
            $src = $u['_src'];
            unset($u['_src']);
            $plan = $u['floor_plan'];
            $file = $files[$src] ?? null;

            if ($file instanceof UploadedFile) {
                $plan = $file->store('floor-plans', 'public');
            } elseif ($plan !== '') {
                if (Property::isLocalFile($plan)) {
                    $plan = in_array($plan, $owned, true) ? $plan : '';
                } elseif (! filter_var($plan, FILTER_VALIDATE_URL)) {
                    $plan = '';
                }
            }
            $u['floor_plan'] = $plan !== '' ? $plan : null;
        }
        unset($u);

        return $units;
    }

    /** Headline price / bedrooms / area on the listing follow the unit types. */
    private function syncHeadline(array &$data, array $units): void
    {
        $prices = array_values(array_filter(array_column($units, 'price'), fn ($v) => $v !== null && $v > 0));

        if ($prices) {
            $data['price'] = min($prices);
            $data['price_from'] = true;
        } else {
            $data['price_from'] = false;
            if (! isset($data['price']) || $data['price'] === null || $data['price'] === '') {
                throw ValidationException::withMessages([
                    'price' => ['Enter a price, or add at least one unit type with a price.'],
                ]);
            }
        }

        $numbers = [];
        $studio = false;
        foreach ($units as $u) {
            if (stripos($u['bedrooms'], 'studio') !== false) {
                $studio = true;
            }
            if (preg_match_all('/\d+/', $u['bedrooms'], $m)) {
                foreach ($m[0] as $n) {
                    $numbers[] = (int) $n;
                }
            }
        }
        $numbers = array_values(array_unique($numbers));
        sort($numbers);
        $parts = [];
        if ($studio) {
            $parts[] = 'Studio';
        }
        if (count($numbers) === 1) {
            $parts[] = (string) $numbers[0];
        } elseif (count($numbers) > 1) {
            $parts[] = $numbers[0] . ' - ' . end($numbers);
        }
        if ($parts) {
            $data['bedrooms'] = implode(', ', $parts);
        }

        $areas = array_values(array_filter(array_column($units, 'area_sq_ft'), fn ($v) => $v !== null && $v > 0));
        if ($areas && empty($data['area_sq_ft'])) {
            $data['area_sq_ft'] = (int) round(min($areas));
        }
    }

    // ---------------------------------------------------------------- payload

    private function payload(Request $request, array $data, array $gallery, array $units, ?Property $property): array
    {
        foreach (['keep_images', 'image_urls', 'images', 'gallery', 'unit_floor_plans'] as $k) {
            unset($data[$k]);
        }
        foreach (Property::FILE_FIELDS as $f) {
            unset($data[$f . '_file']);
            $data[$f] = $this->singleFile($request, $f, $property?->{$f});
        }

        $data['images'] = $gallery['images'];
        $data['gallery_captions'] = $gallery['captions'];
        $data['is_featured'] = $request->boolean('is_featured');
        $data['related_mode'] = $request->input('related_mode') === 'manual' ? 'manual' : 'auto';

        // Lists arrive as JSON strings
        $data['highlights'] = $this->rows($request->input('highlights'), ['title', 'description'], 30);
        $data['faqs'] = $this->rows($request->input('faqs'), ['question', 'answer'], 50);
        $data['amenities'] = array_slice(array_values(array_filter(array_map(
            fn ($v) => is_string($v) ? mb_substr(trim($v), 0, 200) : '',
            (array) json_decode((string) $request->input('amenities'), true),
        ))), 0, 200);

        $data['stats'] = $this->rows($request->input('stats'), ['value', 'label'], 12);
        $data['story_paragraphs'] = array_slice(array_values(array_filter(array_map(
            fn ($v) => is_string($v) ? mb_substr(trim($v), 0, 2000) : '',
            (array) json_decode((string) $request->input('story_paragraphs'), true),
        ))), 0, 3);
        $data['enq_perks'] = $this->rows($request->input('enq_perks'), ['text', 'icon'], 8);
        $data['mp_rows'] = $this->mpRows($request->input('mp_rows'));
        $data['payment_plans'] = $this->plans($request->input('payment_plans'));
        $data['payment_plan'] = $this->legacyPlan($data['payment_plans']);
        $data['related_picks'] = $this->picks($request->input('related_picks'), $property?->id);
        $data['sections'] = $this->sections($request->input('sections'));
        $data['unit_types'] = $this->finishUnits($request, $units, $property);

        return $data;
    }

    /** New upload > kept own file > pasted URL > nothing. */
    private function singleFile(Request $request, string $field, ?string $current): ?string
    {
        $file = $request->file($field . '_file');
        if ($file instanceof UploadedFile) {
            return $file->store('properties', 'public');
        }

        $value = trim((string) $request->input($field, ''));
        if ($value === '') {
            return null;
        }
        if (Property::isLocalFile($value)) {
            return $value === $current ? $value : null;
        }

        return filter_var($value, FILTER_VALIDATE_URL) ? mb_substr($value, 0, 2000) : null;
    }

    private function ownedFiles(Property $p): array
    {
        $out = array_values($p->images ?? []);
        foreach (Property::FILE_FIELDS as $f) {
            if ($p->{$f}) {
                $out[] = $p->{$f};
            }
        }
        foreach ((array) ($p->unit_types ?? []) as $u) {
            if (is_array($u) && ! empty($u['floor_plan'])) {
                $out[] = $u['floor_plan'];
            }
        }

        return array_values(array_unique(array_filter(
            $out,
            fn ($v) => is_string($v) && $v !== '' && Property::isLocalFile($v),
        )));
    }

    private function deleteFiles(iterable $paths): void
    {
        foreach ($paths as $path) {
            Storage::disk('public')->delete($path);
        }
    }

    // ---------------------------------------------------------------- helpers

    /** Decode a JSON list (or take an array) of rows; keeps original indexes. */
    private function list(mixed $json, int $max): array
    {
        $arr = is_string($json) ? json_decode($json, true) : $json;
        if (! is_array($arr)) {
            return [];
        }
        $out = [];
        foreach (array_slice($arr, 0, $max, true) as $i => $row) {
            if (is_array($row)) {
                $out[$i] = $row;
            }
        }

        return $out;
    }

    private function str(array $row, string $key, int $max): string
    {
        $v = $row[$key] ?? '';
        if (is_int($v) || is_float($v)) {
            $v = (string) $v;
        }

        return is_string($v) ? mb_substr(trim($v), 0, $max) : '';
    }

    private function num(mixed $v): ?float
    {
        if (is_int($v) || is_float($v)) {
            $n = (float) $v;
        } elseif (is_string($v)) {
            $clean = str_replace([',', ' '], '', $v);
            if ($clean === '' || ! is_numeric($clean)) {
                return null;
            }
            $n = (float) $clean;
        } else {
            return null;
        }

        return $n < 0 ? null : round($n, 2);
    }

    /** Keep only the given string keys, drop rows whose first key is empty. */
    private function rows(mixed $json, array $keys, int $max): array
    {
        $out = [];
        foreach ($this->list($json, $max) as $row) {
            $clean = [];
            foreach ($keys as $key) {
                $clean[$key] = $this->str($row, $key, 2000);
            }
            if ($clean[$keys[0]] !== '') {
                $out[] = $clean;
            }
        }

        return $out;
    }

    private function mpRows(mixed $json): array
    {
        $out = [];
        foreach ($this->list($json, 20) as $row) {
            $name = $this->str($row, 'name', 150);
            if ($name === '') {
                continue;
            }
            $link = $this->str($row, 'link', 20);
            $out[] = [
                'name' => $name,
                'label' => $this->str($row, 'label', 100),
                'here' => ! empty($row['here']),
                'link' => ctype_digit($link) ? $link : '',
            ];
        }

        return $out;
    }

    private function plans(mixed $json): array
    {
        $out = [];
        foreach ($this->list($json, 6) as $plan) {
            $steps = [];
            foreach ($this->list($plan['steps'] ?? [], 12) as $step) {
                $row = [
                    'label' => $this->str($step, 'label', 100),
                    'percent' => $this->str($step, 'percent', 30),
                    'desc' => $this->str($step, 'desc', 500),
                ];
                if ($row['label'] !== '' || $row['percent'] !== '') {
                    $steps[] = $row;
                }
            }
            if (! $steps) {
                continue;
            }
            $out[] = [
                'tab' => $this->str($plan, 'tab', 40),
                'heading' => $this->str($plan, 'heading', 255),
                'intro' => $this->str($plan, 'intro', 2000),
                'note' => $this->str($plan, 'note', 2000),
                'steps' => $steps,
            ];
        }

        return $out;
    }

    /** The first plan is mirrored into the old single payment_plan column. */
    private function legacyPlan(array $plans): ?array
    {
        if (! $plans) {
            return null;
        }
        $first = $plans[0];

        return ['heading' => $first['heading'], 'intro' => $first['intro'], 'note' => $first['note'], 'steps' => $first['steps']];
    }

    private function picks(mixed $json, ?int $selfId): array
    {
        $out = [];
        $seen = [];
        foreach ($this->list($json, 12) as $row) {
            $id = (int) ($row['id'] ?? 0);
            if ($id <= 0 || $id === $selfId || isset($seen[$id])) {
                continue;
            }
            $seen[$id] = true;
            $out[] = ['id' => $id, 'line' => $this->str($row, 'line', 120)];
        }

        return $out;
    }

    private function sections(mixed $json): array
    {
        $in = is_string($json) ? json_decode($json, true) : null;
        $out = [];
        foreach (self::SECTION_KEYS as $key) {
            if (is_array($in) && array_key_exists($key, $in)) {
                $out[$key] = (bool) $in[$key];
            }
        }

        return $out;
    }
}