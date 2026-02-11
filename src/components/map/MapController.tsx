import { useEffect } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';

interface MapControllerProps {
    target: [number, number] | null;
}

export default function MapController({ target }: MapControllerProps) {
    const map = useMap();

    useEffect(() => {
        if (target) {
            map.flyTo(target, 8, {
                animate: true,
                duration: 1.5 // 秒
            });
        }
    }, [target, map]);

    return null;
}
