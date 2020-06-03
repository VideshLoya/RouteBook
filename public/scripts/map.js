mapboxgl.accessToken =
    'MAPBOX_ACC_TOKEN';

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
