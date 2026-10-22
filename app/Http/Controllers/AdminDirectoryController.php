<?php

namespace App\Http\Controllers;

use App\Models\Community;
use App\Models\Developer;
use App\Models\Property;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

/** Admin CRUD for developers and communities. {resource} is "developers" or "communities". */
class AdminDirectoryController extends Controller
{
    private const MODELS = ['developers' => Developer::class, 'communities' => Community::class];

    private function model(string $resource): string
    {
        abort_unless(isset(self::MODELS[$resource]), 404);

        return self::MODELS[$resource];
    }

    public function index(string $resource): JsonResponse
    {
        $model = $this->model($resource);
        $rows = Property::where('status', 'published')->get(['developer', 'location'])->toArray();

        return response()->json([
            'data' => $model::orderBy('name')->get()->map(fn ($m) => $m->toApi($rows, true))->values(),
        ]);
    }

    public function store(Request $request, string $resource): JsonResponse
    {
        $model = $this->model($resource);
        $data = $this->validated($request, $resource);
        $data[$model::IMAGE_FIELD] = $this->image($request, null);
        $data['slug'] = $this->uniqueSlug($model, $data['name']);

        return response()->json(['data' => $model::create($data)->toApi([], true)], 201);
    }

    public function update(Request $request, string $resource, int $id): JsonResponse
    {
        $model = $this->model($resource);
        $item = $model::findOrFail($id);
        $field = $model::IMAGE_FIELD;

        $data = $this->validated($request, $resource);
        $data[$field] = $this->image($request, $item->{$field});
        if ($item->name !== $data['name']) {
            $data['slug'] = $this->uniqueSlug($model, $data['name'], $item->id);
        }
        $item->update($data);

        return response()->json(['data' => $item->fresh()->toApi([], true)]);
    }

    public function destroy(string $resource, int $id): JsonResponse
    {
        $model = $this->model($resource);
        $item = $model::findOrFail($id);
        $this->deleteFile($item->{$model::IMAGE_FIELD});
        $item->delete();

        return response()->json(['message' => 'Deleted.']);
    }

    private function validated(Request $request, string $resource): array
    {
        $rules = [
            'name' => 'required|string|max:255',
            'description' => 'nullable|string|max:5000',
            'is_featured' => 'nullable|boolean',
            'status' => 'required|in:published,draft',
            'image_url' => 'nullable|url|max:2000',
            'image_file' => 'nullable|image|max:4096',
            'remove_image' => 'nullable|boolean',
        ];
        $rules += $resource === 'developers'
            ? ['short_name' => 'nullable|string|max:100']
            : ['city' => 'required|string|max:100', 'tagline' => 'nullable|string|max:255'];

        $data = $request->validate($rules);
        unset($data['image_url'], $data['image_file'], $data['remove_image']);
        $data['is_featured'] = $request->boolean('is_featured');

        return $data;
    }

    /** New upload wins, then a pasted URL, then "remove", otherwise keep what is stored. */
    private function image(Request $request, ?string $current): ?string
    {
        $new = null;
        if ($request->hasFile('image_file')) {
            $new = $request->file('image_file')->store('directory', 'public');
        } elseif ($request->filled('image_url')) {
            $new = $request->input('image_url');
        } elseif (! $request->boolean('remove_image')) {
            return $current;
        }
        if ($current !== $new) {
            $this->deleteFile($current);
        }

        return $new;
    }

    private function deleteFile(?string $value): void
    {
        if ($value && Property::isLocalFile($value)) {
            Storage::disk('public')->delete($value);
        }
    }

    private function uniqueSlug(string $model, string $name, ?int $ignore = null): string
    {
        $base = Str::slug($name) ?: 'item';
        $slug = $base;
        for ($i = 2; $model::where('slug', $slug)->when($ignore, fn ($q) => $q->where('id', '!=', $ignore))->exists(); $i++) {
            $slug = "{$base}-{$i}";
        }

        return $slug;
    }
}
