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
