# Data Sources

This file tracks every external data source the app pulls from, its licensing posture, and attribution requirements. Update whenever a source is added, removed, or its terms change.

## eBird API 2.0
- Adapter: `backend/sources/EBirdSource.js`
- Endpoint: `https://api.ebird.org/v2/data/obs/{region}/recent/notable`
- License: Non-commercial by default. Commercial requires written permission.
- Permission status: Using personal key for development. Commercial license not yet requested.
- Contact for commercial use: Mary Guthrie (msg21@cornell.edu)
- Attribution: "Data from eBird (Cornell Lab of Ornithology, ebird.org)"
- Poll interval: 10 minutes per region
- Last terms review: 2026-05-11

## (Future) iNaturalist API
- License: CC-BY when filtered; commercial-friendly with attribution
- Status: Not yet implemented