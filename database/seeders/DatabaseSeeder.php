<?php

namespace Database\Seeders;

use App\Models\Community;
use App\Models\Developer;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

/** Optional starter data from the old static pages. Run: php artisan db:seed --class=DirectorySeeder */
class DirectorySeeder extends Seeder
{
    public function run(): void
    {
        $developers = [
            ['Emaar Properties', 'EMAAR', "Emaar Properties is one of the world's most leading property developers in the United Arab Emirates.", true],
            ['Damac Properties', 'DAMAC', 'Damac Properties is a Dubai-based developer known for luxury residences and branded collaborations.', true],
            ['Sobha Realty', 'Sobha', 'Sobha Realty is recognised for meticulous craftsmanship and fully integrated, backward-integrated construction.', true],
            ['Aldar', 'ALDAR', "Aldar is Abu Dhabi's leading real estate developer, delivering large-scale communities and landmark projects.", true],
            ['Nshama', 'Nshama', 'Nshama creates family-focused communities in Dubai, with a strong focus on lifestyle and affordability.', false],
            ['Sharafi Development', 'Sharafi', 'Sharafi Development is a UAE-based developer built on a legacy of trust and excellence that dates back to 1924.', false],
            ['Gulf Land Property Developers', 'Gulf Land', "Gulf Land Property Developers has established itself as a key player in the UAE's real estate market.", false],
            ['Amwaj Development', 'Amwaj', 'A premier boutique real estate developer in Dubai, committed to innovative and eco-friendly property solutions.', false],
        ];
        foreach ($developers as [$name, $short, $desc, $featured]) {
            Developer::updateOrCreate(['slug' => Str::slug($name)], [
                'name' => $name, 'short_name' => $short, 'description' => $desc,
                'is_featured' => $featured, 'status' => 'published',
            ]);
        }

        $img = [
            'skyline' => 'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?w=1200&auto=format&fit=crop&q=80',
            'city' => 'https://images.unsplash.com/photo-1518684079-3c830dcef090?w=1200&auto=format&fit=crop&q=80',
            'villas' => 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=1200&auto=format&fit=crop&q=80',
            'towers' => 'https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=1200&auto=format&fit=crop&q=80',
            'night' => 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=1200&auto=format&fit=crop&q=80',
            'office' => 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=1200&auto=format&fit=crop&q=80',
        ];

        // name, city, image, featured tagline, featured description
        $communities = [
            ['Dubai Creek Harbour', 'Dubai', 'skyline', 'Waterside Living', 'Wake up to skyline and water views, with promenades, marinas and calm green spaces just steps from your door.'],
            ['Town Square', 'Dubai', 'villas', 'Live in Harmony', 'A warm, family-first neighbourhood with shared amenities, parks and a vibrant community spirit.'],
            ['Dubai Hills Estate', 'Dubai', 'city', 'The Luxe Life', 'High-end living with premium finishes, a championship golf course and homes built for timeless elegance.'],
            ['Discovery Gardens', 'Dubai', 'towers'], ['Fahid Island', 'Abu Dhabi', 'skyline'], ['Mudon', 'Dubai', 'villas'],
            ['Port De La Mer', 'Dubai', 'night'], ['Montenegro', 'Montenegro', 'city'], ['Dubai Sports City', 'Dubai', 'office'],
            ['Arjan', 'Dubai', 'towers'], ['Sobha Siniya Island', 'Umm Al Quwain', 'skyline'], ['Dubai Islands', 'Dubai', 'night'],
            ['The Heights Country Club & Wellness', 'Dubai', 'villas'], ['Palm Jebel Ali', 'Dubai', 'city'],
            ['The World Islands', 'Dubai', 'skyline'], ['Rashid Yachts & Marina', 'Dubai', 'night'], ['Expo City Dubai', 'Dubai', 'office'],
            ['Dubai Production City', 'Dubai', 'towers'], ['District One', 'Dubai', 'villas'],
        ];
        foreach ($communities as $c) {
            Community::updateOrCreate(['slug' => Str::slug($c[0])], [
                'name' => $c[0], 'city' => $c[1], 'image' => $img[$c[2]],
                'tagline' => $c[3] ?? null, 'description' => $c[4] ?? null,
                'is_featured' => isset($c[3]), 'status' => 'published',
            ]);
        }
    }
}
