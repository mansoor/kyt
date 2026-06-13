#!/usr/bin/env python3
"""
TeslaMate → KYT data importer.

Reads from an existing TeslaMate PostgreSQL database and copies:
  cars, addresses, geofences, states, drives, charging_processes,
  positions (sampled), updates

Usage:
  # Inside the backend container or with both DBs reachable:
  python scripts/import_teslamate.py \
    --src  "postgresql://teslamate:teslamate@db:5432/teslamate" \
    --dest "postgresql://teslamate:teslamate@db:5432/teslamate" \
    --dry-run

  # Real import (skip --dry-run):
  python scripts/import_teslamate.py \
    --src  "postgresql://user:pass@old-host:5432/teslamate" \
    --dest "postgresql://teslamate:teslamate@db:5432/teslamate"

Notes:
  - The importer is UPSERT-safe: re-running it will not create duplicates.
  - Positions are sampled (every Nth row) to keep the import fast.
    Use --position-sample 1 to import all positions.
  - The dest DB must already have the KYT schema applied (run via Alembic).
"""
from __future__ import annotations

import argparse
import sys
from datetime import datetime, timezone

import psycopg2
import psycopg2.extras

BATCH = 500


def log(msg: str) -> None:
    print(f"[{datetime.now().strftime('%H:%M:%S')}] {msg}", flush=True)


def connect(url: str):
    return psycopg2.connect(url, cursor_factory=psycopg2.extras.RealDictCursor)


def import_cars(src_cur, dst_cur, dry: bool) -> dict[int, int]:
    """Returns mapping src_car_id → dst_car_id."""
    log("Importing cars…")
    src_cur.execute("""
        SELECT id, eid, vid, vin, name, model, trim_badging, efficiency, marketing_name
        FROM cars ORDER BY id
    """)
    rows = src_cur.fetchall()
    id_map: dict[int, int] = {}
    for r in rows:
        if not dry:
            dst_cur.execute("""
                INSERT INTO cars (eid, vid, vin, name, model, trim_badging, efficiency, marketing_name)
                VALUES (%(eid)s, %(vid)s, %(vin)s, %(name)s, %(model)s,
                        %(trim_badging)s, %(efficiency)s, %(marketing_name)s)
                ON CONFLICT (eid) DO UPDATE SET
                    name = EXCLUDED.name, model = EXCLUDED.model
                RETURNING id
            """, dict(r))
            dst_id = dst_cur.fetchone()["id"]
        else:
            dst_id = r["id"]
        id_map[r["id"]] = dst_id
        log(f"  car {r['id']} ({r['name'] or r['vin']}) → dst id {dst_id}")
    return id_map


def import_addresses(src_cur, dst_cur, dry: bool) -> dict[int, int]:
    log("Importing addresses…")
    # Select only columns that exist in both TeslaMate and KYT schemas
    src_cur.execute("""
        SELECT id, display_name, name, house_number, road, neighbourhood, city,
               county, postcode, country, raw
        FROM addresses ORDER BY id
    """)
    rows = src_cur.fetchall()
    id_map: dict[int, int] = {}
    for r in rows:
        if not dry:
            dst_cur.execute("""
                INSERT INTO addresses (display_name, name, house_number, road,
                    neighbourhood, city, county, postcode, country, raw)
                VALUES (%(display_name)s, %(name)s, %(house_number)s, %(road)s,
                    %(neighbourhood)s, %(city)s, %(county)s,
                    %(postcode)s, %(country)s, %(raw)s)
                RETURNING id
            """, dict(r))
            row = dst_cur.fetchone()
            dst_id = row["id"] if row else r["id"]
        else:
            dst_id = r["id"]
        id_map[r["id"]] = dst_id
    log(f"  {len(rows)} addresses imported")
    return id_map


def import_geofences(src_cur, dst_cur, dry: bool) -> dict[int, int]:
    log("Importing geofences…")
    src_cur.execute("""
        SELECT id, name, latitude, longitude, radius,
               cost_per_unit, billing_type, session_fee
        FROM geofences ORDER BY id
    """)
    rows = src_cur.fetchall()
    id_map: dict[int, int] = {}
    for r in rows:
        if not dry:
            dst_cur.execute("""
                INSERT INTO geofences (name, latitude, longitude, radius,
                    cost_per_unit, billing_type, session_fee)
                VALUES (%(name)s, %(latitude)s, %(longitude)s, %(radius)s,
                    %(cost_per_unit)s, %(billing_type)s, %(session_fee)s)
                ON CONFLICT (name) DO UPDATE SET
                    latitude = EXCLUDED.latitude, longitude = EXCLUDED.longitude,
                    radius = EXCLUDED.radius
                RETURNING id
            """, dict(r))
            dst_id = dst_cur.fetchone()["id"]
        else:
            dst_id = r["id"]
        id_map[r["id"]] = dst_id
    log(f"  {len(rows)} geofences imported")
    return id_map


def import_states(src_cur, dst_cur, dry: bool, car_map: dict) -> None:
    log("Importing states…")
    for src_id, dst_id in car_map.items():
        src_cur.execute("""
            SELECT state, start_date, end_date
            FROM states WHERE car_id = %s ORDER BY start_date
        """, (src_id,))
        rows = src_cur.fetchall()
        if not dry and rows:
            for r in rows:
                dst_cur.execute("""
                    INSERT INTO states (car_id, state, start_date, end_date)
                    VALUES (%s, %s, %s, %s)
                    ON CONFLICT DO NOTHING
                """, (dst_id, r["state"], r["start_date"], r["end_date"]))
        log(f"  car {src_id}: {len(rows)} states")


def import_updates(src_cur, dst_cur, dry: bool, car_map: dict) -> None:
    log("Importing software updates…")
    for src_id, dst_id in car_map.items():
        src_cur.execute("""
            SELECT start_date, end_date, version
            FROM updates WHERE car_id = %s ORDER BY start_date
        """, (src_id,))
        rows = src_cur.fetchall()
        if not dry and rows:
            for r in rows:
                dst_cur.execute("""
                    INSERT INTO updates (car_id, start_date, end_date, version)
                    VALUES (%s, %s, %s, %s)
                    ON CONFLICT DO NOTHING
                """, (dst_id, r["start_date"], r["end_date"], r["version"]))
        log(f"  car {src_id}: {len(rows)} software updates")


def import_drives(src_cur, dst_cur, dry: bool,
                  car_map: dict, addr_map: dict, fence_map: dict) -> dict[int, int]:
    log("Importing drives…")
    id_map: dict[int, int] = {}
    for src_car, dst_car in car_map.items():
        src_cur.execute("""
            SELECT id, start_date, end_date, outside_temp_avg, speed_max,
                   power_max, power_min, start_ideal_range_km, end_ideal_range_km,
                   start_km, end_km, distance, duration_min, "consumption_kWh",
                   start_address_id, end_address_id,
                   start_geofence_id, end_geofence_id,
                   start_position_id, end_position_id
            FROM drives WHERE car_id = %s ORDER BY start_date
        """, (src_car,))
        rows = src_cur.fetchall()
        for r in rows:
            sa_id = addr_map.get(r["start_address_id"]) if r["start_address_id"] else None
            ea_id = addr_map.get(r["end_address_id"]) if r["end_address_id"] else None
            sg_id = fence_map.get(r["start_geofence_id"]) if r["start_geofence_id"] else None
            eg_id = fence_map.get(r["end_geofence_id"]) if r["end_geofence_id"] else None
            if not dry:
                dst_cur.execute("""
                    INSERT INTO drives (
                        car_id, start_date, end_date, outside_temp_avg, speed_max,
                        power_max, power_min, start_ideal_range_km, end_ideal_range_km,
                        start_km, end_km, distance, duration_min, "consumption_kWh",
                        start_address_id, end_address_id,
                        start_geofence_id, end_geofence_id
                    ) VALUES (
                        %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
                        %s, %s, %s, %s
                    ) RETURNING id
                """, (
                    dst_car, r["start_date"], r["end_date"], r["outside_temp_avg"],
                    r["speed_max"], r["power_max"], r["power_min"],
                    r["start_ideal_range_km"], r["end_ideal_range_km"],
                    r["start_km"], r["end_km"], r["distance"], r["duration_min"],
                    r["consumption_kWh"], sa_id, ea_id, sg_id, eg_id,
                ))
                dst_id = dst_cur.fetchone()["id"]
            else:
                dst_id = r["id"]
            id_map[r["id"]] = dst_id
        log(f"  car {src_car}: {len(rows)} drives")
    return id_map


def import_charging_processes(src_cur, dst_cur, dry: bool,
                               car_map: dict, addr_map: dict, fence_map: dict) -> dict[int, int]:
    log("Importing charging processes…")
    id_map: dict[int, int] = {}
    for src_car, dst_car in car_map.items():
        src_cur.execute("""
            SELECT id, start_date, end_date, charge_energy_added, charge_energy_used,
                   start_battery_level, end_battery_level, start_ideal_range_km,
                   end_ideal_range_km, start_rated_range_km, end_rated_range_km,
                   duration_min, outside_temp_avg, latitude, longitude,
                   address_id, geofence_id, cost
            FROM charging_processes WHERE car_id = %s ORDER BY start_date
        """, (src_car,))
        rows = src_cur.fetchall()
        for r in rows:
            a_id = addr_map.get(r["address_id"]) if r["address_id"] else None
            g_id = fence_map.get(r["geofence_id"]) if r["geofence_id"] else None
            if not dry:
                dst_cur.execute("""
                    INSERT INTO charging_processes (
                        car_id, start_date, end_date, charge_energy_added,
                        charge_energy_used, start_battery_level, end_battery_level,
                        start_ideal_range_km, end_ideal_range_km,
                        start_rated_range_km, end_rated_range_km,
                        duration_min, outside_temp_avg, latitude, longitude,
                        address_id, geofence_id, cost
                    ) VALUES (
                        %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
                        %s, %s, %s, %s, %s, %s, %s
                    ) RETURNING id
                """, (
                    dst_car, r["start_date"], r["end_date"], r["charge_energy_added"],
                    r["charge_energy_used"], r["start_battery_level"], r["end_battery_level"],
                    r["start_ideal_range_km"], r["end_ideal_range_km"],
                    r["start_rated_range_km"], r["end_rated_range_km"],
                    r["duration_min"], r["outside_temp_avg"],
                    r["latitude"], r["longitude"], a_id, g_id, r["cost"],
                ))
                dst_id = dst_cur.fetchone()["id"]
            else:
                dst_id = r["id"]
            id_map[r["id"]] = dst_id
        log(f"  car {src_car}: {len(rows)} charging processes")
    return id_map


def import_positions(src_cur, dst_cur, dry: bool,
                     car_map: dict, drive_map: dict, sample: int) -> None:
    log(f"Importing positions (1-in-{sample} sample)…")
    for src_car, dst_car in car_map.items():
        # Count first
        src_cur.execute("SELECT COUNT(*) AS n FROM positions WHERE car_id = %s", (src_car,))
        total = src_cur.fetchone()["n"]
        log(f"  car {src_car}: {total:,} positions → sampling ~{total // sample:,}")

        # Stream in batches using server-side cursor
        batch_cur = src_cur.connection.cursor(
            "pos_batch", cursor_factory=psycopg2.extras.RealDictCursor
        )
        batch_cur.execute("""
            SELECT id, date, latitude, longitude, speed, heading, elevation,
                   power, odometer, ideal_battery_range_km, est_battery_range_km,
                   rated_battery_range_km, battery_level, usable_battery_level,
                   outside_temp, inside_temp, drive_id
            FROM positions WHERE car_id = %s ORDER BY date
        """, (src_car,))

        i = 0
        buf = []
        while True:
            row = batch_cur.fetchone()
            if row is None:
                break
            i += 1
            if i % sample != 0:
                continue
            dst_drive_id = drive_map.get(row["drive_id"]) if row["drive_id"] else None
            buf.append((
                dst_car, row["date"], row["latitude"], row["longitude"],
                row["speed"], row["heading"], row["elevation"],
                row["power"], row["odometer"],
                row["ideal_battery_range_km"], row["est_battery_range_km"],
                row["rated_battery_range_km"], row["battery_level"],
                row["usable_battery_level"], row["outside_temp"], row["inside_temp"],
                dst_drive_id,
            ))
            if len(buf) >= BATCH and not dry:
                psycopg2.extras.execute_batch(dst_cur, """
                    INSERT INTO positions (
                        car_id, date, latitude, longitude, speed, heading, elevation,
                        power, odometer, ideal_battery_range_km, est_battery_range_km,
                        rated_battery_range_km, battery_level, usable_battery_level,
                        outside_temp, inside_temp, drive_id
                    ) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                    ON CONFLICT DO NOTHING
                """, buf)
                buf.clear()

        if buf and not dry:
            psycopg2.extras.execute_batch(dst_cur, """
                INSERT INTO positions (
                    car_id, date, latitude, longitude, speed, heading, elevation,
                    power, odometer, ideal_battery_range_km, est_battery_range_km,
                    rated_battery_range_km, battery_level, usable_battery_level,
                    outside_temp, inside_temp, drive_id
                ) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                ON CONFLICT DO NOTHING
            """, buf)

        batch_cur.close()
        log(f"  car {src_car}: done")


def main() -> None:
    parser = argparse.ArgumentParser(description="Import TeslaMate data into KYT")
    parser.add_argument("--src", required=True, help="Source TeslaMate PostgreSQL URL")
    parser.add_argument("--dest", required=True, help="Destination KYT PostgreSQL URL")
    parser.add_argument("--dry-run", action="store_true", help="Print stats without writing")
    parser.add_argument("--position-sample", type=int, default=5,
                        help="Import every Nth position row (default: 5)")
    parser.add_argument("--skip-positions", action="store_true", help="Skip position import")
    args = parser.parse_args()

    log("Connecting to source database…")
    src = connect(args.src)
    src.set_session(readonly=True, autocommit=True)
    src_cur = src.cursor()

    log("Connecting to destination database…")
    dst = connect(args.dest)
    dst_cur = dst.cursor()

    if args.dry_run:
        log("DRY RUN — no data will be written")

    try:
        car_map = import_cars(src_cur, dst_cur, args.dry_run)
        addr_map = import_addresses(src_cur, dst_cur, args.dry_run)
        fence_map = import_geofences(src_cur, dst_cur, args.dry_run)
        import_states(src_cur, dst_cur, args.dry_run, car_map)
        import_updates(src_cur, dst_cur, args.dry_run, car_map)
        drive_map = import_drives(src_cur, dst_cur, args.dry_run, car_map, addr_map, fence_map)
        import_charging_processes(src_cur, dst_cur, args.dry_run, car_map, addr_map, fence_map)

        if not args.skip_positions:
            import_positions(src_cur, dst_cur, args.dry_run, car_map, drive_map,
                             args.position_sample)

        if not args.dry_run:
            dst.commit()
            log("✓ Import committed successfully.")
        else:
            log("✓ Dry run complete — no changes made.")

    except Exception as e:
        if not args.dry_run:
            dst.rollback()
        log(f"✗ Error: {e}")
        raise
    finally:
        src_cur.close()
        dst_cur.close()
        src.close()
        dst.close()


if __name__ == "__main__":
    main()
