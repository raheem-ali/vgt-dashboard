<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class BlogPost extends Model
{
    protected $fillable = [
        'slug', 'title', 'excerpt', 'category', 'published_at', 'read_time', 'status',
        'image', 'intro', 'sections', 'seo_title', 'seo_description',
    ];

    protected $casts = [
        'intro' => 'array',
        'sections' => 'array',
        'published_at' => 'date',
        'read_time' => 'integer',
    ];

    /** Minutes to read, from the word count (about 200 words a minute). */
    private function autoReadTime(): int
    {
        $text = implode(' ', array_map('strval', (array) ($this->intro ?? [])));
        foreach ((array) ($this->sections ?? []) as $s) {
            if (! is_array($s)) {
                continue;
            }
            $text .= ' ' . ($s['heading'] ?? '') . ' ' . implode(' ', array_map('strval', (array) ($s['paragraphs'] ?? [])));
        }
        $words = str_word_count(strip_tags($text));

        return max(1, (int) ceil($words / 200));
    }

    /**
     * $detail -> adds intro, sections and SEO (single article page and dashboard)
     * $admin  -> adds the raw stored image and the manual read time
     */
    public function toApi(bool $admin = false, bool $detail = false): array
    {
        $data = [
            'id' => $this->id,
            'slug' => $this->slug,
            'title' => $this->title,
            'excerpt' => (string) $this->excerpt,
            'category' => $this->category,
            'date' => optional($this->published_at)->format('Y-m-d') ?? optional($this->created_at)->format('Y-m-d'),
            'read_time' => $this->read_time ?: $this->autoReadTime(),
            'image' => $this->image ? Property::resolveImage($this->image) : null,
            'status' => $this->status,
        ];

        if ($detail) {
            $data['intro'] = array_values((array) ($this->intro ?? []));
            $data['sections'] = array_values((array) ($this->sections ?? []));
            $data['seo_title'] = $this->seo_title;
            $data['seo_description'] = $this->seo_description;
        }

        if ($admin) {
            $data['image_raw'] = $this->image;
            $data['read_time_manual'] = $this->read_time;
        }

        return $data;
    }
}