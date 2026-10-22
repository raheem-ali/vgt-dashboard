<?php

namespace App\Http\Controllers;

use App\Models\Property;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** Public, read-only endpoints used by the website. Only published listings are returned. */
class PropertyController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = Property::query()->where('status', 'published');

        if ($type = $request->query('listing_type')) {
            $query->where('listing_type', $type);
        }

        if ($request->boolean('featured')) {
            $query->where('is_featured', true);
        }

        if ($developer = $request->query('developer')) {
            $query->where('developer', $developer);
        }

        if ($search = trim((string) $request->query('search', ''))) {
            $query->where(function ($w) use ($search) {
                $w->where('title', 'like', "%{$search}%")
                    ->orWhere('location', 'like', "%{$search}%");
            });
        }

        // order=featured puts featured listings first (used by the home page)
        if ($request->query('order') === 'featured') {
            $query->orderByDesc('is_featured');
        }

        $query->orderByDesc('created_at')->orderByDesc('id');

        $perPage = min(max((int) $request->query('per_page', 50), 1), 200);
        $page = $query->paginate($perPage);

        return response()->json([
            // light payload: no unit types, master plan, payment plans, etc.
            'data' => $page->getCollection()->map(fn (Property $p) => $p->toApi(false, false))->values(),
            'total' => $page->total(),
            'last_page' => $page->lastPage(),
        ]);
    }

    public function show(Property $property): JsonResponse
    {
        abort_if($property->status !== 'published', 404);

        // full payload: every block of the single listing page, images fully resolved
        return response()->json(['data' => $property->toApi(false, true)]);
    }
}