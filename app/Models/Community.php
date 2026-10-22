<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Community extends Model
{
    public const IMAGE_FIELD = 'image';

    protected $fillable = ['name', 'slug', 'city', 'tagline', 'description', 'image', 'is_featured', 'status'];

    protected $casts = ['is_featured' => 'boolean'];

    /** A listing belongs to a community when its location text contains the community name. */
    public function owns(array $row): bool
    {
        return stripos((string) ($row['location'] ?? ''), $this->name) !== false;
    }

    public function toApi(array $rows = [], bool $admin = false): array
    {
        $data = [
            'id' => $this->id,
            'slug' => $this->slug,
            'name' => $this->name,
            'city' => $this->city,
            'tagline' => $this->tagline,
            'description' => $this->description,
            'image' => $this->image ? Property::resolveImage($this->image) : null,
            'featured' => $this->is_featured,
            'status' => $this->status,
            'properties' => count(array_filter($rows, fn ($r) => $this->owns($r))),
        ];
        if ($admin) {
            $data['image_raw'] = $this->image;
        }

        return $data;
    }
}
