const INAT_BASE = 'https://api.inaturalist.org/v1';
const AVES_TAXON_ID = 3;
const PER_PAGE = 500;

/**
 * All-time research-grade observation counts for every bird species in an
 * iNaturalist place, following pagination.
 *
 * species_counts is sorted most-observed first, so stopping at one page would
 * drop exactly the rarest species (LA County has ~600 species; page 1 ends at
 * species with 5 records).
 *
 * @returns {Promise<{ byTaxonId: Map<number, number>, byName: Map<string, number> }>}
 *          byName is keyed by lowercase scientific name.
 */
async function fetchSpeciesCounts(placeId) {
  const byTaxonId = new Map();
  const byName = new Map();
  for (let page = 1; ; page++) {
    const url = `${INAT_BASE}/observations/species_counts?place_id=${placeId}`
      + `&taxon_id=${AVES_TAXON_ID}&quality_grade=research&captive=false`
      + `&per_page=${PER_PAGE}&page=${page}`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'RareBirdAlertApp/1.0 (contact: see project README)', Accept: 'application/json' },
    });
    if (!res.ok) throw new Error(`iNaturalist species_counts returned ${res.status}`);
    const data = await res.json();
    const results = data.results || [];
    for (const item of results) {
      if (item.taxon?.id != null) byTaxonId.set(item.taxon.id, item.count);
      if (item.taxon?.name) byName.set(item.taxon.name.toLowerCase(), item.count);
    }
    if (results.length < PER_PAGE || page * PER_PAGE >= (data.total_results ?? 0)) break;
  }
  return { byTaxonId, byName };
}

module.exports = { fetchSpeciesCounts };
