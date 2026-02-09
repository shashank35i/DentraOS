-- Unified bootstrap for Dental Clinic AI database (safe, additive).
-- Apply once to provision all required tables/columns for server.js and agents.
-- Usage (from repo root):
--   mysql -h localhost -P 3307 -u dental_app -p dental_clinic < Backend/sql/_all_migrations.sql

-- =========================================================
-- fix_missing_tables.sql
-- =========================================================
-- Fix missing tables for Dental Clinic AI (Safe, Additive)

-- 1. Patient Profiles (Medical History, etc.)
CREATE TABLE IF NOT EXISTS patient_profiles (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  medical_history TEXT NULL,
  allergies TEXT NULL,
  notes TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_pp_user (user_id),
  CONSTRAINT fk_pp_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;

-- 2. Clinic Settings (Global Config)
CREATE TABLE IF NOT EXISTS clinic_settings (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  clinic_name VARCHAR(120) NULL,
  clinic_phone VARCHAR(40) NULL,
  clinic_email VARCHAR(120) NULL,
  clinic_address VARCHAR(255) NULL,
  timezone VARCHAR(64) DEFAULT 'Asia/Kolkata',
  working_hours_json JSON NULL,
  treatment_catalog_json JSON NULL,
  note_templates_json JSON NULL,
  ai_preferences_json JSON NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB;

-- Seed default clinic settings (to avoid backend crashes)
INSERT IGNORE INTO clinic_settings (id, clinic_name, timezone)
VALUES (1, 'My Dental Clinic', 'Asia/Kolkata');

-- 3. Role Permissions (RBAC)
CREATE TABLE IF NOT EXISTS role_permissions (
  role VARCHAR(64) NOT NULL,
  permissions_json JSON NOT NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (role)
) ENGINE=InnoDB;

-- =========================================================
-- fix_patient_profiles.sql (subset/duplicate-safe)
-- =========================================================
CREATE TABLE IF NOT EXISTS patient_profiles (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  medical_history TEXT NULL,
  allergies TEXT NULL,
  notes TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_pp_user (user_id),
  CONSTRAINT fk_pp_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;

-- =========================================================
-- inventory_workflow_core.sql
-- =========================================================
-- Inventory workflow core tables (safe, additive)
-- Run this if your DB was created without Backend/db/schema_query.sql

CREATE TABLE IF NOT EXISTS vendors (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(120) NOT NULL,
  phone VARCHAR(40) NULL,
  email VARCHAR(190) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_vendor_name (name)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS inventory_usage_logs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  appointment_id BIGINT UNSIGNED NULL,
  visit_id BIGINT UNSIGNED NULL,
  doctor_id BIGINT UNSIGNED NULL,
  item_code VARCHAR(64) NULL,
  qty_used INT NOT NULL DEFAULT 0,
  source ENUM('AUTO','MANUAL','ADJUSTMENT') NOT NULL DEFAULT 'AUTO',
  meta_json LONGTEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_usage_appt (appointment_id),
  KEY idx_usage_visit (visit_id),
  KEY idx_usage_doctor (doctor_id),
  KEY idx_usage_item (item_code)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS inventory_alerts (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  item_code VARCHAR(64) NULL,
  alert_type ENUM('LOW_STOCK','EXPIRING_SOON','EXPIRED','ANOMALY') NOT NULL,
  message TEXT NOT NULL,
  status ENUM('OPEN','ACK','CLOSED') NOT NULL DEFAULT 'OPEN',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_item_type (item_code, alert_type),
  KEY idx_type_status (alert_type, status),
  KEY idx_alert_updated (updated_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS purchase_orders (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  vendor_id BIGINT UNSIGNED NOT NULL,
  status ENUM('DRAFT','SENT','RECEIVED','CANCELLED') NOT NULL DEFAULT 'DRAFT',
  requested_by_user_id BIGINT UNSIGNED NULL,
  notes TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_vendor_status (vendor_id, status),
  KEY idx_po_requested_by (requested_by_user_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS purchase_order_items (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  purchase_order_id BIGINT UNSIGNED NOT NULL,
  item_code VARCHAR(64) NOT NULL,
  qty INT NOT NULL,
  unit_price DECIMAL(10,2) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_po_item (purchase_order_id, item_code),
  KEY idx_po (purchase_order_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS idempotency_locks (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  lock_key VARCHAR(190) NOT NULL,
  locked_by VARCHAR(64) NULL,
  expires_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_lock_key (lock_key),
  KEY idx_expires_at (expires_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS appointment_audit_logs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  appointment_id BIGINT UNSIGNED NOT NULL,
  action VARCHAR(64) NOT NULL,
  meta_json LONGTEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_appt_action (appointment_id, action)
) ENGINE=InnoDB;

-- =========================================================
-- inventory_agent_migration.sql
-- =========================================================
-- Inventory Agent analytics + anomaly logs
-- Safe, additive migrations only.

CREATE TABLE IF NOT EXISTS inventory_usage_daily (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  usage_date DATE NOT NULL,
  doctor_id BIGINT UNSIGNED NULL,
  procedure_code VARCHAR(64) NULL,
  item_code VARCHAR(64) NOT NULL,
  qty_used INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_usage_daily (usage_date, doctor_id, procedure_code, item_code),
  KEY idx_usage_date (usage_date),
  KEY idx_usage_doctor (doctor_id),
  KEY idx_usage_proc (procedure_code),
  KEY idx_usage_item (item_code)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS inventory_anomaly_logs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  doctor_id BIGINT UNSIGNED NULL,
  item_code VARCHAR(64) NULL,
  qty INT NULL,
  avg_30d DECIMAL(10,2) NULL,
  appointment_id BIGINT UNSIGNED NULL,
  visit_id BIGINT UNSIGNED NULL,
  note VARCHAR(255) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_anom_doctor (doctor_id),
  KEY idx_anom_item (item_code),
  KEY idx_anom_created (created_at)
) ENGINE=InnoDB;

-- =========================================================
-- revenue_agent_migration.sql
-- =========================================================
-- Revenue Agent analytics + insights schema updates
-- Safe, additive migrations only.

CREATE TABLE IF NOT EXISTS revenue_analytics_daily (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  usage_date DATE NOT NULL,
  doctor_id BIGINT UNSIGNED NULL,
  procedure_code VARCHAR(64) NULL,
  total_revenue DECIMAL(12,2) NOT NULL DEFAULT 0,
  total_qty DECIMAL(12,2) NOT NULL DEFAULT 0,
  appointment_count INT NOT NULL DEFAULT 0,
  chair_minutes INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_rev_daily (usage_date, doctor_id, procedure_code),
  KEY idx_rev_date (usage_date),
  KEY idx_rev_doctor (doctor_id),
  KEY idx_rev_proc (procedure_code)
) ENGINE=InnoDB;

DROP PROCEDURE IF EXISTS add_col_if_missing;
DELIMITER $$
CREATE PROCEDURE add_col_if_missing(
  IN p_table VARCHAR(64),
  IN p_col   VARCHAR(64),
  IN p_def   TEXT
)
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = p_table
      AND COLUMN_NAME = p_col
  ) THEN
    SET @sql = CONCAT('ALTER TABLE ', p_table, ' ADD COLUMN ', p_col, ' ', p_def);
    PREPARE stmt FROM @sql;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
  END IF;
END$$
DELIMITER ;

-- revenue_insights: add fields required by RevenueAgent
CALL add_col_if_missing('revenue_insights', 'insight_type', "VARCHAR(64) NULL AFTER as_of_date");
CALL add_col_if_missing('revenue_insights', 'range_label', "VARCHAR(16) NULL AFTER insight_type");
CALL add_col_if_missing('revenue_insights', 'forecast_json', "LONGTEXT NULL AFTER raw_json");
CALL add_col_if_missing('revenue_insights', 'kpi_json', "LONGTEXT NULL AFTER forecast_json");

-- appointments: clinic/branch support (optional analytics)
CALL add_col_if_missing('appointments', 'clinic_id', 'BIGINT UNSIGNED NULL AFTER operatory_id');

-- invoices: claim/insurance tracking
CALL add_col_if_missing('invoices', 'claim_status', "VARCHAR(32) NULL AFTER status");
CALL add_col_if_missing('invoices', 'insurance_status', "VARCHAR(32) NULL AFTER claim_status");
CALL add_col_if_missing('invoices', 'claim_submitted_at', "DATETIME NULL AFTER insurance_status");
CALL add_col_if_missing('invoices', 'claim_rejected_at', "DATETIME NULL AFTER claim_submitted_at");
CALL add_col_if_missing('invoices', 'claim_denied_at', "DATETIME NULL AFTER claim_rejected_at");

-- Replace single-day uniqueness with (as_of_date, insight_type, range_label)
SET @has_uq_as_of := (
  SELECT COUNT(1) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA=DATABASE()
    AND TABLE_NAME='revenue_insights'
    AND INDEX_NAME='uq_rev_as_of'
);

SET @has_uq_as_of_type := (
  SELECT COUNT(1) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA=DATABASE()
    AND TABLE_NAME='revenue_insights'
    AND INDEX_NAME='uq_rev_as_of_type'
);

SET @sql_drop := IF(@has_uq_as_of>0, 'ALTER TABLE revenue_insights DROP INDEX uq_rev_as_of', 'SELECT 1');
PREPARE r1 FROM @sql_drop; EXECUTE r1; DEALLOCATE PREPARE r1;

SET @sql_add := IF(@has_uq_as_of_type=0,
  'ALTER TABLE revenue_insights ADD UNIQUE KEY uq_rev_as_of_type (as_of_date, insight_type, range_label)',
  'SELECT 1'
);
PREPARE r2 FROM @sql_add; EXECUTE r2; DEALLOCATE PREPARE r2;

DROP PROCEDURE IF EXISTS add_col_if_missing;
