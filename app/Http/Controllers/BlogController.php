<?php

namespace App\Http\Controllers;

use App\Models\BlogPost;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** Public, read-only blog endpoints. Only published articles are returned. */
class BlogController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = BlogPost::query()->where('status', 'published');

        if ($cat = $request->query('category')) {
            $query->where('category', $cat);
        }

        $perPage = min(max((int) $request->query('per_page', 100), 1), 200);
        $items = $query->orderByDesc('published_at')->orderByDesc('id')->limit($perPage)->get();

        return response()->json([
            // light payload: no intro or sections
            'data' => $items->map(fn (BlogPost $p) => $p->toApi(false, false))->values(),
        ]);
    }

    public function show(string $slug): JsonResponse
    {
        $post = BlogPost::where('status', 'published')->where('slug', $slug)->firstOrFail();

        return response()->json(['data' => $post->toApi(false, true)]);
    }
}