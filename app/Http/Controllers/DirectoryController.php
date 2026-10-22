<?php

namespace App\Http\Controllers;

use App\Models\Community;
use App\Models\Developer;
use App\Models\Property;
use Illuminate\Http\JsonResponse;

/** Public, read-only endpoints for the Developers and Communities pages. */
class DirectoryController extends Controller
{
    private function rows(): array
    {
        return Property::where('status', 'published')->get(['developer', 'location'])->toArray();
    }

    public function developers(): JsonResponse
    {
        $rows = $this->rows();
        $items = Developer::where('status', 'published')->orderBy('name')->get()
            ->map(fn (Developer $d) => $d->toApi($rows))->values();

        return response()->json(['data' => $items]);
    }

    public function community(string $slug): JsonResponse
    {
        $c = Community::where('status', 'published')->where('slug', $slug)->firstOrFail();

        return $this->withProperties($c, fn ($p) => $c->owns($p));
    }

    public function communities(): JsonResponse
    {
        $rows = $this->rows();
        $items = Community::where('status', 'published')->orderBy('name')->get()
            ->map(fn (Community $c) => $c->toApi($rows))->values();

        return response()->json(['data' => $items]);
    }

    public function developer(string $slug): JsonResponse
    {
        $d = Developer::where('status', 'published')->where('slug', $slug)->firstOrFail();

        return $this->withProperties($d, fn ($p) => $d->owns($p));
    }

    private function withProperties($model, callable $owns): JsonResponse
    {
        $props = Property::where('status', 'published')->orderByDesc('created_at')->get()
            ->filter(fn (Property $p) => $owns(['developer' => $p->developer, 'location' => $p->location]))
            ->values();

        return response()->json([
            'data' => $model->toApi($props->map(fn ($p) => ['developer' => $p->developer, 'location' => $p->location])->all()),
            'properties' => $props->map(fn (Property $p) => $p->toApi())->values(),
        ]);
    }
}
