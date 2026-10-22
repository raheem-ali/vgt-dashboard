<?php

namespace App\Http\Controllers;

use App\Models\BlogPost;
use App\Models\Property;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

/** Admin-only CRUD for blog articles. */
class AdminBlogController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = BlogPost::query();

        if ($cat = $request->query('category')) {
            $query->where('category', $cat);
        }

        if ($search = trim((string) $request->query('search', ''))) {
            $query->where(function ($w) use ($search) {
                $w->where('title', 'like', "%{$search}%")
                    ->orWhere('category', 'like', "%{$search}%");
            });
        }

        $items = $query->orderByDesc('published_at')->orderByDesc('id')->get();

        return response()->json([
            'data' => $items->map(fn (BlogPost $p) => $p->toApi(true, true))->values(),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate($this->rules());
        $post = BlogPost::create($this->payload($request, $data, null));

        return response()->json(['data' => $post->toApi(true, true)], 201);
    }

    // POST (multipart) so the image can be sent; the dashboard calls POST /admin/blogs/{id}
    public function update(Request $request, BlogPost $blogPost): JsonResponse
    {
        $data = $request->validate($this->rules());
        $oldImage = $blogPost->image;

        $blogPost->update($this->payload($request, $data, $blogPost));
        $blogPost = $blogPost->fresh();

        if ($oldImage && $oldImage !== $blogPost->image && Property::isLocalFile($oldImage)) {
            Storage::disk('public')->delete($oldImage);
        }

        return response()->json(['data' => $blogPost->toApi(true, true)]);
    }

    public function destroy(BlogPost $blogPost): JsonResponse
    {
        if ($blogPost->image && Property::isLocalFile($blogPost->image)) {
            Storage::disk('public')->delete($blogPost->image);
        }
        $blogPost->delete();

        return response()->json(['message' => 'Article deleted.']);
    }

    private function rules(): array
    {
        return [
            'title' => 'required|string|max:255',
            'slug' => 'nullable|string|max:150',
            'excerpt' => 'nullable|string|max:500',
            'category' => 'nullable|string|max:100',
            'published_at' => 'nullable|date',
            'read_time' => 'nullable|integer|min:1|max:180',
            'status' => 'required|in:published,draft',
            'intro' => 'nullable|string|max:20000',
            'sections' => 'nullable|string|max:200000',
            'image' => 'nullable|string|max:2000',
            'image_file' => 'nullable|image|max:4096',
            'seo_title' => 'nullable|string|max:255',
            'seo_description' => 'nullable|string|max:500',
        ];
    }

    private function payload(Request $request, array $data, ?BlogPost $post): array
    {
        unset($data['image_file']);

        $intro = $this->paragraphs((string) ($data['intro'] ?? ''), 20);
        $sections = $this->sections($request->input('sections'));

        $excerpt = trim((string) ($data['excerpt'] ?? ''));
        if ($excerpt === '' && $intro) {
            $excerpt = Str::limit($intro[0], 200);
        }

        $data['intro'] = $intro;
        $data['sections'] = $sections;
        $data['excerpt'] = $excerpt;
        $data['slug'] = $this->uniqueSlug((string) ($data['slug'] ?? ''), (string) $data['title'], $post?->id);
        $data['category'] = trim((string) ($data['category'] ?? '')) ?: 'News';
        $data['published_at'] = $data['published_at'] ?? ($post?->published_at?->toDateString() ?? now()->toDateString());
        $data['read_time'] = ! empty($data['read_time']) ? (int) $data['read_time'] : null;
        $data['image'] = $this->image($request, $post?->image);
        $data['seo_title'] = trim((string) ($data['seo_title'] ?? '')) ?: null;
        $data['seo_description'] = trim((string) ($data['seo_description'] ?? '')) ?: null;

        return $data;
    }

    /** New upload > kept own file > pasted URL > nothing. */
    private function image(Request $request, ?string $current): ?string
    {
        $file = $request->file('image_file');
        if ($file instanceof UploadedFile) {
            return $file->store('blogs', 'public');
        }

        $value = trim((string) $request->input('image', ''));
        if ($value === '') {
            return null;
        }
        if (Property::isLocalFile($value)) {
            return $value === $current ? $value : null;
        }

        return filter_var($value, FILTER_VALIDATE_URL) ? mb_substr($value, 0, 2000) : null;
    }

    private function uniqueSlug(string $custom, string $title, ?int $ignoreId): string
    {
        $base = Str::limit(Str::slug($custom !== '' ? $custom : $title), 150, '');
        $base = $base !== '' ? $base : 'article';
        $slug = $base;
        $i = 2;

        while (BlogPost::where('slug', $slug)->when($ignoreId, fn ($q) => $q->where('id', '!=', $ignoreId))->exists()) {
            $slug = $base . '-' . $i++;
        }

        return $slug;
    }

    /** Split text into paragraphs on blank lines. */
    private function paragraphs(string $text, int $max): array
    {
        $parts = preg_split('/\R\s*\R/', trim($text)) ?: [];
        $out = [];
        foreach ($parts as $part) {
            $part = trim($part);
            if ($part !== '') {
                $out[] = mb_substr($part, 0, 5000);
            }
        }

        return array_slice($out, 0, $max);
    }

    /** JSON [{heading, body}] -> [{id, heading, paragraphs}]. Sections without a heading are dropped. */
    private function sections(mixed $json): array
    {
        $in = is_string($json) ? json_decode($json, true) : null;
        if (! is_array($in)) {
            return [];
        }

        $out = [];
        $used = [];
        foreach (array_slice($in, 0, 30) as $row) {
            if (! is_array($row)) {
                continue;
            }
            $heading = isset($row['heading']) && is_string($row['heading']) ? mb_substr(trim($row['heading']), 0, 200) : '';
            if ($heading === '') {
                continue;
            }
            $body = isset($row['body']) && is_string($row['body']) ? $row['body'] : '';

            $base = Str::slug($heading) ?: 'section';
            $id = $base;
            $n = 2;
            while (isset($used[$id])) {
                $id = $base . '-' . $n++;
            }
            $used[$id] = true;

            $out[] = ['id' => $id, 'heading' => $heading, 'paragraphs' => $this->paragraphs($body, 30)];
        }

        return $out;
    }
}