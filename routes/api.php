<?php

use App\Http\Controllers\AdminBlogController;
use App\Http\Controllers\AdminDirectoryController;
use App\Http\Controllers\AdminPropertyController;
use App\Http\Controllers\BlogController;
use App\Http\Controllers\DirectoryController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\PropertyController;
use App\Http\Middleware\EnsureAdmin;
use Illuminate\Support\Facades\Route;

Route::prefix('auth')->group(function () {
    // Throttled to slow down brute-force attempts
    Route::post('/login', [AuthController::class, 'login'])->middleware('throttle:5,1');
    Route::post('/register', [AuthController::class, 'register'])->middleware('throttle:10,1');

    Route::middleware('auth:sanctum')->group(function () {
        Route::get('/me', [AuthController::class, 'me']);
        Route::post('/logout', [AuthController::class, 'logout']);
    });
});

// Public listings used by the website pages
Route::get('/properties', [PropertyController::class, 'index']);
Route::get('/properties/{property}', [PropertyController::class, 'show']);

// Public blog articles
Route::get('/blogs', [BlogController::class, 'index']);
Route::get('/blogs/{slug}', [BlogController::class, 'show']);

// Public developers and communities
Route::get('/developers', [DirectoryController::class, 'developers']);
Route::get('/developers/{slug}', [DirectoryController::class, 'developer']);
Route::get('/communities', [DirectoryController::class, 'communities']);
Route::get('/communities/{slug}', [DirectoryController::class, 'community']);

// Admin dashboard: manage listings and blogs
Route::middleware(['auth:sanctum', EnsureAdmin::class])->prefix('admin')->group(function () {
    Route::get('/properties', [AdminPropertyController::class, 'index']);
    Route::post('/properties', [AdminPropertyController::class, 'store']);
    Route::post('/properties/{property}', [AdminPropertyController::class, 'update']);
    Route::delete('/properties/{property}', [AdminPropertyController::class, 'destroy']);

    Route::get('/blogs', [AdminBlogController::class, 'index']);
    Route::post('/blogs', [AdminBlogController::class, 'store']);
    Route::post('/blogs/{blogPost}', [AdminBlogController::class, 'update']);
    Route::delete('/blogs/{blogPost}', [AdminBlogController::class, 'destroy']);

    // {resource} = developers | communities (update is POST so files can be sent)
    Route::get('/directory/{resource}', [AdminDirectoryController::class, 'index']);
    Route::post('/directory/{resource}', [AdminDirectoryController::class, 'store']);
    Route::post('/directory/{resource}/{id}', [AdminDirectoryController::class, 'update']);
    Route::delete('/directory/{resource}/{id}', [AdminDirectoryController::class, 'destroy']);
});