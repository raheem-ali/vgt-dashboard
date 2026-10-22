<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Developer extends Model
{
    public const IMAGE_FIELD = 'logo';

    protected $fillable = ['name', 'slug', 'short_name', 'description', 'logo', 'is_featured', 'status'];

    protected $casts = ['is_featured' => 'boolean'];

    /** Does this property row (developer, location) belong to this developer? */
    public function owns(array $row): bool
    {
        $d = strtolower(trim((string) ($row['developer'] ?? '')));
        if ($d === '') {
            return false;
        }

        return in_array($d, array_filter([strtolower($this->name), strtolower((string) $this->short_name)]), true);
    }

    public function toApi(array $rows = [], bool $admin = false): array
    {
        $data = [
            'id' => $this->id,
            'slug' => $this->slug,
            'name' => $this->name,
            'short_name' => $this->short_name,
            'description' => $this->description,
            'logo' => $this->logo ? Property::resolveImage($this->logo) : null,
            'featured' => $this->is_featured,
            'status' => $this->status,
            'properties' => count(array_filter($rows, fn ($r) => $this->owns($r))),
        ];
        if ($admin) {
            $data['logo_raw'] = $this->logo;
        }

        return $data;
    }
}
