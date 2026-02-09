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
