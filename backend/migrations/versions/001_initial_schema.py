"""Initial schema — all tables, indexes, partitions, seed data

Revision ID: 001
Create Date: 2026-06-13
"""
import os
import uuid
from datetime import datetime, timezone

import bcrypt
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB, UUID

revision = "001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── users ──────────────────────────────────────────────────────────────────
    op.create_table(
        "users",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column("email", sa.String(255), unique=True, nullable=False),
        sa.Column("hashed_password", sa.Text, nullable=False),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("is_superuser", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("last_login", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_users_email", "users", ["email"])

    # ── cars ───────────────────────────────────────────────────────────────────
    op.create_table(
        "cars",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("eid", sa.BigInteger, unique=True, nullable=False),
        sa.Column("vid", sa.BigInteger, unique=True, nullable=False),
        sa.Column("vin", sa.String(17), nullable=True),
        sa.Column("name", sa.String(255), nullable=True),
        sa.Column("model", sa.String(50), nullable=True),
        sa.Column("trim_badging", sa.String(50), nullable=True),
        sa.Column("efficiency", sa.Float, nullable=True),
        sa.Column("marketing_name", sa.String(255), nullable=True),
        sa.Column("inserted_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    # ── geofences ──────────────────────────────────────────────────────────────
    op.create_table(
        "geofences",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("name", sa.String(255), unique=True, nullable=False),
        sa.Column("latitude", sa.Float, nullable=False),
        sa.Column("longitude", sa.Float, nullable=False),
        sa.Column("radius", sa.Float, nullable=False, server_default="20"),
        sa.Column("cost_per_unit", sa.Float, nullable=True),
        sa.Column("billing_type", sa.String(20), nullable=True),
        sa.Column("session_fee", sa.Float, nullable=True),
        sa.Column("inserted_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    # ── addresses ──────────────────────────────────────────────────────────────
    op.create_table(
        "addresses",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("display_name", sa.Text, nullable=True),
        sa.Column("name", sa.String(255), nullable=True),
        sa.Column("house_number", sa.String(20), nullable=True),
        sa.Column("road", sa.String(255), nullable=True),
        sa.Column("neighbourhood", sa.String(255), nullable=True),
        sa.Column("city", sa.String(255), nullable=True),
        sa.Column("county", sa.String(255), nullable=True),
        sa.Column("postcode", sa.String(20), nullable=True),
        sa.Column("state", sa.String(255), nullable=True),
        sa.Column("state_district", sa.String(255), nullable=True),
        sa.Column("country", sa.String(255), nullable=True),
        sa.Column("raw", JSONB, nullable=True),
        sa.Column("inserted_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    # ── states ─────────────────────────────────────────────────────────────────
    op.create_table(
        "states",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("car_id", sa.Integer, sa.ForeignKey("cars.id", ondelete="CASCADE"), nullable=False),
        sa.Column("state", sa.String(50), nullable=False),
        sa.Column("start_date", sa.DateTime(timezone=True), nullable=False),
        sa.Column("end_date", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("idx_states_car_date", "states", ["car_id", sa.text("start_date DESC")])
    op.create_index(
        "idx_states_car_current", "states", ["car_id"],
        postgresql_where=sa.text("end_date IS NULL"),
    )

    # ── drives ─────────────────────────────────────────────────────────────────
    op.create_table(
        "drives",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("car_id", sa.Integer, sa.ForeignKey("cars.id", ondelete="CASCADE"), nullable=False),
        sa.Column("start_date", sa.DateTime(timezone=True), nullable=False),
        sa.Column("end_date", sa.DateTime(timezone=True), nullable=True),
        sa.Column("outside_temp_avg", sa.Float, nullable=True),
        sa.Column("speed_max", sa.SmallInteger, nullable=True),
        sa.Column("power_max", sa.SmallInteger, nullable=True),
        sa.Column("power_min", sa.SmallInteger, nullable=True),
        sa.Column("start_ideal_range_km", sa.Float, nullable=True),
        sa.Column("end_ideal_range_km", sa.Float, nullable=True),
        sa.Column("start_km", sa.Float, nullable=True),
        sa.Column("end_km", sa.Float, nullable=True),
        sa.Column("distance", sa.Float, nullable=True),
        sa.Column("duration_min", sa.SmallInteger, nullable=True),
        sa.Column("consumption_kWh", sa.Float, nullable=True),
        sa.Column("start_address_id", sa.Integer, sa.ForeignKey("addresses.id"), nullable=True),
        sa.Column("end_address_id", sa.Integer, sa.ForeignKey("addresses.id"), nullable=True),
        sa.Column("start_geofence_id", sa.Integer, sa.ForeignKey("geofences.id"), nullable=True),
        sa.Column("end_geofence_id", sa.Integer, sa.ForeignKey("geofences.id"), nullable=True),
        sa.Column("start_position_id", sa.Integer, nullable=True),
        sa.Column("end_position_id", sa.Integer, nullable=True),
        sa.Column("inserted_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("idx_drives_car_date", "drives", ["car_id", sa.text("start_date DESC")])

    # ── charging_processes ─────────────────────────────────────────────────────
    op.create_table(
        "charging_processes",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("car_id", sa.Integer, sa.ForeignKey("cars.id", ondelete="CASCADE"), nullable=False),
        sa.Column("start_date", sa.DateTime(timezone=True), nullable=False),
        sa.Column("end_date", sa.DateTime(timezone=True), nullable=True),
        sa.Column("charge_energy_added", sa.Float, nullable=True),
        sa.Column("charge_energy_used", sa.Float, nullable=True),
        sa.Column("charging_status", sa.String(20), nullable=True),
        sa.Column("start_ideal_range_km", sa.Float, nullable=True),
        sa.Column("end_ideal_range_km", sa.Float, nullable=True),
        sa.Column("start_battery_level", sa.SmallInteger, nullable=True),
        sa.Column("end_battery_level", sa.SmallInteger, nullable=True),
        sa.Column("duration_min", sa.SmallInteger, nullable=True),
        sa.Column("outside_temp_avg", sa.Float, nullable=True),
        sa.Column("position_id", sa.Integer, nullable=True),
        sa.Column("address_id", sa.Integer, sa.ForeignKey("addresses.id"), nullable=True),
        sa.Column("geofence_id", sa.Integer, sa.ForeignKey("geofences.id"), nullable=True),
        sa.Column("cost", sa.Float, nullable=True),
        sa.Column("inserted_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("idx_charging_car_date", "charging_processes", ["car_id", sa.text("start_date DESC")])

    # ── positions (partitioned by year) ────────────────────────────────────────
    # Create parent partitioned table first
    op.execute("""
        CREATE TABLE positions (
            id          BIGSERIAL,
            car_id      INTEGER NOT NULL REFERENCES cars(id) ON DELETE CASCADE,
            drive_id    INTEGER REFERENCES drives(id) ON DELETE SET NULL,
            date        TIMESTAMPTZ NOT NULL,
            latitude    FLOAT NOT NULL,
            longitude   FLOAT NOT NULL,
            speed               SMALLINT,
            heading             FLOAT,
            elevation           FLOAT,
            power               SMALLINT,
            odometer            FLOAT,
            ideal_battery_range_km  FLOAT,
            est_battery_range_km    FLOAT,
            rated_battery_range_km  FLOAT,
            battery_level           SMALLINT,
            usable_battery_level    SMALLINT,
            battery_heater_no_power BOOLEAN,
            battery_heater_on       BOOLEAN,
            outside_temp            FLOAT,
            inside_temp             FLOAT,
            fan_status              SMALLINT,
            driver_temp_setting     FLOAT,
            passenger_temp_setting  FLOAT,
            is_climate_on           BOOLEAN,
            is_rear_defroster_on    BOOLEAN,
            is_front_defroster_on   BOOLEAN,
            tpms_pressure_fl        FLOAT,
            tpms_pressure_fr        FLOAT,
            tpms_pressure_rl        FLOAT,
            tpms_pressure_rr        FLOAT,
            locked                  BOOLEAN,
            sentry_mode             BOOLEAN,
            is_user_present         BOOLEAN,
            shift_state             VARCHAR(10),
            PRIMARY KEY (id, date)
        ) PARTITION BY RANGE (date)
    """)

    # Year partitions 2023–2027
    for year in range(2023, 2028):
        op.execute(f"""
            CREATE TABLE positions_{year} PARTITION OF positions
            FOR VALUES FROM ('{year}-01-01') TO ('{year + 1}-01-01')
        """)
        op.execute(f"CREATE INDEX idx_positions_{year}_car_date ON positions_{year} (car_id, date DESC)")
        op.execute(f"CREATE INDEX idx_positions_{year}_drive_id ON positions_{year} (drive_id)")

    # ── charges ────────────────────────────────────────────────────────────────
    op.create_table(
        "charges",
        sa.Column("id", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column("charging_process_id", sa.Integer, sa.ForeignKey("charging_processes.id", ondelete="CASCADE"), nullable=False),
        sa.Column("date", sa.DateTime(timezone=True), nullable=False),
        sa.Column("battery_heater_on", sa.Boolean, nullable=True),
        sa.Column("battery_level", sa.SmallInteger, nullable=True),
        sa.Column("charge_energy_added", sa.Float, nullable=True),
        sa.Column("charger_actual_current", sa.SmallInteger, nullable=True),
        sa.Column("charger_phases", sa.SmallInteger, nullable=True),
        sa.Column("charger_pilot_current", sa.SmallInteger, nullable=True),
        sa.Column("charger_power", sa.SmallInteger, nullable=True),
        sa.Column("charger_voltage", sa.SmallInteger, nullable=True),
        sa.Column("fast_charger_present", sa.Boolean, nullable=True),
        sa.Column("fast_charger_brand", sa.String(50), nullable=True),
        sa.Column("fast_charger_type", sa.String(50), nullable=True),
        sa.Column("ideal_battery_range_km", sa.Float, nullable=True),
        sa.Column("rated_battery_range_km", sa.Float, nullable=True),
        sa.Column("outside_temp", sa.Float, nullable=True),
        sa.Column("usable_battery_level", sa.SmallInteger, nullable=True),
    )
    op.create_index("idx_charges_process", "charges", ["charging_process_id", sa.text("date")])

    # ── updates ────────────────────────────────────────────────────────────────
    op.create_table(
        "updates",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("car_id", sa.Integer, sa.ForeignKey("cars.id", ondelete="CASCADE"), nullable=False),
        sa.Column("start_date", sa.DateTime(timezone=True), nullable=False),
        sa.Column("end_date", sa.DateTime(timezone=True), nullable=True),
        sa.Column("version", sa.String(50), nullable=True),
        sa.Column("inserted_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    # ── settings ───────────────────────────────────────────────────────────────
    op.create_table(
        "settings",
        sa.Column("id", sa.Integer, primary_key=True, default=1),
        sa.Column("unit_of_length", sa.String(2), nullable=False, server_default="km"),
        sa.Column("unit_of_temperature", sa.String(1), nullable=False, server_default="C"),
        sa.Column("preferred_range", sa.String(10), nullable=False, server_default="ideal"),
        sa.Column("base_url", sa.Text, nullable=True),
        sa.Column("language", sa.String(10), nullable=False, server_default="en"),
        sa.Column("inserted_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    # ── Seed default settings row ──────────────────────────────────────────────
    op.execute("INSERT INTO settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING")

    # ── Seed admin user ────────────────────────────────────────────────────────
    admin_email = os.environ.get("INITIAL_ADMIN_EMAIL", "admin@teslamate.local")
    admin_password = os.environ.get("INITIAL_ADMIN_PASSWORD", "changeme")
    hashed = bcrypt.hashpw(admin_password.encode(), bcrypt.gensalt(rounds=12)).decode()
    admin_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    op.execute(
        sa.text(
            "INSERT INTO users (id, email, hashed_password, is_active, is_superuser, created_at) "
            "VALUES (:id, :email, :pw, true, true, :now) "
            "ON CONFLICT (email) DO NOTHING"
        ).bindparams(id=admin_id, email=admin_email, pw=hashed, now=now)
    )


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS charges")
    for year in range(2023, 2028):
        op.execute(f"DROP TABLE IF EXISTS positions_{year}")
    op.execute("DROP TABLE IF EXISTS positions")
    op.drop_table("updates")
    op.drop_table("settings")
    op.drop_table("charging_processes")
    op.drop_table("drives")
    op.drop_table("states")
    op.drop_table("addresses")
    op.drop_table("geofences")
    op.drop_table("cars")
    op.drop_table("users")
