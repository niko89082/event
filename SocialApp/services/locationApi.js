export async function fetchNominatimSuggestions(query){
  try{
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=8&q=${encodeURIComponent(query)}`;
    const res = await fetch(url,{ headers:{'Accept-Language':'en'} });
    return await res.json();       // [{display_name, lat, lon, place_id, ...}]
  }catch(e){
    console.log('nominatim',e);
    return [];
  }
}