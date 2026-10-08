ALTER TABLE analytics_sessions ADD COLUMN region_code TEXT NOT NULL DEFAULT '';
ALTER TABLE analytics_sessions ADD COLUMN city_code TEXT NOT NULL DEFAULT '';
ALTER TABLE analytics_sessions ADD COLUMN geo_status TEXT NOT NULL DEFAULT 'legacy';
CREATE INDEX IF NOT EXISTS analytics_sessions_region_idx ON analytics_sessions(day_kst, country_code, region_code, city_code);
INSERT OR IGNORE INTO analytics_meta (key, value) VALUES ('region_collection_started_at', CURRENT_TIMESTAMP);
