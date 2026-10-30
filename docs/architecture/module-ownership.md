# Module ownership

`auth` owns identities and guards; `users` and `organizations` own tenants and membership; `devices`, `cameras`, and `assignments` own inventory and access; `gateways` and `streams` own connectivity and media sessions; `alerts` and `notifications` own event workflows; `ai` owns contracts with the separate worker. Vendor protocol details remain in `services/device-connectors`.
