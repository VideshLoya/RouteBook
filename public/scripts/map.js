mapboxgl.accessToken =
    'pk.eyJ1IjoidmlkZXNobG95YSIsImEiOiJja2F6MzF4b2YwN3FnMnhxcnMxOTd1MTNuIn0.P9asMuKmv6sDakWvzb19pg';

var map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/mapbox/streets-v11',
    zoom: 9,
    center: [lng, lat]
});

var marker = new mapboxgl.Marker()
    .setLngLat([lng, lat])
    .addTo(map);

// Add zoom and rotation controls to the map.
map.addControl(new mapboxgl.NavigationControl());
