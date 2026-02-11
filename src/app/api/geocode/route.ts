import { NextResponse } from 'next/server';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');

    if (!query) {
        return NextResponse.json({ error: 'Query parameter is required' }, { status: 400 });
    }

    try {
        // 优先尝试 Nominatim (OpenStreetMap)
        const nominatimUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&accept-language=zh`;

        let response = await fetch(nominatimUrl, {
            headers: {
                // 必须带 User-Agent，否则会被 OSM 封锁
                'User-Agent': 'ChiangMaiConnectionApp/1.0 (contact@example.com)'
            }
        });

        if (response.ok) {
            const data = await response.json();
            if (data && data.length > 0) {
                return NextResponse.json(data);
            }
        }

        // 如果 Nominatim 失败或无结果，尝试 Photon (备用源)
        // Photon 对 CORS 和限流更宽松
        const photonUrl = `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&lang=en`; // Photon 中文支持一般，用英文兜底
        response = await fetch(photonUrl);

        if (response.ok) {
            const data = await response.json();
            // 转换 Photon 格式为 Nominatim 格式
            const formatted = data.features.map((f: any) => ({
                display_name: f.properties.name + ', ' + (f.properties.city || f.properties.country || ''),
                lat: f.geometry.coordinates[1],
                lon: f.geometry.coordinates[0]
            }));
            return NextResponse.json(formatted);
        }

        throw new Error('All geocoding services failed');

    } catch (error) {
        console.error('Geocoding error:', error);
        return NextResponse.json({ error: 'Failed to fetch location data' }, { status: 500 });
    }
}
