<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureAdmin
{
    public function handle(Request $request, Closure $next): Response
    {
        if (($request->user()?->role ?? null) !== 'admin') {
            return response()->json(['message' => 'Admins only.'], 403);
        }

        return $next($request);
    }
}
